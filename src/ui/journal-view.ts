// The journal panel: streak, personal best, and a tile per day with its burn scar drawn from
// the stored bitset. Picking a past tile plays that day again as practice.

import { DataTexture, NearestFilter, RGBAFormat, SRGBColorSpace, UnsignedByteType } from '@iwsdk/core';
import { JOURNAL, RESULT } from '../copy.js';
import { HEX } from '../render/palette.js';
import { H, N, W } from '../sim/grid.js';
import { scarFromBits } from '../sim/sim.js';
import type { OutcomeSide } from '../sim/types.js';
import { SHELF_DAYS, type Slot } from '../store/journal.js';
import type { Panel } from './panels.js';

const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
// Unburned land lighter than the tile, so the whole miniature board reads.
const LAND = rgb(HEX.house);
const BURNED = rgb(HEX.burned);

export class JournalView {
  onPick: (dayId: string) => void = () => {};
  private slots: Slot[] = [];
  private readonly textures: DataTexture[] = [];
  private readonly shownScar: string[] = [];

  constructor(private readonly panel: Panel) {
    for (let k = 0; k < SHELF_DAYS; k++) {
      const texture = new DataTexture(new Uint8Array(N * 4), W, H, RGBAFormat, UnsignedByteType);
      texture.magFilter = NearestFilter;
      texture.minFilter = NearestFilter;
      texture.colorSpace = SRGBColorSpace;
      this.textures.push(texture);
      this.shownScar.push('');
      panel.onClick(`tile-${k}`, () => {
        const slot = this.slots[k];
        // Today's fire is the daily one; the tiles before it are practice.
        if (slot && k > 0) this.onPick(slot.dayId);
      });
    }
    panel.setText('journal-title', JOURNAL.title);
    panel.setText('streak-label', JOURNAL.streak);
    panel.setText('best-label', JOURNAL.best);
    panel.setText('journal-note', JOURNAL.notSaved);
  }

  render(slots: Slot[], streak: number, best: { dayId: string; side: OutcomeSide } | null, bestDayNumber: number, notSaved: boolean): void {
    this.slots = slots;
    const p = this.panel;
    p.setText('streak-value', JOURNAL.days(streak));
    p.setText('best-value', best ? RESULT.houses(best.side.housesStanding, best.side.housesTotal) : JOURNAL.none);
    p.setText('best-note', best ? `${RESULT.burned(best.side.burnedHa)}, ${JOURNAL.day(bestDayNumber)}` : '');
    p.setProps('journal-note', { display: notSaved ? 'flex' : 'none' });
    for (let k = 0; k < SHELF_DAYS; k++) {
      const slot = slots[k];
      p.setProps(`tile-${k}`, { display: slot ? 'flex' : 'none' });
      if (!slot) continue;
      p.setText(`tile-${k}-label`, k === 0 && slot.state === 'today' ? JOURNAL.today : JOURNAL.day(slot.dayNumber));
      p.setProps(`tile-${k}-label`, { color: slot.state === 'missed' ? HEX.graphite : HEX.ink });
      const bits = slot.record?.scarBits ?? '';
      p.setProps(`tile-${k}-img`, { display: bits ? 'flex' : 'none' });
      if (bits && bits !== this.shownScar[k]) {
        this.drawScar(this.textures[k], bits);
        this.shownScar[k] = bits;
        p.setProps(`tile-${k}-img`, { src: this.textures[k] } as never);
      }
    }
  }

  private drawScar(texture: DataTexture, bits: string): void {
    const burned = scarFromBits(bits);
    const data = texture.image.data as Uint8Array;
    for (let i = 0; i < N; i++) {
      const x = i % W;
      const y = (i - x) / W;
      // Texture rows run from the bottom: the board's far edge (row 0) goes on top.
      const o = ((H - 1 - y) * W + x) * 4;
      const c = burned[i] ? BURNED : LAND;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = 255;
    }
    texture.needsUpdate = true;
  }
}
