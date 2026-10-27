/**
 * Tests for server/pdf-text.mjs - server-side PDF text extraction.
 *
 * The PDFs are generated in memory by test/fixtures/make-pdf.mjs, so no binary
 * fixtures are checked in and nothing touches the network. pdf.js prints
 * "Cannot polyfill DOMMatrix / Path2D" warnings on Node; they are expected.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { extractPdfText } from '../server/pdf-text.mjs';
import { makePdf } from './fixtures/make-pdf.mjs';

const PDF_LINE = 'BT /F1 12 Tf 72 720 Td (Paperguide PDF test) Tj ET';

test('the generated fixture is a real one-page PDF with the expected content stream', () => {
  const raw = Buffer.from(makePdf(['Paperguide PDF test'])).toString('latin1');
  assert.ok(raw.startsWith('%PDF-1.4'));
  assert.ok(raw.includes(PDF_LINE), 'content stream is present verbatim');
  assert.ok(raw.includes('/BaseFont /Helvetica'));
  assert.ok(raw.includes('\nxref\n'));
  assert.ok(raw.includes('startxref'));
  assert.ok(raw.trimEnd().endsWith('%%EOF'));
});

test('extractPdfText reads a one-page PDF', async () => {
  const result = await extractPdfText(makePdf(['Paperguide PDF test']));
  assert.equal(result.numPages, 1);
  assert.equal(result.pages.length, 1);
  assert.ok(result.text.includes('Paperguide PDF test'), result.text);
});

test('extractPdfText reports hasTextLayer false for a single short line', async () => {
  // NOTE (discrepancy with the brief): hasTextLayer is not simply "text was
  // found" - pdf-text.mjs calls a page text-layered only when it yields more
  // than 40 non-whitespace characters. "Paperguide PDF test" is 18, so the
  // exact content stream the brief asks for correctly reports false; the test
  // below shows a longer page reporting true.
  const result = await extractPdfText(makePdf(['Paperguide PDF test']));
  assert.equal(result.hasTextLayer, false);
  assert.equal(result.charsPerPage, 17); // 19 characters minus the two spaces
});

test('extractPdfText reports hasTextLayer true once a page clears the threshold', async () => {
  const longLine = 'Paperguide PDF test with enough text on the page to clear the text layer threshold.';
  const result = await extractPdfText(makePdf([longLine]));
  assert.equal(result.numPages, 1);
  assert.equal(result.hasTextLayer, true);
  assert.ok(result.text.includes('Paperguide PDF test'));
});

test('extractPdfText reads a two-page PDF and returns both pages', async () => {
  const result = await extractPdfText(makePdf(['First page alpha', 'Second page beta']));
  assert.equal(result.numPages, 2);
  assert.equal(result.pages.length, 2);
  assert.ok(result.text.includes('First page alpha'), result.text);
  assert.ok(result.text.includes('Second page beta'), result.text);
});

test('extractPdfText accepts a Node Buffer without throwing', async () => {
  // Regression guard: pdf.js rejects a Buffer specifically, so pdf-text.mjs
  // re-wraps it as a plain Uint8Array view before handing it over.
  const buffer = Buffer.from(makePdf(['Paperguide PDF test']));
  assert.equal(Buffer.isBuffer(buffer), true);
  const result = await extractPdfText(buffer);
  assert.equal(result.numPages, 1);
  assert.ok(result.text.includes('Paperguide PDF test'));
});

test('extractPdfText rejects garbage input with code PDF_UNREADABLE', async () => {
  const garbage = new TextEncoder().encode('this is definitely not a pdf file');
  await assert.rejects(
    () => extractPdfText(garbage),
    (err) => {
      assert.equal(err.code, 'PDF_UNREADABLE');
      assert.match(err.message, /Could not read PDF/);
      return true;
    }
  );
});

test('extractPdfText rejects an empty buffer with code PDF_UNREADABLE', async () => {
  await assert.rejects(
    () => extractPdfText(new Uint8Array(0)),
    (err) => {
      assert.equal(err.code, 'PDF_UNREADABLE');
      return true;
    }
  );
});
