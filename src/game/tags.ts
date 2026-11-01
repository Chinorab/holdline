// ECS tags for Holdline entities. System free, registered in src/components.ts.

import { createComponent, Types } from '@iwsdk/core';

export const BoardRoot = createComponent('BoardRoot', {}, 'The paper relief board on the table.');

export const BoardHitProxy = createComponent('BoardHitProxy', {}, 'Invisible box over the board that takes pinches.');

export const BoardHandle = createComponent('BoardHandle', {}, 'Grab bar that moves the board in the fallback pose.');

export const HoldlinePanel = createComponent('HoldlinePanel', {
  panelId: { type: Types.String, default: '' },
});
