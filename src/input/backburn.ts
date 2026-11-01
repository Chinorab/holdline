// FIRST CUT. The backburn tool: pinch and hold 1 s on a dug line; a ring fills, then a
// controlled fire starts on the side of the line that faces the fire. Moving off the line
// or letting go early cancels it.

import type { Board } from '../render/board.js';
import type { HoldRing } from '../render/hold-ring.js';
import { H, W } from '../sim/grid.js';
import { Flag, type BackburnSide } from '../sim/types.js';
import type { StrokeTool } from './tool-system.js';

const HOLD_S = 1;
/** How far from the pinch a dug cell may be, and how far the pinch may wander, in cells. */
const SNAP_CELLS = 2;

export interface BackburnHost {
  packed(): Uint8Array | null;
  firePoint(): { x: number; y: number };
  light(cell: number, side: BackburnSide): void;
  noLine(): void;
}

const isLine = (packed: Uint8Array, x: number, y: number) =>
  x >= 0 && y >= 0 && x < W && y < H && (packed[(y * W + x) * 4 + 3] & Flag.Line) !== 0;

/** The neighbor direction across the line toward the fire (0 east, 1 near, 2 west, 3 far). */
export function backburnSide(packed: Uint8Array, cell: number, fire: { x: number; y: number }): BackburnSide {
  const x = cell % W;
  const y = (cell - x) / W;
  const dx = fire.x - x;
  const dy = fire.y - y;
  const alongX = isLine(packed, x - 1, y) || isLine(packed, x + 1, y);
  const alongY = isLine(packed, x, y - 1) || isLine(packed, x, y + 1);
  // Across the line: a line along x is crossed toward near or far, and the other way round.
  const crossY = alongX && !alongY ? true : alongY && !alongX ? false : Math.abs(dy) >= Math.abs(dx);
  if (crossY) return dy >= 0 ? 1 : 3;
  return dx >= 0 ? 0 : 2;
}

export class BackburnTool implements StrokeTool {
  private cell = -1;
  private held = 0;
  private x0 = 0;
  private y0 = 0;

  constructor(
    private readonly board: Board,
    private readonly ring: HoldRing,
    private readonly host: BackburnHost,
  ) {}

  begin(x: number, z: number): void {
    const packed = this.host.packed();
    const c = this.board.dims.cellOf(x, z);
    this.cell = packed ? this.nearestLine(packed, c.x, c.y) : -1;
    this.held = 0;
    if (this.cell < 0) {
      this.host.noLine();
      return;
    }
    this.x0 = c.x;
    this.y0 = c.y;
    const cx = this.cell % W;
    const cy = (this.cell - cx) / W;
    this.ring.show(this.board.dims.xOf(cx), this.board.cellHeight[this.cell], this.board.dims.zOf(cy));
  }

  move(x: number, z: number): void {
    if (this.cell < 0) return;
    const c = this.board.dims.cellOf(x, z);
    const dx = c.x - this.x0;
    const dy = c.y - this.y0;
    if (dx * dx + dy * dy > SNAP_CELLS * SNAP_CELLS) this.cancel();
  }

  update(dt: number): void {
    if (this.cell < 0) return;
    this.held += dt;
    this.ring.setFill(this.held / HOLD_S);
    if (this.held < HOLD_S) return;
    const packed = this.host.packed();
    const cell = this.cell;
    this.cancel();
    if (packed) this.host.light(cell, backburnSide(packed, cell, this.host.firePoint()));
  }

  end(): void {
    this.cancel();
  }

  cancel(): void {
    this.cell = -1;
    this.held = 0;
    this.ring.hide();
  }

  private nearestLine(packed: Uint8Array, fx: number, fy: number): number {
    let best = -1;
    let bestD = SNAP_CELLS * SNAP_CELLS + 1e-6;
    const x0 = Math.round(fx);
    const y0 = Math.round(fy);
    for (let y = y0 - SNAP_CELLS; y <= y0 + SNAP_CELLS; y++) {
      for (let x = x0 - SNAP_CELLS; x <= x0 + SNAP_CELLS; x++) {
        if (!isLine(packed, x, y)) continue;
        const d = (x - fx) * (x - fx) + (y - fy) * (y - fy);
        if (d < bestD) {
          bestD = d;
          best = y * W + x;
        }
      }
    }
    return best;
  }
}
