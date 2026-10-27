/**
 * Server-side integration tests that need no network.
 *
 * searchSyllabus is called with remote: false, so only the bundled seed index
 * is consulted; the DuckDuckGo and ktu.edu.in layers are never reached.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { searchSyllabus, loadSeedIndex } from '../server/syllabus-search.mjs';

const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));

test('searchSyllabus(remote:false) returns the bundled UCEST105 candidate', async () => {
  const index = await loadSeedIndex(DATA_DIR);
  const result = await searchSyllabus({ query: 'UCEST105', index, remote: false });

  assert.equal(result.query, 'UCEST105');
  assert.deepEqual(result.codes, ['UCEST105']);
  assert.ok(result.tokens.includes('ucest105'));

  const hit = result.candidates.find((c) => c.courseCode === 'UCEST105');
  assert.ok(hit, `expected a UCEST105 candidate in ${JSON.stringify(result.candidates)}`);
  assert.equal(hit.provenance, 'bundled-index');
  assert.equal(hit.fromIndex, true);
  assert.match(hit.url, /^https?:\/\//);
  assert.match(hit.title, /^UCEST105 /);
  assert.equal(hit.score, 1);
  assert.equal(result.candidates[0].courseCode, 'UCEST105');
});

test('searchSyllabus(remote:false) only ever produces bundled-index candidates', async () => {
  const index = await loadSeedIndex(DATA_DIR);
  const result = await searchSyllabus({ query: 'UCEST105', index, remote: false });
  assert.deepEqual(result.sourcesTried, ['bundled-index']);
  assert.deepEqual(result.warnings, []);
  assert.ok(result.candidates.length > 0);
  assert.ok(result.candidates.every((c) => c.provenance === 'bundled-index'));
});

test('searchSyllabus(remote:false) matches a course by its title words', async () => {
  const index = await loadSeedIndex(DATA_DIR);
  const result = await searchSyllabus({ query: 'Algorithmic Thinking with Python', index, remote: false });
  assert.equal(result.candidates.length > 0, true);
  assert.equal(result.candidates[0].courseCode, 'UCEST105');
});

test('searchSyllabus(remote:false) honours the limit', async () => {
  const index = await loadSeedIndex(DATA_DIR);
  const result = await searchSyllabus({ query: 'UCEST105 GAMAT101 PCCST303', index, remote: false, limit: 2 });
  assert.equal(result.candidates.length, 2);
});

test('searchSyllabus(remote:false) returns no candidates for an unrelated query', async () => {
  const index = await loadSeedIndex(DATA_DIR);
  const result = await searchSyllabus({ query: 'quantum basket weaving', index, remote: false });
  assert.deepEqual(result.candidates, []);
  // The index was not empty, so there is no "index is empty" warning.
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.sourcesTried, ['bundled-index']);
});

test('searchSyllabus warns when the bundled index is empty', async () => {
  const result = await searchSyllabus({
    query: 'UCEST105',
    index: { scheme: 'KTU 2024', courses: [] },
    remote: false,
  });
  assert.deepEqual(result.candidates, []);
  assert.deepEqual(result.sourcesTried, []);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /bundled course index is empty/i);
});

test('searchSyllabus sorts candidates by descending score', async () => {
  const index = await loadSeedIndex(DATA_DIR);
  const result = await searchSyllabus({ query: 'UCEST105 GAMAT101', index, remote: false });
  const scores = result.candidates.map((c) => c.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});

/*
 * server/documents.mjs has no pure exports to test offline: its only export is
 * fetchDocument, which unconditionally calls fetchWithLimits (network), and the
 * helpers that would be worth unit-testing (looksLikePdf, decodeText) are
 * module-private. Rather than mock the network, this asserts the module's
 * surface so a new pure export is noticed, and the routing logic itself stays
 * covered indirectly by pdf-text.test.mjs (extractPdfText).
 */
test('server/documents.mjs exposes only the network-bound fetchDocument', async () => {
  const documents = await import('../server/documents.mjs');
  assert.deepEqual(Object.keys(documents), ['fetchDocument']);
  assert.equal(typeof documents.fetchDocument, 'function');
});
