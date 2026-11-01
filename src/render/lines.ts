// Crew lines on the board: dashed while planned, solid ink once dug, with short ticks on the
// side that faces the fire. A light casing keeps the ink readable on dark forest. Lines draw
// over the trees like pencil on a map (no depth test), so a plan through forest stays
// visible. All committed lines share one preallocated mesh; the line being drawn has its own.

import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, ShaderMaterial } from '@iwsdk/core';
import { H, N, W } from '../sim/grid.js';
import { Flag } from '../sim/types.js';
import type { BoardDims } from './dims.js';
import { color } from './palette.js';

const HALF_WIDTH_M = 0.0021;
const LIFT_M = 0.0016;
const TICK_EVERY_M = 0.009;
const TICK_LENGTH_M = 0.0024;
const TICK_HALF_WIDTH_M = 0.0006;
const MAX_VERTS = 12288;
const PREVIEW_VERTS = 4096;

const vertexShader = /* glsl */ `
attribute float aK;
attribute float aArc;
attribute float aAcross;
attribute float aTick;
attribute float aDug;
varying float vK;
varying float vArc;
varying float vAcross;
varying float vTick;
varying float vDug;
void main() {
  vK = aK;
  vArc = aArc;
  vAcross = aAcross;
  vTick = aTick;
  vDug = aDug;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uGraphite;
uniform vec3 uPaper;
uniform vec3 uFire;
uniform float uOver;
varying float vK;
varying float vArc;
varying float vAcross;
varying float vTick;
varying float vDug;
void main() {
  bool dug = vDug > 0.5;
  if (vTick > 0.5 && !dug) discard;
  bool casing = abs(vAcross) > 0.5;
  vec3 c = casing ? uPaper : uInk;
  if (!dug && vTick < 0.5) {
    if (fract(vArc / 0.007) > 0.6) discard;
    if (!casing) c = uGraphite;
  }
  if (vK >= uOver && !casing) c = uFire;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;

function makeMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uInk: { value: color('ink') },
      uGraphite: { value: color('graphite') },
      uPaper: { value: color('road') },
      uFire: { value: color('fire') },
      uOver: { value: 1e9 },
    },
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
  });
}

class RibbonBuffer {
  readonly geometry = new BufferGeometry();
  readonly position: Float32Array;
  readonly k: Float32Array;
  readonly arc: Float32Array;
  readonly across: Float32Array;
  readonly tick: Float32Array;
  readonly dug: Float32Array;
  readonly index: Uint32Array;
  verts = 0;
  indices = 0;

  constructor(readonly capacity: number) {
    this.position = new Float32Array(capacity * 3);
    this.k = new Float32Array(capacity);
    this.arc = new Float32Array(capacity);
    this.across = new Float32Array(capacity);
    this.tick = new Float32Array(capacity);
    this.dug = new Float32Array(capacity);
    this.index = new Uint32Array(capacity * 2);
    this.geometry.setAttribute('position', new BufferAttribute(this.position, 3));
    this.geometry.setAttribute('aK', new BufferAttribute(this.k, 1));
    this.geometry.setAttribute('aArc', new BufferAttribute(this.arc, 1));
    this.geometry.setAttribute('aAcross', new BufferAttribute(this.across, 1));
    this.geometry.setAttribute('aTick', new BufferAttribute(this.tick, 1));
    this.geometry.setAttribute('aDug', new BufferAttribute(this.dug, 1));
    this.geometry.setIndex(new BufferAttribute(this.index, 1));
    this.geometry.setDrawRange(0, 0);
  }

  reset(): void {
    this.verts = 0;
    this.indices = 0;
    this.geometry.setDrawRange(0, 0);
  }

  vertex(x: number, y: number, z: number, k: number, arc: number, across: number, tick: number): number {
    const v = this.verts++;
    this.position[v * 3] = x;
    this.position[v * 3 + 1] = y;
    this.position[v * 3 + 2] = z;
    this.k[v] = k;
    this.arc[v] = arc;
    this.across[v] = across;
    this.tick[v] = tick;
    this.dug[v] = 0;
    return v;
  }

  quad(a: number, b: number, c: number, d: number): void {
    const i = this.index;
    i[this.indices++] = a;
    i[this.indices++] = b;
    i[this.indices++] = c;
    i[this.indices++] = b;
    i[this.indices++] = d;
    i[this.indices++] = c;
  }

  commit(): void {
    const g = this.geometry;
    for (const name of ['position', 'aK', 'aArc', 'aAcross', 'aTick', 'aDug']) {
      (g.getAttribute(name) as BufferAttribute).needsUpdate = true;
    }
    (g.getIndex() as BufferAttribute).needsUpdate = true;
    g.setDrawRange(0, this.indices);
    g.computeBoundingSphere();
  }
}

interface LineRecord {
  cells: number[];
  fire: { x: number; y: number };
  firstVert: number;
  vertCount: number;
  /** Cells from the start already dug (or given up because they burned). */
  prefix: number;
}

export class Lines {
  readonly root = new Group();
  private readonly committed = new RibbonBuffer(MAX_VERTS);
  private readonly preview = new RibbonBuffer(PREVIEW_VERTS);
  private readonly previewMaterial = makeMaterial();
  private readonly lines: LineRecord[] = [];
  private readonly pts: number[] = [];
  private readonly tmp: number[] = [];
  private widthScale = 1;

  constructor(
    private readonly dims: BoardDims,
    private readonly heightOf: () => Float32Array,
  ) {
    this.root.name = 'Lines';
    const lines = new Mesh(this.committed.geometry, makeMaterial());
    lines.name = 'CrewLines';
    lines.frustumCulled = false;
    lines.renderOrder = 2;
    const preview = new Mesh(this.preview.geometry, this.previewMaterial);
    preview.name = 'LinePreview';
    preview.frustumCulled = false;
    preview.renderOrder = 2;
    this.root.add(lines, preview);
  }

  /** High contrast: lines twice as wide; existing lines are rebuilt. */
  setWidthScale(scale: number): void {
    if (scale === this.widthScale) return;
    this.widthScale = scale;
    const old = this.lines.splice(0, this.lines.length);
    this.committed.reset();
    for (const line of old) {
      const first = this.committed.verts;
      if (!this.build(this.committed, line.cells, line.fire)) continue;
      const record = { ...line, firstVert: first, vertCount: this.committed.verts - first };
      for (let v = first; v < first + record.vertCount; v++) this.committed.dug[v] = this.committed.k[v] < record.prefix - 0.5 ? 1 : 0;
      this.lines.push(record);
    }
    this.committed.commit();
  }

  clear(): void {
    this.lines.length = 0;
    this.committed.reset();
    this.preview.reset();
  }

  /** A line the crews accepted, in dig order. `fire` is a cell coordinate the ticks face. */
  add(cells: number[], fire: { x: number; y: number }): void {
    const first = this.committed.verts;
    if (!this.build(this.committed, cells, fire)) return;
    this.lines.push({ cells, fire, firstVert: first, vertCount: this.committed.verts - first, prefix: 0 });
    this.committed.commit();
  }

  /** The line under the hand: dashed, cells from `budget` on in fire color. */
  setPreview(cells: number[], budget: number, fire: { x: number; y: number }): void {
    this.preview.reset();
    this.previewMaterial.uniforms.uOver.value = budget;
    if (cells.length > 0 && this.build(this.preview, cells, fire)) this.preview.commit();
  }

  clearPreview(): void {
    this.preview.reset();
  }

  /** Follow the crews: flags from the packed worker state (A channel). */
  applyFlags(packed: Uint8Array): void {
    let changed = false;
    for (const line of this.lines) {
      let prefix = line.prefix;
      while (prefix < line.cells.length && (packed[line.cells[prefix] * 4 + 3] & Flag.Planned) === 0) prefix++;
      if (prefix === line.prefix) continue;
      line.prefix = prefix;
      changed = true;
      const end = line.firstVert + line.vertCount;
      for (let v = line.firstVert; v < end; v++) this.committed.dug[v] = this.committed.k[v] < prefix - 0.5 ? 1 : 0;
    }
    if (changed) (this.committed.geometry.getAttribute('aDug') as BufferAttribute).needsUpdate = true;
  }

  /** Append ribbons for the runs of 4 connected cells; false when out of room. */
  private build(buf: RibbonBuffer, cells: number[], fire: { x: number; y: number }): boolean {
    let start = 0;
    for (let k = 1; k <= cells.length; k++) {
      const a = cells[k - 1];
      const b = cells[k];
      const adjacent = k < cells.length && Math.abs((a % W) - (b % W)) + Math.abs(Math.floor(a / W) - Math.floor(b / W)) === 1;
      if (adjacent) continue;
      if (!this.buildRun(buf, cells, start, k, fire)) return false;
      start = k;
    }
    return true;
  }

  private buildRun(buf: RibbonBuffer, cells: number[], from: number, to: number, fire: { x: number; y: number }): boolean {
    // Cell centers (x, y, k), smoothed twice so a stair of cells reads as the drawn stroke.
    const pts = this.pts;
    pts.length = 0;
    for (let k = from; k < to; k++) pts.push((cells[k] % W) + 0.5, Math.floor(cells[k] / W) + 0.5, k);
    if (to - from === 1) {
      // A single cell: a short stub so it is still visible.
      pts.push(pts[0] + 0.01, pts[1], from);
    }
    for (let pass = 0; pass < 2 && pts.length >= 9; pass++) this.chaikin(pts);
    const count = pts.length / 3;
    const needed = count * 2 + Math.ceil(count / 2) * 4;
    if (buf.verts + needed > buf.capacity) return false;

    const heights = this.heightOf();
    const sizeX = this.dims.widthM / W;
    const sizeZ = this.dims.depthM / H;
    // Ticks face the fire: the side of the run's middle the fire point is on.
    const mid = Math.floor(count / 2);
    const m0 = Math.max(0, mid - 1);
    const m1 = Math.min(count - 1, mid + 1);
    const tx = pts[m1 * 3] - pts[m0 * 3];
    const ty = pts[m1 * 3 + 1] - pts[m0 * 3 + 1];
    const side = tx * (fire.y - pts[mid * 3 + 1]) - ty * (fire.x - pts[mid * 3]) > 0 ? 1 : -1;

    let arc = 0;
    let nextTick = TICK_EVERY_M / 2;
    let prevLeft = -1;
    let prevRight = -1;
    for (let i = 0; i < count; i++) {
      const cx = pts[i * 3];
      const cy = pts[i * 3 + 1];
      const k = pts[i * 3 + 2];
      const a = Math.max(0, i - 1);
      const b = Math.min(count - 1, i + 1);
      let dx = (pts[b * 3] - pts[a * 3]) * sizeX;
      let dz = (pts[b * 3 + 1] - pts[a * 3 + 1]) * sizeZ;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      dx /= len;
      dz /= len;
      const nx = -dz;
      const nz = dx;
      if (i > 0) {
        const ex = (cx - pts[i * 3 - 3]) * sizeX;
        const ez = (cy - pts[i * 3 - 2]) * sizeZ;
        arc += Math.sqrt(ex * ex + ez * ez);
      }
      const x = this.dims.xOf(cx - 0.5);
      const z = this.dims.zOf(cy - 0.5);
      const cell = Math.min(N - 1, Math.max(0, Math.floor(cy) * W + Math.floor(cx)));
      const y = heights[cell] + LIFT_M;
      const hw = HALF_WIDTH_M * this.widthScale;
      const left = buf.vertex(x + nx * hw, y, z + nz * hw, k, arc, 1, 0);
      const right = buf.vertex(x - nx * hw, y, z - nz * hw, k, arc, -1, 0);
      if (prevLeft >= 0) buf.quad(prevLeft, prevRight, left, right);
      prevLeft = left;
      prevRight = right;
      if (arc >= nextTick && i > 0 && i < count - 1) {
        nextTick += TICK_EVERY_M;
        const sx = nx * side;
        const sz = nz * side;
        const base = hw * 0.6;
        const tip = hw + TICK_LENGTH_M;
        const v0 = buf.vertex(x + sx * base - dx * TICK_HALF_WIDTH_M, y, z + sz * base - dz * TICK_HALF_WIDTH_M, k, arc, 0, 1);
        const v1 = buf.vertex(x + sx * base + dx * TICK_HALF_WIDTH_M, y, z + sz * base + dz * TICK_HALF_WIDTH_M, k, arc, 0, 1);
        const v2 = buf.vertex(x + sx * tip - dx * TICK_HALF_WIDTH_M, y, z + sz * tip - dz * TICK_HALF_WIDTH_M, k, arc, 0, 1);
        const v3 = buf.vertex(x + sx * tip + dx * TICK_HALF_WIDTH_M, y, z + sz * tip + dz * TICK_HALF_WIDTH_M, k, arc, 0, 1);
        buf.quad(v0, v1, v2, v3);
      }
    }
    return true;
  }

  /** One Chaikin pass over (x, y, k) triples, keeping both ends. */
  private chaikin(pts: number[]): void {
    const out = this.tmp;
    out.length = 0;
    const n = pts.length / 3;
    out.push(pts[0], pts[1], pts[2]);
    for (let i = 0; i < n - 1; i++) {
      const ax = pts[i * 3];
      const ay = pts[i * 3 + 1];
      const ak = pts[i * 3 + 2];
      const bx = pts[i * 3 + 3];
      const by = pts[i * 3 + 4];
      const bk = pts[i * 3 + 5];
      out.push(ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25, ak * 0.75 + bk * 0.25);
      out.push(ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75, ak * 0.25 + bk * 0.75);
    }
    out.push(pts[pts.length - 3], pts[pts.length - 2], pts[pts.length - 1]);
    pts.length = 0;
    for (const v of out) pts.push(v);
  }
}
