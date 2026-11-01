// Counter based random numbers: every draw is a pure function of (seed, step, key,
// channel). The player run and the no action run therefore draw the same number for the
// same event, whatever else happened before it ("same fire, same luck").

/** Integer finalizer (lowbias32): a bijection on 32 bit values with good avalanche. */
export function mix32(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

export function hash4(a: number, b: number, c: number, d: number): number {
  let h = mix32((a ^ 0x9e3779b9) >>> 0);
  h = mix32((h + Math.imul(b | 0, 0x85ebca6b)) >>> 0);
  h = mix32((h ^ Math.imul(c | 0, 0xc2b2ae35)) >>> 0);
  h = mix32((h + Math.imul(d | 0, 0x27d4eb2f)) >>> 0);
  return h;
}

/** Uniform number in [0, 1). */
export function rand01(seed: number, step: number, key: number, channel: number): number {
  return hash4(seed, step, key, channel) / 4294967296;
}

/** Random channels, one per kind of chance event. */
export const Channel = {
  Spread: 1,
  EmberEmit: 2,
  EmberDistance: 3,
  EmberSide: 4,
  EmberLand: 5,
  Noise: 10,
  Terrain: 11,
  Town: 12,
  Day: 13,
  Placement: 14,
} as const;
