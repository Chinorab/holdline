// Terraced heightfield: 256 by 160 quads (two per cell side), heights snapped to paper
// layers, plus side walls that show the stacked paper section. One geometry, one draw.

import { BufferAttribute, BufferGeometry } from '@iwsdk/core';
import { H, W } from '../sim/grid.js';
import type { BoardDims } from './dims.js';

export const VX = W * 2 + 1;
export const VZ = H * 2 + 1;

/** Elevation at a fractional cell center coordinate, bilinear, clamped to the board. */
function sampleElevation(elevation: Float32Array, cx: number, cy: number): number {
  const x = Math.min(W - 1, Math.max(0, cx));
  const y = Math.min(H - 1, Math.max(0, cy));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(W - 1, x0 + 1);
  const y1 = Math.min(H - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const a = elevation[y0 * W + x0] * (1 - tx) + elevation[y0 * W + x1] * tx;
  const b = elevation[y1 * W + x0] * (1 - tx) + elevation[y1 * W + x1] * tx;
  return a * (1 - ty) + b * ty;
}

export interface TerrainBuild {
  geometry: BufferGeometry;
  /** Board height of the terrain top at each cell center. */
  cellHeight: Float32Array;
  maxHeight: number;
}

export function buildTerrain(elevation: Float32Array, dims: BoardDims): TerrainBuild {
  const surfaceCount = VX * VZ;
  const edgeCount = 2 * (VX + VZ) - 4;
  const vertexCount = surfaceCount + edgeCount * 2;
  const position = new Float32Array(vertexCount * 3);
  const uv = new Float32Array(vertexCount * 2);
  const layer = new Float32Array(vertexCount);
  const kind = new Float32Array(vertexCount);
  let maxHeight = 0;

  for (let vz = 0; vz < VZ; vz++) {
    for (let vx = 0; vx < VX; vx++) {
      const v = vz * VX + vx;
      const e = sampleElevation(elevation, vx / 2 - 0.5, vz / 2 - 0.5);
      const l = dims.layerOf(e);
      const y = dims.heightOfLayer(l);
      maxHeight = Math.max(maxHeight, y);
      position[v * 3] = (vx / (VX - 1) - 0.5) * dims.widthM;
      position[v * 3 + 1] = y;
      position[v * 3 + 2] = (vz / (VZ - 1) - 0.5) * dims.depthM;
      uv[v * 2] = vx / (VX - 1);
      uv[v * 2 + 1] = vz / (VZ - 1);
      layer[v] = l;
    }
  }

  // A cell whose nine vertices sit on one paper layer is a single quad; cells with a
  // riser keep their four quads. Shared edges stay collinear, so no cracks open.
  const index: number[] = [];
  for (let cy = 0; cy < H; cy++) {
    for (let cx = 0; cx < W; cx++) {
      const v0 = cy * 2 * VX + cx * 2;
      const y0 = position[v0 * 3 + 1];
      let flat = true;
      for (let dz = 0; dz <= 2 && flat; dz++) {
        for (let dx = 0; dx <= 2; dx++) {
          if (position[(v0 + dz * VX + dx) * 3 + 1] !== y0) {
            flat = false;
            break;
          }
        }
      }
      if (flat) {
        const a = v0;
        const b = v0 + 2;
        const c = v0 + 2 * VX;
        const d = c + 2;
        index.push(a, c, b, b, c, d);
        continue;
      }
      for (let qz = 0; qz < 2; qz++) {
        for (let qx = 0; qx < 2; qx++) {
          const a = v0 + qz * VX + qx;
          const b = a + 1;
          const c = a + VX;
          const d = c + 1;
          index.push(a, c, b, b, c, d);
        }
      }
    }
  }

  // Side walls: walk the border clockwise seen from above; each top vertex gets a twin on
  // the table (y = 0).
  const border: number[] = [];
  for (let vx = 0; vx < VX; vx++) border.push(vx); // far edge, left to right
  for (let vz = 1; vz < VZ; vz++) border.push(vz * VX + VX - 1); // right edge
  for (let vx = VX - 2; vx >= 0; vx--) border.push((VZ - 1) * VX + vx); // near edge
  for (let vz = VZ - 2; vz >= 1; vz--) border.push(vz * VX); // left edge
  let next = surfaceCount;
  const top: number[] = [];
  const bottom: number[] = [];
  for (const v of border) {
    const t = next++;
    const b = next++;
    for (let k = 0; k < 3; k++) position[t * 3 + k] = position[v * 3 + k];
    position[b * 3] = position[v * 3];
    position[b * 3 + 1] = 0;
    position[b * 3 + 2] = position[v * 3 + 2];
    uv[t * 2] = uv[b * 2] = uv[v * 2];
    uv[t * 2 + 1] = uv[b * 2 + 1] = uv[v * 2 + 1];
    layer[t] = layer[b] = layer[v];
    kind[t] = kind[b] = 1;
    top.push(t);
    bottom.push(b);
  }
  for (let k = 0; k < border.length; k++) {
    const k1 = (k + 1) % border.length;
    index.push(top[k], top[k1], bottom[k], bottom[k], top[k1], bottom[k1]);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
  geometry.setAttribute('aLayer', new BufferAttribute(layer, 1));
  geometry.setAttribute('aKind', new BufferAttribute(kind, 1));
  geometry.setIndex(index);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const cellHeight = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = (y * 2 + 1) * VX + (x * 2 + 1);
      cellHeight[y * W + x] = position[v * 3 + 1];
    }
  }
  return { geometry, cellHeight, maxHeight };
}
