import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRESS, DEFAULT_SETTINGS, ProgressStore } from '../../src/store/progress';
import { KEYS, SafeStore, type KeyValueBackend } from '../../src/store/storage';

class MapBackend implements KeyValueBackend {
  readonly data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

class FullBackend extends MapBackend {
  setItem(): void {
    throw new Error('QuotaExceededError');
  }
}

describe('device storage', () => {
  it('round trips progress and settings under versioned keys', () => {
    const backend = new MapBackend();
    const a = new ProgressStore(new SafeStore(backend));
    a.saveProgress({ completedFires: 2, day0Done: true, anchorHandle: 'abc' });
    a.saveSettings({ captions: false, boardWidthCm: 50 });
    expect(JSON.parse(backend.data.get(KEYS.progress) ?? '{}').version).toBe(1);
    const b = new ProgressStore(new SafeStore(backend));
    expect(b.progress.completedFires).toBe(2);
    expect(b.progress.anchorHandle).toBe('abc');
    expect(b.settings.captions).toBe(false);
    expect(b.settings.boardWidthCm).toBe(50);
    expect(b.notSaved).toBe(false);
  });

  it('keeps an in memory copy and reports not saved when the device refuses', () => {
    const store = new ProgressStore(new SafeStore(new FullBackend()));
    store.saveProgress({ completedFires: 1 });
    expect(store.progress.completedFires).toBe(1);
    expect(store.notSaved).toBe(true);
  });

  it('works with no storage at all', () => {
    const store = new ProgressStore(new SafeStore(null));
    expect(store.progress).toEqual(DEFAULT_PROGRESS);
    store.saveSettings({ sound: false });
    expect(store.settings.sound).toBe(false);
    expect(store.notSaved).toBe(true);
  });

  it('falls back to defaults on unreadable data and leaves future versions untouched', () => {
    const backend = new MapBackend();
    backend.data.set(KEYS.settings, '{not json');
    const future = JSON.stringify({ version: 99, completedFires: 7, day0Done: true });
    backend.data.set(KEYS.progress, future);
    const store = new ProgressStore(new SafeStore(backend));
    expect(store.settings).toEqual(DEFAULT_SETTINGS);
    expect(store.progress.completedFires).toBe(0);
    store.saveProgress({ completedFires: 3 });
    expect(backend.data.get(KEYS.progress)).toBe(future);
  });

  it('clamps board settings to the allowed range', () => {
    const backend = new MapBackend();
    backend.data.set(KEYS.settings, JSON.stringify({ ...DEFAULT_SETTINGS, boardWidthCm: 90, boardHeightCm: -40 }));
    const store = new ProgressStore(new SafeStore(backend));
    expect(store.settings.boardWidthCm).toBe(60);
    expect(store.settings.boardHeightCm).toBe(-10);
  });

  it('stores and clears the run in progress', () => {
    const store = new ProgressStore(new SafeStore(new MapBackend()));
    expect(store.loadRun()).toBeNull();
    store.saveRun({ version: 1, runId: 'r1', dayId: '2026-11-01', kind: 'daily', settings: { slowerFire: false }, inputs: [{ kind: 'pause', tick: 5 }], status: 'in_progress', pausedAtTick: 5 });
    expect(store.loadRun()?.inputs).toHaveLength(1);
    store.clearRun();
    expect(store.loadRun()).toBeNull();
  });
});
