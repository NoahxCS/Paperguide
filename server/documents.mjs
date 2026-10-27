/**
 * Fetch a remote document (syllabus PDF or HTML page) and return plain text.
 *
 * Runs server-side so the browser is not blocked by CORS, and so digital PDFs
 * can be parsed properly instead of being round-tripped through OCR.
 */
import { HttpError, fetchWithLimits } from './http.mjs';
import { extractPdfText } from './pdf-text.mjs';
import { htmlToText, extractLinks, htmlTitle } from './html-text.mjs';

const PDF_MAGIC = '%PDF';

/**
 * Public text-reader proxy, used only when a PDF has no usable text layer.
 * Returns null on any failure: the caller then reports the honest warning.
 */
async function tryReaderFallback(url) {
  const via = 'the r.jina.ai text reader';
  try {
    const { bytes } = await fetchWithLimits(`https://r.jina.ai/${url}`, {
      timeoutMs: 40000,
      maxBytes: 6 * 1024 * 1024,
    });
    const text = bytes
      .toString('utf8')
      .replace(/^Title:.*$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (text.replace(/\s/g, '').length > 400) return { text, via };
  } catch {
    /* fall through */
  }
  return null;
}

function looksLikePdf(bytes, contentType, url) {
  if (bytes.subarray(0, 4).toString('latin1') === PDF_MAGIC) return true;
  if (/application\/pdf/i.test(contentType ?? '')) return true;
  try {
    return /\.pdf(?:$|\?)/i.test(new URL(url).pathname + (new URL(url).search ?? ''));
  } catch {
    return /\.pdf(?:$|\?)/i.test(url);
  }
}

function decodeText(bytes, contentType) {
  const charsetMatch = /charset=([\w-]+)/i.exec(contentType ?? '');
  const charset = (charsetMatch?.[1] ?? 'utf-8').toLowerCase();
  try {
    return new TextDecoder(charset === 'utf8' ? 'utf-8' : charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/**
 * @returns {Promise<{url:string, kind:'pdf'|'html', text:string, title:string,
 *   links:{href:string,text:string}[], numPages:number|null, hasTextLayer:boolean,
 *   bytes:number, contentType:string, warning:string|null}>}
 */
export async function fetchDocument(url, opts = {}) {
  const { maxBytes = 14 * 1024 * 1024, timeoutMs = 25000 } = opts;
  const { bytes, contentType, response } = await fetchWithLimits(url, { maxBytes, timeoutMs });
  const finalUrl = response.url || url;

  if (looksLikePdf(bytes, contentType, finalUrl)) {
    let parsed = null;
    let extractError = null;
    try {
      parsed = await extractPdfText(bytes);
    } catch (err) {
      extractError = err;
    }

    // Scanned syllabus PDFs (no text layer) are common. Fall back to a public
    // text reader rather than making the teacher upload by hand.
    if ((!parsed || !parsed.hasTextLayer) && opts.allowReaderFallback !== false) {
      const reader = await tryReaderFallback(finalUrl);
      if (reader) {
        return {
          url: finalUrl,
          kind: 'pdf',
          text: reader.text,
          title: '',
          links: [],
          numPages: parsed?.numPages ?? null,
          hasTextLayer: false,
          bytes: bytes.length,
          contentType,
          readerFallback: reader.via,
          warning: `This PDF has no text layer, so it was read with ${reader.via}. Check the parsed modules and outcomes carefully against the original.`,
        };
      }
    }

    if (!parsed) {
      throw new HttpError(
        422,
        `That PDF could not be read (${extractError?.message ?? extractError}). Try uploading it instead.`,
        'PDF_UNREADABLE',
        { url: finalUrl }
      );
    }

    return {
      url: finalUrl,
      kind: 'pdf',
      text: parsed.text,
      title: '',
      links: [],
      numPages: parsed.numPages,
      hasTextLayer: parsed.hasTextLayer,
      bytes: bytes.length,
      contentType,
      readerFallback: null,
      warning: parsed.hasTextLayer
        ? null
        : 'This PDF has no text layer (it looks scanned). Upload the PDF in the app so it can be OCRed, or upload page images.',
    };
  }

  const html = decodeText(bytes, contentType);
  const text = htmlToText(html);
  return {
    url: finalUrl,
    kind: 'html',
    text,
    title: htmlTitle(html),
    links: extractLinks(html, finalUrl).slice(0, 400),
    numPages: null,
    hasTextLayer: text.replace(/\s/g, '').length > 200,
    bytes: bytes.length,
    contentType,
    warning: null,
  };
}
