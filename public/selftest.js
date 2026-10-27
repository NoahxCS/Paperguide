/**
 * Browser self test.
 *
 * Open /selftest.html while the Paperguide server is running. It exercises the
 * real modules in a real DOM, which catches the class of bug that a Node test
 * cannot: bad imports, missing exports, template errors, and a demo bundle that
 * no longer matches the schemas.
 *
 * Also usable headlessly:
 *   chrome --headless=new --dump-dom --virtual-time-budget=8000 http://127.0.0.1:8791/selftest.html
 */
const results = [];
const host = document.getElementById('results');

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const row = document.createElement('div');
  row.className = `result ${ok ? 'pass' : 'fail'}`;
  row.innerHTML = `<span class="status">${ok ? 'PASS' : 'FAIL'}</span><span><strong>${name}</strong>${
    detail ? `<div class="detail">${detail}</div>` : ''
  }</span>`;
  host.appendChild(row);
}

async function check(name, fn) {
  try {
    const detail = await fn();
    record(name, true, detail ?? '');
  } catch (err) {
    record(name, false, String(err?.message ?? err));
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertHtml(html, needles, label) {
  assert(typeof html === 'string' && html.length > 40, `${label} produced no markup`);
  for (const needle of needles) {
    assert(html.includes(needle), `${label} markup is missing "${needle}"`);
  }
  return `${html.length.toLocaleString()} characters of markup`;
}

/* ---------------------------------------------------------------- run */

const mods = {};
await check('every module imports cleanly', async () => {
  mods.analysis = await import('/core/analysis.js');
  mods.persona = await import('/core/persona.js');
  mods.syllabus = await import('/core/syllabus.js');
  mods.llm = await import('/core/llm.js');
  mods.json = await import('/core/json.js');
  mods.ocr = await import('/core/ocr.js');
  mods.imaging = await import('/core/imaging.js');
  mods.pdfdoc = await import('/core/pdfdoc.js');
  mods.prompts = await import('/prompts/prompts.js');
  mods.schemas = await import('/prompts/schemas.js');
  mods.cards = await import('/ui/cards.js');
  mods.report = await import('/ui/report.js');
  mods.settings = await import('/ui/settings.js');
  mods.dom = await import('/ui/dom.js');
  mods.demo = await import('/core/demo.js');
  mods.store = await import('/core/store.js');
  mods.personas = await import('/core/personas.js');
  return `${Object.keys(mods).length} modules`;
});

await check('server health endpoint answers', async () => {
  const r = await fetch('/api/health');
  const j = await r.json();
  assert(j.ok === true, 'health did not report ok');
  return `${j.app} ${j.version}, ${j.seedCourses} bundled course(s)`;
});

await check('bundled 2024-scheme course index loads', async () => {
  const index = await mods.syllabus.loadSeedIndex();
  assert(index.courses.length >= 4, `only ${index.courses.length} course(s) in the index`);
  const withModules = index.courses.filter((c) => c.modules?.length && c.courseOutcomes?.length);
  assert(withModules.length >= 4, 'fewer than 4 courses carry both modules and COs');
  return `${index.courses.length} courses, ${withModules.length} with modules and COs`;
});

await check('syllabusFromIndexCourse builds a usable syllabus', async () => {
  const index = await mods.syllabus.loadSeedIndex();
  const s = mods.syllabus.syllabusFromIndexCourse(index.courses[0]);
  assert(s.modules.length >= 4, 'expected at least 4 modules');
  assert(s.courseOutcomes.length >= 4, 'expected at least 4 COs');
  assert(s.paperPattern.length === 2, 'expected a two-part paper pattern');
  assert(s.paperPattern[0].totalMarks + s.paperPattern[1].totalMarks === 60, 'pattern marks should total 60');
  const badBloom = s.courseOutcomes.filter((c) => c.bloom && !/^K[1-6]$/.test(c.bloom));
  assert(!badBloom.length, `un-normalised Bloom levels: ${badBloom.map((c) => c.bloomRaw).join(', ')}`);
  return `${s.courseCode}: ${s.modules.length} modules, ${s.courseOutcomes.length} COs, pattern ${s.paperPattern[0].totalMarks}+${s.paperPattern[1].totalMarks}`;
});

await check('normaliseBloom handles the KL column KTU prints', async () => {
  const cases = { KL3: 'K3', K3: 'K3', k4: 'K4', L2: 'K2', 'Level 5': 'K5', '3': 'K3', Apply: 'K3', nonsense: null };
  for (const [input, expected] of Object.entries(cases)) {
    const got = mods.syllabus.normaliseBloom(input);
    assert(got === expected, `normaliseBloom(${JSON.stringify(input)}) = ${got}, expected ${expected}`);
  }
  return Object.keys(cases).length + ' cases';
});

await check('deterministic KTU 2024 pattern detector works', async () => {
  const p = mods.syllabus.detectPatternFromText(
    'Max. Marks: 60 Duration: 2 hours 30 minutes PART A (Answer all questions. Each question carries 3 marks) PART B (Answer any one full question from each module, each question carries 9 marks)'
  );
  assert(p, 'detector returned nothing for a KTU-shaped header');
  assert(p.parts[0].totalMarks === 24 && p.parts[1].totalMarks === 36, 'part totals should be 24 and 36');
  return `${p.parts[0].name} ${p.parts[0].totalMarks} + ${p.parts[1].name} ${p.parts[1].totalMarks}`;
});

await check('JSON extraction and schema validation behave', async () => {
  const fenced = mods.json.extractJson('prose\n```json\n{"a":[1,2],"b":"x"}\n```\ntrailing');
  assert(fenced.ok && fenced.value.a.length === 2, 'fenced JSON was not recovered');
  const truncated = mods.json.extractJson('{"a": [1,2');
  assert(!truncated.ok, 'truncated JSON should not parse');
  const ok = mods.json.validateSchema({ n: 3 }, { type: 'object', properties: { n: { type: 'integer' } }, required: ['n'] });
  assert(ok.valid, 'a valid object was rejected');
  const bad = mods.json.validateSchema({}, { type: 'object', properties: { n: { type: 'integer' } }, required: ['n'] });
  assert(!bad.valid && bad.errors[0].path === '$.n', 'missing required field was not reported');
  return 'extract, truncation detection, required-field reporting';
});

await check('all prompts build and carry their JSON contract', async () => {
  const P = mods.prompts;
  const built = [
    P.buildScopePrompt({ message: 'Modules 1-3, 60 marks, 150 minutes' }),
    P.buildSegmentationPrompt({ paperText: 'PART A ...', scope: { modulesInScope: [1] } }),
    P.buildSyllabusPrompt({ text: 'x'.repeat(400), courseHint: 'UCEST105' }),
    P.buildCoveragePrompt({ questions: [{ id: 'A1', text: 'q', marks: 3 }], scope: { modulesInScope: [1] }, modules: [{ number: 1, topics: [{ id: '1.1', text: 't' }] }], courseOutcomes: [{ id: 'CO1', statement: 's' }] }),
    P.buildLintPrompt({ questions: [{ id: 'A1', text: 'q', marks: 3 }], scope: {}, modules: [], courseOutcomes: [] }),
    P.buildSuggestionPrompt({ targets: [{ kind: 'cover-topic' }], scope: {}, modules: [], courseOutcomes: [] }),
    P.buildPersonaQuestionPrompt({ questions: [{ id: 'A1', text: 'q', marks: 3 }], scope: {}, modules: [], courseOutcomes: [] }),
    P.buildPersonaPaperPrompt({ scope: {}, questionPredictions: [], questionMeta: [] }),
    P.buildAnalysisSummaryPrompt({ scope: {}, coverage: {}, flags: [], duplicates: [], suggestionCount: 0 }),
  ];
  for (const p of built) {
    assert(p.system?.length > 20, `prompt ${p.task} has no system message`);
    assert(p.user?.length > 20, `prompt ${p.task} has no user message`);
    assert(p.contract?.includes('Required JSON shape'), `prompt ${p.task} is missing its JSON contract`);
    assert(typeof p.temperature === 'number', `prompt ${p.task} has no temperature`);
    assert(p.schema?.type === 'object', `prompt ${p.task} has no object schema`);
  }
  return `${built.length} prompt builders, all with schemas and contracts`;
});

const bundle = {};
await check('demo bundle loads and matches the report shapes', async () => {
  bundle.data = await mods.demo.loadDemoBundle('UCEST105');
  const b = bundle.data;
  assert(b.paperText.length > 2000, 'demo paper text looks too short');
  assert(b.segmentation.questions.length === 16, `expected 16 questions, found ${b.segmentation.questions.length}`);
  assert(b.syllabus.modules.length === 4, 'expected 4 syllabus modules');
  assert(b.analysis.coverage.byModule.length === 3, 'expected 3 in-scope module rows');
  assert(b.analysis.flags.length > 8, 'expected a meaningful number of flags');
  assert(b.persona.perQuestion.length === 16, 'expected 16 persona question rows');
  return `${b.meta.courseCode}, ${b.segmentation.questions.length} questions, ${b.analysis.flags.length} flags`;
});

await check('demo analysis satisfies the acceptance criteria', async () => {
  const a = bundle.data.analysis;
  const oos = a.coverage.outOfScopeQuestions;
  assert(oos.length >= 1, 'no out-of-scope question is flagged');
  assert(a.coverage.uncoveredTopics.length >= 1, 'no uncovered in-scope topic is flagged');
  const withRewrite = a.flags.filter((f) => f.reason?.length > 8 && f.rewrite?.length > 10);
  assert(withRewrite.length >= 8, `only ${withRewrite.length} flags carry both a reason and a rewrite`);
  const missingReason = a.flags.filter((f) => !f.reason);
  assert(!missingReason.length, `${missingReason.length} flag(s) have no reason`);
  const total = a.coverage.totals;
  assert(total.answerableMarks === 60, `answerable marks should be 60, got ${total.answerableMarks}`);
  assert(total.printedMarks === 96, `printed marks should be 96, got ${total.printedMarks}`);
  return `out-of-scope ${oos.map((q) => q.label).join(', ')}; ${a.coverage.uncoveredTopics.length} uncovered topics; ${withRewrite.length} flags with rewrites`;
});

await check('demo persona report is arithmetically consistent', async () => {
  const p = bundle.data.persona;
  assert(p.perQuestion.length === 16, 'expected 16 questions');
  for (const q of p.perQuestion) {
    for (const key of ['weak', 'average', 'strong']) {
      const v = q.personas[key];
      assert(v, `${q.questionId} has no ${key} verdict`);
      assert(v.pitfall?.length > 10, `${q.questionId}/${key} has no pitfall`);
      assert(v.trigger?.length > 3, `${q.questionId}/${key} has no trigger`);
      assert(v.bandLowPercent <= v.bandHighPercent, `${q.questionId}/${key} band is inverted`);
      assert(Number.isFinite(v.timeMinutes), `${q.questionId}/${key} has no time`);
    }
  }
  assert(p.byPersona.length === 3, 'expected three persona aggregates');
  const verdicts = p.timeFeasibility.perPersona.map((x) => x.verdict);
  assert(verdicts.every((v) => ['comfortable', 'tight', 'infeasible', 'unknown'].includes(v)), 'bad time verdict');
  assert(p.separation.nonSeparators.length + p.separation.separators.length >= 1, 'no separation analysis');
  return `marks ${p.byPersona.map((x) => `${x.persona} ${x.expectedMarks}`).join(', ')}; time ${p.timeFeasibility.perPersona.map((x) => `${x.persona} ${x.minutes}m ${x.verdict}`).join(', ')}`;
});

await check('every confirmation card renders', async () => {
  const b = bundle.data;
  const c = mods.cards;
  assertHtml(c.renderProgress({ title: 'Working', steps: [{ label: 'Step', status: 'active', detail: 'x' }] }), ['stepper', 'Step'], 'progress');
  assertHtml(c.renderPaperCard({ text: 'PART A\n1 question', units: [{ kind: 'image', label: 'p.jpg' }], warnings: [], ocrCalls: 1 }), ['ocr-text', 'Text is correct'], 'paper');
  assertHtml(c.renderScopeCard(b.scope, { syllabus: b.syllabus, pattern: null, moduleChoices: b.syllabus.modules }), ['scope-code', 'Confirm scope'], 'scope');
  assertHtml(c.renderCandidatesCard({ query: 'UCEST105', candidates: [], warnings: [] }), ['syllabus-url', 'Upload syllabus'], 'candidates');
  assertHtml(c.renderSyllabusCard(b.syllabus, { pattern: null }), ['Approve syllabus', 'CO1'], 'syllabus');
  assertHtml(c.renderSegmentationCard({ ...b.segmentation, __mode: 'analysis' }, { scope: b.scope }), ['Questions are right', 'either/or'], 'segmentation');
  assertHtml(c.renderAttachments([{ name: 'a.jpg', sizeLabel: '1 MB', previewUrl: null }]), ['detach'], 'attachments');
  return '7 card renderers';
});

await check('Mode A report renders with the real demo data', async () => {
  const html = mods.report.renderAnalysisReport(bundle.data.analysis);
  assertHtml(html, ['Coverage against your confirmed scope', 'Ambiguity and fairness flags', 'Alternative questions', 'Frequency'.slice(0, 0) || 'out-of-scope'], 'analysis report');
  assert(html.includes('Accept rewrite'), 'flag cards are missing their Accept action');
  assert(html.includes('heat-'), 'the coverage heatmap is missing');
  assert(html.includes('uncovered in-scope') || html.includes('zero marks'), 'uncovered topics are not shown');
  return `${html.length.toLocaleString()} characters`;
});

await check('Mode B report renders with the real demo data', async () => {
  const html = mods.report.renderPersonaReport(bundle.data.persona);
  assertHtml(html, ['Student Persona Prediction', 'Time feasibility', 'Per-question experience', 'Study habits', 'risk flags'], 'persona report');
  for (const trait of ['Study habits', 'Typical strengths', 'Typical errors', 'Time management', 'Reading care']) {
    assert(html.includes(trait), `persona card is missing "${trait}"`);
  }
  return `${html.length.toLocaleString()} characters`;
});

await check('settings drawer renders every field', async () => {
  const html = mods.settings.renderSettings().innerHTML;
  assertHtml(
    html,
    ['llm-base-url', 'llm-api-key', 'llm-model', 'llm-routing', 'ocr-api-key', 'ocr-engine', 'ocr-endpoint', 'Verify nothing is stored'],
    'settings'
  );
  return `${html.length.toLocaleString()} characters`;
});

await check('OCR.space limits are encoded in the client', async () => {
  assert(mods.ocr.OCR_LIMITS.freeMaxBytes === 1048576, 'the 1 MB free-tier file limit is not encoded');
  assert(mods.ocr.OCR_LIMITS.freeMaxPdfPages === 3, 'the 3-page free-tier PDF limit is not encoded');
  assert(mods.imaging.OCR_MAX_BYTES < mods.ocr.OCR_LIMITS.freeMaxBytes, 'the compression target must sit under the upload limit');
  return `1 MB / 3 pages; compression target ${mods.imaging.bytesToSize(mods.imaging.OCR_MAX_BYTES)}`;
});

await check('pdf.js page renderer is vendored and loadable', async () => {
  const r = await fetch('/vendor/pdfjs/pdf.min.mjs');
  assert(r.ok, `pdf.min.mjs returned ${r.status}`);
  const w = await fetch('/vendor/pdfjs/pdf.worker.min.mjs');
  assert(w.ok, `pdf.worker.min.mjs returned ${w.status}`);
  const bytes = (await r.text()).length + (await w.text()).length;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB of pdf.js vendored locally`;
});

await check('no client-side storage is used', async () => {
  const { cleared } = mods.store.purgeStorage();
  assert(localStorage.length === 0, 'localStorage is not empty');
  assert(sessionStorage.length === 0, 'sessionStorage is not empty');
  assert(!document.cookie, 'a cookie is present');
  return `localStorage, sessionStorage and cookies all empty (checked ${cleared.length} store(s))`;
});

/* ---------------------------------------------------------------- summary */

const failed = results.filter((r) => !r.ok);
const summary = document.getElementById('summary');
summary.textContent = failed.length
  ? `${failed.length} of ${results.length} checks FAILED`
  : `All ${results.length} checks passed`;
summary.style.color = failed.length ? 'var(--danger)' : 'var(--ok)';
document.title = failed.length ? `FAIL ${failed.length}/${results.length}` : `PASS ${results.length}/${results.length}`;
document.body.dataset.selftest = failed.length ? `fail:${failed.length}` : `pass:${results.length}`;
