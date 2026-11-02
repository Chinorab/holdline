// Color vision check: is the fire front still apart from every surface it can sit next to,
// for protanopia, deuteranopia and tritanopia (Machado, Oliveira and Fernandes 2009,
// severity 1.0, applied in linear RGB) and in grayscale? Measures CIE76 color difference
// (Delta E in CIELAB, D65) and the luminance contrast ratio, for both palettes.
//
//   node scripts/cvd-check.mjs        prints a table, exits 1 on a failure
//
// Pass: for every surface the front can touch, at least one band of the front (ink edge,
// light core, orange body) is at Delta E 20 or more, or at a contrast ratio of 1.5 or more.

import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/render/palette.ts', import.meta.url), 'utf8');
function block(name) {
  const m = src.match(new RegExp(`export const ${name} = \\{([\\s\\S]*?)\\} as const;`));
  const out = {};
  for (const [, k, v] of m[1].matchAll(/(\w+): '(#[0-9A-Fa-f]{6})'/g)) out[k] = v;
  return out;
}
const HEX = block('HEX');
const HIGH = { ...HEX, ...block('HEX_HIGH_CONTRAST') };

const MATRICES = {
  normal: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (hex) => [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
const clamp = (v) => Math.min(1, Math.max(0, v));

function simulate(lin, view) {
  if (view === 'grayscale') {
    const y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    return [y, y, y];
  }
  const m = MATRICES[view];
  return [0, 1, 2].map((r) => clamp(m[r * 3] * lin[0] + m[r * 3 + 1] * lin[1] + m[r * 3 + 2] * lin[2]));
}

function lab(lin) {
  const x = (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047;
  const y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  const z = (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const lum = (lin) => 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const deltaE = (a, b) => {
  const p = lab(a);
  const q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};

// The front is drawn as three bands: an ink edge where it meets unburned ground, a light
// core, then the orange body. A surface is told apart from the front when at least one band
// clearly differs from it. Burned ground lies behind the front, never against it.
const SURFACES = ['grass', 'brush', 'forest', 'rock', 'water', 'road', 'board'];
const BANDS = ['ink', 'core', 'fire'];
const VIEWS = ['normal', 'protanopia', 'deuteranopia', 'tritanopia', 'grayscale'];
let failures = 0;

for (const [paletteName, pal] of [['standard', HEX], ['high contrast', HIGH]]) {
  console.log(`\n${paletteName} palette: for each surface, the band of the front that differs most`);
  console.log('view          | weakest surface | its best band | dE    | ratio | pass');
  for (const view of VIEWS) {
    let weakest = null;
    for (const surface of SURFACES) {
      const c = simulate(rgb(pal[surface]), view);
      let best = null;
      for (const band of BANDS) {
        const f = simulate(rgb(pal[band]), view);
        const d = deltaE(f, c);
        const r = contrast(f, c);
        const score = Math.max(d / 20, r / 1.5);
        if (!best || score > best.score) best = { band, d, r, score };
      }
      if (!weakest || best.score < weakest.best.score) weakest = { surface, best };
    }
    const pass = weakest.best.score >= 1;
    if (!pass) failures++;
    const b = weakest.best;
    console.log(`${view.padEnd(13)} | ${weakest.surface.padEnd(15)} | ${b.band.padEnd(13)} | ${b.d.toFixed(1).padStart(5)} | ${b.r.toFixed(2).padStart(5)} | ${pass ? 'yes' : 'NO'}`);
  }
}
console.log(failures ? `\n${failures} view(s) fail` : '\nall views pass');
process.exit(failures ? 1 : 0);
