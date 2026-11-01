// Device storage: localStorage under versioned keys, every access guarded. When the browser
// refuses (private mode, quota, blocked site data) the game keeps an in memory copy and
// reports that progress is not saved.

export interface KeyValueBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const KEYS = {
  settings: 'holdline.v1.settings',
  progress: 'holdline.v1.progress',
  journal: 'holdline.v1.journal',
  run: 'holdline.v1.run',
} as const;

export class SafeStore {
  /** True once a write could not reach the device. */
  notSaved = false;
  private readonly memory = new Map<string, string>();
  private readonly backend: KeyValueBackend | null;

  constructor(backend?: KeyValueBackend | null) {
    if (backend !== undefined) {
      this.backend = backend;
      return;
    }
    let found: KeyValueBackend | null = null;
    try {
      found = globalThis.localStorage ?? null;
    } catch {
      found = null;
    }
    this.backend = found;
    if (!found) this.notSaved = true;
  }

  readRaw(key: string): string | null {
    if (this.memory.has(key)) return this.memory.get(key) ?? null;
    try {
      return this.backend?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  writeRaw(key: string, value: string): boolean {
    this.memory.set(key, value);
    try {
      if (!this.backend) throw new Error('no storage');
      this.backend.setItem(key, value);
      return true;
    } catch {
      this.notSaved = true;
      return false;
    }
  }

  remove(key: string): void {
    this.memory.delete(key);
    try {
      this.backend?.removeItem(key);
    } catch {
      this.notSaved = true;
    }
  }

  /** Parsed JSON, or null when missing or unreadable. */
  readJson(key: string): unknown {
    const raw = this.readRaw(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }

  writeJson(key: string, value: unknown): boolean {
    return this.writeRaw(key, JSON.stringify(value));
  }
}
