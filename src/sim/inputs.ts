// Player inputs: geometry helpers shared by the game (previews) and the simulation.

import { DEG, dcos, dsin } from './detmath.js';
import { H, W, cellIndex, inBounds } from './grid.js';

export const WATER_LENGTH_CELLS = 24;
export const WATER_WIDTH_CELLS = 3;

/** Cells under a water drop: a strip from startCell along dirDeg (compass degrees). */
export function waterStripCells(startCell: number, dirDeg: number, lengthCells: number, widthCells: number): number[] {
  const sx = startCell % W;
  const sy = (startCell - sx) / W;
  const r = dirDeg * DEG;
  const ux = dsin(r);
  const uy = -dcos(r);
  const px = -uy; // perpendicular
  const py = ux;
  const half = (widthCells - 1) / 2;
  const seen = new Set<number>();
  const cells: number[] = [];
  for (let t = 0; t <= (lengthCells - 1) * 2; t++) {
    const along = t / 2;
    for (let w = 0; w <= (widthCells - 1) * 2; w++) {
      const across = w / 2 - half;
      const x = Math.round(sx + ux * along + px * across);
      const y = Math.round(sy + uy * along + py * across);
      if (!inBounds(x, y)) continue;
      const c = cellIndex(x, y);
      if (!seen.has(c)) {
        seen.add(c);
        cells.push(c);
      }
    }
  }
  return cells;
}

/**
 * Cells along a polyline of board points (in cell units), 4 connected so that an 8
 * neighbor fire cannot cross diagonally between two line cells.
 */
export function lineCells(points: { x: number; y: number }[]): number[] {
  const cells: number[] = [];
  const seen = new Set<number>();
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const c = cellIndex(x, y);
    if (seen.has(c)) return;
    seen.add(c);
    cells.push(c);
  };
  let px = Math.floor(points[0]?.x ?? 0);
  let py = Math.floor(points[0]?.y ?? 0);
  if (points.length > 0) push(px, py);
  for (let k = 1; k < points.length; k++) {
    const tx = Math.floor(points[k].x);
    const ty = Math.floor(points[k].y);
    // Walk cell by cell with 4 connected moves (supercover style).
    let guard = 0;
    while ((px !== tx || py !== ty) && guard++ < 512) {
      const dx = tx - px;
      const dy = ty - py;
      if (Math.abs(dx) >= Math.abs(dy)) px += Math.sign(dx);
      else py += Math.sign(dy);
      push(px, py);
    }
  }
  return cells;
}
