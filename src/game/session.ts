// One run of a fire day on the main thread: owns the clock (unpaused frame time to ticks),
// sends inputs to the worker, records what it accepts and keeps the run saved.

import { TICK_HZ } from '../sim/day.js';
import type { DayConfig, Input, RunKind } from '../sim/types.js';
import type { ProgressStore } from '../store/progress.js';
import { SimClient, type BaselineInfo, type InputReply, type OutcomeInfo, type ReadyInfo } from '../worker/client.js';
import type { FrameMessage } from '../worker/protocol.js';

/** Longest frame the clock accepts, so a hitch never jumps the fire forward. */
const MAX_FRAME_S = 0.25;
const SAVE_EVERY_S = 5;

export class Session {
  readonly client = new SimClient();
  day: DayConfig | null = null;
  ready: ReadyInfo | null = null;
  baseline: BaselineInfo | null = null;
  outcome: OutcomeInfo | null = null;
  frame: FrameMessage | null = null;
  readonly inputs: Input[] = [];
  /** Last tick the worker reached. */
  tick = 0;
  running = false;
  paused = false;
  resolving = false;

  onFrame: (frame: FrameMessage) => void = () => {};
  onBaseline: (baseline: BaselineInfo) => void = () => {};
  onOutcome: (outcome: OutcomeInfo) => void = () => {};

  private liveSeconds = 0;
  private sinceSave = 0;

  constructor(
    private readonly store: ProgressStore,
    readonly dayId: string,
    readonly kind: RunKind,
    readonly runId: string,
  ) {
    this.client.onFrame = (frame) => {
      this.frame = frame;
      this.tick = frame.tick;
      this.onFrame(frame);
    };
    this.client.onBaseline = (baseline) => {
      this.baseline = baseline;
      this.onBaseline(baseline);
    };
  }

  async start(): Promise<ReadyInfo> {
    const ready = await this.client.init(this.dayId, {
      slowerFire: this.store.settings.slowerFire,
      tools: ['dig'],
    });
    this.ready = ready;
    this.day = ready.day;
    return ready;
  }

  /** Seconds of live time left. */
  get secondsLeft(): number {
    return this.day ? Math.max(0, (this.day.liveTicks - this.tick) / TICK_HZ) : 0;
  }

  beginLive(): void {
    this.running = true;
    this.paused = false;
    this.persist();
  }

  pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    void this.sendInput({ kind: 'pause', tick: 0 });
  }

  resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    void this.sendInput({ kind: 'resume', tick: 0 });
  }

  update(dt: number): void {
    if (!this.running || this.paused || this.resolving || !this.day) return;
    this.liveSeconds += Math.min(dt, MAX_FRAME_S);
    const target = Math.min(this.day.liveTicks, Math.floor(this.liveSeconds * TICK_HZ));
    if (target > this.tick && !this.client.advancing) this.client.advance(target);
    this.sinceSave += dt;
    if (this.sinceSave >= SAVE_EVERY_S) this.persist();
    if (this.tick >= this.day.liveTicks || this.frame?.contained) void this.finish();
  }

  /** Send an input; the worker stamps its tick. Accepted inputs are recorded and saved. */
  async sendInput(input: Input): Promise<InputReply> {
    const reply = await this.client.input(input);
    if (reply.ok) {
      this.inputs.push(reply.input);
      this.persist();
    }
    return reply;
  }

  private async finish(): Promise<void> {
    if (this.resolving) return;
    this.resolving = true;
    const info = await this.client.resolve();
    this.outcome = info;
    this.running = false;
    this.store.clearRun();
    this.onOutcome(info);
  }

  persist(): void {
    this.sinceSave = 0;
    if (this.outcome) return;
    this.store.saveRun({
      version: 1,
      runId: this.runId,
      dayId: this.dayId,
      kind: this.kind,
      settings: { slowerFire: this.store.settings.slowerFire },
      inputs: this.inputs,
      status: 'in_progress',
      pausedAtTick: this.tick,
    });
  }

  dispose(): void {
    this.client.dispose();
  }
}
