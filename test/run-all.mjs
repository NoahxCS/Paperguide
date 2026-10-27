/**
 * Aggregate test entry point.
 *
 * `node --test test/` runs each file in its own child process, which needs
 * piped stdio. That is blocked in some sandboxes (EPERM on spawn), so this file
 * imports every suite into one process instead. It produces a single summary
 * and works identically on a normal machine.
 *
 *   npm test          -> node test/run-all.mjs
 *   npm run test:node -> node --test test/   (per-file processes)
 */
import './json.test.mjs';
import './html-text.test.mjs';
import './syllabus-search.test.mjs';
import './syllabus.test.mjs';
import './pdf-text.test.mjs';
import './analysis.test.mjs';
import './persona.test.mjs';
import './server-api.test.mjs';
