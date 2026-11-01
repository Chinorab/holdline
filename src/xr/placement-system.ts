// Board placement: find a table in the real room (horizontal planes and table or desk
// meshes 0.5 to 1.1 m above the floor, near and in front, big enough), show the board there
// with a highlight and wait for a pinch. With no table after 4 s the board takes a seated
// pose in front of the player, with a grab bar. Then it is anchored, and the anchor's
// persistent handle brings it back to the same table on the next visit.

import {
  Grabbed,
  Matrix4,
  Pressed,
  Quaternion,
  RayInteractable,
  Vector3,
  XRMesh,
  XRPlane,
  createSystem,
  type Entity,
} from '@iwsdk/core';
import { BoardHandle, BoardHitProxy, BoardRoot } from '../game/tags.js';
import { AnchorService, type FrameLike, type SessionLike, type SpaceLike } from './anchor-service.js';

export type PlacementStatus = 'idle' | 'restoring' | 'searching' | 'candidate' | 'placed';
export type PlacementMode = 'none' | 'surface' | 'fallback' | 'restored';

const FALLBACK_AFTER_S = 4;
const RESTORE_WAIT_S = 3;
const MIN_HEIGHT = 0.5;
const MAX_HEIGHT = 1.1;
const MAX_DISTANCE = 1.6;
const EDGE_MARGIN = 0.03;

export interface BoardFootprint {
  widthM: number;
  depthM: number;
}

/** Shared state between the placement system and the game. */
export const placement = {
  status: 'idle' as PlacementStatus,
  mode: 'none' as PlacementMode,
  label: '',
  candidates: 0,
  footprint: { widthM: 0.56, depthM: 0.35 } as BoardFootprint,
  savedHandle: null as string | null,
  /** World height of a detected ceiling plane, or null (for the smoke). */
  ceilingY: null as number | null,
  /** Set by the game for "Place again"; the system starts a new search. */
  redoRequested: false,
  onHandle: (_handle: string | null) => {},
  start(savedHandle: string | null): void {
    this.savedHandle = savedHandle;
    this.status = savedHandle ? 'restoring' : 'searching';
    this.mode = 'none';
  },
  reset(): void {
    this.status = 'idle';
    this.mode = 'none';
  },
};

interface Candidate {
  center: Vector3;
  axisX: Vector3;
  axisZ: Vector3;
  halfX: number;
  halfZ: number;
  label: string;
  score: number;
}

const UP = new Vector3(0, 1, 0);

export class PlacementSystem extends createSystem({
  planes: { required: [XRPlane] },
  meshes: { required: [XRMesh] },
  boards: { required: [BoardRoot] },
  proxies: { required: [BoardHitProxy] },
  pressedProxies: { required: [BoardHitProxy, Pressed] },
  handles: { required: [BoardHandle] },
  grabbedHandles: { required: [BoardHandle, Grabbed] },
}) {
  private elapsed = 0;
  private scanTimer = 0;
  private anchors!: AnchorService;
  private anchorPending = false;
  private readonly head = new Vector3();
  private readonly forward = new Vector3();
  private readonly tmp = new Vector3();
  private readonly tmp2 = new Vector3();
  private readonly quat = new Quaternion();
  private readonly mat = new Matrix4();
  private readonly handleOffset = new Vector3(0, 0.007, 0);
  private candidate: Candidate | null = null;

  init(): void {
    this.anchors = new AnchorService(
      (p) => new XRRigidTransform(p.position, p.quaternion),
      (handle) => placement.onHandle(handle),
    );
    this.cleanupFuncs.push(
      this.queries.pressedProxies.subscribe('qualify', () => {
        if (placement.status === 'candidate') this.confirm('surface');
      }),
      this.queries.grabbedHandles.subscribe('disqualify', () => {
        if (placement.status === 'placed') this.reanchor();
      }),
    );
  }

  private get board(): Entity | undefined {
    return this.queries.boards.entities.values().next().value;
  }

  private get handle(): Entity | undefined {
    return this.queries.handles.entities.values().next().value;
  }

  private setProxyInteractive(on: boolean): void {
    for (const proxy of this.queries.proxies.entities) {
      if (on && !proxy.hasComponent(RayInteractable)) proxy.addComponent(RayInteractable);
      if (!on && proxy.hasComponent(RayInteractable)) proxy.removeComponent(RayInteractable);
    }
  }

  private headPose(): void {
    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldDirection(this.forward);
    // Object3D world direction is +z of the head; the view looks down -z.
    this.forward.multiplyScalar(-1);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-6) this.forward.set(0, 0, -1);
    this.forward.normalize();
  }

  update(delta: number): void {
    // The first XR frame (and a slow frame) can carry a long step; timers here count
    // steady frames so planes have their 2 to 3 s to arrive.
    const dt = Math.min(delta, 0.1);
    const board = this.board?.object3D;
    if (!board) return;
    this.findCeiling(dt);
    const xr = this.renderer.xr;
    const frame = xr.getFrame() as unknown as FrameLike | null;
    const space = xr.getReferenceSpace() as unknown as SpaceLike | null;
    const session = xr.getSession() as unknown as SessionLike | null;

    if (placement.redoRequested) {
      placement.redoRequested = false;
      this.redo();
    }
    switch (placement.status) {
      case 'idle':
        return;
      case 'restoring': {
        this.elapsed += dt;
        if (!this.anchorPending && session && placement.savedHandle && !this.anchors.anchor) {
          this.anchorPending = true;
          void this.anchors.restore(session, placement.savedHandle).finally(() => {
            this.anchorPending = false;
          });
        }
        const m = frame && space ? this.anchors.poseMatrix(frame, space) : null;
        if (m) {
          this.applyMatrix(board, m);
          board.visible = true;
          placement.status = 'placed';
          placement.mode = 'restored';
          placement.label = 'restored';
          this.elapsed = 0;
          return;
        }
        if (this.elapsed >= RESTORE_WAIT_S) {
          if (session) void this.anchors.forget(session, placement.savedHandle);
          placement.savedHandle = null;
          placement.status = 'searching';
          this.elapsed = 0;
        }
        return;
      }
      case 'searching':
      case 'candidate': {
        this.elapsed += dt;
        this.scanTimer -= dt;
        if (this.scanTimer <= 0) {
          this.scanTimer = 0.5;
          this.headPose();
          const best = this.findBest();
          if (best) {
            this.candidate = best;
            this.poseOnCandidate(board, best);
            board.visible = true;
            placement.status = 'candidate';
            placement.label = best.label;
            this.setProxyInteractive(true);
          }
        }
        if (placement.status === 'searching' && this.elapsed >= FALLBACK_AFTER_S) {
          this.headPose();
          this.poseFallback(board);
          board.visible = true;
          this.confirm('fallback');
        }
        return;
      }
      case 'placed': {
        const handle = this.handle?.object3D;
        const grabbed = this.queries.grabbedHandles.entities.size > 0;
        if (handle) {
          if (grabbed) {
            // The board follows the bar; it stays level and keeps facing the player.
            board.position.copy(handle.position).sub(this.tmp.copy(this.handleOffset).applyQuaternion(board.quaternion));
            board.position.y = Math.max(0.3, board.position.y);
          } else {
            handle.position.copy(board.position).add(this.tmp.copy(this.handleOffset).applyQuaternion(board.quaternion));
            handle.quaternion.copy(board.quaternion);
          }
        }
        if (!grabbed && frame && space) {
          const m = this.anchors.poseMatrix(frame, space);
          if (m) this.applyMatrix(board, m);
        }
        return;
      }
    }
  }

  /** The bar is released: anchor the board where it now stands. */
  reanchor(): void {
    const board = this.board?.object3D;
    if (board) this.placeAnchor(board);
  }

  /** Place again from the pause card. */
  redo(): void {
    this.elapsed = 0;
    this.scanTimer = 0;
    this.candidate = null;
    placement.status = 'searching';
    placement.mode = 'none';
  }

  private confirm(mode: PlacementMode): void {
    const board = this.board?.object3D;
    if (!board) return;
    placement.status = 'placed';
    placement.mode = mode;
    this.setProxyInteractive(false);
    this.elapsed = 0;
    const handle = this.handle?.object3D;
    if (handle) {
      handle.visible = mode === 'fallback';
      handle.position.copy(board.position).add(this.tmp.copy(this.handleOffset).applyQuaternion(board.quaternion));
      handle.quaternion.copy(board.quaternion);
    }
    this.placeAnchor(board);
  }

  private placeAnchor(board: { position: Vector3; quaternion: Quaternion }): void {
    const xr = this.renderer.xr;
    const frame = xr.getFrame() as unknown as FrameLike | null;
    const space = xr.getReferenceSpace() as unknown as SpaceLike | null;
    const session = xr.getSession() as unknown as SessionLike | null;
    if (!frame || !space || !session || !AnchorService.supported(frame)) return;
    const pose = {
      position: { x: board.position.x, y: board.position.y, z: board.position.z },
      quaternion: { x: board.quaternion.x, y: board.quaternion.y, z: board.quaternion.z, w: board.quaternion.w },
    };
    void this.anchors.place(frame, session, space, pose, placement.savedHandle).then((ok) => {
      if (ok) placement.savedHandle = this.anchors.handle;
    });
  }

  private applyMatrix(board: { position: Vector3; quaternion: Quaternion; scale: Vector3 }, m: Float32Array | number[]): void {
    this.mat.fromArray(m as number[]);
    const scale = board.scale.x;
    this.mat.decompose(board.position, board.quaternion, this.tmp2);
    board.scale.setScalar(scale);
  }

  private ceilingCheck = 0;

  /** About once a second: the lowest plane labeled ceiling, if the room has one. */
  private findCeiling(dt: number): void {
    this.ceilingCheck -= dt;
    if (this.ceilingCheck > 0) return;
    this.ceilingCheck = 1;
    let ceiling: number | null = null;
    for (const entity of this.queries.planes.entities) {
      const plane = entity.getValue(XRPlane, '_plane') as { orientation?: string; semanticLabel?: string } | undefined;
      const object = entity.object3D;
      if (!plane || !object || plane.orientation !== 'horizontal' || plane.semanticLabel !== 'ceiling') continue;
      object.getWorldPosition(this.tmp2);
      if (ceiling === null || this.tmp2.y < ceiling) ceiling = this.tmp2.y;
    }
    placement.ceilingY = ceiling;
  }

  private findBest(): Candidate | null {
    const found: Candidate[] = [];
    for (const entity of this.queries.planes.entities) {
      const plane = entity.getValue(XRPlane, '_plane') as
        | { orientation?: string; polygon?: DOMPointReadOnly[]; semanticLabel?: string }
        | undefined;
      const object = entity.object3D;
      if (!plane || !object || plane.orientation !== 'horizontal' || !plane.polygon?.length) continue;
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const p of plane.polygon) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
      }
      object.updateWorldMatrix(true, false);
      const c = this.makeCandidate(object.matrixWorld, (minX + maxX) / 2, 0, (minZ + maxZ) / 2, (maxX - minX) / 2, (maxZ - minZ) / 2, plane.semanticLabel ?? 'plane');
      if (c) found.push(c);
    }
    for (const entity of this.queries.meshes.entities) {
      const label = String(entity.getValue(XRMesh, 'semanticLabel') ?? '').toLowerCase();
      const object = entity.object3D;
      if (!object || !entity.getValue(XRMesh, 'isBounded3D')) continue;
      if (label !== 'table' && label !== 'desk') continue;
      const min = entity.getVectorView(XRMesh, 'min');
      const max = entity.getVectorView(XRMesh, 'max');
      object.updateWorldMatrix(true, false);
      const c = this.makeCandidate(object.matrixWorld, (min[0] + max[0]) / 2, max[1], (min[2] + max[2]) / 2, (max[0] - min[0]) / 2, (max[2] - min[2]) / 2, label);
      if (c) found.push(c);
    }
    placement.candidates = found.length;
    found.sort((a, b) => b.score - a.score);
    return found[0] ?? null;
  }

  /** A candidate surface from a local rectangle in an object's space, or null if unsuitable. */
  private makeCandidate(world: Matrix4, cx: number, cy: number, cz: number, halfX: number, halfZ: number, label: string): Candidate | null {
    const center = new Vector3(cx, cy, cz).applyMatrix4(world);
    const axisX = new Vector3().setFromMatrixColumn(world, 0);
    const axisY = new Vector3().setFromMatrixColumn(world, 1);
    const axisZ = new Vector3().setFromMatrixColumn(world, 2);
    const sx = axisX.length();
    const sz = axisZ.length();
    axisX.normalize();
    axisY.normalize();
    axisZ.normalize();
    if (axisY.dot(UP) < 0.9) return null;
    if (center.y < MIN_HEIGHT || center.y > MAX_HEIGHT) return null;
    const hx = halfX * sx;
    const hz = halfZ * sz;
    const { widthM, depthM } = placement.footprint;
    const fits = (hx * 2 >= widthM + EDGE_MARGIN && hz * 2 >= depthM + EDGE_MARGIN) || (hz * 2 >= widthM + EDGE_MARGIN && hx * 2 >= depthM + EDGE_MARGIN);
    if (!fits) return null;
    // Horizontal distance from the head to the nearest point of the rectangle.
    const d = this.tmp.copy(this.head).sub(center);
    const lx = Math.max(-hx, Math.min(hx, d.dot(axisX)));
    const lz = Math.max(-hz, Math.min(hz, d.dot(axisZ)));
    const nearest = this.tmp2.copy(center).addScaledVector(axisX, lx).addScaledVector(axisZ, lz);
    const dx = nearest.x - this.head.x;
    const dz = nearest.z - this.head.z;
    const distance = Math.hypot(dx, dz);
    if (distance > MAX_DISTANCE) return null;
    const toCenter = Math.hypot(center.x - this.head.x, center.z - this.head.z) || 1;
    const front = ((center.x - this.head.x) * this.forward.x + (center.z - this.head.z) * this.forward.z) / toCenter;
    if (front < -0.2) return null;
    const isTable = label === 'table' || label === 'desk';
    const score = -distance - 0.8 * Math.abs(center.y - 0.74) + front * 0.3 + (isTable ? 0.3 : 0);
    return { center, axisX, axisZ, halfX: hx, halfZ: hz, label, score };
  }

  /** Board on a surface: edges parallel to the table's, near edge on the player's side. */
  private poseOnCandidate(board: { position: Vector3; quaternion: Quaternion }, c: Candidate): void {
    const toHead = this.tmp.copy(this.head).sub(c.center);
    toHead.y = 0;
    const { widthM, depthM } = placement.footprint;
    const options = [
      { z: c.axisZ, x: c.axisX, ez: c.halfZ, ex: c.halfX },
      { z: c.axisZ.clone().negate(), x: c.axisX.clone().negate(), ez: c.halfZ, ex: c.halfX },
      { z: c.axisX, x: c.axisZ.clone().negate(), ez: c.halfX, ex: c.halfZ },
      { z: c.axisX.clone().negate(), x: c.axisZ, ez: c.halfX, ex: c.halfZ },
    ];
    let best = options[0];
    let bestScore = -Infinity;
    for (const o of options) {
      const fits = o.ex * 2 >= widthM + EDGE_MARGIN && o.ez * 2 >= depthM + EDGE_MARGIN;
      const score = o.z.dot(toHead) + (fits ? 10 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = o;
      }
    }
    const along = Math.max(0, best.ez - depthM / 2 - EDGE_MARGIN);
    const sideRoom = Math.max(0, best.ex - widthM / 2 - EDGE_MARGIN);
    const side = Math.max(-sideRoom, Math.min(sideRoom, toHead.dot(best.x)));
    board.position.copy(c.center).addScaledVector(best.z, along).addScaledVector(best.x, side);
    board.position.y = c.center.y;
    board.quaternion.setFromAxisAngle(UP, Math.atan2(best.z.x, best.z.z));
  }

  /** Seated fallback: 47 cm ahead, 45 cm below the eyes, facing the player. */
  private poseFallback(board: { position: Vector3; quaternion: Quaternion }): void {
    board.position.copy(this.head).addScaledVector(this.forward, 0.47);
    board.position.y = Math.min(1.3, Math.max(0.45, this.head.y - 0.45));
    board.quaternion.setFromAxisAngle(UP, Math.atan2(-this.forward.x, -this.forward.z));
  }
}
