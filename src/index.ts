import { Color, PerspectiveCamera, Raycaster, SRGBColorSpace, Vector3, WebGLRenderTarget, World } from '@iwsdk/core';
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
      Raycaster,
      /** A still of the scene from a chosen eye point, as a JPEG blob (no room behind). */
      async snapshot(eye: number[], target: number[], width = 1280, height = 800): Promise<Blob | null> {
        const renderer = world.renderer;
        const camera = new PerspectiveCamera(40, width / height, 0.01, 20);
        camera.position.fromArray(eye);
        camera.lookAt(new Vector3().fromArray(target));
        camera.updateMatrixWorld();
        const rt = new WebGLRenderTarget(width, height, { samples: 4 });
        rt.texture.colorSpace = SRGBColorSpace;
        const xrEnabled = renderer.xr.enabled;
        const background = world.scene.background;
        renderer.xr.enabled = false;
        world.scene.background = new Color('#d8d4cd');
        renderer.setRenderTarget(rt);
        renderer.render(world.scene, camera);
        const pixels = new Uint8Array(width * height * 4);
        renderer.readRenderTargetPixels(rt, 0, 0, width, height, pixels);
        renderer.setRenderTarget(null);
        renderer.xr.enabled = xrEnabled;
        world.scene.background = background;
        rt.dispose();
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        const image = ctx.createImageData(width, height);
        for (let y = 0; y < height; y++) {
          image.data.set(pixels.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
        }
        ctx.putImageData(image, 0, 0);
        return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      },
      errors: () => pageErrors.slice(),
      skipToEnd() {
        world.getSystem(GameSystem)?.debugSkipToEnd();
      },
    };
  }
}).catch((error: unknown) => {
  console.error('[holdline] start failed', error);
});
