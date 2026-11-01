// Spatial sound for the board. The crackle sits at the fire front and grows with the number
// of burning cells; the wind loop follows the wind speed; the aircraft, the crew's digging
// and the water drop sound where they happen. Everything starts after the first gesture
// (browsers keep audio off until then) and stops while paused or when Sound is off.
//
// IWSDK's AudioSource plays files by URL; these sounds are generated buffers, so they go
// through three.js positional audio with one listener on the player's head (research R11).

import { Audio as ThreeAudio, AudioListener, Object3D, PositionalAudio } from '@iwsdk/core';
import { synthesize, type SoundName } from './synth.js';

export interface AudioFrame {
  /** Fire playing (live, unpaused) */
  live: boolean;
  burning: number;
  /** Board local fire front, or null when nothing burns. */
  front: { x: number; y: number; z: number } | null;
  windMs: number;
  digging: boolean;
}

const MAX_CRACKLE_CELLS = 140;

export class FireAudio {
  /** Anchors on the board for the crackle and the digging (board local positions). */
  readonly crackleAnchor = new Object3D();
  readonly digAnchor = new Object3D();
  private listener: AudioListener | null = null;
  private buffers: Record<SoundName, AudioBuffer> | null = null;
  private crackle: PositionalAudio | null = null;
  private dig: PositionalAudio | null = null;
  private wind: ThreeAudio | null = null;
  private plane: PositionalAudio | null = null;
  private splash: PositionalAudio | null = null;
  private enabled = true;
  private paused = false;
  private crackleGain = 0;

  constructor(
    private readonly head: Object3D,
    private readonly planeAnchor: Object3D,
    private readonly waterAnchor: Object3D,
  ) {
    this.crackleAnchor.name = 'CrackleAnchor';
    this.digAnchor.name = 'DigAnchor';
  }

  get started(): boolean {
    return this.listener !== null;
  }

  /** Call from a user gesture: creates the context, the buffers and the sources once. */
  unlock(): void {
    if (!this.listener) {
      this.listener = new AudioListener();
      this.head.add(this.listener);
      this.buffers = synthesize(this.listener.context);
      this.crackle = this.positional('crackle', true, this.crackleAnchor, 0.25);
      this.dig = this.positional('dig', true, this.digAnchor, 0.15);
      this.plane = this.positional('aircraft', false, this.planeAnchor, 0.35);
      this.splash = this.positional('water', false, this.waterAnchor, 0.3);
      this.wind = new ThreeAudio(this.listener);
      this.wind.setBuffer(this.buffers.wind);
      this.wind.setLoop(true);
      this.wind.setVolume(0);
    }
    void this.listener.context.resume();
  }

  private positional(name: SoundName, loop: boolean, parent: Object3D, refDistance: number): PositionalAudio {
    const listener = this.listener as AudioListener;
    const sound = new PositionalAudio(listener);
    sound.setBuffer((this.buffers as Record<SoundName, AudioBuffer>)[name]);
    sound.setLoop(loop);
    sound.setRefDistance(refDistance);
    sound.setRolloffFactor(1.2);
    sound.setVolume(0);
    parent.add(sound);
    return sound;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.applySuspend();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.applySuspend();
  }

  private applySuspend(): void {
    const ctx = this.listener?.context;
    if (!ctx) return;
    if (this.enabled && !this.paused) void ctx.resume();
    else void ctx.suspend();
  }

  /** Per frame, from the game's state. */
  update(f: AudioFrame, dt: number): void {
    if (!this.listener || !this.crackle || !this.dig || !this.wind) return;
    const target = f.live && f.burning > 0 ? 0.25 + 0.75 * Math.sqrt(Math.min(1, f.burning / MAX_CRACKLE_CELLS)) : 0;
    // Ease, so a step of the fire never jumps the level.
    this.crackleGain += (target - this.crackleGain) * Math.min(1, dt * 2);
    if (f.front) this.crackleAnchor.position.set(f.front.x, f.front.y + 0.01, f.front.z);
    this.loop(this.crackle, this.crackleGain);
    this.loop(this.wind, f.live ? Math.min(0.45, f.windMs / 25) : 0);
    this.loop(this.dig, f.live && f.digging ? 0.5 : 0);
  }

  private loop(sound: ThreeAudio | PositionalAudio, volume: number): void {
    sound.setVolume(volume);
    if (volume > 0.001 && !sound.isPlaying) sound.play();
    else if (volume <= 0.001 && sound.isPlaying) sound.pause();
  }

  aircraft(): void {
    this.oneShot(this.plane, 0.9);
  }

  water(): void {
    this.oneShot(this.splash, 0.8);
  }

  private oneShot(sound: ThreeAudio | PositionalAudio | null, volume: number): void {
    if (!sound || !this.enabled) return;
    if (sound.isPlaying) sound.stop();
    sound.setVolume(volume);
    sound.play();
  }

  /** Volumes for the emulator gate (status). */
  levels(): Record<string, number> {
    const v = (s: ThreeAudio | PositionalAudio | null) => (s && s.isPlaying ? Math.round(s.getVolume() * 100) / 100 : 0);
    return { crackle: v(this.crackle), wind: v(this.wind), dig: v(this.dig), aircraft: v(this.plane), water: v(this.splash) };
  }

  get state(): string {
    return this.listener?.context.state ?? 'off';
  }
}
