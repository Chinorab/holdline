// The ghost hand: a paper cutout right hand, palm down above the board, that shows a gesture
// once and again: a pinch on a spot (tap), a pinch dragged along a path (drag), or a pinch
// held (hold). Two frames, open and pinch; the pinch point sits on the path.

import { BufferAttribute, BufferGeometry, CircleGeometry, DoubleSide, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, Shape, ShapeGeometry, Vector2 } from '@iwsdk/core';
import { HEX } from './palette.js';

export type GhostMode = 'tap' | 'drag' | 'hold';

const HOVER_M = 0.045;
const PINCH_M = 0.012;

// Hand outline in meters, x right, y toward the fingertips; the pinch point is the origin.
const P = (x: number, y: number) => new Vector2(x + 0.019, y + 0.016);
const PALM = [P(-0.012, -0.075), P(0.026, -0.075), P(0.028, -0.04), P(-0.012, -0.034)];
const FINGERS_OPEN = [
  [P(-0.012, -0.036), P(-0.003, -0.036), P(-0.004, 0.0), P(-0.011, 0.0)],
  [P(-0.002, -0.036), P(0.007, -0.036), P(0.006, 0.004), P(-0.001, 0.004)],
  [P(0.008, -0.036), P(0.017, -0.036), P(0.016, 0.001), P(0.009, 0.001)],
  [P(0.018, -0.038), P(0.026, -0.038), P(0.025, -0.008), P(0.019, -0.008)],
];
const THUMB_OPEN = [P(-0.012, -0.07), P(-0.012, -0.05), P(-0.028, -0.03), P(-0.035, -0.036)];
const FINGERS_PINCH = [
  [P(-0.012, -0.036), P(-0.003, -0.036), P(-0.016, -0.014), P(-0.022, -0.019)],
  FINGERS_OPEN[1],
  FINGERS_OPEN[2],
  FINGERS_OPEN[3],
];
const THUMB_PINCH = [P(-0.012, -0.07), P(-0.012, -0.05), P(-0.017, -0.014), P(-0.023, -0.018)];

function frame(parts: Vector2[][], fill: MeshBasicMaterial, ink: LineBasicMaterial): Group {
  const group = new Group();
  const shapes = parts.map((pts) => new Shape(pts));
  group.add(new Mesh(new ShapeGeometry(shapes).rotateX(-Math.PI / 2), fill));
  for (const pts of parts) {
    const loop = [...pts, pts[0]].map((p) => [p.x, 0.0004, -p.y]).flat();
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(loop), 3));
    group.add(new Line(geometry, ink));
  }
  for (const child of group.children) child.renderOrder = 5;
  return group;
}

export class GhostHand {
  readonly root = new Group();
  private readonly open: Group;
  private readonly pinch: Group;
  private readonly dot: Mesh;
  private path: { x: number; y: number; z: number }[] = [];
  private mode: GhostMode = 'tap';
  private t = 0;
  private playing = false;

  constructor() {
    this.root.name = 'GhostHand';
    const fill = new MeshBasicMaterial({ color: HEX.card, transparent: true, opacity: 0.88, depthTest: false, depthWrite: false, side: DoubleSide });
    const ink = new LineBasicMaterial({ color: HEX.ink, depthTest: false, depthWrite: false });
    this.open = frame([PALM, ...FINGERS_OPEN, THUMB_OPEN], fill, ink);
    this.pinch = frame([PALM, ...FINGERS_PINCH, THUMB_PINCH], fill, ink);
    this.dot = new Mesh(new CircleGeometry(0.0035, 16).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: HEX.fire, depthTest: false, depthWrite: false }));
    this.dot.renderOrder = 6;
    this.root.add(this.open, this.pinch, this.dot);
    this.root.visible = false;
  }

  get active(): boolean {
    return this.playing;
  }

  /** Board local points (y is the ground height there) the pinch point follows. */
  play(path: { x: number; y: number; z: number }[], mode: GhostMode): void {
    this.path = path;
    this.mode = mode;
    this.t = 0;
    this.playing = path.length > 0;
    this.root.visible = this.playing;
  }

  stop(): void {
    this.playing = false;
    this.root.visible = false;
  }

  update(dt: number): void {
    if (!this.playing) return;
    this.t += dt;
    // One loop: come down open, pinch, act, open, rise, rest.
    const act = this.mode === 'drag' ? 1.6 : this.mode === 'hold' ? 1.3 : 0.25;
    const down = 0.6;
    const pinchAt = down + 0.15;
    const releaseAt = pinchAt + act;
    const period = releaseAt + 1.1;
    const t = this.t % period;
    let height = HOVER_M;
    if (t < down) height = HOVER_M - (HOVER_M - PINCH_M) * (t / down);
    else if (t < releaseAt + 0.15) height = PINCH_M;
    else if (t < releaseAt + 0.75) height = PINCH_M + (HOVER_M - PINCH_M) * ((t - releaseAt - 0.15) / 0.6);
    const pinched = t >= pinchAt && t < releaseAt;
    const along = this.mode === 'drag' ? Math.min(1, Math.max(0, (t - pinchAt) / act)) : 0;
    this.pointAt(along);
    this.root.position.y += height;
    this.open.visible = !pinched;
    this.pinch.visible = pinched;
    this.dot.visible = pinched;
  }

  private pointAt(u: number): void {
    const n = this.path.length;
    if (n === 1) {
      const p = this.path[0];
      this.root.position.set(p.x, p.y, p.z);
      return;
    }
    const f = u * (n - 1);
    const k = Math.min(n - 2, Math.floor(f));
    const s = f - k;
    const a = this.path[k];
    const b = this.path[k + 1];
    this.root.position.set(a.x + (b.x - a.x) * s, Math.max(a.y, b.y), a.z + (b.z - a.z) * s);
  }
}
