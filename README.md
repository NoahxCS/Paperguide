# Paperguide

An exam-paper quality checker for teachers at colleges affiliated to APJ Abdul Kalam Technological University (KTU), Kerala. Upload a question paper as a photo, a PDF, or pasted text; Paperguide reads it, confirms the scope and the **KTU 2024-scheme syllabus** with you, and then either audits the paper or predicts how weak, average and strong students would experience it.

Output is delivered in chat only. There is no login, no saved history, no database and no disk writes.

**Live:** <https://paperguide-roan.vercel.app> — no install, no terminal. Open **Demo mode** to walk the whole workflow on a real paper without entering a single key.

---

## Quick start

### Option 1 — use the hosted deployment

Open <https://paperguide-roan.vercel.app>. Everything except your own API keys works there; demo mode needs nothing at all. Your keys are entered in that browser tab and are never stored anywhere.

### Option 2 — run it locally

Requires **Node 20+**. There are no npm dependencies to install.

```bash
cd Paperguide
npm start                 # or: node server.mjs
```

Then open the printed URL: <http://127.0.0.1:8791>

```bash
node server.mjs --port 9000 --host 127.0.0.1
```

The bundled [pdf.js](https://mozilla.github.io/pdf.js/) build is committed under `vendor/` and `public/vendor/`, so nothing is fetched at install time.

Running locally is worth it if you want the local proxy for model calls (see [Settings](#settings)), if you would rather your paper never leave your machine except to OCR.space, or if a hosted search engine is refusing requests from a datacentre address.

### What works with no API key at all

| Feature | Needs a key? |
|---|---|
| Demo mode: full cached run on a real KTU paper | No |
| Bundled 2024-scheme syllabus for six real courses | No |
| Live syllabus search + fetch + PDF text extraction | No |
| Digital-PDF text extraction (a PDF with a text layer) | No |
| Hand-filled scope card, segmentation review, report layout | No |
| OCR of a photograph or scanned PDF | Yes — OCR.space key |
| Reading free text, segmenting a paper, the analysis itself | Yes — an LLM endpoint |

So you can record a complete demo, and review the whole confirmation workflow, before you enter a single key.

Two caveats on that table: live *web* search is unreliable from a hosted server, and the local proxy for model calls only exists when you run the server yourself. Both are covered under [Honest limits](#honest-limits). Everything else behaves identically on <https://paperguide-roan.vercel.app>.

---

## Settings

Open **Settings** (top right). Keys are held in this browser tab's memory only.

### Language model

Any **OpenAI-compatible** chat-completions endpoint. Presets are offered for OpenAI, OpenRouter, Groq, Together, DeepSeek, Ollama and LM Studio; you can also paste a base URL or a full `/chat/completions` URL.

Paperguide assumes **plain chat completions**: no tool calling and no native JSON mode. Every structured call therefore asks for JSON in the prompt, extracts it, validates it against an explicit schema, and **retries once** with the validation errors fed back if the reply was malformed. If it still fails you get a clear error naming the failing field and a recovery step.

Request routing:

| Mode | Behaviour |
|---|---|
| **Local proxy** (default) | The browser calls `127.0.0.1`, which forwards to your endpoint. Avoids CORS entirely and works with every provider. |
| **Automatic** | Proxy first, then a direct browser call. |
| **Browser direct** | The key never touches the server, but the provider must allow cross-origin calls and the endpoint must not be `http://` from an `https://` page. |

### OCR (OCR.space)

Free-tier limits, read from OCR.space's current documentation and encoded in the client:

* **1 MB** per file
* **3 PDF pages**
* 500 requests per day per IP

Paperguide handles these for you: images are downscaled and re-encoded in the browser until they fit 1 MB; a PDF with a text layer is read directly with **no OCR at all**; a scanned PDF longer than three pages is split into page images with pdf.js and OCRed one page at a time. Engine 2 is the default; engine 3 is more accurate on handwriting and tables but is slower and capped lower.

---

## The shared flow

Every step is confirmed by you before anything downstream uses it.

1. **Paper** — attach a photo/PDF or paste the text. The extracted text appears in an editable box, with per-source notes (bytes, compression, engine, timing). Fix anything OCR got wrong.
2. **Scope** — describe the exam in chat (*"Modules 1 to 3, 60 marks, 2.5 hours, standard pattern"*). It comes back as a card with the course, marks, duration, module checkboxes, an optional one-line class note, and the paper structure. Without a model configured you can fill this card in by hand.
3. **Syllabus** — name a course code or title. Paperguide searches a bundled index of real 2024-scheme courses, then the web and KTU-affiliated mirrors, and shows every candidate with its provenance and match score. You can paste a URL or upload the syllabus PDF instead. The parsed modules, topics and COs (with Bloom's levels) are shown for **approval or editing**.
4. **Segmentation** — the paper is split into questions with marks, sub-parts and either/or choices. Either/or pairs are counted **once**, so the arithmetic reflects what a student actually faces: the bundled paper prints 96 marks but is answerable for 60. Confirm or correct the segmentation.

Then the mode runs.

---

## Mode A — Question Analysis

* **Coverage mapping.** Every question is tagged to module, topic and CO. The table shows printed vs answerable marks, each module's share against the expected share, topics covered, and the question ids. An explicit **off-scope row** accounts for marks outside your declared scope, so the percentages always add up and the reason they do not reach 100% is stated rather than hidden.
* **Uncovered topics and out-of-scope questions.** In-scope topics that earn no marks and questions that fall outside the declared scope are both listed, and appear as flags.
* **Ambiguity and fairness linter.** Flags for vague wording, multiple interpretations, missing data, missing constraints, double-barrelled questions, marks/effort mismatch, figure dependence and near-duplicates. **Every flag carries a one-sentence reason and a drop-in rewrite of the whole question.** Each has Accept / Edit / Reject; accepting updates the *working* paper and never mutates the confirmed segmentation.
* **Bloom's check.** Compares the level each question demands with the level of the CO it maps to, and separates mismatches from unknowns.
* **Alternative questions.** Replacements for flagged questions and for uncovered topics, at a Bloom's level you choose.
* **Summary.** A verdict, strengths, risks, and specific next actions that name question ids.

## Mode B — Student Persona Prediction

Personas **do not attempt the paper**. For each question and each persona you get a score **band**, the most likely pitfall, the exact wording or concept that triggers it, the estimated time, and whether they would attempt it at all.

* Three fixed personas (**weak**, **average**, **strong**), each with a visible description card covering study habits, typical strengths, typical error types, time management and reading carefulness — the same description that is injected into the prompt.
* An optional one-line class note (*"this batch is weak at recursion"*) which shifts the predictions and is echoed back in the report.
* Paper level: expected overall spread, per-persona time totals against the exam duration with a **time-feasibility verdict**, which questions **separate** the personas and which do not, and the questions most worth rewording.
* Everything is labelled a **risk flag and relative difficulty estimate, not a measured result**, in the UI and in the prompt.

The non-separating cases are the point: the bundled demo includes one question that is *easy for all three* and one that is *hard for all three*.

---

## Demo mode

**Demo mode** replays a cached run for a real KTU paper so a slow API, a rate limit or a dead network cannot ruin a screen recording. No OCR call, no syllabus fetch and no model call is made — but the normal flow still runs, including every confirmation card, because the cached payloads are the objects the live pipeline produces.

The bundled paper is the real **UCEST105 Algorithmic Thinking with Python**, First Semester B.Tech Degree Regular Examination, December 2024 (2024 scheme), transcribed verbatim in [`demo/sample-paper-raw.md`](demo/sample-paper-raw.md). Its syllabus is the real 2024-scheme UCEST105 data from [`data/ktu-2024-index.json`](data/ktu-2024-index.json).

The demo scope deliberately declares **Modules 1–3 in scope and Module 4 out of scope**, which produces genuinely:

* **4 out-of-scope questions** (7, 8, 15, 16 — all Module 4)
* **31 uncovered in-scope topics**, including recursion on the call stack and modularization
* **25% of the answerable marks sitting outside the declared scope**

The coverage, Bloom comparison, hotspots and persona arithmetic in the bundle are computed by Paperguide's own modules at build time (`npm run build:demo`), so the cached numbers cannot drift from what a live run would produce. Only the judgement text — flag reasons and rewrites, persona pitfalls — is authored, because that is what a model supplies live.

---

## Privacy: nothing is stored

* All session state — paper text, syllabus, scope, segmentation, reports, and both API keys — lives in a plain in-memory object and is gone on refresh.
* No `localStorage`, `sessionStorage`, IndexedDB or cookies are used anywhere. The theme preference is deliberately *not* persisted.
* The server writes nothing to disk and never logs a request body.
* `window.Paperguide.state` masks both keys, so the debug surface cannot leak them.
* Settings has a **"Verify nothing is stored"** button that clears every client-side store and reports what it found. It also runs automatically on every page load.

Both the browser self-test and the flow test assert that `localStorage`, `sessionStorage` and `document.cookie` are empty after a full run.

---

## KTU 2024-scheme facts used

Taken from real 2024-scheme documents, not from memory. Details and citations are in [`docs/ktu-2024-scheme.md`](docs/ktu-2024-scheme.md) and [`docs/ktu-paper-structure.md`](docs/ktu-paper-structure.md).

* **Theory ESE**: 60 marks, 2 h 30 min. Part A: 8 compulsory questions × 3 marks (2 per module). Part B: 4 modules × 9 marks, two questions per module, **one answered** — either/or exists only in Part B, with at most three subdivisions.
* **HMC courses differ**: UCHUT346 uses 50 marks, Part A 6 × 3, Part B 4 × 8. The pattern is printed per course and **must not be assumed** — Paperguide takes it from the confirmed syllabus, then from what the teacher states, and only then falls back to a default (and says which it used).
* **Course codes** are eight characters with no year prefix: `UCEST105`, `GAMAT101`, `PCCST303`, `UCHUT346`. `XX` is a wildcard, a trailing `N` is an elective placeholder.
* **Credits** are printed as `Teaching Hours/Week (L: T: P: R)` plus a separate single `Credits` value — the tuple is L-T-P-R, not L-T-P-C.
* The CO table has two columns, `Course Outcome` and `Bloom's Knowledge Level (KL)`, with `CO1`/`CO2` embedded in the first column. Both `KL3` and `K3` forms are normalised to `K3`.

Syllabus lookup deliberately does not depend on `ktu.edu.in`: the official Academics area is a client-rendered app that serves no syllabus links, and the apex host fails TLS. Paperguide uses a bundled index of real courses first, then web search, then KTU-affiliated mirrors, and always shows provenance and a match score. A pasted URL and a PDF upload are both first-class paths.

Web search runs **Bing first, DuckDuckGo second**, because DuckDuckGo's HTML endpoint answers server-side requests with an anti-bot challenge (HTTP 202 and no result markup) — it works from your laptop but not from a hosted deployment. Results are then filtered hard: a web hit must either look like a syllabus document or match most of what you typed. Search engines answer a query they have no real match for with filler that merely shares words, and showing you "Solid State Chemistry" as a candidate for a Solid State Devices syllabus is worse than showing nothing.

That means web search is a best-effort supplement, not the dependable path. For the six seeded courses the bundled index answers instantly and offline. For anything else, paste the syllabus URL or upload the PDF.

---

## Verification

```bash
npm test                  # 143 unit tests, one process
npm run test:node         # same suites via `node --test` (per-file processes)
```

Then, with the server running, open:

| Page | What it proves |
|---|---|
| <http://127.0.0.1:8791/selftest.html> | 18 checks: every module loads, every card and report renders, the demo bundle matches the schemas, pdf.js is vendored, no client storage is used |
| <http://127.0.0.1:8791/flowtest.html> | 20 checks: drives the real app in an iframe through both modes with synthetic clicks, asserting the phase machine, the confirmation gate at each step, Accept/Reject on a rewrite, the no-model recovery path and the endpoint swap |
| <http://127.0.0.1:8791/preview.html> | Renders both demo reports directly, for reviewing layout and both themes |

`npm test` uses a single-process runner (`test/run-all.mjs`) because `node --test` spawns a child process per file, which needs piped stdio and is blocked in some sandboxes (EPERM on spawn). Both give identical results on a normal machine.

### Live OCR round trip

```bash
node scripts/check-ocr.mjs path/to/paper.jpg    # needs the server running
```

Posts a paper image through Paperguide's own `/api/ocr` proxy to the real OCR.space service and reports how many known phrases came back. With no argument it uses `ocr.space`'s public test key, which is heavily rate-limited — a rate-limit reply is reported as inconclusive rather than as a code failure. This path was verified end to end: a synthetic 1700×2300 photographed paper returned `OCRExitCode=1` with 6 of 7 probe phrases read correctly (the miss was a line my own test renderer clipped off the page edge).

### Search engine check

```bash
node scripts/check-search.mjs "UCEST105" "KTU 2024 scheme syllabus pdf"
node scripts/check-search.mjs --local "Solid State Devices KTU syllabus"   # via the running server
```

Prints which engines answered, the candidates with their provenance and score, and a direct probe of Bing and DuckDuckGo so you can see the anti-bot behaviour for yourself. Useful when a syllabus lookup comes back empty: it tells you whether the engine refused, or whether results arrived and were filtered as off-topic.

### The deployed build

The live deployment runs the same API layer as the local server — it is not a static export. Verified against <https://paperguide-roan.vercel.app>:

| Route | Result |
|---|---|
| `GET /api/health` | `{"ok":true,...,"seedCourses":6}` on Node v24 |
| `GET /api/syllabus/index` | All six real 2024-scheme courses with modules and COs |
| `GET /api/syllabus/search?q=UCEST105` | Resolves from the bundled index, with the web-search warning |
| `GET /api/syllabus/fetch?url=…pdf` | A 14-page PDF returned 69,396 characters of extracted text, so the vendored `vendor/pdfjs-node/` build is present in the function bundle |
| `GET /demo/index.json` | Demo bundle served |

Two notes for anyone re-deploying. The Vercel project's routing configuration lives in the Vercel dashboard, not in this repository, so a fresh project needs the same settings — say the word and I will commit a `vercel.json` to make it reproducible from the repo alone. And `/api/syllabus/fetch` inherits the deployed IP's reputation: a site that returns 403 to Vercel (w3.org did during testing) will 403 here too, and the error says so plainly.

---

## Acceptance criteria

| Criterion | Where it is met |
|---|---|
| A photographed KTU paper goes through OCR, segmentation and a confirmed scope with no code changes | Photograph → [`prepareImageForOcr`](public/core/imaging.js) compresses under 1 MB → OCR.space → editable review card → scope card → syllabus approval → segmentation card. No configuration beyond Settings. |
| Mode A flags an out-of-scope question and an uncovered in-scope topic on the sample papers | The bundled demo flags questions **7, 8, 15, 16** as out of scope and lists **31** in-scope topics with zero marks. Asserted in `selftest.js`. |
| Every ambiguity flag has a reason and a rewrite | Schema-required on the model path; the demo bundle has 57 flags, of which every authored one carries both. Asserted in `selftest.js`. |
| Mode B shows persona cards and per-question pitfalls for all three personas, and reports time feasibility | Persona cards carry all five traits; every question has a pitfall and trigger for all three personas; the time-feasibility verdict follows from the summed times. Asserted in `selftest.js` and `flowtest.js`. |
| Swapping the base URL, key and model works with no code changes | Settings drawer, with endpoint presets and a live "Test connection". Asserted in `flowtest.js`. |
| Refreshing the page leaves no stored data | No storage API is used; both browser suites assert the stores are empty after a full run. |

---

## Project layout

```
server.mjs              zero-dependency HTTP server and API routes
server/
  http.mjs              helpers, URL guard, byte-capped fetch
  static.mjs            static file server with a traversal guard
  documents.mjs         fetch a syllabus URL, extract PDF/HTML text
  pdf-text.mjs          server-side PDF text extraction (vendored pdf.js)
  html-text.mjs         HTML to readable text, entity decoding, link extraction
  syllabus-search.mjs   bundled index + web search (Bing, then DuckDuckGo) + official listing, ranked and relevance-filtered
  llm-proxy.mjs         chat-completions forwarding with credential redaction
  ocr-proxy.mjs         OCR.space pass-through proxy
public/
  app.js                conversation flow controller
  core/
    store.js            in-memory session state; purgeStorage to prove it
    llm.js              OpenAI-compatible client, JSON contract + one repair retry
    json.js             JSON recovery from prose, and the schema validator
    ocr.js              OCR.space client and the per-file OCR route decision
    imaging.js          browser-side image compression and enhancement
    pdfdoc.js           pdf.js page rendering, for scanned multi-page PDFs
    analysis.js         Mode A: deterministic coverage math + LLM passes
    persona.js          Mode B: deterministic aggregation + LLM passes
    syllabus.js         syllabus fetch/parse/confirm, hand-rolled pattern detector
    personas.js         the three persona definitions
    demo.js             demo bundle loader
    errors.js           typed errors, each with a recovery path
    util.js             small shared helpers
  prompts/
    prompts.js          every prompt, versioned, with its schema rendered in
    schemas.js          the JSON contracts
  ui/
    dom.js  cards.js  report.js  settings.js
  selftest.html/.js     browser self-test (18 checks)
  flowtest.html/.js     end-to-end flow test (20 checks)
  preview.html          report preview
data/ktu-2024-index.json    six real 2024-scheme courses with modules and COs
demo/sample-paper-raw.md    two real KTU papers, transcribed verbatim
docs/                       KTU scheme + paper-anatomy research, architecture
scripts/build-demo.mjs      regenerates the demo bundle
scripts/check-ocr.mjs       live OCR.space round-trip check
scripts/check-search.mjs    search-engine diagnostic
test/                       143 unit tests
```

## Deployment

It is deployed on Vercel at <https://paperguide-roan.vercel.app>, serving `public/` at the root and running `server.mjs`'s routes as a Node function. `public/` and `vendor/` are both committed, so the deployment is self-contained: there is no build step and no dependency install stage.

What differs from a local run:

| | Local | Hosted |
|---|---|---|
| Model calls | Local proxy available, so every provider works | Browser-direct only, so the provider must allow cross-origin calls |
| Syllabus web search | Usually answered | Frequently refused or degraded by the search engine; the bundled index and URL/PDF paths carry it |
| OCR | Proxy or direct | Browser-direct to OCR.space |
| Paper data | Never leaves the machine except to OCR.space and your model | Same, but the local server is not in the path |

The privacy guarantee is unchanged either way: no storage APIs, no database, no logs, and keys held in one browser tab.

---

## Honest limits

* **Mode B is an estimate, not measurement.** Bands come from a model's reading of the question wording and cognitive demand. They are risk flags. The bundled demo's bands come from a documented rubric over Bloom's level, marks and a persona time factor — labelled as such in the report.
* **Syllabus retrieval is best-effort.** No official per-course PDF URL on `ktu.edu.in` could be confirmed; the bundled index holds six courses, and everything else relies on search and mirrors. Upload is the reliable path, which is why it is a first-class button rather than a fallback of last resort.
* **Live web search is the weakest link, especially hosted.** DuckDuckGo bot-blocks server-side requests outright, and Bing answers from a datacentre IP with filler for the queries that matter most — a bare course code like `UCEST105` returns twenty unrelated pages, all of which are now discarded rather than shown. Search contributes real value for broad queries (`KTU 2024 scheme syllabus pdf` returns KTU's own curriculum page) and almost nothing for narrow ones. The bundled index and the URL/upload paths are what actually work; `scripts/check-search.mjs` shows exactly what each engine returned.
* **The bundled index is a seed, not a catalogue.** Adding courses is a matter of extending `data/ktu-2024-index.json`; the shape is documented by example.
* **OCR quality sets the ceiling.** Marks lost in OCR become inferred marks, and the segmentation card says which ones were inferred. Fixing the text before confirming is the single highest-value habit.
* **`node --test` may fail in a sandbox** that blocks piped stdio (EPERM on spawn). Use `npm test`, which runs the same suites in one process.
* **The r.jina.ai text reader** is used only as a last resort for a scanned syllabus PDF that has no text layer, and the report says when it was used.
* **The Vercel project configuration is not in this repository.** The deployment works, but re-creating it from a bare clone would need the same dashboard settings.
