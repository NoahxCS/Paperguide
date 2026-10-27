/**
 * End-to-end flow test.
 *
 * Loads the real app in a same-origin iframe and drives it with synthetic
 * clicks, exactly as a teacher would during the demo. This is the only way to
 * verify the flow controller, the confirmation gate at each step, and the
 * Accept/Rewrite path without a human at the keyboard.
 *
 * Run: open /flowtest.html, or headlessly
 *   chrome --headless=new --dump-dom --virtual-time-budget=45000 http://127.0.0.1:8791/flowtest.html
 */
const results = [];
const host = document.getElementById('results');
const frame = document.getElementById('stage');
const summary = document.getElementById('summary');

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const row = document.createElement('div');
  row.className = `result ${ok ? 'pass' : 'fail'}`;
  row.innerHTML = `<span class="status">${ok ? 'PASS' : 'FAIL'}</span><span><strong>${name}</strong>${
    detail ? `<div class="detail">${detail}</div>` : ''
  }</span>`;
  host.appendChild(row);
}

async function check(name, fn, timeoutMs = 25000) {
  const started = Date.now();
  try {
    const detail = await Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${timeoutMs} ms`)), timeoutMs)),
    ]);
    record(name, true, `${detail ?? ''}${detail ? ' · ' : ''}${Date.now() - started} ms`);
  } catch (err) {
    record(name, false, String(err?.message ?? err));
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Poll until `fn()` is truthy, or throw. */
async function waitFor(fn, message, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    let value;
    try {
      value = fn();
    } catch {
      value = null;
    }
    if (value) return value;
    if (Date.now() > deadline) throw new Error(message);
    await sleep(120);
  }
}

function win() {
  return frame.contentWindow;
}
function doc() {
  return frame.contentDocument;
}
function appState() {
  return win().Paperguide?.state ?? null;
}

/** Click a `[data-act]` control inside the app, failing loudly if absent. */
function click(selector, label) {
  const node = doc().querySelector(selector);
  assert(node, `no element matching ${selector} (${label})`);
  node.click();
  return node;
}

async function waitForAct(act, label, timeoutMs = 20000) {
  return waitFor(() => doc().querySelector(`[data-act="${act}"]:not([hidden])`), `the "${act}" control never appeared (${label})`, timeoutMs);
}

async function waitForPhase(phase, timeoutMs = 20000) {
  return waitFor(() => (appState()?.phase === phase ? phase : null), `phase never became "${phase}" (stuck at "${appState()?.phase}")`, timeoutMs);
}

async function waitForText(text, timeoutMs = 20000) {
  return waitFor(() => (doc().body.textContent.includes(text) ? text : null), `"${text}" never appeared in the chat`, timeoutMs);
}

/** Type into a field in the iframe and fire a real input event there. */
function typeInto(selector, value) {
  const node = doc().querySelector(selector);
  assert(node, `no field matching ${selector}`);
  node.value = value;
  const EventCtor = win().Event;
  node.dispatchEvent(new EventCtor('input', { bubbles: true }));
  return node;
}

/* ---------------------------------------------------------------- run */

await check('the app boots in an iframe', async () => {
  await new Promise((resolve, reject) => {
    if (frame.contentDocument?.readyState === 'complete' && appState()) return resolve();
    frame.addEventListener('load', () => resolve(), { once: true });
    setTimeout(() => reject(new Error('iframe never loaded')), 15000);
  });
  await waitFor(() => appState(), 'window.Paperguide was never exposed', 10000);
  await waitForText('Check a KTU question paper before you print it');
  const cards = doc().querySelectorAll('.mode-card');
  assert(cards.length === 2, `expected 2 mode cards, found ${cards.length}`);
  return 'hero and both mode cards rendered';
});

await check('demo mode loads a cached bundle without any API call', async () => {
  click('#btn-demo', 'demo button');
  await waitForText('What to look for', 20000);
  const s = appState();
  assert(s.demo === true, 'demo flag was not set');
  assert(s.syllabus?.modules?.length === 4, 'the bundled syllabus was not loaded');
  assert(s.scope?.modulesInScope?.join(',') === '1,2,3', `unexpected scope: ${s.scope?.modulesInScope}`);
  return `bundle loaded: ${s.syllabus.courseCode}, scope ${s.scope.modulesInScope.join('/')}`;
});

await check('picking a mode gates on the paper step', async () => {
  click('[data-act="start-mode"][data-mode="analysis"]', 'Question Analysis mode card');
  await waitForPhase('paper', 10000);
  return 'phase moved to "paper"';
});

await check('demo start replays the cached OCR text and asks for confirmation', async () => {
  click('[data-act="demo-start-mode"]', 'demo start button');
  await waitForAct('paper-confirm', 'paper confirmation');
  const area = doc().querySelector('#ocr-text');
  assert(area, 'the OCR correction textarea is missing');
  assert(area.value.includes('ALGORITHMIC THINKING WITH PYTHON'), 'the cached paper text was not loaded into the correction box');
  assert(area.value.includes('PART B'), 'the paper text looks truncated');
  assert(appState().phase === 'ocr-review', `expected phase ocr-review, got ${appState().phase}`);
  return `${area.value.length.toLocaleString()} characters staged for correction`;
});

await check('locking the paper text advances to the scope card', async () => {
  click('[data-act="paper-confirm"]', 'confirm paper text');
  await waitForAct('scope-confirm', 'scope confirmation');
  const marks = doc().querySelector('[data-scope="totalMarks"]');
  assert(marks && marks.value === '60', `scope marks field shows "${marks?.value}", expected 60`);
  const boxes = doc().querySelectorAll('[data-scope-module]');
  assert(boxes.length === 4, `expected 4 module checkboxes, found ${boxes.length}`);
  const checked = [...boxes].filter((b) => b.checked).map((b) => b.value ?? b.dataset.scopeModule);
  assert(checked.length === 3, `expected 3 modules ticked, found ${checked.length}`);
  await waitForPhase('scope-review', 10000);
  return `scope card shows 60 marks and ${checked.length}/4 modules ticked`;
});

await check('confirming the scope advances to the syllabus card', async () => {
  click('[data-act="scope-confirm"]', 'confirm scope');
  await waitForAct('syllabus-confirm', 'syllabus approval');
  const text = doc().body.textContent;
  assert(text.includes('UCEST105'), 'the syllabus card does not name the course');
  assert(text.includes('Course outcomes'), 'the CO table is missing');
  assert(text.includes('Module 1') || text.includes('Algorithmic'), 'module content is missing');
  return 'syllabus card rendered with real 2024-scheme data';
});

await check('approving the syllabus advances to segmentation', async () => {
  click('[data-act="syllabus-confirm"]', 'approve syllabus');
  await waitForAct('segment-confirm', 'segmentation confirmation');
  const rows = doc().querySelectorAll('[data-card="segmentation"] tbody tr');
  assert(rows.length === 16, `expected 16 question rows, found ${rows.length}`);
  const text = doc().body.textContent;
  assert(text.includes('answerable'), 'the printed-versus-answerable marks summary is missing');
  return `${rows.length} questions segmented`;
});

await check('the out-of-scope questions are pre-flagged on the segmentation card', async () => {
  const outRows = doc().querySelectorAll('[data-card="segmentation"] tr.row-out');
  assert(outRows.length >= 2, `expected the Module 4 rows to be marked, found ${outRows.length}`);
  return `${outRows.length} row(s) highlighted as outside the declared scope`;
});

await check('running Question Analysis produces a report', async () => {
  click('[data-act="segment-confirm"]', 'run analysis');
  await waitForText('Coverage against your confirmed scope', 40000);
  const text = doc().body.textContent;
  assert(text.includes('Ambiguity and fairness flags'), 'the flags card is missing');
  assert(text.includes('Alternative questions'), 'the suggestions card is missing');
  assert(text.includes('off-scope'), 'the off-scope row is missing from the coverage table');
  assert(text.includes('Accept rewrite'), 'no flag offers an Accept rewrite action');
  assert(appState().analysis, 'the analysis was not stored in state');
  return `${appState().analysis.flags.length} flags, ${appState().analysis.suggestions.length} suggestions`;
});

await check('accepting a rewrite updates the working paper, not the original', async () => {
  const acceptButtons = [...doc().querySelectorAll('[data-act="flag-accept"]')];
  assert(acceptButtons.length > 0, 'no Accept rewrite button found');

  // Work out which question this button rewrites rather than assuming.
  const index = Number(acceptButtons[0].dataset.index);
  const flag = appState().analysis.flags[index];
  assert(flag?.rewrite, `flag ${index} has no rewrite to accept`);
  const questionId = flag.questionId;
  assert(questionId, `flag ${index} is not attached to a question`);

  const before = appState().segmentation.questions.find((q) => q.id === questionId).text;
  const workingBefore = appState().workingPaper.questions.find((q) => q.id === questionId).text;
  assert(before === workingBefore, 'the working paper should start identical to the segmentation');

  acceptButtons[0].click();
  await sleep(300);

  const after = appState().segmentation.questions.find((q) => q.id === questionId).text;
  const workingAfter = appState().workingPaper.questions.find((q) => q.id === questionId).text;
  assert(after === before, 'the original segmentation was mutated, which it must never be');
  assert(workingAfter !== workingBefore, `the working paper was not updated for ${questionId}`);
  assert(workingAfter === flag.rewrite, 'the working paper does not hold the accepted rewrite text');
  const accepted = appState().analysis.flags.filter((f) => f.decision === 'accepted');
  assert(accepted.length === 1, `expected 1 accepted flag, found ${accepted.length}`);
  return `${questionId} rewritten in the working paper only`;
});

await check('rejecting a rewrite leaves the paper alone', async () => {
  const workingBefore = JSON.stringify(appState().workingPaper.questions.map((q) => q.text));
  const rejectButtons = [...doc().querySelectorAll('[data-act="flag-reject"]')];
  assert(rejectButtons.length > 0, 'no Reject button found');
  rejectButtons[0].click();
  await sleep(200);
  const workingAfter = JSON.stringify(appState().workingPaper.questions.map((q) => q.text));
  assert(workingBefore === workingAfter, 'rejecting a flag changed the working paper');
  assert(appState().analysis.flags.some((f) => f.decision === 'rejected'), 'no flag was marked rejected');
  return 'working paper unchanged after a rejection';
});

await check('persona run on a fresh session works end to end', async () => {
  click('#btn-new', 'new session');
  await waitFor(() => appState()?.phase === 'mode-select', 'new session did not return to mode select', 10000);

  click('#btn-demo', 'demo mode again');
  await waitForText('What to look for', 20000);
  click('[data-act="start-mode"][data-mode="persona"]', 'Persona Prediction mode card');
  await waitForPhase('paper', 10000);
  click('[data-act="demo-start-mode"]', 'demo start');
  await waitForAct('paper-confirm', 'paper confirmation');
  click('[data-act="paper-confirm"]', 'confirm paper');
  await waitForAct('scope-confirm', 'scope confirmation');
  click('[data-act="scope-confirm"]', 'confirm scope');
  await waitForAct('syllabus-confirm', 'syllabus approval');
  click('[data-act="syllabus-confirm"]', 'approve syllabus');
  await waitForAct('segment-confirm', 'segmentation confirmation');
  click('[data-act="segment-confirm"]', 'run persona prediction');

  await waitForText('Paper-level prediction', 45000);
  const text = doc().body.textContent;
  assert(text.includes('Student Persona Prediction'), 'the persona report header is missing');
  assert(text.includes('Time feasibility'), 'time feasibility is missing');
  assert(text.includes('Typical errors'), 'the persona description cards are missing');
  assert(appState().persona?.perQuestion?.length === 16, 'the persona report does not cover 16 questions');
  return `persona report rendered for ${appState().persona.perQuestion.length} questions`;
});

await check('the persona report shows all three personas per question', async () => {
  const html = doc().body.innerHTML;
  for (const marker of ['Weak', 'Average', 'Strong']) {
    assert(html.includes(marker), `the report never mentions the ${marker} persona`);
  }
  const report = appState().persona;
  const incomplete = report.perQuestion.filter(
    (q) => !q.personas.weak?.pitfall || !q.personas.average?.pitfall || !q.personas.strong?.pitfall
  );
  assert(incomplete.length === 0, `${incomplete.length} question(s) lack a pitfall for one of the personas`);
  return 'every question has a pitfall for all three personas';
});

await check('a pasted paper is accepted without any OCR call', async () => {
  click('#btn-new', 'new session');
  await waitFor(() => appState()?.phase === 'mode-select', 'new session did not reset the phase', 10000);
  click('[data-act="start-mode"][data-mode="analysis"]', 'Question Analysis card');
  await waitForPhase('paper', 10000);

  const pasted = [
    'APJ ABDUL KALAM TECHNOLOGICAL UNIVERSITY',
    'First Semester B.Tech Degree Regular Examination December 2024 (2024 Scheme)',
    'Course Code: UCEST105  Course Name: ALGORITHMIC THINKING WITH PYTHON',
    'Max. Marks: 60                         Duration: 2 hours 30 minutes',
    'PART A (Answer all questions. Each question carries 3 marks) CO Marks',
    '1 Explain the difference between an algorithm and a pseudocode. CO-1 (3)',
    '2 Write a Python program to compute the factorial of a number. CO-2 (3)',
    'PART B (Answer any one full question from each module, each question carries 9 marks)',
    'Module -1',
    '9 a) Explain how trial and error differs from heuristics. CO-1 (5)',
    '   b) Apply Means-Ends Analysis to a simple daily task. CO-1 (4)',
  ].join('\n');

  typeInto('#input', pasted);
  click('#btn-send', 'send pasted paper');

  await waitForAct('paper-confirm', 'paper confirmation');
  const area = doc().querySelector('#ocr-text');
  assert(area.value.includes('trial and error differs from heuristics'), 'the pasted text was not carried into the review box');
  assert(appState().stats.ocrCalls === 0, `OCR was called ${appState().stats.ocrCalls} time(s) for pasted text`);
  assert(appState().paper.method === 'pasted', `expected method "pasted", got "${appState().paper.method}"`);
  return `pasted text reviewed with 0 OCR requests`;
});

await check('a missing model produces a recovery card, not a dead end', async () => {
  assert(!appState().settings.model, 'this check assumes no model is configured');
  assert(!appState().settings.baseUrl, 'this check assumes no base URL is configured');
  click('[data-act="paper-confirm"]', 'confirm pasted paper');
  await waitForPhase('scope', 10000);

  typeInto('#input', 'Modules 1 to 3 in scope, 60 marks, 150 minutes, standard paper pattern.');
  click('#btn-send', 'send scope description');

  await waitForText('No model configured', 15000);
  const text = doc().body.textContent;
  assert(text.includes('Open Settings'), 'the recovery card offers no way to configure a model');
  assert(text.includes('Fill it in by hand'), 'the recovery card offers no manual fallback');
  return 'both recovery paths are offered';
});

await check('the manual scope fallback opens a usable card', async () => {
  click('[data-act="fill-scope-manually"]', 'fill scope by hand');
  await waitForAct('scope-confirm', 'scope confirmation');
  const marks = doc().querySelector('[data-scope="totalMarks"]');
  const duration = doc().querySelector('[data-scope="durationMinutes"]');
  assert(marks, 'the manual scope card has no marks field');
  assert(duration, 'the manual scope card has no duration field');
  marks.value = '60';
  duration.value = '150';
  const boxes = doc().querySelectorAll('[data-scope-module]');
  assert(boxes.length > 0, 'no modules are offered to tick');
  boxes.forEach((b) => {
    b.checked = true;
  });
  click('[data-act="scope-confirm"]', 'confirm the hand-filled scope');
  await waitForPhase('syllabus-query', 10000);
  assert(appState().scope.totalMarks === 60, 'the hand-typed marks were not stored');
  assert(appState().scope.modulesInScope.length === boxes.length, 'the ticked modules were not stored');
  return `scope captured by hand: ${appState().scope.modulesInScope.length} modules, ${appState().scope.totalMarks} marks`;
});

await check('the bundled index answers a syllabus search with no network', async () => {
  typeInto('#input', 'UCEST105');
  click('#btn-send', 'search for UCEST105');
  await waitForAct('syllabus-confirm', 'syllabus approval', 25000);
  assert(appState().syllabus?.courseCode === 'UCEST105', `expected UCEST105, got ${appState().syllabus?.courseCode}`);
  assert(appState().syllabusSource === 'bundled-index', 'the syllabus did not come from the bundled index');
  assert(appState().syllabusApproved === false, 'the syllabus must require approval before use');
  return 'bundled index resolved UCEST105 and demanded approval';
});

await check('the settings drawer opens and exposes every endpoint field', async () => {
  click('#btn-settings', 'settings button');
  await waitFor(() => !doc().getElementById('settings-drawer').hidden, 'the settings drawer never opened', 8000);
  for (const id of ['llm-base-url', 'llm-api-key', 'llm-model', 'llm-routing', 'ocr-api-key', 'ocr-engine', 'ocr-endpoint']) {
    assert(doc().getElementById(id), `the drawer is missing #${id}`);
  }
  const presets = doc().querySelectorAll('[data-preset]');
  assert(presets.length >= 5, `expected several endpoint presets, found ${presets.length}`);
  return `${presets.length} endpoint presets and 7 fields`;
});

await check('swapping the endpoint needs no code change', async () => {
  typeInto('#llm-base-url', 'https://example.invalid/v1');
  typeInto('#llm-model', 'some-other-model');
  typeInto('#llm-api-key', 'sk-test-not-a-real-key');
  await sleep(150);
  const s = appState().settings;
  assert(s.baseUrl === 'https://example.invalid/v1', `base URL not stored: ${s.baseUrl}`);
  assert(s.model === 'some-other-model', `model not stored: ${s.model}`);
  assert(s.apiKey === '[set]', 'the API key was not stored in the session');
  assert(!JSON.stringify(appState()).includes('sk-test-not-a-real-key'), 'the raw key leaked into the debug surface');
  return 'base URL, key and model all swapped live; the debug surface masks the key';
});

await check('the flow left no data in client storage', async () => {
  assert(win().localStorage.length === 0, 'localStorage is not empty');
  assert(win().sessionStorage.length === 0, 'sessionStorage is not empty');
  assert(!win().document.cookie, 'a cookie was written');
  return 'localStorage, sessionStorage and cookies are all empty after a full run';
});

/* ---------------------------------------------------------------- summary */

const failed = results.filter((r) => !r.ok);
summary.textContent = failed.length
  ? `${failed.length} of ${results.length} flow checks FAILED`
  : `All ${results.length} flow checks passed`;
summary.style.color = failed.length ? 'var(--danger)' : 'var(--ok)';
document.title = failed.length ? `FAIL ${failed.length}/${results.length}` : `PASS ${results.length}/${results.length}`;
document.body.dataset.flowtest = failed.length ? `fail:${failed.length}` : `pass:${results.length}`;
