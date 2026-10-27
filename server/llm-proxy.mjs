/**
 * LLM forwarding (OpenAI-compatible chat completions).
 *
 * The browser cannot always reach a provider directly (CORS, mixed content,
 * self-signed certs on local servers), so it can route through this local
 * endpoint instead. The API key is read from the request body and used only to
 * build the upstream Authorization header: it is never written to disk, never
 * logged, and never included in an error surfaced to the client.
 */
import { HttpError, assertSafeUrl } from './http.mjs';

const SENSITIVE = /(authorization|api[-_]?key|bearer\s+[A-Za-z0-9._\-]{8,})/gi;

/** Redact anything that looks like a credential before it reaches a log or the client. */
export function redact(text) {
  return String(text).replace(SENSITIVE, (m) => (m.toLowerCase().startsWith('bearer') ? 'Bearer [redacted]' : '[redacted]'));
}

function joinUrl(baseUrl, suffix) {
  const trimmed = String(baseUrl ?? '').trim().replace(/\/+$/, '');
  if (!trimmed) throw new HttpError(400, 'No base URL configured.', 'NO_BASE_URL');
  return trimmed + suffix;
}

/**
 * A base URL may be given either as the API root (https://host/v1) or as a full
 * chat-completions endpoint. Normalise both.
 */
export function chatCompletionsUrl(baseUrl) {
  const url = joinUrl(baseUrl, '');
  if (/\/chat\/completions$/i.test(url)) return url;
  return url + '/chat/completions';
}

export function modelsUrl(baseUrl) {
  const url = joinUrl(baseUrl, '');
  if (/\/chat\/completions$/i.test(url)) return url.replace(/\/chat\/completions$/i, '/models');
  return url + '/models';
}

function authHeaders(apiKey) {
  const headers = { 'content-type': 'application/json' };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  return headers;
}

async function readUpstreamError(response) {
  let detail = '';
  try {
    detail = (await response.text()).slice(0, 800);
  } catch {
    /* ignore */
  }
  let message = `The model endpoint responded ${response.status}.`;
  try {
    const parsed = JSON.parse(detail);
    const inner = parsed?.error?.message ?? parsed?.message ?? parsed?.detail;
    if (inner) message = String(inner);
  } catch {
    if (detail.trim()) message += ` ${detail.trim().slice(0, 300)}`;
  }
  return { message: redact(message), status: response.status };
}

/** Non-streaming chat completion. Returns the parsed provider JSON. */
export async function chatCompletion({ baseUrl, apiKey, body, timeoutMs = 180000 }) {
  const url = assertSafeUrl(chatCompletionsUrl(baseUrl)).href;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const { message, status } = await readUpstreamError(response);
      throw new HttpError(502, message, 'LLM_UPSTREAM_ERROR', { upstreamStatus: status });
    }
    return await response.json();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const timedOut = err?.name === 'AbortError';
    throw new HttpError(
      timedOut ? 504 : 502,
      timedOut
        ? `The model endpoint did not answer within ${Math.round(timeoutMs / 1000)} s.`
        : `Could not reach the model endpoint: ${redact(err?.message ?? err)}`,
      timedOut ? 'LLM_TIMEOUT' : 'LLM_UNREACHABLE'
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Streaming chat completion, piped straight through to the client. */
export async function streamChatCompletion({ baseUrl, apiKey, body, res, timeoutMs = 300000 }) {
  const url = assertSafeUrl(chatCompletionsUrl(baseUrl)).href;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...authHeaders(apiKey), accept: 'text/event-stream' },
      body: JSON.stringify({ ...body, stream: true }),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      const { message, status } = await readUpstreamError(response);
      throw new HttpError(502, message, 'LLM_UPSTREAM_ERROR', { upstreamStatus: status });
    }
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    if (res.headersSent) {
      // Mid-stream failure: close the stream so the client's reader errors out.
      res.end();
      return;
    }
    if (err instanceof HttpError) throw err;
    const timedOut = err?.name === 'AbortError';
    throw new HttpError(
      timedOut ? 504 : 502,
      timedOut ? `The model endpoint stalled past ${Math.round(timeoutMs / 1000)} s.` : `Could not reach the model endpoint: ${redact(err?.message ?? err)}`,
      'LLM_UNREACHABLE'
    );
  } finally {
    clearTimeout(timer);
  }
}

/** GET {baseUrl}/models, tolerant of providers that do not implement it. */
export async function listModels({ baseUrl, apiKey, timeoutMs = 20000 }) {
  const url = assertSafeUrl(modelsUrl(baseUrl)).href;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: authHeaders(apiKey), signal: controller.signal });
    if (!response.ok) {
      const { message, status } = await readUpstreamError(response);
      throw new HttpError(502, message, 'LLM_MODELS_ERROR', { upstreamStatus: status });
    }
    const json = await response.json();
    const list = Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : [];
    const ids = list
      .map((m) => (typeof m === 'string' ? m : m?.id ?? m?.name ?? m?.model))
      .filter((x) => typeof x === 'string' && x.length);
    return { models: [...new Set(ids)].sort() };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const timedOut = err?.name === 'AbortError';
    throw new HttpError(
      timedOut ? 504 : 502,
      timedOut ? 'Timed out listing models.' : `Could not list models: ${redact(err?.message ?? err)}`,
      'LLM_MODELS_UNREACHABLE'
    );
  } finally {
    clearTimeout(timer);
  }
}
