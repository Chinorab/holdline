import { describe, expect, it } from 'vitest';
import { cellIndex } from '../../src/sim/grid';
import { WATER_LENGTH_CELLS, WATER_WIDTH_CELLS, waterStripCells } from '../../src/sim/inputs';
import { TUNING } from '../../src/sim/model';
import { Sim } from '../../src/sim/sim';
import { CellState, Flag } from '../../src/sim/types';
import { flatLand, testDay } from './helpers';

const drop = (tick: number, x: number, y: number, dirDeg: number) => ({
  kind: 'water' as const,
  tick,
  startCell: cellIndex(x, y),
  dirDeg,
  lengthCells: WATER_LENGTH_CELLS,
  widthCells: WATER_WIDTH_CELLS,
});

describe('water drop input', () => {
  it('has a 120 tick cooldown', () => {
    expect(TUNING.waterCooldownTicks).toBe(120);
    const sim = new Sim(testDay({ ignite: [[120, 70]] }), flatLand());
    expect(sim.applyInput(drop(1, 10, 10, 90)).ok).toBe(true);
    expect(sim.waterReadyAt).toBe(121);
    sim.runTo(119);
    expect(sim.applyInput(drop(120, 10, 30, 90))).toEqual({ ok: false, reason: 'cooldown' });
    sim.advanceTick();
    expect(sim.applyInput(drop(121, 10, 30, 90)).ok).toBe(true);
  });

  it('wets a strip from its start along its direction', () => {
    const east = waterStripCells(cellIndex(20, 40), 90, WATER_LENGTH_CELLS, WATER_WIDTH_CELLS);
    expect(east).toContain(cellIndex(20, 40));
    expect(east.length).toBe(WATER_LENGTH_CELLS * WATER_WIDTH_CELLS);
    for (const c of east) {
      const x = c % 128;
      const y = Math.floor(c / 128);
      expect(x).toBeGreaterThanOrEqual(20);
      expect(x).toBeLessThan(20 + WATER_LENGTH_CELLS);
      expect(Math.abs(y - 40)).toBeLessThanOrEqual(1);
    }
    const near = waterStripCells(cellIndex(20, 40), 180, WATER_LENGTH_CELLS, WATER_WIDTH_CELLS);
    for (const c of near) expect(Math.floor(c / 128)).toBeGreaterThanOrEqual(40);

    const sim = new Sim(testDay({ ignite: [[120, 70]] }), flatLand());
    sim.applyInput(drop(1, 20, 40, 90));
    for (const c of east) expect(sim.wetUntil[c]).toBe(1 + TUNING.wetTicks);
  });

  it('douses burning cells under the strip', () => {
    const sim = new Sim(testDay({ windMs: 4, windDeg: 90, ignite: [[64, 40]], spotting: false }), flatLand());
    sim.runTo(48);
    const strip = waterStripCells(cellIndex(52, 40), 90, WATER_LENGTH_CELLS, WATER_WIDTH_CELLS);
    const under = strip.filter((c) => sim.state[c] === CellState.Burning);
    expect(under.length).toBeGreaterThan(0);
    expect(sim.applyInput(drop(49, 52, 40, 90)).ok).toBe(true);
    for (const c of under) {
      expect(sim.state[c]).toBe(CellState.Burned);
      expect(sim.flags[c] & Flag.Doused).toBeTruthy();
    }
  });
});
