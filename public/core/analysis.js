/**
 * Mode A: Question Analysis.
 *
 * Split deliberately into two halves:
 *   - deterministic arithmetic (mark weightage, coverage gaps, out-of-scope
 *     detection, Bloom comparison, hotspots) computed here in plain JS, so the
 *     numbers are reproducible and testable; and
 *   - LLM judgement (coverage tagging, ambiguity linting, rewrite suggestions,
 *     the narrative summary), done in batches with low temperature.
 */
import { callJson } from './llm.js';
import { chunk, round, sum, unique } from './util.js';
import { normaliseBloom } from './syllabus.js';
import {
  buildCoveragePrompt,
  buildLintPrompt,
  buildSuggestionPrompt,
  buildAnalysisSummaryPrompt,
  PROMPT_VERSION,
} from '../prompts/prompts.js';

/** Questions per LLM call. Keeps replies inside the context window. */
export const COVERAGE_BATCH = 12;
export const LINT_BATCH = 8;
export const MAX_SUGGESTION_TARGETS = 8;

/** A module is "over-weighted" when it exceeds its expected share by this much. */
export const HOTSPOT_THRESHOLD_PP = 10;

const step = (onProgress, label, detail) => onProgress?.({ label, detail });

/* ------------------------------------------------------------------ */
/* Reference material                                                   */
/* ------------------------------------------------------------------ */

/**
 * Only in-scope modules and their COs are used as the reference, per the brief.
 */
export function buildReference({ syllabus, scope }) {
  const inScopeNumbers = (scope?.modulesInScope ?? []).length
    ? scope.modulesInScope.map(Number).filter(Number.isFinite)
    : (syllabus?.modules ?? []).map((m) => m.number);

  const modules = (syllabus?.modules ?? []).filter((m) => inScopeNumbers.includes(m.number));
  const moduleTopicIds = new Set();
  for (const m of modules) for (const t of m.topics) moduleTopicIds.add(t.id);

  const allCos = syllabus?.courseOutcomes ?? [];
  // Keep COs, but prefer the ones the in-scope modules refer to when the
  // syllabus maps modules to COs.
  const referenced = new Set(modules.flatMap((m) => m.cos ?? []).map((c) => c.toUpperCase()));
  const courseOutcomes = referenced.size ? allCos.filter((c) => referenced.has(c.id.toUpperCase())) : allCos;

  return {
    inScopeNumbers,
    modules,
    courseOutcomes: courseOutcomes.length ? courseOutcomes : allCos,
    moduleTopicIds,
    topicIndex: new Map(modules.flatMap((m) => m.topics.map((t) => [t.id, { ...t, module: m.number }]))),
    moduleByNumber: new Map(modules.map((m) => [m.number, m])),
  };
}

/** Questions that the teacher will actually be marked on. */
export function computeCountedMarks(questions) {
  const groups = new Map();
  for (const q of questions) {
    const key = q.choiceGroup?.trim();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q);
  }

  // In an either/or group the student answers one question, so the group's
  // marks are counted once. Questions outside a group always count.
  const counted = new Map();
  const countedOnce = new Set();
  for (const q of questions) {
    const key = q.choiceGroup?.trim();
    if (!key) {
      counted.set(q.id, q.marks ?? 0);
      continue;
    }
    if (countedOnce.has(key)) {
      counted.set(q.id, 0);
    } else {
      countedOnce.add(key);
      const groupMarks = Math.max(...groups.get(key).map((g) => g.marks ?? 0));
      counted.set(q.id, Number.isFinite(groupMarks) ? groupMarks : q.marks ?? 0);
    }
  }
  return { counted, groups: [...groups.entries()].map(([id, qs]) => ({ id, questionIds: qs.map((q) => q.id), marks: Math.max(...qs.map((q) => q.marks ?? 0)) })) };
}

/* ------------------------------------------------------------------ */
/* Deterministic coverage arithmetic                                    */
/* ------------------------------------------------------------------ */

export function computeCoverage({ questions, assignmentsById, reference, scope }) {
  const { counted, groups } = computeCountedMarks(questions);
  const byQuestion = new Map();

  for (const q of questions) {
    const a = assignmentsById.get(q.id) ?? {};
    const modules = (a.modules ?? []).map(Number).filter(Number.isFinite);
    const inScopeModules = modules.filter((m) => reference.inScopeNumbers.includes(m));
    const declaredInScope = a.inScope !== false;
    byQuestion.set(q.id, {
      id: q.id,
      label: q.label ?? q.id,
      part: q.part ?? '',
      marks: q.marks ?? 0,
      printedMarks: q.marks ?? 0,
      countedMarks: counted.get(q.id) ?? 0,
      modules,
      topicIds: a.topicIds ?? [],
      cos: (a.cos ?? []).map((c) => String(c).toUpperCase()),
      assessedBloom: normaliseBloom(a.assessedBloom),
      inScope: declaredInScope && (modules.length === 0 || inScopeModules.length > 0),
      confidence: a.confidence ?? 'medium',
      why: a.why ?? '',
    });
  }

  const rows = [...byQuestion.values()];
  const printedTotal = sum(rows.map((r) => r.printedMarks));
  const answerableTotal = sum(rows.map((r) => r.countedMarks));

  // Expected share per module: the pattern's own coverage rule if stated,
  // otherwise an even split between in-scope modules.
  const expectedPerModule = reference.inScopeNumbers.length
    ? 100 / reference.inScopeNumbers.length
    : null;

  const byModule = reference.modules.map((m) => {
    const mine = rows.filter((r) => r.modules.includes(m.number));
    const printed = sum(mine.map((r) => r.printedMarks));
    const answerable = sum(mine.map((r) => r.countedMarks));
    const percent = answerableTotal ? (answerable / answerableTotal) * 100 : 0;
    const coveredTopicIds = unique(mine.flatMap((r) => r.topicIds).filter(Boolean));
    const allTopicIds = m.topics.map((t) => t.id);
    const uncoveredTopicIds = allTopicIds.filter((id) => !coveredTopicIds.includes(id));
    return {
      module: m.number,
      title: m.title ?? '',
      inScope: true,
      printedMarks: printed,
      answerableMarks: answerable,
      percent: round(percent, 1),
      expectedPercent: expectedPerModule === null ? null : round(expectedPerModule, 1),
      delta: expectedPerModule === null ? null : round(percent - expectedPerModule, 1),
      questionIds: mine.map((r) => r.id),
      coveredTopicIds,
      uncoveredTopicIds,
      topicCount: allTopicIds.length,
    };
  });

  const byCo = reference.courseOutcomes.map((c) => {
    const mine = rows.filter((r) => r.cos.includes(c.id.toUpperCase()));
    const printed = sum(mine.map((r) => r.printedMarks));
    const answerable = sum(mine.map((r) => r.countedMarks));
    return {
      co: c.id,
      statement: c.statement,
      bloom: normaliseBloom(c.bloom),
      printedMarks: printed,
      answerableMarks: answerable,
      percent: answerableTotal ? round((answerable / answerableTotal) * 100, 1) : 0,
      questionIds: mine.map((r) => r.id),
    };
  });

  // COs the tagging never reached at all.
  const coveredCos = new Set(rows.flatMap((r) => r.cos));
  const uncoveredCos = reference.courseOutcomes
    .filter((c) => !coveredCos.has(c.id.toUpperCase()))
    .map((c) => ({ co: c.id, statement: c.statement, bloom: normaliseBloom(c.bloom) }));

  const uncoveredTopics = [];
  for (const m of byModule) {
    const module = reference.moduleByNumber.get(m.module);
    for (const id of m.uncoveredTopicIds) {
      const topic = module?.topics.find((t) => t.id === id);
      if (topic) uncoveredTopics.push({ module: m.module, topicId: id, topic: topic.text });
    }
  }

  const outOfScopeQuestions = rows
    .filter((r) => !r.inScope)
    .map((r) => ({
      id: r.id,
      label: r.label,
      marks: r.printedMarks,
      modules: r.modules,
      why: r.why || `Maps to module ${r.modules.join(', ') || '(unmapped)'}, which is outside the declared scope (${reference.inScopeNumbers.join(', ')}).`,
    }));

  // Questions whose topics are not in the syllabus at all: a different problem
  // from "out of scope", and worth its own flag.
  const unknownTopicQuestions = rows
    .filter((r) => r.topicIds.length && r.topicIds.every((id) => !reference.moduleTopicIds.has(id)))
    .map((r) => ({ id: r.id, label: r.label, topicIds: r.topicIds, why: 'The topics tagged for this question are not in the confirmed syllabus.' }));

  const uncountedEitherOr = groups
    .filter((g) => g.questionIds.length > 1)
    .map((g) => ({ ...g, counted: true }));

  // Marks the paper awards to questions outside the declared scope. Reported
  // explicitly, because it is the reason the in-scope module shares do not add
  // up to 100% and it is usually the most consequential finding.
  const offScopeQuestions = rows.filter((r) => !r.inScope);
  const offScope = {
    questionIds: offScopeQuestions.map((r) => r.id),
    labels: offScopeQuestions.map((r) => r.label),
    modules: unique(offScopeQuestions.flatMap((r) => r.modules)),
    printedMarks: sum(offScopeQuestions.map((r) => r.printedMarks)),
    answerableMarks: sum(offScopeQuestions.map((r) => r.countedMarks)),
    percent: answerableTotal ? round((sum(offScopeQuestions.map((r) => r.countedMarks)) / answerableTotal) * 100, 1) : 0,
  };

  const inScopeAnswerable = answerableTotal - offScope.answerableMarks;

  return {
    questions: rows,
    byModule,
    byCo,
    uncoveredTopics,
    uncoveredCos,
    outOfScopeQuestions,
    unknownTopicQuestions,
    eitherOrGroups: uncountedEitherOr,
    offScope,
    totals: {
      printedMarks: printedTotal,
      answerableMarks: answerableTotal,
      inScopeAnswerableMarks: inScopeAnswerable,
      offScopeAnswerableMarks: offScope.answerableMarks,
      examMaxMarks: scope?.totalMarks ?? null,
      inScopeModules: reference.inScopeNumbers,
      questionCount: rows.length,
      countsMismatch:
        scope?.totalMarks != null && answerableTotal > 0 && Math.abs(answerableTotal - scope.totalMarks) > 1,
    },
  };
}

/** Compare each question's assessed Bloom level with its mapped CO's level. */
export function computeBloomCheck(coverage, reference) {
  const coByiId = new Map(reference.courseOutcomes.map((c) => [c.id.toUpperCase(), c]));
  const rows = [];
  for (const q of coverage.questions) {
    const assessed = q.assessedBloom;
    if (!assessed || !q.cos.length) {
      rows.push({ questionId: q.id, label: q.label, assessed: assessed ?? null, co: q.cos[0] ?? null, coBloom: null, status: 'unknown' });
      continue;
    }
    const co = coByiId.get(q.cos[0]);
    const coBloom = normaliseBloom(co?.bloom);
    const a = Number(/K?L?([1-6])/i.exec(assessed)?.[1]);
    const b = Number(/K?L?([1-6])/i.exec(coBloom ?? '')?.[1]);
    const status = !coBloom || !a || !b ? 'unknown' : a === b ? 'match' : a > b ? 'above' : 'below';
    rows.push({
      questionId: q.id,
      label: q.label,
      assessed,
      co: q.cos[0],
      coBloom: coBloom ?? null,
      status,
      delta: a && b ? a - b : null,
    });
  }
  const mismatches = rows.filter((r) => r.status === 'above' || r.status === 'below');
  return { rows, mismatches, unknown: rows.filter((r) => r.status === 'unknown') };
}

/** Modules whose answerable share is well above (or below) the expected share. */
export function computeHotspots(coverage, thresholdPp = HOTSPOT_THRESHOLD_PP) {
  return coverage.byModule
    .filter((m) => m.expectedPercent != null && Math.abs(m.delta ?? 0) >= thresholdPp)
    .map((m) => ({
      module: m.module,
      title: m.title,
      observedPercent: m.percent,
      expectedPercent: m.expectedPercent,
      delta: m.delta,
      direction: (m.delta ?? 0) > 0 ? 'over' : 'under',
      questionIds: m.questionIds,
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/* ------------------------------------------------------------------ */
/* LLM passes                                                           */
/* ------------------------------------------------------------------ */

async function tagCoverage({ settings, questions, scope, reference, onProgress, signal, stats }) {
  const batches = chunk(questions, COVERAGE_BATCH);
  const assignments = [];
  const notes = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    step(
      onProgress,
      `Mapping questions to the syllabus (${i + 1}/${batches.length})`,
      `Questions ${batch[0].id} to ${batch[batch.length - 1].id}`
    );
    const prompt = buildCoveragePrompt({
      questions: batch,
      scope,
      modules: reference.modules,
      courseOutcomes: reference.courseOutcomes,
    });
    const result = await callJson({ settings, prompt, signal, onProgress: (p) => step(onProgress, 'Mapping questions to the syllabus', p.message) });
    stats.llmCalls += 1;
    stats.attempts += result.attempts;
    if (result.repaired) stats.repairs += 1;
    assignments.push(...(result.value.assignments ?? []));
    notes.push(...(result.value.notes ?? []));
  }

  // Guard against the model dropping or renaming ids.
  const returned = new Map(assignments.map((a) => [a.questionId, a]));
  const missing = questions.filter((q) => !returned.has(q.id)).map((q) => q.id);
  return { assignmentsById: returned, missing, notes };
}

async function lintQuestions({ settings, questions, scope, reference, coverageByQuestion, onProgress, signal, stats }) {
  const batches = chunk(questions, LINT_BATCH);
  const flags = [];
  const duplicates = [];
  const notes = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    step(onProgress, `Checking wording and fairness (${i + 1}/${batches.length})`, `${batch.length} question(s)`);
    const prompt = buildLintPrompt({
      questions: batch,
      scope,
      modules: reference.modules,
      courseOutcomes: reference.courseOutcomes,
      coverageByQuestion,
    });
    const result = await callJson({ settings, prompt, signal, onProgress: (p) => step(onProgress, 'Checking wording and fairness', p.message) });
    stats.llmCalls += 1;
    stats.attempts += result.attempts;
    if (result.repaired) stats.repairs += 1;
    flags.push(...(result.value.flags ?? []));
    duplicates.push(...(result.value.duplicates ?? []));
    notes.push(...(result.value.notes ?? []));
  }
  return { flags, duplicates, notes };
}

async function suggestAlternatives({ settings, targets, scope, reference, bloomChoice, classNote, onProgress, signal, stats }) {
  if (!targets.length) return { suggestions: [] };
  const limited = targets.slice(0, MAX_SUGGESTION_TARGETS);
  step(onProgress, 'Writing alternative questions', `${limited.length} replacement(s) requested`);
  const prompt = buildSuggestionPrompt({
    targets: limited,
    scope,
    modules: reference.modules,
    courseOutcomes: reference.courseOutcomes,
    bloomChoice,
    classNote,
  });
  const result = await callJson({ settings, prompt, signal, onProgress: (p) => step(onProgress, 'Writing alternative questions', p.message) });
  stats.llmCalls += 1;
  stats.attempts += result.attempts;
  if (result.repaired) stats.repairs += 1;
  return { suggestions: result.value.suggestions ?? [], truncated: targets.length > limited.length };
}

async function summarise({ settings, scope, coverage, flags, duplicates, suggestionCount, onProgress, signal, stats }) {
  step(onProgress, 'Writing the summary', '');
  const prompt = buildAnalysisSummaryPrompt({ scope, coverage, flags, duplicates, suggestionCount });
  const result = await callJson({ settings, prompt, signal, onProgress: (p) => step(onProgress, 'Writing the summary', p.message) });
  stats.llmCalls += 1;
  stats.attempts += result.attempts;
  if (result.repaired) stats.repairs += 1;
  return result.value;
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                        */
/* ------------------------------------------------------------------ */

/**
 * @returns {Promise<object>} the full Mode A report
 */
export async function runAnalysis({
  settings,
  paperText,
  scope,
  syllabus,
  segmentation,
  bloomChoice = '',
  onProgress,
  signal,
}) {
  const warnings = [];
  const stats = { llmCalls: 0, attempts: 0, repairs: 0 };
  const questions = segmentation.questions ?? [];

  if (!questions.length) throw new Error('There are no segmented questions to analyse.');
  if (!(syllabus?.modules ?? []).length) throw new Error('The confirmed syllabus has no modules, so there is nothing to map against.');

  step(onProgress, 'Preparing the reference syllabus', `${(scope.modulesInScope ?? []).length || 'all'} module(s) in scope`);
  const reference = buildReference({ syllabus, scope });
  if (!reference.modules.length) {
    throw new Error('None of the confirmed syllabus modules are in the declared scope. Widen the scope and retry.');
  }

  const { assignmentsById, missing, notes: coverageNotes } = await tagCoverage({
    settings, questions, scope, reference, onProgress, signal, stats,
  });
  if (missing.length) {
    warnings.push(`The model did not return a mapping for ${missing.length} question(s): ${missing.join(', ')}. They are shown as unmapped.`);
  }

  const coverage = computeCoverage({ questions, assignmentsById, reference, scope });
  const bloomCheck = computeBloomCheck(coverage, reference);
  const hotspots = computeHotspots(coverage);

  const coverageByQuestion = Object.fromEntries(
    coverage.questions.map((q) => [q.id, { modules: q.modules, topicIds: q.topicIds, cos: q.cos, assessedBloom: q.assessedBloom, inScope: q.inScope }])
  );

  const { flags, duplicates, notes: lintNotes } = await lintQuestions({
    settings, questions, scope, reference, coverageByQuestion, onProgress, signal, stats,
  });

  // Deterministic flags the model should not be trusted to remember.
  const derivedFlags = [];
  for (const q of coverage.outOfScopeQuestions) {
    derivedFlags.push({
      id: `derived-oos-${q.id}`,
      questionId: q.id,
      type: 'out-of-scope',
      severity: 'high',
      reason: q.why,
      evidence: '',
      rewrite: '',
      derived: true,
    });
  }
  for (const t of coverage.uncoveredTopics) {
    derivedFlags.push({
      id: `derived-unc-${t.topicId}`,
      questionId: '',
      topicId: t.topicId,
      type: 'uncovered-topic',
      severity: 'medium',
      reason: `In-scope topic "${t.topic}" (Module ${t.module}) carries no marks on this paper.`,
      evidence: '',
      rewrite: '',
      derived: true,
    });
  }
  for (const h of hotspots) {
    derivedFlags.push({
      id: `derived-hot-${h.module}`,
      questionId: '',
      module: h.module,
      type: 'over-weighted-topic',
      severity: Math.abs(h.delta) >= 15 ? 'high' : 'medium',
      reason: `Module ${h.module} carries ${h.observedPercent}% of the answerable marks against an expected ${h.expectedPercent}%.`,
      evidence: '',
      rewrite: '',
      derived: true,
    });
  }
  for (const b of bloomCheck.mismatches) {
    derivedFlags.push({
      id: `derived-bloom-${b.questionId}`,
      questionId: b.questionId,
      type: 'bloom-mismatch',
      severity: 'low',
      reason: `Assessed at ${b.assessed} but its ${b.co} outcome is at ${b.coBloom}.`,
      evidence: '',
      rewrite: '',
      derived: true,
    });
  }

  // Suggestion targets: worst flags that name a question, plus uncovered topics.
  const severityRank = { high: 0, medium: 1, low: 2 };
  const targets = [];
  const seenTargets = new Set();
  for (const f of flags
    .filter((f) => f.questionId && ['vague-wording', 'multiple-interpretations', 'missing-data', 'missing-constraint', 'double-barreled', 'marks-effort-mismatch', 'out-of-scope'].includes(f.type))
    .sort((a, b) => (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3))) {
    if (seenTargets.has(f.questionId)) continue;
    seenTargets.add(f.questionId);
    const q = questions.find((x) => x.id === f.questionId);
    targets.push({
      kind: 'replace-flagged',
      forQuestionId: f.questionId,
      module: coverageByQuestion[f.questionId]?.modules?.[0] ?? null,
      co: coverageByQuestion[f.questionId]?.cos?.[0] ?? null,
      marks: q?.marks ?? scope.totalMarks ?? 3,
      problem: f.reason,
    });
  }
  for (const t of coverage.uncoveredTopics) {
    if (seenTargets.has(`topic:${t.topicId}`)) continue;
    seenTargets.add(`topic:${t.topicId}`);
    targets.push({
      kind: 'cover-topic',
      coversTopicId: t.topicId,
      module: t.module,
      co: null,
      marks: 3,
      problem: `Topic "${t.topic}" is in scope but has no marks.`,
    });
  }
  // Missing-data / constraint flags often need a bigger rewrite; keep the list short.
  const { suggestions, truncated } = await suggestAlternatives({
    settings, targets, scope, reference, bloomChoice, classNote: scope.classNote, onProgress, signal, stats,
  });
  if (truncated) {
    warnings.push(`Only the first ${MAX_SUGGESTION_TARGETS} replacement targets were sent to the model. Re-run after accepting some to get more.`);
  }

  const summary = await summarise({
    settings, scope, coverage, flags: [...flags, ...derivedFlags], duplicates,
    suggestionCount: suggestions.length, onProgress, signal, stats,
  });

  for (const note of [...coverageNotes, ...lintNotes]) {
    if (note && !warnings.includes(note)) warnings.push(note);
  }

  return {
    mode: 'analysis',
    generatedAt: Date.now(),
    promptVersion: PROMPT_VERSION,
    model: settings.model,
    scope,
    syllabusMeta: {
      courseCode: syllabus.courseCode,
      courseTitle: syllabus.courseTitle,
      sourceUrl: syllabus.sourceUrl ?? null,
      sourceKind: syllabus.sourceKind ?? null,
      moduleCount: reference.modules.length,
      coCount: reference.courseOutcomes.length,
    },
    coverage,
    bloomCheck,
    hotspots,
    flags: [...flags, ...derivedFlags],
    duplicates,
    suggestions,
    summary,
    stats,
    warnings,
  };
}

/** Apply an accepted rewrite to the working paper (used by the UI). */
export function applyRewrite(segmentation, questionId, newText, { marks, bloom } = {}) {
  const next = structuredClone(segmentation);
  const q = next.questions.find((x) => x.id === questionId);
  if (!q) return { segmentation: next, changed: false };
  q.originalText = q.originalText ?? q.text;
  q.text = newText;
  q.rewritten = true;
  if (Number.isFinite(marks)) q.marks = marks;
  if (bloom) q.assessedBloomOverride = bloom;
  return { segmentation: next, changed: true, question: q };
}

/** Insert an accepted alternative question as a replacement (keeps the id). */
export function applySuggestion(segmentation, suggestion) {
  if (suggestion.forQuestionId) {
    return applyRewrite(segmentation, suggestion.forQuestionId, suggestion.text, {
      marks: suggestion.marks,
      bloom: suggestion.bloom,
    });
  }
  return { segmentation, changed: false };
}
