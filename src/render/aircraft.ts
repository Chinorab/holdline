// The water drop: a strip preview while aiming, then a small generic aircraft that crosses
// the board along the strip and leaves a blue veil that fades. The drop itself is applied
// when the aircraft reaches the start of the strip.

import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  Vector2,
} from '@iwsdk/core';
import { H, W } from '../sim/grid.js';
import { WATER_LENGTH_CELLS, WATER_WIDTH_CELLS, waterStripCells } from '../sim/inputs.js';
import type { BoardDims } from './dims.js';
import { HEX } from './palette.js';

const FLY_HEIGHT_M = 0.11;
/** Aircraft speed over the board, m/s: the 10.5 cm strip takes about 0.6 s. */
const SPEED_M_S = 0.18;
/** How far before and after the strip the aircraft appears and leaves. */
const APPROACH_M = 0.2;
const VEIL_FADE_S = 2.5;

/** Strip pose on the board: center, yaw and lift above the highest cell under it. */
function stripPose(dims: BoardDims, heights: Float32Array, startCell: number, dirDeg: number, out: { x: number; z: number; y: number; yaw: number; ux: number; uz: number }): void {
  const r = (dirDeg * Math.PI) / 180;
  const ux = Math.sin(r);
  const uz = -Math.cos(r);
  const cell = dims.widthM / W;
  const sx = dims.xOf(startCell % W);
  const sz = dims.zOf(Math.floor(startCell / W));
  const half = ((WATER_LENGTH_CELLS - 1) * cell) / 2;
  out.x = sx + ux * half;
  out.z = sz + uz * half;
  out.ux = ux;
  out.uz = uz;
  out.yaw = Math.PI / 2 - r;
  let top = 0;
  for (const c of waterStripCells(startCell, dirDeg, WATER_LENGTH_CELLS, WATER_WIDTH_CELLS)) top = Math.max(top, heights[c]);
  out.y = top + 0.003;
}

function stripMesh(color: string, opacity: number): Mesh {
  const geometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const material = new MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, side: DoubleSide });
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 3;
  mesh.visible = false;
  return mesh;
}

/** The strip under the hand while aiming. */
export class WaterPreview {
  readonly mesh = stripMesh(HEX.water, 0.55);
  private readonly pose = { x: 0, z: 0, y: 0, yaw: 0, ux: 0, uz: 0 };

  constructor(
    private readonly dims: BoardDims,
    private readonly heightOf: () => Float32Array,
  ) {
    this.mesh.name = 'WaterPreview';
  }

  show(startCell: number, dirDeg: number): void {
    stripPose(this.dims, this.heightOf(), startCell, dirDeg, this.pose);
    const cell = this.dims.widthM / W;
    this.mesh.position.set(this.pose.x, this.pose.y, this.pose.z);
    this.mesh.rotation.set(0, this.pose.yaw, 0);
    this.mesh.scale.set(WATER_LENGTH_CELLS * cell, 1, WATER_WIDTH_CELLS * cell);
    this.mesh.visible = true;
  }

  hide(): void {
    this.mesh.visible = false;
  }
}

function planeShape(): Shape {
  // Top view, nose toward +x, in meters: fuselage, straight wings, tail plane.
  const p = (x: number, y: number) => new Vector2(x, y);
  return new Shape([
    p(0.026, 0), p(0.022, 0.003), p(0.006, 0.003), p(0.004, 0.019), p(-0.002, 0.019), p(-0.002, 0.003),
    p(-0.016, 0.002), p(-0.019, 0.008), p(-0.022, 0.008), p(-0.022, -0.008), p(-0.019, -0.008), p(-0.016, -0.002),
    p(-0.002, -0.003), p(-0.002, -0.019), p(0.004, -0.019), p(0.006, -0.003), p(0.022, -0.003),
  ]);
}

export class Aircraft {
  readonly root = new Group();
  private readonly plane = new Group();
  private readonly shadow: Mesh;
  private readonly veil = stripMesh(HEX.water, 0.5);
  private readonly pose = { x: 0, z: 0, y: 0, yaw: 0, ux: 0, uz: 0 };
  private flying = false;
  private dropped = false;
  private s = 0;
  private fade = 0;
  private onDrop: (() => void) | null = null;
  private startS = 0;
  private endS = 0;
  private lengthM = 0;

  constructor(
    private readonly dims: BoardDims,
    private readonly heightOf: () => Float32Array,
  ) {
    this.root.name = 'Aircraft';
    const shape = planeShape();
    const body = new Mesh(new ShapeGeometry(shape).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: HEX.house, side: DoubleSide }));
    const outline = new Mesh(new ShapeGeometry(shape).rotateX(-Math.PI / 2).scale(1.12, 1, 1.12), new MeshBasicMaterial({ color: HEX.ink, side: DoubleSide }));
    outline.position.y = -0.0006;
    this.plane.add(outline, body);
    this.plane.name = 'AircraftBody';
    this.shadow = new Mesh(new ShapeGeometry(shape).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: HEX.ink, transparent: true, opacity: 0.22, depthWrite: false }));
    this.shadow.name = 'AircraftShadow';
    this.veil.name = 'WaterVeil';
    this.root.add(this.veil, this.shadow, this.plane);
    this.root.visible = false;
  }

  get busy(): boolean {
    return this.flying;
  }

  /** Cross the board along the strip; `onDrop` runs when the aircraft reaches its start. */
  fly(startCell: number, dirDeg: number, onDrop: () => void): void {
    stripPose(this.dims, this.heightOf(), startCell, dirDeg, this.pose);
    this.lengthM = (WATER_LENGTH_CELLS * this.dims.widthM) / W;
    this.startS = APPROACH_M;
    this.endS = APPROACH_M + this.lengthM;
    this.s = 0;
    this.fade = 0;
    this.dropped = false;
    this.flying = true;
    this.onDrop = onDrop;
    this.veil.visible = false;
    this.veil.rotation.set(0, this.pose.yaw, 0);
    this.plane.rotation.set(0, this.pose.yaw, 0);
    this.shadow.rotation.set(0, this.pose.yaw, 0);
    this.root.visible = true;
  }

  reset(): void {
    this.flying = false;
    this.root.visible = false;
    this.onDrop = null;
  }

  /** dt is zero while paused: the aircraft waits in the air. */
  update(dt: number): void {
    if (!this.root.visible) return;
    const p = this.pose;
    if (this.flying) {
      this.s += SPEED_M_S * dt;
      const along = this.s - this.startS - this.lengthM / 2;
      const x = p.x + p.ux * along;
      const z = p.z + p.uz * along;
      this.plane.position.set(x, p.y + FLY_HEIGHT_M, z);
      this.shadow.position.set(x, this.groundAt(x, z) + 0.002, z);
      if (!this.dropped && this.s >= this.startS) {
        this.dropped = true;
        this.onDrop?.();
      }
      if (this.dropped) {
        // The veil grows behind the aircraft over the strip.
        const covered = Math.min(this.lengthM, this.s - this.startS);
        const cell = this.dims.widthM / W;
        const mid = covered / 2 - this.lengthM / 2;
        this.veil.position.set(p.x + p.ux * mid, p.y, p.z + p.uz * mid);
        this.veil.scale.set(Math.max(0.001, covered), 1, WATER_WIDTH_CELLS * cell);
        this.veil.visible = covered > 0;
      }
      if (this.s >= this.endS + APPROACH_M) {
        this.flying = false;
        this.plane.visible = false;
        this.shadow.visible = false;
      } else {
        this.plane.visible = true;
        this.shadow.visible = true;
      }
      return;
    }
    this.fade += dt;
    (this.veil.material as MeshBasicMaterial).opacity = 0.5 * Math.max(0, 1 - this.fade / VEIL_FADE_S);
    if (this.fade >= VEIL_FADE_S) {
      this.root.visible = false;
      (this.veil.material as MeshBasicMaterial).opacity = 0.5;
    }
  }

  private groundAt(x: number, z: number): number {
    const c = this.dims.cellOf(x, z);
    const cx = Math.round(c.x);
    const cy = Math.round(c.y);
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) return 0;
    return this.heightOf()[cy * W + cx];
  }
}
