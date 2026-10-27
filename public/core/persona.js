/**
 * Mode B: Student Persona Prediction.
 *
 * Personas do NOT attempt the paper. For each question we predict how that
 * student type's exam would go: a score band, the most likely pitfall, the
 * exact trigger in the wording, and time spent.
 *
 * As in Mode A, the arithmetic (marks, times, separation, feasibility) is
 * computed here so it is reproducible; the LLM supplies the per-question
 * judgements and the qualitative synthesis.
 *
 * Every number produced is labelled a risk flag / relative estimate, not a
 * measured result.
 */
import { callJson } from './llm.js';
import { chunk, round, sum } from './util.js';
import { PERSONAS, PERSONA_IDS, personaById } from './personas.js';
import { buildReference } from './analysis.js';
import { buildPersonaQuestionPrompt, buildPersonaPaperPrompt, PROMPT_VERSION } from '../prompts/prompts.js';

/** Questions per LLM call. Each question returns three persona verdicts. */
export const PERSONA_BATCH = 6;

const step = (onProgress, label, detail) => onProgress?.({ label, detail });

const mid = (low, high) => {
  const lo = Number.isFinite(low) ? low : 0;
  const hi = Number.isFinite(high) ? high : lo;
  return (lo + hi) / 2;
};

/* ------------------------------------------------------------------ */
/* Per-question passes                                                  */
/* ------------------------------------------------------------------ */

async function predictQuestions({ settings, questions, scope, reference, onProgress, signal, stats }) {
  const batches = chunk(questions, PERSONA_BATCH);
  const byQuestion = new Map();
  const notes = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    step(
      onProgress,
      `Predicting per-question outcomes (${i + 1}/${batches.length})`,
      `Questions ${batch[0].id} to ${batch[batch.length - 1].id}`
    );
    const prompt = buildPersonaQuestionPrompt({
      questions: batch,
      scope,
      modules: reference.modules,
      courseOutcomes: reference.courseOutcomes,
      classNote: scope.classNote,
    });
    const result = await callJson({
      settings,
      prompt,
      signal,
      onProgress: (p) => step(onProgress, 'Predicting per-question outcomes', p.message),
    });
    stats.llmCalls += 1;
    stats.attempts += result.attempts;
    if (result.repaired) stats.repairs += 1;
    for (const prediction of result.value.predictions ?? []) {
      byQuestion.set(prediction.questionId, prediction);
    }
    notes.push(...(result.value.notes ?? []));
  }
  return { byQuestion, notes };
}

/* ------------------------------------------------------------------ */
/* Deterministic aggregation                                            */
/* ------------------------------------------------------------------ */

/**
 * Score and time arithmetic.
 *
 * For either/or pairs we average the two options and count the group's marks
 * once, because the student answers exactly one of them and which one they pick
 * depends on how the paper sits on the day.
 */
export function aggregatePersonas({ questions, predictions, scope, durationMinutes }) {
  const groups = new Map();
  for (const q of questions) {
    const key = q.choiceGroup?.trim();
    if (key) groups.set(key, [...(groups.get(key) ?? []), q]);
  }

  const perQuestion = [];
  const totals = Object.fromEntries(PERSONA_IDS.map((id) => [id, { marks: 0, time: 0, attempted: 0, questions: 0 }]));

  const seenGroups = new Set();
  for (const q of questions) {
    const prediction = predictions.get(q.id);
    const groupKey = q.choiceGroup?.trim();
    const groupSize = groupKey ? groups.get(groupKey).length : 1;
    const share = groupSize > 1 ? 1 / groupSize : 1; // this question's share of the group
    const marks = q.marks ?? 0;

    const personaEntries = {};
    for (const personaId of PERSONA_IDS) {
      const raw = (prediction?.personas ?? []).find((p) => p.persona === personaId);
      const low = Number.isFinite(raw?.bandLowPercent) ? Math.max(0, Math.min(100, raw.bandLowPercent)) : null;
      const high = Number.isFinite(raw?.bandHighPercent) ? Math.max(0, Math.min(100, raw.bandHighPercent)) : null;
      const bandLow = low === null || high === null ? null : Math.min(low, high);
      const bandHigh = low === null || high === null ? null : Math.max(low, high);
      const entry = {
        persona: personaId,
        bandLowPercent: bandLow,
        bandHighPercent: bandHigh,
        likelyScorePercent: Number.isFinite(raw?.likelyScorePercent) ? raw.likelyScorePercent : bandLow === null ? null : mid(bandLow, bandHigh),
        expectedMarks: bandLow === null ? null : (mid(bandLow, bandHigh) / 100) * marks,
        pitfall: raw?.pitfall ?? null,
        trigger: raw?.trigger ?? null,
        triggerQuote: raw?.triggerQuote ?? '',
        timeMinutes: Number.isFinite(raw?.timeMinutes) ? raw.timeMinutes : null,
        confidence: raw?.confidence ?? 'low',
        attemptsIt: raw?.attemptsIt !== false,
        missing: !raw,
      };
      personaEntries[personaId] = entry;

      const t = totals[personaId];
      t.questions += 1;
      if (entry.expectedMarks !== null) t.marks += entry.expectedMarks * share;
      if (entry.timeMinutes !== null) t.time += entry.timeMinutes * share;
      if (entry.attemptsIt) t.attempted += share;
    }

    // Separation: how far apart the weak and strong midpoints sit.
    const weak = personaEntries.weak;
    const strong = personaEntries.strong;
    const average = personaEntries.average;
    const separationPoints =
      weak.bandLowPercent !== null && strong.bandLowPercent !== null
        ? mid(strong.bandLowPercent, strong.bandHighPercent) - mid(weak.bandLowPercent, weak.bandHighPercent)
        : null;
    const band = separationPoints === null ? 'unknown' : separationPoints >= 35 ? 'high' : separationPoints >= 18 ? 'medium' : 'low';
    let discriminationNote = '';
    if (band === 'low' && strong.bandHighPercent !== null && mid(strong.bandLowPercent, strong.bandHighPercent) < 55) {
      discriminationNote = 'Hard for all three: it does not separate them.';
    } else if (band === 'low' && weak.bandLowPercent !== null && mid(weak.bandLowPercent, weak.bandHighPercent) >= 65) {
      discriminationNote = 'Easy for all three: it does not separate them.';
    }

    perQuestion.push({
      questionId: q.id,
      label: q.label ?? q.id,
      part: q.part ?? '',
      module: q.moduleLabel ?? null,
      marks,
      choiceGroup: groupKey ?? null,
      shareOfGroup: round(share, 3),
      personas: personaEntries,
      separation: { points: separationPoints === null ? null : round(separationPoints, 1), band, note: discriminationNote },
      averageMidpoint: average.bandLowPercent === null ? null : round(mid(average.bandLowPercent, average.bandHighPercent), 1),
      // Retained so the UI can explain where the number came from.
      source: prediction ? 'model' : 'missing',
      warnings: prediction ? [] : ['The model returned no prediction for this question.'],
    });
    if (groupKey) seenGroups.add(groupKey);
  }

  const examMax = Number.isFinite(scope?.totalMarks) && scope.totalMarks > 0 ? scope.totalMarks : sum(questions.map((q) => q.marks ?? 0));

  const byPersona = PERSONA_IDS.map((id) => {
    const t = totals[id];
    const definition = personaById(id);
    return {
      persona: id,
      name: definition.name,
      expectedMarks: round(t.marks, 1),
      expectedPercent: examMax ? round((t.marks / examMax) * 100, 1) : null,
      definitionBand: definition.expectedPercent,
      timeMinutes: round(t.time, 0),
      attemptedQuestions: round(t.attempted, 1),
      questionCount: questions.length,
    };
  });

  const duration = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : null;
  const verdictFor = (minutes) => {
    if (!duration || !Number.isFinite(minutes) || minutes <= 0) return 'unknown';
    if (minutes > duration) return 'infeasible';
    if (minutes > duration * 0.9) return 'tight';
    return 'comfortable';
  };
  const perPersonaVerdict = Object.fromEntries(byPersona.map((p) => [p.persona, verdictFor(p.timeMinutes)]));
  const order = { infeasible: 3, tight: 2, comfortable: 1, unknown: 0 };
  const worst = Object.values(perPersonaVerdict).sort((a, b) => order[b] - order[a])[0] ?? 'unknown';

  const separators = perQuestion
    .filter((q) => q.separation.band === 'high')
    .map((q) => ({ questionId: q.questionId, label: q.label, points: q.separation.points, why: `Weak and strong land ${q.separation.points} points apart.` }));
  const nonSeparators = perQuestion
    .filter((q) => q.separation.band === 'low')
    .map((q) => ({ questionId: q.questionId, label: q.label, points: q.separation.points, why: q.separation.note || 'All three personas land in a similar place.' }));

  return {
    perQuestion,
    byPersona,
    examMax,
    timeFeasibility: {
      durationMinutes: duration,
      perPersona: byPersona.map((p) => ({ persona: p.persona, minutes: p.timeMinutes, verdict: perPersonaVerdict[p.persona] })),
      verdict: worst,
      margin: duration ? round(duration - Math.max(...byPersona.map((p) => p.timeMinutes ?? 0)), 0) : null,
      basis: 'Sum of per-question time estimates. Either/or pairs are shared between their two options, since a student answers only one.',
    },
    separation: {
      separators,
      nonSeparators,
      highCount: separators.length,
      lowCount: nonSeparators.length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                        */
/* ------------------------------------------------------------------ */

export async function runPersonaPrediction({
  settings,
  scope,
  syllabus,
  segmentation,
  onProgress,
  signal,
}) {
  const warnings = [];
  const stats = { llmCalls: 0, attempts: 0, repairs: 0 };
  const questions = segmentation?.questions ?? [];

  if (!questions.length) throw new Error('There are no segmented questions to predict against.');
  if (!(syllabus?.modules ?? []).length) throw new Error('The confirmed syllabus has no modules to reason about.');

  step(onProgress, 'Preparing the reference syllabus', `${(scope.modulesInScope ?? []).length || 'all'} module(s) in scope`);
  const reference = buildReference({ syllabus, scope });
  if (!reference.modules.length) {
    throw new Error('None of the confirmed syllabus modules are in the declared scope. Widen the scope and retry.');
  }

  const { byQuestion, notes } = await predictQuestions({
    settings, questions, scope, reference, onProgress, signal, stats,
  });

  const aggregate = aggregatePersonas({
    questions,
    predictions: byQuestion,
    scope,
    durationMinutes: scope.durationMinutes,
  });

  const missingCount = aggregate.perQuestion.filter((q) => q.source === 'missing').length;
  if (missingCount) {
    warnings.push(
      `${missingCount} question(s) came back without a prediction. They are shown as "no prediction" rather than guessed. Re-run to try again.`
    );
  }

  step(onProgress, 'Building the whole-paper picture', '');
  const paperPrompt = buildPersonaPaperPrompt({
    scope,
    questionPredictions: aggregate.perQuestion.map((q) => ({
      questionId: q.questionId,
      label: q.label,
      marks: q.marks,
      personas: Object.fromEntries(
        PERSONA_IDS.map((id) => [
          id,
          {
            bandPercent: [q.personas[id].bandLowPercent, q.personas[id].bandHighPercent],
            timeMinutes: q.personas[id].timeMinutes,
            pitfall: q.personas[id].pitfall,
          },
        ])
      ),
    })),
    questionMeta: questions.map((q) => ({
      id: q.id,
      label: q.label,
      part: q.part,
      marks: q.marks,
      moduleLabel: q.moduleLabel ?? null,
      choiceGroup: q.choiceGroup ?? null,
    })),
    classNote: scope.classNote,
  });
  const paperResult = await callJson({
    settings,
    prompt: paperPrompt,
    signal,
    onProgress: (p) => step(onProgress, 'Building the whole-paper picture', p.message),
  });
  stats.llmCalls += 1;
  stats.attempts += paperResult.attempts;
  if (paperResult.repaired) stats.repairs += 1;
  const paper = paperResult.value;

  // The deterministic feasibility verdict wins over the model's; disagreement is
  // surfaced rather than hidden.
  const modelVerdict = paper?.timeFeasibility?.verdict;
  if (modelVerdict && modelVerdict !== 'unknown' && aggregate.timeFeasibility.verdict !== 'unknown' && modelVerdict !== aggregate.timeFeasibility.verdict) {
    warnings.push(
      `The model called the timing "${modelVerdict}" while the summed per-question times give "${aggregate.timeFeasibility.verdict}". The summed figures are shown; treat the timing as borderline.`
    );
  }

  const rewritePriority = (paper?.rewritePriority ?? [])
    .map((r) => ({
      ...r,
      label: aggregate.perQuestion.find((q) => q.questionId === r.questionId)?.label ?? r.questionId,
    }))
    .filter((r) => r.questionId);

  return {
    mode: 'persona',
    generatedAt: Date.now(),
    promptVersion: PROMPT_VERSION,
    model: settings.model,
    scope,
    syllabusMeta: {
      courseCode: syllabus.courseCode,
      courseTitle: syllabus.courseTitle,
      sourceUrl: syllabus.sourceUrl ?? null,
      sourceKind: syllabus.sourceKind ?? null,
    },
    personas: PERSONAS,
    classNote: scope.classNote || '',
    perQuestion: aggregate.perQuestion,
    byPersona: aggregate.byPersona,
    examMax: aggregate.examMax,
    timeFeasibility: { ...aggregate.timeFeasibility, modelVerdict: modelVerdict ?? null, note: paper?.timeFeasibility?.note ?? '' },
    separation: aggregate.separation,
    overallSpread: paper?.overallSpread ?? [],
    rewritePriority,
    summary: paper?.summary ?? '',
    modelSeparators: paper?.separators ?? [],
    stats,
    warnings: [...warnings, ...notes],
  };
}
