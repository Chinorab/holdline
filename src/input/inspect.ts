// Inspect: a ray or gaze resting on the same spot for 400 ms, with no stroke in progress,
// shows a small tooltip with the fuel, the slope in degrees and whether it is wet. The tooltip
// sits above the spot, nudged toward the board center, and hides as soon as a stroke starts.

import { FUEL_NAMES, INSPECT } from '../copy.js';
import type { Board } from '../render/board.js';
import { H, W, NEIGHBOR } from '../sim/grid.js';
import { slopeDegrees } from '../sim/model.js';
import type { Panel } from '../ui/panels.js';
import type { HoverListener } from './tool-system.js';

const REST_S = 0.4;
/** The pointer may wander this far (cells) and still count as resting. */
const STILL_CELLS = 1.2;

export interface InspectHost {
  packed(): Uint8Array | null;
  elevation(): Float32Array | null;
}

export class Inspect implements HoverListener {
  shownCell = -1;
  private hovering = false;
  private rest = 0;
  private hx = 0;
  private hy = 0;

  constructor(
    private readonly board: Board,
    private readonly panel: Panel,
    private readonly host: InspectHost,
  ) {}

  hover(x: number, z: number): void {
    const c = this.board.dims.cellOf(x, z);
    const dx = c.x - this.hx;
    const dy = c.y - this.hy;
    if (!this.hovering || dx * dx + dy * dy > STILL_CELLS * STILL_CELLS) {
      this.hx = c.x;
      this.hy = c.y;
      this.rest = 0;
      this.hide();
    }
    this.hovering = true;
  }

  hoverEnd(): void {
    this.hovering = false;
    this.hide();
  }

  /** dt counts only while the board takes input; a stroke hides the tooltip. */
  update(dt: number, stroking: boolean): void {
    if (stroking) {
      this.hovering = false;
      this.hide();
      return;
    }
    if (!this.hovering || this.shownCell >= 0) return;
    this.rest += dt;
    if (this.rest >= REST_S) this.show();
  }

  private show(): void {
    const cx = Math.min(W - 1, Math.max(0, Math.round(this.hx)));
    const cy = Math.min(H - 1, Math.max(0, Math.round(this.hy)));
    const cell = cy * W + cx;
    const packed = this.host.packed();
    const elevation = this.host.elevation();
    if (!packed || !elevation) return;
    let slope = 0;
    for (let d = 0; d < 8; d++) {
      const j = NEIGHBOR[cell * 8 + d];
      if (j >= 0) slope = Math.max(slope, Math.abs(slopeDegrees(elevation[cell], elevation[j], d)));
    }
    const wet = packed[cell * 4 + 2] > 0;
    this.panel.setText('inspect-fuel', FUEL_NAMES[packed[cell * 4] & 7]);
    this.panel.setText('inspect-slope', INSPECT.slope(slope));
    this.panel.setText('inspect-wet', INSPECT.wet);
    this.panel.setProps('inspect-wet', { display: wet ? 'flex' : 'none' });
    const d = this.board.dims;
    const x = d.xOf(cx);
    const z = d.zOf(cy);
    // Above the spot, a third of the way toward the board center.
    this.panel.place(x * 0.67, this.board.cellHeight[cell] + 0.035, z * 0.67 + 0.01, -0.55);
    this.panel.show(true);
    this.shownCell = cell;
  }

  private hide(): void {
    if (this.shownCell < 0) return;
    this.shownCell = -1;
    this.panel.show(false);
  }
}
