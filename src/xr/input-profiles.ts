// IWSDK loads hand and controller models from a public CDN by default. Every model load goes
// through AssetManager's shared loading manager, so this rewrites those URLs to the copies
// hosted with the game (public/input-profiles), keeping all requests on our own origin.

import { AssetManager } from '@iwsdk/core';

const CDN_PREFIX = 'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles';

export function hostInputProfilesLocally(): void {
  const local = `${import.meta.env.BASE_URL}input-profiles`;
  AssetManager.loadingManager.setURLModifier((url) => (url.startsWith(CDN_PREFIX) ? local + url.slice(CDN_PREFIX.length) : url));
}
