/**
 * Tests for server/syllabus-search.mjs - pure helpers only (no network).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  tokenize,
  extractCodes,
  scoreCandidate,
  parseDuckDuckGo,
  loadSeedIndex,
} from '../server/syllabus-search.mjs';

const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));

/* ------------------------------------------------------------------ */
/* extractCodes                                                         */
/* ------------------------------------------------------------------ */

test('extractCodes finds real KTU 2024-scheme course codes', () => {
  const codes = extractCodes('GAMAT101 UCEST105 PCCST303 UCHUT346 PCECT302 PCXXT205 PEXXT41N');
  for (const expected of ['GAMAT101', 'UCEST105', 'PCCST303', 'UCHUT346', 'PCECT302', 'PCXXT205', 'PEXXT41N']) {
    assert.ok(codes.includes(expected), `expected ${expected} in ${JSON.stringify(codes)}`);
  }
});

test('extractCodes finds the wildcard form and the elective placeholder', () => {
  assert.deepEqual(extractCodes('PCXXT205'), ['PCXXT205']);
  assert.deepEqual(extractCodes('PEXXT41N'), ['PEXXT41N']);
});

test('extractCodes is case-insensitive', () => {
  assert.deepEqual(extractCodes('ucest105'), ['UCEST105']);
});

test('extractCodes does not return bare numbers from ordinary prose', () => {
  // "module 4 in scope, 60 marks" must not become a course code.
  const codes = extractCodes('module 4 in scope, 60 marks');
  assert.deepEqual(codes, []);
  assert.equal(codes.includes('123'), false);
  assert.equal(codes.includes('4'), false);
  assert.equal(codes.includes('60'), false);
});

/* ------------------------------------------------------------------ */
/* tokenize                                                             */
/* ------------------------------------------------------------------ */

test('tokenize drops stopwords such as ktu, syllabus, 2024 and pdf', () => {
  const tokens = tokenize('KTU 2024 syllabus pdf UCEST105 Algorithmic Thinking');
  assert.deepEqual(tokens, ['ucest105', 'algorithmic', 'thinking']);
});

test('tokenize lowercases, strips punctuation and drops one-character words', () => {
  assert.deepEqual(tokenize('Module-4: in scope, 60 marks!'), ['module-4', 'scope', '60', 'marks']);
});

test('tokenize tolerates nullish input', () => {
  assert.deepEqual(tokenize(undefined), []);
  assert.deepEqual(tokenize(null), []);
});

/* ------------------------------------------------------------------ */
/* scoreCandidate                                                       */
/* ------------------------------------------------------------------ */

const TOKENS = tokenize('UCEST105 KTU 2024 syllabus pdf');
const CODES = extractCodes('UCEST105');

test('scoreCandidate ranks an official ktu.edu.in PDF above a third-party page', () => {
  const official = scoreCandidate(
    {
      title: 'UCEST105 Algorithmic Thinking with Python - KTU 2024 scheme syllabus',
      url: 'https://ktu.edu.in/syllabus/ucest105.pdf',
      text: 'Max. Marks 60, Duration 2 hours 30 minutes',
    },
    TOKENS,
    CODES
  );
  const thirdParty = scoreCandidate(
    { title: 'Unrelated blog post', url: 'https://example.com/post', text: 'nothing to see' },
    TOKENS,
    CODES
  );
  assert.ok(official > thirdParty, `${official} should beat ${thirdParty}`);
});

test('scoreCandidate ranks a candidate with the exact course code above one without', () => {
  const withCode = scoreCandidate({ title: 'UCEST105 notes', url: 'https://example.com/a' }, TOKENS, CODES);
  const withoutCode = scoreCandidate({ title: 'Python notes', url: 'https://example.com/b' }, TOKENS, CODES);
  assert.ok(withCode > withoutCode, `${withCode} should beat ${withoutCode}`);
});

test('scoreCandidate never exceeds 1', () => {
  const score = scoreCandidate(
    {
      title: 'UCEST105 KTU 2024 syllabus pdf model question paper pattern',
      url: 'https://ktu.edu.in/ucest105.pdf',
      text: 'ucest105 ktu 2024 syllabus',
    },
    TOKENS,
    CODES
  );
  assert.equal(score, 1);
});

/* ------------------------------------------------------------------ */
/* parseDuckDuckGo                                                      */
/* ------------------------------------------------------------------ */

const DDG_FIXTURE = `<html><body>
<div class="result results_links results_links_deep web-result">
  <div class="links_main links_deep result__body">
    <h2 class="result__title"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fktu.edu.in%2Fsyllabus%2FUCEST105.pdf&amp;rut=abc">UCEST105 Algorithmic Thinking with Python &amp; Syllabus</a></h2>
    <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fktu.edu.in">Official KTU 2024 scheme syllabus PDF for <b>UCEST105</b>.</a>
  </div>
</div>
<div class="result results_links results_links_deep web-result">
  <div class="links_main links_deep result__body">
    <h2 class="result__title"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fnotes%3Fid%3D1%26x%3D2">Third party notes</a></h2>
    <div class="result__snippet">Some snippet text here.</div>
  </div>
</div>
</body></html>`;

test('parseDuckDuckGo decodes /l/?uddg= redirects into real target URLs', () => {
  const results = parseDuckDuckGo(DDG_FIXTURE);
  assert.equal(results.length, 2);
  assert.equal(results[0].url, 'https://ktu.edu.in/syllabus/UCEST105.pdf');
  // The second redirect carries percent-encoded query parameters.
  assert.equal(results[1].url, 'https://example.com/notes?id=1&x=2');
});

test('parseDuckDuckGo extracts titles and snippets', () => {
  const results = parseDuckDuckGo(DDG_FIXTURE);
  assert.equal(results[0].title, 'UCEST105 Algorithmic Thinking with Python & Syllabus');
  assert.ok(results[0].snippet.includes('Official KTU 2024 scheme syllabus PDF for UCEST105'));
  assert.equal(results[1].title, 'Third party notes');
  assert.equal(results[1].snippet, 'Some snippet text here.');
});

test('parseDuckDuckGo skips a result whose redirect target is not http(s)', () => {
  const html = `<div class="result__body">
    <a class="result__a" href="javascript:alert(1)">Nope</a>
  </div>`;
  assert.deepEqual(parseDuckDuckGo(html), []);
});

test('parseDuckDuckGo returns [] for an empty page', () => {
  assert.deepEqual(parseDuckDuckGo('<html><body>no results</body></html>'), []);
});

/* ------------------------------------------------------------------ */
/* loadSeedIndex                                                        */
/* ------------------------------------------------------------------ */

test('loadSeedIndex reads the bundled 2024-scheme index', async () => {
  const index = await loadSeedIndex(DATA_DIR);
  assert.equal(index.scheme, 'KTU 2024');
  assert.ok(index.courses.length >= 6, `expected >= 6 courses, got ${index.courses.length}`);
  for (const course of index.courses) {
    assert.ok(course.code, 'course has a code');
    assert.ok(course.title, `${course.code} has a title`);
    assert.ok(course.modules.length > 0, `${course.code} has modules`);
    assert.ok(course.courseOutcomes.length > 0, `${course.code} has course outcomes`);
  }
});

test('loadSeedIndex includes UCEST105 with modules and course outcomes', async () => {
  const index = await loadSeedIndex(DATA_DIR);
  const course = index.courses.find((c) => c.code === 'UCEST105');
  assert.ok(course, 'UCEST105 is in the bundled index');
  assert.equal(course.modules.length, 4);
  assert.ok(course.modules.every((m) => m.topics.length > 0));
  assert.ok(course.courseOutcomes.every((c) => c.co && c.bloom));
});

test('loadSeedIndex returns an empty index for a missing directory instead of throwing', async () => {
  const index = await loadSeedIndex(fileURLToPath(new URL('./no-such-directory/', import.meta.url)));
  assert.deepEqual(index, { scheme: 'KTU 2024', courses: [], notes: [] });
});

test('loadSeedIndex returns an empty index for a directory without the index file', async () => {
  // test/fixtures/ exists but holds no ktu-2024-index.json.
  const index = await loadSeedIndex(fileURLToPath(new URL('./fixtures/', import.meta.url)));
  assert.deepEqual(index.courses, []);
});
