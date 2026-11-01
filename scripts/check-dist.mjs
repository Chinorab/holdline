// Checks the production build before it ships: no agent notes, no source maps, and no
// reference to another origin in any built file (the game must run on its own origin).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist', import.meta.url));

// URLs that appear in library code but are never requested: XML namespaces and spec
// identifiers. Anything else is a failure until it is removed or explained here.
const ALLOWED = [
  /^http:\/\/www\.w3\.org\//u,
  /^https?:\/\/www\.w3\.org\//u,
];

const problems = [];
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(path);
  }
};
walk(dist);

for (const path of files) {
  const rel = relative(dist, path).replaceAll('\\', '/');
  if (rel.endsWith('AGENTS.md')) problems.push(`agent notes shipped: ${rel}`);
  if (rel.endsWith('.map')) problems.push(`source map shipped: ${rel}`);
  if (!['.js', '.mjs', '.html', '.css', '.json', '.uikitml', '.svg', '.webmanifest'].includes(extname(rel))) continue;
  const text = readFileSync(path, 'utf8');
  for (const match of text.matchAll(/https?:\/\/[^\s"'`)<>\\]+/gu)) {
    const url = match[0];
    if (ALLOWED.some((re) => re.test(url))) continue;
    problems.push(`foreign origin in ${rel}: ${url.slice(0, 120)}`);
  }
}

const unique = [...new Set(problems)];
if (unique.length > 0) {
  console.error(`check-dist: ${unique.length} problem(s)`);
  for (const p of unique.slice(0, 60)) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`check-dist: ok (${files.length} files)`);
