import { describe, expect, it } from 'vitest';
import { JournalStore, better, personalBest, shelfSlots, streak, type JournalDay } from '../../src/store/journal';
import { KEYS, SafeStore } from '../../src/store/storage';
import type { OutcomeSide } from '../../src/sim/types';

const side = (housesStanding: number, burnedCells: number): OutcomeSide => ({
  housesStanding,
  housesTotal: 6,
  burnedCells,
  burnedHa: Math.round(burnedCells * 0.09),
});

function memoryBackend() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

function journalOf(daily: string[], practice: string[] = []): JournalDay[] {
  const ids = [...new Set([...daily, ...practice])];
  return ids.map((dayId) => ({
    dayId,
    daily: daily.includes(dayId) ? { side: side(3, 100), scarBits: '', playedAt: 0 } : null,
    practice: practice.includes(dayId) ? { side: side(4, 90), scarBits: '', playedAt: 0 } : null,
  }));
}

describe('streak', () => {
  it('counts consecutive dates with a daily fire, ending today or yesterday', () => {
    const days = journalOf(['2026-11-03', '2026-11-04', '2026-11-05']);
    expect(streak(days, '2026-11-05')).toBe(3);
    // Today not played yet: the streak still stands.
    expect(streak(days, '2026-11-06')).toBe(3);
    // Two days later it is broken.
    expect(streak(days, '2026-11-07')).toBe(0);
  });

  it('crosses month ends', () => {
    expect(streak(journalOf(['2026-11-29', '2026-11-30', '2026-12-01']), '2026-12-01')).toBe(3);
  });

  it('stops at a missed day', () => {
    expect(streak(journalOf(['2026-11-01', '2026-11-03', '2026-11-04']), '2026-11-04')).toBe(2);
  });

  it('practice keeps the streak as it is', () => {
    const days = journalOf(['2026-11-04', '2026-11-05'], ['2026-11-03']);
    expect(streak(days, '2026-11-05')).toBe(2);
  });

  it('ignores days after today when the clock was moved back', () => {
    const days = journalOf(['2026-11-03', '2026-11-04', '2026-11-09']);
    expect(streak(days, '2026-11-04')).toBe(2);
  });
});

describe('personal best', () => {
  it('orders by houses standing, then least burned', () => {
    expect(better(side(5, 300), side(4, 10))).toBe(true);
    expect(better(side(4, 100), side(4, 200))).toBe(true);
    expect(better(side(4, 200), side(4, 100))).toBe(false);
  });

  it('only daily fires count', () => {
    const days: JournalDay[] = [
      { dayId: '2026-11-02', daily: { side: side(3, 500), scarBits: '', playedAt: 0 }, practice: { side: side(6, 10), scarBits: '', playedAt: 0 } },
      { dayId: '2026-11-03', daily: { side: side(4, 900), scarBits: '', playedAt: 0 }, practice: null },
      { dayId: '2026-11-04', daily: { side: side(4, 400), scarBits: '', playedAt: 0 }, practice: null },
    ];
    expect(personalBest(days)?.dayId).toBe('2026-11-04');
    expect(personalBest([])).toBeNull();
  });
});

describe('shelf', () => {
  it('shows today and the days before it, with missed days, never before Day 1', () => {
    const days = journalOf(['2026-11-04'], ['2026-11-02']);
    const slots = shelfSlots(days, '2026-11-05');
    expect(slots.map((s) => s.dayId)).toEqual(['2026-11-05', '2026-11-04', '2026-11-03', '2026-11-02', '2026-11-01']);
    expect(slots.map((s) => s.state)).toEqual(['today', 'played', 'missed', 'practiced', 'missed']);
    expect(slots[1].dayNumber).toBe(4);
    expect(shelfSlots([], '2026-11-20')).toHaveLength(8);
  });
});

describe('journal store', () => {
  it('keeps the first daily fire and the best practice per date, and survives a reload', () => {
    // A second daily run of the same date counts as practice.
    const backend = memoryBackend();
    const store = new JournalStore(new SafeStore(backend));
    store.record('2026-11-04', 'daily', side(3, 400), 'a', 1);
    store.record('2026-11-04', 'daily', side(6, 10), 'b', 2);
    store.record('2026-11-04', 'practice', side(4, 300), 'c', 3);
    store.record('2026-11-04', 'practice', side(2, 900), 'd', 4);
    store.record('2026-11-03', 'practice', side(5, 50), 'e', 5);
    const again = new JournalStore(new SafeStore(backend));
    const day = again.days.find((d) => d.dayId === '2026-11-04');
    expect(day?.daily?.scarBits).toBe('a');
    expect(day?.practice?.scarBits).toBe('b');
    expect(again.hasDaily('2026-11-04')).toBe(true);
    expect(again.hasDaily('2026-11-03')).toBe(false);
    expect(again.days.map((d) => d.dayId)).toEqual(['2026-11-04', '2026-11-03']);
    expect(JSON.parse(backend.map.get(KEYS.journal) ?? '{}').version).toBe(1);
  });

  it('leaves a journal from a newer build untouched', () => {
    const backend = memoryBackend();
    backend.setItem(KEYS.journal, JSON.stringify({ version: 99, days: [] }));
    const store = new JournalStore(new SafeStore(backend));
    store.record('2026-11-04', 'daily', side(3, 400), 'a', 1);
    expect(JSON.parse(backend.map.get(KEYS.journal) ?? '{}').version).toBe(99);
  });
});
