import { describe, expect, it } from 'vitest';
import { makeDay } from '../../src/sim/day';
import { DAY0, DAY0_SHOW_TICKS, day0Landscape } from '../../src/sim/day0';
import { N, W } from '../../src/sim/grid';
import { lineCells } from '../../src/sim/inputs';
import { Sim } from '../../src/sim/sim';
import { CellState, Fuel } from '../../src/sim/types';

function extent(sim: Sim, cx: number, cy: number) {
  let east = 0;
  let west = 0;
  let north = 0;
  let south = 0;
  let cells = 0;
  for (let i = 0; i < N; i++) {
    if (sim.state[i] < CellState.Burning) continue;
    cells++;
    const x = i % W;
    const y = (i - x) / W;
    east = Math.max(east, x - cx);
    west = Math.max(west, cx - x);
    north = Math.max(north, cy - y);
    south = Math.max(south, y - cy);
  }
  return { east, west, north, south, cells };
}

const guideLine = () => lineCells(DAY0.guide.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 })));

describe('Day 0', () => {
  it('is one fixed board with two houses in reach of the line beat', () => {
    const a = makeDay('day0-line').land;
    const b = day0Landscape();
    expect(a).toBe(b);
    expect(a.houses.length).toBe(2);
    expect(makeDay('day0-wind').day.ignition[0].step).toBe(1);
  });

  it('wind beat: the fire leans downwind', () => {
    const { day, land } = makeDay('day0-wind');
    const sim = new Sim(day, land);
    expect(sim.burningCount).toBe(0);
    sim.runTo(DAY0_SHOW_TICKS);
    const e = extent(sim, DAY0.ignite.wind.x, DAY0.ignite.wind.y);
    console.info('wind beat', e);
    expect(e.east).toBeGreaterThan(e.west + 4);
  });

  it('slope beat: the fire runs uphill', () => {
    const { day, land } = makeDay('day0-slope');
    const sim = new Sim(day, land);
    sim.runTo(DAY0_SHOW_TICKS);
    const e = extent(sim, DAY0.ignite.slope.x, DAY0.ignite.slope.y);
    console.info('slope beat', e);
    expect(e.north).toBeGreaterThan(e.south + 3);
  });

  it('breaks beat: grass, then forest, and the road stops it', () => {
    const { day, land } = makeDay('day0-breaks');
    const sim = new Sim(day, land);
    sim.runTo(DAY0_SHOW_TICKS);
    let inForest = 0;
    for (let i = 0; i < N; i++) if (land.fuel[i] === Fuel.Forest && sim.state[i] >= CellState.Burning) inForest++;
    const e = extent(sim, DAY0.ignite.breaks.x, DAY0.ignite.breaks.y);
    console.info('breaks beat', { ...e, inForest, reachX: DAY0.ignite.breaks.x + e.east });
    expect(inForest).toBeGreaterThan(0);
    // Within the beat the front reaches the road...
    expect(DAY0.ignite.breaks.x + e.east).toBeGreaterThanOrEqual(DAY0.roadX - 2);
    // ...and never crosses it.
    sim.runTo(1080);
    sim.resolve();
    let beyond = 0;
    for (let i = 0; i < N; i++) if (i % W > DAY0.roadX && sim.state[i] >= CellState.Burning) beyond++;
    expect(beyond).toBe(0);
  });

  it('line beat: without a line the houses burn; the guided line saves them', () => {
    const { day, land } = makeDay('day0-line');
    const open = new Sim(day, land);
    let firstLoss = -1;
    while (open.tick < day.liveTicks && !open.contained) {
      open.advanceTick();
      if (firstLoss < 0 && open.houseLost.some((h) => h === 1)) firstLoss = open.tick;
    }
    open.resolve();
    expect(open.outcomeSide().housesStanding).toBeLessThan(2);

    // A player who draws the guide line 12 s after the start.
    const saved = new Sim(day, land);
    saved.runTo(72);
    const reply = saved.applyInput({ kind: 'dig', tick: 73, lineId: 1, cells: guideLine() });
    expect(reply.ok).toBe(true);
    while (saved.tick < day.liveTicks && !saved.contained) saved.advanceTick();
    console.info('line beat', { firstLossTick: firstLoss, containedTick: saved.tick, contained: saved.contained, dug: saved.dugCells });
    expect(saved.contained).toBe(true);
    expect(saved.outcomeSide().housesStanding).toBe(2);
    // Contained in under 90 s of fire, so Day 0 fits in 3 minutes.
    expect(saved.tick).toBeLessThan(90 * 6);
  });
});
