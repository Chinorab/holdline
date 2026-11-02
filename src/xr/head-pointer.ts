// The head pointer and dwell select. One ray, from the eyes when the headset tracks gaze
// (Meta VR Glasses), otherwise from the head, reaches every button and the board.
//   Head pointer: a pinch (either hand) or a trigger presses what the ray is on; on the
//   board, a held pinch draws while the head moves.
//   Dwell select: resting the ray on a button for 1 s presses it. On the board a stroke
//   needs a tool armed first (dwell on Dig line, Water drop or Backburn), so watching the
//   fire never draws: then resting 1 s starts the stroke, moving the ray draws it, and
//   resting 1 s again ends it.
// IWSDK's gaze pointer has no head pose fallback, so this is the game's own ray (research R7).

import { DoubleSide, Mesh, MeshBasicMaterial, Object3D, Raycaster, RingGeometry, Vector3 } from '@iwsdk/core';
import type { ToolInput } from '../input/tool-system.js';
import type { Board } from '../render/board.js';
import { HoldRing } from '../render/hold-ring.js';
import { HEX } from '../render/palette.js';
import type { Panel } from '../ui/panels.js';

const DWELL_S = 1;
/** The ray may wander this far and still count as resting (board cells / button). */
const STILL_CELLS = 1.2;
const MAX_REACH_M = 3;
const TOOL_BUTTONS = new Set(['btn-dig', 'btn-water', 'btn-backburn']);

type Target =
  | { kind: 'button'; panel: Panel; id: string; point: Vector3 }
  | { kind: 'board'; x: number; z: number; point: Vector3 }
  | { kind: 'place'; point: Vector3 };

export interface PointerHost {
  panels(): Panel[];
  /** A placement waits for a confirm: the board itself is a target. */
  placing(): boolean;
  confirmPlacement(): void;
  /** The board takes strokes now (plan, live, Day 0). */
  boardEnabled(): boolean;
  /** A pinch or trigger went down this frame / is held. */
  selectDown(): boolean;
  selectHeld(): boolean;
}

export class AltPointer {
  head = false;
  dwell = false;
  readonly root = new Object3D();
  /** Status for the emulator gate: what the ray is on and what dwell did last. */
  targetLabel = '';
  lastAction = '';
  /** Dwell: a tool button was dwelled on; the next board dwell starts one stroke. */
  armed = false;
  private readonly reticle: Mesh;
  private readonly ring = new HoldRing(0.03);
  private readonly ray = new Raycaster();
  private readonly origin = new Vector3();
  private readonly dir = new Vector3();
  private readonly hit = new Vector3();
  private readonly local = new Vector3();
  private target: Target | null = null;
  private dwellT = 0;
  private fired = false;
  private stroking = false;
  /** The stroke moved at least once: only then can resting end it. */
  private moved = false;
  private anchorX = 0;
  private anchorZ = 0;

  constructor(
    private readonly board: Board,
    private readonly tools: ToolInput,
    private readonly host: PointerHost,
  ) {
    this.root.name = 'AltPointer';
    this.reticle = new Mesh(
      new RingGeometry(0.004, 0.0065, 24),
      new MeshBasicMaterial({ color: HEX.fire, depthTest: false, depthWrite: false, side: DoubleSide }),
    );
    this.reticle.renderOrder = 30;
    this.ring.mesh.geometry.rotateX(Math.PI / 2);
    this.ring.mesh.renderOrder = 31;
    this.root.add(this.reticle, this.ring.mesh);
    this.root.visible = false;
  }

  get active(): boolean {
    return this.head || this.dwell;
  }

  /** `source`: the eye or head pose (its -Z is the ray); `camera` orients the reticle. */
  update(dt: number, source: Object3D, camera: Object3D): void {
    this.root.visible = this.active;
    if (!this.active) {
      this.reset();
      return;
    }
    source.getWorldPosition(this.origin);
    source.getWorldDirection(this.dir).negate();
    const target = this.pick();
    this.targetLabel = target ? (target.kind === 'button' ? target.id : target.kind) : '';
    if (target) {
      this.reticle.visible = true;
      this.reticle.position.copy(target.point);
      this.reticle.lookAt(camera.getWorldPosition(this.hit));
      this.ring.mesh.position.copy(target.point);
      this.ring.mesh.quaternion.copy(this.reticle.quaternion);
    } else {
      this.reticle.visible = false;
    }
    if (this.head && !this.dwell) this.pinchMode(target);
    else this.dwellMode(target, dt);
    this.target = target;
  }

  private pinchMode(target: Target | null): void {
    this.ring.hide();
    if (this.stroking) {
      if (!this.host.selectHeld() || !this.host.boardEnabled()) this.endStroke();
      else if (target?.kind === 'board') this.tools.moveExternal(target.x, target.z);
      return;
    }
    if (!target || !this.host.selectDown() || this.tools.drawing) return;
    if (target.kind === 'button') {
      this.lastAction = `press ${target.id}`;
      target.panel.fire(target.id);
    } else if (target.kind === 'place') {
      this.lastAction = 'place';
      this.host.confirmPlacement();
    } else if (this.host.boardEnabled() && this.tools.beginExternal(target.x, target.z)) {
      this.stroking = true;
      this.lastAction = 'stroke';
    }
  }

  private dwellMode(target: Target | null, dt: number): void {
    if (this.stroking) {
      if (!this.host.boardEnabled()) {
        this.endStroke();
        return;
      }
      if (target?.kind === 'board') {
        if (this.far(target)) {
          this.anchorX = target.x;
          this.anchorZ = target.z;
          this.dwellT = 0;
          this.moved = true;
          this.tools.moveExternal(target.x, target.z);
        } else if (this.moved) this.dwellT += dt;
      } else if (this.moved) this.dwellT += dt;
      this.ring.mesh.visible = true;
      this.ring.setFill(this.dwellT / DWELL_S);
      if (this.dwellT >= DWELL_S) {
        this.endStroke();
        this.fired = true;
      }
      return;
    }
    if (!target || !this.same(target)) {
      this.dwellT = 0;
      this.fired = false;
      if (target?.kind === 'board') {
        this.anchorX = target.x;
        this.anchorZ = target.z;
      }
    } else if (!this.fired) {
      this.dwellT += dt;
    }
    const canAct = target && (target.kind !== 'board' || (this.armed && this.host.boardEnabled()));
    if (target && canAct && !this.fired) {
      this.ring.mesh.visible = true;
      this.ring.setFill(this.dwellT / DWELL_S);
    } else this.ring.hide();
    if (!target || !canAct || this.fired || this.dwellT < DWELL_S) return;
    this.fired = true;
    this.dwellT = 0;
    if (target.kind === 'button') {
      this.lastAction = `dwell ${target.id}`;
      if (TOOL_BUTTONS.has(target.id)) this.armed = true;
      target.panel.fire(target.id);
    } else if (target.kind === 'place') {
      this.lastAction = 'dwell place';
      this.host.confirmPlacement();
    } else if (this.tools.beginExternal(target.x, target.z)) {
      this.stroking = true;
      this.moved = false;
      this.armed = false;
      this.fired = false;
      this.lastAction = 'dwell stroke';
    }
  }

  private endStroke(): void {
    this.stroking = false;
    this.dwellT = 0;
    this.ring.hide();
    this.tools.endExternal();
    this.lastAction = this.dwell ? 'dwell end' : 'stroke end';
  }

  private same(target: Target): boolean {
    const prev = this.target;
    if (!prev || prev.kind !== target.kind) return false;
    if (prev.kind === 'button' && target.kind === 'button') return prev.id === target.id && prev.panel === target.panel;
    if (target.kind === 'place') return true;
    return target.kind === 'board' && !this.far(target);
  }

  private far(target: { x: number; z: number }): boolean {
    const cell = this.board.dims.widthM / 128;
    const dx = (target.x - this.anchorX) / cell;
    const dz = (target.z - this.anchorZ) / cell;
    return dx * dx + dz * dz > STILL_CELLS * STILL_CELLS;
  }

  /** The nearest button or board point along the ray. */
  private pick(): Target | null {
    this.ray.set(this.origin, this.dir);
    this.ray.far = MAX_REACH_M;
    let best: Target | null = null;
    let bestD = Infinity;
    for (const panel of this.host.panels()) {
      if (!panel.visible) continue;
      const h = panel.buttonHit(this.ray);
      if (h && h.distance < bestD) {
        bestD = h.distance;
        best = { kind: 'button', panel, id: h.id, point: h.point };
      }
    }
    if (this.host.placing()) {
      // The highlighted table spot: the board's footprint, before the terrain is up.
      if (this.tools.terrainHit(this.origin, this.dir, this.local) || this.footprintHit()) {
        this.hit.copy(this.local);
        this.board.root.localToWorld(this.hit);
        if (this.hit.distanceTo(this.origin) < bestD) best = { kind: 'place', point: this.hit.clone() };
      }
      return best;
    }
    if (this.tools.terrainHit(this.origin, this.dir, this.local)) {
      this.hit.copy(this.local);
      this.board.root.localToWorld(this.hit);
      const d = this.hit.distanceTo(this.origin);
      if (d < bestD) best = { kind: 'board', x: this.local.x, z: this.local.z, point: this.hit.clone() };
    }
    return best;
  }

  /** The ray meets the board's flat footprint (board local, into this.local). */
  private footprintHit(): boolean {
    const root = this.board.root;
    root.updateWorldMatrix(true, false);
    const o = this.hit.copy(this.origin);
    root.worldToLocal(o);
    const d = this.local.copy(this.dir).add(this.origin);
    root.worldToLocal(d);
    d.sub(o);
    if (Math.abs(d.y) < 1e-6) return false;
    const t = -o.y / d.y;
    if (t <= 0) return false;
    this.local.copy(o).addScaledVector(d, t);
    const dims = this.board.dims;
    return Math.abs(this.local.x) <= dims.widthM / 2 && Math.abs(this.local.z) <= dims.depthM / 2;
  }

  private reset(): void {
    if (this.stroking) this.endStroke();
    this.target = null;
    this.dwellT = 0;
    this.fired = false;
    this.ring.hide();
    this.targetLabel = '';
  }
}
