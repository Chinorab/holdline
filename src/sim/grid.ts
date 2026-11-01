// The board grid: 128 by 80 cells of 30 m. Index i = y * W + x, y = 0 at the far edge.

export const W = 128;
export const H = 80;
export const N = W * H;
export const CELL_M = 30;
export const HA_PER_CELL = 0.09;
export const SQRT2 = 1.4142135623730951;

/** Neighbor offsets, d = 0..7: E, NE, N, NW, W, SW, S, SE (N is toward the far edge). */
export const NB_DX = Int8Array.of(1, 1, 0, -1, -1, -1, 0, 1);
export const NB_DY = Int8Array.of(0, -1, -1, -1, 0, 1, 1, 1);
export const NB_DIST = Float64Array.of(1, SQRT2, 1, SQRT2, 1, SQRT2, 1, SQRT2);

export const cellX = (i: number): number => i % W;
export const cellY = (i: number): number => (i - (i % W)) / W;
export const cellIndex = (x: number, y: number): number => y * W + x;
export const inBounds = (x: number, y: number): boolean => x >= 0 && x < W && y >= 0 && y < H;

/** NEIGHBOR[i * 8 + d] is the neighbor cell index, or -1 off the board. */
export const NEIGHBOR: Int32Array = (() => {
  const table = new Int32Array(N * 8);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      for (let d = 0; d < 8; d++) {
        const nx = x + NB_DX[d];
        const ny = y + NB_DY[d];
        table[i * 8 + d] = inBounds(nx, ny) ? ny * W + nx : -1;
      }
    }
  }
  return table;
})();

/** Unit vector of a compass direction in grid coordinates (x right, y toward the player). */
export function compassVector(dirDeg: number, cosFn: (r: number) => number, sinFn: (r: number) => number) {
  const r = dirDeg * 0.017453292519943295;
  return { x: sinFn(r), y: -cosFn(r) };
}
