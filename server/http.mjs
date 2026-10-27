/** Small HTTP helpers shared by the server modules. */
import { Buffer } from 'node:buffer';

export class HttpError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code ?? 'HTTP_ERROR';
    this.details = details;
  }
}

export function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
  });
  res.end(body);
}

export function sendError(res, err) {
  const status = err instanceof HttpError ? err.status : 500;
  sendJson(res, status, {
    ok: false,
    error: err?.message ?? String(err),
    code: err?.code ?? 'INTERNAL',
    details: err?.details ?? null,
  });
}

export async function readBody(req, limitBytes = 32 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) {
      throw new HttpError(413, `Request body larger than ${Math.round(limitBytes / 1048576)} MB.`, 'BODY_TOO_LARGE');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readJsonBody(req, limitBytes) {
  const raw = await readBody(req, limitBytes);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    throw new HttpError(400, 'Request body was not valid JSON.', 'BAD_JSON');
  }
}

/** Only http/https, and never link-local metadata addresses. */
export function assertSafeUrl(raw) {
  let url;
  try {
    url = new URL(String(raw));
  } catch {
    throw new HttpError(400, 'That is not a valid URL.', 'BAD_URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, 'Only http and https URLs are supported.', 'BAD_URL_SCHEME');
  }
  const host = url.hostname.toLowerCase();
  if (host === '169.254.169.254' || host.startsWith('169.254.')) {
    throw new HttpError(400, 'Refusing to fetch a link-local address.', 'URL_BLOCKED');
  }
  return url;
}

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 Paperguide/1.0';

/** fetch with a timeout, a browser-ish UA and a hard byte cap. */
export async function fetchWithLimits(url, opts = {}) {
  const { timeoutMs = 25000, maxBytes = 14 * 1024 * 1024, headers = {}, ...rest } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(url, {
      redirect: 'follow',
      ...rest,
      headers: { 'user-agent': DEFAULT_UA, accept: '*/*', ...headers },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const timedOut = err?.name === 'AbortError';
    throw new HttpError(
      timedOut ? 504 : 502,
      timedOut ? `Timed out after ${timeoutMs} ms.` : `Could not reach the server: ${err?.message ?? err}`,
      timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNREACHABLE'
    );
  }
  try {
    if (!response.ok) {
      throw new HttpError(
        response.status === 404 ? 404 : 502,
        `Upstream responded ${response.status} ${response.statusText}.`,
        'UPSTREAM_STATUS',
        { status: response.status, url: response.url }
      );
    }
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length > maxBytes) {
      throw new HttpError(413, 'The upstream file is too large to process.', 'UPSTREAM_TOO_LARGE', {
        bytes: buf.length,
        maxBytes,
      });
    }
    return { response, bytes: buf, contentType: response.headers.get('content-type') ?? '' };
  } finally {
    clearTimeout(timer);
  }
}
