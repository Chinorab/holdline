// A ring that fills while a pinch is held (backburn: 1 s on a dug line).

import { DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from '@iwsdk/core';
import { color } from './palette.js';

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uFill;
uniform vec3 uFire;
uniform vec3 uTrack;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0 || r < 0.68) discard;
  // Clockwise from the top, as seen from above.
  float a = atan(p.x, p.y);
  float t = (a < 0.0 ? a + 6.2831853 : a) / 6.2831853;
  gl_FragColor = vec4(t <= uFill ? uFire : uTrack, 1.0);
  #include <colorspace_fragment>
}
`;

export class HoldRing {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;

  constructor(sizeM = 0.022) {
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uFill: { value: 0 }, uFire: { value: color('fire') }, uTrack: { value: color('card') } },
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });
    this.mesh = new Mesh(new PlaneGeometry(sizeM, sizeM).rotateX(-Math.PI / 2), this.material);
    this.mesh.name = 'HoldRing';
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
  }

  show(x: number, y: number, z: number): void {
    this.mesh.position.set(x, y + 0.004, z);
    this.setFill(0);
    this.mesh.visible = true;
  }

  setFill(t: number): void {
    this.material.uniforms.uFill.value = Math.min(1, Math.max(0, t));
  }

  hide(): void {
    this.mesh.visible = false;
  }
}
