/**
 * Locate KTU 2024-scheme syllabus sources for a course the teacher names.
 *
 * Layered and tolerant, because KTU hosting is inconsistent:
 *   1. the bundled seed index (data/ktu-2024-index.json) - works offline
 *   2. DuckDuckGo HTML search, run server-side (no CORS, no API key)
 *   3. the official KTU syllabus listing page, scanned for matching document links
 *
 * Every candidate carries `provenance` and a `score` so the UI can be honest
 * about where a hit came from and how much to trust it.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchWithLimits } from './http.mjs';
import { extractLinks, htmlToText, pickDocumentLinks } from './html-text.mjs';

const TRUSTED_HOSTS = [
  [/(^|\.)ktu\.edu\.in$/i, 0.45, 'official KTU site'],
  [/(^|\.)ktu\.ac\.in$/i, 0.45, 'official KTU site'],
  [/(^|\.)notesundo\.in$/i, 0.22, 'KTU syllabus mirror'],
  [/(^|\.)ktunotes\.in$/i, 0.22, 'KTU notes site'],
  [/(^|\.)ktunotes2024\.github\.io$/i, 0.2, 'KTU 2024 mirror'],
  [/(^|\.)btechtutor\.com$/i, 0.18, 'KTU guide site'],
  [/(^|\.)golearnerz\.com$/i, 0.14, 'KTU guide site'],
  [/(^|\.)learnizo\.co\.in$/i, 0.14, 'KTU guide site'],
];

const STOPWORDS = new Set([
  'ktu', 'syllabus', 'scheme', 'pdf', 'the', 'and', 'for', 'with', 'from', 'of', 'in', 'to',
  'btech', 'b', 'tech', 'course', 'subject', 'download', 'official', '2024', 'apj', 'abdul',
  'kalam', 'technological', 'university', 'semester', 'sem',
]);

const OFFICIAL_LISTINGS = [
  'https://ktu.edu.in/academics/branchsyllabus',
  'https://ktu.edu.in/academics/syllabus',
];

/** Load the bundled seed index; missing or broken file must not break search. */
export async function loadSeedIndex(dataDir) {
  try {
    const raw = await fs.readFile(path.join(dataDir, 'ktu-2024-index.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.courses) ? parsed : { scheme: 'KTU 2024', courses: [], notes: [] };
  } catch {
    return { scheme: 'KTU 2024', courses: [], notes: [] };
  }
}

export function tokenize(query) {
  return String(query ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s.+-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Recognise KTU 2024-scheme course codes.
 *
 * Real codes are eight characters with no year prefix: [scope][area][delivery]
 * [3 digits], e.g. GAMAT101, UCEST105, PCCST303, UCHUT346. `XX` is a wildcard
 * and a trailing `N` is an elective placeholder (PCXXT205, PEXXT41N) - so a
 * plain \d{3} does not cover every code.
 */
export function extractCodes(query) {
  const found = new Set();
  const patterns = [
    /\b[A-Z]{2,6}XX[A-Z]\d{2}[0-9N]\b/g, // wildcard form
    /\b[A-Z]{4,6}\d{2}[0-9N]\b/g, // GAMAT101, UCEST105, PEXXT41N
    /\b[A-Z]{2,6}\d{3}\b/g, // generic fallback, e.g. MAT101
  ];
  for (const rx of patterns) {
    for (const m of String(query ?? '').toUpperCase().matchAll(rx)) {
      if (/\d{2}/.test(m[0]) && m[0].length >= 6) found.add(m[0]);
    }
  }
  return [...found];
}

function trustFor(url) {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return { score: 0, label: 'unknown host' };
  }
  for (const [rx, score, label] of TRUSTED_HOSTS) {
    if (rx.test(host)) return { score, label };
  }
  return { score: 0.05, label: 'third-party site' };
}

export function scoreCandidate({ title, url, text = '' }, tokens, codes) {
  const hay = `${title} ${url} ${text}`.toLowerCase();
  let score = trustFor(url).score;
  if (/\.pdf(?:$|\?)/i.test(url)) score += 0.16;
  if (/syllabus|curriculum/i.test(hay)) score += 0.1;
  if (/2024/.test(hay)) score += 0.08;
  if (/model question paper|question paper pattern/i.test(hay)) score += 0.04;
  if (tokens.length) {
    const hits = tokens.filter((t) => hay.includes(t)).length;
    score += (hits / tokens.length) * 0.38;
  }
  for (const code of codes) {
    if (hay.includes(code.toLowerCase())) score += code.length >= 5 ? 0.5 : 0.25;
  }
  return Math.min(1, Number(score.toFixed(3)));
}

/** Parse DuckDuckGo's HTML endpoint into {title, url, snippet}. */
export function parseDuckDuckGo(html) {
  const results = [];
  const blocks = String(html).split(/<div[^>]+class="[^"]*result__body[^"]*"/i).slice(1);
  for (const block of blocks) {
    const anchor = /<a\b[^>]*class="[^"]*result__a[^"]*"[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    if (!anchor) continue;
    const rawHref = anchor[1] ?? anchor[2] ?? '';
    const title = htmlToText(anchor[3]).slice(0, 240);
    let url = rawHref;
    const uddg = /[?&]uddg=([^&]+)/i.exec(rawHref);
    if (uddg) {
      try {
        url = decodeURIComponent(uddg[1]);
      } catch {
        continue;
      }
    }
    if (!/^https?:/i.test(url)) continue;
    const snippetMatch = /<a\b[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(block)
      ?? /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div)>/i.exec(block);
    results.push({
      title,
      url,
      snippet: snippetMatch ? htmlToText(snippetMatch[1]).slice(0, 320) : '',
    });
  }
  return results;
}

async function ddgSearch(query, { timeoutMs = 18000 } = {}) {
  const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const { bytes, contentType } = await fetchWithLimits(endpoint, { timeoutMs, maxBytes: 3 * 1024 * 1024 });
    const text = new TextDecoder('utf-8').decode(bytes);
    if (!/html/i.test(contentType) && !/<html/i.test(text.slice(0, 400))) return [];
    return parseDuckDuckGo(text);
  } catch {
    return []; // search is best-effort; the caller falls back to the seed index
  }
}

function matchSeedIndex(index, tokens, codes) {
  const out = [];
  for (const course of index.courses ?? []) {
    const code = String(course.code ?? '');
    const title = String(course.title ?? '');
    const hay = `${code} ${title} ${course.branch ?? ''}`.toLowerCase();
    let score = 0;
    let why = [];
    for (const c of codes) {
      if (code.toUpperCase() === c) { score += 0.9; why.push(`exact course code ${c}`); }
      else if (code.toUpperCase().includes(c)) { score += 0.45; why.push(`code contains ${c}`); }
    }
    const hits = tokens.filter((t) => hay.includes(t));
    if (tokens.length && hits.length) {
      score += (hits.length / tokens.length) * 0.6;
      why.push(`title matches ${hits.slice(0, 4).join(', ')}`);
    }
    if (score <= 0) continue;
    out.push({
      title: `${code} ${title}`.trim(),
      url: course.sourceUrl ?? '',
      snippet: [course.semester ? `Semester ${course.semester}` : null, course.branch, `${(course.modules ?? []).length} modules`, `${(course.courseOutcomes ?? []).length} COs`]
        .filter(Boolean)
        .join(' \u00b7 '),
      provenance: 'bundled-index',
      score: Math.min(1, Number(score.toFixed(3))),
      why: why.join('; '),
      courseCode: code || null,
      fromIndex: true,
    });
  }
  return out;
}

async function crawlOfficialListings(tokens, codes) {
  const found = [];
  for (const listing of OFFICIAL_LISTINGS) {
    try {
      const { bytes } = await fetchWithLimits(listing, { timeoutMs: 15000, maxBytes: 4 * 1024 * 1024 });
      const html = new TextDecoder('utf-8').decode(bytes);
      const links = extractLinks(html, listing);
      for (const link of pickDocumentLinks(links, { pattern: /syllabus|curriculum|scheme/i })) {
        const hay = `${link.text} ${link.href}`.toLowerCase();
        const direct = tokens.some((t) => hay.includes(t)) || codes.some((c) => hay.includes(c.toLowerCase()));
        if (!direct) continue;
        found.push({ title: link.text || link.href, url: link.href, snippet: `Listed on the official KTU syllabus page`, provenance: 'ktu-listing' });
      }
    } catch {
      /* official site is flaky; ignore */
    }
  }
  return found;
}

/**
 * @returns {Promise<{query:string, tokens:string[], codes:string[],
 *   candidates:Array<object>, sourcesTried:string[], warnings:string[]}>}
 */
export async function searchSyllabus({ query, index, limit = 12, remote = true }) {
  const tokens = tokenize(query);
  const codes = extractCodes(query);
  const sourcesTried = [];
  const warnings = [];
  const collected = [];

  collected.push(...matchSeedIndex(index ?? { courses: [] }, tokens, codes));
  if ((index?.courses ?? []).length) sourcesTried.push('bundled-index');
  else warnings.push('The bundled course index is empty, so only live search was used.');

  if (remote) {
    const queries = [
      `${query} KTU 2024 scheme syllabus pdf`,
      `site:ktu.edu.in ${query} syllabus`,
      `${query} KTU syllabus modules course outcomes 2024`,
    ];
    const batches = await Promise.all(queries.map((q) => ddgSearch(q)));
    sourcesTried.push('duckduckgo-html');
    const remoteHits = batches.flat().map((r) => ({ ...r, provenance: 'web-search', snippet: r.snippet }));
    if (!remoteHits.length) warnings.push('Web search returned nothing (offline or rate-limited). Upload the syllabus PDF instead.');
    collected.push(...remoteHits);

    const official = await crawlOfficialListings(tokens, codes);
    if (official.length) sourcesTried.push('ktu-listing');
    collected.push(...official);
  }

  const seen = new Map();
  for (const c of collected) {
    if (!c.url) continue;
    const key = c.url.replace(/#.*$/, '').replace(/\/$/, '');
    const scored = {
      ...c,
      score: c.score ?? scoreCandidate(c, tokens, codes),
      trust: trustFor(c.url).label,
    };
    const prev = seen.get(key);
    if (!prev || scored.score > prev.score) seen.set(key, scored);
  }

  const candidates = [...seen.values()]
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
    .slice(0, limit);

  return { query, tokens, codes, candidates, sourcesTried, warnings };
}
