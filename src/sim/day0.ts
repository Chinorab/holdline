// Day 0: the tutorial. One fixed landscape, four short days played in turn:
//   wind    a patch of grass lights and leans downwind
//   slope   a fire at the foot of a hill races uphill
//   breaks  grass, then forest, then a road that stops it
//   line    a small fire in a pocket heads for two houses; one short line plugs the gap
// Each beat is its own day id (day0-wind, ...), so it runs through the same worker and
// replays like any other day.

import { dexp } from './detmath.js';
import { H, W, cellIndex } from './grid.js';
import { SLOW_SPREAD_PERIOD_TICKS, SPREAD_PERIOD_TICKS } from './day.js';
import { Density, Fuel, type DayConfig, type Ignition, type Landscape, type Tool, type Wind } from './types.js';

export type Day0Beat = 'wind' | 'slope' | 'breaks' | 'line';
export const DAY0_BEATS: Day0Beat[] = ['wind', 'slope', 'breaks', 'line'];
export const DAY0_SEED = 0x0d0;

/** Beats that only show the fire run this long (ticks at 6 Hz). */
export const DAY0_SHOW_TICKS = 120;

/** Where things are, in cells. */
export const DAY0 = {
  hill: { x: 24, y: 20, heightM: 160, radius: 9 },
  forest: { x0: 54, x1: 58, y0: 8, y1: 32 },
  roadX: 64,
  pocket: { x0: 96, x1: W - 1, y0: 34, y1: 57, wallX: 95, roadY: 33 },
  riverY: 58,
  gap: { x0: 108, x1: 115 },
  houses: [
    { x: 109, y: 63 },
    { x: 113, y: 63 },
  ],
  /** The guided first line: across the gap, a little wider than it. */
  guide: [
    { x: 106, y: 58 },
    { x: 117, y: 58 },
  ],
  ignite: {
    wind: { x: 14, y: 64 },
    slope: { x: 24, y: 42 },
    breaks: { x: 50, y: 20 },
    line: { x: 112, y: 38 },
  },
} as const;

let cached: Landscape | null = null;

export function isDay0(dayId: string): boolean {
  return dayId.startsWith('day0');
}

export function day0Beat(dayId: string): Day0Beat | null {
  const beat = dayId.slice(5) as Day0Beat;
  return dayId.startsWith('day0-') && DAY0_BEATS.includes(beat) ? beat : null;
}

/** The fixed Day 0 board. Built once; callers must not change it. */
export function day0Landscape(): Landscape {
  if (cached) return cached;
  const elevationM = new Float32Array(W * H);
  const fuel = new Uint8Array(W * H).fill(Fuel.Grass);
  const density = new Uint8Array(W * H).fill(Density.Normal);
  const baseMoisture = new Uint8Array(W * H);
  const road: number[] = [];
  const river: number[] = [];
  const { hill, forest, pocket, gap } = DAY0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = cellIndex(x, y);
      // A gentle rise to the far edge, and one round hill on the left.
      const dx = x - hill.x;
      const dy = y - hill.y;
      const bump = hill.heightM * dexp(-(dx * dx + dy * dy) / (2 * hill.radius * hill.radius));
      elevationM[i] = 120 + (H - 1 - y) * 0.5 + bump;
      if (x >= forest.x0 && x <= forest.x1 && y >= forest.y0 && y <= forest.y1) fuel[i] = Fuel.Forest;
      if (x === DAY0.roadX || (y === pocket.roadY && x >= pocket.wallX) || (x === pocket.wallX && y >= pocket.roadY && y <= DAY0.riverY)) {
        fuel[i] = Fuel.Road;
        road.push(i);
      }
      if (y === DAY0.riverY && x > pocket.wallX && (x < gap.x0 || x > gap.x1)) {
        fuel[i] = Fuel.Water;
        river.push(i);
      }
    }
  }
  const houses = DAY0.houses.map((h, id) => {
    const cells = [cellIndex(h.x, h.y), cellIndex(h.x + 1, h.y), cellIndex(h.x, h.y + 1), cellIndex(h.x + 1, h.y + 1)];
    for (const c of cells) fuel[c] = Fuel.Structure;
    return { id, cells };
  });
  cached = {
    seed: DAY0_SEED,
    elevationM,
    fuel,
    density,
    baseMoisture,
    houses,
    town: { x: 111, y: 64 },
    river,
    road,
  };
  return cached;
}

function cluster(x: number, y: number): Ignition[] {
  // Center plus its four neighbors, lit on the first spread step so nothing burns before
  // the player starts the beat.
  return [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].map(([dx, dy]) => ({ cell: cellIndex(x + dx, y + dy), step: 1 }));
}

export function makeDay0Config(beat: Day0Beat, options: { slowerFire?: boolean } = {}): DayConfig {
  const at = DAY0.ignite[beat];
  const winds: Record<Day0Beat, Wind> = {
    wind: { speedMs: 8, dirDeg: 90 },
    slope: { speedMs: 1, dirDeg: 0 },
    breaks: { speedMs: 7, dirDeg: 90 },
    line: { speedMs: 4, dirDeg: 180 },
  };
  const tools: Tool[] = beat === 'line' ? ['dig'] : [];
  return {
    dayId: `day0-${beat}`,
    dayNumber: 0,
    seed: DAY0_SEED,
    wind: winds[beat],
    windShifts: [],
    ignition: cluster(at.x, at.y),
    crewBudgetCells: 40,
    liveTicks: beat === 'line' ? 1080 : DAY0_SHOW_TICKS,
    spreadPeriodTicks: options.slowerFire ? SLOW_SPREAD_PERIOD_TICKS : SPREAD_PERIOD_TICKS,
    tools,
    spotting: false,
    crewTicksPerCell: 1,
  };
}
