// A dig stroke: board points under the hand or ray, turned into cells for the crews.
// Cells come out 4 connected (see lineCells) so an 8 neighbor fire cannot slip between
// two diagonal cells, in the order they were drawn, which is the order the crews dig.

import { N } from '../sim/grid.js';
import { lineCells } from '../sim/inputs.js';
import { CellState, Flag, Fuel } from '../sim/types.js';

/** Shortest stroke that becomes a line, in cells (shorter is a stray pinch). */
export const MIN_LINE_CELLS = 2;
/** New point once the stroke moved this far, in cells. */
const STEP_CELLS = 0.35;

/** Can the crews plan this cell? From the packed worker state (see Sim.packState). */
export function diggable(packed: Uint8Array | null, cell: number): boolean {
  if (!packed || cell < 0 || cell >= N) return false;
  const r = packed[cell * 4];
  const fuel = r & 7;
  const state = r >> 3;
  return state === CellState.Fuel && fuel !== Fuel.Structure && (packed[cell * 4 + 3] & Flag.Planned) === 0;
}

export class DigStroke {
  private readonly points: { x: number; y: number }[] = [];
  private lastX = 0;
  private lastY = 0;

  get length(): number {
    return this.points.length;
  }

  clear(): void {
    this.points.length = 0;
  }

  /**
   * Add a board point in cell units (cell centers at integers, as BoardDims.cellOf gives).
   * Returns true when the stroke grew.
   */
  add(cellX: number, cellY: number): boolean {
    const x = cellX + 0.5;
    const y = cellY + 0.5;
    if (this.points.length > 0) {
      const dx = x - this.lastX;
      const dy = y - this.lastY;
      if (dx * dx + dy * dy < STEP_CELLS * STEP_CELLS) return false;
    }
    this.points.push({ x, y });
    this.lastX = x;
    this.lastY = y;
    return true;
  }

  /** Cells along the stroke the crews can dig, in drawing order. */
  cells(packed: Uint8Array | null): number[] {
    if (this.points.length === 0) return [];
    return lineCells(this.points).filter((c) => diggable(packed, c));
  }
}
