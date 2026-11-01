/// <reference lib="webworker" />
// The fire runs here. The worker never reads the clock: the main thread asks it to advance
// to a tick, so pausing is simply the absence of advance messages.

import { makeDay } from '../sim/day.js';
import { N, W } from '../sim/grid.js';
import { makeOutcome, runBaseline } from '../sim/outcome.js';
import { Sim } from '../sim/sim.js';
import type { DayConfig, Landscape, OutcomeSide } from '../sim/types.js';
import type { FrameMessage, MainToWorker, WorkerToMain } from './protocol.js';

declare const self: DedicatedWorkerGlobalScope;

let day: DayConfig | null = null;
let land: Landscape | null = null;
let sim: Sim | null = null;
let baseline: OutcomeSide | null = null;
const burningScratch = new Int32Array(N);

const post = (message: WorkerToMain, transfer: Transferable[] = []) => self.postMessage(message, transfer);

function frame(): FrameMessage {
  const s = sim as Sim;
  const stateRGBA = new Uint8Array(N * 4);
  s.packState(stateRGBA);
  const count = s.burningCells(burningScratch);
  let cx = 0;
  let cy = 0;
  for (let k = 0; k < count; k++) {
    const c = burningScratch[k];
    cx += c % W;
    cy += Math.floor(c / W);
  }
  return {
    type: 'frame',
    tick: s.tick,
    step: s.step,
    stateRGBA,
    burning: count,
    frontCentroid: count > 0 ? [cx / count, cy / count] : [-1, -1],
    crew: { cell: s.crewCell, progress: s.crewProgress },
    waterReadyAt: s.waterReadyAt,
    budgetLeft: s.budgetLeft,
    wind: s.currentWind,
    contained: s.contained,
    events: s.takeEvents(),
  };
}

function postFrame(): void {
  const f = frame();
  post(f, [f.stateRGBA.buffer]);
}

function handle(message: MainToWorker): void {
  switch (message.type) {
    case 'init': {
      const made = makeDay(message.dayId, { slowerFire: message.options.slowerFire, tools: message.options.tools });
      day = made.day;
      land = made.land;
      sim = new Sim(day, land);
      baseline = null;
      post({
        type: 'ready',
        day,
        landscape: {
          elevationM: land.elevationM.slice(),
          fuel: land.fuel.slice(),
          density: land.density.slice(),
          baseMoisture: land.baseMoisture.slice(),
          houses: land.houses,
          town: land.town,
        },
        baselinePending: true,
      });
      postFrame();
      // The same day with the same luck and no action, computed while the player reads
      // the brief.
      const run = runBaseline(day, land);
      baseline = run.side;
      const ignitedAt = run.sim.ignitedAt.slice();
      const burnedAt = run.sim.burnedAt.slice();
      post({ type: 'baseline', outcome: baseline, ignitedAt, burnedAt }, [ignitedAt.buffer, burnedAt.buffer]);
      return;
    }
    case 'advance': {
      if (!sim || !day) return;
      const target = Math.min(message.toTick, day.liveTicks);
      while (sim.tick < target && !sim.contained) sim.advanceTick();
      postFrame();
      return;
    }
    case 'input': {
      if (!sim) return;
      const stamped = { ...message.input, tick: sim.tick + 1 };
      const result = sim.applyInput(stamped);
      if (result.ok) post({ type: 'inputResult', requestId: message.requestId, ok: true, input: result.input });
      else post({ type: 'inputResult', requestId: message.requestId, ok: false, reason: result.reason });
      postFrame();
      return;
    }
    case 'resolve': {
      if (!sim || !day || !land) return;
      const resolvedByFastForward = sim.contained ? false : sim.resolve();
      const side = sim.outcomeSide();
      const outcome = makeOutcome({ sim, side, endTick: sim.tick, resolvedByFastForward }, baseline ?? runBaseline(day, land).side);
      postFrame();
      const ignitedAt = sim.ignitedAt.slice();
      const burnedAt = sim.burnedAt.slice();
      const lineAt = sim.lineAt.slice();
      post({ type: 'outcome', outcome, ignitedAt, burnedAt, lineAt }, [ignitedAt.buffer, burnedAt.buffer, lineAt.buffer]);
      return;
    }
    case 'replay': {
      if (!day || !land) return;
      sim = new Sim(day, land);
      sim.runTo(Math.min(message.toTick, day.liveTicks), message.inputs);
      sim.takeEvents();
      postFrame();
      return;
    }
    case 'dispose':
      sim = null;
      land = null;
      day = null;
      self.close();
      return;
  }
}

self.onmessage = (event: MessageEvent<MainToWorker>) => {
  try {
    handle(event.data);
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
