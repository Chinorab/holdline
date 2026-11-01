// The journal: one entry per date played, on this device only. A date keeps its first
// completed daily fire and the best practice run. The streak counts consecutive dates with a
// daily fire, ending today or yesterday; the personal best is the daily fire with the most
// houses standing, then the least area burned.

import { dayNumber, shiftDayId } from '../sim/day.js';
import type { OutcomeSide } from '../sim/types.js';
import { CURRENT_VERSION, migrate } from './migrations.js';
import { KEYS, type SafeStore } from './storage.js';

export interface DayRecord {
  side: OutcomeSide;
  /** Burned cells as a base64 bitset (see scarBits in src/sim/sim.ts). */
  scarBits: string;
  playedAt: number;
}

export interface JournalDay {
  dayId: string;
  daily: DayRecord | null;
  practice: DayRecord | null;
}

export interface Journal {
  version: number;
  days: JournalDay[];
}

/** Dates kept on the device, newest first. */
export const JOURNAL_KEEP_DAYS = 120;
/** The shelf shows today and the seven days before it (dates from Day 1 on). */
export const SHELF_DAYS = 8;

export type SlotState = 'today' | 'played' | 'practiced' | 'missed';

export interface Slot {
  dayId: string;
  dayNumber: number;
  state: SlotState;
  /** The run the tile shows: the daily fire, else the best practice. */
  record: DayRecord | null;
}

/** Is `a` a better result than `b`? More houses standing, then fewer cells burned. */
export function better(a: OutcomeSide, b: OutcomeSide): boolean {
  if (a.housesStanding !== b.housesStanding) return a.housesStanding > b.housesStanding;
  return a.burnedCells < b.burnedCells;
}

export function streak(days: readonly JournalDay[], today: string): number {
  const daily = new Set(days.filter((d) => d.daily).map((d) => d.dayId));
  // A streak still counts on a day not played yet: it ends today or yesterday.
  let d = daily.has(today) ? today : shiftDayId(today, 1);
  let n = 0;
  while (daily.has(d)) {
    n++;
    d = shiftDayId(d, 1);
  }
  return n;
}

export function personalBest(days: readonly JournalDay[]): { dayId: string; side: OutcomeSide } | null {
  let best: { dayId: string; side: OutcomeSide } | null = null;
  for (const d of days) {
    if (!d.daily) continue;
    if (!best || better(d.daily.side, best.side)) best = { dayId: d.dayId, side: d.daily.side };
  }
  return best;
}

/** Today first, then the days before it, never before Day 1. */
export function shelfSlots(days: readonly JournalDay[], today: string, count = SHELF_DAYS): Slot[] {
  const byId = new Map(days.map((d) => [d.dayId, d]));
  const slots: Slot[] = [];
  for (let k = 0; k < count; k++) {
    const dayId = shiftDayId(today, k);
    const n = dayNumber(dayId);
    if (n < 1) break;
    const entry = byId.get(dayId);
    const state: SlotState = entry?.daily ? 'played' : entry?.practice ? 'practiced' : k === 0 ? 'today' : 'missed';
    slots.push({ dayId, dayNumber: n, state, record: entry?.daily ?? entry?.practice ?? null });
  }
  return slots;
}

const isJournal = (v: unknown): v is Journal =>
  !!v && typeof v === 'object' && Array.isArray((v as Journal).days);

export class JournalStore {
  days: JournalDay[];
  private readonly writable: boolean;

  constructor(private readonly store: SafeStore) {
    const result = migrate(store.readJson(KEYS.journal), isJournal);
    this.days = result.kind === 'ok' ? result.value.days : [];
    // A journal written by a newer build is left as it is.
    this.writable = result.kind !== 'future';
  }

  hasDaily(dayId: string): boolean {
    return this.days.some((d) => d.dayId === dayId && d.daily);
  }

  /** Record a finished fire under the date it started on. */
  record(dayId: string, kind: 'daily' | 'practice', side: OutcomeSide, scarBits: string, playedAt: number): void {
    let entry = this.days.find((d) => d.dayId === dayId);
    if (!entry) {
      entry = { dayId, daily: null, practice: null };
      this.days.push(entry);
    }
    const run: DayRecord = { side, scarBits, playedAt };
    if (kind === 'daily' && !entry.daily) entry.daily = run;
    else if (!entry.practice || better(side, entry.practice.side)) entry.practice = run;
    this.days.sort((a, b) => (a.dayId < b.dayId ? 1 : a.dayId > b.dayId ? -1 : 0));
    if (this.days.length > JOURNAL_KEEP_DAYS) this.days.length = JOURNAL_KEEP_DAYS;
    if (this.writable) this.store.writeJson(KEYS.journal, { version: CURRENT_VERSION, days: this.days } satisfies Journal);
  }
}
