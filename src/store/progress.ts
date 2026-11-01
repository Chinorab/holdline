// Progress, settings and the run in progress, on top of SafeStore.

import type { Input, RunKind, Tool } from '../sim/types.js';
import { CURRENT_VERSION, migrate } from './migrations.js';
import { KEYS, type SafeStore } from './storage.js';

export interface Progress {
  version: number;
  firstDay: string | null;
  /** Unlock counter: every completed fire, Day 0 and practice included. */
  completedFires: number;
  introsShown: Partial<Record<Tool, boolean>>;
  day0Done: boolean;
  anchorHandle: string | null;
}

export interface Settings {
  version: number;
  highContrast: boolean;
  oneHand: boolean;
  glassesView: boolean;
  slowerFire: boolean;
  sound: boolean;
  captions: boolean;
  dwellSelect: boolean;
  headPointer: boolean;
  boardWidthCm: number;
  boardHeightCm: number;
}

export interface StoredRun {
  version: number;
  runId: string;
  dayId: string;
  kind: RunKind;
  settings: { slowerFire: boolean };
  inputs: Input[];
  status: 'in_progress' | 'complete';
  pausedAtTick: number;
}

export const DEFAULT_PROGRESS: Progress = {
  version: CURRENT_VERSION,
  firstDay: null,
  completedFires: 0,
  introsShown: {},
  day0Done: false,
  anchorHandle: null,
};

export const DEFAULT_SETTINGS: Settings = {
  version: CURRENT_VERSION,
  highContrast: false,
  oneHand: false,
  glassesView: false,
  slowerFire: false,
  sound: true,
  captions: true,
  dwellSelect: false,
  headPointer: false,
  boardWidthCm: 56,
  boardHeightCm: 0,
};

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

const isProgress = (v: unknown): v is Progress =>
  isObject(v) && typeof v.completedFires === 'number' && typeof v.day0Done === 'boolean';

const isSettings = (v: unknown): v is Settings =>
  isObject(v) && typeof v.boardWidthCm === 'number' && typeof v.captions === 'boolean';

const isRun = (v: unknown): v is StoredRun =>
  isObject(v) && typeof v.runId === 'string' && typeof v.dayId === 'string' && Array.isArray(v.inputs);

/** A value written by a newer build stays untouched; reads then use defaults. */
function read<T extends { version: number }>(store: SafeStore, key: string, isValid: (v: unknown) => v is T, fallback: T): { value: T; writable: boolean } {
  const result = migrate(store.readJson(key), isValid);
  if (result.kind === 'ok') return { value: { ...fallback, ...result.value }, writable: true };
  if (result.kind === 'future') return { value: { ...fallback }, writable: false };
  return { value: { ...fallback }, writable: true };
}

export class ProgressStore {
  progress: Progress;
  settings: Settings;
  private progressWritable: boolean;
  private settingsWritable: boolean;

  constructor(private readonly store: SafeStore) {
    const p = read(store, KEYS.progress, isProgress, DEFAULT_PROGRESS);
    const s = read(store, KEYS.settings, isSettings, DEFAULT_SETTINGS);
    this.progress = p.value;
    this.settings = s.value;
    this.progressWritable = p.writable;
    this.settingsWritable = s.writable;
    this.settings.boardWidthCm = Math.min(60, Math.max(45, this.settings.boardWidthCm));
    this.settings.boardHeightCm = Math.min(10, Math.max(-10, this.settings.boardHeightCm));
  }

  get notSaved(): boolean {
    return this.store.notSaved;
  }

  saveProgress(change: Partial<Progress>): void {
    this.progress = { ...this.progress, ...change, version: CURRENT_VERSION };
    if (this.progressWritable) this.store.writeJson(KEYS.progress, this.progress);
  }

  saveSettings(change: Partial<Settings>): void {
    this.settings = { ...this.settings, ...change, version: CURRENT_VERSION };
    if (this.settingsWritable) this.store.writeJson(KEYS.settings, this.settings);
  }

  loadRun(): StoredRun | null {
    const result = migrate(this.store.readJson(KEYS.run), isRun);
    return result.kind === 'ok' ? result.value : null;
  }

  saveRun(run: StoredRun): void {
    this.store.writeJson(KEYS.run, run);
  }

  clearRun(): void {
    this.store.remove(KEYS.run);
  }
}
