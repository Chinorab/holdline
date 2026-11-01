import { describe, expect, it } from 'vitest';
import { bearingDeg, dayNumber, localDayId, makeDay, shiftDayId } from '../../src/sim/day';
import { W } from '../../src/sim/grid';

describe('day configuration', () => {
  it('numbers days from Day 1 on 2026-11-01', () => {
    expect(dayNumber('2026-11-01')).toBe(1);
    expect(dayNumber('2026-11-02')).toBe(2);
    expect(dayNumber('2026-11-18')).toBe(18);
    expect(dayNumber('2026-10-31')).toBe(0);
    expect(dayNumber('2027-03-01')).toBe(121);
  });

  it('uses the device local date and shifts days', () => {
    expect(localDayId(new Date(2026, 10, 1, 23, 59))).toBe('2026-11-01');
    expect(localDayId(new Date(2026, 0, 9, 0, 1))).toBe('2026-01-09');
    expect(shiftDayId('2026-11-01', 1)).toBe('2026-10-31');
    expect(shiftDayId('2026-12-31', -1)).toBe('2027-01-01');
  });

  it('builds the same day for the same date, within the documented ranges', () => {
    expect(JSON.stringify(makeDay('2026-11-05').day)).toBe(JSON.stringify(makeDay('2026-11-05').day));
    for (let k = 0; k < 40; k++) {
      const dayId = shiftDayId('2026-11-01', -k);
      const { day, land } = makeDay(dayId);
      expect(day.wind.speedMs).toBeGreaterThanOrEqual(2);
      expect(day.wind.speedMs).toBeLessThanOrEqual(12);
      expect(day.crewBudgetCells).toBeGreaterThanOrEqual(40);
      expect(day.crewBudgetCells).toBeLessThanOrEqual(80);
      expect(day.spreadPeriodTicks).toBe(6);
      expect(day.windShifts.length).toBeLessThanOrEqual(2);
      for (const shift of day.windShifts) expect(shift.tick - shift.announceTick).toBe(48);
      const c = day.ignition[0].cell;
      const ix = c % W;
      const iy = Math.floor(c / W);
      const dist = Math.hypot(ix - land.town.x, iy - land.town.y);
      expect(dist).toBeGreaterThan(20);
      const toward = bearingDeg(ix, iy, land.town.x, land.town.y);
      const diff = Math.abs(((day.wind.dirDeg - toward + 540) % 360) - 180);
      expect(diff).toBeLessThanOrEqual(25.5);
    }
    expect(makeDay('2026-11-05', { slowerFire: true }).day.spreadPeriodTicks).toBe(9);
  });
});
