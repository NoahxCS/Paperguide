/**
 * Minimal in-memory PDF generator for the pdf-text tests.
 *
 * There are no dependencies to build a PDF with, so this writes the raw bytes
 * by hand: one Helvetica (base-14) font resource, one content stream per page
 * drawing a single line of text, and a correct cross-reference table. The
 * output is deliberately tiny (a few hundred bytes) and completely
 * deterministic, so the tests need no binary fixture checked into the repo.
 *
 * Returns a plain Uint8Array (not a Buffer) so callers can wrap it themselves
 * when they want to exercise the Buffer-input path.
 */

/** Escape the characters that are special inside a PDF literal string. */
function escapeLiteral(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    // Non-ASCII would need a font encoding we do not set up; keep it ASCII.
    .replace(/[^\x20-\x7e]/g, '?');
}

/**
 * Build a one-or-more-page PDF whose pages each draw one line of text.
 *
 * @param {string[]} pageTexts one string per page
 * @returns {Uint8Array} the raw PDF bytes
 */
export function makePdf(pageTexts = ['Paperguide PDF test']) {
  const texts = pageTexts.length ? pageTexts : [''];
  const pageCount = texts.length;
  const fontId = 3 + pageCount * 2; // 1 catalog, 2 pages, then 2 objects per page
  const objects = [];

  const kids = [];
  for (let i = 0; i < pageCount; i++) kids.push(`${3 + i * 2} 0 R`);

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pageCount} >>`;

  for (let i = 0; i < pageCount; i++) {
    const pageId = 3 + i * 2;
    const contentId = pageId + 1;
    const stream = `BT /F1 12 Tf 72 720 Td (${escapeLiteral(texts[i])}) Tj ET`;
    objects[pageId] =
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  }

  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let body = '%PDF-1.4\n';
  const offsets = [];
  for (let id = 1; id <= fontId; id++) {
    offsets[id] = body.length;
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = body.length;
  let xref = `xref\n0 ${fontId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= fontId; id++) {
    xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${fontId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  // Every byte written above is ASCII, so string length === byte length.
  const out = new Uint8Array(body.length + xref.length + trailer.length);
  const all = body + xref + trailer;
  for (let i = 0; i < all.length; i++) out[i] = all.charCodeAt(i) & 0xff;
  return out;
}

export default makePdf;
