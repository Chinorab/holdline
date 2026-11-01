// Whole runs: the no action baseline, replays from recorded inputs, and the outcome.

import { RESOLVE_CAP_STEPS, Sim, scarBits, type SimOptions } from './sim.js';
import type { DayConfig, Input, Landscape, Outcome, OutcomeSide } from './types.js';

export interface FinishedRun {
  sim: Sim;
  side: OutcomeSide;
  endTick: number;
  resolvedByFastForward: boolean;
}

/** Play a day to its end: live time (or until the fire is out), then the fast forward. */
export function playOut(day: DayConfig, land: Landscape, inputs: readonly Input[] = [], options: SimOptions = {}): FinishedRun {
  const sim = new Sim(day, land, options);
  const cursor = { next: 0 };
  while (sim.tick < day.liveTicks && !sim.contained) sim.runTo(sim.tick + 1, inputs, cursor);
  const resolvedByFastForward = sim.contained ? false : sim.resolve(RESOLVE_CAP_STEPS);
  return { sim, side: sim.outcomeSide(), endTick: sim.tick, resolvedByFastForward };
}

export function runBaseline(day: DayConfig, land: Landscape, options: SimOptions = {}): FinishedRun {
  return playOut(day, land, [], options);
}

export function makeOutcome(player: FinishedRun, baseline: OutcomeSide): Outcome {
  return {
    player: player.side,
    baseline,
    scarBits: scarBits(player.sim.state),
    endTick: player.endTick,
    resolvedByFastForward: player.resolvedByFastForward,
  };
}
