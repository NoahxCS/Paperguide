/**
 * Client-side PDF rendering, using the locally vendored pdf.js build.
 *
 * Needed for photographed/scanned PDFs that have no text layer: those cannot be
 * OCRed as a PDF on the free OCR.space tier (3-page limit), so each page is
 * rendered to a compressed JPEG and OCRed individually.
 */
import { OCR_MAX_BYTES } from './imaging.js';

let pdfjsPromise = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('/vendor/pdfjs/pdf.min.mjs')
      .then((mod) => {
        const lib = mod.default ?? mod;
        lib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
        return lib;
      })
      .catch((err) => {
        pdfjsPromise = null;
        throw new Error(`pdf.js could not be loaded (${err?.message ?? err}). Page rendering is unavailable; upload page images instead.`);
      });
  }
  return pdfjsPromise;
}

export async function readArrayBuffer(file) {
  return file.arrayBuffer();
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode a PDF page.'))), 'image/jpeg', quality);
  });
}

/** Page count only - cheap, and decides the OCR route. */
export async function getPdfPageCount(data) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise;
  const n = doc.numPages;
  await doc.destroy();
  return n;
}

/**
 * Render selected pages to JPEG blobs small enough for the free OCR tier.
 *
 * @param {ArrayBuffer|Uint8Array} data
 * @param {{pages?:number[], scale?:number, maxBytes?:number, onProgress?:(p:{page:number,done:number,total:number})=>void}} [opts]
 * @returns {Promise<{page:number, blob:Blob, width:number, height:number, bytes:number, quality:number}[]>}
 */
export async function renderPdfPages(data, opts = {}) {
  const { pages, scale = 2, maxBytes = OCR_MAX_BYTES, onProgress } = opts;
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise;
  const wanted = pages?.length ? pages : Array.from({ length: doc.numPages }, (_, i) => i + 1);
  const out = [];

  try {
    for (let i = 0; i < wanted.length; i++) {
      const pageNumber = wanted[i];
      onProgress?.({ page: pageNumber, done: i, total: wanted.length });
      const page = await doc.getPage(pageNumber);
      let viewport = page.getViewport({ scale });
      let canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      let ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      let quality = 0.85;
      let blob = await canvasToBlob(canvas, quality);
      // Step quality down, then resolution, until it fits the free tier.
      let guard = 0;
      while (blob.size > maxBytes && guard < 8) {
        guard++;
        if (quality > 0.5) {
          quality = Math.max(0.5, quality - 0.13);
        } else {
          const shrink = 0.8;
          const next = document.createElement('canvas');
          next.width = Math.max(1, Math.round(canvas.width * shrink));
          next.height = Math.max(1, Math.round(canvas.height * shrink));
          const nctx = next.getContext('2d');
          nctx.fillStyle = '#ffffff';
          nctx.fillRect(0, 0, next.width, next.height);
          nctx.drawImage(canvas, 0, 0, next.width, next.height);
          canvas = next;
          viewport = page.getViewport({ scale: 1 });
        }
        blob = await canvasToBlob(canvas, quality);
      }

      out.push({
        page: pageNumber,
        blob,
        width: canvas.width,
        height: canvas.height,
        bytes: blob.size,
        quality,
      });
      page.cleanup?.();
    }
  } finally {
    await doc.destroy().catch(() => {});
  }
  onProgress?.({ page: wanted[wanted.length - 1], done: wanted.length, total: wanted.length });
  return out;
}
