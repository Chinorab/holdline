// Day 0 by doing: what the strip says and what the ghost hand shows in each beat. The
// boards and fires themselves live in src/sim/day0.ts.

import { INSTRUCTION } from '../copy.js';
import { DAY0, DAY0_BEATS, type Day0Beat } from '../sim/day0.js';
import type { GhostMode } from '../render/ghost-hand.js';

export interface Day0Step {
  beat: Day0Beat;
  /** Before the fire starts: what to do. */
  prompt: string;
  /** While it runs: what to notice. */
  during: string;
  demo: GhostMode;
  /** Cell path the ghost hand follows. */
  path: { x: number; y: number }[];
  /** The beat starts by itself after this many seconds without a pinch. */
  autoStartS: number;
}

const at = (beat: Day0Beat) => [DAY0.ignite[beat]];

export const DAY0_SCRIPT: Day0Step[] = DAY0_BEATS.map((beat) => {
  switch (beat) {
    case 'wind':
      return { beat, prompt: INSTRUCTION.light, during: INSTRUCTION.downwind, demo: 'tap', path: at(beat), autoStartS: 8 };
    case 'slope':
      return { beat, prompt: INSTRUCTION.light, during: INSTRUCTION.uphill, demo: 'tap', path: at(beat), autoStartS: 8 };
    case 'breaks':
      return { beat, prompt: INSTRUCTION.light, during: INSTRUCTION.roads, demo: 'tap', path: at(beat), autoStartS: 8 };
    case 'line':
      return { beat, prompt: INSTRUCTION.draw, during: INSTRUCTION.watch, demo: 'drag', path: [...DAY0.guide], autoStartS: 14 };
  }
});

/** How long "Contained" stays up before the first daily fire. */
export const DAY0_END_S = 3;
