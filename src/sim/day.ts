// Day configuration: the date seeds the landscape, then wind, ignition and crew budget are
// drawn from the same seed. One date gives the same fire on every device.

import { RAD_TO_DEG, datan2, dcos, dsin } from './detmath.js';
import { H, W, cellIndex } from './grid.js';
import { hashString } from './hash.js';
import { Channel, rand01 } from './rng.js';
import { generateLandscape } from './terrain-gen.js';
import { Fuel, type DayConfig, type Landscape, type Tool, type WindShift } from './types.js';

/** Day 1 is the first day of the game. */
export const DAY_ONE = '2026-11-01';
export const TICK_HZ = 6;
export const LIVE_TICKS = 1080; // 3 minutes
export const SPREAD_PERIOD_TICKS = 6; // one spread step per second
export const SLOW_SPREAD_PERIOD_TICKS = 9;

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** Device local date as YYYY-MM-DD. */
export function localDayId(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayIdToUtc(dayId: string): number {
  const [y, m, d] = dayId.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Days since Day 1 plus one. Dates before Day 1 give numbers below 1. */
export function dayNumber(dayId: string): number {
  return Math.round((dayIdToUtc(dayId) - dayIdToUtc(DAY_ONE)) / 86400000) + 1;
}

/** The day id n days before (or after, for negative n) the given one. */
export function shiftDayId(dayId: string, days: number): string {
  const t = new Date(dayIdToUtc(dayId) - days * 86400000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function seedForDay(dayId: string): number {
  return hashString(`holdline:${dayId}`);
}

export function windWord(speedMs: number): 0 | 1 | 2 | 3 {
  if (speedMs < 3.5) return 0;
  if (speedMs < 6) return 1;
  if (speedMs < 9) return 2;
  return 3;
}

export interface DayOptions {
  slowerFire?: boolean;
  tools?: Tool[];
}

/** Bearing in compass degrees from cell a to cell b on the board. */
export function bearingDeg(ax: number, ay: number, bx: number, by: number): number {
  const deg = datan2(bx - ax, -(by - ay)) * RAD_TO_DEG;
  return deg < 0 ? deg + 360 : deg;
}

export function makeDay(dayId: string, options: DayOptions = {}): { day: DayConfig; land: Landscape } {
  const seed = seedForDay(dayId);
  const land = generateLandscape(seed);
  const day = makeDayConfig(dayId, seed, land, options);
  return { day, land };
}

export function makeDayConfig(dayId: string, seed: number, land: Landscape, options: DayOptions = {}): DayConfig {
  const r = (k: number) => rand01(seed, k, 1, Channel.Day);
  const { x: tx, y: ty } = land.town;

  // Ignition: 32 to 50 cells from town, on grass or brush, in ground the fire can cross to
  // reach houses (same side of the river and road), with a ridge in between when possible.
  const region = burnRegions(land);
  const housesInRegion = new Map<number, number>();
  for (const house of land.houses) {
    const seen = new Set<number>();
    for (const c of house.cells) for (const n of neighborsOf(c)) if (region[n] > 0) seen.add(region[n]);
    for (const id of seen) housesInRegion.set(id, (housesInRegion.get(id) ?? 0) + 1);
  }
  let ignition = cellIndex(Math.min(W - 6, tx + 34), ty);
  let bestScore = -Infinity;
  for (let k = 0; k < 64; k++) {
    const angle = r(10 + k) * 360;
    const dist = 32 + r(80 + k) * 18;
    const rad = angle * 0.017453292519943295;
    const x = Math.round(tx + dsin(rad) * dist);
    const y = Math.round(ty - dcos(rad) * dist);
    if (x < 4 || y < 4 || x >= W - 4 || y >= H - 4) continue;
    const c = cellIndex(x, y);
    const f = land.fuel[c];
    if (f !== Fuel.Grass && f !== Fuel.Shrub) continue;
    const reachable = housesInRegion.get(region[c]) ?? 0;
    if (reachable === 0) continue;
    let ridge = 0;
    const steps = Math.round(dist);
    const e0 = land.elevationM[c];
    const e1 = land.elevationM[cellIndex(tx, ty)];
    for (let s = 1; s < steps; s++) {
      const px = Math.round(x + ((tx - x) * s) / steps);
      const py = Math.round(y + ((ty - y) * s) / steps);
      ridge = Math.max(ridge, land.elevationM[cellIndex(px, py)] - Math.max(e0, e1));
    }
    const score = reachable * 0.4 + Math.min(ridge, 80) / 80 + r(160 + k) * 0.5 + (f === Fuel.Grass ? 0.2 : 0);
    if (score > bestScore) {
      bestScore = score;
      ignition = c;
    }
  }
  const ix = ignition % W;
  const iy = (ignition - ix) / W;

  // Wind blows from the ignition toward the town, within 25 degrees.
  const toward = bearingDeg(ix, iy, tx, ty);
  const dirDeg = normDeg(toward + (r(200) - 0.5) * 50);
  const speedMs = Math.round((3 + r(201) * 8) * 10) / 10;

  const windShifts: WindShift[] = [];
  if (r(202) < 0.5) {
    const tick = 360 + Math.floor(r(203) * 420);
    const turn = (30 + r(204) * 30) * (r(205) < 0.5 ? -1 : 1);
    windShifts.push({
      announceTick: tick - 48,
      tick,
      dirDeg: normDeg(dirDeg + turn),
      speedMs: Math.max(2, Math.round((speedMs + (r(206) - 0.5) * 3) * 10) / 10),
    });
  }

  const distCells = Math.sqrt((ix - tx) * (ix - tx) + (iy - ty) * (iy - ty));
  const crewBudgetCells = Math.max(40, Math.min(80, Math.round(30 + distCells * 0.8 + speedMs * 2)));

  return {
    dayId,
    dayNumber: dayId === 'day0' ? 0 : dayNumber(dayId),
    seed,
    wind: { speedMs, dirDeg },
    windShifts,
    ignition: ignitionCluster(land, ignition),
    crewBudgetCells,
    liveTicks: LIVE_TICKS,
    spreadPeriodTicks: options.slowerFire ? SLOW_SPREAD_PERIOD_TICKS : SPREAD_PERIOD_TICKS,
    tools: options.tools ?? ['dig'],
    spotting: true,
  };
}

function normDeg(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return Math.round(d * 10) / 10;
}

function neighborsOf(c: number): number[] {
  const x = c % W;
  const y = (c - x) / W;
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H) out.push(cellIndex(nx, ny));
    }
  }
  return out;
}

/** Labels of 8 connected burnable regions (0 = not burnable), houses excluded. */
function burnRegions(land: Landscape): Int32Array {
  const label = new Int32Array(W * H);
  const stack: number[] = [];
  let next = 0;
  const burnable = (c: number) => {
    const f = land.fuel[c];
    return f === Fuel.Grass || f === Fuel.Shrub || f === Fuel.Forest;
  };
  for (let c = 0; c < W * H; c++) {
    if (label[c] !== 0 || !burnable(c)) continue;
    next++;
    label[c] = next;
    stack.push(c);
    while (stack.length > 0) {
      const cur = stack.pop() as number;
      for (const n of neighborsOf(cur)) {
        if (label[n] === 0 && burnable(n)) {
          label[n] = next;
          stack.push(n);
        }
      }
    }
  }
  return label;
}

/** The ignition cell and its 4 neighbors that can burn: a small start that rarely dies. */
function ignitionCluster(land: Landscape, center: number): { cell: number; step: number }[] {
  const x = center % W;
  const y = (center - x) / W;
  const cells = [center];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const c = cellIndex(nx, ny);
    const f = land.fuel[c];
    if (f === Fuel.Grass || f === Fuel.Shrub || f === Fuel.Forest) cells.push(c);
  }
  return cells.map((cell) => ({ cell, step: 0 }));
}
