/**
 * Tests for public/core/json.js - recovering and validating JSON from LLM text.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { extractJson, validateSchema, describeErrors } from '../public/core/json.js';

/* ------------------------------------------------------------------ */
/* extractJson                                                          */
/* ------------------------------------------------------------------ */

test('extractJson parses bare JSON', () => {
  const result = extractJson('{"course":"UCEST105","modules":4}');
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { course: 'UCEST105', modules: 4 });
});

test('extractJson unwraps a ```json fence', () => {
  const result = extractJson('```json\n{"courseCode":"UCEST105"}\n```');
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { courseCode: 'UCEST105' });
});

test('extractJson unwraps a bare ``` fence too', () => {
  const result = extractJson('```\n[1,2,3]\n```');
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, [1, 2, 3]);
});

test('extractJson recovers JSON surrounded by prose', () => {
  const result = extractJson('Sure, here is the parsed syllabus:\n{"course":"UCEST105"}\nLet me know if you need more.');
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { course: 'UCEST105' });
});

test('extractJson fails with a useful message for a truncated object', () => {
  const result = extractJson('{"modules": [{"title": "Module 1"');
  assert.equal(result.ok, false);
  assert.match(result.error, /truncated/i);
  assert.match(result.error, /unbalanced braces/i);
});

test('extractJson fails helpfully when there is no JSON at all', () => {
  const result = extractJson('I could not read that document.');
  assert.equal(result.ok, false);
  assert.match(result.error, /No JSON object found/i);
});

test('extractJson ignores braces and quotes that live inside strings', () => {
  // The prose forces the balanced-brace scanner rather than a direct parse.
  const value = { text: 'brace { and } plus "quote" and ] bracket', ok: true };
  const result = extractJson(`Here you go: ${JSON.stringify(value)} - done.`);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, value);
});

test('extractJson repairs trailing commas', () => {
  const result = extractJson('{"a":1,"b":[1,2,],"c":{"d":3,},}');
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { a: 1, b: [1, 2], c: { d: 3 } });
});

test('extractJson reports a non-text response instead of throwing', () => {
  const result = extractJson(null);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Response was not text.');
});

test('extractJson reports a JSON-looking block that will not parse', () => {
  const result = extractJson('{"a": oops}');
  assert.equal(result.ok, false);
  assert.match(result.error, /could not be parsed/i);
});

/* ------------------------------------------------------------------ */
/* validateSchema                                                       */
/* ------------------------------------------------------------------ */

const paperSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'count'],
  properties: {
    title: { type: 'string', minLength: 1 },
    count: { type: 'number' },
    level: { type: 'string', enum: ['low', 'high'] },
    tags: { type: 'array', items: { type: 'string' } },
    grade: { type: 'string', default: 'none' },
  },
};

test('validateSchema accepts a correct object', () => {
  const res = validateSchema({ title: 'Paper A', count: 60 }, paperSchema);
  assert.equal(res.valid, true);
  assert.deepEqual(res.errors, []);
  assert.deepEqual(res.value, { title: 'Paper A', count: 60, grade: 'none' });
});

test('validateSchema reports a missing required field with its path', () => {
  const res = validateSchema({ count: 1 }, paperSchema);
  assert.equal(res.valid, false);
  assert.deepEqual(res.errors, [{ path: '$.title', message: 'is required but missing' }]);
});

test('validateSchema rejects a wrong type', () => {
  const res = validateSchema({ title: 'Paper A', count: 'not-a-number' }, paperSchema);
  assert.equal(res.valid, false);
  assert.equal(res.errors[0].path, '$.count');
  assert.equal(res.errors[0].message, 'expected number, got string');
});

test('validateSchema coerces enum strings case-insensitively', () => {
  const input = { title: 'Paper A', count: 1, level: 'HIGH' };
  const res = validateSchema(input, paperSchema);
  assert.equal(res.valid, true);
  assert.equal(res.value.level, 'high');
  // Coercion must not mutate the caller's object.
  assert.equal(input.level, 'HIGH');
});

test('validateSchema still rejects an enum value that is not in the list', () => {
  const res = validateSchema({ title: 'Paper A', count: 1, level: 'medium' }, paperSchema);
  assert.equal(res.valid, false);
  assert.equal(res.errors[0].path, '$.level');
  assert.match(res.errors[0].message, /expected one of "low" \| "high"/);
});

test('validateSchema coerces a numeric string to a number', () => {
  const res = validateSchema({ title: 'Paper A', count: '42' }, paperSchema);
  assert.equal(res.valid, true);
  assert.equal(res.value.count, 42);
  assert.equal(typeof res.value.count, 'number');
});

test('validateSchema coerces null to [] for an array field', () => {
  const res = validateSchema({ title: 'Paper A', count: 1, tags: null }, paperSchema);
  assert.equal(res.valid, true);
  assert.deepEqual(res.value.tags, []);
});

test('validateSchema drops unknown keys when additionalProperties is false', () => {
  const res = validateSchema({ title: 'Paper A', count: 1, bonus: 'drop me' }, paperSchema);
  assert.equal(res.valid, true);
  assert.equal('bonus' in res.value, false);
});

test('validateSchema keeps unknown keys when additionalProperties is not false', () => {
  const res = validateSchema({ title: 'Paper A', count: 1, bonus: 'keep me' }, {
    type: 'object',
    properties: { title: { type: 'string' }, count: { type: 'number' } },
  });
  assert.equal(res.valid, true);
  assert.equal(res.value.bonus, 'keep me');
});

test('validateSchema applies a default for an absent non-required property', () => {
  const res = validateSchema({ title: 'Paper A', count: 1 }, paperSchema);
  assert.equal(res.value.grade, 'none');
});

test('validateSchema reports a nested array item path like $.items[1].name', () => {
  const schema = {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string' } },
        },
      },
    },
  };
  const res = validateSchema({ items: [{ name: 'ok' }, { name: [] }] }, schema);
  assert.equal(res.valid, false);
  assert.equal(res.errors.length, 1);
  assert.equal(res.errors[0].path, '$.items[1].name');
  assert.equal(res.errors[0].message, 'expected string, got array');
});

test('validateSchema supports anyOf', () => {
  const schema = { anyOf: [{ type: 'number' }, { type: 'string' }] };
  const good = validateSchema('UCEST105', schema);
  assert.equal(good.valid, true);
  const bad = validateSchema(true, schema);
  assert.equal(bad.valid, false);
  assert.equal(bad.errors[0].path, '$');
  assert.equal(bad.errors[0].message, 'did not match any allowed shape (number | string)');
});

test('validateSchema enforces minItems', () => {
  const res = validateSchema([1], { type: 'array', minItems: 2, items: { type: 'number' } });
  assert.equal(res.valid, false);
  assert.equal(res.errors[0].message, 'must have at least 2 items');
});

/* ------------------------------------------------------------------ */
/* describeErrors                                                       */
/* ------------------------------------------------------------------ */

test('describeErrors truncates and formats one line per error', () => {
  const errors = Array.from({ length: 20 }, (_, i) => ({ path: `$.q${i}`, message: 'bad value' }));
  const out = describeErrors(errors, 3);
  const lines = out.split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], '- $.q0: bad value');
  assert.equal(lines[2], '- $.q2: bad value');
});

test('describeErrors defaults to at most 12 errors', () => {
  const errors = Array.from({ length: 20 }, (_, i) => ({ path: `$.q${i}`, message: 'bad value' }));
  assert.equal(describeErrors(errors).split('\n').length, 12);
});

test('describeErrors returns an empty string for no errors', () => {
  assert.equal(describeErrors([]), '');
});
