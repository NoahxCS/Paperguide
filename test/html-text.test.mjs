/**
 * Tests for server/html-text.mjs - regex-based HTML to text and link extraction.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { htmlToText, extractLinks, pickDocumentLinks, htmlTitle, decodeEntities } from '../server/html-text.mjs';

/** A real-ish KTU course page: headings, a module table, entities and links. */
const KTU_PAGE = `<!doctype html>
<html>
<head>
  <title>UCEST105 Algorithmic Thinking with Python &amp; Syllabus &#8377;</title>
  <style>.hidden { display: none; }</style>
  <script>window.__KTU__ = { scheme: "2024" };</script>
</head>
<body>
  <!-- KTU header navigation, ignored -->
  <h1>UCEST105 Algorithmic Thinking with Python</h1>
  <p>Max. Marks: 60 &nbsp;&#8377; 0 &amp; no change</p>
  <table>
    <tr><th>Module</th><th>Hours</th></tr>
    <tr><td>Module 1</td><td>7</td></tr>
    <tr><td>Module 2</td><td>9</td></tr>
  </table>
  <ul>
    <li>Pseudocode &#x20B9; &#38;</li>
  </ul>
  <p>Download <a href="/api/download/syllabus.pdf">the syllabus PDF</a>.</p>
</body>
</html>`;

const LINKS_PAGE = `<div>
  <a href="/syllabus">Syllabus</a>
  <a href="ucest105.pdf">Download PDF</a>
  <a href="javascript:void(0)">Do nothing</a>
  <a href="mailto:help@ktu.edu.in">Mail the office</a>
  <a href="#top">Back to top</a>
  <a href="https://ktu.edu.in/syllabus">Syllabus</a>
  <a href="https://ktu.edu.in/notes.pdf#page=2">Notes</a>
  <a href="https://ktu.edu.in/other">Other page</a>
</div>`;

/* ------------------------------------------------------------------ */
/* htmlToText                                                           */
/* ------------------------------------------------------------------ */

test('htmlToText strips script, style, comments and the head block', () => {
  const text = htmlToText(KTU_PAGE);
  assert.equal(text.includes('__KTU__'), false);
  assert.equal(text.includes('display: none'), false);
  assert.equal(text.includes('KTU header navigation'), false);
  // <head> is removed wholesale, so the <title> text is not part of the body text.
  assert.equal(text.includes('<'), false);
});

test('htmlToText keeps heading and paragraph text', () => {
  const text = htmlToText(KTU_PAGE);
  assert.ok(text.includes('UCEST105 Algorithmic Thinking with Python'));
  assert.ok(text.includes('Max. Marks: 60'));
});

test('htmlToText puts table cells on one line, whitespace-separated', () => {
  const text = htmlToText(KTU_PAGE);
  // NOTE (discrepancy with the brief): the module comment says cell boundaries
  // are kept as tabs, and </td>/</th> really are replaced with '\t', but the
  // whitespace-collapse step later in htmlToText (`[ \t\f\v\u00a0]+` -> ' ')
  // turns every tab into a single space before the function returns. So cells
  // come out on one line separated by spaces, never by a literal tab.
  assert.ok(text.includes('Module Hours\n\nModule 1 7\n\nModule 2 9'), text);
  assert.equal(text.includes('\t'), false);
});

test('htmlToText decodes named, decimal and hex entities', () => {
  const text = htmlToText(KTU_PAGE);
  assert.ok(text.includes('₹ 0 & no change'), text);
  assert.ok(text.includes('Pseudocode ₹ &'), text);
});

test('htmlToText collapses runs of blank lines and trims', () => {
  const text = htmlToText('<p>one</p>\n\n\n\n<p>two</p>');
  assert.equal(text, 'one\n\ntwo');
});

/* ------------------------------------------------------------------ */
/* decodeEntities                                                       */
/* ------------------------------------------------------------------ */

test('decodeEntities handles named entities', () => {
  assert.equal(decodeEntities('a &amp; b &lt;i&gt; &quot;q&quot; &apos;'), 'a & b <i> "q" \'');
});

test('decodeEntities handles decimal and hex numeric entities', () => {
  assert.equal(decodeEntities('&#8377; &#x20B9;'), '₹ ₹');
});

test('decodeEntities maps &nbsp; to a plain space', () => {
  // ENTITIES.nbsp is ' ' (U+0020), not U+00A0 - the whitespace collapse in
  // htmlToText is what makes this invisible either way.
  assert.equal(decodeEntities('a&nbsp;b'), 'a b');
  assert.equal(decodeEntities('a&nbsp;b').charCodeAt(1), 32);
});

test('decodeEntities leaves unknown entities untouched', () => {
  assert.equal(decodeEntities('&bogus; &unknownentity;'), '&bogus; &unknownentity;');
});

/* ------------------------------------------------------------------ */
/* extractLinks                                                         */
/* ------------------------------------------------------------------ */

test('extractLinks resolves relative URLs against the base', () => {
  const links = extractLinks(LINKS_PAGE, 'https://ktu.edu.in/courses/index.html');
  assert.deepEqual(links.map((l) => l.href), [
    'https://ktu.edu.in/syllabus',
    'https://ktu.edu.in/courses/ucest105.pdf',
    'https://ktu.edu.in/notes.pdf',
    'https://ktu.edu.in/other',
  ]);
});

test('extractLinks skips javascript:, mailto: and fragment-only hrefs', () => {
  const links = extractLinks(LINKS_PAGE, 'https://ktu.edu.in/courses/index.html');
  for (const link of links) {
    assert.equal(/^(?:javascript:|mailto:|tel:|#)/i.test(link.href), false);
  }
  assert.equal(links.some((l) => l.text === 'Do nothing'), false);
  assert.equal(links.some((l) => l.text === 'Mail the office'), false);
  assert.equal(links.some((l) => l.text === 'Back to top'), false);
});

test('extractLinks deduplicates by URL with the fragment removed', () => {
  const links = extractLinks(LINKS_PAGE, 'https://ktu.edu.in/courses/index.html');
  assert.equal(links.length, 4);
  assert.equal(links.filter((l) => l.href === 'https://ktu.edu.in/syllabus').length, 1);
  // .../notes.pdf#page=2 is stored without its fragment.
  assert.equal(links.some((l) => l.href === 'https://ktu.edu.in/notes.pdf'), true);
});

test('extractLinks carries the anchor text', () => {
  const links = extractLinks(LINKS_PAGE, 'https://ktu.edu.in/courses/index.html');
  const syllabus = links.find((l) => l.href === 'https://ktu.edu.in/syllabus');
  assert.equal(syllabus.text, 'Syllabus');
});

/* ------------------------------------------------------------------ */
/* pickDocumentLinks                                                    */
/* ------------------------------------------------------------------ */

test('pickDocumentLinks keeps .pdf links and drops unrelated ones', () => {
  const links = extractLinks(LINKS_PAGE, 'https://ktu.edu.in/courses/index.html');
  const kept = pickDocumentLinks(links);
  const hrefs = kept.map((l) => l.href);
  assert.ok(hrefs.includes('https://ktu.edu.in/courses/ucest105.pdf'));
  assert.ok(hrefs.includes('https://ktu.edu.in/notes.pdf'));
  assert.equal(hrefs.includes('https://ktu.edu.in/other'), false);
});

test('pickDocumentLinks also keeps non-PDF links whose text matches the pattern', () => {
  const links = extractLinks(LINKS_PAGE, 'https://ktu.edu.in/courses/index.html');
  const kept = pickDocumentLinks(links);
  assert.ok(kept.some((l) => l.href === 'https://ktu.edu.in/syllabus'));
});

test('pickDocumentLinks honours a custom pattern', () => {
  const links = [
    { href: 'https://ktu.edu.in/a.pdf', text: 'Download' },
    { href: 'https://ktu.edu.in/lab-manual', text: 'Lab manual' },
  ];
  const kept = pickDocumentLinks(links, { pattern: /lab\s*manual/i });
  // The .pdf test always applies; the pattern only replaces the text matcher.
  assert.deepEqual(kept.map((l) => l.href), ['https://ktu.edu.in/a.pdf', 'https://ktu.edu.in/lab-manual']);
});

/* ------------------------------------------------------------------ */
/* htmlTitle                                                            */
/* ------------------------------------------------------------------ */

test('htmlTitle extracts and decodes the title', () => {
  assert.equal(htmlTitle(KTU_PAGE), 'UCEST105 Algorithmic Thinking with Python & Syllabus ₹');
});

test('htmlTitle returns an empty string when there is no title', () => {
  assert.equal(htmlTitle('<p>no title here</p>'), '');
});
