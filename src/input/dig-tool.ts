// The dig line tool: a stroke becomes a planned line, previewed against the budget, then
// handed to the crews.

import type { Board } from '../render/board.js';
import { DigStroke, MIN_LINE_CELLS } from './dig.js';
import type { StrokeTool } from './tool-system.js';

export interface DigHost {
  /** Latest packed worker state (see Sim.packState). */
  packed(): Uint8Array | null;
  budgetLeft(): number;
  /** A cell coordinate the line ticks should face. */
  firePoint(): { x: number; y: number };
  commit(cells: number[]): void;
  /** A stroke that found no budget left. */
  outOfBudget(): void;
}

export class DigTool implements StrokeTool {
  /** Cells the stroke being drawn would plan, within the budget. */
  previewCells = 0;
  private readonly stroke = new DigStroke();

  constructor(
    private readonly board: Board,
    private readonly host: DigHost,
  ) {}

  begin(x: number, z: number): void {
    this.stroke.clear();
    this.move(x, z);
  }

  move(x: number, z: number): void {
    const c = this.board.dims.cellOf(x, z);
    if (!this.board.inside(c.x, c.y) || !this.stroke.add(c.x, c.y)) return;
    const cells = this.stroke.cells(this.host.packed());
    const budget = this.host.budgetLeft();
    this.previewCells = Math.min(cells.length, budget);
    this.board.lines.setPreview(cells, budget, this.host.firePoint());
  }

  end(): void {
    const cells = this.stroke.cells(this.host.packed());
    const budget = this.host.budgetLeft();
    this.cancel();
    if (cells.length < MIN_LINE_CELLS) return;
    if (budget <= 0) {
      this.host.outOfBudget();
      return;
    }
    this.host.commit(cells.slice(0, budget));
  }

  cancel(): void {
    this.stroke.clear();
    this.previewCells = 0;
    this.board.lines.clearPreview();
  }
}
