/**
 * Tests for public/core/syllabus.js - Bloom normalisation, deterministic
 * pattern detection and bundled-index conversion.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  normaliseBloom,
  bloomName,
  detectPatternFromText,
  normaliseSyllabus,
  syllabusFromIndexCourse,
  resolvePattern,
  describePattern,
} from '../public/core/syllabus.js';

const INDEX_PATH = new URL('../data/ktu-2024-index.json', import.meta.url);

/** Realistic KTU 2024-scheme ESE block as printed inside a syllabus. */
const KTU_2024_TEXT = `KTU 2024 Scheme - UCEST105 Algorithmic Thinking with Python
Max. Marks: 60
Duration: 2 hours 30 minutes
Part A: Answer all questions. Each question carries 3 marks.
Part B: Answer any one full question from each module, each question carries 9 marks.`;

/* ------------------------------------------------------------------ */
/* normaliseBloom / bloomName                                           */
/* ------------------------------------------------------------------ */

test('normaliseBloom maps every printed form of a level 3 outcome to K3', () => {
  for (const value of ['KL3', 'K3', 'k3', 'L3', 'Level 3', '3', 'Apply', 'apply']) {
    assert.equal(normaliseBloom(value), 'K3', `expected K3 for ${JSON.stringify(value)}`);
  }
});

test('normaliseBloom returns null for junk', () => {
  for (const value of ['', '   ', 'nonsense', null, undefined, 0, 'K9', 'Level 7']) {
    assert.equal(normaliseBloom(value), null, `expected null for ${JSON.stringify(value)}`);
  }
});

test('normaliseBloom keeps the other levels', () => {
  assert.equal(normaliseBloom('K1'), 'K1');
  assert.equal(normaliseBloom('Remember'), 'K1');
  assert.equal(normaliseBloom('kl6'), 'K6');
  assert.equal(normaliseBloom('Create'), 'K6');
});

test('bloomName returns the taxonomy name for a level', () => {
  assert.equal(bloomName('K3'), 'Apply');
  assert.equal(bloomName('apply'), 'Apply');
  assert.equal(bloomName('KL1'), 'Remember');
  assert.equal(bloomName('nonsense'), null);
});

/* ------------------------------------------------------------------ */
/* detectPatternFromText                                                */
/* ------------------------------------------------------------------ */

test('detectPatternFromText recognises the KTU 2024-scheme shape', () => {
  const detected = detectPatternFromText(KTU_2024_TEXT);
  assert.equal(detected.source, 'detected-in-text');
  assert.equal(detected.parts.length, 2);

  const [partA, partB] = detected.parts;
  assert.equal(partA.name, 'Part A');
  assert.equal(partA.marksPerQuestion, 3);
  assert.equal(partA.totalMarks, 24);
  assert.equal(partA.choice, 'none');

  assert.equal(partB.name, 'Part B');
  assert.equal(partB.marksPerQuestion, 9);
  assert.equal(partB.totalMarks, 36);
  assert.equal(partB.choice, 'either-or');
});

test('detectPatternFromText returns null for unrelated text', () => {
  assert.equal(detectPatternFromText('The quick brown fox jumps over the lazy dog.'), null);
  assert.equal(detectPatternFromText(''), null);
  assert.equal(detectPatternFromText(null), null);
});

test('detectPatternFromText keeps the header but leaves the parts empty when only marks are stated', () => {
  const detected = detectPatternFromText('Max. Marks: 100');
  assert.equal(detected.source, 'detected-in-text');
  assert.deepEqual(detected.parts, []);
  assert.match(detected.note, /Only the header was detected/);
});

/* ------------------------------------------------------------------ */
/* normaliseSyllabus                                                    */
/* ------------------------------------------------------------------ */

test('normaliseSyllabus normalises module and CO ids, sorts and trims topics', () => {
  const syllabus = normaliseSyllabus({
    courseOutcomes: [{ id: 'co 2', statement: '  Do a thing  ', bloom: 'kl3' }],
    modules: [
      { number: 2, title: 'Second', topics: [{ text: '  Topic A  ' }, { text: '   ' }] },
      { number: 1, title: 'First', topics: [{ id: 'x.1', text: 'Topic B' }] },
    ],
  });
  assert.deepEqual(syllabus.modules.map((m) => m.number), [1, 2]);
  // A topic that already carries an id keeps it.
  assert.deepEqual(syllabus.modules[0].topics, [{ id: 'x.1', text: 'Topic B' }]);
  // Blank topics are dropped; the surviving one gets a "<module>.<n>" id.
  assert.deepEqual(syllabus.modules[1].topics, [{ id: '2.1', text: 'Topic A' }]);
  assert.deepEqual(syllabus.courseOutcomes[0], {
    id: 'CO2',
    statement: 'Do a thing',
    bloom: 'K3',
    bloomRaw: 'kl3',
    mapsTo: [],
  });
});

test('normaliseSyllabus drops modules with no title and no topics', () => {
  const syllabus = normaliseSyllabus({ modules: [{ number: 1 }, { number: 2, title: 'Kept', topics: [] }] });
  assert.deepEqual(syllabus.modules.map((m) => m.title), ['Kept']);
});

/* ------------------------------------------------------------------ */
/* syllabusFromIndexCourse                                              */
/* ------------------------------------------------------------------ */

test('syllabusFromIndexCourse converts the bundled UCEST105 course', async () => {
  const index = JSON.parse(await fs.readFile(INDEX_PATH, 'utf8'));
  const course = index.courses[0];
  assert.equal(course.code, 'UCEST105', 'fixture assumption: courses[0] is UCEST105');

  const syllabus = syllabusFromIndexCourse(course);

  assert.equal(syllabus.courseCode, 'UCEST105');
  assert.equal(syllabus.scheme, 'KTU 2024');
  assert.equal(syllabus.semester, '1');

  // 4 modules, each with a non-empty topic list whose ids are "<module>.<n>".
  assert.equal(syllabus.modules.length, 4);
  assert.deepEqual(syllabus.modules.map((m) => m.number), [1, 2, 3, 4]);
  for (const module of syllabus.modules) {
    assert.ok(module.topics.length > 0, `module ${module.number} has topics`);
    assert.ok(module.topics.every((t) => t.id && t.text));
  }
  assert.equal(syllabus.modules[0].topics[0].id, '1.1');

  // The CO table carries normalised Bloom codes.
  assert.ok(syllabus.courseOutcomes.length > 0);
  for (const co of syllabus.courseOutcomes) {
    assert.match(co.id, /^CO\d+$/);
    assert.match(co.bloom, /^K[1-6]$/, `${co.id} bloom ${co.bloom}`);
    assert.ok(co.bloomRaw);
    assert.ok(co.statement.length > 0);
  }

  assert.equal(syllabus.credits.credits, 4);
  assert.equal(syllabus.credits.l, 3);
  assert.equal(syllabus.credits.p, 2);

  assert.equal(syllabus.paperPattern.length, 2);
  assert.deepEqual(syllabus.paperPattern.map((p) => p.totalMarks), [24, 36]);
  assert.deepEqual(syllabus.paperPattern.map((p) => p.choice), ['none', 'either-or']);

  assert.equal(syllabus.assessment.eseMarks, 60);
  assert.equal(syllabus.assessment.eseDurationMinutes, 150);
  assert.equal(syllabus.verified, true);
  assert.equal(syllabus.sourceKind, 'bundled-index');
  assert.deepEqual(syllabus.notFound, []);
});

test('syllabusFromIndexCourse labels the origin and flags a missing exam pattern', () => {
  const syllabus = syllabusFromIndexCourse(
    { code: 'XAAAT101', title: 'No pattern here', modules: [{ no: 1, title: 'M', topics: ['t'] }] },
    { origin: 'teacher-upload' }
  );
  assert.equal(syllabus.origin, 'teacher-upload');
  assert.deepEqual(syllabus.paperPattern, []);
  assert.equal(syllabus.patternSource, null);
  assert.deepEqual(syllabus.notFound, ['paper pattern']);
});

/* ------------------------------------------------------------------ */
/* resolvePattern                                                       */
/* ------------------------------------------------------------------ */

test('resolvePattern prefers a syllabus pattern over a teacher pattern', () => {
  const resolved = resolvePattern({
    syllabusPattern: { parts: [{ name: 'Part A' }] },
    teacherPattern: { parts: [{ name: 'Teacher A' }] },
  });
  assert.equal(resolved.reason, 'syllabus');
  assert.equal(resolved.pattern.source, 'syllabus');
  assert.equal(resolved.pattern.parts[0].name, 'Part A');
});

test('resolvePattern falls back to the teacher pattern when the syllabus has none', () => {
  const resolved = resolvePattern({
    syllabusPattern: { parts: [] },
    teacherPattern: { parts: [{ name: 'Teacher A' }], note: 'as typed' },
  });
  assert.equal(resolved.reason, 'teacher');
  assert.equal(resolved.pattern.source, 'teacher');
  assert.equal(resolved.pattern.note, 'as typed');
});

test('resolvePattern detects the pattern from the paper text when neither is given', () => {
  const resolved = resolvePattern({ paperText: KTU_2024_TEXT });
  assert.equal(resolved.reason, 'detected-from-paper');
  assert.equal(resolved.pattern.parts.length, 2);
});

test('resolvePattern prefers a caller-supplied detected pattern over re-detecting', () => {
  const resolved = resolvePattern({
    paperText: KTU_2024_TEXT,
    detectedFromPaper: { source: 'detected-in-text', parts: [{ name: 'Mine' }] },
  });
  assert.equal(resolved.reason, 'detected-from-paper');
  assert.equal(resolved.pattern.parts[0].name, 'Mine');
});

test('resolvePattern falls back to the KTU 2024 default when there is neither', () => {
  const resolved = resolvePattern({});
  assert.equal(resolved.reason, 'ktu-default');
  assert.equal(resolved.pattern.source, 'ktu-2024-default');
  assert.deepEqual(resolved.pattern.parts.map((p) => p.totalMarks), [24, 36]);
  assert.deepEqual(resolved.pattern.parts.map((p) => p.choice), ['none', 'either-or']);
});

/* ------------------------------------------------------------------ */
/* describePattern                                                      */
/* ------------------------------------------------------------------ */

test('describePattern renders a readable one-liner', () => {
  const described = describePattern([
    { name: 'Part A', questionCount: 8, marksPerQuestion: 3, totalMarks: 24, choice: 'none' },
    { name: 'Part B', questionCount: 4, marksPerQuestion: 9, totalMarks: 36, choice: 'either-or' },
  ]);
  assert.equal(
    described,
    'Part A, 8 questions, 3 marks each, 24 total \u00b7 Part B, 4 questions, 9 marks each, 36 total, either/or choice'
  );
});

test('describePattern says "not stated" when there is no pattern', () => {
  assert.equal(describePattern([]), 'not stated');
  assert.equal(describePattern(null), 'not stated');
});
