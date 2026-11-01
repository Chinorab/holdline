import { describe, expect, it } from 'vitest';
import { H, N, W, cellIndex } from '../../src/sim/grid';
import { Sim } from '../../src/sim/sim';
import { CellState, Flag, Fuel } from '../../src/sim/types';
import { flatLand, testDay } from './helpers';

const BREAK_X = 64;

/** Cells of the break column, ordered from the middle outward (where the fire arrives first). */
function columnFromMiddle(): number[] {
  const cells: number[] = [cellIndex(BREAK_X, 40)];
  for (let d = 1; d < H; d++) {
    if (40 - d >= 0) cells.push(cellIndex(BREAK_X, 40 - d));
    if (40 + d < H) cells.push(cellIndex(BREAK_X, 40 + d));
  }
  return cells.slice(0, H);
}

const burnedBeyond = (sim: Sim) => {
  let n = 0;
  for (let i = 0; i < N; i++) if (i % W > BREAK_X && sim.state[i] >= CellState.Burning) n++;
  return n;
};

describe('fire breaks', () => {
  for (const fuel of [Fuel.Rock, Fuel.Water, Fuel.Road]) {
    it(`a column of ${['', '', '', 'rock', 'water', 'road'][fuel]} stops the fire with spotting off`, () => {
      const land = flatLand();
      for (let y = 0; y < H; y++) land.fuel[cellIndex(BREAK_X, y)] = fuel;
      const sim = new Sim(testDay({ windMs: 10, windDeg: 90, ignite: [[30, 40]], spotting: false }), land);
      sim.runTo(1080);
      sim.resolve();
      expect(sim.state[cellIndex(BREAK_X - 1, 40)]).toBe(CellState.Burned);
      expect(burnedBeyond(sim)).toBe(0);
    });
  }

  it('a dug line stops the fire with spotting off', () => {
    const sim = new Sim(testDay({ windMs: 10, windDeg: 90, ignite: [[20, 40]], spotting: false, budget: 80 }), flatLand());
    const result = sim.applyInput({ kind: 'dig', tick: 1, lineId: 1, cells: columnFromMiddle() });
    expect(result.ok).toBe(true);
    sim.runTo(1080);
    sim.resolve();
    expect(sim.dugCells).toBe(H);
    for (let y = 0; y < H; y++) expect(sim.flags[cellIndex(BREAK_X, y)] & Flag.Line).toBeTruthy();
    expect(sim.state[cellIndex(BREAK_X - 1, 40)]).toBe(CellState.Burned);
    expect(burnedBeyond(sim)).toBe(0);
  });

  it('embers jump a break in strong wind when spotting is on', () => {
    let jumped = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const land = flatLand({ fuel: Fuel.Forest });
      for (let y = 0; y < H; y++) land.fuel[cellIndex(BREAK_X, y)] = Fuel.Road;
      const sim = new Sim(testDay({ seed, windMs: 12, windDeg: 90, ignite: [[40, 40]], spotting: true }), land);
      sim.runTo(1080);
      let spottedBeyond = false;
      for (let i = 0; i < N; i++) if (i % W > BREAK_X && sim.flags[i] & Flag.Spotted) spottedBeyond = true;
      if (spottedBeyond && burnedBeyond(sim) > 0) jumped++;
    }
    expect(jumped).toBeGreaterThan(0);
  });
});
