import { describe, expect, it } from 'vitest';
import { makeDay } from '../../src/sim/day';
import { W, cellIndex } from '../../src/sim/grid';
import { lineCells } from '../../src/sim/inputs';
import { playOut, runBaseline } from '../../src/sim/outcome';
import { Sim } from '../../src/sim/sim';
import type { Input } from '../../src/sim/types';

function liveInputs(sim: Sim): Input[] {
  // A line across the town side of the fire and a water drop, applied at fixed ticks.
  const { x, y } = sim.land.town;
  const recorded: Input[] = [];
  const plan: { at: number; make: (tick: number) => Input }[] = [
    {
      at: 30,
      make: (tick) => ({ kind: 'dig', tick, lineId: 1, cells: lineCells([{ x: x - 12, y: y - 8 }, { x: x + 12, y: y - 8 }]) }),
    },
    {
      at: 200,
      make: (tick) => ({ kind: 'water', tick, startCell: sim.day.ignition[0].cell, dirDeg: 90, lengthCells: 24, widthCells: 3 }),
    },
  ];
  while (sim.tick < 600) {
    for (const p of plan) {
      if (p.at === sim.tick + 1) {
        const result = sim.applyInput(p.make(sim.tick + 1));
        if (result.ok) recorded.push(result.input);
      }
    }
    sim.advanceTick();
  }
  return recorded;
}

describe('determinism', () => {
  it('gives the same hash at every tick for the same day', () => {
    const { day, land } = makeDay('2026-11-03');
    const a = new Sim(day, land);
    const b = new Sim(day, land);
    for (let t = 0; t < 900; t++) {
      a.advanceTick();
      b.advanceTick();
      expect(a.hash()).toBe(b.hash());
    }
  });

  it('replays recorded inputs to the same state', () => {
    const { day, land } = makeDay('2026-11-04', { tools: ['dig', 'water'] });
    const live = new Sim(day, land);
    const recorded = liveInputs(live);
    expect(recorded.length).toBe(2);
    const replayed = new Sim(day, land);
    replayed.runTo(600, recorded);
    expect(replayed.hash()).toBe(live.hash());
    const fresh = new Sim(day, land);
    fresh.runTo(600);
    expect(fresh.hash()).not.toBe(live.hash());
  });

  it('computes the baseline as a fresh run with no inputs', () => {
    const { day, land } = makeDay('2026-11-06');
    const a = runBaseline(day, land);
    const b = playOut(day, land, []);
    expect(a.sim.hash()).toBe(b.sim.hash());
    expect(a.side).toEqual(b.side);
    const regenerated = makeDay('2026-11-06');
    expect(runBaseline(regenerated.day, regenerated.land).sim.hash()).toBe(a.sim.hash());
  });

  it('gives the player run and the baseline the same luck before any input', () => {
    const { day, land } = makeDay('2026-11-07', { tools: ['dig'] });
    const player = new Sim(day, land);
    const baseline = new Sim(day, land);
    player.runTo(300);
    baseline.runTo(300);
    expect(player.hash()).toBe(baseline.hash());
    const c = cellIndex(W - 2, 1);
    expect(player.applyInput({ kind: 'dig', tick: 301, lineId: 1, cells: [c] }).ok).toBe(true);
  });
});
