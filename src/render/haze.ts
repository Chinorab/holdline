// Room haze: a warm grey veil around the player's head that follows the amount of burning,
// up to a light tint (alpha 0.12), and clears within seconds of containment. It eases both
// ways, so it never flashes.

import { BackSide, Mesh, MeshBasicMaterial, SphereGeometry } from '@iwsdk/core';
import { HEX } from './palette.js';

const MAX_ALPHA = 0.12;
/** Burning cells for the full tint. */
const FULL_CELLS = 260;
/** Easing time constants, seconds: slow to build, quicker to clear. */
const RISE_S = 4;
const CLEAR_S = 1.5;

export class Haze {
  readonly mesh: Mesh;
  private readonly material: MeshBasicMaterial;
  private alpha = 0;

  constructor() {
    this.material = new MeshBasicMaterial({
      color: HEX.haze,
      transparent: true,
      opacity: 0,
      side: BackSide,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(new SphereGeometry(0.3, 16, 12), this.material);
    this.mesh.name = 'RoomHaze';
    this.mesh.renderOrder = 20;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  get level(): number {
    return this.alpha;
  }

  /** dt is zero while paused: the haze holds. */
  update(dt: number, burning: number, active: boolean): void {
    const target = active ? MAX_ALPHA * Math.min(1, burning / FULL_CELLS) : 0;
    const tau = target > this.alpha ? RISE_S : CLEAR_S;
    this.alpha += (target - this.alpha) * Math.min(1, dt / tau);
    if (this.alpha < 0.001 && target === 0) this.alpha = 0;
    this.material.opacity = this.alpha;
    this.mesh.visible = this.alpha > 0;
  }
}
