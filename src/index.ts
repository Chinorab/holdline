import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { mountLanding } from './web/landing.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  mountLanding(world);
});
