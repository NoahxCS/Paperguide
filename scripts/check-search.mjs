/**
 * Check the syllabus search end to end.
 *
 * Reports which search engines actually answered, which matters because
 * DuckDuckGo's HTML endpoint serves an anti-bot challenge (HTTP 202, no result
 * markup) to requests from datacentre IPs, so it works from a laptop but not
 * from a hosted deployment. Bing is the primary engine for that reason.
 *
 * Run: node scripts/check-search.mjs "UCEST105" [--local]
 *      --local  queries the running server instead of the module directly
 */
import { searchSyllabus, loadSeedIndex, parseBing, decodeBingHref, tokenize, extractCodes } from '../server/syllabus-search.mjs';

const args = process.argv.slice(2);
const local = args.includes('--local');
const queries = args.filter((a) => !a.startsWith('--'));
if (!queries.length) queries.push('UCEST105', 'Data Structures and Algorithms KTU', 'Solid State Devices KTU 2024');

for (const query of queries) {
  console.log(`\n${'='.repeat(72)}\nQuery: ${query}`);
  const started = Date.now();

  let result;
  if (local) {
    const base = process.env.PG_BASE ?? 'http://127.0.0.1:8791';
    const response = await fetch(`${base}/api/syllabus/search?q=${encodeURIComponent(query)}`);
    result = await response.json();
  } else {
    const index = await loadSeedIndex('data');
    result = await searchSyllabus({ query, index, remote: true, limit: 8 });
  }

  console.log(`  tokens        : ${(result.tokens ?? tokenize(query)).join(', ')}`);
  console.log(`  codes         : ${(result.codes ?? extractCodes(query)).join(', ') || '(none)'}`);
  console.log(`  sources tried : ${(result.sourcesTried ?? []).join(', ')}`);
  console.log(`  ${(result.candidates ?? []).length} candidate(s) in ${Date.now() - started} ms`);
  for (const c of (result.candidates ?? []).slice(0, 6)) {
    console.log(`    [${String(c.provenance).padEnd(14)} ${String(Math.round((c.score ?? 0) * 100)).padStart(3)}%] ${String(c.title).slice(0, 62)}`);
    console.log(`      ${String(c.url).slice(0, 96)}`);
  }
  for (const w of result.warnings ?? []) console.log(`  ! ${w}`);

  const webHits = (result.candidates ?? []).filter((c) => c.provenance === 'web-search');
  console.log(`  => web-search hits: ${webHits.length}`);
}

// Direct engine probe, independent of the ranking logic.
console.log(`\n${'='.repeat(72)}\nEngine probe`);
const probeQuery = 'KTU 2024 scheme syllabus pdf';
const bingResponse = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(probeQuery)}&setlang=en`, {
  headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
}).catch((e) => ({ ok: false, status: String(e.message), text: async () => '' }));
const bingHtml = await bingResponse.text();
const bingResults = parseBing(bingHtml);
console.log(`  bing        : HTTP ${bingResponse.status}, ${bingResults.length} parsed result(s)`);
if (bingResults[0]) {
  console.log(`    first     : ${bingResults[0].title.slice(0, 70)}`);
  console.log(`    url       : ${bingResults[0].url.slice(0, 96)}`);
  console.log(`    decoded   : ${decodeBingHref('<a href="https://www.bing.com/ck/a?u=a1' + Buffer.from('https://example.com/x').toString('base64url') + '">')}`);
}

const ddgResponse = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(probeQuery)}`, {
  headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
}).catch((e) => ({ status: String(e.message) }));
console.log(`  duckduckgo  : HTTP ${ddgResponse.status} ${ddgResponse.status === 202 ? '(anti-bot challenge, no results - expected from a server)' : ''}`);
