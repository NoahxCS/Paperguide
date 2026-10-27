/**
 * Tests for public/core/persona.js (aggregatePersonas) and public/core/personas.js.
 *
 * The paper fixture is four questions:
 *   q1 (3 marks), q2 (3 marks), q3a/q3b (an either/or group, 9 marks each).
 * With scope.totalMarks 24 the answerable total is 3 + 3 + 9 = 15.
 * All band midpoints and times are hand-written, so the sums below are exact:
 *   weak    0.9 + 0.9 + 0.45 + 1.35 = 3.6
 *   average 1.8 + 1.05 + 2.25 + 3.15 = 8.25 (rounds to 8.3)
 *   strong  2.4 + 1.2 + 3.15 + 4.05 = 10.8
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { aggregatePersonas } from '../public/core/persona.js';
import { PERSONAS, PERSONA_IDS, personaById } from '../public/core/personas.js';

const QUESTIONS = [
  { id: 'q1', label: 'Q1', marks: 3 },
  { id: 'q2', label: 'Q2', marks: 3 },
  { id: 'q3a', label: 'Q3a', marks: 9, choiceGroup: 'g1' },
  { id: 'q3b', label: 'Q3b', marks: 9, choiceGroup: 'g1' },
];

const SHARE = { q1: 1, q2: 1, q3a: 0.5, q3b: 0.5 };

const BANDS = {
  // weak / average / strong, as [low, high] percentages
  q1: { weak: [20, 40], average: [50, 70], strong: [70, 90] }, // mids 30/60/80 -> 50-point gap
  q2: { weak: [20, 40], average: [25, 45], strong: [30, 50] }, // mids 30/35/40 -> 10-point gap, all low
  q3a: { weak: [0, 20], average: [40, 60], strong: [60, 80] }, // mids 10/50/70
  q3b: { weak: [20, 40], average: [60, 80], strong: [80, 100] }, // mids 30/70/90
};

const SCOPE = { totalMarks: 24 };

function predictionsFor(times) {
  return new Map(
    QUESTIONS.map((q) => [
      q.id,
      {
        questionId: q.id,
        personas: PERSONA_IDS.map((persona) => ({
          persona,
          bandLowPercent: BANDS[q.id][persona][0],
          bandHighPercent: BANDS[q.id][persona][1],
          timeMinutes: times[q.id],
        })),
      },
    ])
  );
}

const COMFORTABLE_TIMES = { q1: 5, q2: 5, q3a: 10, q3b: 10 }; // sums to 20 min
const TIGHT_TIMES = { q1: 15, q2: 15, q3a: 30, q3b: 30 }; // sums to 60 min
const OVER_TIMES = { q1: 20, q2: 20, q3a: 40, q3b: 40 }; // sums to 80 min

const byPersona = (aggregate, id) => aggregate.byPersona.find((p) => p.persona === id);
const perQuestion = (aggregate, id) => aggregate.perQuestion.find((q) => q.questionId === id);

/* ------------------------------------------------------------------ */
/* personas.js                                                          */
/* ------------------------------------------------------------------ */

test('PERSONAS holds exactly weak, average and strong', () => {
  assert.deepEqual(PERSONA_IDS, ['weak', 'average', 'strong']);
  assert.deepEqual(PERSONAS.map((p) => p.id), ['weak', 'average', 'strong']);
});

test('every persona has non-empty descriptive fields', () => {
  const fields = ['studyHabits', 'strengths', 'errorTypes', 'timeManagement', 'readingCarefulness'];
  for (const persona of PERSONAS) {
    for (const field of fields) {
      assert.equal(typeof persona[field], 'string', `${persona.id}.${field} is a string`);
      assert.ok(persona[field].trim().length > 0, `${persona.id}.${field} is non-empty`);
    }
  }
});

test('personaById resolves known ids and returns null otherwise', () => {
  assert.equal(personaById('weak'), PERSONAS[0]);
  assert.equal(personaById('strong').name, 'Strong');
  assert.equal(personaById('nope'), null);
});

/* ------------------------------------------------------------------ */
/* aggregatePersonas - expected marks                                   */
/* ------------------------------------------------------------------ */

test('aggregatePersonas sums band midpoints times marks, sharing an either/or group', () => {
  const aggregate = aggregatePersonas({
    questions: QUESTIONS,
    predictions: predictionsFor(COMFORTABLE_TIMES),
    scope: SCOPE,
    durationMinutes: 60,
  });

  assert.equal(byPersona(aggregate, 'weak').expectedMarks, 3.6);
  assert.equal(byPersona(aggregate, 'average').expectedMarks, 8.3); // 8.25 rounded to 1 dp
  assert.equal(byPersona(aggregate, 'strong').expectedMarks, 10.8);

  // The same figures, recomputed independently from the midpoints.
  for (const id of PERSONA_IDS) {
    const expected = QUESTIONS.reduce((total, q) => {
      const [low, high] = BANDS[q.id][id];
      return total + ((low + high) / 2 / 100) * q.marks * SHARE[q.id];
    }, 0);
    assert.ok(
      Math.abs(byPersona(aggregate, id).expectedMarks - expected) <= 0.06,
      `${id}: ${byPersona(aggregate, id).expectedMarks} vs ${expected}`
    );
  }
});

test('aggregatePersonas shares an either/or group between its two options', () => {
  const aggregate = aggregatePersonas({
    questions: QUESTIONS,
    predictions: predictionsFor(COMFORTABLE_TIMES),
    scope: SCOPE,
    durationMinutes: 60,
  });
  assert.equal(perQuestion(aggregate, 'q1').shareOfGroup, 1);
  assert.equal(perQuestion(aggregate, 'q3a').shareOfGroup, 0.5);
  assert.equal(perQuestion(aggregate, 'q3b').shareOfGroup, 0.5);
  // Times are shared the same way: 5 + 5 + 10*0.5 + 10*0.5 = 20.
  assert.equal(byPersona(aggregate, 'weak').timeMinutes, 20);
  assert.equal(byPersona(aggregate, 'strong').timeMinutes, 20);
  // 1 + 1 + 0.5 + 0.5 answered questions.
  assert.equal(byPersona(aggregate, 'weak').attemptedQuestions, 3);
});

test('aggregatePersonas reports the exam maximum and per-persona percentages', () => {
  const aggregate = aggregatePersonas({
    questions: QUESTIONS,
    predictions: predictionsFor(COMFORTABLE_TIMES),
    scope: SCOPE,
    durationMinutes: 60,
  });
  assert.equal(aggregate.examMax, 24);
  assert.equal(byPersona(aggregate, 'weak').expectedPercent, 15);
  assert.equal(byPersona(aggregate, 'average').expectedPercent, 34.4); // 8.25/24
  assert.equal(byPersona(aggregate, 'strong').expectedPercent, 45);
});

test('aggregatePersonas falls back to the printed marks when scope has no total', () => {
  const aggregate = aggregatePersonas({
    questions: QUESTIONS,
    predictions: predictionsFor(COMFORTABLE_TIMES),
    scope: {},
    durationMinutes: 60,
  });
  assert.equal(aggregate.examMax, 24); // 3 + 3 + 9 + 9 printed
});

/* ------------------------------------------------------------------ */
/* aggregatePersonas - separation                                       */
/* ------------------------------------------------------------------ */

test('aggregatePersonas classes a wide weak-versus-strong gap as high separation', () => {
  const aggregate = aggregatePersonas({
    questions: QUESTIONS,
    predictions: predictionsFor(COMFORTABLE_TIMES),
    scope: SCOPE,
    durationMinutes: 60,
  });
  const q1 = perQuestion(aggregate, 'q1');
  assert.equal(q1.separation.points, 50);
  assert.equal(q1.separation.band, 'high');
  assert.equal(q1.separation.note, '');
  assert.equal(perQuestion(aggregate, 'q3a').separation.band, 'high');
  assert.equal(aggregate.separation.highCount, 3);
  assert.deepEqual(aggregate.separation.separators.map((s) => s.questionId), ['q1', 'q3a', 'q3b']);
});

test('aggregatePersonas classes a question all three find hard as low separation', () => {
  const aggregate = aggregatePersonas({
    questions: QUESTIONS,
    predictions: predictionsFor(COMFORTABLE_TIMES),
    scope: SCOPE,
    durationMinutes: 60,
  });
  const q2 = perQuestion(aggregate, 'q2');
  assert.equal(q2.separation.points, 10);
  assert.equal(q2.separation.band, 'low');
  assert.equal(q2.separation.note, 'Hard for all three: it does not separate them.');
  assert.equal(aggregate.separation.lowCount, 1);
  assert.deepEqual(aggregate.separation.nonSeparators.map((s) => s.questionId), ['q2']);
  assert.equal(aggregate.separation.nonSeparators[0].why, 'Hard for all three: it does not separate them.');
});

/* ------------------------------------------------------------------ */
/* aggregatePersonas - time feasibility                                 */
/* ------------------------------------------------------------------ */

test('aggregatePersonas calls the timing comfortable when the sums are well under the duration', () => {
  const aggregate = aggregatePersonas({
    questions: QUESTIONS,
    predictions: predictionsFor(COMFORTABLE_TIMES),
    scope: SCOPE,
    durationMinutes: 60,
  });
  assert.equal(aggregate.timeFeasibility.verdict, 'comfortable');
  assert.equal(aggregate.timeFeasibility.margin, 40);
  assert.deepEqual(aggregate.timeFeasibility.perPersona.map((p) => p.verdict), [
    'comfortable',
    'comfortable',
    'comfortable',
  ]);
});

test('aggregatePersonas calls the timing tight between 90% and 100% of the duration', () => {
  const aggregate = aggregatePersonas({
    questions: QUESTIONS,
    predictions: predictionsFor(TIGHT_TIMES),
    scope: SCOPE,
    durationMinutes: 60,
  });
  assert.equal(aggregate.timeFeasibility.verdict, 'tight');
  assert.equal(aggregate.timeFeasibility.margin, 0);
});

test('aggregatePersonas calls the timing infeasible over the duration', () => {
  const aggregate = aggregatePersonas({
    questions: QUESTIONS,
    predictions: predictionsFor(OVER_TIMES),
    scope: SCOPE,
    durationMinutes: 60,
  });
  assert.equal(aggregate.timeFeasibility.verdict, 'infeasible');
  assert.equal(aggregate.timeFeasibility.margin, -20);
});

test('aggregatePersonas reports unknown timing when no duration is given', () => {
  const aggregate = aggregatePersonas({
    questions: QUESTIONS,
    predictions: predictionsFor(COMFORTABLE_TIMES),
    scope: SCOPE,
  });
  assert.equal(aggregate.timeFeasibility.durationMinutes, null);
  assert.equal(aggregate.timeFeasibility.verdict, 'unknown');
  assert.equal(aggregate.timeFeasibility.margin, null);
});

/* ------------------------------------------------------------------ */
/* aggregatePersonas - missing predictions                              */
/* ------------------------------------------------------------------ */

test('aggregatePersonas marks a question with no prediction as missing, without throwing', () => {
  const questions = [...QUESTIONS, { id: 'q4', label: 'Q4', marks: 3 }];
  const aggregate = aggregatePersonas({
    questions,
    predictions: predictionsFor(COMFORTABLE_TIMES),
    scope: SCOPE,
    durationMinutes: 60,
  });

  const q4 = perQuestion(aggregate, 'q4');
  assert.ok(q4, 'the un-predicted question is still reported');
  assert.equal(q4.source, 'missing');
  assert.deepEqual(q4.warnings, ['The model returned no prediction for this question.']);
  assert.equal(q4.personas.weak.expectedMarks, null);
  assert.equal(q4.personas.weak.bandLowPercent, null);
  assert.equal(q4.personas.weak.missing, true);
  assert.equal(q4.separation.band, 'unknown');
  assert.equal(q4.separation.points, null);
  // The other questions are unaffected.
  assert.equal(perQuestion(aggregate, 'q1').source, 'model');
});

test('aggregatePersonas survives an empty prediction map', () => {
  const aggregate = aggregatePersonas({
    questions: QUESTIONS,
    predictions: new Map(),
    scope: SCOPE,
    durationMinutes: 60,
  });
  assert.ok(aggregate.perQuestion.every((q) => q.source === 'missing'));
  assert.deepEqual(aggregate.byPersona.map((p) => p.expectedMarks), [0, 0, 0]);
});
