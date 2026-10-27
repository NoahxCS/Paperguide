/**
 * Typed application errors with a recovery path.
 *
 * Every user-facing failure in Paperguide carries a `recovery` string: the next
 * concrete thing the teacher can do. The UI always renders it, so an error is
 * never a dead end.
 */

export class AppError extends Error {
  constructor(message, { code = 'APP_ERROR', recovery = null, cause = null, details = null } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.recovery = recovery;
    this.cause = cause;
    this.details = details;
  }
}

/** Normalise anything thrown into an AppError. */
export function toAppError(err) {
  if (err instanceof AppError) return err;
  const code = err?.code ?? 'APP_ERROR';
  const recovery =
    err?.recovery ??
    ({
      NO_MODEL: 'Open Settings and set the model name.',
      NO_BASE_URL: 'Open Settings and set the base URL of your OpenAI-compatible endpoint.',
      LLM_AUTH: 'Check the API key in Settings. It is held in this tab only, so a refresh clears it.',
      LLM_NOT_FOUND: 'Check the base URL (it usually ends in /v1) and that the model name exists at that endpoint.',
      LLM_RATE_LIMIT: 'Wait a moment and retry, or pick a different model in Settings.',
      LLM_TIMEOUT: 'Retry, or choose a faster model. Large papers are analysed in batches, so partial progress is kept.',
      LLM_UNREACHABLE: 'Set Request routing to "Local proxy" in Settings, which avoids browser CORS restrictions.',
      LLM_MALFORMED_JSON: 'Retry, or switch to a larger / more capable model in Settings.',
      LLM_CONTEXT: 'Use a model with a larger context window.',
      OCR_NO_KEY: 'Add an OCR.space key in Settings, or paste the paper text into the chat instead.',
      OCR_BAD_KEY: 'Add a valid OCR.space key in Settings. The free key from ocr.space/ocrapi/freekey works.',
      OCR_RATE_LIMIT: 'Wait for the daily quota to reset, use a PRO key, or paste the paper text instead.',
      OCR_PROXY_DOWN: 'Restart the Paperguide server (npm start) and retry.',
      SYLLABUS_NO_MODULES: 'Upload the syllabus PDF, paste its text, or choose a different search result.',
      SYLLABUS_TEXT_TOO_SHORT: 'Upload the syllabus PDF, or paste its text directly.',
      DEMO_MISSING: 'Turn demo mode off and run the live pipeline instead.',
    }[code] ??
    'Check Settings, then retry. Everything already confirmed in this session is kept.');

  return new AppError(err?.message ?? String(err), { code, recovery, cause: err, details: err?.details ?? null });
}

/** Render an AppError as a chat callout with its recovery path. */
export function errorCalloutHtml(error, actionsHtml = '') {
  const e = toAppError(error);
  return `<div class="callout callout-error">
    <span class="callout-icon" aria-hidden="true">!</span>
    <div class="callout-body">
      <strong>${e.code.replace(/_/g, ' ').toLowerCase()}</strong>
      <p>${e.message}</p>
      ${e.recovery ? `<p style="margin-top:6px"><strong>What to do:</strong> ${e.recovery}</p>` : ''}
      ${actionsHtml ? `<div class="btn-row" style="margin-top:9px">${actionsHtml}</div>` : ''}
    </div>
  </div>`;
}
