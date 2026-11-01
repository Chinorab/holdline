// Shared enums and records of the fire simulation. Pure data: no DOM, no Three.

export const Fuel = {
  Grass: 0,
  Shrub: 1,
  Forest: 2,
  Rock: 3,
  Water: 4,
  Road: 5,
  Structure: 6,
} as const;
export type FuelId = (typeof Fuel)[keyof typeof Fuel];

export const Density = { Sparse: 0, Normal: 1, Dense: 2 } as const;

export const CellState = { Unburnable: 0, Fuel: 1, Burning: 2, Burned: 3 } as const;

/** Bits of SimState.flags. */
export const Flag = {
  Controlled: 1, // lit by a backburn
  Spotted: 2, // lit by an ember
  Doused: 4, // put out by a water drop
  Line: 8, // dug by a crew
  Planned: 16, // on a planned line, not dug yet
} as const;

export type Tool = 'dig' | 'water' | 'backburn';
export type RunKind = 'tutorial' | 'daily' | 'practice';

export interface Wind {
  speedMs: number;
  /** Direction the wind blows toward, compass degrees on the board: 0 = far edge, 90 = right. */
  dirDeg: number;
}

export interface WindShift extends Wind {
  announceTick: number;
  tick: number;
}

export interface Ignition {
  cell: number;
  step: number;
}

export interface DayConfig {
  dayId: string;
  dayNumber: number;
  seed: number;
  wind: Wind;
  windShifts: WindShift[];
  ignition: Ignition[];
  crewBudgetCells: number;
  liveTicks: number;
  spreadPeriodTicks: number;
  tools: Tool[];
  spotting: boolean;
  /** Ticks a crew spends on one cell; Day 0 digs faster. Defaults to TUNING.crewTicksPerCell. */
  crewTicksPerCell?: number;
}

export interface House {
  id: number;
  cells: number[];
}

export interface Landscape {
  seed: number;
  elevationM: Float32Array;
  fuel: Uint8Array;
  density: Uint8Array;
  baseMoisture: Uint8Array;
  houses: House[];
  town: { x: number; y: number };
  river: number[];
  road: number[];
}

export type Input =
  | { kind: 'dig'; tick: number; lineId: number; cells: number[] }
  | { kind: 'water'; tick: number; startCell: number; dirDeg: number; lengthCells: number; widthCells: number }
  /** `side`: the neighbor direction that faces the fire, 0 east, 1 near (+y), 2 west, 3 far. */
  | { kind: 'backburn'; tick: number; lineId: number; cell: number; side: BackburnSide }
  | { kind: 'pause'; tick: number }
  | { kind: 'resume'; tick: number };

export type BackburnSide = 0 | 1 | 2 | 3;

export type InputRejection = 'budget' | 'cooldown' | 'locked' | 'invalid';

export type SimEvent =
  | { type: 'ignite'; tick: number; step: number; cell: number }
  | { type: 'ember'; tick: number; step: number; cell: number }
  | { type: 'houseLost'; tick: number; step: number; house: number }
  | { type: 'windShiftAnnounce'; tick: number; dirDeg: number; speedMs: number; atTick: number }
  | { type: 'windShift'; tick: number; dirDeg: number; speedMs: number }
  | { type: 'contained'; tick: number; step: number }
  | { type: 'dug'; tick: number; cell: number }
  | { type: 'water'; tick: number; cells: number }
  | { type: 'backburn'; tick: number; cells: number }
  | { type: 'burnout'; tick: number; step: number };

export interface OutcomeSide {
  housesStanding: number;
  housesTotal: number;
  burnedCells: number;
  burnedHa: number;
}

export interface Outcome {
  player: OutcomeSide;
  baseline: OutcomeSide;
  scarBits: string;
  endTick: number;
  resolvedByFastForward: boolean;
}
