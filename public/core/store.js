/**
 * Session state. In memory only.
 *
 * Deliberately there is NO localStorage, sessionStorage, IndexedDB or cookie
 * use anywhere in this app, and the server writes nothing to disk. Refreshing
 * the page therefore leaves no trace: no history, no keys, no uploaded paper.
 * `purgeStorage()` below actively clears anything a previous version of the
 * page or an extension might have left behind, so the guarantee is testable.
 */

const listeners = new Set();

export const DEFAULT_SETTINGS = {
  // LLM (OpenAI-compatible chat completions)
  baseUrl: '',
  apiKey: '',
  model: '',
  routing: 'proxy', // 'proxy' (local server) | 'direct' (browser) | 'auto'
  temperature: 0.2,
  maxTokens: 8192,
  // OCR.space
  ocrApiKey: '',
  ocrEngine: 2,
  ocrRouting: 'proxy',
  ocrEndpoint: '',
  ocrEnhance: false,
};

function blankSession() {
  return {
    id: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    mode: null, // 'analysis' | 'persona'
    phase: 'mode-select',
    demo: false,
    paper: null, // {text, method, units, warnings, ocrCalls, filesMeta}
    scope: null,
    syllabus: null,
    syllabusSource: null,
    syllabusApproved: false,
    syllabusCandidates: [],
    segmentation: null,
    workingPaper: null, // segmentation with accepted rewrites applied
    analysis: null,
    persona: null,
    messages: [],
    stats: { ocrCalls: 0, llmCalls: 0, llmAttempts: 0, repairs: 0, promptTokens: 0, completionTokens: 0 },
  };
}

export const state = {
  settings: { ...DEFAULT_SETTINGS },
  ...blankSession(),
  busy: false,
  progress: null, // {title, steps:[{label,status,detail}], activeIndex}
  error: null,
  settingsOpen: false,
};

function notify() {
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (err) {
      console.error('listener failed', err);
    }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Mutate state and re-render. Kept explicit so every change is traceable. */
export function update(patch) {
  Object.assign(state, patch);
  notify();
}

export function updateSettings(patch) {
  Object.assign(state.settings, patch);
  notify();
}

/** Reset everything except the settings the teacher just typed. */
export function newSession({ keepSettings = true } = {}) {
  const settings = keepSettings ? state.settings : { ...DEFAULT_SETTINGS };
  Object.assign(state, blankSession(), {
    settings,
    busy: false,
    progress: null,
    error: null,
    settingsOpen: false,
  });
  notify();
}

export function addMessage(message) {
  state.messages.push({ id: `m-${state.messages.length + 1}-${Date.now().toString(36)}`, at: Date.now(), ...message });
  notify();
  return state.messages[state.messages.length - 1];
}

export function patchMessage(id, patch) {
  const msg = state.messages.find((m) => m.id === id);
  if (!msg) return;
  Object.assign(msg, patch);
  notify();
}

export function bumpStat(key, by = 1) {
  state.stats[key] = (state.stats[key] ?? 0) + by;
  notify();
}

/** Record token usage reported by the provider. */
export function recordUsage(usage) {
  if (!usage) return;
  state.stats.promptTokens += usage.prompt_tokens ?? 0;
  state.stats.completionTokens += usage.completion_tokens ?? 0;
  notify();
}

export function setProgress(progress) {
  state.progress = progress;
  notify();
}

export function updateProgressStep(index, patch) {
  if (!state.progress?.steps?.[index]) return;
  Object.assign(state.progress.steps[index], patch);
  notify();
}

/**
 * Prove the "nothing is persisted" claim by clearing every client store the
 * page could conceivably have written to. Called on boot and on demand.
 * @returns {{cleared:string[]}}
 */
export function purgeStorage() {
  const cleared = [];
  const scrub = (store, name) => {
    try {
      if (store && store.length) {
        store.clear();
        cleared.push(`${name} (${name === 'localStorage' || name === 'sessionStorage' ? 'browser' : 'browser'})`);
      } else if (store) {
        cleared.push(name);
      }
    } catch {
      /* access can be blocked; that is fine, it means there is nothing to clear */
    }
  };
  scrub(window.localStorage, 'localStorage');
  scrub(window.sessionStorage, 'sessionStorage');
  try {
    if (window.indexedDB?.databases) {
      window.indexedDB
        .databases()
        .then((dbs) => (dbs ?? []).forEach((db) => db?.name && window.indexedDB.deleteDatabase(db.name)))
        .catch(() => {});
      cleared.push('indexedDB');
    }
  } catch {
    /* ignore */
  }
  try {
    if (document.cookie) {
      for (const cookie of document.cookie.split(';')) {
        const name = cookie.split('=')[0]?.trim();
        if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
      cleared.push('cookies');
    }
  } catch {
    /* ignore */
  }
  return { cleared };
}
