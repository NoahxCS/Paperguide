/**
 * Syllabus service: find it, fetch it, parse it, confirm it.
 *
 * Sources, tried in order and always shown to the teacher with provenance:
 *   1. the bundled 2024-scheme course index (works offline)
 *   2. live web search + KTU-affiliated mirrors, via the local server
 *   3. a URL the teacher pastes
 *   4. a PDF the teacher uploads (upload fallback)
 *
 * Whatever arrives, the parsed modules/COs are shown in a confirmation card
 * before any analysis runs. Nothing downstream uses an unconfirmed syllabus.
 */
import { callJson } from './llm.js';
import { buildSyllabusPrompt, KTU_2024_DEFAULT_PATTERN } from '../prompts/prompts.js';
import { BLOOM, BLOOM_LEVELS } from '../prompts/schemas.js';

export class SyllabusError extends Error {
  constructor(message, code, recovery) {
    super(message);
    this.name = 'SyllabusError';
    this.code = code ?? 'SYLLABUS_ERROR';
    this.recovery = recovery ?? null;
  }
}

/** "Understand" -> "K2"; "KL3" -> "K3"; "K2" -> "K2"; junk -> null. */
export function normaliseBloom(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const upper = raw.toUpperCase();
  if (BLOOM_LEVELS.includes(upper)) return upper;
  const byName = BLOOM.find((b) => b.name.toUpperCase() === upper);
  if (byName) return byName.level;
  // KL3 / K3 / L3 / Level 3 / bare 3 - KTU prints the column as
  // "Bloom's Knowledge Level (KL)", so KLn is common.
  const kMatch = /\b(?:KL|K|L)\s*[-_]?\s*([1-6])\b/i.exec(raw);
  if (kMatch) return `K${kMatch[1]}`;
  const nMatch = /^(?:LEVEL\s*)?([1-6])$/i.exec(raw);
  if (nMatch) return `K${nMatch[1]}`;
  return null;
}

export function bloomName(level) {
  const norm = normaliseBloom(level);
  return BLOOM.find((b) => b.level === norm)?.name ?? null;
}

/**
 * Deterministic paper-pattern detection from raw syllabus or paper text.
 * This is a safety net so the app still works when the syllabus PDF has no
 * pattern section, and it doubles as a cross-check on the model's reading.
 */
export function detectPatternFromText(text) {
  const t = String(text ?? '');
  const has = (re) => re.test(t);

  const maxMarks = /max(?:imum)?\.?\s*marks?\s*[:\-]?\s*(\d{2,3})/i.exec(t);
  const durationMin = /duration\s*[:\-]?\s*(\d+)\s*hours?\s*(?:and\s*)?(\d+)?\s*(?:minutes?|mins?)?/i.exec(t);
  const partAinstruction = /part\s*[-–]?\s*a\b[\s\S]{0,200}?each\s+question\s+carries\s+(\d+)\s*marks/i.exec(t);
  const partBinstruction = /part\s*[-–]?\s*b\b[\s\S]{0,300}?each\s+question\s+carries\s+(\d+)\s*marks/i.exec(t);
  const anyOneFromEachModule = /any\s+one\s+(?:full\s+)?question\s+from\s+each\s+module/i.test(t);

  const marks = maxMarks ? Number(maxMarks[1]) : null;
  let minutes = null;
  if (durationMin) {
    minutes = Number(durationMin[1]) * 60 + Number(durationMin[2] ?? 0);
  }

  // The observed KTU 2024 shape: 60 marks / 150 min / Part A 8x3 / Part B 4 modules x 9.
  if (marks === 60 || minutes === 150 || (partAinstruction && anyOneFromEachModule)) {
    const aMarks = partAinstruction ? Number(partAinstruction[1]) : 3;
    const bMarks = partBinstruction ? Number(partBinstruction[1]) : 9;
    return {
      source: 'detected-in-text',
      note: 'Detected from the text: KTU 2024-scheme theory paper shape (60 marks, 2 h 30 min, Part A 8 x 3, Part B 4 modules x 9).',
      parts: [
        {
          name: 'Part A',
          instructions: `Answer all questions. Each question carries ${aMarks} marks.`,
          questionCount: 8,
          marksPerQuestion: aMarks,
          totalMarks: 8 * aMarks,
          choice: 'none',
          coversModules: [1, 2, 3, 4],
        },
        {
          name: 'Part B',
          instructions: `Answer any one full question from each module, each question carries ${bMarks} marks.`,
          questionCount: 8,
          marksPerQuestion: bMarks,
          totalMarks: 4 * bMarks,
          choice: 'either-or',
          coversModules: [1, 2, 3, 4],
        },
      ],
    };
  }

  // Generic two-part detection.
  if (partAinstruction && partBinstruction) {
    const aMarks = Number(partAinstruction[1]);
    const bMarks = Number(partBinstruction[1]);
    return {
      source: 'detected-in-text',
      note: 'Detected from the part instructions in the text.',
      parts: [
        { name: 'Part A', instructions: `Answer all questions. Each question carries ${aMarks} marks.`, marksPerQuestion: aMarks, choice: 'none' },
        { name: 'Part B', instructions: `Answer any one full question from each module, each question carries ${bMarks} marks.`, marksPerQuestion: bMarks, choice: anyOneFromEachModule ? 'either-or' : 'unknown' },
      ],
    };
  }

  if (marks || minutes) {
    return {
      source: 'detected-in-text',
      note: `Only the header was detected (${marks ?? '?'} marks, ${minutes ?? '?'} minutes). The part structure must be stated by the teacher.`,
      parts: [],
    };
  }
  return null;
}

/** Fill gaps and normalise whatever the model produced. */
export function normaliseSyllabus(parsed) {
  const modules = (parsed.modules ?? [])
    .map((m, i) => ({
      number: Number.isFinite(m.number) ? m.number : i + 1,
      title: m.title ?? '',
      hours: Number.isFinite(m.hours) ? m.hours : null,
      topics: (m.topics ?? [])
        .map((t, j) => ({
          id: t.id ?? `${Number.isFinite(m.number) ? m.number : i + 1}.${j + 1}`,
          text: String(t.text ?? '').trim(),
        }))
        .filter((t) => t.text),
      cos: (m.cos ?? []).map((c) => String(c).toUpperCase()),
    }))
    .filter((m) => m.topics.length || m.title)
    .sort((a, b) => a.number - b.number);

  const courseOutcomes = (parsed.courseOutcomes ?? []).map((c, i) => {
    const id = String(c.id ?? `CO${i + 1}`).toUpperCase().replace(/^CO[\s-]*(\d)/, 'CO$1');
    return {
      id,
      statement: String(c.statement ?? '').trim(),
      bloom: normaliseBloom(c.bloom),
      bloomRaw: c.bloom ?? null,
      mapsTo: c.mapsTo ?? [],
    };
  });

  return {
    courseCode: parsed.courseCode ?? '',
    courseTitle: parsed.courseTitle ?? '',
    scheme: parsed.scheme ?? 'KTU 2024',
    semester: parsed.semester ?? '',
    branch: parsed.branch ?? '',
    credits: parsed.credits ?? null,
    assessment: parsed.assessment ?? null,
    modules,
    courseOutcomes,
    paperPattern: parsed.paperPattern ?? [],
    paperPatternNote: parsed.paperPatternNote ?? '',
    notFound: parsed.notFound ?? [],
    // Provenance fields added by the caller.
    sourceUrl: parsed.sourceUrl ?? null,
    sourceKind: parsed.sourceKind ?? null,
  };
}

/**
 * Decide which paper pattern to use, preferring what the teacher confirmed.
 * @returns {{pattern:object|null, reason:string}}
 */
export function resolvePattern({ syllabusPattern, teacherPattern, paperText, detectedFromPaper }) {
  if (syllabusPattern?.parts?.length) {
    return { pattern: { source: 'syllabus', note: 'Taken from the syllabus you confirmed.', parts: syllabusPattern.parts }, reason: 'syllabus' };
  }
  if (teacherPattern?.parts?.length) {
    return { pattern: { source: 'teacher', note: teacherPattern.note ?? 'As you described it.', parts: teacherPattern.parts }, reason: 'teacher' };
  }
  const detected = detectedFromPaper ?? (paperText ? detectPatternFromText(paperText) : null);
  if (detected?.parts?.length) return { pattern: detected, reason: 'detected-from-paper' };
  return { pattern: { ...KTU_2024_DEFAULT_PATTERN, source: 'ktu-2024-default' }, reason: 'ktu-default' };
}

/**
 * Build a ready-to-confirm syllabus from a bundled seed-index course.
 *
 * The seed index holds real 2024-scheme data (modules, topics and the CO table
 * with Bloom's levels) captured from real KTU syllabus documents. When the
 * teacher names one of these courses we can skip both the network and the LLM
 * entirely, which also makes the offline/demo path fully deterministic.
 */
export function syllabusFromIndexCourse(course, { origin = 'bundled-index' } = {}) {
  const credits = course.credits ?? {};
  const modules = (course.modules ?? []).map((m, i) => ({
    number: Number.isFinite(m.no) ? m.no : i + 1,
    title: m.title ?? '',
    hours: Number.isFinite(m.hours) ? m.hours : null,
    topics: (m.topics ?? []).map((t, j) => ({
      id: `${Number.isFinite(m.no) ? m.no : i + 1}.${j + 1}`,
      text: typeof t === 'string' ? t : String(t?.text ?? ''),
    })).filter((t) => t.text),
    cos: [],
  }));

  const courseOutcomes = (course.courseOutcomes ?? []).map((c, i) => ({
    id: String(c.co ?? `CO${i + 1}`).toUpperCase(),
    statement: String(c.statement ?? '').trim(),
    bloom: normaliseBloom(c.bloom),
    bloomRaw: c.bloom ?? null,
    mapsTo: [],
  }));

  const parts = (course.examPattern?.parts ?? []).map((p) => ({
    name: p.name ?? 'Part',
    instructions: p.choice ?? '',
    questionCount: p.questions ?? 0,
    marksPerQuestion: p.marksPerQuestion ?? 0,
    totalMarks: p.totalMarks ?? 0,
    choice: /all questions need to be answered/i.test(p.choice ?? '')
      ? 'none'
      : /1 (?:full )?question should be answered|one question|any one/i.test(p.choice ?? '')
        ? 'either-or'
        : 'unknown',
    coversModules: [1, 2, 3, 4],
    questionsPerModule: null,
    coverageNote: p.coverage ?? '',
    maxSubDivisions: p.maxSubDivisions ?? null,
  }));

  return {
    courseCode: course.code ?? '',
    courseTitle: course.title ?? '',
    scheme: 'KTU 2024',
    semester: course.semester != null ? String(course.semester) : '',
    branch: course.branch ?? '',
    courseType: course.courseType ?? '',
    credits: {
      l: credits.L ?? null,
      t: credits.T ?? null,
      p: credits.P ?? null,
      r: credits.R ?? null,
      credits: credits.C ?? null,
    },
    assessment: course.examPattern
      ? {
          cieMarks: course.examPattern.cieMarks ?? null,
          eseMarks: course.examPattern.maxMarks ?? null,
          eseDurationMinutes: course.examPattern.durationHours ? course.examPattern.durationHours * 60 : null,
          cieBreakdown: course.examPattern.cieBreakdown ?? null,
        }
      : null,
    modules,
    courseOutcomes,
    paperPattern: parts,
    paperPatternNote: course.examPattern
      ? `From the ESE block of this course's 2024-scheme syllabus: ${course.examPattern.maxMarks} marks, ${course.examPattern.durationHours} h.`
      : '',
    patternSource: parts.length ? 'syllabus' : null,
    notFound: parts.length ? [] : ['paper pattern'],
    sourceUrl: course.sourceUrl ?? null,
    sourceKind: 'bundled-index',
    origin,
    verified: true,
  };
}

/** Pick the right default pattern when the syllabus states none. */
export function pickDefaultPattern(syllabus, { theoryPattern, hmcPattern } = {}) {
  const type = String(syllabus?.courseType ?? '');
  // The bundled index records the course category, e.g. "... Course Category UC
  // - University Core" or "... HMC ...". Only HMC courses use the 50-mark ESE.
  const isHmc = /\bHMC\b/i.test(type);
  if (isHmc && hmcPattern) return hmcPattern;
  return theoryPattern ?? null;
}

/* ------------------------------------------------------------------ */
/* Server calls                                                         */
/* ------------------------------------------------------------------ */

async function getJson(url, signal) {
  const response = await fetch(url, { signal });
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.ok === false) {
    throw new SyllabusError(
      json?.error ?? `The lookup failed (HTTP ${response.status}).`,
      json?.code ?? 'SYLLABUS_HTTP',
      'Try again, or paste the syllabus PDF text straight into the chat.'
    );
  }
  return json;
}

export async function loadSeedIndex({ signal } = {}) {
  try {
    return await getJson('/api/syllabus/index', signal);
  } catch {
    return { scheme: 'KTU 2024', courses: [], notes: [] };
  }
}

export async function searchSyllabusCandidates(query, { remote = true, signal } = {}) {
  const params = new URLSearchParams({ q: query, remote: remote ? '1' : '0' });
  return getJson(`/api/syllabus/search?${params.toString()}`, signal);
}

export async function fetchSyllabusDocument(url, { signal } = {}) {
  const params = new URLSearchParams({ url });
  return getJson(`/api/syllabus/fetch?${params.toString()}`, signal);
}

/** Parse raw syllabus text into structured modules/COs using the LLM. */
export async function parseSyllabusText({ text, courseHint, settings, sourceUrl, sourceKind, signal, onProgress }) {
  if (!text?.trim() || text.replace(/\s/g, '').length < 120) {
    throw new SyllabusError(
      'There was not enough syllabus text to parse.',
      'SYLLABUS_TEXT_TOO_SHORT',
      'The source may be a scanned PDF or an index page rather than the syllabus itself. Upload the syllabus PDF, or paste its text.'
    );
  }

  const prompt = buildSyllabusPrompt({ text, courseHint, sourceUrl, sourceKind });
  const result = await callJson({ settings, prompt, signal, onProgress });
  const syllabus = normaliseSyllabus({ ...result.value, sourceUrl, sourceKind });

  if (!syllabus.modules.length) {
    throw new SyllabusError(
      'No modules could be found in that document.',
      'SYLLABUS_NO_MODULES',
      'The link may point at an index page or a different format. Pick another search result, paste the syllabus text, or upload the syllabus PDF.'
    );
  }

  // Cross-check the pattern with a deterministic detector.
  const detected = detectPatternFromText(text);
  if (!syllabus.paperPattern?.length && detected?.parts?.length) {
    syllabus.paperPattern = detected.parts;
    syllabus.paperPatternNote = `${detected.note} (Detected by Paperguide, not stated by the model.)`;
    syllabus.patternSource = detected.source;
  } else if (syllabus.paperPattern?.length) {
    syllabus.patternSource = 'syllabus';
  }

  return { syllabus, usage: result.usage, attempts: result.attempts, repaired: result.repaired };
}

/** Parse a paper-pattern description the teacher typed, without an LLM. */
export function describePattern(parts) {
  if (!parts?.length) return 'not stated';
  return parts
    .map((p) => {
      const bits = [p.name];
      if (p.questionCount) bits.push(`${p.questionCount} questions`);
      if (p.marksPerQuestion) bits.push(`${p.marksPerQuestion} marks each`);
      if (p.totalMarks) bits.push(`${p.totalMarks} total`);
      if (p.choice === 'either-or') bits.push('either/or choice');
      return bits.join(', ');
    })
    .join(' \u00b7 ');
}
