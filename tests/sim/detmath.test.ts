import { describe, expect, it } from 'vitest';
import { datan, datan2, dcos, dexp, dsin } from '../../src/sim/detmath';

const samples = (from: number, to: number, count: number) =>
  Array.from({ length: count }, (_, k) => from + ((to - from) * k) / (count - 1) + 1e-7 * k);

describe('detmath', () => {
  it('exp matches Math.exp within 1e-12 relative error', () => {
    for (const x of samples(-30, 30, 4001)) {
      const want = Math.exp(x);
      expect(Math.abs(dexp(x) - want) / want).toBeLessThan(1e-12);
    }
    expect(dexp(0)).toBe(1);
  });

  it('atan and atan2 match Math within 1e-13', () => {
    for (const x of samples(-80, 80, 4001)) expect(Math.abs(datan(x) - Math.atan(x))).toBeLessThan(1e-13);
    for (const [y, x] of [[1, 1], [1, -1], [-1, -1], [-1, 1], [0, -2], [3, 0], [-3, 0], [0.2, 5]]) {
      expect(Math.abs(datan2(y, x) - Math.atan2(y, x))).toBeLessThan(1e-13);
    }
  });

  it('cos and sin match Math within 1e-13', () => {
    for (const x of samples(-20, 20, 4001)) {
      expect(Math.abs(dcos(x) - Math.cos(x))).toBeLessThan(1e-13);
      expect(Math.abs(dsin(x) - Math.sin(x))).toBeLessThan(1e-13);
    }
  });

  it('is stable across calls', () => {
    for (const x of [0.1, -2.5, 7.75, 1e-9]) {
      expect(Object.is(dexp(x), dexp(x))).toBe(true);
      expect(Object.is(datan(x), datan(x))).toBe(true);
      expect(Object.is(dcos(x), dcos(x))).toBe(true);
    }
  });
});
