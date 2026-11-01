import { describe, expect, it } from 'vitest';
import { seedForDay, shiftDayId } from '../../src/sim/day';
import { H, N, W } from '../../src/sim/grid';
import { hashArrays } from '../../src/sim/hash';
import { HOUSE_COUNT, generateLandscape, maxSlopeDeg } from '../../src/sim/terrain-gen';
import { Fuel } from '../../src/sim/types';

const fourAdjacent = (a: number, b: number) => {
  const ax = a % W, ay = (a - ax) / W, bx = b % W, by = (b - bx) / W;
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
};

const crossesBoard = (cells: number[]) => {
  const xs = cells.map((c) => c % W);
  const ys = cells.map((c) => Math.floor(c / W));
  const horizontal = Math.min(...xs) === 0 && Math.max(...xs) === W - 1;
  const vertical = Math.min(...ys) === 0 && Math.max(...ys) === H - 1;
  return horizontal || vertical;
};

describe('landscape generator', () => {
  it('gives the same arrays for the same seed', () => {
    const a = generateLandscape(42);
    const b = generateLandscape(42);
    expect(hashArrays(a.elevationM, a.fuel, a.density, a.baseMoisture)).toBe(
      hashArrays(b.elevationM, b.fuel, b.density, b.baseMoisture),
    );
    const c = generateLandscape(43);
    expect(hashArrays(c.elevationM)).not.toBe(hashArrays(a.elevationM));
  });

  it('keeps river and road continuous, the town whole and slopes playable over 60 dates', () => {
    for (let k = 0; k < 60; k++) {
      const land = generateLandscape(seedForDay(shiftDayId('2026-11-01', -k)));
      for (const path of [land.river, land.road]) {
        expect(crossesBoard(path)).toBe(true);
        for (let i = 1; i < path.length; i++) expect(fourAdjacent(path[i - 1], path[i])).toBe(true);
      }
      expect(land.houses).toHaveLength(HOUSE_COUNT);
      for (const house of land.houses) {
        expect(house.cells).toHaveLength(4);
        const xs = house.cells.map((c) => c % W);
        const ys = house.cells.map((c) => Math.floor(c / W));
        expect(Math.max(...xs) - Math.min(...xs)).toBe(1);
        expect(Math.max(...ys) - Math.min(...ys)).toBe(1);
        for (const c of house.cells) expect(land.fuel[c]).toBe(Fuel.Structure);
      }
      expect(maxSlopeDeg(land)).toBeLessThan(35);
      let rock = 0;
      let water = 0;
      for (let i = 0; i < N; i++) {
        if (land.fuel[i] === Fuel.Rock) rock++;
        if (land.fuel[i] === Fuel.Water) water++;
      }
      expect(rock / N).toBeLessThan(0.08);
      expect(water / N).toBeLessThan(0.06);
    }
  });
});
