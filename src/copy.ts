/** Crew line length: one cell is 30 m. */
const km = (cells: number) => `${(cells * 0.03).toFixed(1)} km`;

// Every player facing string. tests/logic/copy-scan.test.ts checks this module:
// no dash or hyphen characters, no emojis, no mention of AI, instructions at most 4 words.

export const BRAND = {
  name: 'Holdline',
  tagline: 'One wildfire a day, on your real table.',
} as const;

export const WEB = {
  enter: 'Enter mixed reality',
  facts: ['Hands only.', 'Seated.', '5 minutes.'],
  privacyLink: 'Privacy',
  unsupported: 'Open this page in the Meta Quest browser.',
  loading: 'Loading',
} as const;

// Short instructions shown on the strip above the board (4 words max).
export const INSTRUCTION = {
  place: 'Pinch to place',
  light: 'Pinch to light',
  downwind: 'It leans downwind',
  uphill: 'Uphill runs faster',
  grass: 'Grass burns fast',
  roads: 'Roads stop it',
  draw: 'Draw a line',
  contained: 'Contained',
  water: 'Look, pinch, drag',
  backburn: 'Hold on a line',
  turn: 'Two hands to turn',
  move: 'Grab to move',
  watch: 'Watch it run',
  plan: 'Read the wind',
} as const;

export const BRIEF = {
  day: (n: number) => (n === 0 ? 'Day 0' : `Day ${n}`),
  goal: (houses: number) => `Protect all ${houses} houses`,
  windLabel: 'Wind',
  windWords: ['Calm', 'Light', 'Strong', 'Gale'],
  start: 'Start',
  practice: (n: number) => `Day ${n} practice`,
} as const;

export const PAUSE = {
  title: 'Paused',
  resume: 'Resume',
  settings: 'Settings',
  about: 'About',
  day0: 'Day 0',
} as const;

export const RESULT = {
  you: 'You',
  baseline: 'If no one had acted',
  houses: (standing: number, total: number) => `${standing} of ${total}`,
  housesLabel: 'houses standing',
  burned: (ha: number) => `${ha} ha burned`,
  line: (cells: number) => `${km(cells)} line dug`,
  noLine: 'No line',
  replay: 'Replay',
  done: 'Done',
  slowerFire: 'Slower fire',
  outOfTime: 'Time ran out',
  fireOut: 'Fire out',
} as const;

export const ABOUT = {
  title: 'About',
  model: 'Simplified model, not a forecast.',
  safety: 'For real fire safety, follow your local authorities.',
  close: 'Close',
} as const;

export const CAPTION = {
  crackling: 'Crackling',
  wind: 'Wind',
  aircraft: 'Aircraft',
  digging: 'Digging',
  water: 'Water',
  windShift: 'Wind shift',
} as const;

export const STATUS = {
  notSaved: 'Progress not saved',
  scanTable: 'Scan table',
  placeAgain: 'Place again',
  noBudget: 'No crew line left',
  readyIn: (seconds: number) => `Ready in ${Math.ceil(seconds)} s`,
  noLineHere: 'Hold on a dug line',
  resume: (secondsLeft: number) => `Resume ${Math.floor(secondsLeft / 60)}:${String(Math.floor(secondsLeft % 60)).padStart(2, '0')}`,
} as const;

export const TOOL = {
  dig: 'Dig line',
  water: 'Water drop',
  backburn: 'Backburn',
  pause: 'Pause',
  budget: 'Crew line',
  km,
  cooldown: (seconds: number) => `${Math.ceil(seconds)} s`,
} as const;

export const JOURNAL = {
  title: 'Journal',
  streak: 'Streak',
  days: (n: number) => (n === 1 ? '1 day' : `${n} days`),
  best: 'Best',
  none: 'None yet',
  today: 'Today',
  day: (n: number) => `Day ${n}`,
  notSaved: 'Progress not saved',
} as const;

export const SETTINGS = {
  title: 'Settings',
  highContrast: 'High contrast',
  oneHand: 'One hand',
  glassesView: 'Glasses view',
  slowerFire: 'Slower fire',
  sound: 'Sound',
  captions: 'Captions',
  dwellSelect: 'Dwell select',
  headPointer: 'Head pointer',
  boardSize: 'Board size',
  boardHeight: 'Board height',
  turn: 'Turn',
  on: 'On',
  off: 'Off',
  cm: (n: number) => `${n} cm`,
  day0: 'Day 0',
  close: 'Close',
  nextFire: 'From the next fire',
} as const;

export const INSPECT = {
  slope: (degrees: number) => `${Math.round(degrees)}° slope`,
  wet: 'Wet',
} as const;

export const FUEL_NAMES = ['Grass', 'Brush', 'Forest', 'Rock', 'Water', 'Road', 'House'] as const;

/** Every string in this module, for the copy scan test. */
export function allCopy(): { key: string; text: string; instruction: boolean }[] {
  const out: { key: string; text: string; instruction: boolean }[] = [];
  const visit = (key: string, value: unknown, instruction: boolean) => {
    if (typeof value === 'string') out.push({ key, text: value, instruction });
    else if (typeof value === 'function') {
      const fn = value as (...args: number[]) => string;
      out.push({ key, text: fn(6, 6), instruction });
      out.push({ key, text: fn(0, 6), instruction });
    } else if (Array.isArray(value)) value.forEach((v, i) => visit(`${key}[${i}]`, v, instruction));
    else if (value && typeof value === 'object')
      for (const [k, v] of Object.entries(value)) visit(`${key}.${k}`, v, instruction);
  };
  const groups: Record<string, unknown> = {
    BRAND, WEB, BRIEF, PAUSE, RESULT, ABOUT, CAPTION, STATUS, TOOL, JOURNAL, SETTINGS, INSPECT, FUEL_NAMES,
  };
  for (const [k, v] of Object.entries(groups)) visit(k, v, false);
  visit('INSTRUCTION', INSTRUCTION, true);
  return out;
}
