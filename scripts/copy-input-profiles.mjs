// Copies the hand and controller models IWSDK shows into public/input-profiles, so the
// game never fetches them from a CDN (src/xr/input-profiles.ts rewrites the URLs).
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = join(root, 'node_modules', '@webxr-input-profiles', 'assets', 'dist', 'profiles');
const target = join(root, 'public', 'input-profiles');
const PROFILES = ['generic-hand', 'meta-quest-touch-plus', 'meta-quest-touch-plus-v2', 'meta-quest-touch-pro', 'oculus-touch-v3'];

mkdirSync(target, { recursive: true });
for (const id of PROFILES) {
  const from = join(source, id);
  if (!existsSync(from)) throw new Error(`missing profile ${id}; run npm install first`);
  cpSync(from, join(target, id), { recursive: true });
}
for (const name of ['LICENSE', 'LICENSE.md']) {
  const license = join(root, 'node_modules', '@webxr-input-profiles', 'assets', name);
  if (existsSync(license)) cpSync(license, join(target, 'LICENSE'));
}
const pkg = JSON.parse(readFileSync(join(root, 'node_modules', '@webxr-input-profiles', 'assets', 'package.json'), 'utf8'));
writeFileSync(join(target, 'SOURCE.txt'), `@webxr-input-profiles/assets ${pkg.version} (license: ${pkg.license ?? 'see LICENSE in this folder'}), profiles: ${PROFILES.join(', ')}\n`);
console.log(`copied ${PROFILES.length} input profiles from @webxr-input-profiles/assets ${pkg.version}`);
