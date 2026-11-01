import { describe, expect, it } from 'vitest';
import { rand01 } from '../../src/sim/rng';

describe('counter based RNG', () => {
  it('is a pure function of its keys', () => {
    expect(rand01(1, 2, 3, 4)).toBe(rand01(1, 2, 3, 4));
    expect(rand01(1, 2, 3, 4)).not.toBe(rand01(1, 2, 3, 5));
  });

  it('is uniform on [0, 1)', () => {
    const bins = new Array(10).fill(0);
    const n = 100000;
    for (let k = 0; k < n; k++) {
      const v = rand01(12345, k >> 8, k & 255, 1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      bins[Math.floor(v * 10)]++;
    }
    const expected = n / 10;
    const chi2 = bins.reduce((sum, b) => sum + ((b - expected) * (b - expected)) / expected, 0);
    expect(chi2).toBeLessThan(30); // 9 degrees of freedom
  });

  it('gives independent draws for neighboring keys, steps and channels', () => {
    const correlation = (f: (k: number) => [number, number]) => {
      let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
      const n = 50000;
      for (let k = 0; k < n; k++) {
        const [x, y] = f(k);
        sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
      }
      const cov = sxy / n - (sx / n) * (sy / n);
      return cov / Math.sqrt((sxx / n - (sx / n) ** 2) * (syy / n - (sy / n) ** 2));
    };
    expect(Math.abs(correlation((k) => [rand01(9, 1, k, 1), rand01(9, 1, k + 1, 1)]))).toBeLessThan(0.02);
    expect(Math.abs(correlation((k) => [rand01(9, k, 5, 1), rand01(9, k + 1, 5, 1)]))).toBeLessThan(0.02);
    expect(Math.abs(correlation((k) => [rand01(9, 3, k, 1), rand01(9, 3, k, 2)]))).toBeLessThan(0.02);
    expect(Math.abs(correlation((k) => [rand01(k, 3, 7, 1), rand01(k + 1, 3, 7, 1)]))).toBeLessThan(0.02);
  });
});
