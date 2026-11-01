import { describe, expect, it } from 'vitest';
import { H, N, W, cellIndex } from '../../src/sim/grid';
import { lineCells } from '../../src/sim/inputs';
import { TUNING } from '../../src/sim/model';
import { Sim } from '../../src/sim/sim';
import { CellState, Flag, type SimEvent } from '../../src/sim/types';
import { flatLand, testDay } from './helpers';

const row = (y: number, x0: number, x1: number) => lineCells([{ x: x0, y }, { x: x1, y }]);

function dugTicks(events: SimEvent[]): { tick: number; cell: number }[] {
  return events.filter((e) => e.type === 'dug').map((e) => ({ tick: e.tick, cell: (e as { cell: number }).cell }));
}

describe('crews dig a line', () => {
  it('dig from the line start, one cell every crewTicksPerCell ticks', () => {
    const sim = new Sim(testDay({ ignite: [[120, 70]], spotting: false }), flatLand());
    const cells = row(5, 10, 19);
    expect(sim.applyInput({ kind: 'dig', tick: 1, lineId: 1, cells }).ok).toBe(true);
    sim.runTo(60);
    const dug = dugTicks(sim.events);
    expect(dug.map((d) => d.cell)).toEqual(cells);
    const pace = TUNING.crewTicksPerCell;
    dug.forEach((d, k) => expect(d.tick).toBe(1 + pace * (k + 1) - 1));
    for (const c of cells) {
      expect(sim.state[c]).toBe(CellState.Unburnable);
      expect(sim.flags[c] & Flag.Line).toBeTruthy();
      expect(sim.flags[c] & Flag.Planned).toBe(0);
    }
    expect(sim.dugCells).toBe(cells.length);
  });

  it('enforces the budget', () => {
    const sim = new Sim(testDay({ ignite: [[120, 70]], budget: 10 }), flatLand());
    expect(sim.applyInput({ kind: 'dig', tick: 1, lineId: 1, cells: row(5, 0, 10) })).toEqual({ ok: false, reason: 'budget' });
    expect(sim.budgetUsed).toBe(0);
    expect(sim.applyInput({ kind: 'dig', tick: 1, lineId: 1, cells: row(5, 0, 9) }).ok).toBe(true);
    expect(sim.budgetLeft).toBe(0);
    sim.advanceTick();
    expect(sim.applyInput({ kind: 'dig', tick: 2, lineId: 2, cells: row(9, 0, 0) })).toEqual({ ok: false, reason: 'budget' });
  });

  it('a line dug by the crews ahead of the fire stops it with spotting off', () => {
    const LINE_X = 100;
    const sim = new Sim(testDay({ windMs: 6, windDeg: 90, ignite: [[5, 40]], spotting: false, budget: H }), flatLand());
    const column = lineCells([{ x: LINE_X, y: 0 }, { x: LINE_X, y: H - 1 }]);
    expect(sim.applyInput({ kind: 'dig', tick: 1, lineId: 1, cells: column }).ok).toBe(true);
    sim.runTo(1080);
    sim.resolve();
    expect(sim.dugCells).toBe(H);
    expect(sim.state[cellIndex(LINE_X - 1, 40)]).toBe(CellState.Burned);
    let beyond = 0;
    for (let i = 0; i < N; i++) if (i % W > LINE_X && sim.state[i] >= CellState.Burning) beyond++;
    expect(beyond).toBe(0);
  });

  it('skips burning and burned cells, and gives back cells that burn before the crew arrives', () => {
    const sim = new Sim(testDay({ ignite: [[64, 40]], spotting: false }), flatLand());
    sim.runTo(60);
    // A row straight through the fire: only unburnt fuel is planned.
    const through = row(40, 54, 74);
    const reply = sim.applyInput({ kind: 'dig', tick: 61, lineId: 1, cells: through });
    expect(reply.ok).toBe(true);
    if (!reply.ok || reply.input.kind !== 'dig') return;
    for (const c of reply.input.cells) expect(sim.state[c]).toBe(CellState.Fuel);
    expect(reply.input.cells.length).toBeLessThan(through.length);

    // A long far line first, then cells next to the front: the front gets there first.
    const fresh = new Sim(testDay({ ignite: [[64, 40]], spotting: false }), flatLand());
    const cells = [...row(2, 0, 39), ...row(38, 60, 68)];
    expect(fresh.applyInput({ kind: 'dig', tick: 1, lineId: 1, cells }).ok).toBe(true);
    fresh.runTo(400);
    expect(fresh.crewQueue.length).toBe(0);
    expect(fresh.crewCell).toBe(-1);
    expect(fresh.budgetUsed).toBe(fresh.dugCells);
    expect(fresh.dugCells).toBeLessThan(cells.length);
    for (const c of cells) expect(fresh.flags[c] & Flag.Planned).toBe(0);
  });
});
