// The fire simulation. Owned by the worker in the game, run directly by the tests.
//
// Time: 6 ticks per second of unpaused play. Inputs, crews, wind shifts and wetness work
// per tick; the fire spreads once every spreadPeriodTicks (one step per second, or every
// 1.5 s with Slower fire). Each spread step is synchronous: new ignitions come from the
// state before the step, then burning cells burn down, then the new fires start.

import { DEG, dcos, dsin } from './detmath.js';
import { HA_PER_CELL, N, NEIGHBOR, W, cellIndex, inBounds } from './grid.js';
import { hashArrays } from './hash.js';
import { waterStripCells } from './inputs.js';
import { PAPER, TUNING, fuelFactor, isBurnableFuel, moistureFactor, slopeFactor, windFactors } from './model.js';
import { Channel, rand01 } from './rng.js';
import {
  CellState,
  Flag,
  Fuel,
  type DayConfig,
  type Input,
  type InputRejection,
  type Landscape,
  type OutcomeSide,
  type SimEvent,
  type Wind,
} from './types.js';

export interface SimOptions {
  /** Embers that jump breaks. On by default; tests turn it off. */
  spotting?: boolean;
}

export type InputResult = { ok: true; input: Input } | { ok: false; reason: InputRejection };

export const RESOLVE_CAP_STEPS = 600;

export class Sim {
  readonly day: DayConfig;
  readonly land: Landscape;
  readonly spotting: boolean;

  tick = 0;
  step = 0;
  readonly state = new Uint8Array(N);
  readonly burnLeft = new Uint8Array(N);
  readonly ignitedAt = new Int32Array(N).fill(-1);
  readonly burnedAt = new Int32Array(N).fill(-1);
  readonly lineAt = new Int32Array(N).fill(-1);
  readonly wetUntil = new Int32Array(N).fill(-1);
  readonly flags = new Uint8Array(N);

  burningCount = 0;
  contained = false;
  budgetUsed = 0;
  dugCells = 0;
  waterReadyAt = 0;
  crewCell = -1;
  crewProgress = 0;
  readonly crewQueue: number[] = [];
  readonly events: SimEvent[] = [];
  readonly houseOf = new Int16Array(N).fill(-1);
  readonly houseLost: Uint8Array;

  private wind: Wind;
  private windX = 0;
  private windY = 0;
  private nextShift = 0;
  private readonly windF = new Float64Array(8);
  private readonly slopeF = new Float64Array(N * 8);
  private readonly fuelF = new Float64Array(N);
  private readonly moistF = new Float64Array(N);
  private burnList = new Int32Array(N);
  private nextList = new Int32Array(N);
  private burnListLen = 0;
  private readonly mark = new Uint8Array(N);
  private readonly marked = new Int32Array(N);
  private markedLen = 0;

  constructor(day: DayConfig, land: Landscape, options: SimOptions = {}) {
    this.day = day;
    this.land = land;
    this.spotting = (options.spotting ?? true) && day.spotting;
    const { fuel, density, elevationM, baseMoisture } = land;
    for (let i = 0; i < N; i++) {
      this.state[i] = isBurnableFuel(fuel[i]) ? CellState.Fuel : CellState.Unburnable;
      this.fuelF[i] = fuelFactor(fuel[i], density[i]);
      this.moistF[i] = moistureFactor(baseMoisture[i]);
      for (let d = 0; d < 8; d++) {
        const j = NEIGHBOR[i * 8 + d];
        this.slopeF[i * 8 + d] = j < 0 ? 0 : slopeFactor(elevationM[i], elevationM[j], d);
      }
    }
    this.houseLost = new Uint8Array(land.houses.length);
    for (const house of land.houses) for (const c of house.cells) this.houseOf[c] = house.id;
    this.wind = day.wind;
    this.setWind(day.wind);
    for (const ignition of day.ignition) {
      if (ignition.step === 0 && this.igniteNow(ignition.cell, 0)) {
        this.burnList[this.burnListLen++] = ignition.cell;
        this.events.push({ type: 'ignite', tick: 0, step: 0, cell: ignition.cell });
      }
    }
  }

  get currentWind(): Wind {
    return this.wind;
  }

  /** Cells the crews may still plan, given the day's budget. */
  get budgetLeft(): number {
    return this.day.crewBudgetCells - this.budgetUsed;
  }

  /** Validate and apply an input. Its tick must be the next tick (this.tick + 1). */
  applyInput(input: Input): InputResult {
    if (input.tick !== this.tick + 1) return { ok: false, reason: 'invalid' };
    switch (input.kind) {
      case 'pause':
      case 'resume':
        return { ok: true, input };
      case 'dig':
        return this.applyDig(input);
      case 'water':
        return this.applyWater(input);
      case 'backburn':
        // Backburn arrives in slice c (first cut); until then it is locked.
        return { ok: false, reason: this.day.tools.includes('backburn') ? 'invalid' : 'locked' };
    }
  }

  private applyDig(input: Extract<Input, { kind: 'dig' }>): InputResult {
    if (!this.day.tools.includes('dig')) return { ok: false, reason: 'locked' };
    const accepted: number[] = [];
    for (const c of input.cells) {
      if (!Number.isInteger(c) || c < 0 || c >= N) return { ok: false, reason: 'invalid' };
      if (this.state[c] !== CellState.Fuel || this.flags[c] & Flag.Planned) continue;
      if (this.land.fuel[c] === Fuel.Structure) continue;
      accepted.push(c);
    }
    if (accepted.length === 0) return { ok: false, reason: 'invalid' };
    if (accepted.length > this.budgetLeft) return { ok: false, reason: 'budget' };
    for (const c of accepted) {
      this.flags[c] |= Flag.Planned;
      this.crewQueue.push(c);
    }
    this.budgetUsed += accepted.length;
    return { ok: true, input: { ...input, cells: accepted } };
  }

  private applyWater(input: Extract<Input, { kind: 'water' }>): InputResult {
    if (!this.day.tools.includes('water')) return { ok: false, reason: 'locked' };
    if (input.tick < this.waterReadyAt) return { ok: false, reason: 'cooldown' };
    if (!Number.isInteger(input.startCell) || input.startCell < 0 || input.startCell >= N) {
      return { ok: false, reason: 'invalid' };
    }
    const cells = waterStripCells(input.startCell, input.dirDeg, input.lengthCells, input.widthCells);
    for (const c of cells) {
      if (this.state[c] === CellState.Burning) {
        this.state[c] = CellState.Burned;
        this.burnedAt[c] = this.step;
        this.burnLeft[c] = 0;
        this.flags[c] |= Flag.Doused;
        this.burningCount--;
      }
      if (this.state[c] === CellState.Fuel || this.flags[c] & Flag.Doused) {
        this.wetUntil[c] = input.tick + TUNING.wetTicks;
      }
    }
    this.waterReadyAt = input.tick + TUNING.waterCooldownTicks;
    this.events.push({ type: 'water', tick: input.tick, cells: cells.length });
    this.checkContained();
    return { ok: true, input };
  }

  /** Advance one tick. */
  advanceTick(): void {
    const t = ++this.tick;
    this.updateWind(t);
    this.crewWork(t);
    if (t % this.day.spreadPeriodTicks === 0) this.spreadStep(t);
  }

  /** Advance to a tick, applying recorded inputs at the start of their ticks. */
  runTo(toTick: number, inputs: readonly Input[] = [], cursor = { next: 0 }): void {
    while (this.tick < toTick) {
      // Inputs apply at the start of their tick, in recorded order; stale ones are skipped.
      while (cursor.next < inputs.length && inputs[cursor.next].tick <= this.tick + 1) {
        if (inputs[cursor.next].tick === this.tick + 1) this.applyInput(inputs[cursor.next]);
        cursor.next++;
      }
      this.advanceTick();
    }
  }

  /** Time is up: crews stop, the fire runs until it is out or the cap is reached. */
  resolve(capSteps = RESOLVE_CAP_STEPS): boolean {
    this.crewQueue.length = 0;
    this.crewCell = -1;
    const startStep = this.step;
    while (this.burningCount > 0 && this.step - startStep < capSteps) this.advanceTick();
    return this.step > startStep;
  }

  private setWind(wind: Wind): void {
    this.wind = wind;
    windFactors(wind.speedMs, wind.dirDeg, this.windF);
    const r = wind.dirDeg * DEG;
    this.windX = dsin(r);
    this.windY = -dcos(r);
  }

  private updateWind(t: number): void {
    const shifts = this.day.windShifts;
    for (const shift of shifts) {
      if (shift.announceTick === t) {
        this.events.push({ type: 'windShiftAnnounce', tick: t, dirDeg: shift.dirDeg, speedMs: shift.speedMs, atTick: shift.tick });
      }
    }
    while (this.nextShift < shifts.length && shifts[this.nextShift].tick <= t) {
      const shift = shifts[this.nextShift++];
      this.setWind({ speedMs: shift.speedMs, dirDeg: shift.dirDeg });
      this.events.push({ type: 'windShift', tick: t, dirDeg: shift.dirDeg, speedMs: shift.speedMs });
    }
  }

  private crewWork(t: number): void {
    if (this.crewCell < 0) {
      const next = this.crewQueue.shift();
      if (next === undefined) return;
      this.crewCell = next;
      this.crewProgress = 0;
    }
    this.crewProgress++;
    if (this.crewProgress < TUNING.crewTicksPerCell) return;
    const c = this.crewCell;
    this.crewCell = -1;
    this.flags[c] &= ~Flag.Planned;
    if (this.state[c] === CellState.Fuel) {
      this.state[c] = CellState.Unburnable;
      this.lineAt[c] = t;
      this.flags[c] |= Flag.Line;
      this.dugCells++;
      this.events.push({ type: 'dug', tick: t, cell: c });
    }
  }

  private markCell(j: number, bit: number): void {
    if (this.mark[j] === 0) this.marked[this.markedLen++] = j;
    this.mark[j] |= bit;
  }

  private igniteNow(c: number, step: number, flagBits = 0): boolean {
    if (this.state[c] !== CellState.Fuel) return false;
    this.state[c] = CellState.Burning;
    this.burnLeft[c] = Math.max(1, TUNING.burnSteps[this.land.fuel[c]]);
    this.ignitedAt[c] = step;
    this.flags[c] |= flagBits;
    this.burningCount++;
    const house = this.houseOf[c];
    if (house >= 0 && this.houseLost[house] === 0) {
      this.houseLost[house] = 1;
      this.events.push({ type: 'houseLost', tick: this.tick, step, house });
    }
    return true;
  }

  private spreadStep(t: number): void {
    const s = ++this.step;
    const seed = this.day.seed;
    const scale = TUNING.spreadScale * PAPER.pH;
    const ember = TUNING.ember;
    const emberStrength = this.spotting && this.wind.speedMs >= ember.minWindMs ? (this.wind.speedMs - 5) / 7 : 0;
    this.markedLen = 0;

    // 1. Ignition attempts from every burning cell, on the state before this step.
    for (let k = 0; k < this.burnListLen; k++) {
      const i = this.burnList[k];
      if (this.state[i] !== CellState.Burning) continue;
      for (let d = 0; d < 8; d++) {
        const j = NEIGHBOR[i * 8 + d];
        if (j < 0 || this.state[j] !== CellState.Fuel) continue;
        let p = scale * this.fuelF[j] * this.windF[d] * this.slopeF[i * 8 + d] * this.moistF[j];
        if (this.wetUntil[j] > t) p *= TUNING.wetFactor;
        if (p >= 1 || rand01(seed, s, i * 8 + d, Channel.Spread) < p) this.markCell(j, 1);
      }
      if (emberStrength > 0) {
        const rate = ember.rate[this.land.fuel[i]];
        if (rate > 0 && rand01(seed, s, i, Channel.EmberEmit) < rate * emberStrength) {
          const span = ember.maxCells - ember.minCells + 1;
          const dist = ember.minCells + Math.floor(rand01(seed, s, i, Channel.EmberDistance) * span);
          const side = Math.floor(rand01(seed, s, i, Channel.EmberSide) * 3) - 1;
          const x = i % W;
          const y = (i - x) / W;
          const tx = Math.round(x + this.windX * dist - this.windY * side);
          const ty = Math.round(y + this.windY * dist + this.windX * side);
          if (inBounds(tx, ty)) {
            const j = cellIndex(tx, ty);
            if (this.state[j] === CellState.Fuel) {
              let p = ember.land * this.moistF[j];
              if (this.wetUntil[j] > t) p *= TUNING.wetFactor;
              if (rand01(seed, s, i, Channel.EmberLand) < p) this.markCell(j, 2);
            }
          }
        }
      }
    }

    // 2. Burning cells burn down.
    let keep = 0;
    for (let k = 0; k < this.burnListLen; k++) {
      const i = this.burnList[k];
      if (this.state[i] !== CellState.Burning) continue;
      this.burnLeft[i] -= 1;
      if (this.burnLeft[i] === 0) {
        this.state[i] = CellState.Burned;
        this.burnedAt[i] = s;
        this.burningCount--;
      } else {
        this.nextList[keep++] = i;
      }
    }

    // 3. New fires start.
    for (let k = 0; k < this.markedLen; k++) {
      const j = this.marked[k];
      const m = this.mark[j];
      this.mark[j] = 0;
      const spotted = (m & 1) === 0;
      if (this.igniteNow(j, s, spotted ? Flag.Spotted : 0)) {
        this.nextList[keep++] = j;
        if (spotted) this.events.push({ type: 'ember', tick: t, step: s, cell: j });
      }
    }
    for (const ignition of this.day.ignition) {
      if (ignition.step === s && this.igniteNow(ignition.cell, s)) {
        this.nextList[keep++] = ignition.cell;
        this.events.push({ type: 'ignite', tick: t, step: s, cell: ignition.cell });
      }
    }

    const swap = this.burnList;
    this.burnList = this.nextList;
    this.nextList = swap;
    this.burnListLen = keep;
    this.checkContained();
  }

  private checkContained(): void {
    if (this.burningCount === 0 && !this.contained) {
      this.contained = true;
      this.events.push({ type: 'contained', tick: this.tick, step: this.step });
    }
  }

  /** Fingerprint of the whole fire state. */
  hash(): number {
    const header = Int32Array.of(this.tick, this.step, this.burningCount, this.budgetUsed, this.waterReadyAt, this.crewCell);
    return hashArrays(header, this.state, this.burnLeft, this.ignitedAt, this.burnedAt, this.lineAt, this.wetUntil, this.flags);
  }

  /** Burning cells as a list (for visuals). */
  burningCells(out: Int32Array): number {
    let n = 0;
    for (let k = 0; k < this.burnListLen; k++) {
      const i = this.burnList[k];
      if (this.state[i] === CellState.Burning) out[n++] = i;
    }
    return n;
  }

  /**
   * Pack the state for the renderer: R = fuel | state << 3, G = steps since ignition,
   * B = wetness 0..255, A = flags.
   */
  packState(out: Uint8Array): void {
    const t = this.tick;
    const s = this.step;
    const fuel = this.land.fuel;
    for (let i = 0; i < N; i++) {
      const o = i * 4;
      const st = this.state[i];
      out[o] = fuel[i] | (st << 3);
      out[o + 1] = this.ignitedAt[i] >= 0 ? Math.min(255, s - this.ignitedAt[i]) : 0;
      const wet = this.wetUntil[i] - t;
      out[o + 2] = wet > 0 ? Math.min(255, Math.round((255 * wet) / TUNING.wetTicks)) : 0;
      out[o + 3] = this.flags[i];
    }
  }

  outcomeSide(): OutcomeSide {
    let burnedCells = 0;
    for (let i = 0; i < N; i++) {
      if (this.state[i] === CellState.Burned || this.state[i] === CellState.Burning) burnedCells++;
    }
    let lost = 0;
    for (let h = 0; h < this.houseLost.length; h++) lost += this.houseLost[h];
    const housesTotal = this.land.houses.length;
    return {
      housesStanding: housesTotal - lost,
      housesTotal,
      burnedCells,
      burnedHa: Math.round(burnedCells * HA_PER_CELL),
    };
  }

  /** Drain the events collected since the last call. */
  takeEvents(): SimEvent[] {
    return this.events.splice(0, this.events.length);
  }
}

/** Bitset of burned cells as base64 (1280 bytes before encoding). */
export function scarBits(state: Uint8Array): string {
  const bytes = new Uint8Array(N / 8);
  for (let i = 0; i < N; i++) {
    if (state[i] === CellState.Burned || state[i] === CellState.Burning) bytes[i >> 3] |= 1 << (i & 7);
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function scarFromBits(bits: string): Uint8Array {
  const binary = atob(bits);
  const burned = new Uint8Array(N);
  for (let i = 0; i < N; i++) burned[i] = (binary.charCodeAt(i >> 3) >> (i & 7)) & 1;
  return burned;
}
