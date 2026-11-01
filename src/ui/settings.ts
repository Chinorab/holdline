// The settings card: access options as toggles, board size, height and turn as steppers,
// Day 0 and Close. Every change is saved at once and handed to the game to apply.

import { SETTINGS } from '../copy.js';
import { HEX } from '../render/palette.js';
import type { Settings } from '../store/progress.js';
import type { Panel } from './panels.js';

export type ToggleKey = 'highContrast' | 'oneHand' | 'glassesView' | 'slowerFire' | 'sound' | 'captions' | 'dwellSelect' | 'headPointer';

const TOGGLES: [ToggleKey, string][] = [
  ['highContrast', 'high-contrast'],
  ['oneHand', 'one-hand'],
  ['glassesView', 'glasses-view'],
  ['slowerFire', 'slower-fire'],
  ['sound', 'sound'],
  ['captions', 'captions'],
  ['dwellSelect', 'dwell-select'],
  ['headPointer', 'head-pointer'],
];

export interface SettingsActions {
  toggle(key: ToggleKey): void;
  /** Board size in steps of 1 cm (45 to 60), height in steps of 1 cm (-10 to 10). */
  size(delta: number): void;
  height(delta: number): void;
  turn(deltaDeg: number): void;
  day0(): void;
  close(): void;
}

export class SettingsView {
  constructor(
    private readonly panel: Panel,
    actions: SettingsActions,
  ) {
    panel.setText('settings-title', SETTINGS.title);
    for (const [key, id] of TOGGLES) {
      panel.setText(`set-${id}-label`, SETTINGS[key]);
      panel.onClick(`set-${id}`, () => actions.toggle(key));
    }
    panel.setText('step-size-label', SETTINGS.boardSize);
    panel.setText('step-height-label', SETTINGS.boardHeight);
    panel.setText('step-turn-label', SETTINGS.turn);
    panel.onClick('step-size-down', () => actions.size(-1));
    panel.onClick('step-size-up', () => actions.size(1));
    panel.onClick('step-height-down', () => actions.height(-1));
    panel.onClick('step-height-up', () => actions.height(1));
    panel.onClick('step-turn-down', () => actions.turn(-15));
    panel.onClick('step-turn-up', () => actions.turn(15));
    panel.setText('set-day0-label', SETTINGS.day0);
    panel.setText('set-close-label', SETTINGS.close);
    panel.onClick('set-day0', () => actions.day0());
    panel.onClick('set-close', () => actions.close());
  }

  render(s: Settings): void {
    for (const [key, id] of TOGGLES) {
      const on = s[key];
      this.panel.setText(`set-${id}-state`, on ? SETTINGS.on : SETTINGS.off);
      this.panel.setProps(`set-${id}`, { backgroundColor: on ? HEX.ink : HEX.board });
      this.panel.setProps(`set-${id}-label`, { color: on ? HEX.card : HEX.ink });
      this.panel.setProps(`set-${id}-icon`, { color: on ? HEX.card : HEX.ink });
      this.panel.setProps(`set-${id}-state`, { color: on ? HEX.card : HEX.graphite });
    }
    this.panel.setText('step-size-value', SETTINGS.cm(s.boardWidthCm));
    this.panel.setText('step-height-value', SETTINGS.cm(s.boardHeightCm));
  }
}
