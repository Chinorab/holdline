import { VisibilityState, type World } from '@iwsdk/core';
import { BRAND, WEB } from '../copy.js';

/**
 * Landing page over the canvas: hero capture, wordmark, tagline, the Enter mixed reality
 * button, three facts and the privacy link. Hidden while an immersive session runs.
 */
export function mountLanding(world: World): void {
  const root = document.getElementById('landing');
  if (!root) return;
  const set = (key: string, text: string) => {
    const el = root.querySelector(`[data-copy="${key}"]`);
    if (el) el.textContent = text;
  };
  set('name', BRAND.name);
  set('tagline', BRAND.tagline);
  set('privacy', WEB.privacyLink);
  WEB.facts.forEach((fact, k) => set(`fact-${k}`, fact));

  const button = root.querySelector<HTMLButtonElement>('.enter');
  const note = root.querySelector<HTMLParagraphElement>('.note');
  if (!button || !note) return;
  set('enter', WEB.loading);

  const showUnsupported = () => {
    button.hidden = true;
    note.hidden = false;
    note.textContent = WEB.unsupported;
  };

  const xr = navigator.xr;
  if (!xr) {
    showUnsupported();
  } else {
    xr.isSessionSupported('immersive-ar')
      .then((supported) => {
        if (!supported) {
          showUnsupported();
          return;
        }
        set('enter', WEB.enter);
        button.disabled = false;
      })
      .catch(showUnsupported);
  }

  button.addEventListener('click', () => {
    button.disabled = true;
    Promise.resolve(world.launchXR()).finally(() => {
      button.disabled = false;
    });
  });

  world.visibilityState.subscribe((state) => {
    root.hidden = state !== VisibilityState.NonImmersive;
  });
}
