import { Vector3, World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { GameSystem } from './game/phases.js';
import { mountLanding } from './web/landing.js';
import { hostInputProfilesLocally } from './xr/input-profiles.js';
import { PlacementSystem } from './xr/placement-system.js';

// Development only: every error of this page load, for the emulator gate.
const pageErrors: string[] = [];
if (import.meta.env.DEV) {
  window.addEventListener('error', (event) => pageErrors.push(`error: ${event.message}`));
  window.addEventListener('unhandledrejection', (event) => pageErrors.push(`rejection: ${String(event.reason)}`));
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    pageErrors.push(`console: ${args.map(String).join(' ').slice(0, 300)}`);
    original(...args);
  };
}

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  if (import.meta.env.DEV) console.info('[holdline] world ready');
  hostInputProfilesLocally();
  world.registerSystem(PlacementSystem);
  world.registerSystem(GameSystem);
  mountLanding(world);
  if (import.meta.env.DEV) {
    // Development only: hooks for emulator scripts (positions to aim at, render stats).
    const v = new Vector3();
    (window as unknown as { __holdlineDebug: unknown }).__holdlineDebug = {
      worldPos(name: string): number[] | null {
        const object = world.scene.getObjectByName(name);
        if (!object) return null;
        object.updateWorldMatrix(true, false);
        object.getWorldPosition(v);
        return [v.x, v.y, v.z];
      },
      stats() {
        const info = world.renderer.info;
        return { calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures };
      },
      world,
      errors: () => pageErrors.slice(),
      skipToEnd() {
        world.getSystem(GameSystem)?.debugSkipToEnd();
      },
    };
  }
}).catch((error: unknown) => {
  console.error('[holdline] start failed', error);
});
