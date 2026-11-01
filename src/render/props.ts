// Trees, shrubs and houses: instanced paper shapes with baked light and dark sides, one
// draw each. Burning cells darken their props; burned cells keep stumps and ash.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  InstancedMesh,
  Matrix4,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from '@iwsdk/core';
import { N, W } from '../sim/grid.js';
import { CellState, Fuel, type House } from '../sim/types.js';
import type { BoardDims } from './dims.js';
import { HEX } from './palette.js';

const vertexShader = /* glsl */ `
uniform float uRiseH;
uniform float uPlinth;
varying vec3 vColor;
void main() {
  vec4 base = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float grow = clamp((uRiseH - (base.y - uPlinth)) / 0.004 + 1.0, 0.0, 1.0);
  vec4 world = modelMatrix * instanceMatrix * vec4(position * grow, 1.0);
  vColor = color * instanceColor;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, 1.0);
  #include <colorspace_fragment>
}
`;

export function createPropMaterial(plinthM: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uRiseH: { value: 1 }, uPlinth: { value: plinthM } },
    vertexShader,
    fragmentShader,
    vertexColors: true,
  });
}

/** Bake a fixed light into vertex colors, per face, for flat paper shading. */
function bakeShade(geometry: BufferGeometry, base: string): BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const light = new Vector3(-0.35, 1, 0.45).normalize();
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const tint = new Color(base);
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    const n = b.sub(a).cross(c.sub(a)).normalize();
    const shade = 0.72 + 0.28 * Math.max(0, n.dot(light));
    for (let k = 0; k < 3; k++) {
      colors[(i + k) * 3] = tint.r * shade;
      colors[(i + k) * 3 + 1] = tint.g * shade;
      colors[(i + k) * 3 + 2] = tint.b * shade;
    }
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

function houseGeometry(sizeM: number): BufferGeometry {
  // Walls (a box without a floor) and a gable roof, colors baked per face.
  const w = sizeM * 0.78;
  const d = sizeM * 0.6;
  const h = sizeM * 0.42;
  const r = sizeM * 0.32;
  const hw = w / 2;
  const hd = d / 2;
  const p: number[] = [];
  const col: number[] = [];
  const wall = new Color(HEX.house);
  const roof = new Color(HEX.roof);
  const quad = (v: number[][], c: Color, shade: number) => {
    const [a, b, cc, dd] = v;
    for (const q of [a, b, cc, a, cc, dd]) {
      p.push(q[0], q[1], q[2]);
      col.push(c.r * shade, c.g * shade, c.b * shade);
    }
  };
  quad([[-hw, 0, hd], [hw, 0, hd], [hw, h, hd], [-hw, h, hd]], wall, 0.98);
  quad([[hw, 0, -hd], [-hw, 0, -hd], [-hw, h, -hd], [hw, h, -hd]], wall, 0.8);
  quad([[hw, 0, hd], [hw, 0, -hd], [hw, h, -hd], [hw, h, hd]], wall, 0.86);
  quad([[-hw, 0, -hd], [-hw, 0, hd], [-hw, h, hd], [-hw, h, -hd]], wall, 0.92);
  // Gable ends.
  for (const z of [hd, -hd]) {
    const shade = z > 0 ? 0.98 : 0.8;
    const tri = z > 0 ? [[-hw, h, z], [hw, h, z], [0, h + r, z]] : [[hw, h, z], [-hw, h, z], [0, h + r, z]];
    for (const q of tri) {
      p.push(q[0], q[1], q[2]);
      col.push(wall.r * shade, wall.g * shade, wall.b * shade);
    }
  }
  const o = sizeM * 0.06;
  quad([[-hw - o, h, hd + o], [0, h + r, hd + o], [0, h + r, -hd - o], [-hw - o, h, -hd - o]], roof, 1.0);
  quad([[0, h + r, hd + o], [hw + o, h, hd + o], [hw + o, h, -hd - o], [0, h + r, -hd - o]], roof, 0.78);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  return g;
}

const UNBURNED = new Color(1, 1, 1);
const BURNING = new Color(0.55, 0.42, 0.36);
const BURNED = new Color(HEX.burned).multiplyScalar(2.2);

export class Props {
  readonly trees: InstancedMesh;
  readonly shrubs: InstancedMesh;
  readonly houses: InstancedMesh;
  private readonly treeOfCell = new Int32Array(N).fill(-1);
  private readonly treesInCell = new Uint8Array(N);
  private readonly shrubOfCell = new Int32Array(N).fill(-1);
  private readonly houseOfCell = new Int32Array(N).fill(-1);
  private readonly lastState = new Uint8Array(N);
  private readonly treeBase: Matrix4[] = [];
  private readonly shrubBase: Matrix4[] = [];
  private readonly scratch = new Matrix4();
  private readonly stump = new Matrix4().makeScale(1.15, 0.32, 1.15);

  constructor(material: ShaderMaterial, fuel: Uint8Array, density: Uint8Array, houses: House[], cellHeight: Float32Array, dims: BoardDims) {
    const cellM = dims.widthM / W;
    let treeCount = 0;
    let shrubCount = 0;
    for (let i = 0; i < N; i++) {
      if (fuel[i] === Fuel.Forest) treeCount++;
      if (fuel[i] === Fuel.Shrub && (i * 7 + (i >> 7)) % 2 === 0) shrubCount++;
    }
    const treeGeo = bakeShade(new ConeGeometry(cellM * 0.46, cellM * 1.6, 4, 1, true).translate(0, cellM * 0.8, 0), HEX.forest);
    const shrubGeo = bakeShade(new ConeGeometry(cellM * 0.4, cellM * 0.5, 4, 1, true).translate(0, cellM * 0.25, 0), HEX.brush);
    this.trees = new InstancedMesh(treeGeo, material, Math.max(1, treeCount));
    this.shrubs = new InstancedMesh(shrubGeo, material, Math.max(1, shrubCount));
    this.houses = new InstancedMesh(houseGeometry(cellM * 2), material, Math.max(1, houses.length));
    this.trees.name = 'Trees';
    this.shrubs.name = 'Shrubs';
    this.houses.name = 'Houses';

    const m = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    const t = new Vector3();
    const up = new Vector3(0, 1, 0);
    let ti = 0;
    let si = 0;
    for (let i = 0; i < N; i++) {
      const x = i % W;
      const y = (i - x) / W;
      const jitter = (k: number) => (((i * 9301 + k * 49297) % 233280) / 233280 - 0.5) * 0.5;
      if (fuel[i] === Fuel.Forest) {
        t.set(dims.xOf(x + jitter(1)), cellHeight[i], dims.zOf(y + jitter(3)));
        q.setFromAxisAngle(up, jitter(5) * 6);
        const size = (0.82 + (jitter(7) + 0.25) * 0.5) * (density[i] === 2 ? 1.12 : 1);
        s.set(size, size * (0.9 + jitter(9) * 0.4), size);
        m.compose(t, q, s);
        this.trees.setMatrixAt(ti, m);
        this.trees.setColorAt(ti, UNBURNED);
        this.treeBase.push(m.clone());
        this.treeOfCell[i] = ti;
        this.treesInCell[i] = 1;
        ti++;
      } else if (fuel[i] === Fuel.Shrub && (i * 7 + (i >> 7)) % 2 === 0) {
        t.set(dims.xOf(x + jitter(2)), cellHeight[i], dims.zOf(y + jitter(4)));
        q.setFromAxisAngle(up, jitter(6) * 6);
        const size = 0.85 + (jitter(8) + 0.25) * 0.6;
        s.set(size, size, size);
        m.compose(t, q, s);
        this.shrubs.setMatrixAt(si, m);
        this.shrubs.setColorAt(si, UNBURNED);
        this.shrubBase.push(m.clone());
        this.shrubOfCell[i] = si;
        si++;
      }
    }
    this.trees.count = ti;
    this.shrubs.count = si;

    houses.forEach((house, h) => {
      let cx = 0;
      let cy = 0;
      let top = 0;
      for (const c of house.cells) {
        cx += c % W;
        cy += Math.floor(c / W);
        top = Math.max(top, cellHeight[c]);
        this.houseOfCell[c] = h;
      }
      t.set(dims.xOf(cx / 4), top, dims.zOf(cy / 4));
      q.setFromAxisAngle(up, ((house.id * 37) % 4) * 0.08);
      m.compose(t, q, s.set(1, 1, 1));
      this.houses.setMatrixAt(h, m);
      this.houses.setColorAt(h, UNBURNED);
    });
    this.houses.count = houses.length;
    for (const mesh of [this.trees, this.shrubs, this.houses]) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  /** Update props whose cell changed state. packed: worker state (state in R >> 3). */
  applyState(stateOf: (i: number) => number): void {
    let trees = false;
    let shrubs = false;
    let houses = false;
    for (let i = 0; i < N; i++) {
      const st = stateOf(i);
      if (st === this.lastState[i]) continue;
      this.lastState[i] = st;
      const tint = st === CellState.Burning ? BURNING : st === CellState.Burned ? BURNED : UNBURNED;
      // Burned, or cut down by the crews (a dug line turns fuel into bare ground).
      const cut = st === CellState.Burned || st === CellState.Unburnable;
      const ti = this.treeOfCell[i];
      if (ti >= 0) {
        for (let k = ti; k < ti + this.treesInCell[i]; k++) {
          this.trees.setColorAt(k, tint);
          this.trees.setMatrixAt(k, cut ? this.scratch.multiplyMatrices(this.treeBase[k], this.stump) : this.treeBase[k]);
        }
        trees = true;
      }
      const si = this.shrubOfCell[i];
      if (si >= 0) {
        this.shrubs.setColorAt(si, tint);
        this.shrubs.setMatrixAt(si, cut ? this.scratch.multiplyMatrices(this.shrubBase[si], this.stump) : this.shrubBase[si]);
        shrubs = true;
      }
      const hi = this.houseOfCell[i];
      if (hi >= 0 && st >= CellState.Burning) {
        this.houses.setColorAt(hi, st === CellState.Burned ? BURNED : BURNING);
        houses = true;
      }
    }
    if (trees) this.markDirty(this.trees);
    if (shrubs) this.markDirty(this.shrubs);
    if (houses && this.houses.instanceColor) this.houses.instanceColor.needsUpdate = true;
  }

  /** Back to the unburned look (new run or time lapse start). */
  reset(): void {
    this.lastState.fill(255);
    for (let k = 0; k < this.trees.count; k++) {
      this.trees.setColorAt(k, UNBURNED);
      this.trees.setMatrixAt(k, this.treeBase[k]);
    }
    for (let k = 0; k < this.shrubs.count; k++) {
      this.shrubs.setColorAt(k, UNBURNED);
      this.shrubs.setMatrixAt(k, this.shrubBase[k]);
    }
    for (let k = 0; k < this.houses.count; k++) this.houses.setColorAt(k, UNBURNED);
    this.markDirty(this.trees);
    this.markDirty(this.shrubs);
    if (this.houses.instanceColor) this.houses.instanceColor.needsUpdate = true;
  }

  private markDirty(mesh: InstancedMesh): void {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    for (const mesh of [this.trees, this.shrubs, this.houses]) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
  }
}
