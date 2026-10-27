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
    if (!/html/i.test(text.slice(0, 400)) && !/html/i.test(contentType)) return [];
    return parseDuckDuckGo(text);
  } catch {
    return []; // search is best-effort; the caller falls back to the seed index
  }
}

/**
 * Bing wraps every organic result in a redirect:
 *   https://www.bing.com/ck/a?...&u=a1<base64url of the real URL>&...
 * The `u` parameter is base64url-encoded with a literal "a1" prefix.
 */
export function decodeBingHref(href) {
  const html = String(href).replace(/&amp;/g, '&');
  if (!/(^|\.)bing\.com\/ck\/a/i.test(html)) return /^https?:/i.test(html) ? html : null;
  const match = /[?&]u=a1([A-Za-z0-9_-]+)/.exec(html);
  if (!match) return null;
  try {
    const base64 = match[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    return /^https?:/i.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Parse a Bing results page into {title, url, snippet}.
 *
 * Bing is the primary engine because DuckDuckGo's HTML endpoint answers
 * server-side requests from datacentres with an anti-bot challenge page
 * (HTTP 202, no result markup), which makes it useless from a deployed server
 * even though it works from a browser.
 */
export function parseBing(html) {
  const results = [];
  const blocks = String(html).split(/<li class="b_algo"/i).slice(1);
  for (const block of blocks) {
    const anchor = /<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    if (!anchor) continue;
    const url = decodeBingHref(anchor[1]);
    if (!url) continue;
    const paragraph = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block);
    results.push({
      title: htmlToText(anchor[2]).slice(0, 240),
      url,
      snippet: paragraph ? htmlToText(paragraph[1]).slice(0, 320) : '',
    });
  }
  return results;
}

async function bingSearch(query, { timeoutMs = 18000 } = {}) {
  // No `count` parameter: a plain query string is what Bing answers reliably,
  // and extra parameters appear to push it toward a degraded filler page.
  const endpoint = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en`;
  try {
    const { bytes } = await fetchWithLimits(endpoint, { timeoutMs, maxBytes: 4 * 1024 * 1024 });
    const text = new TextDecoder('utf-8').decode(bytes);
    if (!/b_algo/i.test(text)) return [];
    return parseBing(text);
  } catch {
    return [];
  }
}

/** Engines tried in order. The first one that answers wins for that query. */
const SEARCH_ENGINES = [
  { name: 'bing', run: bingSearch },
  { name: 'duckduckgo-html', run: ddgSearch },
];

/**
 * Run one query across the engines, stopping at the first that returns results.
 * Sequential on purpose: firing several queries at one engine at once is what
 * triggers its bot detection, and a degraded page is worse than a slow one.
 * @returns {Promise<{results:object[], engine:string|null}>}
 */
async function webSearch(query, { timeoutMs = 18000 } = {}) {
  for (const engine of SEARCH_ENGINES) {
    const results = await engine.run(query, { timeoutMs });
    if (results.length) return { results, engine: engine.name };
  }
  return { results: [], engine: null };
}

/**
 * How many of the query's meaningful tokens appear in a candidate's title+url.
 * Used to reject the unrelated filler a search engine returns when it has no
 * real match, which would otherwise reach the teacher as a nonsense option.
 */
export function tokenHits(candidate, tokens) {
  const hay = `${candidate.title ?? ''} ${candidate.url ?? ''}`.toLowerCase();
  return tokens.filter((t) => t.length > 2 && hay.includes(t)).length;
}

/**
 * A web result is only offered when it is plausibly about the course asked for.
 *
 * Search engines answer a query they have no real match for with filler that
 * merely shares words, so a bare token test is not enough. A result must either
 * look like a syllabus document, or match several query tokens convincingly.
 * Bundled-index and official-listing hits skip this check entirely.
 */
export const WEB_RELEVANCE_FLOOR = 0.2;

const SYLLABUS_SIGNAL = /syllabus|curriculum|scheme|question\s*paper|model\s*paper|course\s*outcome|\bqp\b/i;

export function hasSyllabusSignal(candidate) {
  return SYLLABUS_SIGNAL.test(`${candidate.title ?? ''} ${candidate.url ?? ''}`);
}

export function keepWebResult(candidate, tokens) {
  const score = candidate.score ?? 0;
  if (score < WEB_RELEVANCE_FLOOR) return false;
  const hits = tokenHits(candidate, tokens);
  if (tokens.length && hits === 0) return false;
  if (hasSyllabusSignal(candidate)) return true;
  // No syllabus wording anywhere: only keep it if it matches most of what the
  // teacher typed and still scores well. This is what removes pages that merely
  // contain the words ("Solid" / "state of matter" for a Solid State Devices
  // query) without removing real course pages.
  return hits >= Math.min(tokens.length, 3) && score >= 0.35;
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
    const queries = [`${query} KTU syllabus`, `${query} KTU 2024 scheme syllabus pdf`];
    const batches = [];
    for (const q of queries) {
      batches.push(await webSearch(q));
    }
    const enginesUsed = [...new Set(batches.map((b) => b.engine).filter(Boolean))];
    for (const engine of enginesUsed) sourcesTried.push(engine);
    if (!enginesUsed.length) sourcesTried.push('web-search(unavailable)');

    const fetched = batches.flatMap((b) => b.results).map((r) => ({ ...r, provenance: 'web-search' }));
    const scored = fetched.map((r) => ({ ...r, score: scoreCandidate(r, tokens, codes) }));
    const remoteHits = scored.filter((r) => keepWebResult(r, tokens));
    const dropped = scored.length - remoteHits.length;

    if (!remoteHits.length) {
      warnings.push(
        (fetched.length
          ? `Web search returned ${fetched.length} result(s) but none were about "${query}", so they were discarded. `
          : 'Live web search returned nothing, so only the bundled index and any official listing were used. ') +
          'Search engines often refuse or degrade requests from a hosted server. Paste a syllabus URL below, or upload the syllabus PDF.'
      );
    } else if (dropped > 0) {
      warnings.push(`Web search returned ${fetched.length} result(s); ${dropped} were off-topic and are not shown.`);
    }
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
