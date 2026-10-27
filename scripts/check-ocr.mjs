/**
 * Verify the OCR path end to end against the live OCR.space service, through
 * Paperguide's own proxy, using a synthetic "photographed" paper.
 *
 * Uses OCR.space's public test key (helloworld), which is heavily rate-limited,
 * so a rate-limit reply is reported as such rather than treated as a code bug.
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.PG_BASE ?? 'http://127.0.0.1:8791';
const imagePath = process.argv[2] ?? '.ocrcheck/paper.jpg';
const bytes = fs.readFileSync(imagePath);

console.log(`POST ${BASE}/api/ocr  (${(bytes.length / 1024).toFixed(0)} KB, ${path.basename(imagePath)})`);

const form = new FormData();
form.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'paper.jpg');
form.append('apikey', 'helloworld');
form.append('language', 'eng');
form.append('OCREngine', '2');
form.append('isTable', 'true');
form.append('scale', 'true');
form.append('detectOrientation', 'true');

const started = Date.now();
const response = await fetch(`${BASE}/api/ocr`, { method: 'POST', body: form });
const json = await response.json();
const ms = Date.now() - started;

const text = (json.ParsedResults ?? []).map((r) => r.ParsedText ?? '').join('\n').replace(/\r\n?/g, '\n');
console.log(`HTTP ${response.status} in ${ms} ms  OCRExitCode=${json.OCRExitCode}  errored=${json.IsErroredOnProcessing}`);
if (json.ErrorMessage) console.log('ErrorMessage:', JSON.stringify(json.ErrorMessage));
if (json.ErrorDetails) console.log('ErrorDetails:', JSON.stringify(json.ErrorDetails).slice(0, 300));

const needles = ['ALGORITHMIC THINKING', 'UCEST105', 'PART A', 'PART B', 'trial and error', 'Sudoku', 'Max. Marks: 60'];
const found = needles.filter((n) => text.toUpperCase().includes(n.toUpperCase()));
console.log(`\n--- recognised ${found.length}/${needles.length} probe phrases ---`);
for (const n of needles) console.log(`  ${found.includes(n) ? 'OK  ' : 'MISS'} ${n}`);
console.log(`\n--- text sample (first 700 chars) ---\n${text.slice(0, 700)}`);

const rateLimited = /rate|limit|quota|exceeded/i.test(JSON.stringify(json.ErrorMessage ?? '') + JSON.stringify(json.ErrorDetails ?? ''));
if (found.length >= 4) {
  console.log(`\nRESULT: PASS - the proxy, multipart upload and OCR response parsing all work (${found.length}/${needles.length} phrases read).`);
} else if (rateLimited) {
  console.log('\nRESULT: INCONCLUSIVE - the public test key is rate-limited right now; the proxy and parsing still round-tripped.');
} else {
  console.log('\nRESULT: FAIL - the OCR round trip did not return usable text.');
  process.exitCode = 1;
}
