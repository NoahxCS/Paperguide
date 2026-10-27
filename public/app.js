/**
 * Paperguide - application shell and conversation flow.
 *
 * The flow is: paper text -> confirmed scope -> confirmed syllabus ->
 * confirmed segmentation -> Mode A or Mode B report. Every confirmation is a
 * card in the chat, and nothing downstream runs on an unconfirmed input.
 *
 * All state is in memory (see core/store.js). There is no persistence anywhere.
 */
import {
  state,
  subscribe,
  update,
  updateSettings,
  newSession,
  addMessage,
  patchMessage,
  purgeStorage,
  recordUsage,
  bumpStat,
  setProgress,
  updateProgressStep,
} from './core/store.js';
import { toAppError, errorCalloutHtml, AppError } from './core/errors.js';
import { callJson } from './core/llm.js';
import { extractPaperText } from './core/ocr.js';
import { bytesToSize, isPdfFile } from './core/imaging.js';
import {
  searchSyllabusCandidates,
  fetchSyllabusDocument,
  parseSyllabusText,
  syllabusFromIndexCourse,
  loadSeedIndex,
  resolvePattern,
  detectPatternFromText,
} from './core/syllabus.js';
import { buildScopePrompt, buildSegmentationPrompt, KTU_2024_DEFAULT_PATTERN, KTU_2024_HMC_PATTERN, PROMPT_VERSION } from './prompts/prompts.js';
import { runAnalysis, applyRewrite, applySuggestion } from './core/analysis.js';
import { runPersonaPrediction } from './core/persona.js';
import { loadDemoBundle, DEMO_LABEL } from './core/demo.js';
import { esc, el, on, replace, toast, scrollToBottom, autoGrow, callout } from './ui/dom.js';
import {
  uiState,
  renderProgress,
  renderPaperCard,
  renderScopeCard,
  renderCandidatesCard,
  renderSyllabusCard,
  renderSegmentationCard,
  renderAttachments,
} from './ui/cards.js';
import { renderAnalysisReport, renderPersonaReport, renderFlagCard } from './ui/report.js';
import { renderSettings, bindSettings } from './ui/settings.js';

const $ = (id) => document.getElementById(id);
const chat = $('chat');
const input = $('input');
const fileInput = $('file-input');
const attachmentsHost = $('attachments');
const drawer = $('settings-drawer');
const scrim = $('drawer-scrim');

/** Files staged in the composer but not yet processed. */
let pendingFiles = [];

/** Live progress state for the current operation. */
let progressState = null;
let activeProgressIndex = -1;
let abortController = null;

/** Extra context carried between steps. */
const ctx = {
  pattern: null,
  moduleChoices: [],
  syllabusCandidates: [],
  syllabusWarnings: [],
  syllabusCourseHint: '',
  lastScopeMessage: '',
  demoBundle: null,
};

/* ================================================================ progress UI */

function beginProgress(title, steps, badge = '') {
  progressState = { title, badge, steps: steps.map((label) => ({ label, status: 'pending', detail: '' })) };
  setProgress(progressState);
  activeProgressIndex = -1;
  renderChat();
  return {
    step(label, detail) {
      const index = progressState.steps.findIndex((s) => s.label === label && s.status === 'pending');
      if (index >= 0) {
        if (activeProgressIndex >= 0 && activeProgressIndex < index) progressState.steps[activeProgressIndex].status = 'done';
        progressState.steps[index].status = 'active';
        if (detail) progressState.steps[index].detail = detail;
        activeProgressIndex = index;
      } else if (activeProgressIndex >= 0) {
        const current = progressState.steps[activeProgressIndex];
        current.status = 'done';
        current.detail = detail || current.detail;
      }
      updateProgressNode();
    },
    finish(detail = '') {
      for (const s of progressState.steps) {
        if (s.status !== 'error') {
          s.status = 'done';
          if (s === progressState.steps[progressState.steps.length - 1] && detail) s.detail = detail;
        }
      }
      updateProgressNode();
    },
    fail(message) {
      const idx = activeProgressIndex >= 0 ? activeProgressIndex : progressState.steps.length - 1;
      progressState.steps[idx].status = 'error';
      progressState.steps[idx].detail = message;
      updateProgressNode();
    },
    setDetail(detail) {
      if (activeProgressIndex >= 0) progressState.steps[activeProgressIndex].detail = detail;
      updateProgressNode();
    },
  };
}

function progressNode() {
  return chat.querySelector('[data-progress]');
}

function updateProgressNode() {
  const node = progressNode();
  if (node && progressState) {
    node.innerHTML = renderProgress(progressState);
    scrollToBottom(chat);
  }
}

/* ================================================================ chat rendering */

function renderChat() {
  const previousScroll = chat.scrollTop;
  const nearBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 140;

  const blocks = state.messages.map(renderMessage);
  if (progressState && !state.messages.some((m) => m.kind === 'progress')) {
    blocks.push(`<div data-progress>${renderProgress(progressState)}</div>`);
  }
  // The landing screen is the mode chooser. It stays at the top until a mode is
  // chosen, so the two choices are always visible on a fresh session.
  if (!state.mode) blocks.unshift(renderEmptyState());

  replace(chat, `<div class="chat-inner">${blocks.join('')}</div>`);
  chat.scrollTop = nearBottom ? chat.scrollHeight : previousScroll;
  renderHeaderState();
}

function renderMessage(message) {
  if (message.kind === 'progress') {
    return `<div data-progress>${renderProgress(message.progress)}</div>`;
  }
  if (message.role === 'user') {
    return `<div class="msg msg-user"><div class="bubble">${esc(message.text ?? '')}</div>${
      message.meta ? `<div class="msg-note">${esc(message.meta)}</div>` : ''
    }</div>`;
  }
  return `<div class="msg msg-assistant">
    <div class="msg-role">Paperguide</div>
    <div class="body">${message.html ?? esc(message.text ?? '')}</div>
    ${message.actions ?? ''}
  </div>`;
}

function renderHeaderState() {
  const pill = $('stat-pill');
  if (!pill) return;
  const bits = [];
  if (state.demo) bits.push('demo');
  if (state.mode) bits.push(state.mode === 'analysis' ? 'Question Analysis' : 'Persona Prediction');
  if (state.stats.ocrCalls) bits.push(`${state.stats.ocrCalls} OCR`);
  if (state.stats.llmCalls) bits.push(`${state.stats.llmCalls} LLM`);
  const repaired = state.stats.repairs;
  if (repaired) bits.push(`${repaired} repaired`);
  pill.hidden = bits.length === 0;
  pill.textContent = bits.join(' · ');
}

function renderEmptyState() {
  const modeCard = (mode, tag, title, blurb, bullets) => `
    <button class="mode-card" type="button" data-act="start-mode" data-mode="${mode}">
      <h2>${esc(title)} ${tag}</h2>
      <p>${esc(blurb)}</p>
      <ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
    </button>`;

  return `
    <div class="hero">
      <h1>Check a KTU question paper before you print it</h1>
      <p>Upload a photograph, a PDF, or paste the text. Paperguide reads it, confirms the scope and the 2024-scheme syllabus with you, then either audits the paper or predicts how weak, average and strong students would experience it.</p>
      <p class="hero-sub">Nothing is saved. Refreshing this page clears the paper, the syllabus and your API keys.</p>
      <div class="mode-grid">
        ${modeCard(
          'analysis',
          '<span class="mode-tag">Mode A</span>',
          'Question Analysis',
          'Audit the paper against the confirmed syllabus.',
          [
            'Coverage and mark weightage per module and course outcome',
            'Ambiguity and fairness linter, each flag with a reason and a rewrite',
            'Alternative questions at the Bloom\u2019s level you choose',
            'Out-of-scope questions and uncovered topics called out',
          ]
        )}
        ${modeCard(
          'persona',
          '<span class="mode-tag">Mode B</span>',
          'Student Persona Prediction',
          'Predict how three student types would experience each question.',
          [
            'Weak, average and strong persona cards you can see and trust',
            'Per question: score band, likely pitfall, the exact trigger, time spent',
            'Which questions separate the personas and which do not',
            'Time feasibility against the exam duration',
          ]
        )}
      </div>
    </div>`;
}

/* ================================================================ helpers */

function say(text, opts = {}) {
  addMessage({ role: 'assistant', kind: opts.kind ?? 'text', text, html: opts.html, actions: opts.actions });
  renderChat();
}

function block(html) {
  addMessage({ role: 'assistant', kind: 'block', html });
  renderChat();
}

function userSays(text, meta) {
  addMessage({ role: 'user', text, meta });
  renderChat();
}

function addError(err, actionsHtml = '') {
  const appError = toAppError(err);
  block(errorCalloutHtml(appError, actionsHtml));
  return appError;
}

function setBusy(busy) {
  update({ busy });
  input.disabled = busy;
  $('btn-send').disabled = busy || (!input.value.trim() && !pendingFiles.length);
  $('btn-stop').hidden = !busy;
  $('btn-attach').disabled = busy;
}

function clearProgress() {
  progressState = null;
  setProgress(null);
}

function needsLlm() {
  return !state.settings.model?.trim() || !state.settings.baseUrl?.trim();
}

function llmMissingCard(nextAction) {
  return block(
    callout(
      'warn',
      'No model configured',
      'Paperguide uses your own OpenAI-compatible endpoint. Add the base URL, API key and model in Settings, then continue. The keys stay in this tab.',
      `<button class="btn btn-primary btn-sm" data-act="open-settings" type="button">Open Settings</button>
       ${nextAction ? `<button class="btn btn-secondary btn-sm" data-act="retry-step" type="button">Retry this step</button>` : ''}`
    )
  );
}

function currentPattern() {
  if (ctx.pattern) return ctx.pattern;
  const detected = state.paper?.text ? detectPatternFromText(state.paper.text) : null;
  const resolved = resolvePattern({
    syllabusPattern: state.syllabus ? { parts: state.syllabus.paperPattern } : null,
    teacherPattern: state.scope?.paperStructure,
    paperText: state.paper?.text ?? '',
    detectedFromPaper: detected,
  });
  ctx.pattern = resolved.pattern;
  return ctx.pattern;
}

/** Ask the model for a structured object, tolerating the demo path. */
async function llmJson(prompt, { demoValue = null } = {}) {
  if (state.demo && demoValue) return { value: demoValue, attempts: 1, repaired: false, usage: null };
  const result = await callJson({
    settings: state.settings,
    prompt,
    onProgress: ({ message }) => {
      const label = progressState?.steps?.[activeProgressIndex]?.label ?? 'Working';
      if (progressState) activeProgressIndex >= 0 && updateProgressStep(activeProgressIndex, { detail: message });
    },
  });
  bumpStat('llmCalls');
  bumpStat('llmAttempts', result.attempts);
  if (result.repaired) bumpStat('repairs');
  recordUsage(result.usage);
  return result;
}

/* ================================================================ step 1: paper */

async function ingestPaper({ pastedText = '', files = [] } = {}) {
  const steps =
    files.length && files.some(isPdfFile)
      ? ['Reading the file', 'Extracting text', 'Preparing the review']
      : ['Preparing the image', 'Reading with OCR', 'Preparing the review'];
  const progress = beginProgress('Reading the paper', steps);
  setBusy(true);

  try {
    if (state.demo && ctx.demoBundle) {
      progress.step(steps[0], DEMO_LABEL);
      await new Promise((r) => setTimeout(r, 260));
      progress.step(steps[1], 'Cached OCR text replayed');
      await new Promise((r) => setTimeout(r, 260));
      progress.step(steps[2]);
      clearProgress();
      update({
        paper: {
          text: ctx.demoBundle.paperText,
          method: 'image',
          units: [{ kind: 'image', label: `${ctx.demoBundle.meta.courseCode} paper (cached)`, text: ctx.demoBundle.paperText, note: DEMO_LABEL }],
          warnings: [],
          ocrCalls: 0,
          bytesIn: 0,
          source: 'demo',
        },
      });
      state.stats.ocrCalls += 0;
      showPaperReview();
      return;
    }

    progress.step(steps[0]);
    const result = await extractPaperText({
      files,
      pastedText,
      settings: state.settings,
      onProgress: ({ message, detail }) => progress.step(message, detail),
    });
    progress.step(steps[2]);
    state.stats.ocrCalls += result.ocrCalls;
    clearProgress();
    update({
      paper: {
        text: result.text,
        method: result.method,
        units: result.units,
        warnings: result.warnings,
        ocrCalls: result.ocrCalls,
        bytesIn: result.bytesIn,
        source: files.length ? 'file' : 'paste',
      },
    });
    showPaperReview();
  } catch (err) {
    progress.fail(err?.message ?? String(err));
    clearProgress();
    const appError = toAppError(err);
    addError(appError, `<button class="btn btn-secondary btn-sm" data-act="retry-paper" type="button">Try again</button>
      <button class="btn btn-secondary btn-sm" data-act="paste-paper" type="button">Paste text instead</button>
      <button class="btn btn-ghost btn-sm" data-act="open-settings" type="button">Check OCR settings</button>`);
    setBusy(false);
  } finally {
    setBusy(false);
  }
}

function showPaperReview() {
  update({ phase: 'ocr-review' });
  block(renderPaperCard(state.paper));
  say(
    state.paper.text.trim()
      ? 'Check the text above. Fix anything OCR got wrong \u2014 every later finding quotes this text. When it reads correctly, continue and tell me about the exam.'
      : 'No text came back. Try a sharper photo, a different file, or paste the text straight into the input bar.'
  );
}

/* ================================================================ step 2: scope */

async function parseScope(message) {
  ctx.lastScopeMessage = message;
  const steps = ['Reading your description', 'Structuring the scope'];
  const progress = beginProgress('Working out the exam scope', steps);
  setBusy(true);
  try {
    if (state.demo && ctx.demoBundle) {
      progress.step(steps[0], DEMO_LABEL);
      await new Promise((r) => setTimeout(r, 240));
      progress.step(steps[1]);
      clearProgress();
      update({ scope: ctx.demoBundle.scope });
      showScopeCard(ctx.demoBundle.scope);
      return;
    }

    // Without a model we cannot read free text, but the teacher can still fill
    // the scope card in by hand and carry on.
    if (needsLlm()) {
      progress.fail('A model is needed to read your description.');
      clearProgress();
      llmMissingCard(true);
      block(
        callout(
          'info',
          'Or fill the scope in by hand',
          'You can complete the scope card yourself and continue. The model is only needed for reading free text, segmenting the paper and the analysis itself.',
          `<button class="btn btn-secondary btn-sm" data-act="fill-scope-manually" type="button">Fill it in by hand</button>`
        )
      );
      return;
    }

    progress.step(steps[0]);
    const prompt = buildScopePrompt({
      message,
      paperText: state.paper?.text ?? '',
      syllabusHint: state.syllabus ? { courseCode: state.syllabus.courseCode, courseTitle: state.syllabus.courseTitle } : null,
      priorScope: state.scope ?? null,
    });
    const result = await llmJson(prompt);
    const scope = { ...result.value };
    // A teacher who names no modules still deserves a usable default.
    if (!scope.modulesInScope?.length && !scope.unresolved?.includes('module scope not stated')) {
      scope.unresolved = [...(scope.unresolved ?? []), 'module scope not stated'];
    }
    if (!scope.totalMarks && state.paper?.text) {
      const detected = detectPatternFromText(state.paper.text);
      const printed = /max\.?\s*marks?\s*[:\-]?\s*(\d+)/i.exec(state.paper.text);
      if (printed) scope.totalMarks = Number(printed[1]);
    }
    progress.step(steps[1]);
    clearProgress();
    update({ scope });
    showScopeCard(scope);
  } catch (err) {
    progress.fail(err?.message ?? String(err));
    clearProgress();
    addError(err, `<button class="btn btn-secondary btn-sm" data-act="fill-scope-manually" type="button">Fill it in by hand</button>`);
  } finally {
    setBusy(false);
  }
}

function showScopeCard(scope) {
  update({ phase: 'scope-review' });
  const modules = state.syllabus?.modules ?? [];
  ctx.moduleChoices = modules.length ? modules.map((m) => ({ number: m.number, title: m.title })) : ctx.moduleChoices;
  const pattern = resolvePattern({
    syllabusPattern: state.syllabus ? { parts: state.syllabus.paperPattern } : null,
    teacherPattern: scope.paperStructure,
    paperText: state.paper?.text ?? '',
  }).pattern;
  ctx.pattern = pattern;
  block(renderScopeCard(scope, { syllabus: state.syllabus, pattern, moduleChoices: ctx.moduleChoices }));
  if (!state.syllabus) {
    say('Confirm the scope, then tell me the course code or name so I can fetch the syllabus.');
  }
}

function readScopeFromCard() {
  const scope = { ...(state.scope ?? {}) };
  const code = chat.querySelector('[data-scope="courseCode"]');
  const title = chat.querySelector('[data-scope="courseTitle"]');
  const marks = chat.querySelector('[data-scope="totalMarks"]');
  const duration = chat.querySelector('[data-scope="durationMinutes"]');
  const classNote = chat.querySelector('[data-scope="classNote"]');
  if (code) scope.courseCode = code.value.trim();
  if (title) scope.courseTitle = title.value.trim();
  if (marks) scope.totalMarks = marks.value === '' ? null : Number(marks.value);
  if (duration) scope.durationMinutes = duration.value === '' ? null : Number(duration.value);
  if (classNote) scope.classNote = classNote.value.trim();
  const boxes = [...chat.querySelectorAll('[data-scope-module]')];
  if (boxes.length) {
    scope.modulesInScope = boxes.filter((b) => b.checked).map((b) => Number(b.dataset.scopeModule));
  }
  return scope;
}

/* ================================================================ step 3: syllabus */

async function findSyllabus(query) {
  ctx.syllabusCourseHint = query;
  const steps = ['Searching the bundled 2024 index', 'Searching KTU sources', 'Ranking the results'];
  const progress = beginProgress('Finding the syllabus', steps);
  setBusy(true);
  try {
    if (state.demo && ctx.demoBundle) {
      progress.step(steps[0], DEMO_LABEL);
      await new Promise((r) => setTimeout(r, 240));
      progress.step(steps[1], 'Cached');
      await new Promise((r) => setTimeout(r, 200));
      progress.step(steps[2]);
      clearProgress();
      update({ syllabus: ctx.demoBundle.syllabus, syllabusSource: 'bundled-index', syllabusCandidates: [] });
      ctx.pattern = null;
      showSyllabusCard('cached demo data (real KTU 2024-scheme syllabus)');
      return;
    }

    progress.step(steps[0]);
    const seed = await loadSeedIndex();
    ctx.moduleChoices = (seed.courses ?? []).map((c) => ({ number: c.code, title: c.title, code: c.code }));

    // Fast path: the bundled index already holds a real parsed syllabus for
    // this course, so no network and no model call are needed at all.
    const needle = query.trim().toLowerCase();
    const exact = (seed.courses ?? []).find(
      (c) => c.code?.toLowerCase() === needle || `${c.code} ${c.title}`.toLowerCase().includes(needle) || c.title?.toLowerCase().includes(needle)
    );
    if (exact?.modules?.length && (needle.includes(exact.code.toLowerCase()) || exact.title.toLowerCase().includes(needle) || needle.length >= 4)) {
      progress.step(steps[1], 'Bundled 2024-scheme data is complete for this course.');
      progress.step(steps[2]);
      clearProgress();
      const syllabus = syllabusFromIndexCourse(exact);
      update({ syllabus, syllabusSource: 'bundled-index', syllabusCandidates: [], syllabusApproved: false });
      ctx.pattern = null;
      showSyllabusCard(`the bundled 2024-scheme index (${exact.code}), captured from real KTU syllabus documents`);
      return;
    }

    progress.step(steps[1]);
    const result = await searchSyllabusCandidates(query, { remote: true });
    progress.step(steps[2]);
    clearProgress();
    ctx.syllabusCandidates = result.candidates ?? [];
    ctx.syllabusWarnings = result.warnings ?? [];
    update({ syllabusCandidates: ctx.syllabusCandidates, phase: 'syllabus-candidates' });
    block(
      renderCandidatesCard({
        query,
        candidates: ctx.syllabusCandidates,
        warnings: ctx.syllabusWarnings,
        sourcesTried: result.sourcesTried,
      })
    );
    if (ctx.syllabusCandidates.length) {
      say('Pick a source, paste a URL, or upload the syllabus PDF. Nothing is used until you approve the parsed modules and outcomes.');
    }
  } catch (err) {
    progress.fail(err?.message ?? String(err));
    clearProgress();
    addError(err, `<button class="btn btn-secondary btn-sm" data-act="syllabus-upload" type="button">Upload the syllabus PDF</button>
      <button class="btn btn-ghost btn-sm" data-act="syllabus-search-again" type="button">Search again</button>`);
  } finally {
    setBusy(false);
  }
}

async function useSyllabusCandidate(index) {
  const candidate = ctx.syllabusCandidates[index];
  if (!candidate) return;
  if (candidate.fromIndex) {
    const seed = await loadSeedIndex();
    const course = (seed.courses ?? []).find((c) => c.code === candidate.courseCode);
    if (course) {
      const syllabus = syllabusFromIndexCourse(course);
      update({ syllabus, syllabusSource: 'bundled-index', syllabusApproved: false });
      ctx.pattern = null;
      showSyllabusCard(`the bundled 2024-scheme index (${course.code})`);
      return;
    }
  }
  await fetchAndParseSyllabus(candidate.url, `the web source ${new URL(candidate.url).hostname}`);
}

async function fetchAndParseSyllabus(url, sourceLabel) {
  const steps = ['Fetching the document', 'Extracting its text', 'Parsing modules and outcomes'];
  const progress = beginProgress('Reading the syllabus', steps);
  setBusy(true);
  try {
    if (state.demo && ctx.demoBundle) {
      progress.step(steps[0], DEMO_LABEL);
      await new Promise((r) => setTimeout(r, 220));
      clearProgress();
      update({ syllabus: ctx.demoBundle.syllabus, syllabusSource: 'bundled-index' });
      showSyllabusCard('cached demo data');
      return;
    }
    progress.step(steps[0], url);
    const doc = await fetchSyllabusDocument(url);
    progress.step(steps[1], `${doc.kind === 'pdf' ? 'PDF' : 'HTML page'}${doc.numPages ? `, ${doc.numPages} page(s)` : ''}, ${doc.textLength.toLocaleString()} characters`);

    if (doc.warning) {
      progress.setDetail(doc.warning);
    }

    if (needsLlm()) {
      progress.fail('A model is needed to parse the syllabus.');
      clearProgress();
      llmMissingCard(true);
      ctx.pendingSyllabus = { url, doc, sourceLabel };
      return;
    }

    progress.step(steps[2]);
    const { syllabus } = await parseSyllabusText({
      text: doc.text,
      courseHint: ctx.syllabusCourseHint || state.scope?.courseCode || '',
      settings: state.settings,
      sourceUrl: doc.url,
      sourceKind: doc.kind === 'pdf' ? 'fetched-pdf' : 'fetched-html',
    });
    progress.step(steps[2]);
    clearProgress();
    update({ syllabus, syllabusSource: sourceLabel, syllabusApproved: false });
    ctx.pattern = null;
    showSyllabusCard(sourceLabel);
  } catch (err) {
    progress.fail(err?.message ?? String(err));
    clearProgress();
    addError(err, `<button class="btn btn-secondary btn-sm" data-act="syllabus-upload" type="button">Upload the syllabus PDF</button>
      <button class="btn btn-ghost btn-sm" data-act="syllabus-search-again" type="button">Try another source</button>`);
  } finally {
    setBusy(false);
  }
}

async function ingestSyllabusFile(file) {
  const steps = ['Reading the PDF', 'Extracting its text', 'Parsing modules and outcomes'];
  const progress = beginProgress('Reading the uploaded syllabus', steps);
  setBusy(true);
  try {
    progress.step(steps[0], `${file.name}, ${bytesToSize(file.size)}`);
    const response = await fetch('/api/pdf/text', {
      method: 'POST',
      headers: { 'content-type': 'application/pdf' },
      body: await file.arrayBuffer(),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || json?.ok === false) {
      throw new AppError(json?.error ?? `The PDF could not be read (HTTP ${response.status}).`, {
        code: json?.code ?? 'PDF_UNREADABLE',
        recovery: 'If the syllabus is a scan, export it as images and upload those, or paste its text into the chat.',
      });
    }
    progress.step(steps[1], `${json.numPages} page(s), ${json.text.replace(/\s/g, '').length.toLocaleString()} characters${json.hasTextLayer ? '' : ' (no text layer - this looks like a scan)'}`);

    if (!json.hasTextLayer || json.text.replace(/\s/g, '').length < 400) {
      progress.setDetail('This PDF has almost no text layer, so it is being OCRed instead.');
      const ocr = await extractPaperText({ files: [file], settings: state.settings, onProgress: ({ message, detail }) => progress.step(message, detail) });
      state.stats.ocrCalls += ocr.ocrCalls;
      json.text = ocr.text;
      if (!ocr.text.trim()) {
        throw new AppError('No text could be extracted from that syllabus PDF.', {
          code: 'SYLLABUS_TEXT_TOO_SHORT',
          recovery: 'Try a sharper scan, upload page images, or paste the syllabus text.',
        });
      }
    }

    if (needsLlm()) {
      progress.fail('A model is needed to parse the syllabus.');
      clearProgress();
      ctx.pendingSyllabusText = json.text;
      llmMissingCard(true);
      return;
    }

    progress.step(steps[2]);
    const { syllabus } = await parseSyllabusText({
      text: json.text,
      courseHint: ctx.syllabusCourseHint || state.scope?.courseCode || '',
      settings: state.settings,
      sourceUrl: `uploaded:${file.name}`,
      sourceKind: 'uploaded-pdf',
    });
    clearProgress();
    update({ syllabus, syllabusSource: `the PDF you uploaded (${file.name})`, syllabusApproved: false });
    ctx.pattern = null;
    showSyllabusCard(`the PDF you uploaded (${file.name})`);
  } catch (err) {
    progress.fail(err?.message ?? String(err));
    clearProgress();
    addError(err, `<button class="btn btn-secondary btn-sm" data-act="syllabus-upload" type="button">Try another PDF</button>
      <button class="btn btn-ghost btn-sm" data-act="syllabus-search-again" type="button">Search instead</button>`);
  } finally {
    setBusy(false);
  }
}

function showSyllabusCard(sourceLabel) {
  update({ phase: 'syllabus-review' });
  uiState.editSyllabus = false;
  const pattern = currentPattern();
  block(renderSyllabusCard(state.syllabus, { pattern }));
  say(
    `Parsed from ${sourceLabel}. Check the modules and course outcomes ${
      state.syllabus.courseOutcomes.length ? 'and their Bloom\u2019s levels ' : ''
    }before approving \u2014 only what you approve is used as the reference.`
  );
  if (state.mode) {
    say(`Approve the syllabus and I will segment the paper into questions.`);
  }
}

function readSyllabusEdits() {
  const syllabus = structuredClone(state.syllabus);
  for (const m of syllabus.modules) {
    const titleInput = chat.querySelector(`[data-syllabus-title="${m.number}"]`);
    const topicsArea = chat.querySelector(`[data-syllabus-topics="${m.number}"]`);
    if (titleInput) m.title = titleInput.value.trim();
    if (topicsArea) {
      m.topics = topicsArea.value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text, i) => ({ id: `${m.number}.${i + 1}`, text }));
    }
  }
  for (const c of syllabus.courseOutcomes) {
    const statement = chat.querySelector(`[data-syllabus-co="${CSS.escape(c.id)}"]`);
    const bloom = chat.querySelector(`[data-syllabus-bloom="${CSS.escape(c.id)}"]`);
    if (statement) c.statement = statement.value.trim();
    if (bloom) c.bloom = bloom.value || null;
  }
  return syllabus;
}

/* ================================================================ step 4: segmentation */

async function runSegmentation() {
  const steps = ['Reading the paper text', 'Identifying parts and questions', 'Matching marks and choices'];
  const progress = beginProgress('Segmenting the paper into questions', steps);
  setBusy(true);
  try {
    if (state.demo && ctx.demoBundle) {
      progress.step(steps[0], DEMO_LABEL);
      await new Promise((r) => setTimeout(r, 240));
      progress.step(steps[1]);
      await new Promise((r) => setTimeout(r, 220));
      progress.step(steps[2]);
      clearProgress();
      const seg = structuredClone(ctx.demoBundle.segmentation);
      update({ segmentation: seg, workingPaper: structuredClone(seg) });
      showSegmentationCard();
      return;
    }

    if (needsLlm()) {
      progress.fail('A model is needed to segment the paper.');
      clearProgress();
      llmMissingCard(true);
      return;
    }

    progress.step(steps[0], `${state.paper.text.length.toLocaleString()} characters`);
    const prompt = buildSegmentationPrompt({ paperText: state.paper.text, scope: state.scope });
    progress.step(steps[1]);
    const result = await llmJson(prompt);
    const segmentation = normaliseSegmentation(result.value);
    progress.step(steps[2], `${segmentation.questions.length} question(s)`);
    clearProgress();
    update({ segmentation, workingPaper: structuredClone(segmentation) });
    showSegmentationCard();
  } catch (err) {
    progress.fail(err?.message ?? String(err));
    clearProgress();
    addError(err, `<button class="btn btn-secondary btn-sm" data-act="segment-reedit" type="button">Edit the paper text</button>
      <button class="btn btn-ghost btn-sm" data-act="retry-segmentation" type="button">Re-segment</button>`);
  } finally {
    setBusy(false);
  }
}

function normaliseSegmentation(raw) {
  const questions = (raw.questions ?? []).map((q, i) => ({
    ...q,
    id: String(q.id ?? `Q${i + 1}`),
    label: q.label ?? String(i + 1),
    marks: Number.isFinite(q.marks) ? q.marks : 0,
    marksSource: q.marksSource ?? 'inferred',
    subParts: q.subParts ?? [],
    choiceGroup: q.choiceGroup ?? '',
    moduleLabel: q.moduleLabel ?? '',
    printedCo: q.printedCo ?? '',
    hasFigure: q.hasFigure === true,
  }));
  return {
    ...raw,
    questions,
    parts: raw.parts ?? [],
    warnings: raw.warnings ?? [],
    totalMarksCounted: Number.isFinite(raw.totalMarksCounted) ? raw.totalMarksCounted : questions.reduce((n, q) => n + q.marks, 0),
  };
}

function showSegmentationCard() {
  update({ phase: 'segmentation-review' });
  uiState.editSegmentation = false;
  block(renderSegmentationCard({ ...state.segmentation, __mode: state.mode }, { scope: state.scope }));
  say('Everything downstream references these IDs and marks. Fix anything that looks wrong, then run the analysis.');
}

function readSegmentationEdits() {
  const seg = structuredClone(state.segmentation);
  for (const q of seg.questions) {
    const text = chat.querySelector(`[data-q-text="${CSS.escape(q.id)}"]`);
    const marks = chat.querySelector(`[data-q-marks="${CSS.escape(q.id)}"]`);
    const moduleField = chat.querySelector(`[data-q-module="${CSS.escape(q.id)}"]`);
    if (text) q.text = text.value.trim();
    if (marks) q.marks = Number(marks.value) || 0;
    if (moduleField) q.moduleLabel = moduleField.value.trim();
  }
  seg.totalMarksCounted = seg.questions.reduce((n, q) => n + (q.marks ?? 0), 0);
  return seg;
}

/* ================================================================ run the mode */

async function runMode() {
  if (!state.mode) return;
  const isAnalysis = state.mode === 'analysis';
  const steps = isAnalysis
    ? ['Preparing the reference syllabus', 'Mapping questions to the syllabus', 'Checking wording and fairness', 'Writing alternative questions', 'Writing the summary']
    : ['Preparing the reference syllabus', 'Predicting per-question outcomes', 'Building the whole-paper picture'];
  const progress = beginProgress(isAnalysis ? 'Running Question Analysis' : 'Running Student Persona Prediction', steps, state.demo ? `<span class="badge badge-info">${esc(DEMO_LABEL)}</span>` : '');
  update({ phase: 'running' });
  setBusy(true);
  abortController = new AbortController();

  try {
    const onProgress = ({ label, detail }) => progress.step(label, detail);

    if (isAnalysis) {
      let report;
      if (state.demo && ctx.demoBundle) {
        for (let i = 0; i < steps.length; i++) {
          progress.step(steps[i], DEMO_LABEL);
          await new Promise((r) => setTimeout(r, 380));
        }
        report = structuredClone(ctx.demoBundle.analysis);
      } else {
        report = await runAnalysis({
          settings: state.settings,
          paperText: state.paper.text,
          scope: state.scope,
          syllabus: state.syllabus,
          segmentation: state.workingPaper ?? state.segmentation,
          bloomChoice: state.scope?.classNote ? '' : '',
          onProgress,
          signal: abortController.signal,
        });
      }
      progress.finish(`${report.flags?.length ?? 0} flag(s), ${report.suggestions?.length ?? 0} alternative(s)`);
      clearProgress();
      update({ analysis: report, phase: 'report' });
      block(renderAnalysisReport(report));
      say('Accepting a rewrite updates the working paper; rejecting it leaves the paper untouched. Nothing is written to disk either way.');
    } else {
      let report;
      if (state.demo && ctx.demoBundle) {
        for (let i = 0; i < steps.length; i++) {
          progress.step(steps[i], DEMO_LABEL);
          await new Promise((r) => setTimeout(r, 380));
        }
        report = structuredClone(ctx.demoBundle.persona);
      } else {
        report = await runPersonaPrediction({
          settings: state.settings,
          scope: state.scope,
          syllabus: state.syllabus,
          segmentation: state.workingPaper ?? state.segmentation,
          onProgress,
          signal: abortController.signal,
        });
      }
      progress.finish(`${report.timeFeasibility?.verdict ?? 'unknown'} timing`);
      clearProgress();
      update({ persona: report, phase: 'report' });
      block(renderPersonaReport(report));
    }
  } catch (err) {
    progress.fail(err?.message ?? String(err));
    clearProgress();
    const appError = toAppError(err);
    if (appError.code === 'LLM_CANCELLED') {
      block(callout('warn', 'Stopped', 'The run was cancelled. Nothing was saved and no partial report was written.', `<button class="btn btn-secondary btn-sm" data-act="run-mode" type="button">Run again</button>`));
    } else {
      addError(err, `<button class="btn btn-primary btn-sm" data-act="run-mode" type="button">Retry the run</button>
        <button class="btn btn-secondary btn-sm" data-act="open-settings" type="button">Check model settings</button>`);
    }
  } finally {
    setBusy(false);
    abortController = null;
    renderHeaderState();
  }
}

/* ================================================================ demo mode */

async function startDemo(id) {
  const steps = ['Loading the cached run', 'Restoring the paper', 'Restoring the syllabus', 'Ready'];
  const progress = beginProgress('Demo mode', steps);
  setBusy(true);
  try {
    progress.step(steps[0]);
    const bundle = await loadDemoBundle(id);
    ctx.demoBundle = bundle;
    progress.step(steps[1], `${bundle.meta.courseCode} \u00b7 ${bundle.meta.title ?? ''}`);
    await new Promise((r) => setTimeout(r, 220));
    progress.step(steps[2], `${bundle.syllabus.modules.length} modules, ${bundle.syllabus.courseOutcomes.length} COs`);
    await new Promise((r) => setTimeout(r, 220));
    progress.step(steps[3]);
    clearProgress();
    update({ demo: true, scope: bundle.scope, syllabus: bundle.syllabus, syllabusSource: 'the bundled demo bundle', syllabusApproved: false, segmentation: null, paper: null });
    block(
      callout(
        'info',
        `Demo mode: ${bundle.meta.courseCode} \u2014 ${bundle.meta.title ?? ''}`,
        `${bundle.meta.scenario ? `${esc(bundle.meta.scenario)}. ` : ''}This replays a cached run, so no OCR call, no syllabus fetch and no model call is made. Everything below still goes through the same confirmation cards as a live run.`,
        `<button class="btn btn-primary btn-sm" data-act="demo-start-mode" data-mode="analysis" type="button">Start with Question Analysis</button>
         <button class="btn btn-primary btn-sm" data-act="demo-start-mode" data-mode="persona" type="button">Start with Persona Prediction</button>
         <button class="btn btn-secondary btn-sm" data-act="demo-live" type="button">Leave demo mode</button>`
      )
    );
    if (bundle.meta.highlights?.length) {
      block(`<div class="card"><div class="card-head"><h3>What to look for</h3></div><div class="card-body"><ul class="small" style="margin:0;padding-left:18px">${bundle.meta.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div></div>`);
    }
    say('Pick a mode to continue: both are offered on the card above, and the paper, scope and syllabus are already loaded from the bundle.');
    update({ phase: 'mode-select' });
  } catch (err) {
    progress.fail(err?.message ?? String(err));
    clearProgress();
    addError(err, `<button class="btn btn-secondary btn-sm" data-act="demo-live" type="button">Leave demo mode and run live</button>`);
  } finally {
    setBusy(false);
  }
}

/* ================================================================ attachments */

function refreshAttachments() {
  attachmentsHost.hidden = pendingFiles.length === 0;
  attachmentsHost.innerHTML = renderAttachments(pendingFiles);
  updateSendState();
}

function updateSendState() {
  const send = $('btn-send');
  if (!send) return;
  send.disabled = state.busy || (!input.value.trim() && !pendingFiles.length);
}

function addFiles(fileList) {
  for (const file of fileList) {
    pendingFiles.push({ file, name: file.name, sizeLabel: bytesToSize(file.size), previewUrl: null });
  }
  refreshAttachments();
  // Build image previews asynchronously; PDFs just get a chip.
  for (const entry of pendingFiles) {
    if (!isPdfFile(entry.file) && !entry.previewUrl) {
      entry.previewUrl = URL.createObjectURL(entry.file);
    }
  }
  refreshAttachments();
}

/* ================================================================ send handler */

async function handleSend() {
  const text = input.value.trim();
  const files = pendingFiles.map((p) => p.file);
  if (!text && !files.length) return;

  input.value = '';
  autoGrow(input, 220);
  pendingFiles = [];
  refreshAttachments();

  const meta = files.length ? files.map((f) => `${f.name} (${bytesToSize(f.size)})`).join(', ') : null;
  if (text) userSays(text, meta ?? undefined);
  else if (meta) userSays(`[${files.length === 1 ? 'file' : 'files'} attached: ${meta}]`);
  renderChat();

  // Route by phase.
  const phase = state.phase;

  if (files.length && (phase === 'mode-select' || phase === 'paper' || phase === 'ocr-review')) {
    if (phase === 'mode-select' && !state.mode) {
      // A paper without a mode: ask which mode first.
      pendingFiles = files.map((file) => ({ file, name: file.name, sizeLabel: bytesToSize(file.size), previewUrl: null }));
      refreshAttachments();
      say('Choose Question Analysis or Student Persona Prediction first, then send the file again.');
      return;
    }
    await ingestPaper({ files });
    return;
  }

  if (phase === 'paper' || phase === 'mode-select') {
    if (text.length > 120) {
      await ingestPaper({ pastedText: text });
      return;
    }
    say('That is a bit short for a whole question paper. Paste the full paper text, or attach a photo or PDF of it.');
    return;
  }

  if (phase === 'ocr-review') {
    say('Use the "Text is correct" button on the card above to lock the paper text in, then describe the exam.');
    return;
  }

  if (phase === 'scope' || phase === 'scope-review' || phase === 'syllabus-query' || phase === 'syllabus-candidates' || phase === 'syllabus-review' || phase === 'segmentation-review' || phase === 'report' || phase === 'ready') {
    if (phase === 'scope' || phase === 'scope-review') {
      await parseScope(text);
      return;
    }
    if (phase === 'syllabus-query' || phase === 'syllabus-candidates' || phase === 'syllabus-review') {
      // Interpret a bare URL as a direct fetch; otherwise treat it as a search.
      const urlMatch = /https?:\/\/\S+/i.exec(text);
      if (urlMatch) {
        await fetchAndParseSyllabus(urlMatch[0], 'the URL you pasted');
        return;
      }
      await findSyllabus(text);
      return;
    }
    // Free text in later phases: treat as a request, but do not silently rewind.
    say('Use the buttons on the card above to move on. If you want to change something earlier, use New session and re-run \u2014 it takes a few seconds in demo mode.');
    return;
  }

  say('I am not sure what to do with that yet. Use the buttons on the card above.');
}

/* ================================================================ event wiring */

function wireEvents() {
  // Composer
  input.addEventListener('input', () => {
    autoGrow(input, 220);
    updateSendState();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!$('btn-send').disabled) handleSend();
    }
  });
  $('btn-send').addEventListener('click', handleSend);
  $('btn-attach').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
  });
  $('btn-stop').addEventListener('click', () => {
    abortController?.abort();
    toast('Stopping…', 'info');
  });

  // Chrome
  $('btn-new').addEventListener('click', () => {
    pendingFiles = [];
    refreshAttachments();
    ctx.demoBundle = null;
    ctx.pattern = null;
    clearProgress();
    newSession({ keepSettings: true });
    // newSession only notifies subscribers; the conversation itself has to be
    // rebuilt, otherwise the previous report stays on screen.
    renderChat();
    toast('Fresh session. Nothing was stored, so nothing was lost.', 'ok');
  });

  $('btn-settings').addEventListener('click', () => update({ settingsOpen: true }));
  scrim.addEventListener('click', () => update({ settingsOpen: false }));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.settingsOpen) update({ settingsOpen: false });
  });

  $('btn-theme').addEventListener('click', () => {
    const current = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = current;
    // Deliberately not persisted anywhere: the theme resets with the session.
  });

  $('btn-demo').addEventListener('click', async () => {
    if (state.demo) {
      update({ demo: false });
      toast('Left demo mode. Live calls are active again.', 'info');
      return;
    }
    await startDemo();
  });

  // Delegated card actions
  on(chat, 'click', '[data-act]', async (event, node) => {
    const act = node.dataset.act;
    try {
      await handleAction(act, node, event);
    } catch (err) {
      addError(err);
    }
  });

  // Attachments detach
  on(attachmentsHost, 'click', '[data-act="detach"]', (event, node) => {
    pendingFiles.splice(Number(node.dataset.index), 1);
    refreshAttachments();
  });
}

async function handleAction(act, node, event) {
  switch (act) {
    case 'start-mode': {
      const mode = node.dataset.mode;
      update({ mode, phase: state.paper ? 'ocr-review' : 'paper' });
      uiState.editSyllabus = false;
      uiState.editSegmentation = false;
      say(
        mode === 'analysis'
          ? 'Question Analysis it is. Attach a photo or PDF of the paper, or paste the paper text into the input bar.'
          : 'Student Persona Prediction it is. Attach a photo or PDF of the paper, or paste the paper text into the input bar.'
      );
      renderChat();
      return;
    }

    case 'demo-start-mode': {
      // A mode already chosen from the landing screen wins; otherwise use the
      // mode named on the button the teacher pressed. Resolving this at click
      // time matters, because the demo card is rendered before a mode exists.
      const mode = state.mode ?? node.dataset.mode ?? 'analysis';
      update({
        mode,
        demo: true,
        phase: 'paper',
        paper: null,
        segmentation: null,
        workingPaper: null,
        analysis: null,
        persona: null,
        syllabusApproved: false,
      });
      say(`Demo run started with ${mode === 'persona' ? 'Student Persona Prediction' : 'Question Analysis'}. Restoring the paper text first.`);
      renderChat();
      await ingestPaper({});
      return;
    }

    case 'demo-live':
      update({ demo: false });
      ctx.demoBundle = null;
      say('Demo mode is off. Attach a paper or paste its text to run live.');
      renderChat();
      return;

    case 'open-settings':
      update({ settingsOpen: true });
      return;

    case 'paper-confirm': {
      const area = chat.querySelector('#ocr-text');
      const text = area ? area.value.trim() : state.paper?.text?.trim() ?? '';
      if (!text) {
        toast('There is no text to confirm yet.', 'error');
        return;
      }
      update({ paper: { ...state.paper, text }, phase: 'scope' });
      say('Paper text locked in. Now tell me the exam details: the course code or name, which modules are in scope, the total marks, the duration, and the paper structure if it is not the standard one.');
      renderChat();
      if (state.demo && ctx.demoBundle) {
        await parseScope('(demo bundle)');
      }
      return;
    }

    case 'paper-reupload':
      fileInput.click();
      return;

    case 'ocr-enhance':
      updateSettings({ ocrEnhance: true });
      say('Enhancement is on. Attach the file again and it will be read with grayscale and contrast boosting, which helps dim phone photos.');
      fileInput.click();
      return;

    case 'paste-paper':
      say('Paste the paper text straight into the input bar and send it.');
      input.focus();
      return;

    case 'retry-paper':
      say('Attach the file again, or paste the text.');
      fileInput.click();
      return;

    case 'retry-step':
      if (ctx.pendingSyllabus) {
        await fetchAndParseSyllabus(ctx.pendingSyllabus.url, ctx.pendingSyllabus.sourceLabel);
      } else {
        await parseScope(ctx.lastScopeMessage || '');
      }
      return;

    case 'fill-scope-manually': {
      const scope = state.scope ?? {
        courseCode: '',
        courseTitle: '',
        totalMarks: null,
        durationMinutes: null,
        modulesInScope: [],
        classNote: '',
        paperStructure: { source: 'teacher', parts: [] },
        unresolved: [],
      };
      update({ scope, phase: 'scope-review' });
      showScopeCard(scope);
      return;
    }

    case 'scope-reparse':
      if (!ctx.lastScopeMessage) {
        toast('Type your description again and I will re-read it.', 'info');
        input.focus();
        return;
      }
      await parseScope(ctx.lastScopeMessage);
      return;

    case 'scope-confirm': {
      const scope = readScopeFromCard();
      if (!scope.modulesInScope?.length) {
        toast('Tick at least one module, or the coverage check has nothing to work with.', 'error');
        return;
      }
      update({ scope, phase: 'syllabus-query' });

      // A syllabus is only ever used after the teacher approves it, including
      // when it arrived pre-parsed from the bundled index or the demo bundle.
      if (state.syllabus && state.syllabusApproved) {
        say('Scope confirmed. The syllabus is already approved, so I will segment the paper next.');
        renderChat();
        await runSegmentation();
        return;
      }
      if (state.syllabus) {
        say('Scope confirmed. Here is the syllabus again for approval before anything is analysed against it.');
        renderChat();
        showSyllabusCard(state.syllabusSource ?? 'the parsed syllabus');
        return;
      }

      const hint = scope.courseCode || scope.courseTitle;
      say(
        hint
          ? `Scope confirmed. Looking for the ${hint} syllabus \u2014 send the course code or name if I should look for something else.`
          : 'Scope confirmed. Now send the course code or course name and I will fetch the 2024-scheme syllabus.'
      );
      renderChat();
      if (hint) await findSyllabus(hint);
      return;
    }

    case 'syllabus-search-again':
      ctx.pendingSyllabus = null;
      say('Send the course code or name again and I will search afresh.');
      update({ phase: 'syllabus-query' });
      renderChat();
      input.focus();
      return;

    case 'syllabus-use':
      await useSyllabusCandidate(Number(node.dataset.index));
      return;

    case 'syllabus-fetch-url': {
      const field = chat.querySelector('#syllabus-url');
      const url = field?.value.trim();
      if (!url || !/^https?:\/\//i.test(url)) {
        toast('Paste a full http(s) URL.', 'error');
        return;
      }
      await fetchAndParseSyllabus(url, 'the URL you pasted');
      return;
    }

    case 'syllabus-upload':
      pickSyllabusFile();
      return;

    case 'syllabus-edit':
      uiState.editSyllabus = true;
      renderChat();
      return;

    case 'syllabus-cancel-edit':
      uiState.editSyllabus = false;
      renderChat();
      say('Edits discarded. The parsed syllabus is unchanged.');
      return;

    case 'syllabus-save-edit': {
      const edited = readSyllabusEdits();
      update({ syllabus: edited, syllabusApproved: false });
      uiState.editSyllabus = false;
      ctx.pattern = null;
      showSyllabusCard(state.syllabusSource ?? 'your edits');
      toast('Syllabus edits saved for this session.', 'ok');
      return;
    }

    case 'syllabus-confirm': {
      if (!state.syllabus?.modules?.length) {
        toast('There are no modules to approve.', 'error');
        return;
      }
      uiState.editSyllabus = false;
      update({ syllabusApproved: true });
      say(`Syllabus approved: ${state.syllabus.modules.length} modules and ${state.syllabus.courseOutcomes.length} course outcomes are now the reference. Segmenting the paper.`);
      renderChat();
      await runSegmentation();
      return;
    }

    case 'segment-edit':
      uiState.editSegmentation = true;
      renderChat();
      return;

    case 'segment-save-edit': {
      const seg = readSegmentationEdits();
      update({ segmentation: seg, workingPaper: structuredClone(seg) });
      uiState.editSegmentation = false;
      showSegmentationCard();
      toast('Segmentation edits saved for this session.', 'ok');
      return;
    }

    case 'segment-reedit':
      update({ phase: 'ocr-review' });
      say('Here is the paper text again. Fix it and confirm, then the paper will be re-segmented.');
      block(renderPaperCard(state.paper));
      renderChat();
      return;

    case 'retry-segmentation':
      await runSegmentation();
      return;

    case 'segment-confirm':
      await runMode();
      return;

    case 'run-mode':
      await runMode();
      return;

    case 'flag-accept': {
      const index = Number(node.dataset.index);
      const flag = state.analysis?.flags?.[index];
      if (!flag) return;
      // An edited rewrite lives in the textarea the "Edit first" button opened.
      const edited = chat.querySelector(`[data-flag-edit="${index}"]`);
      const text = edited ? edited.value.trim() : flag.rewrite;
      if (!text) return;
      flag.rewrite = text;
      const result = applyRewrite(state.workingPaper ?? state.segmentation, flag.questionId, text, {
        marks: flag.rewriteMarks,
        bloom: flag.rewriteBloom,
      });
      flag.decision = 'accepted';
      if (result.changed) update({ workingPaper: result.segmentation });
      const flagNode = chat.querySelector(`[data-flag-index="${index}"]`);
      if (flagNode) flagNode.outerHTML = renderFlagCard(flag, index);
      if (flag.questionId) {
        toast(`Rewrite accepted for ${flag.questionId}. The working paper is updated.`, 'ok');
      } else {
        toast('Noted. There is no single question to replace here \u2014 use the alternative questions below.', 'info');
      }
      return;
    }

    case 'flag-reject': {
      const index = Number(node.dataset.index);
      const flag = state.analysis?.flags?.[index];
      if (!flag) return;
      flag.decision = 'rejected';
      const flagNode = chat.querySelector(`[data-flag-index="${index}"]`);
      if (flagNode) flagNode.outerHTML = renderFlagCard(flag, index);
      return;
    }

    case 'flag-edit': {
      const index = Number(node.dataset.index);
      const flag = state.analysis?.flags?.[index];
      const flagNode = chat.querySelector(`[data-flag-index="${index}"]`);
      if (!flag || !flagNode) return;
      const rewrite = flagNode.querySelector('.rewrite');
      if (!rewrite) return;
      rewrite.innerHTML = `
        <div class="rewrite-label">Edit the rewrite</div>
        <textarea rows="4" data-flag-edit="${index}">${esc(flag.rewrite)}</textarea>
        <div class="btn-row" style="margin-top:8px">
          <button class="btn btn-primary btn-sm" data-act="flag-accept" data-index="${index}" type="button">Accept edited version</button>
        </div>`;
      return;
    }

    case 'suggestion-accept': {
      const index = Number(node.dataset.index);
      const suggestion = state.analysis?.suggestions?.[index];
      if (!suggestion) return;
      const result = applySuggestion(state.workingPaper ?? state.segmentation, suggestion);
      if (result.changed) {
        update({ workingPaper: result.segmentation });
        toast(`Replaced ${suggestion.replacesQuestionId} with the proposed question.`, 'ok');
      } else {
        toast('This suggestion is for a topic with no existing question, so copy it into the paper manually.', 'info');
      }
      return;
    }

    case 'suggestion-copy': {
      const index = Number(node.dataset.index);
      const suggestion = state.analysis?.suggestions?.[index];
      if (suggestion?.text) {
        try {
          await navigator.clipboard.writeText(suggestion.text);
          toast('Question copied to the clipboard.', 'ok');
        } catch {
          toast('Copy failed. Select the text and copy it manually.', 'error');
        }
      }
      return;
    }

    case 'suggest-for':
      toast('Accept a flag to get a rewrite, or re-run the analysis after widening the scope.', 'info');
      return;

    default:
      return;
  }
}

/** Hidden file input used for the syllabus upload path. */
let syllabusFileInput = null;

function pickSyllabusFile() {
  if (!syllabusFileInput) {
    syllabusFileInput = el('<input type="file" accept="application/pdf" class="sr-only" />');
    document.body.appendChild(syllabusFileInput);
    syllabusFileInput.addEventListener('change', async () => {
      const file = syllabusFileInput.files?.[0];
      syllabusFileInput.value = '';
      if (file) await ingestSyllabusFile(file);
    });
  }
  syllabusFileInput.click();
}

/* ================================================================ settings drawer */

function renderDrawer() {
  if (!state.settingsOpen) {
    drawer.hidden = true;
    scrim.hidden = true;
    return;
  }
  const wasHidden = drawer.hidden;
  if (wasHidden) {
    replace(drawer, renderSettings().innerHTML);
    bindSettings(drawer, { onChange: renderHeaderState });
  }
  drawer.hidden = false;
  scrim.hidden = false;
}

/* ================================================================ boot */

function initTheme() {
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light';
}

function boot() {
  initTheme();
  // Prove the "nothing is persisted" claim on every load.
  purgeStorage();
  wireEvents();

  subscribe(() => {
    renderDrawer();
    renderHeaderState();
  });

  update({ phase: 'mode-select' });
  renderChat();
  refreshAttachments();

  // A quiet, honest banner about the API-key model, once.
  addMessage({
    role: 'assistant',
    kind: 'assistant',
    html: callout(
      'info',
      'Paperguide',
      `A quality checker for KTU ${'2024'}-scheme question papers. Sessions are memory-only: no login, no history, nothing written to disk. Add your own OpenAI-compatible endpoint and OCR.space key in Settings when you are ready.`,
      `<button class="btn btn-secondary btn-sm" data-act="open-settings" type="button">Open Settings</button>
       <button class="btn btn-primary btn-sm" data-act="demo-live" type="button" hidden>Demo</button>`
    ),
  });
  renderChat();
}

boot();

// Expose a tiny debug surface for the acceptance checks, without leaking keys.
window.Paperguide = {
  get state() {
    const { settings, ...rest } = state;
    return {
      ...rest,
      settings: { ...settings, apiKey: settings.apiKey ? '[set]' : '', ocrApiKey: settings.ocrApiKey ? '[set]' : '' },
    };
  },
  promptVersion: PROMPT_VERSION,
  purgeStorage,
  constants: { KTU_2024_DEFAULT_PATTERN, KTU_2024_HMC_PATTERN },
};
