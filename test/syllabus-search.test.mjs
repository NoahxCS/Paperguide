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
  parseBing,
  decodeBingHref,
  tokenHits,
  hasSyllabusSignal,
  keepWebResult,
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

/* ------------------------------------------------------------------ Bing */

/** Build a Bing-shaped result page whose redirects encode the given URLs. */
function bingPage(entries) {
  const block = ({ title, url, snippet }) => {
    const encoded = Buffer.from(url).toString('base64url');
    const href = `https://www.bing.com/ck/a?!&amp;&amp;p=deadbeef&amp;u=a1${encoded}&amp;nt=1`;
    return `<li class="b_algo"><h2><a href="${href}">${title}</a></h2><div><p class="b_lineclamp">${snippet}</p></div></li>`;
  };
  return `<html><body><ol id="b_results">${entries.map(block).join('')}</ol></body></html>`;
}

test('decodeBingHref unwraps a Bing redirect into the real URL', () => {
  const real = 'https://ktu.notesundo.in/syllabus/2024/cse/s3';
  const wrapped = `<a href="https://www.bing.com/ck/a?u=a1${Buffer.from(real).toString('base64url')}&nt=1">`;
  assert.equal(decodeBingHref(wrapped), real);
});

test('decodeBingHref passes a plain URL straight through', () => {
  assert.equal(decodeBingHref('https://www.ktunotes.in/syllabus/'), 'https://www.ktunotes.in/syllabus/');
});

test('decodeBingHref returns null when it cannot recover a URL', () => {
  assert.equal(decodeBingHref('https://www.bing.com/ck/a?p=notbase64'), null);
  assert.equal(decodeBingHref('javascript:void(0)'), null);
});

test('parseBing reads titles, real URLs and snippets', () => {
  const html = bingPage([
    { title: 'KTU S3 CSE Syllabus 2024 Scheme', url: 'https://www.ktunotes.in/ktu-s3-cse-syllabus-2024-scheme/', snippet: 'All subjects with modules and course outcomes.' },
    { title: 'PCECT302 Solid State Devices', url: 'https://ktu.notesundo.in/syllabus/2024/ece/s3/solid-state-devices', snippet: 'Syllabus PDF.' },
  ]);
  const results = parseBing(html);
  assert.equal(results.length, 2);
  assert.equal(results[0].url, 'https://www.ktunotes.in/ktu-s3-cse-syllabus-2024-scheme/');
  assert.match(results[0].title, /Syllabus 2024 Scheme/);
  assert.match(results[0].snippet, /course outcomes/);
  assert.equal(results[1].url, 'https://ktu.notesundo.in/syllabus/2024/ece/s3/solid-state-devices');
});

test('parseBing ignores markup that is not an organic result', () => {
  assert.deepEqual(parseBing('<html><body><p>No results found.</p></body></html>'), []);
  assert.deepEqual(parseBing(''), []);
});

/* ------------------------------------------------- web-result relevance */

test('hasSyllabusSignal recognises syllabus and curriculum pages', () => {
  assert.ok(hasSyllabusSignal({ title: 'KTU S3 CSE Syllabus', url: 'https://x.test/a' }));
  assert.ok(hasSyllabusSignal({ title: 'Second year', url: 'https://ktu.edu.in/academics/branchcurriculum/hardcoded-btech' }));
  assert.ok(hasSyllabusSignal({ title: 'Data Structures question paper 2024', url: 'https://x.test/qp' }));
  assert.equal(hasSyllabusSignal({ title: 'Solid State Chemistry', url: 'https://www.geeksforgeeks.org/chemistry/solid-state-chemistry/' }), false);
});

test('keepWebResult drops filler that merely shares a word with the query', () => {
  const tokens = tokenize('Solid State Devices KTU syllabus');
  // The real source page, offered by the bundled index, would not go through
  // this filter, but a mirror page like this must survive it.
  assert.ok(keepWebResult({ title: 'PCECT302 Solid State Devices Syllabus', url: 'https://ktu.notesundo.in/syllabus/2024/ece/s3/solid-state-devices', score: 0.42 }, tokens));
  // Search-engine filler that happens to contain the words.
  assert.equal(
    keepWebResult({ title: 'Solid | Definition & Facts', url: 'https://www.britannica.com/science/solid-state-of-matter', score: 0.3 }, tokens),
    false
  );
});

test('keepWebResult rejects results that share nothing with the query', () => {
  const tokens = tokenize('UCEST105');
  assert.equal(
    keepWebResult({ title: 'Wireshark Display Filter protocol==TLSV1?', url: 'https://serverfault.com/questions/216814/x', score: 0.05 }, tokens),
    false
  );
});

test('keepWebResult honours the score floor', () => {
  const tokens = tokenize('Theory of Computation');
  assert.equal(keepWebResult({ title: 'Theory of Computation Syllabus', url: 'https://x.test/syllabus', score: 0.1 }, tokens), false);
  assert.ok(keepWebResult({ title: 'Theory of Computation Syllabus', url: 'https://x.test/syllabus', score: 0.5 }, tokens));
});

test('tokenHits only counts meaningful tokens', () => {
  const tokens = ['data', 'structures', 'algorithms'];
  assert.equal(tokenHits({ title: 'Data Structures and Algorithms', url: 'https://x.test/' }, tokens), 3);
  assert.equal(tokenHits({ title: 'Data', url: 'https://x.test/' }, tokens), 1);
  assert.equal(tokenHits({ title: 'Unrelated', url: 'https://x.test/' }, tokens), 0);
});
