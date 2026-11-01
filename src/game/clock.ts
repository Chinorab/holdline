// Today's date for the daily fire. Development builds let the emulator gate set another
// date (window.__holdlineToday, or localStorage holdline.dev.today, as YYYY-MM-DD);
// production always uses the device date.

import { localDayId } from '../sim/day.js';

export function todayId(): string {
  if (import.meta.env.DEV) {
    let stored: string | null = null;
    try {
      stored = globalThis.localStorage?.getItem('holdline.dev.today') ?? null;
    } catch {
      stored = null;
    }
    const forced = (globalThis as unknown as { __holdlineToday?: string }).__holdlineToday ?? stored;
    if (forced && /^\d{4}-\d{2}-\d{2}$/u.test(forced)) return forced;
  }
  return localDayId(new Date());
}
