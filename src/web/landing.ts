import { VisibilityState, type World } from '@iwsdk/core';
import { BRAND, WEB } from '../copy.js';

/**
 * Landing overlay over the canvas: wordmark, tagline, three facts and the Enter mixed
 * reality button. Hidden while an immersive session runs.
 */
export function mountLanding(world: World): void {
  const root = document.getElementById('landing');
  if (!root) return;
  const set = (selector: string, text: string) => {
    const el = root.querySelector(selector);
    if (el) el.textContent = text;
  };
  set('[data-copy="name"]', BRAND.name);
  set('[data-copy="tagline"]', BRAND.tagline);
  set('[data-copy="privacy"]', WEB.privacyLink);
  const facts = root.querySelector('.facts');
  if (facts) {
    facts.replaceChildren(
      ...WEB.facts.map((fact) => {
        const li = document.createElement('li');
        li.textContent = fact;
        return li;
      }),
    );
  }

  const button = root.querySelector<HTMLButtonElement>('.enter');
  const note = root.querySelector<HTMLParagraphElement>('.note');
  if (!button || !note) return;
  button.textContent = WEB.loading;

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
        button.textContent = WEB.enter;
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
