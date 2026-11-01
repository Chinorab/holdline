import { describe, expect, it } from 'vitest';
import { N, W, cellIndex } from '../../src/sim/grid';
import { Sim } from '../../src/sim/sim';
import { CellState, Flag } from '../../src/sim/types';
import { flatLand, testDay } from './helpers';

/** Tick at which fire first reaches column x (or -1 within the limit). */
function crossingTick(sim: Sim, x: number, limit: number): number {
  while (sim.tick < limit) {
    sim.advanceTick();
    for (let i = 0; i < N; i++) if (i % W >= x && sim.state[i] >= CellState.Burning) return sim.tick;
  }
  return -1;
}

describe('water drop', () => {
  it('delays ignition and crossing compared with dry ground', () => {
    let wetLater = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const day = testDay({ seed, windMs: 6, windDeg: 90, ignite: [[20, 40]], spotting: false });
      const dry = new Sim(day, flatLand());
      const wet = new Sim(day, flatLand());
      // A strip from (41, 28) toward the near edge: columns 40 to 42, rows 28 to 51.
      const drop = wet.applyInput({ kind: 'water', tick: 1, startCell: cellIndex(41, 28), dirDeg: 180, lengthCells: 24, widthCells: 3 });
      expect(drop.ok).toBe(true);
      const tDry = crossingTick(dry, 43, 1080);
      const tWet = crossingTick(wet, 43, 1080);
      expect(tDry).toBeGreaterThan(0);
      if (tWet === -1 || tWet > tDry) wetLater++;
    }
    expect(wetLater).toBe(5);
  });

  it('douses burning cells under the strip and respects the cooldown', () => {
    const sim = new Sim(testDay({ windMs: 4, windDeg: 90, ignite: [[64, 40]] }), flatLand());
    sim.runTo(72);
    const burningBefore = sim.burningCount;
    expect(burningBefore).toBeGreaterThan(3);
    const drop = sim.applyInput({ kind: 'water', tick: 73, startCell: cellIndex(52, 40), dirDeg: 90, lengthCells: 24, widthCells: 3 });
    expect(drop.ok).toBe(true);
    let doused = 0;
    for (let i = 0; i < N; i++) if (sim.flags[i] & Flag.Doused) doused++;
    expect(doused).toBeGreaterThan(0);
    expect(sim.burningCount).toBeLessThan(burningBefore);
    sim.advanceTick();
    const again = sim.applyInput({ kind: 'water', tick: 74, startCell: cellIndex(10, 10), dirDeg: 90, lengthCells: 24, widthCells: 3 });
    expect(again).toEqual({ ok: false, reason: 'cooldown' });
  });
});
