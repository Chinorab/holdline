import { N, W, cellIndex } from '../../src/sim/grid';
import { Density, Fuel, type DayConfig, type Landscape, type Tool } from '../../src/sim/types';

/** A synthetic board: one fuel everywhere, optional constant slope along x (m per cell). */
export function flatLand(options: { fuel?: number; density?: number; slopeXm?: number; seed?: number } = {}): Landscape {
  const fuel = new Uint8Array(N).fill(options.fuel ?? Fuel.Grass);
  const density = new Uint8Array(N).fill(options.density ?? Density.Normal);
  const elevationM = new Float32Array(N);
  for (let i = 0; i < N; i++) elevationM[i] = 100 + (i % W) * (options.slopeXm ?? 0);
  return {
    seed: options.seed ?? 7,
    elevationM,
    fuel,
    density,
    baseMoisture: new Uint8Array(N),
    houses: [],
    town: { x: 100, y: 40 },
    river: [],
    road: [],
  };
}

export function testDay(options: {
  seed?: number;
  windMs?: number;
  windDeg?: number;
  ignite?: [number, number][];
  tools?: Tool[];
  budget?: number;
  spotting?: boolean;
} = {}): DayConfig {
  return {
    dayId: 'test',
    dayNumber: 1,
    seed: options.seed ?? 7,
    wind: { speedMs: options.windMs ?? 0, dirDeg: options.windDeg ?? 90 },
    windShifts: [],
    ignition: (options.ignite ?? [[64, 40]]).map(([x, y]) => ({ cell: cellIndex(x, y), step: 0 })),
    crewBudgetCells: options.budget ?? 80,
    liveTicks: 1080,
    spreadPeriodTicks: 6,
    tools: options.tools ?? ['dig', 'water'],
    spotting: options.spotting ?? true,
  };
}

/** Extent of fire (burning or burned) from a center column, in cells, to the right and left. */
export function extentX(state: Uint8Array, cx: number): { right: number; left: number } {
  let right = 0;
  let left = 0;
  for (let i = 0; i < N; i++) {
    if (state[i] < 2) continue;
    const x = i % W;
    right = Math.max(right, x - cx);
    left = Math.max(left, cx - x);
  }
  return { right, left };
}

export function countFire(state: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < N; i++) if (state[i] >= 2) n++;
  return n;
}
