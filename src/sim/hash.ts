// FNV 1a hashes: state fingerprints for the determinism tests and seeds from day ids.

const OFFSET = 0x811c9dc5;
const PRIME = 0x01000193;

function fnvBytes(h: number, bytes: Uint8Array): number {
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, PRIME);
  }
  return h;
}

/** Hash of the raw bytes of typed arrays, in order. */
export function hashArrays(...arrays: ArrayBufferView[]): number {
  let h = OFFSET;
  for (const a of arrays) h = fnvBytes(h, new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
  return h >>> 0;
}

/** Hash of a string's UTF 16 code units. */
export function hashString(text: string): number {
  let h = OFFSET;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h ^= c & 0xff;
    h = Math.imul(h, PRIME);
    h ^= c >>> 8;
    h = Math.imul(h, PRIME);
  }
  return h >>> 0;
}
