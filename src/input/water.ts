// The water drop tool: look or point, pinch on the start of the strip, drag to set its
// direction (with gaze, the drag follows the pinching hand), release to call the aircraft.
// Without a drag, the strip lies across the wind, where it slows a front the most.

import type { Board } from '../render/board.js';
import type { WaterPreview } from '../render/aircraft.js';
import { bearingDeg } from '../sim/day.js';
import { W } from '../sim/grid.js';
import type { StrokeTool } from './tool-system.js';

/** A drag shorter than this (cells) keeps the default direction. */
const MIN_DRAG_CELLS = 1.5;

export interface WaterHost {
  /** Seconds until the next drop is allowed (0 when ready). */
  cooldownLeft(): number;
  windDeg(): number;
  drop(startCell: number, dirDeg: number): void;
  notReady(secondsLeft: number): void;
}

export class WaterTool implements StrokeTool {
  private startX = 0;
  private startY = 0;
  private startCell = -1;
  private dirDeg = 0;

  constructor(
    private readonly board: Board,
    private readonly preview: WaterPreview,
    private readonly host: WaterHost,
  ) {}

  begin(x: number, z: number): void {
    const left = this.host.cooldownLeft();
    if (left > 0) {
      this.startCell = -1;
      this.host.notReady(left);
      return;
    }
    const c = this.board.dims.cellOf(x, z);
    if (!this.board.inside(c.x, c.y)) return;
    this.startX = Math.round(c.x);
    this.startY = Math.round(c.y);
    this.startCell = this.startY * W + this.startX;
    this.dirDeg = (this.host.windDeg() + 90) % 360;
    this.preview.show(this.startCell, this.dirDeg);
  }

  move(x: number, z: number): void {
    if (this.startCell < 0) return;
    const c = this.board.dims.cellOf(x, z);
    const dx = c.x - this.startX;
    const dy = c.y - this.startY;
    if (dx * dx + dy * dy < MIN_DRAG_CELLS * MIN_DRAG_CELLS) return;
    this.dirDeg = Math.round(bearingDeg(this.startX, this.startY, c.x, c.y));
    this.preview.show(this.startCell, this.dirDeg);
  }

  end(): void {
    const cell = this.startCell;
    this.cancel();
    if (cell >= 0) this.host.drop(cell, this.dirDeg);
  }

  cancel(): void {
    this.startCell = -1;
    this.preview.hide();
  }
}
