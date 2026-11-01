// Checks the production build before it ships: no agent notes, no source maps, and no
// reference to another origin in any built file (the game must run on its own origin).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist', import.meta.url));

// URL strings that ship inside library code but are never requested by the game. Each
// entry says why; anything else fails the check until it is removed or explained here.
const ALLOWED = [
  // XML and JSON schema identifiers, compared as strings, never fetched.
  { re: /^https?:\/\/www\.w3\.org\//u, why: 'XML namespace identifiers' },
  { re: /^https?:\/\/json-schema\.org\//u, why: 'JSON schema identifiers' },
  { re: /^https:\/\/iwsdk\.dev\/schemas\//u, why: 'IWSDK scene schema identifier' },
  // Text inside messages and comments.
  { re: /^https:\/\/iwsdk\.dev\/api\//u, why: 'documentation link in an IWSDK warning' },
  { re: /^https:\/\/jcgt\.org\//u, why: 'paper citation in a three.js shader string' },
  // Placeholders used to parse relative URLs, not hosts.
  { re: /^https:\/\/iwsdk\.local/u, why: 'IWSDK base URL placeholder for URL parsing' },
  { re: /^http:\/\/\[\$\{/u, why: 'IPv6 host formatting template' },
  // Defaults the game never reaches.
  {
    re: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@webxr-input-profiles\/assets@1\.0\/dist\/profiles/u,
    why: 'rewritten to /input-profiles by src/xr/input-profiles.ts before any load',
  },
  {
    re: /^https:\/\/unpkg\.com\/three@0\./u,
    why: 'Draco and KTX2 decoder defaults; no model of the game uses those extensions',
  },
  {
    re: /^https:\/\/api\.dicebear\.com\//u,
    why: 'default image of the Horizon kit Avatar component, which no panel uses',
  },
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
    if (ALLOWED.some((entry) => entry.re.test(url))) continue;
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
