#!/usr/bin/env node
/**
 * Paperguide local server.
 *
 * Zero npm dependencies. It does four jobs:
 *   1. serves the static chat app from ./public
 *   2. proxies OCR.space uploads (browser -> here -> OCR.space)
 *   3. proxies OpenAI-compatible chat completions (avoids CORS entirely)
 *   4. fetches and text-extracts syllabus documents (PDF or HTML) for the
 *      syllabus lookup, which the browser cannot do cross-origin
 *
 * Nothing is persisted. Request bodies are never logged, and credentials are
 * only ever copied from the request into an upstream header.
 *
 * Usage: node server.mjs [--port 8791] [--host 127.0.0.1]
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError, sendError, sendJson, readJsonBody, readBody } from './server/http.mjs';
import { createStaticHandler } from './server/static.mjs';
import { chatCompletion, streamChatCompletion, listModels } from './server/llm-proxy.mjs';
import { proxyOcr } from './server/ocr-proxy.mjs';
import { fetchDocument } from './server/documents.mjs';
import { extractPdfText } from './server/pdf-text.mjs';
import { loadSeedIndex, searchSyllabus } from './server/syllabus-search.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const VERSION = '1.0.0';

function argValue(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const HOST = argValue('host', process.env.HOST ?? '127.0.0.1');
const PORT = Number(argValue('port', process.env.PORT ?? 8791));

const serveStatic = createStaticHandler(PUBLIC_DIR);
let seedIndexPromise = null;
const getSeedIndex = () => (seedIndexPromise ??= loadSeedIndex(DATA_DIR));

async function handleApi(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /api/health') {
    const index = await getSeedIndex();
    return sendJson(res, 200, {
      ok: true,
      app: 'Paperguide',
      version: VERSION,
      node: process.version,
      seedCourses: (index.courses ?? []).length,
      seedScheme: index.scheme ?? null,
    });
  }

  if (route === 'GET /api/syllabus/index') {
    const index = await getSeedIndex();
    return sendJson(res, 200, { ok: true, ...index });
  }

  if (route === 'GET /api/syllabus/search') {
    const q = url.searchParams.get('q') ?? '';
    if (!q.trim()) throw new HttpError(400, 'Add a course code or course name to search for.', 'NO_QUERY');
    const remote = url.searchParams.get('remote') !== '0';
    const result = await searchSyllabus({
      query: q,
      index: await getSeedIndex(),
      remote,
      limit: Number(url.searchParams.get('limit') ?? 12) || 12,
    });
    return sendJson(res, 200, { ok: true, ...result });
  }

  if (route === 'GET /api/syllabus/fetch') {
    const target = url.searchParams.get('url');
    if (!target) throw new HttpError(400, 'Missing url parameter.', 'NO_URL');
    const doc = await fetchDocument(target);
    return sendJson(res, 200, {
      ok: true,
      url: doc.url,
      kind: doc.kind,
      title: doc.title,
      text: doc.text,
      textLength: doc.text.replace(/\s/g, '').length,
      numPages: doc.numPages,
      hasTextLayer: doc.hasTextLayer,
      links: doc.links.slice(0, 60),
      bytes: doc.bytes,
      contentType: doc.contentType,
      warning: doc.warning,
    });
  }

  if (route === 'POST /api/llm/models') {
    const { baseUrl, apiKey } = await readJsonBody(req, 64 * 1024);
    const out = await listModels({ baseUrl, apiKey });
    return sendJson(res, 200, { ok: true, ...out });
  }

  if (route === 'POST /api/llm/chat') {
    const payload = await readJsonBody(req, 8 * 1024 * 1024);
    const { baseUrl, apiKey, body } = payload ?? {};
    if (!body || typeof body !== 'object') {
      throw new HttpError(400, 'Missing chat request body.', 'NO_CHAT_BODY');
    }
    if (body.stream) {
      await streamChatCompletion({ baseUrl, apiKey, body, res });
      return undefined;
    }
    const json = await chatCompletion({ baseUrl, apiKey, body });
    return sendJson(res, 200, json);
  }

  if (route === 'POST /api/ocr') {
    const raw = await readBody(req, 24 * 1024 * 1024);
    const { status, json } = await proxyOcr({ req, rawBody: raw });
    return sendJson(res, status === 200 ? 200 : 502, json);
  }

  // Text extraction for a PDF the teacher uploaded from their own machine.
  // Digital KTU papers and syllabi carry a text layer, so this avoids OCR
  // entirely for them; scanned PDFs come back with hasTextLayer:false and the
  // client routes them to OCR instead.
  if (route === 'POST /api/pdf/text') {
    const raw = await readBody(req, 40 * 1024 * 1024);
    if (raw.subarray(0, 4).toString('latin1') !== '%PDF') {
      throw new HttpError(400, 'That file is not a PDF.', 'NOT_A_PDF');
    }
    let parsed;
    try {
      parsed = await extractPdfText(raw);
    } catch (err) {
      throw new HttpError(
        422,
        `This PDF could not be read (${err?.message ?? err}). Rename it to .pdf, or upload page images instead.`,
        'PDF_UNREADABLE'
      );
    }
    return sendJson(res, 200, {
      ok: true,
      numPages: parsed.numPages,
      text: parsed.text,
      pages: parsed.pages.length,
      charsPerPage: parsed.charsPerPage,
      hasTextLayer: parsed.hasTextLayer,
    });
  }

  throw new HttpError(404, `No such endpoint: ${req.method} ${url.pathname}`, 'NO_ROUTE');
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url ?? '/', `http://${req.headers.host ?? `${HOST}:${PORT}`}`);
  } catch {
    return sendJson(res, 400, { ok: false, error: 'Malformed request URL.', code: 'BAD_URL' });
  }

  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      throw new HttpError(405, 'Only GET and HEAD are supported for static files.', 'METHOD_NOT_ALLOWED');
    }
    await serveStatic(req, res, url.pathname);
  } catch (err) {
    if (res.headersSent) {
      try {
        res.end();
      } catch {
        /* ignore */
      }
      return;
    }
    sendError(res, err);
  }
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  process.stdout.write(
    `\n  Paperguide v${VERSION}\n  Open: ${url}\n  Static: ${PUBLIC_DIR}\n  No data is written to disk. Ctrl+C to stop.\n\n`
  );
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    process.stdout.write('\n  Stopping Paperguide.\n');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
