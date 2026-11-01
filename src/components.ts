import { defineComponents } from '@iwsdk/core';
import { BoardHandle, BoardHitProxy, BoardRoot, HoldlinePanel } from './game/tags.js';

export default defineComponents([BoardRoot, BoardHitProxy, BoardHandle, HoldlinePanel]);
