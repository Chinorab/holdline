// Drawing on the board. Far: the terrain takes ray pointer events (hand ray, controller,
// gaze), captured for the whole drag. Near: a pinch within 10 cm above the board draws
// under the fingers, the pinch point projected straight down. Near wins over far: a ray
// stroke from a hand that is over the board is ignored, and a near pinch cancels a ray
// stroke in progress. Strokes become dig lines (src/input/dig.ts).

import { Matrix4, RayInteractable, Vector3, type Entity, type Object3D, type Ray, type World } from '@iwsdk/core';
import type { Board } from '../render/board.js';
import { H, W } from '../sim/grid.js';
import { DigStroke, MIN_LINE_CELLS } from './dig.js';

type Hand = 'left' | 'right';
const HANDS: Hand[] = ['left', 'right'];

/** Pinch closes under 1.5 cm between thumb and index tips, opens over 3 cm. */
const PINCH_ON_M = 0.015;
const PINCH_OFF_M = 0.03;
/** Near zone: up to 10 cm above the ground, 1 cm past the board edge. */
const NEAR_ABOVE_M = 0.1;
const NEAR_MARGIN_M = 0.01;
/** A ray whose origin is this close to a hand's ray space belongs to that hand. */
const SAME_HAND_M = 0.05;
/** Heightfield ray march: step and longest reach, in meters. */
const MARCH_STEP_M = 0.002;
const MARCH_MAX_M = 3;

interface FarEvent {
  pointerId: number;
  point: Vector3;
  pointerPosition: Vector3;
  ray: Ray;
  object: Object3D;
}

interface JointPose {
  transform: { position: { x: number; y: number; z: number } };
}
interface HandSource {
  handedness: string;
  hand?: { get(joint: string): unknown };
}
interface FrameWithJoints {
  session: { inputSources: Iterable<HandSource> };
  getJointPose?(joint: unknown, space: unknown): JointPose | undefined | null;
}

export interface ToolHost {
  /** Latest packed worker state (see Sim.packState). */
  packed(): Uint8Array | null;
  budgetLeft(): number;
  /** A cell coordinate the line ticks should face. */
  firePoint(): { x: number; y: number };
  commit(cells: number[]): void;
  /** A stroke that found no budget left. */
  outOfBudget(): void;
}

export class ToolInput {
  readonly surface: Entity;
  private readonly stroke = new DigStroke();
  private active: { kind: 'far'; pointerId: number; object: Object3D } | { kind: 'near'; hand: Hand } | null = null;
  private on = false;
  private readonly pinching = { left: false, right: false };
  private readonly overBoard = { left: false, right: false };
  private readonly thumb = new Vector3();
  private readonly index = new Vector3();
  private readonly local = new Vector3();
  private readonly ray = new Vector3();
  private readonly dir = new Vector3();
  private readonly toBoard = new Matrix4();
  /** Cells the stroke being drawn would plan, within the budget. */
  previewCells = 0;
  /** How the last committed stroke was drawn (status for the emulator gate). */
  lastKind: 'far' | 'near' | null = null;

  constructor(
    world: World,
    private readonly board: Board,
    parent: Entity,
    private readonly rays: { left: Object3D; right: Object3D },
    private readonly origin: Object3D,
    private readonly host: ToolHost,
  ) {
    this.surface = world.createTransformEntity(board.surface, { parent });
    const target = board.surface as unknown as { addEventListener(type: string, fn: (e: FarEvent) => void): void };
    target.addEventListener('pointerdown', (e) => this.farDown(e));
    target.addEventListener('pointermove', (e) => this.farMove(e));
    target.addEventListener('pointerup', (e) => this.farUp(e));
    target.addEventListener('pointercancel', (e) => this.farCancel(e));
  }

  get drawing(): boolean {
    return this.active !== null;
  }

  /** Drawing is possible only in the plan and live phases, unpaused, with Dig selected. */
  setEnabled(on: boolean): void {
    if (on === this.on) return;
    this.on = on;
    if (on) this.surface.addComponent(RayInteractable);
    else {
      this.surface.removeComponent(RayInteractable);
      this.cancel();
    }
  }

  private handOf(e: FarEvent): Hand | null {
    for (const hand of HANDS) {
      this.rays[hand].getWorldPosition(this.ray);
      if (this.ray.distanceTo(e.pointerPosition) < SAME_HAND_M) return hand;
    }
    return null;
  }

  private farDown(e: FarEvent): void {
    if (!this.on || this.active) return;
    const hand = this.handOf(e);
    if (hand && this.overBoard[hand]) return;
    e.object.setPointerCapture(e.pointerId);
    this.active = { kind: 'far', pointerId: e.pointerId, object: e.object };
    this.stroke.clear();
    this.addWorld(e.point);
  }

  // While captured, the library projects moves onto a plane through the first hit, which
  // loses depth on a relief; the ray is marched over the heightfield instead.
  private farMove(e: FarEvent): void {
    if (this.active?.kind === 'far' && this.active.pointerId === e.pointerId) this.addRay(e.ray);
  }

  private farUp(e: FarEvent): void {
    if (this.active?.kind !== 'far' || this.active.pointerId !== e.pointerId) return;
    this.addRay(e.ray);
    this.finish();
  }

  private addRay(ray: Ray): void {
    const root = this.board.root;
    root.updateWorldMatrix(true, false);
    this.toBoard.copy(root.matrixWorld).invert();
    this.local.copy(ray.origin).applyMatrix4(this.toBoard);
    this.dir.copy(ray.direction).transformDirection(this.toBoard);
    if (this.march(this.local, this.dir)) this.addLocal(this.local.x, this.local.z);
  }

  /** First point where a board space ray meets the terrain; written into `origin`. */
  private march(origin: Vector3, dir: Vector3): boolean {
    const d = this.board.dims;
    let prevAbove = true;
    for (let t = 0; t <= MARCH_MAX_M; t += MARCH_STEP_M) {
      const x = origin.x + dir.x * t;
      const y = origin.y + dir.y * t;
      const z = origin.z + dir.z * t;
      if (Math.abs(x) > d.widthM / 2 || Math.abs(z) > d.depthM / 2) {
        prevAbove = true;
        continue;
      }
      const above = y > this.groundAt(x, z);
      if (!above && prevAbove && t > 0) {
        origin.set(x, y, z);
        return true;
      }
      prevAbove = above;
    }
    return false;
  }

  private groundAt(x: number, z: number): number {
    const c = this.board.dims.cellOf(x, z);
    const cx = Math.min(W - 1, Math.max(0, Math.round(c.x)));
    const cy = Math.min(H - 1, Math.max(0, Math.round(c.y)));
    return this.board.cellHeight[cy * W + cx];
  }

  private farCancel(e: FarEvent): void {
    if (this.active?.kind === 'far' && this.active.pointerId === e.pointerId) this.cancel();
  }

  /** Per frame: hand joints for the near pinch. */
  update(frame: unknown, space: unknown): void {
    const f = frame as FrameWithJoints | null;
    const seen = { left: false, right: false };
    if (this.on && f?.getJointPose && space) {
      for (const source of f.session.inputSources) {
        const hand = source.handedness as Hand;
        if (!source.hand || (hand !== 'left' && hand !== 'right')) continue;
        const t = f.getJointPose(source.hand.get('thumb-tip'), space);
        const i = f.getJointPose(source.hand.get('index-finger-tip'), space);
        if (!t || !i) continue;
        seen[hand] = true;
        this.thumb.set(t.transform.position.x, t.transform.position.y, t.transform.position.z);
        this.index.set(i.transform.position.x, i.transform.position.y, i.transform.position.z);
        this.origin.localToWorld(this.thumb);
        this.origin.localToWorld(this.index);
        const gap = this.thumb.distanceTo(this.index);
        this.local.addVectors(this.thumb, this.index).multiplyScalar(0.5);
        this.board.root.worldToLocal(this.local);
        this.overBoard[hand] = this.inNearZone(this.local);
        const was = this.pinching[hand];
        const now = was ? gap < PINCH_OFF_M : gap < PINCH_ON_M;
        this.pinching[hand] = now;
        if (now && !was && this.overBoard[hand] && this.active?.kind !== 'near') {
          if (this.active?.kind === 'far') this.cancel();
          this.active = { kind: 'near', hand };
          this.stroke.clear();
        }
        if (this.active?.kind === 'near' && this.active.hand === hand) {
          if (now) this.addLocal(this.local.x, this.local.z);
          else this.finish();
        }
      }
    }
    for (const hand of HANDS) {
      if (seen[hand]) continue;
      this.pinching[hand] = false;
      this.overBoard[hand] = false;
      if (this.active?.kind === 'near' && this.active.hand === hand) this.finish();
    }
  }

  private inNearZone(p: Vector3): boolean {
    const d = this.board.dims;
    if (Math.abs(p.x) > d.widthM / 2 + NEAR_MARGIN_M || Math.abs(p.z) > d.depthM / 2 + NEAR_MARGIN_M) return false;
    const ground = this.groundAt(p.x, p.z);
    return p.y > ground - 0.01 && p.y < ground + NEAR_ABOVE_M;
  }

  private addWorld(point: Vector3): void {
    this.local.copy(point);
    this.board.root.worldToLocal(this.local);
    this.addLocal(this.local.x, this.local.z);
  }

  private addLocal(x: number, z: number): void {
    const c = this.board.dims.cellOf(x, z);
    if (c.x < -0.5 || c.y < -0.5 || c.x > W - 0.5 || c.y > H - 0.5) return;
    if (!this.stroke.add(c.x, c.y)) return;
    const cells = this.stroke.cells(this.host.packed());
    const budget = this.host.budgetLeft();
    this.previewCells = Math.min(cells.length, budget);
    this.board.lines.setPreview(cells, budget, this.host.firePoint());
  }

  private finish(): void {
    const kind = this.active?.kind ?? null;
    const cells = this.stroke.cells(this.host.packed());
    const budget = this.host.budgetLeft();
    this.cancel();
    if (cells.length < MIN_LINE_CELLS) return;
    if (budget <= 0) {
      this.host.outOfBudget();
      return;
    }
    this.lastKind = kind;
    this.host.commit(cells.slice(0, budget));
  }

  private cancel(): void {
    if (this.active?.kind === 'far') this.active.object.releasePointerCapture(this.active.pointerId);
    this.active = null;
    this.stroke.clear();
    this.previewCells = 0;
    this.board.lines.clearPreview();
  }
}
