// Messages between the main thread and the simulation worker. Typed arrays are transferred.

import type { DayConfig, Input, InputRejection, Outcome, OutcomeSide, SimEvent, Tool, Wind, House } from '../sim/types.js';

export interface InitOptions {
  slowerFire: boolean;
  tools: Tool[];
}

export type MainToWorker =
  | { type: 'init'; dayId: string; options: InitOptions }
  | { type: 'advance'; toTick: number }
  | { type: 'input'; requestId: number; input: Input }
  | { type: 'resolve' }
  | { type: 'replay'; inputs: Input[]; toTick: number }
  | { type: 'dispose' };

export interface LandscapeTransfer {
  elevationM: Float32Array;
  fuel: Uint8Array;
  density: Uint8Array;
  baseMoisture: Uint8Array;
  houses: House[];
  town: { x: number; y: number };
}

export interface FrameMessage {
  type: 'frame';
  tick: number;
  step: number;
  /** R = fuel | state << 3, G = steps since ignition, B = wetness, A = flags. */
  stateRGBA: Uint8Array;
  burning: number;
  frontCentroid: [number, number];
  crew: { cell: number; progress: number };
  waterReadyAt: number;
  budgetLeft: number;
  wind: Wind;
  contained: boolean;
  events: SimEvent[];
}

export type WorkerToMain =
  | { type: 'ready'; day: DayConfig; landscape: LandscapeTransfer; baselinePending: true }
  | { type: 'baseline'; outcome: OutcomeSide; ignitedAt: Int32Array; burnedAt: Int32Array }
  | FrameMessage
  | { type: 'inputResult'; requestId: number; ok: boolean; reason?: InputRejection; input?: Input }
  | { type: 'outcome'; outcome: Outcome; ignitedAt: Int32Array; burnedAt: Int32Array; lineAt: Int32Array }
  | { type: 'error'; message: string };
