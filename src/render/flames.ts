// Standing paper flames on burning cells: alpha tested instanced cards that turn to face the
// viewer around their vertical axis, with a light core and an ink outline. Gentle sway at
// 0.8 Hz, no flicker.

import { DoubleSide, InstancedMesh, Matrix4, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from '@iwsdk/core';
import { W } from '../sim/grid.js';
import { Fuel } from '../sim/types.js';
import type { BoardDims } from './dims.js';
import { color } from './palette.js';

export const MAX_FLAMES = 400;

const vertexShader = /* glsl */ `
uniform vec3 uCamPos;
uniform float uTime;
varying vec2 vUv;
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  vec3 center = m[3].xyz;
  float w = length(m[0].xyz);
  float h = length(m[1].xyz);
  vec3 up = normalize(m[1].xyz);
  vec3 toCam = uCamPos - center;
  vec3 right = normalize(cross(up, toCam));
  float phase = fract(sin(dot(center.xz, vec2(127.1, 311.7))) * 43758.5453) * 6.2831;
  float sway = sin(uTime * 5.0 + phase) * 0.1 * uv.y * uv.y;
  vec3 p = center + right * ((uv.x - 0.5 + sway) * w) + up * (uv.y * h);
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 cFire;
uniform vec3 cCore;
uniform vec3 cInk;
varying vec2 vUv;
void main() {
  float x = abs(vUv.x - 0.5) * 2.0;
  float y = vUv.y;
  float halfWidth = pow(max(1.0 - y, 0.0), 0.8) * sqrt(max(y, 0.0)) * 1.55;
  float d = x / max(halfWidth, 0.0001);
  if (d > 1.0 || y > 0.985) discard;
  vec3 c = d > 0.74 ? cInk : (d < 0.42 && y < 0.62 ? cCore : cFire);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;

const HEIGHT_BY_FUEL = [0.9, 1.25, 1.9, 0, 0, 0, 2.2];

export class Flames {
  readonly mesh: InstancedMesh;
  readonly material: ShaderMaterial;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly t = new Vector3();
  private readonly s = new Vector3();

  constructor(private readonly dims: BoardDims) {
    this.material = new ShaderMaterial({
      uniforms: {
        uCamPos: { value: new Vector3() },
        uTime: { value: 0 },
        cFire: { value: color('fire') },
        cCore: { value: color('core') },
        cInk: { value: color('ink') },
      },
      vertexShader,
      fragmentShader,
      side: DoubleSide,
    });
    const geometry = new PlaneGeometry(1, 1).translate(0.5, 0.5, 0);
    // UVs of a translated plane stay 0..1; positions are rebuilt in the shader from uv.
    this.mesh = new InstancedMesh(geometry, this.material, MAX_FLAMES);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'Flames';
  }

  /**
   * Place flames on burning cells. cells: burning cell indices; ages: steps since ignition.
   * When more than MAX_FLAMES burn, every k th one stands.
   */
  set(cells: Int32Array, count: number, ages: Uint8Array, fuel: Uint8Array, cellHeight: Float32Array): void {
    const cellM = this.dims.widthM / W;
    const stride = Math.max(1, Math.ceil(count / MAX_FLAMES));
    let n = 0;
    for (let k = 0; k < count && n < MAX_FLAMES; k += stride) {
      const c = cells[k];
      const x = c % W;
      const y = (c - x) / W;
      const f = fuel[c];
      const fresh = ages[c] <= 1 ? 1.15 : ages[c] > 5 ? 0.75 : 1;
      const h = cellM * (HEIGHT_BY_FUEL[f] ?? 1) * fresh * (stride > 1 ? 1.1 : 1);
      this.t.set(this.dims.xOf(x), cellHeight[c] + (f === Fuel.Forest ? cellM * 0.2 : 0), this.dims.zOf(y));
      this.s.set(h * 0.62, h, 1);
      this.m.compose(this.t, this.q, this.s);
      this.mesh.setMatrixAt(n++, this.m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(time: number, camWorld: Vector3): void {
    this.material.uniforms.uTime.value = time;
    (this.material.uniforms.uCamPos.value as Vector3).copy(camWorld);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
