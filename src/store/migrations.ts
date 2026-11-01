// Version handling for stored values. Each value carries `version`. A value from a newer
// build is left untouched (the game runs on defaults for the session); an older one is
// migrated step by step; anything unreadable falls back to defaults.

export const CURRENT_VERSION = 1;

export type Versioned = { version: number } & Record<string, unknown>;

type Migration = (value: Versioned) => Versioned;

/** MIGRATIONS[v] turns a version v value into version v + 1. None needed yet. */
const MIGRATIONS: Record<number, Migration> = {};

export type MigrationResult<T> =
  | { kind: 'ok'; value: T; migrated: boolean }
  | { kind: 'future' }
  | { kind: 'invalid' };

export function migrate<T>(raw: unknown, isValid: (value: unknown) => value is T): MigrationResult<T> {
  if (!raw || typeof raw !== 'object' || typeof (raw as Versioned).version !== 'number') return { kind: 'invalid' };
  let value = raw as Versioned;
  if (value.version > CURRENT_VERSION) return { kind: 'future' };
  let migrated = false;
  while (value.version < CURRENT_VERSION) {
    const step = MIGRATIONS[value.version];
    if (!step) return { kind: 'invalid' };
    value = step(value);
    migrated = true;
  }
  return isValid(value) ? { kind: 'ok', value, migrated } : { kind: 'invalid' };
}
