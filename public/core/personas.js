/**
 * The three fixed student personas used by Mode B.
 *
 * These are the *visible* description cards shown to the teacher, and they are
 * also injected into the prompt so the model predicts against the same picture
 * the teacher sees. Personas never attempt the paper: they predict how that
 * student type's exam would go.
 *
 * Calibration bands are deliberately wide. All Mode B output is labelled as a
 * risk flag / relative difficulty estimate, not a measured result.
 */

export const PERSONAS = [
  {
    id: 'weak',
    name: 'Weak',
    tagline: 'Marks-driven, selective study, fragile under unfamiliar wording',
    accent: '#f87171',
    studyHabits:
      'Revises from class notes in the last two days, mostly by reading rather than solving. Skips derivations, long proofs and anything that looked hard in class. Memorises definitions, formulae and standard procedures as text.',
    strengths:
      'Reproduces definitions and labelled diagrams when the wording matches the notes. Solves formula-recitation and one-step numerical problems. Picks up marks on Part A short answers that ask for a statement or a list.',
    errorTypes:
      'Confuses similar terms and symbols. Drops units, limits and boundary conditions. Misreads a multi-part question and answers only the first part. Arithmetic slips part-way through a solution and does not notice. Cannot start a question whose framing is new.',
    timeManagement:
      'Over-invests in the first question they can start, then runs out of time. Frequently leaves the last part of the paper untouched. Almost never re-checks an answer.',
    readingCarefulness:
      'Skims. Misses qualifiers such as "hence", "in terms of", "with justification", "at least". Treats sub-parts as optional.',
    /** Prediction calibration */
    calibration:
      'Expect partial credit where the method is standard and explicitly named in the question. Expect near-zero on analyse/evaluate questions that need a choice or a justification, and on any question that depends on reading a figure carefully.',
    expectedPercent: [0, 45],
  },
  {
    id: 'average',
    name: 'Average',
    tagline: 'Covers everything at textbook depth; solid on routine problems',
    accent: '#fbbf24',
    studyHabits:
      'Works through previous-year papers and the standard exercises. Covers all modules, but at the depth the lecture notes and the prescribed textbook go to. Practises the taught method for each problem type.',
    strengths:
      'Completes routine apply-level problems correctly using the taught procedure. Strong on 3-mark Part A answers. Handles sub-parts that are each a standard exercise.',
    errorTypes:
      'Stalls when a problem deviates from the taught procedure or combines two topics. Loses marks on the justification and interpretation steps of analyse-level questions. Partial solutions where a proof or derivation is expected.',
    timeManagement:
      'Broadly realistic: allocates roughly by marks, but the fourth module is usually rushed. Leaves 10-15 minutes at the end for a quick review.',
    readingCarefulness:
      'Reads each question once, fully, in calm conditions. Under time pressure misreads "derive" as "state", or misses a stated simplifying assumption.',
    calibration:
      'Expect most of the marks on routine apply-level questions, with a clean drop-off on questions that need a judgement, a comparison, or an unfamiliar combination. Expect them to attempt everything but to leave method gaps.',
    expectedPercent: [35, 70],
  },
  {
    id: 'strong',
    name: 'Strong',
    tagline: 'Syllabus plus references; comfortable with unseen framings',
    accent: '#34d399',
    studyHabits:
      'Covers the syllabus and dips into the reference books. Practices unseen problems, derivation chains and past papers across years. Links topics across modules.',
    strengths:
      'Handles multi-step and analyse/evaluate questions. Recovers from a wrong start and re-routes mid-answer. Can attempt an unfamiliar framing by mapping it to a known technique. Writes justifications and conclusions unprompted.',
    errorTypes:
      'Occasional carelessness on very easy 3-mark Part A questions. Tends to over-elaborate, which can cost time. May over-engineer a question that only wanted a short answer.',
    timeManagement:
      'Allocates strictly by marks. Finishes with time to spare and uses it to re-check units and edge cases.',
    readingCarefulness:
      'Reads carefully, notices constraints, specific instructions and "hence" chains. Checks units, signs and limiting cases.',
    calibration:
      'Expect near-full marks on apply-level questions, with the remaining loss concentrated in careless Part A slips, missing a required justification, or an ambiguous question where their interpretation differs from the examiner\u2019s.',
    expectedPercent: [65, 100],
  },
];

export const PERSONA_IDS = PERSONAS.map((p) => p.id);

export function personaById(id) {
  return PERSONAS.find((p) => p.id === id) ?? null;
}

/** Compact block injected into prompts. */
export function personaBriefForPrompt() {
  return PERSONAS.map(
    (p) =>
      `### ${p.id.toUpperCase()} (${p.name})\n` +
      `- Study habits: ${p.studyHabits}\n` +
      `- Strengths: ${p.strengths}\n` +
      `- Typical errors: ${p.errorTypes}\n` +
      `- Time management: ${p.timeManagement}\n` +
      `- Reading care: ${p.readingCarefulness}\n` +
      `- Calibration: ${p.calibration}`
  ).join('\n\n');
}

/** Applied to every Mode B output, in the UI and in the prompt. */
export const PERSONA_CAVEAT =
  'Predictions are risk flags and relative difficulty estimates produced by a language model from the paper text. They are not measured results and carry no predictive guarantee.';
