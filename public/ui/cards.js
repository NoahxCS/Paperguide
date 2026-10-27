/**
 * Confirmation cards. Everything downstream depends on these, so each one is
 * shown before the next step and is editable in place.
 *
 * Cards render HTML strings containing `data-act` hooks; app.js owns the event
 * delegation and reads form values back out on submit.
 */
import { esc, heatCell, heatLegend, callout } from './dom.js';
import { BLOOM_LEVELS } from '../prompts/schemas.js';
import { bloomName } from '../core/syllabus.js';
import { formatMinutes, pluralise } from '../core/util.js';

/** Per-card UI toggles (edit modes). Not session data, so it lives here. */
export const uiState = {
  editSyllabus: false,
  editSegmentation: false,
};

/* ---------------------------------------------------------------- progress */

export function renderProgress(progress) {
  if (!progress) return '';
  const steps = progress.steps ?? [];
  const doneCount = steps.filter((s) => s.status === 'done').length;
  return `
    <div class="card">
      <div class="card-head">
        <h3>${esc(progress.title ?? 'Working')}
          <span class="card-sub">${doneCount}/${steps.length} steps</span>
        </h3>
        ${progress.badge ?? ''}
      </div>
      <div class="card-body">
        <ol class="stepper">
          ${steps
            .map(
              (s, i) => `
            <li class="step ${s.status === 'done' ? 'done' : s.status === 'active' ? 'active' : s.status === 'error' ? 'error' : ''}">
              <span class="step-dot">${s.status === 'done' ? '&#10003;' : s.status === 'error' ? '!' : i + 1}</span>
              <span>
                <span class="step-label">${esc(s.label)}</span>
                ${s.detail ? `<span class="step-detail">${esc(s.detail)}</span>` : ''}
              </span>
            </li>`
            )
            .join('')}
        </ol>
      </div>
    </div>
  `;
}

/* ---------------------------------------------------------------- paper / OCR */

export function renderPaperCard(paper) {
  if (!paper) return '';
  const warnings = paper.warnings ?? [];
  const units = paper.units ?? [];
  const methodLabel = {
    'pasted': 'Pasted text',
    'image': 'Photographed page, OCRed',
    'pdf-text': 'Digital PDF, text layer read directly',
    'pdf-ocr': 'Scanned PDF, OCRed',
    'pdf-pages': 'Scanned PDF, split into page images and OCRed',
    'text-file': 'Text file',
  };
  const methods = [...new Set(units.map((u) => u.kind))].map((k) => methodLabel[k] ?? k);

  return `
    <div class="card" data-card="paper">
      <div class="card-head">
        <h3>Step 1 &middot; Paper text for review
          <span class="badge badge-info">${esc(methods.join(' + ') || 'no text')}</span>
        </h3>
        <span class="card-sub">${paper.text ? `${paper.text.length.toLocaleString()} characters` : 'nothing extracted'}</span>
      </div>
      <div class="card-body">
        ${units.length ? `<div class="chip-row">${units
          .map(
            (u) =>
              `<span class="badge" title="${esc(u.note ?? '')}">${esc(u.label)}${u.numPages ? ` &middot; ${u.numPages}p` : ''}${u.processingMs ? ` &middot; ${(u.processingMs / 1000).toFixed(1)}s` : ''}${u.engine ? ` &middot; engine ${u.engine}` : ''}</span>`
          )
          .join('')}</div>` : ''}

        ${
          warnings.length
            ? callout('warn', 'Worth checking', warnings.map((w) => esc(w)).join('<br />'))
            : callout('ok', 'Text extracted cleanly', 'OCR ran without warnings. Correct anything that looks wrong before continuing &mdash; everything downstream uses this text.')
        }

        <label class="field" for="ocr-text">Extracted text &mdash; edit freely, this becomes the paper of record</label>
        <textarea id="ocr-text" rows="14" spellcheck="false" style="font-family:var(--mono);font-size:12.5px;line-height:1.5">${esc(paper.text)}</textarea>
        <p class="field-hint">Common OCR fixes: <span class="mono">0</span>/<span class="mono">O</span> and <span class="mono">1</span>/<span class="mono">l</span> swaps, lost marks in brackets, split question numbers. Marks that cannot be read are inferred from the paper structure and flagged later.</p>
      </div>
      <div class="card-foot">
        <span class="card-sub">${paper.ocrCalls ? `${pluralise(paper.ocrCalls, 'OCR request')} used` : 'No OCR requests used'}</span>
        <div class="btn-row">
          <button class="btn btn-secondary btn-sm" data-act="paper-reupload" type="button">Replace file</button>
          ${paper.ocrCalls ? `<button class="btn btn-secondary btn-sm" data-act="ocr-enhance" type="button">Retry OCR with enhancement</button>` : ''}
          <button class="btn btn-primary btn-sm" data-act="paper-confirm" type="button">Text is correct &mdash; continue</button>
        </div>
      </div>
    </div>
  `;
}

/* ---------------------------------------------------------------- scope */

export function renderScopeCard(scope, { syllabus, pattern, moduleChoices }) {
  const parts = pattern?.parts ?? scope?.paperStructure?.parts ?? [];
  const inScope = new Set((scope?.modulesInScope ?? []).map(Number));
  const choices = moduleChoices ?? [];

  return `
    <div class="card" data-card="scope">
      <div class="card-head">
        <h3>Step 2 &middot; Confirm the exam scope</h3>
        <span class="card-sub">Everything is checked against this</span>
      </div>
      <div class="card-body">
        ${scope?.unresolved?.length
          ? callout('warn', 'You did not state these, so they are blank', esc(scope.unresolved.join(', ')))
          : ''}

        <div class="field-row two">
          <div>
            <label class="field" for="scope-code">Course code</label>
            <input id="scope-code" type="text" data-scope="courseCode" value="${esc(scope?.courseCode ?? '')}" placeholder="UCEST105" />
          </div>
          <div>
            <label class="field" for="scope-title">Course title</label>
            <input id="scope-title" type="text" data-scope="courseTitle" value="${esc(scope?.courseTitle ?? '')}" placeholder="Algorithmic Thinking with Python" />
          </div>
        </div>

        <div class="field-row two">
          <div>
            <label class="field" for="scope-marks">Total marks</label>
            <input id="scope-marks" type="number" min="0" step="1" data-scope="totalMarks" value="${scope?.totalMarks ?? ''}" placeholder="60" />
          </div>
          <div>
            <label class="field" for="scope-duration">Duration (minutes)</label>
            <input id="scope-duration" type="number" min="0" step="5" data-scope="durationMinutes" value="${scope?.durationMinutes ?? ''}" placeholder="150" />
          </div>
        </div>

        <div>
          <span class="field">Modules in scope</span>
          <div class="chip-row">
            ${
              choices.length
                ? choices
                    .map(
                      (m) => `<label class="badge" style="cursor:pointer;gap:6px">
                        <input type="checkbox" data-scope-module="${m.number}" ${inScope.has(Number(m.number)) ? 'checked' : ''} style="width:auto;margin:0" />
                        Module ${m.number}${m.title ? ` &middot; ${esc(String(m.title).slice(0, 46))}` : ''}
                      </label>`
                    )
                    .join('')
                : '<span class="muted small">Confirm the syllabus first and its modules will appear here.</span>'
            }
          </div>
          <p class="field-hint">Any question mapped outside these modules is reported as out of scope. Any topic inside them that earns no marks is reported as uncovered.</p>
        </div>

        <div>
          <label class="field" for="scope-class-note">Note about this class (optional, one line)</label>
          <input id="scope-class-note" type="text" data-scope="classNote" value="${esc(scope?.classNote ?? '')}" placeholder="This batch is weak at recursion and proofs." />
          <p class="field-hint">Used only in Student Persona Prediction, to shift the predictions for your batch.</p>
        </div>

        <div>
          <span class="field">Paper structure</span>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Part</th><th>Instructions</th><th class="num">Questions</th><th class="num">Marks each</th><th class="num">Total</th><th>Choice</th></tr></thead>
              <tbody>
                ${
                  parts.length
                    ? parts
                        .map(
                          (p) => `<tr>
                            <td><strong>${esc(p.name)}</strong></td>
                            <td>${esc(p.instructions ?? '')}</td>
                            <td class="num">${p.questionCount ?? '&ndash;'}</td>
                            <td class="num">${p.marksPerQuestion ?? '&ndash;'}</td>
                            <td class="num">${p.totalMarks ?? '&ndash;'}</td>
                            <td>${p.choice === 'either-or' ? '<span class="badge badge-info">either / or</span>' : p.choice === 'none' ? '<span class="badge">answer all</span>' : esc(p.choice ?? '&ndash;')}</td>
                          </tr>`
                        )
                        .join('')
                    : '<tr><td colspan="6" class="muted">No structure stated. Paperguide will infer it from the paper and show it at the segmentation step.</td></tr>'
                }
              </tbody>
            </table>
          </div>
          ${pattern?.note ? `<p class="field-hint">${esc(pattern.note)}${pattern.source ? ` <span class="badge badge-mono">${esc(pattern.source)}</span>` : ''}</p>` : ''}
        </div>
      </div>
      <div class="card-foot">
        <span class="card-sub">${syllabus ? 'Syllabus already confirmed' : 'The syllabus is fetched next'}</span>
        <div class="btn-row">
          <button class="btn btn-ghost btn-sm" data-act="scope-reparse" type="button">Re-read my description</button>
          <button class="btn btn-primary btn-sm" data-act="scope-confirm" type="button">Confirm scope</button>
        </div>
      </div>
    </div>
  `;
}

/* ---------------------------------------------------------------- syllabus lookup */

export function renderCandidatesCard({ query, candidates, warnings, sourcesTried, busyLabel }) {
  return `
    <div class="card" data-card="candidates">
      <div class="card-head">
        <h3>Step 3 &middot; Find the syllabus
          <span class="badge">${esc(query)}</span>
        </h3>
        <span class="card-sub">${candidates.length} candidate(s)${sourcesTried?.length ? ` from ${esc(sourcesTried.join(', '))}` : ''}</span>
      </div>
      <div class="card-body">
        ${busyLabel ? callout('info', 'Working', esc(busyLabel)) : ''}
        ${(warnings ?? []).length ? callout('warn', 'Notes about this lookup', warnings.map((w) => esc(w)).join('<br />')) : ''}
        ${
          candidates.length
            ? `<div class="table-wrap"><table class="data">
                <thead><tr><th>Source</th><th>Result</th><th class="num">Match</th><th></th></tr></thead>
                <tbody>
                  ${candidates
                    .map(
                      (c, i) => `<tr>
                        <td>
                          <span class="badge ${c.provenance === 'bundled-index' ? 'badge-ok' : c.provenance === 'ktu-listing' ? 'badge-info' : ''}">${esc(
                            c.provenance === 'bundled-index' ? 'bundled 2024 index' : c.provenance === 'ktu-listing' ? 'KTU listing' : 'web search'
                          )}</span>
                          <div class="small muted">${esc(c.trust ?? '')}</div>
                        </td>
                        <td>
                          <div><strong>${esc(String(c.title ?? '').slice(0, 130))}</strong></div>
                          <div class="small muted mono">${esc(String(c.url ?? '').slice(0, 120))}</div>
                          ${c.snippet ? `<div class="small muted">${esc(String(c.snippet).slice(0, 180))}</div>` : ''}
                          ${c.why ? `<div class="small"><span class="badge badge-mono">${esc(c.why)}</span></div>` : ''}
                        </td>
                        <td class="num">${Math.round((c.score ?? 0) * 100)}%</td>
                        <td><button class="btn btn-secondary btn-sm" data-act="syllabus-use" data-index="${i}" type="button">Use</button></td>
                      </tr>`
                    )
                    .join('')}
                </tbody>
              </table></div>`
            : callout('warn', 'No candidates found', 'Live search found nothing, or you are offline. Paste a syllabus URL below, or upload the syllabus PDF &mdash; both work without search.')
        }

        <div>
          <label class="field" for="syllabus-url">Or paste the syllabus URL directly</label>
          <div style="display:flex;gap:8px">
            <input id="syllabus-url" type="url" placeholder="https://…/UCEST105-syllabus.pdf" />
            <button class="btn btn-secondary btn-sm" data-act="syllabus-fetch-url" type="button" style="flex:none">Fetch</button>
          </div>
          <p class="field-hint">A PDF or an HTML page both work. Digital PDFs are read from their text layer; scanned PDFs fall back to a text reader.</p>
        </div>
      </div>
      <div class="card-foot">
        <span class="card-sub">Bundled 2024-scheme data needs no network at all</span>
        <div class="btn-row">
          <button class="btn btn-secondary btn-sm" data-act="syllabus-upload" type="button">Upload syllabus PDF</button>
          <button class="btn btn-ghost btn-sm" data-act="syllabus-search-again" type="button">Search again</button>
        </div>
      </div>
    </div>
  `;
}

export function renderSyllabusCard(syllabus, { pattern } = {}) {
  const editing = uiState.editSyllabus;
  const credits = syllabus.credits ?? {};
  const creditText = [
    credits.l != null ? `L ${credits.l}` : null,
    credits.t != null ? `T ${credits.t}` : null,
    credits.p != null ? `P ${credits.p}` : null,
    credits.r != null ? `R ${credits.r}` : null,
    credits.credits != null ? `${credits.credits} credits` : null,
  ]
    .filter(Boolean)
    .join(' \u00b7 ');

  return `
    <div class="card" data-card="syllabus">
      <div class="card-head">
        <h3>Step 3 &middot; Confirm the syllabus
          <span class="badge badge-mono">${esc(syllabus.courseCode || 'unknown code')}</span>
          ${syllabus.sourceKind === 'bundled-index' ? '<span class="badge badge-ok">real 2024-scheme data</span>' : ''}
        </h3>
        <span class="card-sub">${esc(syllabus.courseTitle || '')}${syllabus.semester ? ` &middot; S${esc(syllabus.semester)}` : ''}${syllabus.branch ? ` &middot; ${esc(syllabus.branch)}` : ''}</span>
      </div>
      <div class="card-body">
        ${
          syllabus.notFound?.length
            ? callout('warn', 'Not found in the source', esc(syllabus.notFound.join(', ')))
            : callout('ok', 'Parsed cleanly', 'Modules, topics and course outcomes were all found in the source document.')
        }

        <dl class="kv">
          ${creditText ? `<dt>Teaching hours / credits</dt><dd>${esc(creditText)}</dd>` : ''}
          ${syllabus.assessment ? `<dt>Assessment</dt><dd>CIE ${esc(syllabus.assessment.cieMarks ?? '?')} &middot; ESE ${esc(syllabus.assessment.eseMarks ?? '?')}${syllabus.assessment.eseDurationMinutes ? ` &middot; ${esc(formatMinutes(syllabus.assessment.eseDurationMinutes))}` : ''}</dd>` : ''}
          <dt>Modules</dt><dd>${syllabus.modules.length}</dd>
          <dt>Course outcomes</dt><dd>${syllabus.courseOutcomes.length || 'none found'}</dd>
          <dt>Paper pattern</dt><dd>${pattern?.parts?.length ? `${pattern.parts.length} part(s)` : 'not stated in the syllabus'} ${pattern?.source ? `<span class="badge badge-mono">${esc(pattern.source)}</span>` : ''}</dd>
        </dl>

        ${
          editing
            ? `<p class="field-hint">Edit one topic per line. A line starting with <span class="mono">#</span> is treated as the module title.</p>`
            : ''
        }

        <div class="table-wrap scroll-y">
          <table class="data">
            <thead><tr><th style="width:64px">Module</th><th>Topics</th></tr></thead>
            <tbody>
              ${syllabus.modules
                .map(
                  (m) => `<tr>
                    <td><strong>${m.number}</strong>${m.hours ? `<div class="small muted">${m.hours} h</div>` : ''}</td>
                    <td>
                      ${
                        editing
                          ? `<input type="text" data-syllabus-title="${m.number}" value="${esc(m.title)}" placeholder="Module title" style="margin-bottom:6px" />
                             <textarea rows="6" data-syllabus-topics="${m.number}" spellcheck="false" style="font-family:var(--mono);font-size:12px">${esc(
                               m.topics.map((t) => t.text).join('\n')
                             )}</textarea>`
                          : `<div><strong>${esc(m.title || '(untitled module)')}</strong></div>
                             <div class="small muted">${m.topics.length} topic(s)</div>
                             <ul class="small" style="margin:6px 0 0;padding-left:18px">
                               ${m.topics.slice(0, 6).map((t) => `<li>${esc(t.text.length > 150 ? `${t.text.slice(0, 150)}…` : t.text)}</li>`).join('')}
                               ${m.topics.length > 6 ? `<li class="muted">and ${m.topics.length - 6} more…</li>` : ''}
                             </ul>`
                      }
                    </td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>

        <div>
          <span class="field">Course outcomes</span>
          ${
            syllabus.courseOutcomes.length
              ? `<div class="table-wrap">
                  <table class="data">
                    <thead><tr><th style="width:70px">CO</th><th>Statement</th><th style="width:170px">Bloom's level</th></tr></thead>
                    <tbody>
                      ${syllabus.courseOutcomes
                        .map(
                          (c) => `<tr>
                            <td class="mono">${esc(c.id)}</td>
                            <td>${editing ? `<textarea rows="2" data-syllabus-co="${esc(c.id)}" spellcheck="false">${esc(c.statement)}</textarea>` : esc(c.statement)}</td>
                            <td>
                              ${
                                editing
                                  ? `<select data-syllabus-bloom="${esc(c.id)}">
                                      <option value="">(not stated)</option>
                                      ${BLOOM_LEVELS.map((l) => `<option value="${l}" ${c.bloom === l ? 'selected' : ''}>${l} &middot; ${esc(bloomName(l))}</option>`).join('')}
                                    </select>`
                                  : c.bloom
                                    ? `<span class="badge badge-info">${esc(c.bloom)} &middot; ${esc(bloomName(c.bloom) ?? '')}</span>${c.bloomRaw && c.bloomRaw !== c.bloom ? `<div class="small muted">source said "${esc(c.bloomRaw)}"</div>` : ''}`
                                    : '<span class="badge badge-warn">not stated</span>'
                              }
                            </td>
                          </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>`
              : callout('warn', 'No course outcomes found', 'Bloom\'s comparison and CO weightage need COs. Add them by editing, or continue &mdash; coverage will report modules only.')
          }
        </div>

        ${syllabus.sourceUrl ? `<p class="field-hint">Source: <span class="mono">${esc(syllabus.sourceUrl)}</span></p>` : ''}
      </div>
      <div class="card-foot">
        <span class="card-sub">${uiState.editSyllabus ? 'Editing &mdash; save to keep changes' : 'Only these modules and COs are used downstream'}</span>
        <div class="btn-row">
          <button class="btn btn-secondary btn-sm" data-act="syllabus-upload" type="button">Use a different syllabus</button>
          ${
            uiState.editSyllabus
              ? `<button class="btn btn-secondary btn-sm" data-act="syllabus-cancel-edit" type="button">Cancel edit</button>
                 <button class="btn btn-primary btn-sm" data-act="syllabus-save-edit" type="button">Save changes</button>`
              : `<button class="btn btn-secondary btn-sm" data-act="syllabus-edit" type="button">Edit modules or COs</button>
                 <button class="btn btn-primary btn-sm" data-act="syllabus-confirm" type="button">Approve syllabus</button>`
          }
        </div>
      </div>
    </div>
  `;
}

/* ---------------------------------------------------------------- segmentation */

export function renderSegmentationCard(segmentation, { scope }) {
  const editing = uiState.editSegmentation;
  const questions = segmentation.questions ?? [];
  const printed = questions.reduce((n, q) => n + (q.marks ?? 0), 0);
  const answerable = questions.reduce((n, q) => n + countedShare(questions, q), 0);
  const modules = [...new Set(questions.map((q) => q.moduleLabel).filter(Boolean))];
  const inScope = new Set((scope?.modulesInScope ?? []).map(Number));

  return `
    <div class="card" data-card="segmentation">
      <div class="card-head">
        <h3>Step 4 &middot; Confirm the questions
          <span class="badge badge-mono">${questions.length} questions</span>
        </h3>
        <span class="card-sub">
          ${printed} marks printed &middot; ${answerable} answerable
          ${segmentation.durationMinutes ? ` &middot; ${esc(formatMinutes(segmentation.durationMinutes))}` : ''}
        </span>
      </div>
      <div class="card-body">
        ${
          scope?.totalMarks && Math.abs(answerable - scope.totalMarks) > 1
            ? callout(
                'warn',
                'Marks do not add up',
                `The segmented questions give <strong>${answerable}</strong> answerable marks against the <strong>${scope.totalMarks}</strong> you declared. Fix the marks below, or re-segment.`
              )
            : callout('ok', 'Marks add up', `Answerable marks total ${answerable}. Either/or pairs are counted once, which is what the student actually faces.`)
        }
        ${(segmentation.warnings ?? []).length ? callout('warn', 'Segmentation notes', (segmentation.warnings ?? []).map((w) => esc(w)).join('<br />')) : ''}
        ${modules.length ? `<div class="chip-row">${modules.map((m) => `<span class="badge">${esc(m)}</span>`).join('')}</div>` : ''}

        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th style="width:56px">ID</th>
                <th style="width:64px">Part</th>
                <th>Question</th>
                <th class="num" style="width:74px">Marks</th>
                <th style="width:110px">Module</th>
                <th style="width:70px">CO</th>
                <th style="width:74px">Choice</th>
              </tr>
            </thead>
            <tbody>
              ${questions
                .map((q) => {
                  const mods = String(q.moduleLabel ?? '').match(/(\d+)/);
                  const moduleNumber = mods ? Number(mods[1]) : null;
                  const outOfScope = moduleNumber != null && inScope.size > 0 && !inScope.has(moduleNumber);
                  return `<tr class="${outOfScope ? 'row-out' : ''}">
                    <td class="mono">${esc(q.id)}</td>
                    <td>${esc(q.part ?? '')}</td>
                    <td>
                      ${
                        editing
                          ? `<textarea rows="${q.text.length > 200 ? 4 : 2}" data-q-text="${esc(q.id)}" spellcheck="false">${esc(q.text)}</textarea>
                             ${
                               q.subParts?.length
                                 ? `<div class="small muted" style="margin-top:4px">Sub-parts: ${q.subParts
                                     .map((s) => `${esc(s.label)}) ${esc(String(s.text ?? '').slice(0, 60))}${s.marks != null ? ` (${s.marks})` : ''}`)
                                     .join(' &middot; ')}</div>`
                                 : ''
                             }`
                          : `<div>${esc(q.text)}</div>
                             ${
                               q.subParts?.length
                                 ? `<ul class="small muted" style="margin:5px 0 0;padding-left:18px">
                                     ${q.subParts.map((s) => `<li>${esc(s.label)}) ${esc(s.text ?? '')}${s.marks != null ? ` <span class="badge badge-mono">${s.marks}</span>` : ''}</li>`).join('')}
                                   </ul>`
                                 : ''
                             }
                             ${q.hasFigure ? '<div class="small"><span class="badge badge-warn">depends on a figure</span></div>' : ''}
                             ${q.notes ? `<div class="small muted">${esc(q.notes)}</div>` : ''}`
                      }
                    </td>
                    <td class="num">
                      ${
                        editing
                          ? `<input type="number" min="0" step="1" data-q-marks="${esc(q.id)}" value="${q.marks ?? 0}" style="width:64px;text-align:right" />`
                          : `${q.marks ?? '?'}${q.marksSource && q.marksSource !== 'printed' ? `<div class="small muted">${esc(q.marksSource)}</div>` : ''}`
                      }
                    </td>
                    <td>
                      ${
                        editing
                          ? `<input type="text" data-q-module="${esc(q.id)}" value="${esc(q.moduleLabel ?? '')}" placeholder="Module 1" style="width:100px" />`
                          : q.moduleLabel
                            ? `<span class="badge ${outOfScope ? 'badge-danger' : ''}">${esc(q.moduleLabel)}</span>`
                            : '<span class="muted small">unlabelled</span>'
                      }
                    </td>
                    <td class="mono">${esc(q.printedCo ?? '')}</td>
                    <td>${q.choiceGroup ? `<span class="badge badge-info" title="Either/or group ${esc(q.choiceGroup)}">either/or</span>` : ''}</td>
                  </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card-foot">
        <span class="card-sub">${editing ? 'Editing &mdash; save to keep changes' : 'Every later finding references these IDs'}</span>
        <div class="btn-row">
          <button class="btn btn-secondary btn-sm" data-act="segment-reedit" type="button">Re-edit the paper text</button>
          ${
            editing
              ? `<button class="btn btn-primary btn-sm" data-act="segment-save-edit" type="button">Save changes</button>`
              : `<button class="btn btn-secondary btn-sm" data-act="segment-edit" type="button">Fix marks or wording</button>
                 <button class="btn btn-primary btn-sm" data-act="segment-confirm" type="button">Questions are right &mdash; run ${esc(segmentation.__mode === 'persona' ? 'Persona Prediction' : 'Question Analysis')}</button>`
          }
        </div>
      </div>
    </div>
  `;
}

/** Mirrors analysis.computeCountedMarks for display only. */
function countedShare(questions, q) {
  if (!q.choiceGroup) return q.marks ?? 0;
  const group = questions.filter((x) => x.choiceGroup === q.choiceGroup);
  if (group[0]?.id !== q.id) return 0;
  return Math.max(...group.map((g) => g.marks ?? 0));
}

/* ---------------------------------------------------------------- attachments */

export function renderAttachments(files) {
  if (!files?.length) return '';
  return files
    .map(
      (f, i) => `<span class="attachment">
        ${f.previewUrl ? `<img src="${esc(f.previewUrl)}" alt="" />` : '<span class="badge">PDF</span>'}
        <span>
          <span class="attachment-name">${esc(f.name)}</span>
          <span class="attachment-meta">${esc(f.sizeLabel)}</span>
        </span>
        <button class="btn btn-ghost btn-sm" data-act="detach" data-index="${i}" type="button" aria-label="Remove ${esc(f.name)}">&times;</button>
      </span>`
    )
    .join('');
}

export { heatCell, heatLegend };
