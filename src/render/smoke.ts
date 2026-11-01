// Smoke: up to 200 soft billboards rising from burning cells and drifting with the game
// wind past the board edge into the room, fading out within about 1.5 m. One puff in five
// joins a plume that rises into the room; under a detected ceiling it stops and spreads.

import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from '@iwsdk/core';
import { W } from '../sim/grid.js';
import type { BoardDims } from './dims.js';
import { color } from './palette.js';

export const MAX_PUFFS = 200;

const vertexShader = /* glsl */ `
attribute float aAlpha;
varying float vAlpha;
varying vec2 vUv;
void main() {
  mat4 m = modelMatrix * instanceMatrix;
  vec3 center = m[3].xyz;
  float s = length(m[0].xyz);
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 p = center + (camRight * (uv.x - 0.5) + camUp * (uv.y - 0.5)) * s;
  vAlpha = aAlpha;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 cSmoke;
varying float vAlpha;
varying vec2 vUv;
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  float a = (1.0 - r2) * (1.0 - r2) * vAlpha;
  gl_FragColor = vec4(cSmoke, a);
  #include <colorspace_fragment>
}
`;

interface Puff {
  x: number;
  y: number;
  z: number;
  age: number;
  life: number;
  size0: number;
  size1: number;
  rise: number;
  plume: boolean;
}

/** Plume puffs fade above this height over the board when no ceiling is known (m). */
const PLUME_TOP_M = 1.4;

export class Smoke {
  readonly mesh: InstancedMesh;
  private readonly alpha: InstancedBufferAttribute;
  private readonly puffs: Puff[] = [];
  private spawnDebt = 0;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly t = new Vector3();
  private readonly s = new Vector3();
  /** Wind on the board, local x and z, in board meters per second of drift. */
  private windX = 0;
  private windZ = 0;
  /** Ceiling height in board space, or Infinity when none was detected. */
  ceilingY = Infinity;
  private spawned = 0;

  constructor(private readonly dims: BoardDims) {
    const material = new ShaderMaterial({
      uniforms: { cSmoke: { value: color('smoke') } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    const geometry = new PlaneGeometry(1, 1).translate(0.5, 0.5, 0);
    this.alpha = new InstancedBufferAttribute(new Float32Array(MAX_PUFFS), 1);
    this.alpha.setUsage(DynamicDrawUsage);
    geometry.setAttribute('aAlpha', this.alpha);
    this.mesh = new InstancedMesh(geometry, material, MAX_PUFFS);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.name = 'Smoke';
  }

  setWind(speedMs: number, dirDeg: number): void {
    const r = (dirDeg * Math.PI) / 180;
    const drift = 0.006 + speedMs * 0.0022;
    this.windX = Math.sin(r) * drift;
    this.windZ = -Math.cos(r) * drift;
  }

  clear(): void {
    this.puffs.length = 0;
    this.mesh.count = 0;
  }

  /**
   * Advance puffs. sources: burning cells to emit from (count of them), cellHeight for the
   * ground. Emission grows with the number of burning cells.
   */
  update(dt: number, sources: Int32Array, count: number, cellHeight: Float32Array): void {
    if (count > 0) {
      const rate = Math.min(34, 3 + count * 0.25);
      this.spawnDebt += rate * dt;
      while (this.spawnDebt >= 1 && this.puffs.length < MAX_PUFFS) {
        this.spawnDebt -= 1;
        const c = sources[Math.floor(Math.random() * count)];
        const x = c % W;
        const y = (c - x) / W;
        const plume = this.spawned++ % 5 === 0;
        this.puffs.push({
          x: this.dims.xOf(x) + (Math.random() - 0.5) * 0.004,
          y: cellHeight[c] + 0.006,
          z: this.dims.zOf(y) + (Math.random() - 0.5) * 0.004,
          age: 0,
          life: 6 + Math.random() * 3,
          size0: 0.006 + Math.random() * 0.004,
          size1: 0.05 + Math.random() * 0.03,
          rise: plume ? 0.14 + Math.random() * 0.04 : 0.012 + Math.random() * 0.01,
          plume,
        });
        // A plume reaches a ceiling about 2 m above the table in some 12 s, then spreads.
        if (plume) this.puffs[this.puffs.length - 1].life = 18 + Math.random() * 4;
      }
      if (this.spawnDebt > 1) this.spawnDebt = 1;
    }
    let n = 0;
    for (let k = this.puffs.length - 1; k >= 0; k--) {
      const p = this.puffs[k];
      p.age += dt;
      if (p.age >= p.life) {
        this.puffs[k] = this.puffs[this.puffs.length - 1];
        this.puffs.pop();
        continue;
      }
      const lift = Math.min(1, p.age / 2);
      // Under the ceiling a plume stops rising and spreads with the wind, faster.
      const capped = p.y >= this.ceilingY - 0.04;
      const spread = capped ? 2.5 : 1;
      p.x += this.windX * dt * lift * spread;
      p.z += this.windZ * dt * lift * spread;
      if (capped) {
        p.y = this.ceilingY - 0.04;
        p.size1 = Math.min(0.3, p.size1 + dt * 0.03);
      } else p.y += p.rise * dt;
    }
    for (const p of this.puffs) {
      const u = p.age / p.life;
      const size = p.size0 + (p.size1 - p.size0) * Math.sqrt(u);
      const fadeIn = Math.min(1, p.age / 0.6);
      const fadeFrom = p.plume ? 0.8 : 0.6;
      const fadeOut = u > fadeFrom ? 1 - (u - fadeFrom) / (1 - fadeFrom) : 1;
      // Fade with distance from the board: sideways for every puff, upward for low puffs,
      // and for plumes near the top of the room.
      const side = Math.hypot(p.x, p.z);
      const dist = p.plume ? side : Math.hypot(p.x, p.y, p.z);
      const roomFade = dist > 1.0 ? Math.max(0, 1 - (dist - 1.0) / 0.5) : 1;
      const top = Math.min(this.ceilingY, PLUME_TOP_M);
      const topFade = p.plume && this.ceilingY === Infinity && p.y > top - 0.3 ? Math.max(0, (top - p.y) / 0.3) : 1;
      this.t.set(p.x, p.y, p.z);
      this.s.set(size, size, size);
      this.m.compose(this.t, this.q, this.s);
      this.mesh.setMatrixAt(n, this.m);
      this.alpha.setX(n, (p.plume ? 0.26 : 0.38) * fadeIn * fadeOut * roomFade * topFade);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.alpha.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as ShaderMaterial).dispose();
    this.mesh.dispose();
  }
}
