// A small ink wind vane on a post at the board's near left corner, pointing downwind and
// turning smoothly when the wind shifts.

import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial } from '@iwsdk/core';
import { color } from './palette.js';

export class WindVane {
  readonly root = new Group();
  private readonly head = new Group();
  private current = 0;
  private target = 0;

  constructor() {
    this.root.name = 'WindVane';
    const ink = new MeshBasicMaterial({ color: color('ink') });
    const post = new Mesh(new CylinderGeometry(0.0012, 0.0016, 0.05, 6).translate(0, 0.025, 0), ink);
    const shaft = new Mesh(new BoxGeometry(0.0022, 0.0022, 0.03), ink);
    const tip = new Mesh(new ConeGeometry(0.004, 0.009, 4).rotateX(-Math.PI / 2).translate(0, 0, -0.0195), ink);
    const fin = new Mesh(new BoxGeometry(0.0008, 0.007, 0.008).translate(0, 0, 0.013), ink);
    this.head.position.y = 0.05;
    this.head.add(shaft, tip, fin);
    this.root.add(post, this.head);
  }

  /** Compass degrees the wind blows toward (0 = far edge). */
  setDirection(dirDeg: number, immediate = false): void {
    this.target = (-dirDeg * Math.PI) / 180;
    if (immediate) this.current = this.target;
  }

  update(dt: number): void {
    let d = this.target - this.current;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    this.current += d * Math.min(1, dt * 1.5);
    this.head.rotation.y = this.current;
  }
}
