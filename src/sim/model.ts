// The fire model: a probabilistic cellular automaton after Alexandridis, Vakalis, Siettos
// and Bafas (2008), Applied Mathematics and Computation 204(1):191 to 201.
//
//   p_burn = p_h (1 + p_veg) (1 + p_den) p_w p_s
//   p_w    = exp(c1 V) exp(c2 V (cos theta - 1))      theta: wind vs spread direction
//   p_s    = exp(a theta_s)                           theta_s: slope angle in degrees
//
// PAPER holds the constants as given in the project brief; they are checked against the
// paper's full text in research.md R2 before any public text quotes them. Everything in
// TUNING is ours: the game's time scale, fuel classes, burn durations, moisture, water
// and embers.

import { DEG, RAD_TO_DEG, datan, dcos, dexp, dsin } from './detmath.js';
import { CELL_M, NB_DIST, NB_DX, NB_DY } from './grid.js';
import { Fuel } from './types.js';

export const PAPER = {
  pH: 0.58,
  c1: 0.045,
  c2: 0.131,
  a: 0.078,
  /** p_den for sparse, normal, dense. */
  pDen: [-0.4, 0, 0.3],
} as const;

export const TUNING = {
  /** Scales p_h to the game's clock: one spread step per second of play. */
  spreadScale: 0.25,
  /** p_veg per fuel. Ours: grass catches fastest, forest slowest (then burns long). */
  pVeg: [0.4, 0.05, -0.15, 0, 0, 0, 0.15],
  /** Spread steps a cell keeps burning, per fuel. */
  burnSteps: [3, 5, 9, 0, 0, 0, 10],
  /** Share of ignition chance removed at full ground moisture (river banks). */
  moistureWeight: 0.45,
  /** Ignition chance multiplier on a wet cell (after a water drop). */
  wetFactor: 0.06,
  /** Ticks a watered cell stays wet (45 s). */
  wetTicks: 270,
  /** Ticks between two water drops (20 s). */
  waterCooldownTicks: 120,
  /** Ticks a crew needs per dug cell. */
  crewTicksPerCell: 2,
  ember: {
    minWindMs: 6,
    /** Chance per step that a burning cell throws an ember, per fuel, at full strength. */
    rate: [0, 0.012, 0.03, 0, 0, 0, 0.025],
    minCells: 2,
    maxCells: 6,
    land: 0.55,
  },
} as const;

/** Burnable at the start of a run. */
export const isBurnableFuel = (fuel: number): boolean =>
  fuel === Fuel.Grass || fuel === Fuel.Shrub || fuel === Fuel.Forest || fuel === Fuel.Structure;

/** p_w for the 8 neighbor directions, written into out[0..7]. */
export function windFactors(speedMs: number, dirDeg: number, out: Float64Array): void {
  const r = dirDeg * DEG;
  const wx = dsin(r);
  const wy = -dcos(r);
  const base = dexp(PAPER.c1 * speedMs);
  for (let d = 0; d < 8; d++) {
    const cosTheta = (wx * NB_DX[d] + wy * NB_DY[d]) / NB_DIST[d];
    out[d] = base * dexp(PAPER.c2 * speedMs * (cosTheta - 1));
  }
}

/** p_s from the burning cell's elevation to the neighbor's (uphill is positive). */
export function slopeFactor(fromM: number, toM: number, d: number): number {
  const slopeDeg = datan((toM - fromM) / (CELL_M * NB_DIST[d])) * RAD_TO_DEG;
  return dexp(PAPER.a * slopeDeg);
}

/** (1 + p_veg)(1 + p_den) for a cell. */
export function fuelFactor(fuel: number, density: number): number {
  return (1 + TUNING.pVeg[fuel]) * (1 + PAPER.pDen[density]);
}

/** Ground moisture factor from base moisture 0..255. */
export function moistureFactor(baseMoisture: number): number {
  return 1 - (TUNING.moistureWeight * baseMoisture) / 255;
}

/** Slope in degrees between two cells, for the inspect tooltip. */
export function slopeDegrees(fromM: number, toM: number, d: number): number {
  return datan((toM - fromM) / (CELL_M * NB_DIST[d])) * RAD_TO_DEG;
}
