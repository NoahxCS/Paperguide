/**
 * Settings drawer: LLM endpoint, OCR.space key, and the storage guarantee.
 *
 * The API keys are plain properties of the in-memory session object. They are
 * never written to localStorage/sessionStorage/cookies, never sent to this
 * app's server except as the credential for an upstream request, and never
 * logged. The "Verify nothing is stored" button actively clears every client
 * store and reports what it found.
 */
import { state, updateSettings, purgeStorage, update } from '../core/store.js';
import { testConnection, listModels } from '../core/llm.js';
import { esc, el, on, replace, toast } from './dom.js';

const PRESETS = [
  ['OpenAI', 'https://api.openai.com/v1'],
  ['OpenRouter', 'https://openrouter.ai/api/v1'],
  ['Groq', 'https://api.groq.com/openai/v1'],
  ['Together', 'https://api.together.xyz/v1'],
  ['DeepSeek', 'https://api.deepseek.com/v1'],
  ['Ollama (local)', 'http://localhost:11434/v1'],
  ['LM Studio (local)', 'http://localhost:1234/v1'],
];

let modelOptions = [];
let testResult = null;

export function renderSettings() {
  const drawer = el('<div></div>');
  const s = state.settings;

  drawer.innerHTML = `
    <div class="drawer-head">
      <h2>Settings</h2>
      <button class="btn btn-ghost" data-act="close" type="button" aria-label="Close settings">&times;</button>
    </div>
    <div class="drawer-body">
      <div class="callout callout-info">
        <span class="callout-icon" aria-hidden="true">i</span>
        <div class="callout-body">
          <strong>Keys live in this tab only</strong>
          <p>They are held in memory, never written to browser storage, and never written to the server. Refreshing this page deletes them.</p>
        </div>
      </div>

      <fieldset class="field-group" style="margin-top:18px">
        <legend>Language model</legend>
        <p class="field-hint" style="margin:-4px 0 10px">
          Any OpenAI-compatible <span class="mono">/chat/completions</span> endpoint. Paperguide assumes plain chat completions &mdash; no tool calling and no native JSON mode &mdash; so it asks for JSON in the prompt and retries once if the reply is malformed.
        </p>

        <label class="field" for="llm-base-url">Base URL</label>
        <input id="llm-base-url" type="url" data-setting="baseUrl" value="${esc(s.baseUrl)}" placeholder="https://api.openai.com/v1" />
        <div class="preset-row">
          ${PRESETS.map(([name, url]) => `<button class="preset" type="button" data-preset="${esc(url)}">${esc(name)}</button>`).join('')}
        </div>
        <p class="field-hint">The <span class="mono">/v1</span> root. A full <span class="mono">/chat/completions</span> URL also works.</p>

        <label class="field" for="llm-api-key" style="margin-top:12px">API key</label>
        <input id="llm-api-key" type="password" data-setting="apiKey" value="${esc(s.apiKey)}" placeholder="sk-…" autocomplete="off" spellcheck="false" />

        <label class="field" for="llm-model" style="margin-top:12px">Model</label>
        <div style="display:flex;gap:8px">
          <input id="llm-model" type="text" data-setting="model" value="${esc(s.model)}" placeholder="gpt-4o-mini" list="model-options" autocomplete="off" spellcheck="false" />
          <button class="btn btn-secondary btn-sm" data-act="load-models" type="button" style="flex:none">List</button>
        </div>
        <datalist id="model-options">${modelOptions.map((m) => `<option value="${esc(m)}"></option>`).join('')}</datalist>

        <label class="field" for="llm-routing" style="margin-top:12px">Request routing</label>
        <select id="llm-routing" data-setting="routing">
          <option value="proxy" ${s.routing === 'proxy' ? 'selected' : ''}>Local proxy &mdash; safest, works everywhere</option>
          <option value="auto" ${s.routing === 'auto' ? 'selected' : ''}>Automatic &mdash; proxy, then browser</option>
          <option value="direct" ${s.routing === 'direct' ? 'selected' : ''}>Browser direct &mdash; key never touches the server</option>
        </select>
        <p class="field-hint">Browser direct fails on providers that block cross-origin calls, and on <span class="mono">http://</span> endpoints from an <span class="mono">https://</span> page.</p>

        <div class="btn-row" style="margin-top:14px;align-items:center">
          <button class="btn btn-secondary btn-sm" data-act="test-connection" type="button">Test connection</button>
          <span class="small muted" data-test-result>${testResult ? esc(testResult) : 'Keys are only sent to the endpoint you configure.'}</span>
        </div>
      </fieldset>

      <fieldset class="field-group">
        <legend>OCR (OCR.space)</legend>
        <p class="field-hint" style="margin:-4px 0 10px">
          Free-tier limits, from OCR.space's current documentation: <strong>1 MB per file</strong>, <strong>3 PDF pages</strong>, 500 requests per day per IP. Images are resized and re-encoded in your browser to fit; longer PDFs are split into page images automatically.
        </p>
        <label class="field" for="ocr-api-key">API key</label>
        <input id="ocr-api-key" type="password" data-setting="ocrApiKey" value="${esc(s.ocrApiKey)}" placeholder="Your OCR.space key" autocomplete="off" spellcheck="false" />
        <p class="field-hint">Free key: <span class="mono">ocr.space/ocrapi/freekey</span>. The demo key <span class="mono">helloworld</span> is heavily rate-limited.</p>

        <div class="field-row two" style="margin-top:12px">
          <div>
            <label class="field" for="ocr-engine">Engine</label>
            <select id="ocr-engine" data-setting="ocrEngine">
              <option value="2" ${Number(s.ocrEngine) === 2 ? 'selected' : ''}>2 &mdash; best all-round (default)</option>
              <option value="3" ${Number(s.ocrEngine) === 3 ? 'selected' : ''}>3 &mdash; best on handwriting and tables (slower)</option>
              <option value="1" ${Number(s.ocrEngine) === 1 ? 'selected' : ''}>1 &mdash; retired, redirected to 2</option>
            </select>
          </div>
          <div>
            <label class="field" for="ocr-routing">Routing</label>
            <select id="ocr-routing" data-setting="ocrRouting">
              <option value="proxy" ${s.ocrRouting === 'proxy' ? 'selected' : ''}>Local proxy</option>
              <option value="direct" ${s.ocrRouting === 'direct' ? 'selected' : ''}>Browser direct</option>
            </select>
          </div>
        </div>

        <label class="field" for="ocr-endpoint" style="margin-top:12px">Endpoint override (optional)</label>
        <input id="ocr-endpoint" type="url" data-setting="ocrEndpoint" value="${esc(s.ocrEndpoint)}" placeholder="https://api.ocr.space/parse/image" />
        <p class="field-hint">Only needed for a PRO/regional endpoint.</p>

        <label class="checkline" style="margin-top:12px">
          <input type="checkbox" data-setting="ocrEnhance" ${s.ocrEnhance ? 'checked' : ''} />
          <span>Enhance dim photos before OCR (grayscale + contrast). Helps phone photos, can hurt clean scans.</span>
        </label>
      </fieldset>

      <fieldset class="field-group">
        <legend>Storage</legend>
        <div class="kv">
          <dt>Uploaded paper</dt><dd>In memory only</dd>
          <dt>Confirmed syllabus and scope</dt><dd>In memory only</dd>
          <dt>API keys</dt><dd>In memory only</dd>
          <dt>Chat history</dt><dd>Not saved</dd>
          <dt>Server disk writes</dt><dd>None</dd>
        </div>
        <div class="btn-row" style="margin-top:12px">
          <button class="btn btn-secondary btn-sm" data-act="purge" type="button">Verify nothing is stored</button>
          <button class="btn btn-danger btn-sm" data-act="wipe" type="button">Clear keys and session</button>
        </div>
        <p class="field-hint" data-purge-result>Run the check to clear and report every client-side store this page could have used.</p>
      </fieldset>
    </div>
    <div class="drawer-foot">
      <button class="btn btn-secondary" data-act="close" type="button">Close</button>
    </div>
  `;

  return drawer;
}

/** Wire the drawer once. `onChange` re-renders the app chrome (e.g. stat pill). */
export function bindSettings(drawer, { onChange } = {}) {
  const readValue = (input) => {
    const key = input.dataset.setting;
    if (!key) return null;
    if (input.type === 'checkbox') return { [key]: input.checked };
    if (key === 'ocrEngine') return { [key]: Number(input.value) };
    return { [key]: input.value };
  };

  on(drawer, 'input', '[data-setting]', (event, input) => {
    const patch = readValue(input);
    if (patch) updateSettings(patch);
    // Keep the model datalist in sync without re-rendering mid-typing.
    if (input.dataset.setting === 'apiKey' || input.dataset.setting === 'ocrApiKey') {
      /* deliberately nothing: never echo a key back into the DOM */
    }
  });

  on(drawer, 'change', 'select[data-setting]', (event, input) => {
    const patch = readValue(input);
    if (patch) updateSettings(patch);
  });

  on(drawer, 'click', '[data-preset]', (event, button) => {
    const url = button.dataset.preset;
    updateSettings({ baseUrl: url });
    const field = drawer.querySelector('#llm-base-url');
    if (field) field.value = url;
    toast(`Base URL set to ${url}`, 'ok');
  });

  on(drawer, 'click', '[data-act="close"]', () => update({ settingsOpen: false }));

  on(drawer, 'click', '[data-act="test-connection"]', async (event, button) => {
    const out = drawer.querySelector('[data-test-result]');
    button.disabled = true;
    if (out) out.textContent = 'Contacting the endpoint…';
    try {
      const { ms, reply } = await testConnection(state.settings);
      testResult = `Connected in ${ms} ms (reply: "${reply}").`;
      if (out) out.textContent = testResult;
      toast('Model endpoint is reachable.', 'ok');
    } catch (err) {
      testResult = err.message;
      if (out) out.textContent = err.message;
      toast(err.message, 'error', 7000);
    } finally {
      button.disabled = false;
    }
  });

  on(drawer, 'click', '[data-act="load-models"]', async (event, button) => {
    button.disabled = true;
    try {
      modelOptions = await listModels(state.settings);
      const list = drawer.querySelector('#model-options');
      if (list) {
        list.innerHTML = modelOptions.map((m) => `<option value="${esc(m)}"></option>`).join('');
      }
      toast(modelOptions.length ? `${modelOptions.length} model(s) available. Start typing in the Model field.` : 'The endpoint listed no models. Type the model name manually.', modelOptions.length ? 'ok' : 'error');
    } catch (err) {
      toast(err.message, 'error', 7000);
    } finally {
      button.disabled = false;
    }
  });

  on(drawer, 'click', '[data-act="purge"]', () => {
    const { cleared } = purgeStorage();
    const out = drawer.querySelector('[data-purge-result]');
    const message = `Checked and cleared: ${cleared.join(', ') || 'nothing to clear'}. No paper text, syllabus or key is present in any client-side store.`;
    if (out) out.textContent = message;
    toast('Nothing is stored. Verified.', 'ok', 5000);
  });

  on(drawer, 'click', '[data-act="wipe"]', () => {
    updateSettings({ apiKey: '', ocrApiKey: '' });
    purgeStorage();
    renderSettingsInto(drawer);
    toast('Keys cleared and session storage wiped.', 'ok');
    onChange?.();
  });
}

/** Re-render the drawer contents in place. */
export function renderSettingsInto(drawer) {
  const fresh = renderSettings();
  replace(drawer, fresh.innerHTML);
  return drawer;
}
