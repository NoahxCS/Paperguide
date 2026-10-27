/** Minimal dependency-free static file server. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { HttpError } from './http.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.bcmap': 'application/octet-stream',
};

export function createStaticHandler(rootDir) {
  const root = path.resolve(rootDir);

  return async function serveStatic(req, res, urlPath) {
    let rel = decodeURIComponent(urlPath);
    if (rel.endsWith('/')) rel += 'index.html';
    const target = path.resolve(root, '.' + path.posix.normalize(rel));

    // Directory traversal guard.
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new HttpError(403, 'Forbidden path.', 'PATH_FORBIDDEN');
    }

    let stat;
    try {
      stat = await fs.stat(target);
    } catch {
      throw new HttpError(404, `Not found: ${urlPath}`, 'NOT_FOUND');
    }
    if (stat.isDirectory()) {
      return serveStatic(req, res, urlPath.replace(/\/?$/, '/') + 'index.html');
    }

    const ext = path.extname(target).toLowerCase();
    const type = MIME[ext] ?? 'application/octet-stream';
    // Embedded fonts / cmaps are content-addressed and safe to cache; app code is not.
    const immutable = /\.(bcmap|woff2|png|jpg|jpeg|svg)$/i.test(target);
    res.writeHead(200, {
      'content-type': type,
      'content-length': stat.size,
      'cache-control': immutable ? 'public, max-age=86400' : 'no-store',
      'last-modified': stat.mtime.toUTCString(),
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(target).pipe(res);
  };
}
