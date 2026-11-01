// Design tokens from the canvas style board, as hex strings and three.js colors.

import { Color } from '@iwsdk/core';

export const HEX = {
  board: '#E4E2DD',
  card: '#F3F1ED',
  ink: '#1D1C1A',
  graphite: '#5D5A56',
  rule: '#CAC7C2',
  fire: '#F6590C',
  core: '#FFE7B7',
  grass: '#E2D2A0',
  brush: '#657158',
  forest: '#204943',
  rock: '#BCB8B3',
  water: '#88B3CF',
  road: '#F4F2EF',
  house: '#F8F7F4',
  roof: '#383532',
  burned: '#26231F',
  ash: '#6E6A64',
  wet: '#2D5E8B',
  smoke: '#8F8B85',
  haze: '#9C8B76',
} as const;

/** High contrast variant from the canvas (slice e). */
export const HEX_HIGH_CONTRAST = {
  ...HEX,
  grass: '#EEE2B3',
  brush: '#4F5A45',
  forest: '#0F332D',
  rock: '#C8C4BE',
  water: '#9CC5E0',
  burned: '#121110',
  ink: '#0E0E0D',
} as const;

export type PaletteKey = keyof typeof HEX;

export const color = (key: PaletteKey): Color => new Color(HEX[key]);
