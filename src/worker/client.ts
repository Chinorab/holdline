// Main thread side of the simulation worker.

import type { DayConfig, Input, InputRejection, Outcome, OutcomeSide } from '../sim/types.js';
import type { FrameMessage, InitOptions, LandscapeTransfer, MainToWorker, WorkerToMain } from './protocol.js';

export interface ReadyInfo {
  day: DayConfig;
  landscape: LandscapeTransfer;
}

export interface BaselineInfo {
  outcome: OutcomeSide;
  ignitedAt: Int32Array;
  burnedAt: Int32Array;
}

export interface OutcomeInfo {
  outcome: Outcome;
  ignitedAt: Int32Array;
  burnedAt: Int32Array;
  lineAt: Int32Array;
}

export type InputReply = { ok: true; input: Input } | { ok: false; reason: InputRejection };

export class SimClient {
  onFrame: (frame: FrameMessage) => void = () => {};
  onBaseline: (baseline: BaselineInfo) => void = () => {};
  /** True while an advance is in flight: the clock never queues more than one. */
  advancing = false;

  private readonly worker: Worker;
  private ready: ((info: ReadyInfo) => void) | null = null;
  private resolved: ((info: OutcomeInfo) => void) | null = null;
  private readonly pending = new Map<number, (reply: InputReply) => void>();
  private nextRequest = 1;

  constructor() {
    this.worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerToMain>) => this.receive(event.data);
    this.worker.onerror = (event) => console.error('[holdline] simulation worker failed', event.message);
  }

  init(dayId: string, options: InitOptions): Promise<ReadyInfo> {
    return new Promise((resolve) => {
      this.ready = resolve;
      this.send({ type: 'init', dayId, options });
    });
  }

  advance(toTick: number): void {
    this.advancing = true;
    this.send({ type: 'advance', toTick });
  }

  input(input: Input): Promise<InputReply> {
    const requestId = this.nextRequest++;
    return new Promise((resolve) => {
      this.pending.set(requestId, resolve);
      this.send({ type: 'input', requestId, input });
    });
  }

  replay(inputs: Input[], toTick: number): void {
    this.advancing = true;
    this.send({ type: 'replay', inputs, toTick });
  }

  resolve(): Promise<OutcomeInfo> {
    return new Promise((resolve) => {
      this.resolved = resolve;
      this.send({ type: 'resolve' });
    });
  }

  dispose(): void {
    this.send({ type: 'dispose' });
    this.worker.terminate();
  }

  private send(message: MainToWorker): void {
    this.worker.postMessage(message);
  }

  private receive(message: WorkerToMain): void {
    switch (message.type) {
      case 'ready':
        this.ready?.({ day: message.day, landscape: message.landscape });
        this.ready = null;
        return;
      case 'baseline':
        this.onBaseline({ outcome: message.outcome, ignitedAt: message.ignitedAt, burnedAt: message.burnedAt });
        return;
      case 'frame':
        this.advancing = false;
        this.onFrame(message);
        return;
      case 'inputResult': {
        const done = this.pending.get(message.requestId);
        this.pending.delete(message.requestId);
        if (!done) return;
        if (message.ok && message.input) done({ ok: true, input: message.input });
        else done({ ok: false, reason: message.reason ?? 'invalid' });
        return;
      }
      case 'outcome':
        this.resolved?.({ outcome: message.outcome, ignitedAt: message.ignitedAt, burnedAt: message.burnedAt, lineAt: message.lineAt });
        this.resolved = null;
        return;
      case 'error':
        console.error('[holdline] simulation error', message.message);
        return;
    }
  }
}
