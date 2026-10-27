/**
 * OCR.space integration, plus the route decision for an uploaded paper.
 *
 * Free-tier facts we must respect (from ocr.space/ocrapi):
 *   - file size limit 1 MB
 *   - PDF page limit 3 pages
 *   - 500 requests per day per IP, 25,000 per month
 *   - engine 2 is the default and best all-round; engine 3 is more accurate on
 *     handwriting and tables but much slower and capped at 1,000 free calls
 *
 * Route for an uploaded paper:
 *   images  -> downscale/compress client-side -> OCR
 *   PDF with a text layer -> extracted server-side with pdf.js, no OCR at all
 *   PDF without a text layer -> <=3 pages and <=1 MB: OCR the PDF directly;
 *                              otherwise: render each page to JPEG and OCR it
 */
import { prepareImageForOcr, isPdfFile, isImageFile, bytesToSize } from './imaging.js';
import { renderPdfPages } from './pdfdoc.js';

export const OCR_FREE_ENDPOINT = 'https://api.ocr.space/parse/image';
export const OCR_LIMITS = {
  freeMaxBytes: 1 * 1024 * 1024,
  freeMaxPdfPages: 3,
  requestsPerDayPerIp: 500,
};

export class OcrError extends Error {
  constructor(message, code, recovery) {
    super(message);
    this.name = 'OcrError';
    this.code = code ?? 'OCR_ERROR';
    this.recovery = recovery ?? null;
  }
}

/** Turn OCR.space's error surface into something a teacher can act on. */
export function friendlyOcrError(json, httpStatus) {
  const raw = [json?.ErrorMessage, json?.ErrorDetails]
    .flat()
    .filter(Boolean)
    .map((x) => (typeof x === 'string' ? x : JSON.stringify(x)))
    .join(' | ');
  const text = raw || `HTTP ${httpStatus}`;
  const lower = text.toLowerCase();

  if (/invalid|api key|apikey|unauthor|not valid/i.test(lower)) {
    return new OcrError(
      `OCR.space rejected the API key. ${text}`,
      'OCR_BAD_KEY',
      'Open Settings and paste a valid OCR.space key (the free key from ocr.space/ocrapi/freekey works). The demo key "helloworld" is rate-limited.'
    );
  }
  if (/file size|too large|size limit|maximum.*size/i.test(lower)) {
    return new OcrError(
      `The file is over OCR.space's free limit of 1 MB. ${text}`,
      'OCR_TOO_LARGE',
      'Paperguide compresses images automatically. For PDFs, try uploading the pages as separate photos instead.'
    );
  }
  if (/page|pdf.*limit|only.*pages/i.test(lower)) {
    return new OcrError(
      `The free tier only OCRs 3 PDF pages at a time. ${text}`,
      'OCR_PAGE_LIMIT',
      'Paperguide splits larger PDFs into page images automatically. If you saw this, upload the pages as images.'
    );
  }
  if (/rate|limit|quota|exceeded.*day|too many/i.test(lower)) {
    return new OcrError(
      `OCR.space rate limit reached (free tier: ${OCR_LIMITS.requestsPerDayPerIp} requests per day per IP). ${text}`,
      'OCR_RATE_LIMIT',
      'Wait for the daily quota to reset, use a PRO key in Settings, or paste the paper text directly into the chat.'
    );
  }
  if (/timed? ?out|timeout/i.test(lower)) {
    return new OcrError(`OCR.space timed out. ${text}`, 'OCR_TIMEOUT', 'Retry, or try again with a smaller/sharper image.');
  }
  if (/engine|language|not supported/i.test(lower)) {
    return new OcrError(`OCR.space rejected one of the request options. ${text}`, 'OCR_BAD_OPTION', 'Switch the OCR engine in Settings (engine 2 is the safest default).');
  }
  return new OcrError(`OCR failed: ${text}`, 'OCR_FAILED', 'Try the other OCR engine in Settings, or paste the text directly.');
}

/** Normalise OCR.space's ParsedText (it uses \r\n and pads blank lines). */
function cleanParsedText(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function readOcrPayload(json) {
  const results = Array.isArray(json?.ParsedResults) ? json.ParsedResults : [];
  const pages = results.map((r, i) => ({
    index: i + 1,
    text: cleanParsedText(r?.ParsedText),
    exitCode: r?.FileParseExitCode,
    error: r?.ErrorMessage ?? null,
  }));
  const text = pages.map((p) => p.text).filter(Boolean).join('\n\n');
  const exitCode = Number(json?.OCRExitCode ?? 0);
  const errored = json?.IsErroredOnProcessing === true;
  const failedAll = exitCode === 3 || exitCode === 4;
  return {
    text,
    pages,
    exitCode,
    errored,
    partial: exitCode === 2,
    failedAll,
    processingMs: Number(json?.ProcessingTimeInMilliseconds ?? 0) || null,
    raw: json,
  };
}

/**
 * One OCR.space call.
 * @param {{blob:Blob, filename:string, settings:object, signal?:AbortSignal, isPdf?:boolean,
 *          pageLabel?:string, onProgress?:(msg:string)=>void}} args
 */
export async function callOcr({ blob, filename, settings, signal, isPdf = false, pageLabel = '', onProgress }) {
  const apiKey = settings.ocrApiKey?.trim();
  if (!apiKey) {
    throw new OcrError(
      'No OCR.space API key. Add one in Settings.',
      'OCR_NO_KEY',
      `Get a free key at ocr.space/ocrapi/freekey, or skip OCR entirely by pasting the paper text into the chat.`
    );
  }

  const form = new FormData();
  form.append('file', blob, filename);
  form.append('apikey', apiKey);
  form.append('language', 'eng'); // English only, per the brief
  form.append('OCREngine', String(settings.ocrEngine ?? 2));
  form.append('isTable', 'true'); // keeps line structure, which question papers need
  form.append('scale', 'true'); // internal upscaling helps low-res phone photos
  form.append('detectOrientation', 'true'); // photos are often rotated
  form.append('isOverlayRequired', 'false');
  if (isPdf) form.append('filetype', 'PDF');

  onProgress?.(`Uploading ${pageLabel || filename} (${bytesToSize(blob.size)}) to OCR.space...`);

  const routing = settings.ocrRouting ?? 'proxy';
  const headers = {};
  if (settings.ocrEndpoint?.trim()) headers['x-ocr-endpoint'] = settings.ocrEndpoint.trim();

  let response;
  if (routing === 'direct') {
    try {
      response = await fetch(settings.ocrEndpoint?.trim() || OCR_FREE_ENDPOINT, {
        method: 'POST',
        body: form,
        signal,
      });
    } catch (err) {
      throw new OcrError(
        `Could not reach OCR.space directly (${err?.message ?? err}).`,
        'OCR_UNREACHABLE',
        'Set OCR routing to "Local proxy" in Settings - the browser is often blocked from OCR.space by CORS.'
      );
    }
  } else {
    try {
      response = await fetch('/api/ocr', { method: 'POST', headers, body: form, signal });
    } catch (err) {
      throw new OcrError(
        `Could not reach the local Paperguide server (${err?.message ?? err}).`,
        'OCR_PROXY_DOWN',
        'Make sure the Paperguide server is still running in its terminal window, then retry.'
      );
    }
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new OcrError(`OCR.space returned a non-JSON reply (HTTP ${response.status}).`, 'OCR_BAD_RESPONSE', 'Retry once; if it persists, switch OCR engine in Settings.');
  }

  const parsed = readOcrPayload(json);

  if (!response.ok || parsed.errored || parsed.failedAll) {
    const firstPageError = parsed.pages.find((p) => p.error)?.error;
    if (firstPageError && !parsed.text) {
      throw friendlyOcrError({ ErrorMessage: [json?.ErrorMessage, firstPageError].flat().filter(Boolean) }, response.status);
    }
    if (!parsed.text) throw friendlyOcrError(json, response.status);
  }
  if (!response.ok) throw friendlyOcrError(json, response.status);

  return parsed;
}

/** Server-side text extraction for a PDF the teacher uploaded. */
export async function extractPdfLocally(file, { signal } = {}) {
  const bytes = await file.arrayBuffer();
  const response = await fetch('/api/pdf/text', {
    method: 'POST',
    headers: { 'content-type': 'application/pdf' },
    body: bytes,
    signal,
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.ok === false) {
    throw new OcrError(
      json?.error ?? `The PDF could not be read (HTTP ${response.status}).`,
      json?.code ?? 'PDF_TEXT_FAILED',
      'Upload the pages as photos instead, or paste the text into the chat.'
    );
  }
  return json;
}

/**
 * Top-level: get paper text from whatever the teacher supplied.
 *
 * @param {{files?:File[], pastedText?:string, settings:object, signal?:AbortSignal,
 *          onProgress?:(p:{message:string, detail?:string})=>void}} args
 * @returns {Promise<{text:string, method:string, units:object[], warnings:string[], ocrCalls:number, bytesIn:number}>}
 */
export async function extractPaperText({ files = [], pastedText = '', settings, signal, onProgress }) {
  const warnings = [];
  const units = [];
  let ocrCalls = 0;

  const note = (message, detail) => onProgress?.({ message, detail });

  if (pastedText?.trim()) {
    units.push({ kind: 'pasted', label: 'Pasted text', text: pastedText.trim(), note: 'Provided directly by the teacher.' });
    note('Using the pasted paper text.', 'No OCR needed.');
  }

  for (const file of files) {
    if (signal?.aborted) throw new OcrError('Cancelled.', 'OCR_CANCELLED');

    if (isImageFile(file)) {
      note(`Preparing image ${file.name}...`, `Original ${bytesToSize(file.size)}`);
      const prepared = await prepareImageForOcr(file, {
        enhance: settings.ocrEnhance === true,
      });
      const detail =
        prepared.bytes < prepared.originalBytes
          ? `Compressed ${bytesToSize(prepared.originalBytes)} to ${bytesToSize(prepared.bytes)} (${prepared.width}x${prepared.height}) to fit the 1 MB free limit.`
          : `Already within the 1 MB free limit (${bytesToSize(prepared.bytes)}).`;
      note(`Reading ${file.name} with OCR...`, detail);
      const result = await callOcr({
        blob: prepared.blob,
        filename: file.name.replace(/\.(png|webp|gif|bmp|tiff?)$/i, '.jpg'),
        settings,
        signal,
        pageLabel: file.name,
        onProgress: (m) => note(m, detail),
      });
      ocrCalls++;
      if (!result.text.trim()) {
        warnings.push(`${file.name}: OCR returned no text. The image may be too dark, blurred or rotated.`);
      }
      units.push({
        kind: 'image',
        label: file.name,
        text: result.text,
        note: detail,
        previewUrl: prepared.previewUrl,
        processingMs: result.processingMs,
        engine: settings.ocrEngine ?? 2,
      });
      continue;
    }

    if (isPdfFile(file)) {
      note(`Opening ${file.name}...`, `PDF, ${bytesToSize(file.size)}`);
      let info = null;
      try {
        info = await extractPdfLocally(file, { signal });
      } catch (err) {
        warnings.push(`${file.name}: ${err.message}`);
      }

      if (info?.hasTextLayer && info.text?.trim()) {
        units.push({
          kind: 'pdf-text',
          label: file.name,
          text: info.text,
          note: `Digital PDF: ${info.numPages} page(s) read directly from the text layer. No OCR used.`,
          previewUrl: null,
          numPages: info.numPages,
        });
        note(`${file.name} has a digital text layer.`, 'Read directly, no OCR needed.');
        continue;
      }

      const numPages = info?.numPages ?? null;
      const canOcrWholePdf =
        file.size <= OCR_LIMITS.freeMaxBytes && (numPages === null || numPages <= OCR_LIMITS.freeMaxPdfPages);

      if (canOcrWholePdf) {
        note(`Reading ${file.name} with OCR...`, `Scanned PDF, ${numPages ?? '?'} page(s).`);
        const result = await callOcr({
          blob: file,
          filename: file.name,
          settings,
          signal,
          isPdf: true,
          pageLabel: file.name,
          onProgress: (m) => note(m),
        });
        ocrCalls++;
        units.push({
          kind: 'pdf-ocr',
          label: file.name,
          text: result.text,
          note: `Scanned PDF OCRed directly (${numPages ?? '?'} page(s)).`,
          processingMs: result.processingMs,
          numPages,
        });
        continue;
      }

      // Too big / too many pages for the free tier: render pages and OCR each.
      note(
        `Splitting ${file.name} into page images...`,
        `${numPages ?? 'many'} pages, ${bytesToSize(file.size)}. The free tier caps PDFs at ${OCR_LIMITS.freeMaxPdfPages} pages / 1 MB, so each page is OCRed separately.`
      );
      const buffer = await file.arrayBuffer();
      const rendered = await renderPdfPages(buffer, {
        maxBytes: OCR_LIMITS.freeMaxBytes,
        scale: 2,
        onProgress: ({ page, done, total }) => note(`Rendering page ${page} of ${total}...`, `${done} of ${total} done`),
      });
      warnings.push(
        `${file.name}: ${rendered.length} pages were rendered and OCRed one page at a time because the free tier cannot take the whole PDF. This uses one OCR request per page.`
      );
      const pageTexts = [];
      for (const page of rendered) {
        if (signal?.aborted) throw new OcrError('Cancelled.', 'OCR_CANCELLED');
        note(`Reading page ${page.page} of ${rendered.length} with OCR...`, bytesToSize(page.bytes));
        const result = await callOcr({
          blob: page.blob,
          filename: `${file.name.replace(/\.pdf$/i, '')}-p${page.page}.jpg`,
          settings,
          signal,
          pageLabel: `page ${page.page}`,
          onProgress: (m) => note(m),
        });
        ocrCalls++;
        if (result.text.trim()) pageTexts.push(result.text);
        else warnings.push(`${file.name} page ${page.page}: OCR returned no text.`);
      }
      units.push({
        kind: 'pdf-pages',
        label: file.name,
        text: pageTexts.join('\n\n'),
        note: `${rendered.length} page(s) rendered to images and OCRed individually.`,
        numPages: rendered.length,
      });
      continue;
    }

    if (/^text\//.test(file.type) || /\.(txt|md|markdown)$/i.test(file.name)) {
      const text = await file.text();
      units.push({ kind: 'text-file', label: file.name, text, note: 'Plain text file, read directly.' });
      continue;
    }

    warnings.push(`${file.name}: unsupported file type. Upload an image (PNG/JPEG) or a PDF, or paste the text.`);
  }

  const usable = units.filter((u) => u.text?.trim());
  const text = usable
    .map((u) => {
      if (usable.length === 1) return u.text;
      const range = u.numPages ? `, ${u.numPages} page(s)` : '';
      return `----- ${u.label}${range} -----\n${u.text}`;
    })
    .join('\n\n');

  const method = usable.length
    ? [...new Set(usable.map((u) => u.kind))].join('+')
    : 'none';

  if (!text.trim()) {
    warnings.push('No text could be extracted. Try a sharper photo, a different file, or paste the text directly.');
  }

  return { text, method, units, warnings, ocrCalls, bytesIn: files.reduce((n, f) => n + (f.size ?? 0), 0) };
}
