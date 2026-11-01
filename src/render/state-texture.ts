// Cell textures sampled by the board shader. Fuel masks never change during a run; the
// fire texture is rebuilt from each worker frame, the previous one kept for blending.

import { ClampToEdgeWrapping, DataTexture, LinearFilter, RGBAFormat, UnsignedByteType } from '@iwsdk/core';
import { H, N, W } from '../sim/grid.js';
import { CellState, Fuel } from '../sim/types.js';

function makeTexture(data: Uint8Array): DataTexture {
  const texture = new DataTexture(data, W, H, RGBAFormat, UnsignedByteType);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

export class CellTextures {
  readonly fuelA = makeTexture(new Uint8Array(N * 4));
  readonly fuelB = makeTexture(new Uint8Array(N * 4));
  readonly fire = makeTexture(new Uint8Array(N * 4));
  readonly firePrev = makeTexture(new Uint8Array(N * 4));

  setFuel(fuel: Uint8Array): void {
    const a = this.fuelA.image.data as Uint8Array;
    const b = this.fuelB.image.data as Uint8Array;
    a.fill(0);
    b.fill(0);
    for (let i = 0; i < N; i++) {
      const o = i * 4;
      switch (fuel[i]) {
        case Fuel.Grass: a[o] = 255; break;
        case Fuel.Shrub: a[o + 1] = 255; break;
        case Fuel.Forest: a[o + 2] = 255; break;
        case Fuel.Rock: a[o + 3] = 255; break;
        case Fuel.Water: b[o] = 255; break;
        case Fuel.Road: b[o + 1] = 255; break;
        case Fuel.Structure: b[o + 2] = 255; break;
      }
    }
    this.fuelA.needsUpdate = true;
    this.fuelB.needsUpdate = true;
  }

  /** Keep the current fire state as the blend source. */
  pushPrevious(): void {
    (this.firePrev.image.data as Uint8Array).set(this.fire.image.data as Uint8Array);
    this.firePrev.needsUpdate = true;
  }

  /** Fire texture from a packed worker state (R fuel | state << 3, G age, B wet, A flags). */
  setFireFromState(packed: Uint8Array): void {
    const out = this.fire.image.data as Uint8Array;
    for (let i = 0; i < N; i++) {
      const o = i * 4;
      const state = packed[o] >> 3;
      const age = packed[o + 1];
      out[o] = state === CellState.Burning ? 255 : 0;
      out[o + 1] = state === CellState.Burned ? 255 : 0;
      out[o + 2] = packed[o + 2];
      out[o + 3] = state === CellState.Burning ? Math.max(0, 255 - age * 110) : 0;
    }
    this.fire.needsUpdate = true;
  }

  /** Fire texture at a step of a finished run, for the time lapse. */
  setFireFromTimes(ignitedAt: Int32Array, burnedAt: Int32Array, step: number): void {
    const out = this.fire.image.data as Uint8Array;
    for (let i = 0; i < N; i++) {
      const o = i * 4;
      const ig = ignitedAt[i];
      const bu = burnedAt[i];
      const burned = bu >= 0 && bu <= step;
      const burning = !burned && ig >= 0 && ig <= step;
      out[o] = burning ? 255 : 0;
      out[o + 1] = burned ? 255 : 0;
      out[o + 2] = 0;
      out[o + 3] = burning ? Math.max(0, 255 - (step - ig) * 110) : 0;
    }
    this.fire.needsUpdate = true;
  }

  dispose(): void {
    this.fuelA.dispose();
    this.fuelB.dispose();
    this.fire.dispose();
    this.firePrev.dispose();
  }
}
