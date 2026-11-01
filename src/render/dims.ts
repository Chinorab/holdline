// Board dimensions: the 3.84 by 2.40 km map at about 1:6900 on a 56 by 35 cm board, relief
// as stacked paper layers of 20 m with a slight vertical exaggeration.

import { CELL_M, H, W } from '../sim/grid.js';

export const DEFAULT_BOARD_WIDTH_M = 0.56;
export const VERTICAL_EXAGGERATION = 1.2;
export const LAYER_M_ELEVATION = 20;
export const PLINTH_M = 0.012;

export class BoardDims {
  readonly widthM: number;
  readonly depthM: number;
  /** Board meters per landscape meter, horizontally. */
  readonly scale: number;
  /** Thickness of one paper layer on the board. */
  readonly layerM: number;
  readonly plinthM = PLINTH_M;

  constructor(widthM = DEFAULT_BOARD_WIDTH_M) {
    this.widthM = widthM;
    this.depthM = (widthM * H) / W;
    this.scale = widthM / (W * CELL_M);
    this.layerM = LAYER_M_ELEVATION * this.scale * VERTICAL_EXAGGERATION;
  }

  /** Paper layer index of an elevation. */
  layerOf(elevationM: number): number {
    return Math.floor(elevationM / LAYER_M_ELEVATION);
  }

  /** Board height (above the table) of the top of a layer. */
  heightOfLayer(layer: number): number {
    return this.plinthM + layer * this.layerM;
  }

  /** Board local x of a cell column center (or any fractional cell coordinate). */
  xOf(cellX: number): number {
    return ((cellX + 0.5) / W - 0.5) * this.widthM;
  }

  /** Board local z of a cell row center; row 0 is the far edge (negative z). */
  zOf(cellY: number): number {
    return ((cellY + 0.5) / H - 0.5) * this.depthM;
  }

  /** Fractional cell coordinates of a board local point. */
  cellOf(x: number, z: number): { x: number; y: number } {
    return { x: (x / this.widthM + 0.5) * W - 0.5, y: (z / this.depthM + 0.5) * H - 0.5 };
  }
}
