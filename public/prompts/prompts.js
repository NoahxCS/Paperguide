/**
 * Every LLM prompt lives here, versioned. Prompts assume plain chat
 * completions only: no tool calling and no native JSON mode, so each builder
 * returns a system + user message and the exact schema the reply must satisfy.
 *
 * Temperatures: low (0.1-0.2) for tagging and linting, where consistency
 * matters; moderate (0.4-0.5) for rewriting and persona prediction, where some
 * variety is useful.
 */
import {
  scopeSchema,
  segmentationSchema,
  syllabusSchema,
  coverageBatchSchema,
  lintSchema,
  suggestionSchema,
  personaQuestionSchema,
  personaPaperSchema,
  analysisSummarySchema,
  BLOOM,
} from './schemas.js';
import { personaBriefForPrompt, PERSONA_CAVEAT } from '../core/personas.js';

export const PROMPT_VERSION = '1.2.0';

/**
 * KTU 2024-scheme ESE patterns, derived from real 2024-scheme syllabus
 * documents and end-semester papers rather than from memory.
 *
 * There is no standalone official "Question Paper Pattern" document: the
 * pattern is printed inside each course syllabus, and it varies by course
 * category. So these are offered as *suggested* defaults only. A pattern parsed
 * from the confirmed syllabus always wins, and the teacher can override both.
 */
export const KTU_2024_DEFAULT_PATTERN = {
  source: 'ktu-2024-default',
  note:
    'Default for KTU 2024-scheme theory courses (from the ESE block of real syllabi and real papers: ' +
    'UCEST105, GAMAT101, PCCST302/303, PCECT302). Max. Marks 60, Duration 2 hours 30 minutes.',
  parts: [
    {
      name: 'Part A',
      instructions: 'Answer all questions. Each question carries 3 marks.',
      questionCount: 8,
      marksPerQuestion: 3,
      totalMarks: 24,
      choice: 'none',
      coversModules: [1, 2, 3, 4],
      questionsPerModule: 2,
    },
    {
      name: 'Part B',
      instructions: 'Answer any one full question from each module, each question carries 9 marks.',
      questionCount: 8,
      marksPerQuestion: 9,
      totalMarks: 36,
      choice: 'either-or',
      coversModules: [1, 2, 3, 4],
      questionsPerModule: 2,
    },
  ],
};

/**
 * HMC (Humanities / Management / Commerce) courses use a different ESE.
 * Confirmed on UCHUT346 Economics for Engineers: 50 marks, Part A 6 x 3,
 * Part B 4 x 8 with at most two subdivisions.
 */
export const KTU_2024_HMC_PATTERN = {
  source: 'ktu-2024-hmc-default',
  note:
    'Default for KTU 2024-scheme HMC courses (from the ESE block of UCHUT346 Economics for Engineers). ' +
    'Max. Marks 50, Duration 2 hours 30 minutes.',
  parts: [
    {
      name: 'Part A',
      instructions: 'Answer all questions. Each question carries 3 marks.',
      questionCount: 6,
      marksPerQuestion: 3,
      totalMarks: 18,
      choice: 'none',
      coversModules: [1, 2, 3, 4],
    },
    {
      name: 'Part B',
      instructions: 'Answer any one question from each module, each question carries 8 marks.',
      questionCount: 8,
      marksPerQuestion: 8,
      totalMarks: 32,
      choice: 'either-or',
      coversModules: [1, 2, 3, 4],
      questionsPerModule: 2,
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Schema -> compact spec, so the model is told the shape exactly       */
/* ------------------------------------------------------------------ */

function spec(node, indent = 0) {
  const pad = '  '.repeat(indent);
  if (!node || typeof node !== 'object') return 'any';

  if (Array.isArray(node.enum)) {
    return node.enum.map((e) => JSON.stringify(e)).join(' | ');
  }
  if (Array.isArray(node.anyOf)) {
    return node.anyOf.map((n) => spec(n, indent)).join(' | ');
  }

  const type = Array.isArray(node.type) ? node.type[0] : node.type;

  if (type === 'object') {
    const props = node.properties ?? {};
    const required = new Set(node.required ?? []);
    const lines = Object.entries(props).map(([key, sub]) => {
      const mark = required.has(key) ? '' : '?';
      return `${pad}  ${key}${mark}: ${spec(sub, indent + 1)}`;
    });
    return `{\n${lines.join(',\n')}\n${pad}}`;
  }
  if (type === 'array') {
    return `[ ${spec(node.items, indent)} ]`;
  }
  if (type === 'integer' || type === 'number') {
    return type + (typeof node.minimum === 'number' ? ` >= ${node.minimum}` : '');
  }
  if (type === 'boolean') return 'boolean';
  return type ?? 'any';
}

export function schemaToSpec(schema) {
  return spec(schema);
}

const BLOOM_TABLE = BLOOM.map((b) => `${b.level} ${b.name} (${b.verbs})`).join('; ');

const JSON_CONTRACT = (schema, extra = '') =>
  [
    'Reply with a single JSON object and nothing else.',
    'No markdown, no code fences, no commentary before or after.',
    'If a value is genuinely not present in the source, use an empty string, 0, or an empty array - never guess silently.',
    extra,
    '',
    'Required JSON shape:',
    schemaToSpec(schema),
  ]
    .filter(Boolean)
    .join('\n');

const SYSTEM_BASE = (role) =>
  [
    `You are Paperguide, an exam-paper quality analyst for teachers at colleges affiliated to APJ Abdul Kalam Technological University (KTU), Kerala.`,
    `You work on the KTU ${'2024'} scheme. Everything you produce is for internal quality review by the course teacher, in English.`,
    `You are precise and conservative: when the paper text is ambiguous or incomplete, say so in the designated field instead of inventing detail.`,
    `Never invent question text, course outcomes, module names, marks or figures that are not in the material you are given.`,
    role ? `\nYour role in this step: ${role}` : '',
  ]
    .filter(Boolean)
    .join('\n');

const BLOOM_NOTE = `Bloom's revised taxonomy levels used by KTU (use these exact codes): ${BLOOM_TABLE}.`;

/* ------------------------------------------------------------------ */
/* 1. Scope from the teacher's chat message                             */
/* ------------------------------------------------------------------ */

export function buildScopePrompt({ message, paperText = '', syllabusHint = null, priorScope = null }) {
  const user = [
    'A teacher has described the exam they are setting. Turn their message into a structured scope.',
    '',
    '### Teacher message',
    message?.trim() || '(no message yet)',
    '',
    paperText
      ? `### Text of the question paper they uploaded (use only to fill course code/title, total marks and duration)\n"""\n${paperText.slice(0, 6000)}\n"""`
      : '',
    syllabusHint ? `### Known course info\n${JSON.stringify(syllabusHint)}` : '',
    priorScope ? `### Previously agreed scope (keep anything the teacher did not change)\n${JSON.stringify(priorScope)}` : '',
    '',
    '### Rules',
    '- `modulesInScope`: the module numbers the teacher says are examinable. If they say "all modules" or name none, use [] and add "module scope not stated" to `unresolved`.',
    '- `paperStructure.source`: "teacher" if they described the structure, "syllabus" if it came from their syllabus info, otherwise "inferred".',
    '- `durationMinutes`: minutes, not hours (2 hours 30 minutes = 150).',
    '- Put anything the teacher did not state into `unresolved` as a short phrase. Do not fill it in yourself.',
    '- `classNote`: only the teacher\'s own words about the class, or "".',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    task: 'scope',
    temperature: 0.1,
    schema: scopeSchema,
    system: SYSTEM_BASE('parse the teacher\'s exam description into a scope record.'),
    user,
    contract: JSON_CONTRACT(scopeSchema),
  };
}

/* ------------------------------------------------------------------ */
/* 2. Paper segmentation                                                */
/* ------------------------------------------------------------------ */

export function buildSegmentationPrompt({ paperText, scope }) {
  const pattern = scope?.paperStructure?.parts?.length
    ? JSON.stringify(scope.paperStructure)
    : JSON.stringify(KTU_2024_DEFAULT_PATTERN);

  const user = [
    'Segment this question paper into individual questions. This segmentation is the basis for every later analysis, so accuracy matters more than completeness.',
    '',
    '### Expected paper structure',
    pattern,
    '',
    '### Paper text (transcribed or OCRed; may contain recognition noise)',
    '"""',
    paperText,
    '"""',
    '',
    '### Rules',
    '- One entry per answerable question. Part A questions are single questions; Part B questions with a)/b)/c) stay ONE entry with `subParts` filled in.',
    '- `id`: short stable id, e.g. "A1".."A8" for Part A and "B9".."B16" for Part B, matching the printed question number where possible.',
    '- `label`: the printed number as it appears ("1", "9", "12 a)").',
    '- `marks`: the marks for the whole question. Sum the sub-part marks when the total is not printed.',
    '- `marksSource`: "printed" if the paper shows the marks, "inferred" if you worked them out, "part-default" if you used the part\'s standard marks.',
    '- `choiceGroup`: give the same value to two questions that are alternatives of each other (e.g. both questions in one module\'s either/or pair). Otherwise "".',
    '- `moduleLabel`: only if the paper prints it ("Module 1", "Module -2", "Module I").',
    '- `printedCo`: the CO tag printed against the question ("CO1", "CO-3"), else "".',
    '- `hasFigure`: true if the question depends on a figure, graph, table image or diagram that is not fully described in the text.',
    '- Preserve the question wording exactly. Fix obvious OCR spacing, do not paraphrase or shorten.',
    '- If two questions run together in the text, split them. If the text is truncated, say so in `warnings`.',
  ].join('\n');

  return {
    task: 'segmentation',
    temperature: 0.1,
    schema: segmentationSchema,
    system: SYSTEM_BASE('split a question paper into its individual questions, with marks and choices.'),
    user,
    contract: JSON_CONTRACT(segmentationSchema),
  };
}

/* ------------------------------------------------------------------ */
/* 3. Syllabus parsing                                                  */
/* ------------------------------------------------------------------ */

export function buildSyllabusPrompt({ text, courseHint, sourceUrl, sourceKind }) {
  const user = [
    'Extract the structured syllabus of ONE course from the text below.',
    '',
    `Course the teacher asked for: ${courseHint || '(not specified)'}`,
    sourceUrl ? `Source: ${sourceUrl}` : '',
    sourceKind ? `Source kind: ${sourceKind}` : '',
    '',
    '### Syllabus text',
    '"""',
    text.slice(0, 42000),
    '"""',
    '',
    '### Rules',
    '- Only extract what the text actually contains. Anything you cannot find goes into `notFound` as a short phrase (e.g. "CO table", "paper pattern", "module hours").',
    '- `courseCode`: KTU 2024-scheme codes are eight characters with no year prefix, e.g. GAMAT101, UCEST105, PCCST303, UCHUT346. `XX` is a wildcard and a trailing `N` is an elective placeholder (PCXXT205, PEXXT41N). Copy the code exactly as printed.',
    '- `credits`: KTU prints "Teaching Hours/Week (L: T: P: R)" and a *separate* single "Credits" value. Put the four teaching hours in l/t/p/r and the printed credit number in `credits`. Do not treat the credit value as `p`.',
    '- `modules`: every module with its number and title, and its topics as individual entries. KTU prints each module as one dense paragraph separated by semicolons and capitalised lead-ins; split it at those separators but do not rewrite the wording. Keep the syllabus\'s own sub-numbering in `topics[].id` when printed (e.g. "1.2").',
    '- `courseOutcomes`: one entry per CO. The CO table has two columns, "Course Outcome" and "Bloom\'s Knowledge Level (KL)", with CO1/CO2 embedded at the start of the first column - split them out into `id` and `statement`, and strip the "CO1:" prefix from the statement.',
    '- `bloom` must be a KTU Bloom level (K1-K6). The source may print it as KL1-KL6, K1-K6, or the level name; normalise to K1-K6. If no Bloom column is printed at all, infer the level from the outcome verb and add "CO Bloom\'s levels inferred" to `notFound`.',
    '- Do not invent course "levels": the 2024 scheme uses only Level 3 and Level 5, and only for programme electives. There is no "Foundation" or "Level 4" label. A per-course syllabus has "Course Objectives", not a "Preamble".',
    '- `paperPattern`: only if the text states a question paper pattern or model question paper structure for THIS course. The pattern varies by course category - theory courses use 60 marks (Part A 8 x 3, Part B 4 x 9) while HMC courses use 50 marks (Part A 6 x 3, Part B 4 x 8) - so copy what this syllabus says and never generalise from another course. If nothing is stated, use [] and put "paper pattern" in `notFound`.',
    '- `assessment`: CIE marks, ESE marks and ESE duration in minutes, only if printed.',
    `- ${BLOOM_NOTE}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    task: 'syllabus',
    temperature: 0.1,
    schema: syllabusSchema,
    system: SYSTEM_BASE('extract a course syllabus into modules, course outcomes with Bloom\'s levels, and any paper pattern.'),
    user,
    contract: JSON_CONTRACT(syllabusSchema, 'Every module and CO you emit must be traceable to the supplied text.'),
  };
}

/* ------------------------------------------------------------------ */
/* 4. Coverage tagging (batched)                                        */
/* ------------------------------------------------------------------ */

export function buildCoveragePrompt({ questions, scope, modules, courseOutcomes, alreadyUncovered = [] }) {
  const syllabusBlock = [
    '### Syllabus reference (only these modules and COs exist)',
    modules
      .map(
        (m) =>
          `Module ${m.number}${m.title ? ` - ${m.title}` : ''}:\n` +
          m.topics.map((t) => `  - [${t.id ?? ''}] ${t.text}`).join('\n')
      )
      .join('\n'),
    '',
    '### Course outcomes',
    courseOutcomes.map((c) => `- ${c.id}${c.bloom ? ` (${c.bloom})` : ''}: ${c.statement}`).join('\n') || '(none supplied)',
  ].join('\n');

  const user = [
    'Map each question below to the syllabus: which module(s), which topics, and which course outcome(s) it assesses.',
    '',
    `### Teacher-declared scope\nModules in scope: ${(scope.modulesInScope ?? []).join(', ') || 'not stated'}${scope.moduleScopeNotes ? `\nNote: ${scope.moduleScopeNotes}` : ''}`,
    '',
    syllabusBlock,
    alreadyUncovered.length
      ? `\n### In-scope topics with no marks so far\n${alreadyUncovered.join('\n')}`
      : '',
    '',
    '### Questions',
    JSON.stringify(
      questions.map((q) => ({ id: q.id, part: q.part, label: q.label, marks: q.marks, text: q.text })),
      null,
      1
    ),
    '',
    '### Rules',
    '- Use only module numbers, topic ids and CO ids listed above. Never invent one.',
    '- A question may map to more than one module or topic if it genuinely spans them; usually it is one.',
    '- `topicIds` must be topic ids from the list (or "" entries copied verbatim when a topic has no id).',
    '- `assessedBloom` is the level the question actually demands, not the level of its CO.',
    `- ${BLOOM_NOTE}`,
    '- `inScope`: false when the question assesses a module outside the declared scope.',
    '- `confidence`: "low" when the question wording could plausibly map elsewhere.',
    '- Return one entry per question, keeping the exact ids you were given.',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    task: 'coverage',
    temperature: 0.1,
    schema: coverageBatchSchema,
    system: SYSTEM_BASE('tag examination questions against a syllabus. You never invent syllabus content.'),
    user,
    contract: JSON_CONTRACT(coverageBatchSchema),
  };
}

/* ------------------------------------------------------------------ */
/* 5. Ambiguity / fairness linter (batched)                             */
/* ------------------------------------------------------------------ */

export function buildLintPrompt({ questions, scope, modules, courseOutcomes, coverageByQuestion }) {
  const user = [
    'Audit these questions for ambiguity and fairness. This is a quality review for the teacher who wrote the paper.',
    '',
    '### Paper context',
    `Course: ${scope.courseCode || ''} ${scope.courseTitle || ''}`.trim(),
    `Total marks: ${scope.totalMarks || 'not stated'}   Duration: ${scope.durationMinutes || 'not stated'} minutes`,
    `Modules in scope: ${(scope.modulesInScope ?? []).join(', ') || 'not stated'}`,
    '',
    '### Syllabus reference',
    modules
      .map((m) => `Module ${m.number}${m.title ? ` - ${m.title}` : ''}: ${m.topics.map((t) => t.text).join('; ')}`)
      .join('\n'),
    '',
    '### Course outcomes',
    courseOutcomes.map((c) => `- ${c.id}${c.bloom ? ` (${c.bloom})` : ''}: ${c.statement}`).join('\n') || '(none supplied)',
    '',
    '### Questions with their coverage tags',
    JSON.stringify(
      questions.map((q) => ({
        id: q.id,
        part: q.part,
        label: q.label,
        marks: q.marks,
        text: q.text,
        covers: coverageByQuestion?.[q.id] ?? null,
      })),
      null,
      1
    ),
    '',
    '### What to flag (`type`)',
    '- `vague-wording`: a verb or noun with no single defensible reading ("discuss", "explain briefly", "various", "etc.").',
    '- `multiple-interpretations`: two or more readings that would earn marks differently.',
    '- `missing-data`: a numerical or factual input needed to answer is absent.',
    '- `missing-constraint`: no word limit, precision, assumption, unit or scope boundary, where one is needed.',
    '- `double-barreled`: two separate asks joined by "and" where only one may be answered.',
    '- `marks-effort-mismatch`: the work implied is clearly too much or too little for the marks.',
    '- `out-of-scope`: assesses a module the teacher declared out of scope.',
    '- `bloom-mismatch`: the level the question demands differs from its mapped CO\'s level.',
    '- `figure-dependent`: it relies on a figure or table that the text does not carry.',
    '',
    '### Rules',
    '- Flag only real problems. Do not pad the list. A clean paper should produce few flags.',
    '- `reason`: ONE sentence, naming the specific problem. No restating the question.',
    '- `evidence`: the exact words from the question that cause the problem (short quote), or "".',
    '- `rewrite`: a drop-in replacement of the whole question that fixes the problem, keeping the same marks, module and CO unless you flag otherwise. Always supply it.',
    '- `severity`: "high" if it would cost most students marks or make marking inconsistent; "medium" if it affects quality; "low" if cosmetic.',
    '- `duplicates`: pairs of questions that test the same thing closely enough that the paper double-counts.',
    '- Return at most 3 flags per question, the most important ones.',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    task: 'lint',
    temperature: 0.2,
    schema: lintSchema,
    system: SYSTEM_BASE('act as a careful, sceptical exam-paper reviewer. You always supply a concrete rewrite, never just a complaint.'),
    user,
    contract: JSON_CONTRACT(lintSchema),
  };
}

/* ------------------------------------------------------------------ */
/* 6. Alternative question suggester                                    */
/* ------------------------------------------------------------------ */

export function buildSuggestionPrompt({ targets, scope, modules, courseOutcomes, bloomChoice, classNote }) {
  const user = [
    'Propose replacement questions for a KTU question paper.',
    '',
    '### Paper context',
    `Course: ${scope.courseCode || ''} ${scope.courseTitle || ''}`.trim(),
    `Total marks: ${scope.totalMarks || 'not stated'}`,
    `Requested Bloom's level: ${bloomChoice || 'match the target CO\'s level'}`,
    classNote ? `Teacher's note about this class: ${classNote}` : '',
    '',
    '### Syllabus reference',
    modules
      .map((m) => `Module ${m.number}${m.title ? ` - ${m.title}` : ''}:\n${m.topics.map((t) => `  - [${t.id ?? ''}] ${t.text}`).join('\n')}`)
      .join('\n'),
    '',
    '### Course outcomes',
    courseOutcomes.map((c) => `- ${c.id}${c.bloom ? ` (${c.bloom})` : ''}: ${c.statement}`).join('\n') || '(none supplied)',
    '',
    '### What each suggestion is for',
    JSON.stringify(targets, null, 1),
    '',
    '### Rules',
    '- Each suggestion must be answerable from the named topic in the named module, and must genuinely assess the named CO.',
    '- Match the requested Bloom\'s level. Change the task verb to suit: a K3 question asks the student to compute or apply, a K4 question asks them to compare or analyse.',
    '- Use the marks given for that target. A 3-mark question must be answerable in about 4 minutes; a 9-mark question in about 11 minutes.',
    '- Be specific and self-contained: no "discuss the above", no reference to a figure that does not exist, and state any data the student needs.',
    '- `rationale`: one sentence on why this question is better than what it replaces (or why it closes the coverage gap).',
    `- ${BLOOM_NOTE}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    task: 'suggestion',
    temperature: 0.5,
    schema: suggestionSchema,
    system: SYSTEM_BASE('write replacement examination questions that are unambiguous, self-contained and correctly levelled.'),
    user,
    contract: JSON_CONTRACT(suggestionSchema),
  };
}

/* ------------------------------------------------------------------ */
/* 7. Mode B: per-question persona prediction (batched)                 */
/* ------------------------------------------------------------------ */

export function buildPersonaQuestionPrompt({ questions, scope, modules, courseOutcomes, classNote }) {
  const user = [
    'You are predicting how three types of student would experience each question of this paper.',
    '',
    'IMPORTANT: the students do NOT attempt the paper here. For each question and each persona, predict how that student type\'s exam would go.',
    '',
    '### The three personas',
    personaBriefForPrompt(),
    '',
    '### Paper context',
    `Course: ${scope.courseCode || ''} ${scope.courseTitle || ''}`.trim(),
    `Total marks: ${scope.totalMarks || 'not stated'}   Duration: ${scope.durationMinutes || 'not stated'} minutes`,
    `Modules in scope: ${(scope.modulesInScope ?? []).join(', ') || 'not stated'}`,
    classNote ? `\n### Teacher's note about this specific class (apply it)\n${classNote}` : '',
    '',
    '### Syllabus reference',
    modules
      .map((m) => `Module ${m.number}${m.title ? ` - ${m.title}` : ''}: ${m.topics.map((t) => `[${t.id ?? ''}] ${t.text}`).join('; ')}`)
      .join('\n'),
    '',
    '### Course outcomes',
    courseOutcomes.map((c) => `- ${c.id}${c.bloom ? ` (${c.bloom})` : ''}: ${c.statement}`).join('\n') || '(none supplied)',
    '',
    '### Questions',
    JSON.stringify(
      questions.map((q) => ({ id: q.id, part: q.part, label: q.label, marks: q.marks, text: q.text })),
      null,
      1
    ),
    '',
    '### Rules for each persona verdict',
    '- `bandLowPercent` / `bandHighPercent`: the percentage of THAT QUESTION\'s marks you expect this persona to earn. Give a band, not a point. Low <= high.',
    '- `likelyScorePercent`: a single best estimate inside the band.',
    '- `pitfall`: the most likely specific mistake or misunderstanding, in one sentence. Name the mechanism ("applies the definition of X to Y, which does not hold"), not a general trait.',
    '- `trigger`: the exact concept or wording in the question that causes it, quoted or tightly paraphrased.',
    '- `triggerQuote`: the exact words from the question, if there are any. Else "".',
    '- `timeMinutes`: how long this persona would spend on this question.',
    '- `attemptsIt`: false if you expect them to leave it blank.',
    '- Confidence: "low" when the question is ambiguous enough that the outcome is unpredictable.',
    '- If the question is ambiguous, say so in `notes` rather than pretending the prediction is firm.',
    `- Every band is an estimate on a risk scale, not a measurement. ${PERSONA_CAVEAT}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    task: 'persona-question',
    temperature: 0.4,
    schema: personaQuestionSchema,
    system: SYSTEM_BASE('predict how weak, average and strong students would each experience a question. You reason from the question\'s wording and cognitive demand, never from student data you do not have.'),
    user,
    contract: JSON_CONTRACT(personaQuestionSchema, 'Return exactly three persona entries per question, with persona set to "weak", "average" and "strong".'),
  };
}

/* ------------------------------------------------------------------ */
/* 8. Mode B: paper-level synthesis                                     */
/* ------------------------------------------------------------------ */

export function buildPersonaPaperPrompt({ scope, questionPredictions, questionMeta, classNote }) {
  const user = [
    'Synthesise the per-question persona predictions into a whole-paper picture.',
    '',
    '### Paper context',
    `Course: ${scope.courseCode || ''} ${scope.courseTitle || ''}`.trim(),
    `Total marks: ${scope.totalMarks || 'not stated'}`,
    `Duration: ${scope.durationMinutes || 'not stated'} minutes`,
    `Modules in scope: ${(scope.modulesInScope ?? []).join(', ') || 'not stated'}`,
    classNote ? `Teacher's note about this class: ${classNote}` : '',
    '',
    '### Per-question predictions already made',
    JSON.stringify(questionPredictions, null, 1),
    '',
    '### Question metadata (marks, part, module)',
    JSON.stringify(questionMeta, null, 1),
    '',
    '### Produce',
    '1. `overallSpread`: the expected overall percentage band per persona, with a one-sentence rationale.',
    '2. `timeFeasibility`: sum the per-question times per persona and compare with the exam duration. `verdict` is "comfortable", "tight" or "infeasible". Say plainly whether each persona can finish.',
    '3. `separators`: for each question, how well it separates the three personas. "high" means weak and strong diverge sharply; "low" means all three land in the same place (a question everyone finds hard, or everyone finds trivial, is a poor separator).',
    '4. `rewritePriority`: the questions most worth rewording, highest priority first, each with a concrete suggested change.',
    '5. `summary`: 2-4 sentences for the teacher on how this paper is likely to behave.',
    '',
    '### Rules',
    '- Be explicit about questions that do NOT discriminate, including "hard for everyone" cases.',
    '- The time verdict must be consistent with the numbers you sum. Show the sums in the fields.',
    '- `classNoteApplied`: restate the teacher\'s class note if you used it, else "".',
    `- ${PERSONA_CAVEAT}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    task: 'persona-paper',
    temperature: 0.4,
    schema: personaPaperSchema,
    system: SYSTEM_BASE('synthesise per-question risk predictions into an honest whole-paper view, including which questions fail to discriminate between students.'),
    user,
    contract: JSON_CONTRACT(personaPaperSchema),
  };
}

/* ------------------------------------------------------------------ */
/* 9. Mode A narrative summary                                          */
/* ------------------------------------------------------------------ */

export function buildAnalysisSummaryPrompt({ scope, coverage, flags, duplicates, suggestionCount }) {
  const user = [
    'Write the teacher-facing summary of this question-paper review.',
    '',
    '### Paper',
    `Course: ${scope.courseCode || ''} ${scope.courseTitle || ''}`.trim(),
    `Total marks: ${scope.totalMarks || 'not stated'}   Duration: ${scope.durationMinutes || 'not stated'} minutes`,
    `Modules in scope: ${(scope.modulesInScope ?? []).join(', ') || 'not stated'}`,
    '',
    '### Coverage findings',
    JSON.stringify(coverage, null, 1),
    '',
    '### Ambiguity and fairness flags',
    JSON.stringify(flags.map((f) => ({ questionId: f.questionId, type: f.type, severity: f.severity, reason: f.reason })), null, 1),
    '',
    '### Near-duplicate questions',
    JSON.stringify(duplicates, null, 1),
    `\nAlternative questions proposed: ${suggestionCount}`,
    '',
    '### Rules',
    '- `headline`: one line a teacher can act on today.',
    '- `verdict`: "strong" (ship it), "sound-with-fixes", "needs-rework", or "weak".',
    '- `strengths`, `risks`, `actions`: short bullets, most important first. Actions must be specific and refer to question ids.',
    '- Do not repeat the tables. Interpret them.',
  ].join('\n');

  return {
    task: 'analysis-summary',
    temperature: 0.3,
    schema: analysisSummarySchema,
    system: SYSTEM_BASE('summarise an exam-paper review for the teacher who wrote the paper. Be direct and specific; no filler.'),
    user,
    contract: JSON_CONTRACT(analysisSummarySchema),
  };
}

/** Registry, so the settings panel can show exactly what is being sent. */
export const PROMPTS = {
  version: PROMPT_VERSION,
  builders: {
    scope: buildScopePrompt,
    segmentation: buildSegmentationPrompt,
    syllabus: buildSyllabusPrompt,
    coverage: buildCoveragePrompt,
    lint: buildLintPrompt,
    suggestion: buildSuggestionPrompt,
    'persona-question': buildPersonaQuestionPrompt,
    'persona-paper': buildPersonaPaperPrompt,
    'analysis-summary': buildAnalysisSummaryPrompt,
  },
};
