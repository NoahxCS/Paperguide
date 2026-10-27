/**
 * Demo mode.
 *
 * Replays a cached run for a bundled real KTU paper so a slow model, a rate
 * limit or a dead network cannot ruin a screen recording. The cached payloads
 * are the exact objects the live pipeline produces, so the normal flow - and
 * therefore the confirmation cards - still run, they just never call out.
 *
 * If the bundle is missing or unreadable we say so plainly and fall back to the
 * live path rather than showing a half-filled screen.
 */

export class DemoError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'DemoError';
    this.code = code ?? 'DEMO_ERROR';
  }
}

async function getJson(path) {
  let response;
  try {
    response = await fetch(path, { cache: 'no-store' });
  } catch (err) {
    throw new DemoError(`Could not load the demo bundle (${err?.message ?? err}).`, 'DEMO_UNREACHABLE');
  }
  if (!response.ok) {
    throw new DemoError(`The demo bundle is missing: ${path} returned HTTP ${response.status}.`, 'DEMO_MISSING');
  }
  return response.json();
}

async function getText(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new DemoError(`The demo paper is missing (${path}).`, 'DEMO_MISSING');
  return response.text();
}

let manifestCache = null;

export async function loadDemoManifest() {
  if (!manifestCache) manifestCache = await getJson('/demo/index.json');
  return manifestCache;
}

/** @returns {Promise<{meta:object, paperText:string, scope:object, syllabus:object, segmentation:object, analysis:object, persona:object}>} */
export async function loadDemoBundle(id) {
  const manifest = await loadDemoManifest();
  const entry = (manifest.papers ?? []).find((p) => p.id === id) ?? (manifest.papers ?? [])[0];
  if (!entry) throw new DemoError('The demo manifest lists no papers.', 'DEMO_EMPTY');

  const files = entry.files ?? {};
  const base = '/demo/';
  const require = (name) => {
    if (!files[name]) throw new DemoError(`The demo manifest is missing the "${name}" entry for ${entry.id}.`, 'DEMO_INCOMPLETE');
    return base + files[name];
  };

  const [paperText, scope, syllabus, segmentation, analysis, persona] = await Promise.all([
    getText(require('paperText')),
    getJson(require('scope')),
    getJson(require('syllabus')),
    getJson(require('segmentation')),
    getJson(require('analysis')),
    getJson(require('persona')),
  ]);

  return { meta: entry, paperText, scope, syllabus, segmentation, analysis, persona };
}

/** Short, honest label shown wherever demo data is used. */
export const DEMO_LABEL = 'Demo mode - cached result, no API calls';
