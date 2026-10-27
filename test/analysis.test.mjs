/**
 * Tests for public/core/analysis.js - the deterministic half of Mode A.
 *
 * A small synthetic 4-module syllabus and an 8-question segmentation are built
 * here, so the arithmetic assertions are hand-checkable:
 *   Part A: A1..A4, 3 marks each (2 questions per module was not needed here)
 *   Part B: two either/or groups of two 9-mark questions (B1a/B1b, B2a/B2b)
 * Printed total 48, answerable total 30 (4x3 + 2 groups x 9).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeCountedMarks,
  computeCoverage,
  computeBloomCheck,
  computeHotspots,
  buildReference,
  applyRewrite,
} from '../public/core/analysis.js';

/* ------------------------------------------------------------------ */
/* Fixture                                                              */
/* ------------------------------------------------------------------ */

function makeSyllabus() {
  return {
    courseCode: 'TST101',
    courseTitle: 'Test Course',
    modules: [1, 2, 3, 4].map((n) => ({
      number: n,
      title: `Module ${n}`,
      topics: [
        { id: `${n}.1`, text: `Topic ${n}.1` },
        { id: `${n}.2`, text: `Topic ${n}.2` },
      ],
      cos: [`CO${n}`],
    })),
    courseOutcomes: [1, 2, 3, 4].map((n) => ({
      id: `CO${n}`,
      statement: `Outcome ${n}`,
      bloom: ['K1', 'K2', 'K3', 'K4'][n - 1],
    })),
  };
}

function makeQuestions() {
  return [
    { id: 'A1', label: 'A1', part: 'Part A', marks: 3 },
    { id: 'A2', label: 'A2', part: 'Part A', marks: 3 },
    { id: 'A3', label: 'A3', part: 'Part A', marks: 3 },
    { id: 'A4', label: 'A4', part: 'Part A', marks: 3 },
    { id: 'B1a', label: 'B1a', part: 'Part B', marks: 9, choiceGroup: 'B1' },
    { id: 'B1b', label: 'B1b', part: 'Part B', marks: 9, choiceGroup: 'B1' },
    { id: 'B2a', label: 'B2a', part: 'Part B', marks: 9, choiceGroup: 'B2' },
    { id: 'B2b', label: 'B2b', part: 'Part B', marks: 9, choiceGroup: 'B2' },
  ];
}

function makeAssignments() {
  return new Map([
    ['A1', { modules: [1], topicIds: ['1.1'], cos: ['CO1'], assessedBloom: 'K1' }],
    ['A2', { modules: [2], topicIds: ['2.1'], cos: ['CO2'], assessedBloom: 'kl3' }],
    ['A3', { modules: [3], topicIds: ['3.1'], cos: ['CO3'], assessedBloom: 'K1' }],
    ['A4', { modules: [4], topicIds: ['4.1'], cos: ['CO4'], assessedBloom: 'K5' }],
    ['B1a', { modules: [1], topicIds: ['1.2'], cos: ['CO1'], assessedBloom: 'K2' }],
    ['B1b', { modules: [1], topicIds: ['1.1'], cos: ['CO1'], assessedBloom: 'K1' }],
    ['B2a', { modules: [2], topicIds: ['2.2'], cos: ['CO2'], assessedBloom: null }],
    // The second option of the B2 pair maps outside the declared scope (module 5).
    ['B2b', { modules: [5], topicIds: ['9.9'], cos: [], assessedBloom: 'K4' }],
  ]);
}

const makeScope = () => ({ modulesInScope: [1, 2, 3, 4], totalMarks: 60 });
const makeReference = (scope = makeScope()) => buildReference({ syllabus: makeSyllabus(), scope });

function makeCoverage() {
  const scope = makeScope();
  return computeCoverage({
    questions: makeQuestions(),
    assignmentsById: makeAssignments(),
    reference: buildReference({ syllabus: makeSyllabus(), scope }),
    scope,
  });
}

/** Four balanced 3-mark questions: one per module, 25% each. */
function makeBalancedCoverage() {
  const scope = { modulesInScope: [1, 2, 3, 4], totalMarks: 12 };
  const reference = buildReference({ syllabus: makeSyllabus(), scope });
  const questions = [1, 2, 3, 4].map((n) => ({ id: `Q${n}`, label: `Q${n}`, marks: 3 }));
  const assignmentsById = new Map(
    [1, 2, 3, 4].map((n) => [`Q${n}`, { modules: [n], topicIds: [`${n}.1`], cos: [`CO${n}`] }])
  );
  return computeCoverage({ questions, assignmentsById, reference, scope });
}

/* ------------------------------------------------------------------ */
/* computeCountedMarks                                                  */
/* ------------------------------------------------------------------ */

test('computeCountedMarks counts an either/or group once and zeroes the second option', () => {
  const { counted, groups } = computeCountedMarks(makeQuestions());
  assert.equal(counted.get('A1'), 3);
  assert.equal(counted.get('B1a'), 9);
  assert.equal(counted.get('B1b'), 0);
  assert.equal(counted.get('B2a'), 9);
  assert.equal(counted.get('B2b'), 0);

  const answerable = [...counted.values()].reduce((a, b) => a + b, 0);
  assert.equal(answerable, 30); // 4 x 3 + 2 groups x 9, not 48
});

test('computeCountedMarks reports the either/or groups and their marks', () => {
  const { groups } = computeCountedMarks(makeQuestions());
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((g) => g.id), ['B1', 'B2']);
  assert.deepEqual(groups.map((g) => g.questionIds), [
    ['B1a', 'B1b'],
    ['B2a', 'B2b'],
  ]);
  assert.deepEqual(groups.map((g) => g.marks), [9, 9]);
});

/* ------------------------------------------------------------------ */
/* computeCoverage                                                      */
/* ------------------------------------------------------------------ */

test('computeCoverage totals printed versus answerable marks', () => {
  const coverage = makeCoverage();
  assert.equal(coverage.totals.printedMarks, 48);
  assert.equal(coverage.totals.answerableMarks, 30);
  assert.equal(coverage.totals.questionCount, 8);
  assert.equal(coverage.totals.examMaxMarks, 60);
  // 30 answerable against a declared 60-mark paper is a real mismatch.
  assert.equal(coverage.totals.countsMismatch, true);
});

test('computeCoverage computes per-module answerable marks and percentages that sum to 100', () => {
  const coverage = makeCoverage();
  assert.deepEqual(coverage.byModule.map((m) => m.module), [1, 2, 3, 4]);
  assert.deepEqual(coverage.byModule.map((m) => m.answerableMarks), [12, 12, 3, 3]);
  assert.deepEqual(coverage.byModule.map((m) => m.percent), [40, 40, 10, 10]);
  const sum = coverage.byModule.reduce((a, m) => a + m.percent, 0);
  assert.equal(Math.round(sum * 10) / 10, 100);
  assert.deepEqual(coverage.byModule.map((m) => m.expectedPercent), [25, 25, 25, 25]);
  assert.deepEqual(coverage.byModule.map((m) => m.delta), [15, 15, -15, -15]);
});

test('computeCoverage lists topics that no question covers', () => {
  const coverage = makeCoverage();
  assert.deepEqual(coverage.uncoveredTopics.map((t) => t.topicId), ['3.2', '4.2']);
  assert.deepEqual(coverage.uncoveredTopics.map((t) => t.topic), ['Topic 3.2', 'Topic 4.2']);
  assert.deepEqual(coverage.uncoveredTopics.map((t) => t.module), [3, 4]);
  // Modules 1 and 2 do get both of their topics covered.
  assert.deepEqual(coverage.byModule[0].uncoveredTopicIds, []);
  assert.deepEqual(coverage.byModule[1].uncoveredTopicIds, []);
});

test('computeCoverage lists a question mapped outside modulesInScope as out of scope', () => {
  const coverage = makeCoverage();
  assert.equal(coverage.outOfScopeQuestions.length, 1);
  const out = coverage.outOfScopeQuestions[0];
  assert.equal(out.id, 'B2b');
  assert.deepEqual(out.modules, [5]);
  assert.equal(out.marks, 9);
  assert.match(out.why, /outside the declared scope \(1, 2, 3, 4\)/);
  assert.equal(coverage.questions.find((q) => q.id === 'B2b').inScope, false);
  assert.equal(coverage.questions.find((q) => q.id === 'B2a').inScope, true);
});

test('computeCoverage flags tagged topics that are not in the confirmed syllabus', () => {
  const coverage = makeCoverage();
  assert.deepEqual(coverage.unknownTopicQuestions.map((q) => q.id), ['B2b']);
});

test('computeCoverage reports the either/or groups it counted once', () => {
  const coverage = makeCoverage();
  assert.deepEqual(coverage.eitherOrGroups.map((g) => g.id), ['B1', 'B2']);
  assert.ok(coverage.eitherOrGroups.every((g) => g.counted === true));
  assert.ok(coverage.eitherOrGroups.every((g) => g.questionIds.length === 2));
});

test('computeCoverage keeps a CO whose questions carry no marks', () => {
  const coverage = makeCoverage();
  assert.deepEqual(coverage.byCo.map((c) => c.co), ['CO1', 'CO2', 'CO3', 'CO4']);
  assert.deepEqual(coverage.byCo.map((c) => c.answerableMarks), [12, 12, 3, 3]);
  assert.deepEqual(coverage.uncoveredCos.map((c) => c.co), []);
});

/* ------------------------------------------------------------------ */
/* computeBloomCheck                                                    */
/* ------------------------------------------------------------------ */

test('computeBloomCheck classifies match, above, below and unknown', () => {
  const coverage = makeCoverage();
  const check = computeBloomCheck(coverage, makeReference());
  const byId = new Map(check.rows.map((r) => [r.questionId, r]));

  assert.equal(byId.get('A1').status, 'match'); // K1 against CO1 (K1)
  assert.equal(byId.get('A2').status, 'above'); // 'kl3' -> K3 against CO2 (K2)
  assert.equal(byId.get('A3').status, 'below'); // K1 against CO3 (K3)
  assert.equal(byId.get('A4').status, 'above'); // K5 against CO4 (K4)
  assert.equal(byId.get('B1b').status, 'match');

  assert.equal(byId.get('A2').assessed, 'K3'); // normalised by computeCoverage
  assert.equal(byId.get('A2').coBloom, 'K2');
  assert.equal(byId.get('A4').delta, 1);
});

test('computeBloomCheck marks a question with no assessed Bloom as unknown', () => {
  const coverage = makeCoverage();
  const check = computeBloomCheck(coverage, makeReference());
  const byId = new Map(check.rows.map((r) => [r.questionId, r]));

  const noBloom = byId.get('B2a');
  assert.equal(noBloom.assessed, null);
  assert.equal(noBloom.co, 'CO2');
  assert.equal(noBloom.coBloom, null);
  assert.equal(noBloom.status, 'unknown');
  // The early "unknown" row omits the delta field entirely rather than
  // setting it to null.
  assert.equal(noBloom.delta, undefined);
});

test('computeBloomCheck marks a question with no CO as unknown', () => {
  const check = computeBloomCheck(makeCoverage(), makeReference());
  const byId = new Map(check.rows.map((r) => [r.questionId, r]));
  assert.equal(byId.get('B2b').co, null);
  assert.equal(byId.get('B2b').status, 'unknown');
});

test('computeBloomCheck separates mismatches from unknowns', () => {
  const check = computeBloomCheck(makeCoverage(), makeReference());
  assert.deepEqual(check.mismatches.map((r) => r.questionId).sort(), ['A2', 'A3', 'A4', 'B1a']);
  assert.ok(check.mismatches.every((r) => r.status === 'above' || r.status === 'below'));
  assert.deepEqual(check.unknown.map((r) => r.questionId).sort(), ['B2a', 'B2b']);
});

/* ------------------------------------------------------------------ */
/* computeHotspots                                                      */
/* ------------------------------------------------------------------ */

test('computeHotspots flags a module whose observed share beats the expected share', () => {
  const hotspots = computeHotspots(makeCoverage());
  const module1 = hotspots.find((h) => h.module === 1);
  assert.ok(module1, 'module 1 is a hotspot');
  assert.equal(module1.observedPercent, 40);
  assert.equal(module1.expectedPercent, 25);
  assert.equal(module1.delta, 15);
  assert.equal(module1.direction, 'over');

  const module3 = hotspots.find((h) => h.module === 3);
  assert.equal(module3.direction, 'under');
  assert.equal(module3.delta, -15);
});

test('computeHotspots does not flag a balanced module', () => {
  const balanced = makeBalancedCoverage();
  assert.deepEqual(balanced.byModule.map((m) => m.percent), [25, 25, 25, 25]);
  assert.deepEqual(balanced.byModule.map((m) => m.delta), [0, 0, 0, 0]);
  assert.deepEqual(computeHotspots(balanced), []);
});

test('computeHotspots honours a custom threshold', () => {
  // Every delta on the main fixture is exactly 15 points.
  assert.equal(computeHotspots(makeCoverage(), 15).length, 4);
  assert.deepEqual(computeHotspots(makeCoverage(), 16), []);
});

test('computeHotspots sorts the worst deviation first', () => {
  const hotspots = computeHotspots(makeCoverage());
  const deltas = hotspots.map((h) => Math.abs(h.delta));
  assert.deepEqual(deltas, [...deltas].sort((a, b) => b - a));
});

/* ------------------------------------------------------------------ */
/* buildReference                                                       */
/* ------------------------------------------------------------------ */

test('buildReference restricts modules and COs to the declared scope', () => {
  const reference = buildReference({ syllabus: makeSyllabus(), scope: { modulesInScope: [2, 3] } });
  assert.deepEqual(reference.inScopeNumbers, [2, 3]);
  assert.deepEqual(reference.modules.map((m) => m.number), [2, 3]);
  assert.deepEqual(reference.courseOutcomes.map((c) => c.id), ['CO2', 'CO3']);
  assert.deepEqual([...reference.moduleTopicIds].sort(), ['2.1', '2.2', '3.1', '3.2']);
  assert.equal(reference.topicIndex.get('2.1').module, 2);
  assert.equal(reference.moduleByNumber.get(3).title, 'Module 3');
});

test('buildReference uses every module when no scope is declared', () => {
  const reference = buildReference({ syllabus: makeSyllabus(), scope: {} });
  assert.deepEqual(reference.inScopeNumbers, [1, 2, 3, 4]);
  assert.deepEqual(reference.courseOutcomes.map((c) => c.id), ['CO1', 'CO2', 'CO3', 'CO4']);
});

/* ------------------------------------------------------------------ */
/* applyRewrite                                                         */
/* ------------------------------------------------------------------ */

test('applyRewrite sets rewritten, preserves originalText and does not mutate the input', () => {
  const segmentation = {
    questions: [{ id: 'A1', text: 'State the definition of recursion.', marks: 3 }],
    meta: { course: 'TST101' },
  };
  const snapshot = structuredClone(segmentation);

  const result = applyRewrite(segmentation, 'A1', 'Apply recursion to solve the Fibonacci problem.', {
    marks: 9,
    bloom: 'K4',
  });

  assert.equal(result.changed, true);
  assert.equal(result.question.rewritten, true);
  assert.equal(result.question.originalText, 'State the definition of recursion.');
  assert.equal(result.question.text, 'Apply recursion to solve the Fibonacci problem.');
  assert.equal(result.question.marks, 9);
  assert.equal(result.question.assessedBloomOverride, 'K4');

  // The working copy is new; the caller's segmentation is untouched.
  assert.notEqual(result.segmentation, segmentation);
  assert.deepEqual(segmentation, snapshot);
  assert.equal(segmentation.questions[0].rewritten, undefined);
  assert.equal(segmentation.questions[0].originalText, undefined);
});

test('applyRewrite keeps the first original text across repeated rewrites', () => {
  const segmentation = { questions: [{ id: 'A1', text: 'First text', marks: 3 }] };
  const first = applyRewrite(segmentation, 'A1', 'Second text');
  const second = applyRewrite(first.segmentation, 'A1', 'Third text');
  assert.equal(second.question.originalText, 'First text');
  assert.equal(second.question.text, 'Third text');
});

test('applyRewrite leaves the segmentation alone when the question id is unknown', () => {
  const segmentation = { questions: [{ id: 'A1', text: 'First text', marks: 3 }] };
  const result = applyRewrite(segmentation, 'ZZ', 'Nothing');
  assert.equal(result.changed, false);
  assert.deepEqual(result.segmentation, segmentation);
});
