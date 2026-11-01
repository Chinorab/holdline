// Pinching on the board. Far: the terrain takes ray pointer events (hand ray, controller,
// gaze), captured for the whole drag. Near: a pinch within 10 cm above the board acts under
// the fingers, the pinch point projected straight down. Near wins over far: a ray stroke
// from a hand that is over the board is ignored, and a near pinch cancels a ray stroke in
// progress. Strokes go to the selected tool (dig, water, backburn); a ray resting on the
// terrain with no stroke is a hover (inspect).

import { Matrix4, RayInteractable, Vector3, type Entity, type Object3D, type Ray, type World } from '@iwsdk/core';
import type { Board } from '../render/board.js';
import { H, W } from '../sim/grid.js';

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

/** A tool driven by strokes, in board local meters (x right, z toward the player). */
export interface StrokeTool {
  begin(x: number, z: number): void;
  move(x: number, z: number): void;
  end(): void;
  cancel(): void;
  update?(dt: number): void;
}

export interface HoverListener {
  hover(x: number, z: number): void;
  hoverEnd(): void;
}

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

export class ToolInput {
  readonly surface: Entity;
  tool: StrokeTool | null = null;
  hoverListener: HoverListener | null = null;
  /** How the last finished stroke was made (status for the emulator gate). */
  lastKind: 'far' | 'near' | null = null;
  private active: { kind: 'far'; pointerId: number; object: Object3D } | { kind: 'near'; hand: Hand } | null = null;
  private activeTool: StrokeTool | null = null;
  private on = false;
  private hovering = false;
  private readonly pinching = { left: false, right: false };
  private readonly overBoard = { left: false, right: false };
  private readonly thumb = new Vector3();
  private readonly index = new Vector3();
  private readonly local = new Vector3();
  private readonly ray = new Vector3();
  private readonly dir = new Vector3();
  private readonly toBoard = new Matrix4();

  constructor(
    world: World,
    private readonly board: Board,
    parent: Entity,
    private readonly rays: { left: Object3D; right: Object3D },
    private readonly origin: Object3D,
  ) {
    this.surface = world.createTransformEntity(board.surface, { parent });
    const target = board.surface as unknown as { addEventListener(type: string, fn: (e: FarEvent) => void): void };
    target.addEventListener('pointerdown', (e) => this.farDown(e));
    target.addEventListener('pointermove', (e) => this.farMove(e));
    target.addEventListener('pointerup', (e) => this.farUp(e));
    target.addEventListener('pointercancel', (e) => this.farCancel(e));
    target.addEventListener('pointerleave', () => this.endHover());
  }

  get drawing(): boolean {
    return this.active !== null;
  }

  /** The board takes pinches and hovers only while a fire can be acted on. */
  setEnabled(on: boolean): void {
    if (on === this.on) return;
    this.on = on;
    if (on) this.surface.addComponent(RayInteractable);
    else {
      this.surface.removeComponent(RayInteractable);
      this.cancel();
      this.endHover();
    }
  }

  /** Switch tools; a stroke in progress is dropped. */
  setTool(tool: StrokeTool | null): void {
    if (tool === this.tool) return;
    this.cancel();
    this.tool = tool;
  }

  private handOf(e: FarEvent): Hand | null {
    for (const hand of HANDS) {
      this.rays[hand].getWorldPosition(this.ray);
      if (this.ray.distanceTo(e.pointerPosition) < SAME_HAND_M) return hand;
    }
    return null;
  }

  private farDown(e: FarEvent): void {
    if (!this.on || this.active || !this.tool) return;
    const hand = this.handOf(e);
    if (hand && this.overBoard[hand]) return;
    e.object.setPointerCapture(e.pointerId);
    this.endHover();
    this.active = { kind: 'far', pointerId: e.pointerId, object: e.object };
    this.activeTool = this.tool;
    this.toLocal(e.point);
    this.activeTool.begin(this.local.x, this.local.z);
  }

  // While captured, the library projects moves onto a plane through the first hit, which
  // loses depth on a relief; the ray is marched over the heightfield instead.
  private farMove(e: FarEvent): void {
    if (this.active?.kind === 'far' && this.active.pointerId === e.pointerId) {
      if (this.marchRay(e.ray)) this.activeTool?.move(this.local.x, this.local.z);
      return;
    }
    if (!this.on || this.active || !this.hoverListener) return;
    this.toLocal(e.point);
    this.hovering = true;
    this.hoverListener.hover(this.local.x, this.local.z);
  }

  private farUp(e: FarEvent): void {
    if (this.active?.kind !== 'far' || this.active.pointerId !== e.pointerId) return;
    if (this.marchRay(e.ray)) this.activeTool?.move(this.local.x, this.local.z);
    this.finish();
  }

  private farCancel(e: FarEvent): void {
    if (this.active?.kind === 'far' && this.active.pointerId === e.pointerId) this.cancel();
  }

  private endHover(): void {
    if (!this.hovering) return;
    this.hovering = false;
    this.hoverListener?.hoverEnd();
  }

  private toLocal(point: Vector3): void {
    this.local.copy(point);
    this.board.root.worldToLocal(this.local);
  }

  /** Board local terrain point under a world ray, into this.local. */
  private marchRay(ray: Ray): boolean {
    const root = this.board.root;
    root.updateWorldMatrix(true, false);
    this.toBoard.copy(root.matrixWorld).invert();
    this.local.copy(ray.origin).applyMatrix4(this.toBoard);
    this.dir.copy(ray.direction).transformDirection(this.toBoard);
    return this.march(this.local, this.dir);
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

  /** Per frame: hand joints for the near pinch, and the tool's own timers. */
  update(frame: unknown, space: unknown, dt: number): void {
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
        if (now && !was && this.overBoard[hand] && this.active?.kind !== 'near' && this.tool) {
          if (this.active?.kind === 'far') this.cancel();
          this.endHover();
          this.active = { kind: 'near', hand };
          this.activeTool = this.tool;
          this.activeTool.begin(this.local.x, this.local.z);
        } else if (this.active?.kind === 'near' && this.active.hand === hand) {
          if (now) this.activeTool?.move(this.local.x, this.local.z);
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
    if (this.on) this.activeTool?.update?.(dt);
  }

  private inNearZone(p: Vector3): boolean {
    const d = this.board.dims;
    if (Math.abs(p.x) > d.widthM / 2 + NEAR_MARGIN_M || Math.abs(p.z) > d.depthM / 2 + NEAR_MARGIN_M) return false;
    const ground = this.groundAt(p.x, p.z);
    return p.y > ground - 0.01 && p.y < ground + NEAR_ABOVE_M;
  }

  private finish(): void {
    const tool = this.activeTool;
    this.lastKind = this.active?.kind ?? null;
    this.release();
    tool?.end();
  }

  private cancel(): void {
    const tool = this.activeTool;
    this.release();
    tool?.cancel();
  }

  private release(): void {
    if (this.active?.kind === 'far') this.active.object.releasePointerCapture(this.active.pointerId);
    this.active = null;
    this.activeTool = null;
  }
}
