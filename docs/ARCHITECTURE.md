# Architecture

## Shape

A zero-dependency browser app plus a small Node server. No bundler, no framework, no build step: the browser loads ES modules directly, and the server serves them.

That choice was driven by the environment as much as by taste — `npm install` is unavailable in a sandboxed or offline environment, so anything that needed installing would not run. The only two third-party pieces are vendored as files:

* `public/vendor/pdfjs/` — the browser build of pdf.js, for rendering scanned PDF pages to images
* `vendor/pdfjs-node/` — the Node build, for extracting text from digital PDFs

Everything else is hand-written, and the project runs with `node server.mjs` on a clean checkout.

## Why a server at all, for a client-side app?

Three jobs the browser cannot do:

1. **Syllabus fetch without CORS.** Arbitrary syllabus hosts do not send CORS headers, and the browser cannot read a cross-origin PDF or HTML page. `GET /api/syllabus/fetch` fetches and extracts server-side.
2. **Real PDF text extraction.** A digital PDF read through its text layer is exact, whereas OCR of the same file is approximate and costs a request. `/api/pdf/text` takes an uploaded PDF and returns its text, so a teacher who uploads a digital paper gets **no OCR at all**.
3. **A CORS-free path to the model.** Many providers block browser-origin calls. `/api/llm/chat` forwards the request, so the default `proxy` routing works everywhere. `direct` routing exists for anyone who would rather the key never reach the server.

The server keeps no state, writes nothing to disk, and never logs a request body. Credentials are copied from the request into an upstream header and are scrubbed from any error it returns (`redact()` in `server/llm-proxy.mjs`).

## Boundaries

```
       browser                                  node (localhost)                 internet
┌──────────────────────────┐            ┌───────────────────────────┐   ┌─────────────────────┐
│ app.js  (flow control)   │            │ /api/syllabus/search      │──▶│ web search, mirrors │
│  ui/*   (rendering)      │── fetch ──▶│ /api/syllabus/fetch       │──▶│ syllabus PDFs/HTML  │
│  core/* (domain logic)   │            │ /api/pdf/text             │   └─────────────────────┘
│  prompts/* (LLM contract)│            │ /api/llm/chat             │──▶│ model endpoint      │
└───────────┬──────────────┘            │ /api/ocr                  │──▶│ api.ocr.space       │
            │                           └───────────────────────────┘   └─────────────────────┘
            │ direct (optional)
            └──────────────────────────────────────────────────────────────────▶ model endpoint
```

## The central design decision: deterministic arithmetic, LLM judgement

Every number a teacher might act on is computed in plain JavaScript, not by a model:

| Computed in code | Supplied by the model |
|---|---|
| Mark weightage per module and CO | The module/topic/CO each question maps to |
| Printed vs answerable marks (either/or counted once) | The assessed Bloom level |
| Uncovered in-scope topics | Flag reasons and rewrites |
| Out-of-scope questions and the off-scope share | Alternative questions |
| Bloom comparison against the mapped CO | Persona pitfalls and triggers |
| Hotspots against the expected share | The narrative summaries |
| Persona score totals, times, separation, feasibility | Per-question score bands |

This is why the reports can be trusted arithmetically and why the test suite can assert on them without a model. It also means a model failure degrades to "fewer insights", never to "wrong numbers".

Where both could speak, the computed value wins and the disagreement is surfaced: `runPersonaPrediction` compares its own summed time verdict with the model's and reports a warning when they differ, rather than silently picking one.

## Flow control

`public/app.js` holds an explicit phase machine — `mode-select → paper → ocr-review → scope → syllabus-query → syllabus-candidates → syllabus-review → segmentation-review → running → report`. Each transition is triggered by a card action, and each card reads its values back out of the DOM before the next render. Nothing downstream can run on an unconfirmed input:

* the paper text must be confirmed before scope parsing,
* the syllabus must be flagged `syllabusApproved` before segmentation, and any newly loaded syllabus resets that flag,
* the segmentation must be confirmed before a mode runs.

Rendering is "rebuild the chat from state", which is cheap at this size. The one wrinkle is that a rebuild discards in-progress textarea edits, so every handler reads form values into state *before* causing a render, and the live progress card is updated in place so a running step does not re-render the conversation underneath the user.

## JSON contracts

The brief's constraint — plain chat completions, no tool calling, no native JSON mode — shapes the whole LLM layer:

1. `public/prompts/schemas.js` defines one schema per task.
2. `schemaToSpec()` renders that schema into the prompt, so the model is told the exact shape rather than guessing it.
3. `extractJson()` recovers JSON from prose, code fences or a truncated reply, with a trailing-comma repair.
4. `validateSchema()` checks it and reports errors as JSON paths.
5. On failure the model gets one repair turn containing the failing paths and the re-rendered spec.

`temperature` is 0.1–0.2 for tagging, linting and parsing (consistency matters) and 0.4–0.5 for rewrites and persona prediction (variety is useful). Long papers are batched — 12 questions per coverage call, 8 per lint call, 6 per persona call — so a large paper cannot overflow the context window, and partial results are kept if a later batch fails.

## Prompt versioning

All prompts live in one file with `PROMPT_VERSION`, and every report records the version and the model that produced it. `PROMPTS.builders` is a registry, so the settings/debug surface can show exactly what would be sent.

## Error handling

Every failure carries a recovery path. `core/errors.js` maps error codes to a concrete next action, and `errorCalloutHtml()` renders the message *and* that action next to buttons that perform it. Examples: a missing OCR key offers the free-key URL and the paste-text route; a CORS failure suggests switching routing; a tolerated-JSON failure suggests a larger model; a syllabus PDF with no text layer suggests the upload fallback.

The "no model configured" case is treated as a first-class state rather than an error: the teacher can fill the scope card in by hand and continue.

## OCR routing

Decided per file, to spend as few OCR requests as possible:

```
image ─────────────────► compress under 1 MB ──► OCR.space
PDF, has text layer ───► server pdf.js text extraction (no OCR)
PDF, scanned, ≤3 pages and ≤1 MB ──► OCR.space directly
PDF, scanned, larger ──► render each page to JPEG with pdf.js ──► OCR per page
```

## Testing strategy

Three layers, because each catches a different class of bug:

* **`test/`** (133 assertions, Node) — pure logic: the schema validator, HTML/PDF text extraction, course-code recognition, ranking, the coverage arithmetic, persona aggregation, scope-vs-syllabus resolution.
* **`/selftest.html`** (18 checks, real browser) — module wiring and rendering. This is the layer that caught an unquoted hyphenated object key in `report.js` that made both report renderers throw, and `el('div')` returning a text node instead of an element, which broke the Settings drawer.
* **`/flowtest.html`** (20 checks, real browser) — drives the app in an iframe with synthetic clicks. This is the layer that caught the landing hero never rendering (so no mode could be chosen), the settings drawer being permanently painted over the app because a class-based `display` outranked `[hidden]`, and "New session" not rebuilding the chat.

The last category is worth the harness: all three were invisible to unit tests and fatal to a demo.

## The demo bundle

`scripts/build-demo.mjs` generates `public/demo/` from real material and the app's own modules:

1. the paper text is the verbatim UCEST105 December 2024 transcription,
2. the syllabus comes from `data/ktu-2024-index.json` via `syllabusFromIndexCourse`,
3. every question's module and CO come from the **printed** module labels and CO tags,
4. topics are located by keyword against the real module topic lists,
5. `computeCoverage`, `computeBloomCheck`, `computeHotspots` and `aggregatePersonas` compute the report,
6. authored judgement text (flag reasons/rewrites, persona pitfalls) is merged in.

Because step 5 uses the same functions a live run uses, the cached numbers cannot drift from the shapes the UI and tests expect. Rebuild with `npm run build:demo`.

## Deployment

Deployed on Vercel at <https://paperguide-roan.vercel.app>: `public/` is served at the root and the `/api/*` routes run as a Node function. Because `public/` and `vendor/` are committed, there is no build step and no dependency install stage — the same property that makes `node server.mjs` work on a clean checkout makes the deployment self-contained.

The deployed routes were verified individually rather than assumed:

| Route | Evidence |
|---|---|
| `GET /api/health` | Returns `{"ok":true,...,"seedCourses":6}` on Node v24 |
| `GET /api/syllabus/index` | All six seeded courses with real modules and COs |
| `GET /api/syllabus/search?q=UCEST105` | Resolves from the bundled index |
| `GET /api/syllabus/fetch?url=…tracemonkey.pdf` | 14 pages, 69,396 characters extracted — so `vendor/pdfjs-node/` is present inside the function bundle, which was the main packaging risk |
| `GET /demo/index.json` | Bundle served |

Two things behave differently once hosted, and both come down to IP reputation rather than code:

* **Search engines.** DuckDuckGo returns HTTP 202 with an anti-bot challenge and no result markup, so it is useless server-side. Bing answers, but with filler for narrow queries. This is why the engine order is Bing-then-DuckDuckGo and why results pass through a relevance filter: a hosted server has to be willing to return nothing.
* **`/api/syllabus/fetch`.** It inherits the deployment's address. A host that 403s Vercel (w3.org did during testing) produces a `UPSTREAM_STATUS` error naming the status and the URL, which is the correct outcome: the route worked, the upstream refused.

The local proxy for model calls is the one capability that is local-only, because there is no server-side state to route through when the page is not served by our own process. On the hosted build, model calls go browser-direct, so the provider must allow cross-origin requests. The Settings drawer exposes this as an explicit choice rather than leaving it implicit.

The Vercel project's routing configuration lives in the dashboard, not in the repository, so re-creating the project from a bare clone needs those settings repeated. Committing a `vercel.json` would close that gap.

## Deliberate omissions

* **No streaming tokens.** The brief allows "streaming **or** step-by-step progress"; every LLM call returns JSON, which streams poorly. Progress is a step list with live per-stage detail, which is more legible in a recording.
* **No persistence layer of any kind** — not even an opt-in one, because "refreshing the page leaves no stored data" is an acceptance criterion and a feature flag would weaken it.
* **No CSS framework.** ~1000 lines of hand-written CSS with custom properties for theming, so the light/dark switch is one attribute.
