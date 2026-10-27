/**
 * Server-side PDF text extraction.
 *
 * Digital (text-layer) PDFs are the common case for official KTU syllabus and
 * question-paper PDFs. Rather than hand-rolling a PDF parser, we reuse the
 * vendored Node build of pdf.js, which gives correctly ordered text with
 * proper ToUnicode handling for subset fonts.
 *
 * Scanned PDFs produce little or no text here; the caller detects that and
 * routes the file to OCR instead.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const NODE_VENDOR_DIR = path.resolve(HERE, '..', 'vendor', 'pdfjs-node');

let pdfjsPromise = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    const entry = pathToFileURL(path.join(NODE_VENDOR_DIR, 'pdf.mjs')).href;
    pdfjsPromise = import(entry).then((mod) => {
      const lib = mod.default ?? mod;
      // Force the in-process "fake worker" so nothing needs a browser worker.
      try {
        lib.GlobalWorkerOptions.workerSrc = pathToFileURL(
          path.join(NODE_VENDOR_DIR, 'pdf.worker.mjs')
        ).href;
      } catch {
        /* older builds expose the worker differently; fake worker still works */
      }
      return lib;
    });
  }
  return pdfjsPromise;
}

/**
 * pdf.js refuses Node Buffers specifically, so hand it a plain Uint8Array view
 * over the same memory (no copy).
 */
function toPlainBytes(bytes) {
  if (bytes instanceof Uint8Array) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  if (ArrayBuffer.isView(bytes)) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  return new Uint8Array(bytes);
}

/** Convert pdf.js text items into readable lines. */
function textFromItems(items) {
  let out = '';
  let lastY = null;
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    const y = Array.isArray(item.transform) ? item.transform[5] : null;
    if (lastY !== null && y !== null) {
      const gap = Math.abs(lastY - y);
      if (gap > 2.2) out += '\n';
    }
    out += item.str;
    if (item.hasEOL) {
      out += '\n';
      lastY = null;
    } else {
      lastY = y;
    }
  }
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @param {Uint8Array|Buffer} bytes raw PDF bytes
 * @param {{maxPages?: number}} [opts]
 * @returns {Promise<{numPages:number, pages:string[], text:string, charsPerPage:number, hasTextLayer:boolean}>}
 */
export async function extractPdfText(bytes, opts = {}) {
  const maxPages = Math.max(1, opts.maxPages ?? 120);
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    data: toPlainBytes(bytes),
    standardFontDataUrl: path.join(NODE_VENDOR_DIR, 'standard_fonts') + path.sep,
    useSystemFonts: false,
    isEvalSupported: false,
    disableFontFace: true,
    useWorkerFetch: false,
    verbosity: 0,
  });

  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    throw Object.assign(new Error(`Could not read PDF: ${err?.message ?? err}`), {
      code: 'PDF_UNREADABLE',
    });
  }

  const numPages = doc.numPages;
  const pages = [];
  try {
    const limit = Math.min(numPages, maxPages);
    for (let i = 1; i <= limit; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(textFromItems(content.items));
      page.cleanup?.();
    }
  } finally {
    await doc.destroy().catch(() => {});
  }

  const text = pages.join('\n\n');
  const meaningful = text.replace(/\s/g, '').length;
  return {
    numPages,
    pages,
    text,
    charsPerPage: Math.round(meaningful / Math.max(1, pages.length)),
    // Heuristic threshold: a scanned page yields only stray glyph noise.
    hasTextLayer: meaningful / Math.max(1, pages.length) > 40,
  };
}
