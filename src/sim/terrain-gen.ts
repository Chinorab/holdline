// Seeded landscape generator: ridges and valleys, a river in the lowest valley, a town of
// six houses beside a road, fuels, densities and ground moisture. Deterministic: only
// basic IEEE operations, the counter based RNG and detmath.

import { DEG, TWO_PI, dcos, dsin } from './detmath.js';
import { H, N, W, cellIndex, inBounds } from './grid.js';
import { Channel, rand01 } from './rng.js';
import { Density, Fuel, type House, type Landscape } from './types.js';

const MIN_ELEVATION_M = 20;
const RELIEF_M = 390;
export const HOUSE_COUNT = 6;

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function lattice(seed: number, field: number, ix: number, iy: number): number {
  return rand01(seed, field, (iy + 64) * 4096 + (ix + 64), Channel.Noise);
}

function valueNoise(seed: number, field: number, x: number, y: number, period: number): number {
  const fx = x / period;
  const fy = y / period;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const sx = fade(fx - ix);
  const sy = fade(fy - iy);
  const a = lerp(lattice(seed, field, ix, iy), lattice(seed, field, ix + 1, iy), sx);
  const b = lerp(lattice(seed, field, ix, iy + 1), lattice(seed, field, ix + 1, iy + 1), sx);
  return lerp(a, b, sy);
}

/** Fractal noise in about [0, 1]. Each octave uses its own lattice field. */
function fbm(seed: number, field: number, x: number, y: number, period: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let total = 0;
  let p = period;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(seed, field * 16 + o, x, y, p);
    total += amp;
    amp *= 0.5;
    p *= 0.5;
  }
  return sum / total;
}

function normalize(values: Float64Array): void {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    if (values[i] < min) min = values[i];
    if (values[i] > max) max = values[i];
  }
  const span = max - min || 1;
  for (let i = 0; i < values.length; i++) values[i] = (values[i] - min) / span;
}

function blur(values: Float64Array): void {
  const copy = Float64Array.from(values);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (!inBounds(nx, ny)) continue;
          sum += copy[cellIndex(nx, ny)];
          count++;
        }
      }
      values[cellIndex(x, y)] = sum / count;
    }
  }
}

/**
 * Cheapest monotone path across the board (seam carving), made 4 connected so that no
 * fire can slip through a diagonal gap. horizontal: from x = 0 to x = W - 1.
 * forced: optional cell the path must pass through.
 */
function seam(
  cost: (x: number, y: number) => number,
  horizontal: boolean,
  forced?: { x: number; y: number },
): number[] {
  const len = horizontal ? W : H; // steps along the path
  const span = horizontal ? H : W; // positions across
  const acc = new Float64Array(len * span);
  const from = new Int16Array(len * span);
  const at = (s: number, p: number) => (horizontal ? cost(s, p) : cost(p, s));
  const blocked = (s: number, p: number) => {
    if (!forced) return false;
    const fs = horizontal ? forced.x : forced.y;
    const fp = horizontal ? forced.y : forced.x;
    return s === fs && p !== fp;
  };
  for (let p = 0; p < span; p++) acc[p] = blocked(0, p) ? Infinity : at(0, p);
  for (let s = 1; s < len; s++) {
    for (let p = 0; p < span; p++) {
      let best = Infinity;
      let bestP = p;
      for (let dp = -1; dp <= 1; dp++) {
        const q = p + dp;
        if (q < 0 || q >= span) continue;
        const v = acc[(s - 1) * span + q] + (dp === 0 ? 0 : 0.015);
        if (v < best) {
          best = v;
          bestP = q;
        }
      }
      acc[s * span + p] = blocked(s, p) ? Infinity : best + at(s, p);
      from[s * span + p] = bestP;
    }
  }
  let p = 0;
  let best = Infinity;
  for (let q = 0; q < span; q++) {
    if (acc[(len - 1) * span + q] < best) {
      best = acc[(len - 1) * span + q];
      p = q;
    }
  }
  const positions = new Int16Array(len);
  for (let s = len - 1; s >= 0; s--) {
    positions[s] = p;
    p = from[s * span + p];
  }
  const cells: number[] = [];
  for (let s = 0; s < len; s++) {
    const pos = positions[s];
    const cell = horizontal ? cellIndex(s, pos) : cellIndex(pos, s);
    if (s > 0 && positions[s - 1] !== pos) {
      // Bridge the diagonal step with the cell beside it.
      const prev = positions[s - 1];
      cells.push(horizontal ? cellIndex(s, prev) : cellIndex(prev, s));
    }
    cells.push(cell);
  }
  return cells;
}

/** Relax neighbor differences above maxStep (normalized elevation) to keep slopes playable. */
function limitSlopes(values: Float64Array, maxStep: number, passes: number): void {
  for (let pass = 0; pass < passes; pass++) {
    let changed = false;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = cellIndex(x, y);
        if (x + 1 < W) changed = relax(values, i, i + 1, maxStep) || changed;
        if (y + 1 < H) changed = relax(values, i, i + W, maxStep) || changed;
      }
    }
    if (!changed) return;
  }
}

function relax(values: Float64Array, a: number, b: number, maxStep: number): boolean {
  const diff = values[b] - values[a];
  if (diff > maxStep) {
    const fix = (diff - maxStep) / 2;
    values[a] += fix;
    values[b] -= fix;
    return true;
  }
  if (diff < -maxStep) {
    const fix = (-diff - maxStep) / 2;
    values[a] -= fix;
    values[b] += fix;
    return true;
  }
  return false;
}

/** 4 connected distance (in cells) from a set of source cells, capped. */
function distanceFrom(sources: number[], cap: number): Int16Array {
  const dist = new Int16Array(N).fill(cap);
  const queue = new Int32Array(N);
  let head = 0;
  let tail = 0;
  for (const c of sources) {
    if (dist[c] !== 0) {
      dist[c] = 0;
      queue[tail++] = c;
    }
  }
  while (head < tail) {
    const c = queue[head++];
    const x = c % W;
    const y = (c - x) / W;
    const next = dist[c] + 1;
    if (next >= cap) continue;
    const visit = (nx: number, ny: number) => {
      if (!inBounds(nx, ny)) return;
      const n = cellIndex(nx, ny);
      if (dist[n] > next) {
        dist[n] = next;
        queue[tail++] = n;
      }
    };
    visit(x + 1, y);
    visit(x - 1, y);
    visit(x, y + 1);
    visit(x, y - 1);
  }
  return dist;
}

export function generateLandscape(seed: number): Landscape {
  const r = (k: number) => rand01(seed, k, 0, Channel.Terrain);

  // 1. Elevation: a ridge pattern along a random axis, fractal noise and ridged noise.
  const alpha = r(1) * TWO_PI;
  const ca = dcos(alpha);
  const sa = dsin(alpha);
  const freq = 1.1 + r(2) * 0.8;
  const phase = r(3);
  const e = new Float64Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = ((x - W / 2) * ca + (y - H / 2) * sa) / W;
      const ridges = 0.5 + 0.5 * dcos(TWO_PI * (u * freq + phase));
      const noise = fbm(seed, 1, x, y, 44, 4);
      const ridged = 1 - Math.abs(2 * fbm(seed, 2, x, y, 36, 3) - 1);
      e[cellIndex(x, y)] = 0.42 * ridges + 0.4 * noise + 0.18 * ridged;
    }
  }
  normalize(e);
  for (let i = 0; i < N; i++) e[i] = e[i] * (0.55 + 0.45 * e[i]);
  blur(e);
  normalize(e);

  // 2. River along the lowest valley, across the long or the short axis.
  const riverHorizontal = Math.abs(sa) >= Math.abs(ca);
  const river = seam(
    (x, y) => {
      const edge = riverHorizontal ? Math.min(y, H - 1 - y) : Math.min(x, W - 1 - x);
      const edgePenalty = edge < 8 ? (8 - edge) * 0.08 : 0;
      return e[cellIndex(x, y)] + 0.12 * fbm(seed, 3, x, y, 20, 2) + edgePenalty;
    },
    riverHorizontal,
  );
  // Carve the valley: each river cell sits at the lowest ground near its stretch of the
  // path, and the banks blend down to it over four cells.
  const level = new Float64Array(river.length);
  for (let k = 0; k < river.length; k++) {
    let low = Infinity;
    for (let j = Math.max(0, k - 6); j <= Math.min(river.length - 1, k + 6); j++) low = Math.min(low, e[river[j]]);
    level[k] = low;
  }
  const riverDist = distanceFrom(river, 12);
  const nearestLevel = new Float64Array(N).fill(-1);
  for (let k = 0; k < river.length; k++) nearestLevel[river[k]] = level[k];
  for (let pass = 0; pass < 5; pass++) {
    for (let i = 0; i < N; i++) {
      if (nearestLevel[i] >= 0 || riverDist[i] > 5) continue;
      const x = i % W;
      const y = (i - x) / W;
      let sum = 0;
      let n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!inBounds(x + dx, y + dy)) continue;
        const v = nearestLevel[cellIndex(x + dx, y + dy)];
        if (v >= 0) {
          sum += v;
          n++;
        }
      }
      if (n > 0) nearestLevel[i] = sum / n;
    }
  }
  for (let i = 0; i < N; i++) {
    const d = riverDist[i];
    if (d === 0) e[i] = nearestLevel[i];
    else if (d <= 5 && nearestLevel[i] >= 0) e[i] = lerp(nearestLevel[i] + d * 0.01, e[i], fade(d / 6));
  }
  limitSlopes(e, 0.045, 60);

  // 3. Town: gentle ground near the river, away from the edges.
  let town = { x: W / 2, y: H / 2 };
  let bestScore = -Infinity;
  for (let y = 14; y < H - 14; y++) {
    for (let x = 18; x < W - 18; x++) {
      const i = cellIndex(x, y);
      const d = riverDist[i];
      if (d < 5 || d > 11) continue;
      const slope =
        Math.abs(e[cellIndex(x + 2, y)] - e[cellIndex(x - 2, y)]) + Math.abs(e[cellIndex(x, y + 2)] - e[cellIndex(x, y - 2)]);
      const score = -slope * 6 - Math.abs(e[i] - 0.28) + rand01(seed, x, y, Channel.Town) * 0.15;
      if (score > bestScore) {
        bestScore = score;
        town = { x, y };
      }
    }
  }

  // 4. Road across the other axis, through the town.
  const roadHorizontal = !riverHorizontal;
  const road = seam(
    (x, y) => {
      const i = cellIndex(x, y);
      const gx = Math.abs(e[cellIndex(Math.min(W - 1, x + 1), y)] - e[cellIndex(Math.max(0, x - 1), y)]);
      const gy = Math.abs(e[cellIndex(x, Math.min(H - 1, y + 1))] - e[cellIndex(x, Math.max(0, y - 1))]);
      return (gx + gy) * 4 + e[i] * 0.2 + 0.05;
    },
    roadHorizontal,
    town,
  );

  // 5. Fuels and densities from elevation and noise.
  const fuel = new Uint8Array(N);
  const density = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = cellIndex(x, y);
      const patch = fbm(seed, 4, x, y, 18, 3);
      const f = e[i] + 0.34 * (patch - 0.5);
      let kind: number = f < 0.3 ? Fuel.Grass : f < 0.52 ? Fuel.Shrub : Fuel.Forest;
      if (e[i] > 0.86 && fbm(seed, 5, x, y, 10, 2) > 0.52) kind = Fuel.Rock;
      fuel[i] = kind;
      const dn = fbm(seed, 6, x, y, 14, 2);
      density[i] = dn < 0.36 ? Density.Sparse : dn < 0.64 ? Density.Normal : Density.Dense;
    }
  }
  for (const c of road) fuel[c] = Fuel.Road;
  for (const c of river) fuel[c] = Fuel.Water;

  // 6. Houses: three on each side of the road, 2 by 2 cells, grass yards around them.
  const houses = placeHouses(town, road, roadHorizontal, fuel);
  for (const house of houses) {
    for (const c of house.cells) {
      const x = c % W;
      const y = (c - x) / W;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!inBounds(x + dx, y + dy)) continue;
          const n = cellIndex(x + dx, y + dy);
          if (fuel[n] === Fuel.Shrub || fuel[n] === Fuel.Forest) {
            fuel[n] = Fuel.Grass;
            density[n] = Density.Normal;
          }
        }
      }
    }
  }
  for (const house of houses) {
    for (const c of house.cells) {
      fuel[c] = Fuel.Structure;
      density[c] = Density.Normal;
    }
  }

  // 7. Ground moisture, highest on the river banks.
  const baseMoisture = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const d = riverDist[i];
    const wet = d >= 9 ? 0 : 255 - d * 28;
    const x = i % W;
    const y = (i - x) / W;
    const jitter = (fbm(seed, 7, x, y, 12, 2) - 0.5) * 50;
    baseMoisture[i] = Math.max(0, Math.min(255, Math.round(wet + jitter)));
  }

  const elevationM = new Float32Array(N);
  for (let i = 0; i < N; i++) elevationM[i] = MIN_ELEVATION_M + RELIEF_M * e[i];
  return { seed, elevationM, fuel, density, baseMoisture, houses, town, river, road };
}

function placeHouses(town: { x: number; y: number }, road: number[], roadHorizontal: boolean, fuel: Uint8Array): House[] {
  // Road position across its axis, per step along it.
  const across = new Map<number, number[]>();
  for (const c of road) {
    const x = c % W;
    const y = (c - x) / W;
    const along = roadHorizontal ? x : y;
    const pos = roadHorizontal ? y : x;
    const list = across.get(along) ?? [];
    list.push(pos);
    across.set(along, list);
  }
  const houses: House[] = [];
  const taken = new Uint8Array(N);
  const center = roadHorizontal ? town.x : town.y;
  // Preferred slots first, then farther along the road until six houses stand.
  const slots = [-6, -1, 4, -11, 9, -16, 14, -21, 19];
  let id = 0;
  for (const offset of slots) {
    for (const side of [-1, 1]) {
      if (houses.length >= HOUSE_COUNT) break;
      const along = center + offset;
      const positions = across.get(along) ?? across.get(along + 1) ?? [roadHorizontal ? town.y : town.x];
      const edge = side < 0 ? Math.min(...positions) : Math.max(...positions);
      for (let push = 2; push <= 9; push++) {
        const p0 = side < 0 ? edge - push - 1 : edge + push;
        const cells: number[] = [];
        let ok = true;
        for (let a = 0; a < 2 && ok; a++) {
          for (let b = 0; b < 2 && ok; b++) {
            const x = roadHorizontal ? along + a : p0 + b;
            const y = roadHorizontal ? p0 + b : along + a;
            if (!inBounds(x, y) || x < 1 || y < 1 || x > W - 2 || y > H - 2) {
              ok = false;
              break;
            }
            const c = cellIndex(x, y);
            if (fuel[c] === Fuel.Water || fuel[c] === Fuel.Road || fuel[c] === Fuel.Rock || taken[c]) ok = false;
            else cells.push(c);
          }
        }
        if (ok && cells.length === 4) {
          for (const c of cells) taken[c] = 1;
          houses.push({ id: id++, cells });
          break;
        }
      }
    }
  }
  return houses;
}

/** Largest slope between 4 neighbors, in degrees (generator checks). */
export function maxSlopeDeg(land: Landscape): number {
  let max = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W - 1; x++) {
      const a = land.elevationM[cellIndex(x, y)];
      const b = land.elevationM[cellIndex(x + 1, y)];
      max = Math.max(max, Math.abs(b - a));
    }
  }
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W; x++) {
      const a = land.elevationM[cellIndex(x, y)];
      const b = land.elevationM[cellIndex(x, y + 1)];
      max = Math.max(max, Math.abs(b - a));
    }
  }
  return (Math.atan(max / 30) / DEG);
}
