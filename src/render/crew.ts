// The crew: three small pawns. The lead stands on the cell being dug and bobs while it
// digs; the other two follow on the cells just dug. They appear with the first line.

import { BufferAttribute, CapsuleGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from '@iwsdk/core';
import { W } from '../sim/grid.js';
import type { BoardDims } from './dims.js';
import { HEX } from './palette.js';

const FIGURES = 3;
const BODY_H = 0.0058;
const SNAP_CELLS = 3;
const WALK_M_PER_S = 0.03;

export class Crew {
  readonly root = new Group();
  private readonly mesh: InstancedMesh;
  private readonly at: Vector3[] = [];
  private readonly goal: Vector3[] = [];
  private readonly trail: number[] = [];
  private digging = false;
  private time = 0;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly s = new Vector3(1, 1, 1);
  private readonly v = new Vector3();

  constructor(
    private readonly dims: BoardDims,
    private readonly heightOf: () => Float32Array,
  ) {
    this.root.name = 'Crew';
    const radius = 0.0014;
    const figure = new CapsuleGeometry(radius, BODY_H - 2 * radius, 3, 8).translate(0, BODY_H / 2, 0);
    // Ink body, paper head: readable on dark forest and on pale grass alike.
    const ink = new Color(HEX.ink);
    const paper = new Color(HEX.road);
    const position = figure.getAttribute('position');
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) (position.getY(i) > BODY_H * 0.62 ? paper : ink).toArray(colors, i * 3);
    figure.setAttribute('color', new BufferAttribute(colors, 3));
    // Drawn over the trees, like the lines, so the crew is never lost in the forest.
    const material = new MeshBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false });
    this.mesh = new InstancedMesh(figure, material, FIGURES);
    this.mesh.name = 'CrewFigures';
    this.mesh.renderOrder = 3;
    this.mesh.frustumCulled = false;
    for (let i = 0; i < FIGURES; i++) {
      this.at.push(new Vector3());
      this.goal.push(new Vector3());
    }
    this.root.add(this.mesh);
    this.root.visible = false;
  }

  reset(): void {
    this.trail.length = 0;
    this.digging = false;
    this.root.visible = false;
  }

  /** From a worker frame: the cell the crew works on, -1 when idle. */
  setCell(cell: number): void {
    this.digging = cell >= 0;
    if (cell < 0 || this.trail[0] === cell) return;
    const first = this.trail.length === 0;
    this.trail.unshift(cell);
    if (this.trail.length > FIGURES) this.trail.length = FIGURES;
    for (let i = 0; i < FIGURES; i++) {
      const c = this.trail[Math.min(i, this.trail.length - 1)];
      this.cellPoint(c, this.goal[i]);
      // A new line far from the last one: the crew starts there, no walk across the map.
      if (first || this.at[i].distanceTo(this.goal[i]) > (SNAP_CELLS * this.dims.widthM) / W) this.at[i].copy(this.goal[i]);
    }
    this.root.visible = true;
  }

  private cellPoint(cell: number, out: Vector3): void {
    const x = cell % W;
    const y = (cell - x) / W;
    out.set(this.dims.xOf(x), this.heightOf()[cell], this.dims.zOf(y));
  }

  update(dt: number): void {
    if (!this.root.visible) return;
    this.time += dt;
    const stepM = WALK_M_PER_S * dt;
    for (let i = 0; i < FIGURES; i++) {
      const at = this.at[i];
      const d = this.v.subVectors(this.goal[i], at);
      const len = d.length();
      if (len > stepM) at.addScaledVector(d, stepM / len);
      else at.copy(this.goal[i]);
      const bob = this.digging && i === 0 ? 0.85 + 0.15 * Math.abs(Math.sin(this.time * 9)) : 1;
      this.s.set(1, bob, 1);
      // Small offsets so the three never stand in one spot.
      this.v.set(at.x + (i - 1) * 0.0012, at.y, at.z + (i === 1 ? 0.0012 : 0));
      this.m.compose(this.v, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
