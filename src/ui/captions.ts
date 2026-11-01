// Captions: the sounds playing now, named in a word or two, above the toolbar. Short cues
// (water, wind shift) stay up for a few seconds; ongoing ones show while they play.

import { CAPTION } from '../copy.js';
import type { Panel } from './panels.js';

export type CaptionKey = keyof typeof CAPTION;

/** Most important first; at most three show at once. */
const ORDER: CaptionKey[] = ['windShift', 'aircraft', 'water', 'digging', 'crackling', 'wind'];
const MAX_SHOWN = 3;
const CUE_S = 3;

export class Captions {
  enabled = true;
  private readonly timers = new Map<CaptionKey, number>();
  private shownText = '';

  constructor(private readonly panel: Panel) {}

  /** A short cue that stays up for a few seconds. */
  cue(key: CaptionKey): void {
    this.timers.set(key, CUE_S);
  }

  /** `ongoing`: the sounds playing this frame. Returns the text shown ('' when hidden). */
  update(dt: number, ongoing: Iterable<CaptionKey>, visible: boolean): string {
    const active = new Set<CaptionKey>(ongoing);
    for (const [key, left] of this.timers) {
      if (left - dt <= 0) this.timers.delete(key);
      else {
        this.timers.set(key, left - dt);
        active.add(key);
      }
    }
    const text = this.enabled && visible ? ORDER.filter((k) => active.has(k)).slice(0, MAX_SHOWN).map((k) => CAPTION[k]).join(', ') : '';
    if (text !== this.shownText) {
      this.shownText = text;
      if (text) this.panel.setText('caption-text', text);
      this.panel.show(text !== '');
    }
    return text;
  }

  clear(): void {
    this.timers.clear();
  }
}
