// Color vision check: is the fire front still apart from every surface it can sit next to,
// for protanopia, deuteranopia and tritanopia (Machado, Oliveira and Fernandes 2009,
// severity 1.0, applied in linear RGB) and in grayscale? Measures CIE76 color difference
// (Delta E in CIELAB, D65) and the luminance contrast ratio, for both palettes.
//
//   node scripts/cvd-check.mjs        prints a table, exits 1 on a failure
//
// Pass: Delta E of at least 20 or a contrast ratio of at least 1.5 for the fire color, and
// separately for the fire's light core. The ink edge around the front comes on top of this.

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

const SURFACES = ['grass', 'brush', 'forest', 'rock', 'water', 'road', 'burned', 'ash', 'board'];
const VIEWS = ['normal', 'protanopia', 'deuteranopia', 'tritanopia', 'grayscale'];
let failures = 0;

for (const [paletteName, pal] of [['standard', HEX], ['high contrast', HIGH]]) {
  console.log(`\n${paletteName} palette: closest surface to the fire and to its core, per view`);
  console.log('view          | fire vs closest       | dE    | ratio | core vs closest       | dE    | ratio | pass');
  for (const view of VIEWS) {
    const row = [];
    let pass = true;
    for (const part of ['fire', 'core']) {
      const f = simulate(rgb(pal[part]), view);
      let worst = null;
      for (const s of SURFACES) {
        const c = simulate(rgb(pal[s]), view);
        const d = deltaE(f, c);
        const r = contrast(f, c);
        // Closest by the better of the two measures: a surface is only a problem if it is
        // close by both.
        const score = Math.max(d / 20, r / 1.5);
        if (!worst || score < worst.score) worst = { s, d, r, score };
      }
      if (worst.score < 1) pass = false;
      row.push(`${worst.s.padEnd(8)}`.padEnd(21), worst.d.toFixed(1).padStart(5), worst.r.toFixed(2).padStart(5));
    }
    if (!pass) failures++;
    console.log(`${view.padEnd(13)} | ${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} | ${row[4]} | ${row[5]} | ${pass ? 'yes' : 'NO'}`);
  }
}
console.log(failures ? `\n${failures} view(s) fail` : '\nall views pass');
process.exit(failures ? 1 : 0);
