// Deterministic transcendental functions built only from IEEE 754 basic operations
// (+, -, *, /, Math.round, Math.floor), which every JavaScript engine evaluates bit for bit
// the same way. Math.exp, Math.atan and Math.cos may differ in the last bit between
// engines, so the fire model never calls them.

export const PI = 3.141592653589793;
export const HALF_PI = 1.5707963267948966;
export const TWO_PI = 6.283185307179586;
export const DEG = 0.017453292519943295; // pi / 180
export const RAD_TO_DEG = 57.29577951308232; // 180 / pi

const LN2_HI = 6.93147180369123816490e-1; // fdlibm split of ln 2
const LN2_LO = 1.90821492927058770002e-10;
const INV_LN2 = 1.44269504088896338700;

/** 2^k as an exact power of two, by repeated squaring. */
function pow2(k: number): number {
  let result = 1;
  let base = 2;
  let n = k < 0 ? -k : k;
  while (n > 0) {
    if (n & 1) result *= base;
    base *= base;
    n >>= 1;
  }
  return result;
}

export function dexp(x: number): number {
  if (x !== x) return NaN;
  if (x > 709) return Infinity;
  if (x < -745) return 0;
  const k = Math.round(x * INV_LN2);
  const r = x - k * LN2_HI - k * LN2_LO; // |r| <= ln2 / 2
  // Taylor series of exp(r) to r^14 in Horner form; truncation error below 1e-17.
  const p =
    1 +
    r *
      (1 +
        r *
          (1 / 2 +
            r *
              (1 / 6 +
                r *
                  (1 / 24 +
                    r *
                      (1 / 120 +
                        r *
                          (1 / 720 +
                            r *
                              (1 / 5040 +
                                r *
                                  (1 / 40320 +
                                    r *
                                      (1 / 362880 +
                                        r *
                                          (1 / 3628800 +
                                            r *
                                              (1 / 39916800 +
                                                r * (1 / 479001600 + r * (1 / 6227020800 + r * (1 / 87178291200))))))))))))));
  const scale = pow2(k);
  return k >= 0 ? p * scale : p / scale;
}

const SQRT3 = 1.7320508075688772;
const PI_6 = 0.5235987755982988;
const TAN_PI_12 = 0.2679491924311227;

export function datan(x: number): number {
  if (x !== x) return NaN;
  let sign = 1;
  if (x < 0) {
    sign = -1;
    x = -x;
  }
  if (x === Infinity) return sign * HALF_PI;
  let inverted = false;
  if (x > 1) {
    x = 1 / x;
    inverted = true;
  }
  let offset = 0;
  if (x > TAN_PI_12) {
    x = (x * SQRT3 - 1) / (x + SQRT3);
    offset = PI_6;
  }
  // |x| <= tan(pi / 12): alternating series to x^29.
  const x2 = x * x;
  const s =
    x *
    (1 -
      x2 *
        (1 / 3 -
          x2 *
            (1 / 5 -
              x2 *
                (1 / 7 -
                  x2 *
                    (1 / 9 -
                      x2 *
                        (1 / 11 -
                          x2 *
                            (1 / 13 -
                              x2 *
                                (1 / 15 -
                                  x2 *
                                    (1 / 17 -
                                      x2 * (1 / 19 - x2 * (1 / 21 - x2 * (1 / 23 - x2 * (1 / 25 - x2 * (1 / 27 - x2 / 29))))))))))))));
  let r = offset + s;
  if (inverted) r = HALF_PI - r;
  return sign * r;
}

/** atan2(y, x) in radians, in (-pi, pi]. */
export function datan2(y: number, x: number): number {
  if (x > 0) return datan(y / x);
  if (x < 0) return y >= 0 ? datan(y / x) + PI : datan(y / x) - PI;
  if (y > 0) return HALF_PI;
  if (y < 0) return -HALF_PI;
  return 0;
}

const PIO2_1 = 1.57079632673412561417; // fdlibm split of pi / 2
const PIO2_1T = 6.07710050650619224932e-11;

function cosKernel(r: number): number {
  const r2 = r * r;
  return (
    1 -
    r2 *
      (1 / 2 -
        r2 *
          (1 / 24 -
            r2 *
              (1 / 720 -
                r2 *
                  (1 / 40320 -
                    r2 *
                      (1 / 3628800 -
                        r2 * (1 / 479001600 - r2 * (1 / 87178291200 - r2 * (1 / 20922789888000 - r2 / 6402373705728000))))))))
  );
}

function sinKernel(r: number): number {
  const r2 = r * r;
  return (
    r *
    (1 -
      r2 *
        (1 / 6 -
          r2 *
            (1 / 120 -
              r2 *
                (1 / 5040 -
                  r2 *
                    (1 / 362880 -
                      r2 *
                        (1 / 39916800 -
                          r2 * (1 / 6227020800 - r2 * (1 / 1307674368000 - r2 * (1 / 355687428096000 - r2 / 121645100408832000)))))))))
  );
}

function reduce(x: number): { r: number; q: number } {
  const n = Math.round(x / HALF_PI);
  const r = x - n * PIO2_1 - n * PIO2_1T;
  const q = ((n % 4) + 4) % 4;
  return { r, q };
}

export function dcos(x: number): number {
  const { r, q } = reduce(x);
  if (q === 0) return cosKernel(r);
  if (q === 1) return -sinKernel(r);
  if (q === 2) return -cosKernel(r);
  return sinKernel(r);
}

export function dsin(x: number): number {
  const { r, q } = reduce(x);
  if (q === 0) return sinKernel(r);
  if (q === 1) return cosKernel(r);
  if (q === 2) return -sinKernel(r);
  return -cosKernel(r);
}
