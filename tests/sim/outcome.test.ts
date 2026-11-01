import { describe, expect, it } from 'vitest';
import { makeDay } from '../../src/sim/day';
import { HA_PER_CELL, N, cellIndex } from '../../src/sim/grid';
import { lineCells } from '../../src/sim/inputs';
import { makeOutcome, playOut, runBaseline } from '../../src/sim/outcome';
import { Sim } from '../../src/sim/sim';
import { CellState, type Input } from '../../src/sim/types';

const DAY = '2026-11-01';

function recount(sim: Sim) {
  let burned = 0;
  for (let i = 0; i < N; i++) if (sim.state[i] === CellState.Burned || sim.state[i] === CellState.Burning) burned++;
  let standing = 0;
  for (const house of sim.land.houses) {
    if (!house.cells.some((c) => sim.state[c] === CellState.Burned || sim.state[c] === CellState.Burning)) standing++;
  }
  return { standing, burnedHa: Math.round(burned * HA_PER_CELL), burned };
}

/** A line across the town side of the ignition: enough to change the run. */
function townLine(day: ReturnType<typeof makeDay>): Input {
  const c = day.day.ignition[0].cell;
  const x = c % 128;
  const y = Math.floor(c / 128);
  const tx = day.land.town.x;
  const ty = day.land.town.y;
  const mx = Math.round(x + (tx - x) * 0.45);
  const my = Math.round(y + (ty - y) * 0.45);
  const dx = ty - y;
  const dy = -(tx - x);
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const half = 18;
  const cells = lineCells([
    { x: mx - (dx / len) * half, y: my - (dy / len) * half },
    { x: mx + (dx / len) * half, y: my + (dy / len) * half },
  ]).slice(0, day.day.crewBudgetCells);
  return { kind: 'dig', tick: 1, lineId: 1, cells };
}

describe('outcome', () => {
  it('numbers equal a recount of the final state', () => {
    const made = makeDay(DAY, { tools: ['dig'] });
    for (const inputs of [[], [townLine(made)]]) {
      const run = playOut(made.day, made.land, inputs);
      const r = recount(run.sim);
      expect(run.side.housesStanding).toBe(r.standing);
      expect(run.side.housesTotal).toBe(made.land.houses.length);
      expect(run.side.burnedCells).toBe(r.burned);
      expect(run.side.burnedHa).toBe(r.burnedHa);
    }
  });

  it('the baseline ignores the player inputs', () => {
    const made = makeDay(DAY, { tools: ['dig'] });
    const baseline = runBaseline(made.day, made.land);
    const player = playOut(made.day, made.land, [townLine(made)]);
    expect(player.sim.dugCells).toBeGreaterThan(0);
    expect(player.sim.hash()).not.toBe(baseline.sim.hash());
    const outcome = makeOutcome(player, baseline.side);
    expect(outcome.baseline).toEqual(runBaseline(made.day, made.land).side);
    expect(outcome.player).toEqual(player.side);
  });

  it('fast forwards at the time limit until the fire is out', () => {
    const made = makeDay(DAY, { tools: ['dig'] });
    const run = runBaseline(made.day, made.land);
    expect(run.resolvedByFastForward).toBe(true);
    expect(run.endTick).toBeGreaterThan(made.day.liveTicks);
    expect(run.sim.burningCount).toBe(0);
    expect(run.sim.crewQueue.length).toBe(0);
  });

  it('a live run (inputs stamped at the next tick, uneven advances) equals its replay', () => {
    const made = makeDay(DAY, { tools: ['dig'] });
    const live = new Sim(made.day, made.land);
    const recorded: Input[] = [];
    const line = townLine(made) as Extract<Input, { kind: 'dig' }>;
    const pieces = [line.cells.slice(0, 12), line.cells.slice(12, 30), [cellIndex(2, 2), cellIndex(3, 2)]];
    const steps = [7, 1, 13, 40, 3, 90];
    let piece = 0;
    for (const n of steps) {
      if (piece < pieces.length) {
        const reply = live.applyInput({ kind: 'dig', tick: live.tick + 1, lineId: piece + 1, cells: pieces[piece++] });
        if (reply.ok) recorded.push(reply.input);
      }
      recorded.push({ kind: 'pause', tick: live.tick + 1 });
      const target = Math.min(made.day.liveTicks, live.tick + n);
      while (live.tick < target && !live.contained) live.advanceTick();
    }
    while (live.tick < made.day.liveTicks && !live.contained) live.advanceTick();
    if (!live.contained) live.resolve();
    const replay = playOut(made.day, made.land, recorded);
    expect(replay.sim.hash()).toBe(live.hash());
    expect(replay.side).toEqual(live.outcomeSide());
  });
});
