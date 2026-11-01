import { describe, expect, it } from 'vitest';
import { N } from '../../src/sim/grid';
import { Sim } from '../../src/sim/sim';
import { CellState, Fuel } from '../../src/sim/types';
import { countFire, extentX, flatLand, testDay } from './helpers';

const STEPS = 30;
const run = (sim: Sim, steps: number) => sim.runTo(steps * sim.day.spreadPeriodTicks);

describe('fire spread', () => {
  it('runs faster uphill than downhill', () => {
    let up = 0;
    let down = 0;
    for (let seed = 1; seed <= 5; seed++) {
      // 8 m rise per 30 m cell toward +x: about 15 degrees.
      const sim = new Sim(testDay({ seed, windMs: 0 }), flatLand({ slopeXm: 8 }));
      run(sim, STEPS);
      const e = extentX(sim.state, 64);
      up += e.right;
      down += e.left;
    }
    expect(up).toBeGreaterThan(down * 1.5);
  });

  it('runs faster downwind than upwind on flat ground', () => {
    let downwind = 0;
    let upwind = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const sim = new Sim(testDay({ seed, windMs: 8, windDeg: 90, spotting: false }), flatLand());
      run(sim, STEPS);
      const e = extentX(sim.state, 64);
      downwind += e.right;
      upwind += e.left;
    }
    expect(downwind).toBeGreaterThan(upwind * 2);
  });

  it('catches faster in grass than in forest, and burns longer in forest', () => {
    let grassArea = 0;
    let forestArea = 0;
    const duration = (sim: Sim) => {
      let sum = 0;
      let n = 0;
      for (let i = 0; i < N; i++) {
        if (sim.state[i] === CellState.Burned && sim.burnedAt[i] >= 0) {
          sum += sim.burnedAt[i] - sim.ignitedAt[i];
          n++;
        }
      }
      return n > 0 ? sum / n : 0;
    };
    let grassDuration = 0;
    let forestDuration = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const grass = new Sim(testDay({ seed }), flatLand({ fuel: Fuel.Grass }));
      const forest = new Sim(testDay({ seed }), flatLand({ fuel: Fuel.Forest }));
      run(grass, 20);
      run(forest, 20);
      grassArea += countFire(grass.state);
      forestArea += countFire(forest.state);
      grassDuration += duration(grass);
      forestDuration += duration(forest);
    }
    expect(grassArea).toBeGreaterThan(forestArea);
    expect(forestDuration).toBeGreaterThan(grassDuration);
  });
});
