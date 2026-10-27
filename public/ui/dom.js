/**
 * Tiny DOM helpers.
 *
 * Markup is built from template strings for readability, with every piece of
 * dynamic text passed through `esc()`. Event handling uses delegation so the
 * re-render-on-state-change model stays cheap.
 */
import { escapeHtml } from '../core/util.js';

export const esc = escapeHtml;

/** Parse an HTML string into a DocumentFragment. */
export function frag(markup) {
  const template = document.createElement('template');
  template.innerHTML = String(markup).trim();
  return template.content;
}

/** Parse an HTML string into a single element. */
export function el(markup) {
  return frag(markup).firstElementChild;
}

export function clear(node) {
  if (node) node.replaceChildren();
  return node;
}

export function replace(node, markup) {
  node.replaceChildren(frag(markup));
  return node;
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

/** Delegated listener: on(container, 'click', '[data-act]', handler). */
export function on(root, type, selector, handler, options) {
  root.addEventListener(
    type,
    (event) => {
      const match = event.target instanceof Element ? event.target.closest(selector) : null;
      if (match && root.contains(match)) handler(event, match);
    },
    options
  );
}

export function autoGrow(textarea, max = 220) {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(max, textarea.scrollHeight)}px`;
}

/* ---------------------------------------------------------------- toasts */

const TOAST_HOST_ID = 'toasts';

export function toast(message, kind = 'info', ms = 4200) {
  const host = document.getElementById(TOAST_HOST_ID);
  if (!host) return;
  const node = el(`<div class="toast ${kind === 'error' ? 'toast-error' : kind === 'ok' ? 'toast-ok' : ''}">${esc(message)}</div>`);
  host.appendChild(node);
  setTimeout(() => {
    node.style.transition = 'opacity .2s ease';
    node.style.opacity = '0';
    setTimeout(() => node.remove(), 220);
  }, ms);
}

/* ---------------------------------------------------------------- formatting bits */

export function severityBadge(severity) {
  const cls = severity === 'high' ? 'badge-danger' : severity === 'medium' ? 'badge-warn' : 'badge';
  return `<span class="badge ${cls}">${esc(severity ?? 'info')}</span>`;
}

export function typeLabel(type) {
  return String(type ?? '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Heat colour index for a percentage, 0-5.
 * The scale is intentionally stepped so a screen recording reads clearly.
 */
export function heatLevel(percent) {
  if (!Number.isFinite(percent)) return 0;
  if (percent <= 0.01) return 0;
  if (percent < 15) return 1;
  if (percent < 22) return 2;
  if (percent < 28) return 3;
  if (percent < 36) return 4;
  return 5;
}

export function heatCell(percent, label) {
  const level = heatLevel(percent);
  return `<span class="heat heat-${level}" title="${esc(label ?? '')}">${percent == null ? '&ndash;' : `${percent}%`}</span>`;
}

export function heatLegend(label = 'share of the answerable marks') {
  return `<div class="heat-legend"><span>0%</span>${[0, 1, 2, 3, 4, 5]
    .map((i) => `<i class="heat-${i}"></i>`)
    .join('')}<span>36%+</span><span>= ${esc(label)}</span></div>`;
}

export function bar(valuePercent, accent) {
  const v = Math.max(0, Math.min(100, Number(valuePercent) || 0));
  return `<span class="bar" title="${v.toFixed(1)}%"><span class="bar-fill" style="left:0;width:${v}%;background:${accent ?? 'var(--accent)'}"></span></span>`;
}

export function callout(kind, title, body, actionsHtml = '') {
  const icon = kind === 'error' ? '!' : kind === 'warn' ? '!' : kind === 'ok' ? '\u2713' : 'i';
  return `<div class="callout callout-${kind}">
    <span class="callout-icon" aria-hidden="true">${icon}</span>
    <div class="callout-body">
      ${title ? `<strong>${esc(title)}</strong>` : ''}
      <p>${body}</p>
      ${actionsHtml ? `<div class="btn-row" style="margin-top:9px">${actionsHtml}</div>` : ''}
    </div>
  </div>`;
}

/** Scroll the chat to the bottom on the next frame. */
export function scrollToBottom(host) {
  requestAnimationFrame(() => {
    host.scrollTop = host.scrollHeight;
  });
}
