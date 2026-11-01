// Every sound in Holdline is made here, in code, the first time sound starts: no recordings,
// no files. Loops fade in and out at their ends so they repeat without a click.

export type SoundName = 'crackle' | 'wind' | 'aircraft' | 'dig' | 'water';

/** Small seeded noise source, so each sound is the same on every run. */
function noise(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

function buffer(ctx: BaseAudioContext, seconds: number, fill: (data: Float32Array, rate: number) => void): AudioBuffer {
  const rate = ctx.sampleRate;
  const b = ctx.createBuffer(1, Math.round(seconds * rate), rate);
  fill(b.getChannelData(0), rate);
  return b;
}

function fadeEnds(data: Float32Array, rate: number, seconds: number): void {
  const n = Math.min(data.length / 2, Math.round(seconds * rate));
  for (let i = 0; i < n; i++) {
    const g = i / n;
    data[i] *= g;
    data[data.length - 1 - i] *= g;
  }
}

function normalize(data: Float32Array, peak: number): void {
  let max = 0;
  for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]));
  if (max > 0) for (let i = 0; i < data.length; i++) data[i] *= peak / max;
}

/** Sparse pops on a low rumble: burning wood. */
function crackle(data: Float32Array, rate: number): void {
  const r = noise(11);
  let brown = 0;
  for (let i = 0; i < data.length; i++) {
    brown = brown * 0.995 + r() * 0.02;
    data[i] = brown * 0.6;
  }
  const pops = Math.round((data.length / rate) * 38);
  for (let p = 0; p < pops; p++) {
    const at = Math.floor(((r() + 1) / 2) * (data.length - rate * 0.01));
    const amp = 0.25 + ((r() + 1) / 2) * 0.75;
    const decay = rate * (0.0015 + ((r() + 1) / 2) * 0.004);
    for (let k = 0; k < decay * 5 && at + k < data.length; k++) data[at + k] += r() * amp * Math.exp(-k / decay);
  }
  normalize(data, 0.9);
  fadeEnds(data, rate, 0.03);
}

/** Low passed noise with a slow swell. */
function wind(data: Float32Array, rate: number): void {
  const r = noise(23);
  let low = 0;
  let lower = 0;
  for (let i = 0; i < data.length; i++) {
    low += (r() - low) * 0.02;
    lower += (low - lower) * 0.05;
    const swell = 0.65 + 0.35 * Math.sin((2 * Math.PI * i) / data.length);
    data[i] = lower * swell;
  }
  normalize(data, 0.8);
  fadeEnds(data, rate, 0.4);
}

/** A propeller drone that rises and falls as it passes, its pitch dropping slightly. */
function aircraft(data: Float32Array, rate: number): void {
  const r = noise(37);
  let phase = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    const freq = 118 - 14 * t;
    phase += freq / rate;
    const saw = 2 * (phase % 1) - 1;
    const blade = Math.sin(2 * Math.PI * phase * 0.5) > 0 ? 1 : 0.7;
    const env = Math.sin(Math.PI * t) ** 1.5;
    data[i] = (saw * 0.6 * blade + r() * 0.15) * env;
  }
  normalize(data, 0.8);
}

/** Two short scrapes: a tool in dry ground. */
function dig(data: Float32Array, rate: number): void {
  const r = noise(41);
  let band = 0;
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    const t = (i / rate) % 0.32;
    const env = t < 0.12 ? Math.sin((Math.PI * t) / 0.12) : 0;
    const n = r();
    band = band * 0.7 + (n - prev) * 0.5;
    prev = n;
    data[i] = band * env;
  }
  normalize(data, 0.7);
  fadeEnds(data, rate, 0.01);
}

/** A falling sheet of water: noise that opens then closes. */
function water(data: Float32Array, rate: number): void {
  const r = noise(53);
  let low = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    const cut = 0.05 + 0.4 * Math.sin(Math.PI * t);
    low += (r() - low) * cut;
    data[i] = low * Math.sin(Math.PI * t) ** 0.7;
  }
  normalize(data, 0.8);
}

export function synthesize(ctx: BaseAudioContext): Record<SoundName, AudioBuffer> {
  return {
    crackle: buffer(ctx, 2, crackle),
    wind: buffer(ctx, 4, wind),
    aircraft: buffer(ctx, 3, aircraft),
    dig: buffer(ctx, 0.64, dig),
    water: buffer(ctx, 1.6, water),
  };
}
