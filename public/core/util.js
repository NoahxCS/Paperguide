/** Small shared helpers. */

export function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

export function unique(array) {
  return [...new Set(array)];
}

export function pct(value, digits = 0) {
  if (!Number.isFinite(value)) return '\u2013';
  return `${value.toFixed(digits)}%`;
}

export function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function sum(numbers) {
  return numbers.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/\n/g, '&#10;');
}

/** Pluralise: pluralise(1,'question') -> '1 question'. */
export function pluralise(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural ?? `${singular}s`}`;
}

export function formatMinutes(minutes) {
  if (!Number.isFinite(minutes)) return '\u2013';
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${m} min`;
  if (!rest) return `${h} h`;
  return `${h} h ${rest} min`;
}

export function timeAgo(ts) {
  const seconds = Math.round((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

/** Extract a rough value for a numeric-looking string ("9 marks" -> 9). */
export function firstNumber(text) {
  const m = /-?\d+(?:\.\d+)?/.exec(String(text ?? ''));
  return m ? Number(m[0]) : null;
}

/** Stable id for a UI element. */
let counter = 0;
export function uid(prefix = 'u') {
  counter += 1;
  return `${prefix}-${counter}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Order Bloom levels numerically; unknown -> null. */
export function bloomNumber(level) {
  const m = /K?L?\s*([1-6])/i.exec(String(level ?? ''));
  return m ? Number(m[1]) : null;
}
