/**
 * OCR.space pass-through proxy.
 *
 * The browser builds the multipart body exactly as OCR.space documents it
 * (file / base64Image plus options and the apikey field) and posts it here;
 * this endpoint forwards the bytes unchanged. Nothing is written to disk and
 * request bodies are never logged. The x-ocr-endpoint header allows a PRO
 * endpoint override, but only https hosts.
 */
import { HttpError, assertSafeUrl } from './http.mjs';

export const OCR_FREE_ENDPOINT = 'https://api.ocr.space/parse/image';

export async function proxyOcr({ req, rawBody }) {
  const contentType = req.headers['content-type'] ?? '';
  if (!/^multipart\/form-data/i.test(contentType)) {
    throw new HttpError(
      400,
      'OCR uploads must be sent as multipart/form-data.',
      'OCR_BAD_CONTENT_TYPE'
    );
  }

  const requested = req.headers['x-ocr-endpoint'];
  const endpoint = requested ? assertSafeUrl(requested).href : OCR_FREE_ENDPOINT;
  if (!/^https:/i.test(endpoint)) {
    throw new HttpError(400, 'The OCR endpoint must use https.', 'OCR_ENDPOINT_INSECURE');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': contentType,
        'content-length': String(rawBody.length),
        accept: 'application/json',
      },
      body: rawBody,
      signal: controller.signal,
    });
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new HttpError(
        502,
        `The OCR service returned a non-JSON response (HTTP ${response.status}).`,
        'OCR_BAD_RESPONSE',
        { snippet: text.slice(0, 300) }
      );
    }
    return { status: response.status, json };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const timedOut = err?.name === 'AbortError';
    throw new HttpError(
      timedOut ? 504 : 502,
      timedOut
        ? 'The OCR service did not respond within 120 s.'
        : `Could not reach the OCR service: ${err?.message ?? err}`,
      timedOut ? 'OCR_TIMEOUT' : 'OCR_UNREACHABLE'
    );
  } finally {
    clearTimeout(timer);
  }
}
