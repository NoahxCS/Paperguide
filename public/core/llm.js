/**
 * OpenAI-compatible chat-completions client.
 *
 * Assumptions, per the brief: plain chat completions only. No tool calling,
 * no native JSON mode. So every structured call goes through `callJson`, which
 * asks for JSON in the prompt, extracts it, validates it against a schema, and
 * retries once with a repair message if the reply was malformed.
 *
 * The API key lives only in this page's memory (see store.js) and is sent only
 * to the configured endpoint - either directly from the browser or through the
 * local Paperguide server when the provider blocks browser requests.
 */
import { extractJson, validateSchema, describeErrors } from './json.js';

export class LlmError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'LlmError';
    this.code = code ?? 'LLM_ERROR';
    this.details = details ?? null;
  }
}

/** Accept a base URL with or without the /chat/completions suffix. */
export function chatCompletionsUrl(baseUrl) {
  const trimmed = String(baseUrl ?? '').trim().replace(/\/+$/, '');
  if (!trimmed) throw new LlmError('No base URL configured. Open Settings and add one.', 'NO_BASE_URL');
  return /\/chat\/completions$/i.test(trimmed) ? trimmed : `${trimmed}/chat/completions`;
}

export function joinBase(baseUrl, suffix) {
  const trimmed = String(baseUrl ?? '').trim().replace(/\/+$/, '');
  if (!trimmed) throw new LlmError('No base URL configured.', 'NO_BASE_URL');
  if (/\/chat\/completions$/i.test(trimmed)) {
    return trimmed.replace(/\/chat\/completions$/i, suffix);
  }
  return `${trimmed}${suffix}`;
}

function redact(text) {
  return String(text ?? '').replace(/sk-[A-Za-z0-9_\-]{6,}/g, 'sk-[redacted]');
}

/** Pull the assistant text out of the common response shapes. */
export function readAssistantText(payload) {
  const choice = payload?.choices?.[0];
  if (!choice) {
    if (typeof payload?.content === 'string') return payload.content;
    if (typeof payload?.response === 'string') return payload.response;
    throw new LlmError('The endpoint replied without any choices. Check the base URL and model name.', 'LLM_EMPTY_CHOICE');
  }
  const msg = choice.message ?? choice.delta ?? {};
  const content = msg.content ?? choice.text ?? '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text ?? ''))
      .join('');
  }
  return '';
}

function classifyHttpError(status, message) {
  const text = String(message ?? '');
  if (status === 401 || status === 403) {
    return new LlmError(
      `The endpoint rejected the API key (HTTP ${status}). Check the key and the base URL. ${redact(text)}`.trim(),
      'LLM_AUTH'
    );
  }
  if (status === 404) {
    return new LlmError(
      `The endpoint returned 404. The base URL is probably wrong (it should normally end in /v1), or the model "${'{{model}}'}" does not exist. ${redact(text)}`.trim(),
      'LLM_NOT_FOUND'
    );
  }
  if (status === 429) {
    return new LlmError(`Rate limited by the endpoint (HTTP 429). Wait a moment and retry. ${redact(text)}`.trim(), 'LLM_RATE_LIMIT');
  }
  if (/context length|too many tokens|maximum context/i.test(text)) {
    return new LlmError(
      `The request was longer than the model's context window. Try a model with a larger context, or analyse fewer questions at once. ${redact(text)}`.trim(),
      'LLM_CONTEXT'
    );
  }
  return new LlmError(`The model endpoint returned HTTP ${status}. ${redact(text)}`.trim(), 'LLM_HTTP', { status });
}

async function postJson(url, headers, body, { signal, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      let detail = text.slice(0, 700);
      try {
        const parsed = JSON.parse(text);
        detail = parsed?.error?.message ?? parsed?.message ?? parsed?.detail ?? detail;
      } catch {
        /* keep raw */
      }
      throw classifyHttpError(response.status, detail);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new LlmError(
        `The endpoint replied with something that is not JSON (first 200 characters): ${text.slice(0, 200)}`,
        'LLM_BAD_RESPONSE'
      );
    }
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if (err?.name === 'AbortError') {
      if (signal?.aborted) throw new LlmError('Cancelled.', 'LLM_CANCELLED');
      throw new LlmError(`The model endpoint did not answer within ${Math.round(timeoutMs / 1000)} s.`, 'LLM_TIMEOUT');
    }
    throw new LlmError(
      `Could not reach the model endpoint (${redact(err?.message ?? err)}). If this is a CORS error, set Request routing to "Local proxy" in Settings.`,
      'LLM_UNREACHABLE'
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * One chat-completion round trip, routed per settings.
 * @returns {Promise<any>} raw provider JSON
 */
export async function complete(settings, body, { signal, timeoutMs = 180000 } = {}) {
  const { baseUrl, apiKey, routing = 'proxy' } = settings;
  const payload = { ...body };

  const direct = async () =>
    postJson(
      chatCompletionsUrl(baseUrl),
      {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      payload,
      { signal, timeoutMs }
    );

  const proxied = async () =>
    postJson(
      '/api/llm/chat',
      { 'content-type': 'application/json' },
      { baseUrl, apiKey, body: payload },
      { signal, timeoutMs }
    );

  if (routing === 'direct') return direct();
  if (routing === 'proxy') return proxied();

  // auto: prefer the proxy (no CORS surprises), fall back to a direct call.
  try {
    return await proxied();
  } catch (err) {
    if (err?.code === 'LLM_CANCELLED' || signal?.aborted) throw err;
    try {
      return await direct();
    } catch {
      throw err;
    }
  }
}

/** Convenience: text completion. */
export async function completeText(settings, { system, user, temperature = 0.2, maxTokens = 4096, signal }) {
  const json = await complete(
    settings,
    {
      model: settings.model,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user },
      ],
      temperature,
      max_tokens: maxTokens,
    },
    { signal }
  );
  return readAssistantText(json);
}

const TRANSIENT = new Set(['LLM_RATE_LIMIT', 'LLM_TIMEOUT', 'LLM_UNREACHABLE', 'LLM_HTTP']);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Structured call: prompt -> JSON -> validate -> (once) repair.
 *
 * @param {object} args
 * @param {object} args.settings
 * @param {{system:string,user:string,contract:string,temperature:number,schema:object,task:string}} args.prompt
 * @param {(info:{stage:string,attempt:number,message:string})=>void} [args.onProgress]
 * @param {AbortSignal} [args.signal]
 * @returns {Promise<{value:any, attempts:number, raw:string, usage:any, repaired:boolean}>}
 */
export async function callJson({ settings, prompt, onProgress, signal, maxAttempts = 2 }) {
  if (!settings?.model) throw new LlmError('No model name configured. Open Settings and add one.', 'NO_MODEL');

  const system = [prompt.system, '', prompt.contract].join('\n');
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: prompt.user },
  ];

  let lastRaw = '';
  let lastErrors = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const attemptLabel = attempt === 1 ? 'requesting' : 'repairing malformed output';
    onProgress?.({ stage: 'llm', attempt, message: `${prompt.task}: ${attemptLabel}` });

    let payload;
    let transportAttempts = 0;
    // Transport-level retry (rate limits / blips) is separate from the
    // single malformed-output repair retry.
    for (;;) {
      transportAttempts++;
      try {
        payload = await complete(
          settings,
          { model: settings.model, messages, temperature: prompt.temperature ?? 0.2, max_tokens: settings.maxTokens ?? 8192 },
          { signal }
        );
        break;
      } catch (err) {
        if (signal?.aborted) throw err;
        if (TRANSIENT.has(err?.code) && transportAttempts < 3 && attempt === 1) {
          const wait = 900 * transportAttempts;
          onProgress?.({ stage: 'llm', attempt, message: `${err.code}: retrying in ${Math.round(wait / 1000)} s` });
          await sleep(wait);
          continue;
        }
        throw err;
      }
    }

    const raw = readAssistantText(payload);
    lastRaw = raw;
    const extracted = extractJson(raw);

    if (!extracted.ok) {
      lastErrors = [{ path: '$', message: extracted.error }];
      onProgress?.({ stage: 'llm', attempt, message: `malformed JSON: ${extracted.error}` });
    } else {
      const result = validateSchema(extracted.value, prompt.schema);
      if (result.valid) {
        return {
          value: result.value,
          attempts: attempt,
          raw,
          usage: payload?.usage ?? null,
          repaired: attempt > 1,
        };
      }
      lastErrors = result.errors;
      onProgress?.({
        stage: 'llm',
        attempt,
        message: `schema mismatch: ${result.errors.length} problem(s), first: ${result.errors[0]?.path} ${result.errors[0]?.message}`,
      });
    }

    if (attempt < maxAttempts) {
      messages.push({ role: 'assistant', content: raw.slice(0, 12000) });
      messages.push({
        role: 'user',
        content: [
          'That reply did not satisfy the contract. Correct it and reply again with ONLY the JSON object.',
          '',
          'Problems found:',
          describeErrors(lastErrors),
          '',
          'Required JSON shape:',
          prompt.contract,
        ].join('\n'),
      });
    }
  }

  throw new LlmError(
    `The model did not return valid JSON after ${maxAttempts} attempts. Last problem: ${lastErrors[0]?.path ?? '$'} ${lastErrors[0]?.message ?? 'unknown'}. ` +
      'Try a larger or more capable model in Settings.',
    'LLM_MALFORMED_JSON',
    { raw: lastRaw.slice(0, 1200), errors: lastErrors }
  );
}

/** GET {base}/models - used by the "Test connection" button. */
export async function listModels(settings) {
  const { baseUrl, apiKey, routing = 'proxy' } = settings;
  if (routing === 'direct') {
    const response = await fetch(joinBase(baseUrl, '/models'), {
      headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
    });
    if (!response.ok) throw classifyHttpError(response.status, await response.text());
    return normaliseModels(await response.json());
  }
  const response = await fetch('/api/llm/models', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ baseUrl, apiKey }),
  });
  const json = await response.json();
  if (!response.ok || json.ok === false) {
    throw new LlmError(json?.error ?? `Model list failed (HTTP ${response.status}).`, json?.code ?? 'LLM_MODELS');
  }
  return json.models ?? [];
}

function normaliseModels(json) {
  const list = Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : [];
  return [
    ...new Set(
      list.map((m) => (typeof m === 'string' ? m : m?.id ?? m?.name ?? m?.model)).filter((x) => typeof x === 'string' && x)
    ),
  ].sort();
}

/** Round trip that proves the key, URL and model all work together. */
export async function testConnection(settings) {
  const started = Date.now();
  const text = await completeText(settings, {
    system: 'Reply with exactly: OK',
    user: 'Reply with exactly: OK',
    temperature: 0,
    maxTokens: 16,
  });
  return { ms: Date.now() - started, reply: text.trim().slice(0, 80) };
}
