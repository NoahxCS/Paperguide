/**
 * Report rendering for both modes.
 *
 * Mode A: coverage heatmap, ambiguity/fairness flags with Accept/Reject/Edit,
 * alternative questions, and a summary.
 * Mode B: persona cards, per-question pitfalls for all three personas, and the
 * paper-level spread, separation and time-feasibility view.
 *
 * All Mode B output is labelled as a risk flag / relative estimate, never a
 * measured result.
 */
import { esc, heatCell, heatLegend, callout, typeLabel } from './dom.js';
import { formatMinutes, pluralise } from '../core/util.js';
import { bloomName } from '../core/syllabus.js';
import { PERSONA_CAVEAT } from '../core/personas.js';
import { HOTSPOT_THRESHOLD_PP as HOTSPOT_PP } from '../core/analysis.js';

const VERDICT_BADGE = {
  strong: 'badge-ok',
  'sound-with-fixes': 'badge-info',
  'needs-rework': 'badge-warn',
  weak: 'badge-danger',
};

function typeBadge(type) {
  const map = {
    'vague-wording': 'badge-warn',
    'multiple-interpretations': 'badge-warn',
    'missing-data': 'badge-danger',
    'missing-constraint': 'badge-warn',
    'double-barreled': 'badge-warn',
    'marks-effort-mismatch': 'badge-info',
    'out-of-scope': 'badge-danger',
    'uncovered-topic': 'badge-info',
    'bloom-mismatch': 'badge',
    'figure-dependent': 'badge-info',
    duplicate: 'badge',
    'over-weighted-topic': 'badge-info',
  };
  return `<span class="badge ${map[type] ?? ''}">${esc(typeLabel(type))}</span>`;
}

/** One flag card. Exported so a single decision can be re-rendered in place. */
export function renderFlagCard(f, i) {
  const decision = f.decision ?? 'open';
  return `<div class="flag flag-${f.severity ?? 'low'} ${decision === 'accepted' ? 'flag-accepted' : decision === 'rejected' ? 'flag-rejected' : ''}" data-flag-index="${i}">
    <div class="flag-head">
      ${f.questionId ? `<span class="flag-q">${esc(f.questionId)}</span>` : ''}
      ${f.topicId ? `<span class="badge badge-mono">topic ${esc(f.topicId)}</span>` : ''}
      ${f.module ? `<span class="badge badge-mono">Module ${esc(String(f.module))}</span>` : ''}
      ${typeBadge(f.type)}
      <span class="badge ${f.severity === 'high' ? 'badge-danger' : f.severity === 'medium' ? 'badge-warn' : ''}">${esc(f.severity ?? '')}</span>
      ${f.derived ? '<span class="badge" title="Computed by Paperguide, not the model">computed</span>' : ''}
      ${decision !== 'open' ? `<span class="badge ${decision === 'accepted' ? 'badge-ok' : ''}">${esc(decision)}</span>` : ''}
    </div>
    <p class="flag-reason">${esc(f.reason ?? '')}</p>
    ${f.evidence ? `<p class="flag-evidence">&ldquo;${esc(f.evidence)}&rdquo;</p>` : ''}
    ${
      f.rewrite
        ? `<div class="rewrite">
            <div class="rewrite-label">Suggested rewrite</div>
            <p>${esc(f.rewrite)}</p>
            ${
              f.rewriteMarks != null || f.rewriteBloom
                ? `<div class="small muted" style="margin-top:5px">${f.rewriteMarks != null ? `${f.rewriteMarks} marks` : ''}${f.rewriteBloom ? ` &middot; ${esc(f.rewriteBloom)} ${esc(bloomName(f.rewriteBloom) ?? '')}` : ''}</div>`
                : ''
            }
          </div>
          <div class="flag-actions">
            <button class="btn btn-primary btn-sm" data-act="flag-accept" data-index="${i}" type="button">Accept rewrite</button>
            <button class="btn btn-secondary btn-sm" data-act="flag-edit" data-index="${i}" type="button">Edit first</button>
            <button class="btn btn-ghost btn-sm" data-act="flag-reject" data-index="${i}" type="button">Reject</button>
          </div>`
        : `<div class="flag-actions">
            <button class="btn btn-ghost btn-sm" data-act="flag-reject" data-index="${i}" type="button">Dismiss</button>
          </div>`
    }
  </div>`;
}

/* ================================================================ MODE A */

export function renderAnalysisReport(analysis) {
  const { coverage, bloomCheck, hotspots, flags, duplicates, suggestions, summary, warnings, stats } = analysis;
  const totals = coverage.totals;
  // Coverage-gap flags are numerous by nature (one per uncovered topic), so they
  // are grouped into a disclosure to keep the report readable.
  const gapFlags = flags.filter((f) => f.type === 'uncovered-topic' && f.derived);
  const primaryFlags = flags.filter((f) => !(f.type === 'uncovered-topic' && f.derived));

  return `
    <div class="card">
      <div class="card-head">
        <h3>Question Analysis
          <span class="badge ${VERDICT_BADGE[summary?.verdict] ?? 'badge'}">${esc(String(summary?.verdict ?? 'reviewed').replace(/-/g, ' '))}</span>
        </h3>
        <span class="card-sub">${esc(analysis.model ?? '')} &middot; prompts v${esc(analysis.promptVersion ?? '')}</span>
      </div>
      <div class="card-body">
        ${summary?.headline ? `<p class="card-text" style="font-size:15.5px;font-weight:550">${esc(summary.headline)}</p>` : ''}
        <div class="field-row two">
          <div>
            <p class="section-title">Strengths</p>
            <ul class="small">${(summary?.strengths ?? []).map((s) => `<li>${esc(s)}</li>`).join('') || '<li class="muted">none noted</li>'}</ul>
          </div>
          <div>
            <p class="section-title">Risks</p>
            <ul class="small">${(summary?.risks ?? []).map((s) => `<li>${esc(s)}</li>`).join('') || '<li class="muted">none noted</li>'}</ul>
          </div>
        </div>
        ${
          summary?.actions?.length
            ? `<div><p class="section-title">What to do next</p><ol class="small" style="margin:0;padding-left:20px">${summary.actions.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>`
            : ''
        }
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>Coverage against your confirmed scope</h3>
        <span class="card-sub">${totals.answerableMarks} answerable of ${totals.printedMarks} printed marks${analysis.scope?.totalMarks ? ` &middot; you declared ${analysis.scope.totalMarks}` : ''}</span>
      </div>
      <div class="card-body">
        ${heatLegend()}
        ${
          totals.countsMismatch
            ? callout('warn', 'Marks mismatch', `The segmented paper yields ${totals.answerableMarks} answerable marks but you declared ${analysis.scope.totalMarks}. Percentages below are shares of ${totals.answerableMarks}.`)
            : ''
        }
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th style="width:70px">Module</th><th>Title</th>
                <th class="num">Printed</th><th class="num">Answerable</th><th class="num">Share</th><th class="num">Expected</th>
                <th>Topics covered</th><th>Questions</th>
              </tr>
            </thead>
            <tbody>
              ${coverage.byModule
                .map(
                  (m) => `<tr>
                    <td><strong>${m.module}</strong></td>
                    <td>${esc(m.title || '&ndash;')}</td>
                    <td class="num">${m.printedMarks}</td>
                    <td class="num">${m.answerableMarks}</td>
                    <td class="num">${heatCell(m.percent, `Module ${m.module}`)}</td>
                    <td class="num">${m.expectedPercent == null ? '&ndash;' : `${m.expectedPercent}%`}</td>
                    <td>${m.coveredTopicIds.length}/${m.topicCount}${m.delta != null && m.delta > HOTSPOT_PP ? ' <span class="badge badge-warn">over</span>' : m.delta != null && m.delta < -HOTSPOT_PP ? ' <span class="badge">under</span>' : ''}</td>
                    <td class="mono small">${m.questionIds.map((q) => esc(q)).join(' ')}</td>
                  </tr>`
                )
                .join('')}
              ${
                coverage.offScope?.answerableMarks
                  ? `<tr class="row-out">
                      <td><strong>off-scope</strong></td>
                      <td>Questions outside the modules you declared: ${esc(coverage.offScope.labels.join(', '))}</td>
                      <td class="num">${coverage.offScope.printedMarks}</td>
                      <td class="num">${coverage.offScope.answerableMarks}</td>
                      <td class="num">${heatCell(coverage.offScope.percent, 'outside the declared scope')}</td>
                      <td class="num">&ndash;</td>
                      <td>&ndash;</td>
                      <td class="mono small">${coverage.offScope.questionIds.map((q) => esc(q)).join(' ')}</td>
                    </tr>`
                  : ''
              }
            </tbody>
            <tfoot>
              <tr>
                <th colspan="3">Total answerable</th>
                <th class="num">${totals.answerableMarks}</th>
                <th class="num" colspan="4">${totals.inScopeAnswerableMarks} in scope &middot; ${totals.offScopeAnswerableMarks} off scope</th>
              </tr>
            </tfoot>
          </table>
        </div>
        ${
          coverage.offScope?.answerableMarks
            ? callout(
                'warn',
                `${coverage.offScope.percent}% of the answerable marks are outside the scope you declared`,
                `Questions ${esc(coverage.offScope.labels.join(', '))} assess module(s) ${esc(coverage.offScope.modules.join(', '))}. Either widen the scope or replace those questions. In-scope modules therefore share ${100 - coverage.offScope.percent}% of the paper between them.`
              )
            : ''
        }

        ${
          coverage.byCo.length
            ? `<div><p class="section-title">Course outcome weightage</p>
                <div class="table-wrap"><table class="data">
                  <thead><tr><th style="width:70px">CO</th><th>Statement</th><th style="width:90px">Bloom's</th><th class="num">Answerable</th><th class="num">Share</th><th>Questions</th></tr></thead>
                  <tbody>
                    ${coverage.byCo
                      .map(
                        (c) => `<tr>
                          <td class="mono">${esc(c.co)}</td>
                          <td class="small">${esc(c.statement)}</td>
                          <td>${c.bloom ? `<span class="badge badge-info">${esc(c.bloom)}</span>` : '<span class="badge badge-warn">?</span>'}</td>
                          <td class="num">${c.answerableMarks}</td>
                          <td class="num">${heatCell(c.percent, c.co)}</td>
                          <td class="mono small">${c.questionIds.map((q) => esc(q)).join(' ')}</td>
                        </tr>`
                      )
                      .join('')}
                  </tbody>
                </table></div>
                ${
                  coverage.uncoveredCos.length
                    ? `<p class="field-hint">&nbsp;<strong>Not assessed at all:</strong> ${coverage.uncoveredCos.map((c) => `${esc(c.co)}`).join(', ')}</p>`
                    : ''
                }
              </div>`
            : ''
        }

        <div class="field-row two">
          <div>
            <p class="section-title">In-scope topics with zero marks (${coverage.uncoveredTopics.length})</p>
            ${
              coverage.uncoveredTopics.length
                ? `<ul class="small" style="margin:0;padding-left:18px">${coverage.uncoveredTopics
                    .map((t) => `<li><strong>Module ${t.module}</strong> &middot; ${esc(t.topic.length > 160 ? `${t.topic.slice(0, 160)}…` : t.topic)}</li>`)
                    .join('')}</ul>`
                : '<p class="small muted">Every in-scope topic earns marks.</p>'
            }
          </div>
          <div>
            <p class="section-title">Questions outside the declared scope (${coverage.outOfScopeQuestions.length})</p>
            ${
              coverage.outOfScopeQuestions.length
                ? `<ul class="small" style="margin:0;padding-left:18px">${coverage.outOfScopeQuestions
                    .map((q) => `<li><span class="flag-q">${esc(q.label ?? q.id)}</span> ${esc(q.why)} <span class="badge badge-mono">${q.marks} marks</span></li>`)
                    .join('')}</ul>`
                : '<p class="small muted">No question falls outside the scope.</p>'
            }
          </div>
        </div>

        ${
          hotspots.length
            ? `<div><p class="section-title">Marks hotspots</p>
                <ul class="small" style="margin:0;padding-left:18px">
                  ${hotspots
                    .map(
                      (h) =>
                        `<li>Module ${h.module} carries <strong>${h.observedPercent}%</strong> against an expected ${h.expectedPercent}% (${h.direction === 'over' ? 'over' : 'under'}-weighted by ${Math.abs(h.delta)} points).</li>`
                    )
                    .join('')}
                </ul>
              </div>`
            : ''
        }
      </div>
    </div>

    ${
      bloomCheck.rows.length
        ? `<div class="card">
            <div class="card-head">
              <h3>Bloom's check</h3>
              <span class="card-sub">${bloomCheck.mismatches.length} mismatch(es), ${bloomCheck.unknown.length} unknown</span>
            </div>
            <div class="card-body">
              <p class="field-hint" style="margin-bottom:9px">Compares the level each question <em>demands</em> with the level of the course outcome it is mapped to. Being above the CO is not automatically wrong &mdash; it just means the paper asks for more than the outcome promises.</p>
              <div class="table-wrap scroll-y"><table class="data">
                <thead><tr><th style="width:70px">Q</th><th style="width:80px">Assessed</th><th style="width:70px">CO</th><th style="width:80px">CO level</th><th>Verdict</th></tr></thead>
                <tbody>
                  ${bloomCheck.rows
                    .filter((r) => r.status !== 'match')
                    .concat(bloomCheck.rows.filter((r) => r.status === 'match').slice(0, 3))
                    .map(
                      (r) => `<tr>
                        <td class="mono">${esc(r.label ?? r.questionId)}</td>
                        <td>${r.assessed ? `<span class="badge badge-info">${esc(r.assessed)}</span>` : '<span class="badge badge-warn">?</span>'}</td>
                        <td class="mono">${esc(r.co ?? '')}</td>
                        <td>${r.coBloom ? `<span class="badge">${esc(r.coBloom)}</span>` : '&ndash;'}</td>
                        <td class="small">${
                          r.status === 'match'
                            ? '<span class="badge badge-ok">match</span>'
                            : r.status === 'above'
                              ? `<span class="badge badge-warn">above by ${r.delta}</span>`
                              : r.status === 'below'
                                ? `<span class="badge badge-info">below by ${Math.abs(r.delta)}</span>`
                                : '<span class="muted">not enough information</span>'
                        }</td>
                      </tr>`
                    )
                    .join('')}
                </tbody>
              </table></div>
            </div>
          </div>`
        : ''
    }

    ${
      duplicates.length
        ? `<div class="card">
            <div class="card-head"><h3>Near-duplicate questions</h3><span class="card-sub">${duplicates.length} pair(s)</span></div>
            <div class="card-body">
              ${duplicates
                .map(
                  (d) => `<div class="flag flag-${d.severity === 'high' ? 'high' : d.severity === 'medium' ? 'medium' : 'low'}">
                    <div class="flag-head">${(d.questionIds ?? []).map((id) => `<span class="flag-q">${esc(id)}</span>`).join('<span class="muted">&harr;</span>')}<span class="badge">${esc(d.severity ?? '')}</span></div>
                    <p class="flag-reason">${esc(d.reason ?? 'These two test the same thing closely enough to double-count.')}</p>
                  </div>`
                )
                .join('')}
            </div>
          </div>`
        : ''
    }

    <div class="card">
      <div class="card-head">
        <h3>Ambiguity and fairness flags
          <span class="badge badge-danger">${primaryFlags.filter((f) => !f.decision && f.severity === 'high').length} high</span>
          <span class="badge badge-warn">${primaryFlags.filter((f) => !f.decision && f.severity === 'medium').length} medium</span>
        </h3>
        <span class="card-sub">Every flag has a reason and a drop-in rewrite</span>
      </div>
      <div class="card-body">
        ${
          primaryFlags.length
            ? primaryFlags
                .map((f) => renderFlagCard(f, flags.indexOf(f)))
                .join('')
            : callout('ok', 'No ambiguity or fairness flags', 'The linter found nothing worth rewording in this paper.')
        }

        ${
          gapFlags.length
            ? `<details class="disclosure">
                <summary>${gapFlags.length} coverage-gap flags (topics in scope with zero marks)</summary>
                ${gapFlags
                  .slice(0, 40)
                  .map((f) => renderFlagCard(f, flags.indexOf(f)))
                  .join('')}
                ${gapFlags.length > 40 ? `<p class="small muted">and ${gapFlags.length - 40} more, listed in the coverage table above.</p>` : ''}
              </details>`
            : ''
        }
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>Alternative questions</h3>
        <span class="card-sub">${suggestions.length} proposed</span>
      </div>
      <div class="card-body">
        ${
          suggestions.length
            ? suggestions
                .map(
                  (s, i) => `<div class="flag">
                    <div class="flag-head">
                      ${s.replacesQuestionId ? `<span class="flag-q">replaces ${esc(s.replacesQuestionId)}</span>` : ''}
                      ${s.coversTopicId ? `<span class="badge badge-info">covers topic ${esc(s.coversTopicId)}</span>` : ''}
                      ${s.module ? `<span class="badge badge-mono">Module ${esc(String(s.module))}</span>` : ''}
                      ${s.co ? `<span class="badge badge-mono">${esc(s.co)}</span>` : ''}
                      ${s.bloom ? `<span class="badge badge-info">${esc(s.bloom)} ${esc(bloomName(s.bloom) ?? '')}</span>` : ''}
                      <span class="badge badge-mono">${s.marks} marks</span>
                    </div>
                    <p class="flag-reason">${esc(s.text)}</p>
                    ${s.rationale ? `<p class="flag-evidence">${esc(s.rationale)}</p>` : ''}
                    <div class="flag-actions">
                      ${
                        s.replacesQuestionId
                          ? `<button class="btn btn-primary btn-sm" data-act="suggestion-accept" data-index="${i}" type="button">Use as replacement</button>`
                          : `<button class="btn btn-secondary btn-sm" data-act="suggestion-copy" data-index="${i}" type="button">Copy</button>`
                      }
                    </div>
                  </div>`
                )
                .join('')
            : '<p class="small muted">No alternatives were requested. Accept a flag or ask for a question on a specific topic and one will be drafted.</p>'
        }
      </div>
      <div class="card-foot">
        <span class="card-sub">${stats?.llmCalls ?? 0} model call(s) &middot; ${stats?.repairs ? `${stats.repairs} repaired` : 'no retries needed'}</span>
      </div>
    </div>

    ${
      warnings?.length
        ? `<div class="card"><div class="card-body">${callout('warn', 'Run notes', warnings.map((w) => esc(w)).join('<br />'))}</div></div>`
        : ''
    }
  `;
}

/* ================================================================ MODE B */

function bandChip(persona, low, high) {
  if (low == null || high == null) return '<span class="muted small">no prediction</span>';
  return `<span class="band band-${persona}">${low}&ndash;${high}%</span>`;
}

export function renderPersonaCards(personas) {
  return `<div class="persona-grid">
    ${personas
      .map(
        (p) => `<div class="persona-card" style="--persona-accent:${p.accent}">
          <h4>${esc(p.name)} student</h4>
          <p class="persona-tagline">${esc(p.tagline)}</p>
          <div class="persona-traits">
            <div class="persona-trait"><strong>Study habits</strong><span>${esc(p.studyHabits)}</span></div>
            <div class="persona-trait"><strong>Typical strengths</strong><span>${esc(p.strengths)}</span></div>
            <div class="persona-trait"><strong>Typical errors</strong><span>${esc(p.errorTypes)}</span></div>
            <div class="persona-trait"><strong>Time management</strong><span>${esc(p.timeManagement)}</span></div>
            <div class="persona-trait"><strong>Reading care</strong><span>${esc(p.readingCarefulness)}</span></div>
          </div>
        </div>`
      )
      .join('')}
  </div>`;
}

export function renderPersonaReport(report) {
  const { byPersona, timeFeasibility, separation, perQuestion, overallSpread, rewritePriority, summary, warnings, stats } = report;
  const duration = timeFeasibility?.durationMinutes;

  const verdictBadge =
    timeFeasibility?.verdict === 'comfortable' ? 'badge-ok' : timeFeasibility?.verdict === 'tight' ? 'badge-warn' : timeFeasibility?.verdict === 'infeasible' ? 'badge-danger' : 'badge';

  return `
    <div class="card">
      <div class="card-head">
        <h3>Student Persona Prediction
          <span class="badge badge-info">relative difficulty, not measured results</span>
        </h3>
        <span class="card-sub">${esc(report.model ?? '')} &middot; prompts v${esc(report.promptVersion ?? '')}</span>
      </div>
      <div class="card-body">
        ${callout('info', 'What this is', PERSONA_CAVEAT)}
        ${report.classNote ? callout('ok', 'Your class note was applied', esc(report.classNote)) : ''}
        <p class="section-title">The three personas</p>
        ${renderPersonaCards(report.personas)}
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>Paper-level prediction</h3>
        <span class="card-sub">of ${report.examMax} marks</span>
      </div>
      <div class="card-body">
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Persona</th><th class="num">Expected marks</th><th class="num">Expected %</th><th>Spread</th><th class="num">Time needed</th><th>Time verdict</th></tr></thead>
          <tbody>
            ${byPersona
              .map((p) => {
                const tv = timeFeasibility?.perPersona?.find((x) => x.persona === p.persona)?.verdict ?? 'unknown';
                return `<tr>
                  <td><strong>${esc(p.name)}</strong></td>
                  <td class="num">${p.expectedMarks ?? '&ndash;'}</td>
                  <td class="num">${heatCell(p.expectedPercent, p.name)}</td>
                  <td class="small muted">${p.definitionBand ? `persona band ${p.definitionBand[0]}&ndash;${p.definitionBand[1]}%` : ''}</td>
                  <td class="num">${p.timeMinutes == null ? '&ndash;' : formatMinutes(p.timeMinutes)}</td>
                  <td><span class="badge ${tv === 'comfortable' ? 'badge-ok' : tv === 'tight' ? 'badge-warn' : tv === 'infeasible' ? 'badge-danger' : ''}">${esc(tv)}</span></td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table></div>
        ${heatLegend()}

        <div class="field-row two">
          <div>
            <p class="section-title">Time feasibility</p>
            <p class="small">
              Exam duration is <strong>${duration ? esc(formatMinutes(duration)) : 'not stated'}</strong>.
              Verdict: <span class="badge ${verdictBadge}">${esc(timeFeasibility?.verdict ?? 'unknown')}</span>
              ${timeFeasibility?.margin != null ? `<span class="muted"> (tightest persona finishes ${timeFeasibility.margin >= 0 ? `${esc(formatMinutes(timeFeasibility.margin))} spare` : `${esc(formatMinutes(Math.abs(timeFeasibility.margin)))} over`})</span>` : ''}
            </p>
            ${timeFeasibility?.note ? `<p class="small muted">${esc(timeFeasibility.note)}</p>` : ''}
            <p class="field-hint">${esc(timeFeasibility?.basis ?? '')}</p>
          </div>
          <div>
            <p class="section-title">Separation quality</p>
            <p class="small">${separation?.highCount ?? 0} question(s) separate the personas well; ${separation?.lowCount ?? 0} do not separate them at all.</p>
            ${
              separation?.nonSeparators?.length
                ? `<ul class="small" style="margin:6px 0 0;padding-left:18px">${separation.nonSeparators
                    .slice(0, 6)
                    .map((s) => `<li><span class="flag-q">${esc(s.label ?? s.questionId)}</span> ${esc(s.why)}</li>`)
                    .join('')}</ul>`
                : ''
            }
          </div>
        </div>

        ${
          overallSpread?.length
            ? `<div><p class="section-title">Expected overall spread</p>
                <ul class="small" style="margin:0;padding-left:18px">
                  ${overallSpread
                    .map(
                      (s) =>
                        `<li><strong>${esc(s.persona)}</strong>: ${s.expectedPercentLow != null ? `${s.expectedPercentLow}&ndash;${s.expectedPercentHigh}%` : '&ndash;'} ${s.rationale ? `&mdash; ${esc(s.rationale)}` : ''}</li>`
                    )
                    .join('')}
                </ul></div>`
            : ''
        }

        ${
          rewritePriority?.length
            ? `<div><p class="section-title">Most worth rewording</p>
                <div class="table-wrap"><table class="data">
                  <thead><tr><th style="width:70px">Q</th><th style="width:80px">Priority</th><th>Why</th><th>Suggested change</th></tr></thead>
                  <tbody>
                    ${rewritePriority
                      .map(
                        (r) => `<tr>
                          <td class="mono">${esc(r.label ?? r.questionId)}</td>
                          <td><span class="badge ${r.priority === 'high' ? 'badge-danger' : r.priority === 'medium' ? 'badge-warn' : ''}">${esc(r.priority ?? '')}</span></td>
                          <td class="small">${esc(r.why)}</td>
                          <td class="small">${esc(r.suggestedChange ?? '')}</td>
                        </tr>`
                      )
                      .join('')}
                  </tbody>
                </table></div></div>`
            : ''
        }

        ${summary ? `<p class="card-text">${esc(summary)}</p>` : ''}
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>Per-question experience</h3>
        <span class="card-sub">${perQuestion.length} questions &times; 3 personas</span>
      </div>
      <div class="card-body">
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th style="width:60px">Q</th>
                <th class="num" style="width:52px">Marks</th>
                <th style="width:110px">Weak</th>
                <th style="width:110px">Average</th>
                <th style="width:110px">Strong</th>
                <th style="width:104px">Separation</th>
                <th class="num" style="width:120px">Time (w/a/s)</th>
              </tr>
            </thead>
            <tbody>
              ${perQuestion
                .map((q) => {
                  const w = q.personas.weak;
                  const a = q.personas.average;
                  const s = q.personas.strong;
                  return `<tr>
                    <td class="mono">${esc(q.label ?? q.questionId)}</td>
                    <td class="num">${q.marks}</td>
                    <td>${bandChip('weak', w.bandLowPercent, w.bandHighPercent)}</td>
                    <td>${bandChip('average', a.bandLowPercent, a.bandHighPercent)}</td>
                    <td>${bandChip('strong', s.bandLowPercent, s.bandHighPercent)}</td>
                    <td><span class="badge ${q.separation.band === 'high' ? 'badge-ok' : q.separation.band === 'low' ? 'badge-warn' : ''}">${esc(q.separation.band)}</span></td>
                    <td class="num small">${[w.timeMinutes, a.timeMinutes, s.timeMinutes].map((t) => (t == null ? '&ndash;' : `${t}m`)).join(' / ')}</td>
                  </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>

        <details class="disclosure">
          <summary>Show the pitfall and trigger for every question and persona</summary>
          ${perQuestion
            .map(
              (q) => `<div class="flag" style="margin-top:9px">
                <div class="flag-head">
                  <span class="flag-q">${esc(q.label ?? q.questionId)}</span>
                  <span class="badge badge-mono">${q.marks} marks</span>
                  ${q.module ? `<span class="badge">${esc(q.module)}</span>` : ''}
                  ${q.choiceGroup ? `<span class="badge badge-info" title="Either/or group">either/or</span>` : ''}
                  ${q.source === 'missing' ? '<span class="badge badge-warn">no prediction</span>' : ''}
                </div>
                <div class="table-wrap"><table class="data">
                  <thead><tr><th style="width:80px">Persona</th><th class="num" style="width:80px">Band</th><th>Most likely pitfall</th><th style="width:22%">Trigger in the question</th><th class="num" style="width:64px">Time</th><th style="width:64px">Attempts</th></tr></thead>
                  <tbody>
                    ${['weak', 'average', 'strong']
                      .map((pid) => {
                        const p = q.personas[pid];
                        return `<tr>
                          <td><span class="band band-${pid}">${esc(pid)}</span></td>
                          <td class="num">${p.bandLowPercent == null ? '&ndash;' : `${p.bandLowPercent}&ndash;${p.bandHighPercent}%`}<div class="small muted">${p.confidence ? esc(p.confidence) : ''}</div></td>
                          <td class="small">${esc(p.pitfall ?? 'no prediction')}</td>
                          <td class="small">${esc(p.trigger ?? '')}${p.triggerQuote ? `<div class="flag-evidence" style="margin-top:4px">&ldquo;${esc(p.triggerQuote)}&rdquo;</div>` : ''}</td>
                          <td class="num small">${p.timeMinutes == null ? '&ndash;' : `${p.timeMinutes}m`}</td>
                          <td class="small">${p.attemptsIt ? 'yes' : '<span class="badge badge-warn">skips</span>'}</td>
                        </tr>`;
                      })
                      .join('')}
                  </tbody>
                </table></div>
              </div>`
            )
            .join('')}
        </details>
      </div>
      <div class="card-foot">
        <span class="card-sub">${stats?.llmCalls ?? 0} model call(s) &middot; ${stats?.repairs ? `${stats.repairs} repaired` : 'no retries needed'}</span>
      </div>
    </div>

    ${
      warnings?.length
        ? `<div class="card"><div class="card-body">${callout('warn', 'Run notes', warnings.map((w) => esc(w)).join('<br />'))}</div></div>`
        : ''
    }
  `;
}

export { bandChip };
