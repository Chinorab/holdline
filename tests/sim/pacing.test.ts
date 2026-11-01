import { describe, expect, it } from 'vitest';
import { makeDay, shiftDayId } from '../../src/sim/day';
import { N } from '../../src/sim/grid';
import { Sim } from '../../src/sim/sim';

// Game pacing over 60 dates with no player action: the fire should usually reach the town,
// but not before the player has had time to act.
describe('pacing of the no action fire', () => {
  it('reaches the town on most days, after a playable delay', () => {
    const rows: { day: string; firstLossStep: number; lost: number; burnedPct: number; burningAtEnd: number; wind: number }[] = [];
    for (let k = 0; k < 60; k++) {
      const dayId = shiftDayId('2026-11-01', -k);
      const { day, land } = makeDay(dayId);
      const sim = new Sim(day, land);
      let firstLossStep = -1;
      while (sim.tick < day.liveTicks && !sim.contained) {
        sim.advanceTick();
        for (const e of sim.takeEvents()) if (e.type === 'houseLost' && firstLossStep < 0) firstLossStep = e.step;
      }
      const burningAtEnd = sim.burningCount;
      sim.resolve();
      for (const e of sim.takeEvents()) if (e.type === 'houseLost' && firstLossStep < 0) firstLossStep = e.step;
      const side = sim.outcomeSide();
      rows.push({ day: dayId, firstLossStep, lost: side.housesTotal - side.housesStanding, burnedPct: Math.round((100 * side.burnedCells) / N), burningAtEnd, wind: day.wind.speedMs });
    }
    const withLoss = rows.filter((r) => r.lost > 0);
    const firstLoss = withLoss.map((r) => r.firstLossStep).sort((a, b) => a - b);
    const burned = rows.map((r) => r.burnedPct).sort((a, b) => a - b);
    const median = (v: number[]) => v[Math.floor(v.length / 2)] ?? -1;
    const summary = {
      daysWithLoss: withLoss.length,
      medianFirstLossStep: median(firstLoss),
      p10FirstLoss: firstLoss[Math.floor(firstLoss.length * 0.1)],
      medianBurnedPct: median(burned),
      p90Burned: burned[Math.floor(burned.length * 0.9)],
      stillBurningAtEnd: rows.filter((r) => r.burningAtEnd > 0).length,
    };
    console.log(JSON.stringify(summary));
    if (process.env.PACING_ROWS) console.table(rows);
    expect(withLoss.length).toBeGreaterThanOrEqual(42);
    expect(summary.medianFirstLossStep).toBeGreaterThanOrEqual(45);
    expect(summary.medianFirstLossStep).toBeLessThanOrEqual(150);
  });
});
