// The board shader: fuel colors with smooth class borders, paper risers as contour lines
// (every fifth darker), the fire front with a light core and an ink edge (readable without
// hue), burned ash, wet hatch and a slow grass sway in the wind.

import { DoubleSide, ShaderMaterial, Vector2, type Color, type Texture } from '@iwsdk/core';
import { HEX, HEX_HIGH_CONTRAST, color, type PaletteKey } from './palette.js';

const vertexShader = /* glsl */ `
attribute float aLayer;
attribute float aKind;
uniform float uRiseH;
uniform float uPlinth;
varying vec2 vUv;
varying vec3 vPos;
varying float vLayer;
varying float vKind;
void main() {
  vec3 p = position;
  if (p.y > uPlinth) p.y = uPlinth + min(p.y - uPlinth, uRiseH);
  vUv = uv;
  vPos = p;
  vLayer = aLayer;
  vKind = aKind;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uFuelA;
uniform sampler2D uFuelB;
uniform sampler2D uFire;
uniform sampler2D uFirePrev;
uniform float uBlend;
uniform float uTime;
uniform float uPlinth;
uniform float uLayerM;
uniform vec2 uWind;
uniform float uInkGain;
uniform float uEdgeW;
uniform float uWindStrength;
uniform vec3 cGrass, cBrush, cForest, cRock, cWater, cRoad, cYard;
uniform vec3 cInk, cGraphite, cCard, cBoard, cFire, cCore, cBurned, cAsh, cWet;
varying vec2 vUv;
varying vec3 vPos;
varying float vLayer;
varying float vKind;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec3 c;
  if (vKind > 0.5) {
    // Board side: the stacked paper section.
    if (vPos.y < uPlinth) {
      c = vPos.y < 0.0015 ? cInk : cCard;
    } else {
      float l = (vPos.y - uPlinth) / uLayerM;
      c = mod(floor(l), 2.0) < 0.5 ? cCard : cBoard;
      if (fract(l) < 0.14) c = mix(c, cGraphite, 0.45);
    }
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
    return;
  }

  vec4 a = texture2D(uFuelA, vUv);
  vec4 b = texture2D(uFuelB, vUv);
  float w = a.r; c = cGrass;
  if (a.g > w) { w = a.g; c = cBrush; }
  if (a.b > w) { w = a.b; c = cForest; }
  if (a.a > w) { w = a.a; c = cRock; }
  if (b.r > w) { w = b.r; c = cWater; }
  if (b.g > w) { w = b.g; c = cRoad; }
  if (b.b > w) { w = b.b; c = cYard; }
  // Ink casing along roads and river banks.
  float casing = max(1.0 - smoothstep(0.08, 0.2, abs(b.g - 0.42)), 1.0 - smoothstep(0.08, 0.2, abs(b.r - 0.42)));
  c = mix(c, cInk, min(1.0, casing * 0.75 * uInkGain) * step(0.2, max(b.r, b.g)));
  // Grass sway: faint bands drifting downwind.
  float sway = sin(dot(vPos.xz, uWind) * 240.0 - uTime * 2.6);
  c *= 1.0 + a.r * 0.035 * uWindStrength * sway;

  vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));
  if (n.y < 0.0) n = -n;
  float riser = 1.0 - smoothstep(0.7, 0.92, n.y);
  if (riser > 0.0) {
    float topLayer = ceil(vLayer - 0.01);
    float index = mod(topLayer, 5.0) < 0.5 ? 1.0 : 0.0;
    c = mix(c, cInk, min(1.0, riser * mix(0.34, 0.62, index) * uInkGain));
  }

  vec4 f = mix(texture2D(uFirePrev, vUv), texture2D(uFire, vUv), uBlend);
  float burned = smoothstep(0.4, 0.6, f.g);
  vec3 ash = mix(cBurned, cAsh, step(0.86, hash21(floor(vUv * vec2(768.0, 480.0)))));
  c = mix(c, ash, burned);
  float fire = smoothstep(0.42, 0.58, f.r);
  c = mix(c, mix(cFire, cCore, smoothstep(0.35, 0.95, f.a)), fire);
  float edge = 1.0 - smoothstep(0.05, uEdgeW, abs(f.r - 0.5));
  c = mix(c, cInk, edge * 0.92);
  float stripe = step(0.55, fract((vPos.x - vPos.z) * 160.0));
  c = mix(c, cWet, f.b * stripe * 0.7);

  float light = 0.84 + 0.16 * max(dot(n, normalize(vec3(-0.35, 1.0, 0.45))), 0.0);
  gl_FragColor = vec4(c * light, 1.0);
  #include <colorspace_fragment>
}
`;

export interface TerrainTextures {
  fuelA: Texture;
  fuelB: Texture;
  fire: Texture;
  firePrev: Texture;
}

export function createTerrainMaterial(textures: TerrainTextures, plinthM: number, layerM: number): ShaderMaterial {
  const uniforms: Record<string, { value: number | Texture | Color | Vector2 }> = {
    uFuelA: { value: textures.fuelA },
    uFuelB: { value: textures.fuelB },
    uFire: { value: textures.fire },
    uFirePrev: { value: textures.firePrev },
    uBlend: { value: 1 },
    uTime: { value: 0 },
    uRiseH: { value: 1 },
    uPlinth: { value: plinthM },
    uLayerM: { value: layerM },
    uWind: { value: new Vector2(1, 0) },
    uInkGain: { value: 1 },
    uEdgeW: { value: 0.13 },
    uWindStrength: { value: 0 },
    cGrass: { value: color('grass') },
    cBrush: { value: color('brush') },
    cForest: { value: color('forest') },
    cRock: { value: color('rock') },
    cWater: { value: color('water') },
    cRoad: { value: color('road') },
    cYard: { value: color('grass') },
    cInk: { value: color('ink') },
    cGraphite: { value: color('graphite') },
    cCard: { value: color('card') },
    cBoard: { value: color('board') },
    cFire: { value: color('fire') },
    cCore: { value: color('core') },
    cBurned: { value: color('burned') },
    cAsh: { value: color('ash') },
    cWet: { value: color('wet') },
  };
  return new ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: DoubleSide });
}

/** Terrain color uniforms and the palette entry each one takes. */
const PALETTE_UNIFORMS: [string, PaletteKey][] = [
  ['cGrass', 'grass'], ['cBrush', 'brush'], ['cForest', 'forest'], ['cRock', 'rock'], ['cWater', 'water'],
  ['cRoad', 'road'], ['cYard', 'grass'], ['cInk', 'ink'], ['cBurned', 'burned'],
];

/**
 * High contrast: deeper fuels, lighter rock and water, contour and casing ink about 1.6
 * times stronger, and a wider ink edge on the fire front.
 */
export function setTerrainContrast(material: ShaderMaterial, high: boolean): void {
  const hex = high ? HEX_HIGH_CONTRAST : HEX;
  for (const [name, key] of PALETTE_UNIFORMS) (material.uniforms[name].value as Color).set(hex[key]);
  material.uniforms.uInkGain.value = high ? 1.6 : 1;
  material.uniforms.uEdgeW.value = high ? 0.2 : 0.13;
}
