// Glasses view: on a Quest, darken everything outside the Meta VR Glasses field of view
// (37 degrees left and right, 25 up, 43 down), so a player or a designer sees what fits on
// the glasses. A frame fixed in front of the eyes; off by default. With Glasses view on, or
// on a headset with tracked gaze (the glasses themselves), the game uses its compact layout.

import { Mesh, MeshBasicMaterial, Path, Shape, ShapeGeometry, type Object3D } from '@iwsdk/core';
import { HEX } from '../render/palette.js';

export const GLASSES_FOV_DEG = { left: 37, right: 37, up: 25, down: 43 } as const;
const DISTANCE_M = 0.3;
const OUTER_M = 3;

export class GlassesView {
  readonly mesh: Mesh;

  constructor(head: Object3D) {
    const t = (deg: number) => DISTANCE_M * Math.tan((deg * Math.PI) / 180);
    const shape = new Shape();
    shape.moveTo(-OUTER_M, -OUTER_M);
    shape.lineTo(OUTER_M, -OUTER_M);
    shape.lineTo(OUTER_M, OUTER_M);
    shape.lineTo(-OUTER_M, OUTER_M);
    shape.lineTo(-OUTER_M, -OUTER_M);
    const hole = new Path();
    const l = -t(GLASSES_FOV_DEG.left);
    const r = t(GLASSES_FOV_DEG.right);
    const u = t(GLASSES_FOV_DEG.up);
    const d = -t(GLASSES_FOV_DEG.down);
    hole.moveTo(l, d);
    hole.lineTo(l, u);
    hole.lineTo(r, u);
    hole.lineTo(r, d);
    hole.lineTo(l, d);
    shape.holes.push(hole);
    this.mesh = new Mesh(
      new ShapeGeometry(shape).translate(0, 0, -DISTANCE_M),
      new MeshBasicMaterial({ color: HEX.ink, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }),
    );
    this.mesh.name = 'GlassesMask';
    this.mesh.renderOrder = 40;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    head.add(this.mesh);
  }

  set visible(on: boolean) {
    this.mesh.visible = on;
  }
}
