/**
 * Strict-ish JSON handling for LLM output.
 *
 * We assume plain chat completions: no native JSON mode, no tool calling. So we
 * ask for JSON in the prompt, then (a) recover the JSON object from whatever
 * prose or code fences came back, (b) validate it against an explicit schema,
 * and (c) if it is malformed, retry once with the errors fed back.
 *
 * Deliberately small: only the keywords the prompts actually use.
 */

/** Extract the first balanced JSON value from text that may contain prose. */
export function extractJson(text) {
  if (typeof text !== 'string') return { ok: false, error: 'Response was not text.' };
  let s = text.trim();

  // Strip a fenced block if present (```json ... ``` or ``` ... ```).
  const fence = /```(?:json|JSON)?\s*([\s\S]*?)```/.exec(s);
  if (fence) {
    const inner = fence[1].trim();
    if (inner) s = inner;
  }

  const tryParse = (candidate) => {
    try {
      return { ok: true, value: JSON.parse(candidate) };
    } catch {
      return null;
    }
  };

  const direct = tryParse(s);
  if (direct) return direct;

  // Scan for a balanced {...} or [...] region, ignoring braces inside strings.
  const start = s.search(/[[{]/);
  if (start === -1) {
    return { ok: false, error: 'No JSON object found in the response.' };
  }
  const open = s[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        const slice = s.slice(start, i + 1);
        const parsed = tryParse(slice);
        if (parsed) return parsed;
        // Trailing-comma repair, a very common LLM slip.
        const repaired = tryParse(slice.replace(/,\s*([}\]])/g, '$1'));
        if (repaired) return repaired;
        return { ok: false, error: 'Found a JSON-looking block that could not be parsed.' };
      }
    }
  }
  return { ok: false, error: 'The JSON in the response was truncated (unbalanced braces).' };
}

const TYPES = {
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && Number.isFinite(v),
  integer: (v) => typeof v === 'number' && Number.isInteger(v),
  boolean: (v) => typeof v === 'boolean',
  object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  array: (v) => Array.isArray(v),
  null: (v) => v === null,
};

function typeName(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

/**
 * Validate a value against a schema subset.
 * @returns {{valid:boolean, errors:{path:string,message:string}[], value:any}}
 */
export function validateSchema(value, schema, path = '$', errors = [], opts = {}) {
  const { coerce = true, dropUnknown = true } = opts;
  const fail = (message) => errors.push({ path, message });

  if (!schema || typeof schema !== 'object') return { valid: errors.length === 0, errors, value };

  if (schema.const !== undefined && value !== schema.const) {
    fail(`expected ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
    return { valid: false, errors, value };
  }

  if (Array.isArray(schema.enum)) {
    const hit = schema.enum.some((e) => e === value);
    if (!hit && coerce && typeof value === 'string') {
      const ci = schema.enum.find((e) => typeof e === 'string' && e.toLowerCase() === value.toLowerCase());
      if (ci !== undefined) value = ci;
      else fail(`expected one of ${schema.enum.map((e) => JSON.stringify(e)).join(' | ')}, got ${JSON.stringify(value)}`);
    } else if (!hit) {
      fail(`expected one of ${schema.enum.map((e) => JSON.stringify(e)).join(' | ')}, got ${JSON.stringify(value)}`);
    }
    if (errors.length) return { valid: false, errors, value };
  }

  if (Array.isArray(schema.anyOf)) {
    const attempts = schema.anyOf.map((sub) => validateSchema(value, sub, path, [], opts));
    if (!attempts.some((a) => a.valid)) {
      fail(`did not match any allowed shape (${schema.anyOf.map((s) => s.type ?? 'any').join(' | ')})`);
      return { valid: false, errors, value };
    }
    return { valid: true, errors, value };
  }

  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    let matched = allowed.some((t) => TYPES[t]?.(value));
    // Light coercion for the two mistakes models make constantly.
    if (!matched && coerce) {
      if (allowed.includes('number') && typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
        value = Number(value);
        matched = true;
      } else if (allowed.includes('integer') && typeof value === 'string' && Number.isInteger(Number(value))) {
        value = Number(value);
        matched = true;
      } else if (allowed.includes('boolean') && typeof value === 'string' && /^(true|false)$/i.test(value.trim())) {
        value = /^true$/i.test(value.trim());
        matched = true;
      } else if (allowed.includes('array') && value === null) {
        value = [];
        matched = true;
      } else if (allowed.includes('string') && typeof value === 'number') {
        value = String(value);
        matched = true;
      }
    }
    if (!matched) {
      fail(`expected ${allowed.join(' | ')}, got ${typeName(value)}`);
      return { valid: false, errors, value };
    }
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) fail(`must be >= ${schema.minimum}`);
    if (typeof schema.maximum === 'number' && value > schema.maximum) fail(`must be <= ${schema.maximum}`);
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.trim().length < schema.minLength) {
      fail(`must be at least ${schema.minLength} characters`);
    }
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
      value = value.slice(0, schema.maxLength);
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) fail(`must have at least ${schema.minItems} items`);
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) value = value.slice(0, schema.maxItems);
    if (schema.items) {
      const out = [];
      value.forEach((item, i) => {
        const r = validateSchema(item, schema.items, `${path}[${i}]`, errors, opts);
        out.push(r.value);
      });
      value = out;
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const props = schema.properties ?? {};
    const out = {};
    for (const [key, sub] of Object.entries(props)) {
      if (Object.prototype.hasOwnProperty.call(value, key) && value[key] !== undefined) {
        const r = validateSchema(value[key], sub, `${path}.${key}`, errors, opts);
        out[key] = r.value;
      } else if (sub && Object.prototype.hasOwnProperty.call(sub, 'default')) {
        out[key] = sub.default;
      } else if (Array.isArray(schema.required) && schema.required.includes(key)) {
        errors.push({ path: `${path}.${key}`, message: 'is required but missing' });
      }
    }
    const extra = Object.keys(value).filter((k) => !(k in props));
    if (extra.length && schema.additionalProperties === false && dropUnknown) {
      // Silently dropped: extra keys are noise, not a reason to retry.
    } else {
      for (const k of extra) out[k] = value[k];
    }
    value = out;
  }

  return { valid: errors.length === 0, errors, value };
}

/** One-line summary of validation errors for the repair prompt. */
export function describeErrors(errors, max = 12) {
  return errors
    .slice(0, max)
    .map((e) => `- ${e.path}: ${e.message}`)
    .join('\n');
}
