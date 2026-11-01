// The paper relief board on the table: terrain, props, flames, smoke, wind vane, placement
// highlight. Its root sits at the board center on the table surface; +z faces the player.

import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Path,
  Shape,
  ShapeGeometry,
  Vector2,
  type ShaderMaterial,
  type Vector3,
} from '@iwsdk/core';
import { H, N, W } from '../sim/grid.js';
import { CellState } from '../sim/types.js';
import type { FrameMessage, LandscapeTransfer } from '../worker/protocol.js';
import { Crew } from './crew.js';
import { BoardDims } from './dims.js';
import { Flames } from './flames.js';
import { Lines } from './lines.js';
import { color } from './palette.js';
import { Props, createPropMaterial } from './props.js';
import { Smoke } from './smoke.js';
import { CellTextures } from './state-texture.js';
import { createTerrainMaterial } from './terrain-material.js';
import { buildTerrain } from './terrain-mesh.js';
import { WindVane } from './wind-vane.js';

export class Board {
  readonly root = new Group();
  readonly dims = new BoardDims();
  readonly textures = new CellTextures();
  readonly flames = new Flames(this.dims);
  readonly smoke = new Smoke(this.dims);
  readonly vane = new WindVane();
  readonly lines = new Lines(this.dims, () => this.cellHeight);
  readonly crew = new Crew(this.dims, () => this.cellHeight);
  /** Holds the terrain mesh: the entity players draw on. */
  readonly surface = new Group();
  readonly outline: Mesh;
  readonly terrainMaterial: ShaderMaterial;
  readonly propMaterial: ShaderMaterial;
  terrain: Mesh | null = null;
  props: Props | null = null;
  cellHeight: Float32Array = new Float32Array(N);
  maxHeight = 0.08;
  fuel: Uint8Array = new Uint8Array(N);

  private time = 0;
  private blend = 1;
  private stepSeconds = 1;
  private lastStep = -1;
  private rise = 1;
  private readonly burning = new Int32Array(N);
  private burningCount = 0;
  private readonly ages = new Uint8Array(N);
  private readonly cellState = new Uint8Array(N);
  private lapseStep = -1;

  constructor() {
    this.root.name = 'Board';
    this.terrainMaterial = createTerrainMaterial(this.textures, this.dims.plinthM, this.dims.layerM);
    this.propMaterial = createPropMaterial(this.dims.plinthM);
    this.surface.name = 'DrawSurface';
    this.root.add(this.surface, this.lines.root, this.crew.root, this.flames.mesh, this.smoke.mesh, this.vane.root);
    this.outline = this.makeOutline();
    this.outline.visible = false;
    this.root.add(this.outline);
  }

  private makeOutline(): Mesh {
    const ox = this.dims.widthM / 2 + 0.014;
    const oz = this.dims.depthM / 2 + 0.014;
    const ix = this.dims.widthM / 2 + 0.005;
    const iz = this.dims.depthM / 2 + 0.005;
    const shape = new Shape([new Vector2(-ox, -oz), new Vector2(ox, -oz), new Vector2(ox, oz), new Vector2(-ox, oz)]);
    shape.holes.push(new Path([new Vector2(-ix, -iz), new Vector2(-ix, iz), new Vector2(ix, iz), new Vector2(ix, -iz)]));
    const geometry = new ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0, 0.0015, 0);
    const mesh = new Mesh(geometry, new MeshBasicMaterial({ color: color('fire') }));
    mesh.name = 'PlacementHighlight';
    return mesh;
  }

  /** A grab bar for the fallback pose, built here, owned by its own entity. */
  makeHandle(): Mesh {
    const mesh = new Mesh(new BoxGeometry(0.08, 0.014, 0.02), new MeshBasicMaterial({ color: color('graphite') }));
    mesh.name = 'BoardHandle';
    return mesh;
  }

  setLandscape(land: LandscapeTransfer): void {
    if (this.terrain) {
      this.surface.remove(this.terrain);
      this.terrain.geometry.dispose();
    }
    if (this.props) {
      this.root.remove(this.props.trees, this.props.shrubs, this.props.houses);
      this.props.dispose();
    }
    const build = buildTerrain(land.elevationM, this.dims);
    this.cellHeight = build.cellHeight;
    this.maxHeight = build.maxHeight - this.dims.plinthM;
    this.fuel = land.fuel;
    this.terrain = new Mesh(build.geometry, this.terrainMaterial);
    this.terrain.name = 'Terrain';
    this.surface.add(this.terrain);
    this.textures.setFuel(land.fuel);
    this.props = new Props(this.propMaterial, land.fuel, land.density, land.houses, build.cellHeight, this.dims);
    this.root.add(this.props.trees, this.props.shrubs, this.props.houses);
    // Vane on the near left corner, on top of the ground there.
    const corner = (H - 3) * W + 2;
    this.vane.root.position.set(this.dims.xOf(2), this.cellHeight[corner], this.dims.zOf(H - 3));
    this.cellState.fill(0);
    this.lastStep = -1;
    this.lapseStep = -1;
    this.burningCount = 0;
    this.flames.mesh.count = 0;
    this.smoke.clear();
    this.lines.clear();
    this.crew.reset();
  }

  /** 0: flat paper; 1: full relief. The layers stack up from the bottom. */
  setRise(t: number): void {
    this.rise = Math.min(1, Math.max(0, t));
    const h = this.rise >= 1 ? 1 : this.rise * this.maxHeight;
    this.terrainMaterial.uniforms.uRiseH.value = h;
    this.propMaterial.uniforms.uRiseH.value = h;
    this.flames.mesh.visible = this.rise >= 1;
  }

  setWind(speedMs: number, dirDeg: number, immediate = false): void {
    this.vane.setDirection(dirDeg, immediate);
    this.smoke.setWind(speedMs, dirDeg);
    const r = (dirDeg * Math.PI) / 180;
    (this.terrainMaterial.uniforms.uWind.value as Vector2).set(Math.sin(r), -Math.cos(r));
    this.terrainMaterial.uniforms.uWindStrength.value = Math.min(1, speedMs / 10);
  }

  setStepSeconds(seconds: number): void {
    this.stepSeconds = seconds;
  }

  /** A worker frame: new step means a new blend from the previous state. */
  applyFrame(frame: FrameMessage): void {
    this.lapseStep = -1;
    const packed = frame.stateRGBA;
    if (frame.step !== this.lastStep) {
      this.textures.pushPrevious();
      this.blend = this.lastStep < 0 ? 1 : 0;
      this.lastStep = frame.step;
    }
    this.textures.setFireFromState(packed);
    let n = 0;
    for (let i = 0; i < N; i++) {
      const st = packed[i * 4] >> 3;
      this.cellState[i] = st;
      this.ages[i] = packed[i * 4 + 1];
      if (st === CellState.Burning) this.burning[n++] = i;
    }
    this.burningCount = n;
    this.props?.applyState((i) => this.cellState[i]);
    this.flames.set(this.burning, n, this.ages, this.fuel, this.cellHeight);
    this.lines.applyFlags(packed);
    this.crew.setCell(frame.crew.cell);
    this.setWind(frame.wind.speedMs, frame.wind.dirDeg);
  }

  /** Time lapse frame from a finished run's ignition and burnout steps. */
  setLapse(ignitedAt: Int32Array, burnedAt: Int32Array, step: number): void {
    const whole = Math.floor(step);
    if (whole !== this.lapseStep) {
      if (this.lapseStep < 0) {
        this.props?.reset();
        this.textures.setFireFromTimes(ignitedAt, burnedAt, whole - 1);
      }
      this.textures.pushPrevious();
      this.textures.setFireFromTimes(ignitedAt, burnedAt, whole);
      this.lapseStep = whole;
      let n = 0;
      for (let i = 0; i < N; i++) {
        const burned = burnedAt[i] >= 0 && burnedAt[i] <= whole;
        const burningNow = !burned && ignitedAt[i] >= 0 && ignitedAt[i] <= whole;
        this.cellState[i] = burned ? CellState.Burned : burningNow ? CellState.Burning : CellState.Fuel;
        this.ages[i] = burningNow ? Math.min(255, whole - ignitedAt[i]) : 0;
        if (burningNow) this.burning[n++] = i;
      }
      this.burningCount = n;
      this.props?.applyState((i) => this.cellState[i]);
      this.flames.set(this.burning, n, this.ages, this.fuel, this.cellHeight);
    }
    this.blend = step - whole;
    this.terrainMaterial.uniforms.uBlend.value = this.blend;
  }

  get burningNow(): number {
    return this.burningCount;
  }

  update(dt: number, camWorld: Vector3, frozen: boolean): void {
    const step = frozen ? 0 : dt;
    this.time += step;
    if (this.lapseStep < 0 && this.blend < 1) this.blend = Math.min(1, this.blend + step / this.stepSeconds);
    this.terrainMaterial.uniforms.uBlend.value = this.blend;
    this.terrainMaterial.uniforms.uTime.value = this.time;
    this.flames.update(this.time, camWorld);
    this.vane.update(step);
    this.crew.update(step);
    if (step > 0) this.smoke.update(step, this.burning, this.burningCount, this.cellHeight);
  }
}
