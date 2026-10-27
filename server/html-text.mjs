/**
 * Turn an HTML syllabus page into readable text plus its outbound links.
 * Deliberately regex-based: tolerance matters more than DOM fidelity here,
 * and it keeps the project dependency-free.
 */

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '\u2013',
  mdash: '\u2014',
  hellip: '\u2026',
  rsquo: '\u2019',
  lsquo: '\u2018',
  ldquo: '\u201c',
  rdquo: '\u201d',
  deg: '\u00b0',
  times: '\u00d7',
  middot: '\u00b7',
  bull: '\u2022',
  euro: '\u20ac',
  rupee: '\u20b9',
};

export function decodeEntities(input) {
  return String(input).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(Math.min(code, 0x10ffff)) : match;
    }
    const key = body.toLowerCase();
    return Object.prototype.hasOwnProperty.call(ENTITIES, key) ? ENTITIES[key] : match;
  });
}

const BLOCK_TAGS =
  /<\/?(?:p|div|br|li|tr|h[1-6]|section|article|header|footer|table|thead|tbody|blockquote|pre|hr|ul|ol|dl|dt|dd|figure|figcaption|form|nav|main|aside)\b[^>]*>/gi;

const CELL_TAGS = /<\/(?:td|th)\s*>/gi;

export function htmlToText(html) {
  let s = String(html);
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(script|style|noscript|svg|iframe|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  s = s.replace(/<(?:script|style|svg|iframe)\b[^>]*\/?>/gi, ' ');
  // Keep cell boundaries as tabs so tables survive as aligned-ish rows.
  s = s.replace(CELL_TAGS, '\t');
  s = s.replace(BLOCK_TAGS, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  s = s.replace(/\r\n?/g, '\n');
  s = s.replace(/[ \t\f\v\u00a0]+/g, ' ');
  s = s.replace(/ *\n */g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/** Extract anchors: {href (absolute), text}. */
export function extractLinks(html, baseUrl) {
  const out = [];
  const seen = new Set();
  const re = /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const rawHref = m[1] ?? m[2] ?? m[3] ?? '';
    if (!rawHref || /^(?:javascript:|mailto:|tel:|#)/i.test(rawHref)) continue;
    let absolute;
    try {
      absolute = new URL(decodeEntities(rawHref), baseUrl).href;
    } catch {
      continue;
    }
    const text = htmlToText(m[4]).slice(0, 200);
    const key = absolute.replace(/#.*$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ href: key, text });
  }
  return out;
}

/** Pull likely syllabus/paper PDF links out of a page. */
export function pickDocumentLinks(links, { pattern } = {}) {
  const rx = pattern ?? /(syllabus|curriculum|scheme|question\s*paper|model\s*paper|\bqp\b)/i;
  return links.filter((l) => /\.pdf(?:$|\?)/i.test(l.href) || rx.test(l.text));
}

export function htmlTitle(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(html));
  return m ? htmlToText(m[1]).slice(0, 300) : '';
}
