// FIRST CUT: backburn is the first feature to drop if time runs short.
import { describe, expect, it } from 'vitest';
import { N, W, cellIndex } from '../../src/sim/grid';
import { lineCells } from '../../src/sim/inputs';
import { BACKBURN_CELLS, Sim } from '../../src/sim/sim';
import { CellState, Flag, type DayConfig } from '../../src/sim/types';
import { flatLand, testDay } from './helpers';

const LINE_X = 60;

function withLine(day: DayConfig, y0: number, y1: number): Sim {
  const sim = new Sim(day, flatLand());
  const cells = lineCells([{ x: LINE_X + 0.5, y: y0 + 0.5 }, { x: LINE_X + 0.5, y: y1 + 0.5 }]);
  expect(sim.applyInput({ kind: 'dig', tick: 1, lineId: 1, cells }).ok).toBe(true);
  while (sim.dugCells < cells.length) sim.advanceTick();
  return sim;
}

const tools = ['dig', 'water', 'backburn'] as DayConfig['tools'];

describe('backburn', () => {
  it('is locked until unlocked, and needs a dug line cell', () => {
    const locked = withLine(testDay({ ignite: [[5, 5]], tools: ['dig'] }), 30, 50);
    expect(locked.applyInput({ kind: 'backburn', tick: locked.tick + 1, lineId: 1, cell: cellIndex(LINE_X, 40), side: 2 })).toEqual({ ok: false, reason: 'locked' });
    const sim = withLine(testDay({ ignite: [[5, 5]], tools }), 30, 50);
    expect(sim.applyInput({ kind: 'backburn', tick: sim.tick + 1, lineId: 1, cell: cellIndex(LINE_X - 3, 40), side: 2 })).toEqual({ ok: false, reason: 'invalid' });
  });

  it('lights up to 12 cells on the fire facing side only', () => {
    const sim = withLine(testDay({ ignite: [[5, 5]], tools, spotting: false }), 30, 50);
    const before = sim.burningCount;
    const reply = sim.applyInput({ kind: 'backburn', tick: sim.tick + 1, lineId: 1, cell: cellIndex(LINE_X, 40), side: 2 });
    expect(reply.ok).toBe(true);
    expect(sim.burningCount - before).toBe(BACKBURN_CELLS);
    let lit = 0;
    for (let i = 0; i < N; i++) {
      if (sim.flags[i] & Flag.Controlled) {
        lit++;
        expect(i % W).toBe(LINE_X - 1);
        expect(Math.abs(Math.floor(i / W) - 40)).toBeLessThanOrEqual(6);
      }
    }
    expect(lit).toBe(BACKBURN_CELLS);
  });

  it('burns the fuel ahead of the main front', () => {
    const day = testDay({ windMs: 5, windDeg: 90, ignite: [[20, 40]], tools, spotting: false, budget: 80 });
    const sim = withLine(day, 20, 60);
    expect(sim.applyInput({ kind: 'backburn', tick: sim.tick + 1, lineId: 1, cell: cellIndex(LINE_X, 40), side: 2 }).ok).toBe(true);
    // Run until the main front (from x = 20) reaches x = 45.
    const mainReached = () => {
      for (let y = 0; y < 80; y++) for (let x = 45; x < 50; x++) if (sim.state[cellIndex(x, y)] >= CellState.Burning) return true;
      return false;
    };
    while (sim.tick < 1080 && !mainReached()) sim.advanceTick();
    let burnedAhead = 0;
    for (let y = 20; y <= 60; y++) for (let x = 52; x < LINE_X; x++) if (sim.state[cellIndex(x, y)] >= CellState.Burning) burnedAhead++;
    expect(burnedAhead).toBeGreaterThan(BACKBURN_CELLS);
  });

  it('can escape around a short line after a wind shift', () => {
    const base = testDay({ windMs: 6, windDeg: 270, ignite: [[5, 75]], tools, spotting: false });
    const day: DayConfig = { ...base, windShifts: [{ announceTick: 60, tick: 108, dirDeg: 90, speedMs: 9 }] };
    const sim = withLine(day, 36, 44);
    expect(sim.applyInput({ kind: 'backburn', tick: sim.tick + 1, lineId: 1, cell: cellIndex(LINE_X, 40), side: 2 }).ok).toBe(true);
    sim.runTo(1080);
    let beyond = 0;
    for (let i = 0; i < N; i++) if (i % W > LINE_X && sim.state[i] >= CellState.Burning) beyond++;
    expect(beyond).toBeGreaterThan(0);
  });
});
