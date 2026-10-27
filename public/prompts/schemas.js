/**
 * JSON contracts for every LLM call. One place, versioned, strict.
 *
 * These are intentionally explicit: because we only assume plain chat
 * completions, the schema is also rendered into the prompt as a spec, so the
 * model is told the exact shape instead of guessing it.
 */

export const SCHEMA_VERSION = '1.2.0';

/** KTU / Bloom's revised taxonomy levels used across the app. */
export const BLOOM = [
  { level: 'K1', name: 'Remember', verbs: 'define, list, state, recall, name, identify' },
  { level: 'K2', name: 'Understand', verbs: 'explain, describe, summarise, illustrate, classify' },
  { level: 'K3', name: 'Apply', verbs: 'apply, compute, solve, implement, demonstrate, use' },
  { level: 'K4', name: 'Analyse', verbs: 'analyse, compare, differentiate, examine, derive' },
  { level: 'K5', name: 'Evaluate', verbs: 'evaluate, justify, critique, assess, select' },
  { level: 'K6', name: 'Create', verbs: 'design, construct, develop, formulate, write' },
];

export const BLOOM_LEVELS = BLOOM.map((b) => b.level);
/** Accepts K1..K6 or the word form; normalises to K1..K6. */
export const bloomEnum = [...BLOOM_LEVELS, ...BLOOM.map((b) => b.name)];

const bloomRef = { type: 'string', enum: bloomEnum };

const partSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1 },
    instructions: { type: 'string' },
    questionCount: { type: 'integer', minimum: 0 },
    marksPerQuestion: { type: 'number', minimum: 0 },
    totalMarks: { type: 'number', minimum: 0 },
    choice: { type: 'string', enum: ['none', 'either-or', 'any-n', 'unknown'] },
    coversModules: { type: 'array', items: { type: 'integer' } },
    questionsPerModule: { type: 'integer', minimum: 0 },
  },
  required: ['name'],
};

const moduleSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    number: { type: 'integer', minimum: 0 },
    title: { type: 'string' },
    hours: { type: 'number', minimum: 0 },
    topics: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          text: { type: 'string', minLength: 1 },
        },
        required: ['text'],
      },
    },
    cos: { type: 'array', items: { type: 'string' } },
  },
  required: ['number'],
};

const coSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 2 },
    statement: { type: 'string', minLength: 4 },
    bloom: bloomRef,
    mapsTo: { type: 'array', items: { type: 'integer' } },
  },
  required: ['id', 'statement'],
};

/* ------------------------------------------------------------------ */
/* 1. Paper header + scope parsed from the teacher's own words          */
/* ------------------------------------------------------------------ */

export const scopeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    courseCode: { type: 'string' },
    courseTitle: { type: 'string' },
    examLabel: { type: 'string' },
    totalMarks: { type: 'number', minimum: 0 },
    durationMinutes: { type: 'number', minimum: 0 },
    modulesInScope: { type: 'array', items: { type: 'integer', minimum: 0 } },
    moduleScopeNotes: { type: 'string' },
    paperStructure: {
      type: 'object',
      additionalProperties: false,
      properties: {
        source: { type: 'string', enum: ['teacher', 'syllabus', 'ktu-2024-default', 'inferred'] },
        note: { type: 'string' },
        parts: { type: 'array', items: partSchema },
      },
      required: ['parts'],
    },
    classNote: { type: 'string' },
    unresolved: { type: 'array', items: { type: 'string' } },
  },
  required: ['courseCode', 'modulesInScope'],
};

/* ------------------------------------------------------------------ */
/* 2. Paper metadata + question segmentation                            */
/* ------------------------------------------------------------------ */

const questionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 1 },
    part: { type: 'string' },
    label: { type: 'string' },
    text: { type: 'string', minLength: 1 },
    marks: { type: 'number', minimum: 0 },
    marksSource: { type: 'string', enum: ['printed', 'inferred', 'part-default'] },
    subParts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          text: { type: 'string' },
          marks: { type: 'number', minimum: 0 },
        },
        required: ['label'],
      },
    },
    choiceGroup: { type: 'string' },
    moduleLabel: { type: 'string' },
    printedCo: { type: 'string' },
    hasFigure: { type: 'boolean' },
    notes: { type: 'string' },
  },
  required: ['id', 'text'],
};

export const segmentationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    courseCode: { type: 'string' },
    courseTitle: { type: 'string' },
    examLabel: { type: 'string' },
    totalMarksPrinted: { type: 'number', minimum: 0 },
    durationMinutes: { type: 'number', minimum: 0 },
    parts: { type: 'array', items: partSchema },
    questions: { type: 'array', items: questionSchema },
    totalMarksCounted: { type: 'number', minimum: 0 },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['questions'],
};

/* ------------------------------------------------------------------ */
/* 3. Syllabus parsed from fetched text                                 */
/* ------------------------------------------------------------------ */

export const syllabusSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    courseCode: { type: 'string' },
    courseTitle: { type: 'string' },
    scheme: { type: 'string' },
    semester: { type: 'string' },
    branch: { type: 'string' },
    credits: {
      type: 'object',
      additionalProperties: false,
      // KTU prints "Teaching Hours/Week (L: T: P: R)" plus a separate single
      // "Credits" value, so the tuple is L-T-P-R and credits is its own number.
      properties: {
        l: { type: 'number' },
        t: { type: 'number' },
        p: { type: 'number' },
        r: { type: 'number' },
        credits: { type: 'number' },
      },
    },
    assessment: {
      type: 'object',
      additionalProperties: false,
      properties: {
        cieMarks: { type: 'number' },
        eseMarks: { type: 'number' },
        eseDurationMinutes: { type: 'number' },
      },
    },
    modules: { type: 'array', items: moduleSchema },
    courseOutcomes: { type: 'array', items: coSchema },
    paperPattern: { type: 'array', items: partSchema },
    paperPatternNote: { type: 'string' },
    notFound: { type: 'array', items: { type: 'string' } },
  },
  required: ['courseCode', 'modules'],
};

/* ------------------------------------------------------------------ */
/* 4. Mode A: coverage tagging (batched over questions)                 */
/* ------------------------------------------------------------------ */

export const coverageSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    assignments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          questionId: { type: 'string' },
          modules: { type: 'array', items: { type: 'integer' } },
          topicIds: { type: 'array', items: { type: 'string' } },
          cos: { type: 'array', items: { type: 'string' } },
          assessedBloom: bloomRef,
          inScope: { type: 'boolean' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          why: { type: 'string' },
        },
        required: ['questionId'],
      },
    },
    uncoveredTopics: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          module: { type: 'integer' },
          topicId: { type: 'string' },
          topic: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['topic'],
      },
    },
    notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['assignments'],
};

/** Coverage is computed per batch; the uncovered-topic list is derived once. */
export const coverageBatchSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    assignments: coverageSchema.properties.assignments,
    notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['assignments'],
};

/* ------------------------------------------------------------------ */
/* 5. Mode A: ambiguity / fairness linter                               */
/* ------------------------------------------------------------------ */

export const FLAG_TYPES = [
  'vague-wording',
  'multiple-interpretations',
  'missing-data',
  'missing-constraint',
  'double-barreled',
  'marks-effort-mismatch',
  'out-of-scope',
  'uncovered-topic',
  'bloom-mismatch',
  'figure-dependent',
  'duplicate',
  'over-weighted-topic',
];

export const lintSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    flags: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          questionId: { type: 'string' },
          type: { type: 'string', enum: FLAG_TYPES },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          reason: { type: 'string', minLength: 8 },
          evidence: { type: 'string' },
          rewrite: { type: 'string', minLength: 10 },
          rewriteMarks: { type: 'number', minimum: 0 },
          rewriteBloom: bloomRef,
        },
        required: ['questionId', 'type', 'reason', 'rewrite'],
      },
    },
    duplicates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          questionIds: { type: 'array', items: { type: 'string' } },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          reason: { type: 'string' },
        },
        required: ['questionIds'],
      },
    },
    notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['flags'],
};

/* ------------------------------------------------------------------ */
/* 6. Mode A: alternative question suggestions                          */
/* ------------------------------------------------------------------ */

export const suggestionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          replacesQuestionId: { type: 'string' },
          coversTopicId: { type: 'string' },
          module: { type: 'integer' },
          co: { type: 'string' },
          bloom: bloomRef,
          marks: { type: 'number', minimum: 0 },
          text: { type: 'string', minLength: 12 },
          rationale: { type: 'string' },
        },
        required: ['text', 'marks'],
      },
    },
  },
  required: ['suggestions'],
};

/* ------------------------------------------------------------------ */
/* 7. Mode B: per-question, per-persona prediction                      */
/* ------------------------------------------------------------------ */

export const PERSONA_KEYS = ['weak', 'average', 'strong'];

const personaVerdict = {
  type: 'object',
  additionalProperties: false,
  properties: {
    persona: { type: 'string', enum: PERSONA_KEYS },
    bandLowPercent: { type: 'number', minimum: 0, maximum: 100 },
    bandHighPercent: { type: 'number', minimum: 0, maximum: 100 },
    likelyScorePercent: { type: 'number', minimum: 0, maximum: 100 },
    pitfall: { type: 'string', minLength: 6 },
    trigger: { type: 'string', minLength: 3 },
    triggerQuote: { type: 'string' },
    timeMinutes: { type: 'number', minimum: 0 },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    attemptsIt: { type: 'boolean' },
  },
  required: ['persona', 'pitfall', 'trigger'],
};

export const personaQuestionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    predictions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          questionId: { type: 'string' },
          personas: { type: 'array', items: personaVerdict },
        },
        required: ['questionId', 'personas'],
      },
    },
    notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['predictions'],
};

export const personaPaperSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    overallSpread: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          persona: { type: 'string', enum: PERSONA_KEYS },
          expectedPercentLow: { type: 'number' },
          expectedPercentHigh: { type: 'number' },
          rationale: { type: 'string' },
        },
        required: ['persona'],
      },
    },
    timeFeasibility: {
      type: 'object',
      additionalProperties: false,
      properties: {
        durationMinutes: { type: 'number' },
        weakMinutes: { type: 'number' },
        averageMinutes: { type: 'number' },
        strongMinutes: { type: 'number' },
        verdict: { type: 'string', enum: ['comfortable', 'tight', 'infeasible', 'unknown'] },
        note: { type: 'string' },
      },
      required: ['durationMinutes', 'verdict'],
    },
    separators: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          questionId: { type: 'string' },
          separation: { type: 'string', enum: ['high', 'medium', 'low'] },
          why: { type: 'string' },
        },
        required: ['questionId'],
      },
    },
    rewritePriority: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          questionId: { type: 'string' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          why: { type: 'string' },
          suggestedChange: { type: 'string' },
        },
        required: ['questionId', 'why'],
      },
    },
    classNoteApplied: { type: 'string' },
    summary: { type: 'string' },
  },
  required: ['timeFeasibility'],
};

/* ------------------------------------------------------------------ */
/* 8. Mode A narrative summary                                          */
/* ------------------------------------------------------------------ */

export const analysisSummarySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string', minLength: 6 },
    verdict: { type: 'string', enum: ['strong', 'sound-with-fixes', 'needs-rework', 'weak'] },
    strengths: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    actions: { type: 'array', items: { type: 'string' } },
  },
  required: ['headline', 'verdict'],
};

/** Registry used by the settings/debug panel and the docs. */
export const ALL_SCHEMAS = {
  scope: scopeSchema,
  segmentation: segmentationSchema,
  syllabus: syllabusSchema,
  coverageBatch: coverageBatchSchema,
  lint: lintSchema,
  suggestion: suggestionSchema,
  personaQuestion: personaQuestionSchema,
  personaPaper: personaPaperSchema,
  analysisSummary: analysisSummarySchema,
};
