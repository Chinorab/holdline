// The game loop: landing preview, placing, brief (the landscape rises), plan (30 s, the fire
// waits), live (3 minutes), resolving, outcome and the 10 s time lapse, with pause on top.

import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  OneHandGrabbable,
  Vector3,
  VisibilityState,
  createSystem,
  type Entity,
} from '@iwsdk/core';
import { BRIEF, INSTRUCTION, RESULT, ABOUT } from '../copy.js';
import { Board } from '../render/board.js';
import { TICK_HZ, localDayId, windWord } from '../sim/day.js';
import type { OutcomeSide, RunKind } from '../sim/types.js';
import { ProgressStore } from '../store/progress.js';
import { SafeStore } from '../store/storage.js';
import { Panel, uiUrl } from '../ui/panels.js';
import type { OutcomeInfo } from '../worker/client.js';
import { placement } from '../xr/placement-system.js';
import { Session } from './session.js';
import { BoardHandle, BoardHitProxy, BoardRoot } from './tags.js';

export type Phase = 'landing' | 'placing' | 'brief' | 'plan' | 'live' | 'resolving' | 'outcome' | 'timelapse';

const RISE_S = 8;
const PLAN_S = 30;
const LAPSE_S = 10;
/** Where the board waits in the browser view (matches iwsdk.config.json's camera). */
const PREVIEW_POSITION = new Vector3(0, 0.76, -0.47);

/** Read only view of the game for tests and the CLI (window.holdline). */
export interface GameStatus {
  phase: Phase;
  paused: boolean;
  dayId: string;
  dayNumber: number;
  tick: number;
  burning: number;
  placement: string;
  placementLabel: string;
  candidates: number;
  outcome: OutcomeInfo['outcome'] | null;
  baseline: OutcomeSide | null;
}

export class GameSystem extends createSystem({}) {
  private board!: Board;
  private boardEntity!: Entity;
  private store!: ProgressStore;
  private session: Session | null = null;
  private phase: Phase = 'landing';
  private phaseTime = 0;
  private paused = false;
  private readyForPlay = false;
  private dayId = '';
  private dayNumber = 1;
  private kind: RunKind = 'daily';
  private lapse: OutcomeInfo | null = null;
  private panels!: Record<'brief' | 'strip' | 'toolbar' | 'pause' | 'about' | 'result', Panel>;
  private readonly camWorld = new Vector3();
  private immersive = false;

  init(): void {
    this.store = new ProgressStore(new SafeStore());
    this.board = new Board();
    this.board.root.position.copy(PREVIEW_POSITION);
    this.boardEntity = this.world.createTransformEntity(this.board.root);
    this.boardEntity.addComponent(BoardRoot);

    // A cheap box over the board takes the "pinch to place" ray instead of the terrain.
    const dims = this.board.dims;
    const proxyMesh = new Mesh(
      new BoxGeometry(dims.widthM, 0.1, dims.depthM).translate(0, 0.05, 0),
      new MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    );
    proxyMesh.name = 'BoardHitProxy';
    const proxy = this.world.createTransformEntity(proxyMesh, { parent: this.boardEntity });
    proxy.addComponent(BoardHitProxy);

    const handleMesh = this.board.makeHandle();
    handleMesh.visible = false;
    const handle = this.world.createTransformEntity(handleMesh);
    handle.addComponent(BoardHandle);
    handle.addComponent(OneHandGrabbable, { rotate: false, translate: true });

    this.createPanels();
    placement.footprint = { widthM: dims.widthM, depthM: dims.depthM };
    placement.onHandle = (h) => this.store.saveProgress({ anchorHandle: h });

    this.cleanupFuncs.push(
      this.visibilityState.subscribe((state) => this.onVisibility(state)),
    );
    this.exposeStatus();
    this.startDay(localDayId(new Date()), 'daily');
  }

  private createPanels(): void {
    const parent = this.boardEntity;
    const make = (id: string, file: string, w: number, h: number, interactive = true) =>
      new Panel(this.world, parent, id, uiUrl(file), w, h, interactive);
    this.panels = {
      brief: make('BriefingPanel', 'briefing.uikitml', 0.4, 0.25),
      strip: make('InstructionStrip', 'strip.uikitml', 0.16, 0.03, false),
      toolbar: make('Toolbar', 'toolbar.uikitml', 0.072, 0.078),
      pause: make('PausePanel', 'pause.uikitml', 0.32, 0.198),
      about: make('AboutPanel', 'about.uikitml', 0.32, 0.198),
      result: make('ResultPanel', 'result.uikitml', 0.4, 0.25),
    };
    const { widthM, depthM } = this.board.dims;
    const stand = (p: Panel) => p.place(0, 0.1 + p.heightM / 2, -depthM / 2 - 0.03, -0.2);
    stand(this.panels.brief);
    stand(this.panels.pause);
    stand(this.panels.about);
    stand(this.panels.result);
    // Just in front of the near edge, low, so it never covers the board from the eyes.
    this.panels.strip.place(0, 0.03, depthM / 2 + 0.045, -0.95);
    this.panels.toolbar.place(widthM / 2 - 0.05, 0.035, depthM / 2 + 0.06, -0.85);

    this.panels.brief.onClick('btn-start', () => this.startLive());
    this.panels.toolbar.onClick('btn-pause', () => this.pause());
    this.panels.pause.onClick('btn-resume', () => this.resume());
    this.panels.pause.onClick('btn-about', () => this.showAbout(true));
    this.panels.pause.onClick('btn-place', () => this.placeAgain());
    this.panels.about.onClick('btn-close', () => this.showAbout(false));
    this.panels.result.onClick('btn-replay', () => this.startLapse());
    this.panels.result.onClick('btn-done', () => this.playAgain());
    this.panels.about.setText('about-model', ABOUT.model);
    this.panels.about.setText('about-safety', ABOUT.safety);
  }

  private startDay(dayId: string, kind: RunKind): void {
    this.session?.dispose();
    this.dayId = dayId;
    this.kind = kind;
    this.readyForPlay = false;
    this.lapse = null;
    const runId = `${dayId}:${Date.now()}`;
    const session = new Session(this.store, dayId, kind, runId);
    this.session = session;
    session.onFrame = (frame) => {
      if (this.phase !== 'timelapse') this.board.applyFrame(frame);
    };
    session.onOutcome = (info) => this.showOutcome(info);
    void session.start().then((ready) => {
      if (this.session !== session) return;
      this.dayNumber = ready.day.dayNumber;
      this.board.setLandscape(ready.landscape);
      this.board.setWind(ready.day.wind.speedMs, ready.day.wind.dirDeg, true);
      this.board.setStepSeconds(ready.day.spreadPeriodTicks / TICK_HZ);
      const word = windWord(ready.day.wind.speedMs);
      this.panels.brief.setText('brief-day', BRIEF.day(ready.day.dayNumber));
      this.panels.brief.setText('brief-goal', BRIEF.goal(ready.landscape.houses.length));
      this.panels.brief.setText('brief-wind', BRIEF.windWords[word]);
      for (let k = 1; k <= 4; k++) {
        this.panels.brief.setProps(`bar-${k}`, { backgroundColor: k <= word + 1 ? '#1d1c1a' : '#f3f1ed' });
      }
      // The dial faces the player like the board: up is the far edge.
      this.panels.brief.setProps('brief-arrow', { transformRotateZ: -ready.day.wind.dirDeg });
      this.readyForPlay = true;
      if (this.phase === 'landing') this.board.setRise(1);
      if (this.phase === 'brief' || this.phase === 'plan') this.enter('brief');
    });
  }

  private onVisibility(state: VisibilityState): void {
    const immersive = state !== VisibilityState.NonImmersive;
    if (immersive && !this.immersive) {
      this.immersive = true;
      this.board.root.visible = false;
      placement.start(this.store.progress.anchorHandle);
      this.enter('placing');
    } else if (!immersive && this.immersive) {
      this.immersive = false;
      placement.reset();
      this.paused = false;
      this.session?.resume();
      this.board.root.visible = true;
      this.board.root.position.copy(PREVIEW_POSITION);
      this.board.root.quaternion.identity();
      this.enter('landing');
    }
    if (state === VisibilityState.VisibleBlurred) this.pause();
  }

  private enter(phase: Phase): void {
    this.phase = phase;
    this.phaseTime = 0;
    const p = this.panels;
    p.brief.show(phase === 'brief' || phase === 'plan');
    p.result.show(phase === 'outcome');
    p.toolbar.show(phase === 'live' || phase === 'brief' || phase === 'plan' || phase === 'timelapse');
    p.pause.show(false);
    p.about.show(false);
    p.strip.show(phase !== 'landing' && phase !== 'outcome' && phase !== 'resolving');
    this.board.outline.visible = false;
    switch (phase) {
      case 'placing':
        p.strip.setText('strip-text', INSTRUCTION.place);
        break;
      case 'brief':
        this.board.setRise(0);
        p.strip.setText('strip-text', INSTRUCTION.plan);
        p.brief.setText('start-label', BRIEF.start);
        break;
      case 'live':
        p.strip.setText('strip-text', INSTRUCTION.watch);
        break;
      case 'timelapse':
        p.strip.setText('strip-text', RESULT.replay);
        break;
    }
  }

  private startLive(): void {
    if ((this.phase !== 'brief' && this.phase !== 'plan') || !this.session || !this.readyForPlay) return;
    this.board.setRise(1);
    this.session.beginLive();
    this.enter('live');
  }

  private pause(): void {
    if (this.paused) return;
    if (this.phase === 'landing' || this.phase === 'placing' || this.phase === 'outcome') return;
    this.paused = true;
    this.session?.pause();
    this.panels.pause.show(true);
    this.panels.brief.show(false);
    this.panels.result.show(false);
  }

  private resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.session?.resume();
    this.panels.pause.show(false);
    this.panels.about.show(false);
    this.panels.brief.show(this.phase === 'brief' || this.phase === 'plan');
  }

  private showAbout(on: boolean): void {
    this.panels.about.show(on);
    this.panels.pause.show(!on && this.paused);
  }

  private placeAgain(): void {
    this.resume();
    this.board.root.visible = false;
    placement.redoRequested = true;
    this.enter('placing');
  }

  private showOutcome(info: OutcomeInfo): void {
    this.lapse = info;
    const you = info.outcome.player;
    const base = info.outcome.baseline;
    const r = this.panels.result;
    r.setText('result-day', BRIEF.day(this.dayNumber));
    r.setText('you-head', RESULT.you);
    r.setText('base-head', RESULT.baseline);
    r.setText('you-houses', RESULT.houses(you.housesStanding, you.housesTotal));
    r.setText('base-houses', RESULT.houses(base.housesStanding, base.housesTotal));
    r.setText('you-houses-label', RESULT.housesLabel);
    r.setText('base-houses-label', RESULT.housesLabel);
    r.setText('you-burned', RESULT.burned(you.burnedHa));
    r.setText('base-burned', RESULT.burned(base.burnedHa));
    const progress = this.store.progress;
    this.store.saveProgress({
      completedFires: progress.completedFires + 1,
      firstDay: progress.firstDay ?? this.dayId,
    });
    this.enter('outcome');
    this.panels.strip.show(true);
    this.panels.strip.setText('strip-text', info.outcome.resolvedByFastForward ? RESULT.outOfTime : INSTRUCTION.contained);
  }

  private startLapse(): void {
    if (this.phase !== 'outcome' || !this.lapse) return;
    this.enter('timelapse');
  }

  private playAgain(): void {
    if (this.phase !== 'outcome') return;
    this.startDay(this.dayId, 'practice');
    this.enter('brief');
  }

  update(dt: number): void {
    for (const panel of Object.values(this.panels)) panel.poll();
    const frozen = this.paused;
    if (!frozen) this.phaseTime += dt;
    this.player.head.getWorldPosition(this.camWorld);
    if (!this.immersive) this.world.camera.getWorldPosition(this.camWorld);

    switch (this.phase) {
      case 'placing':
        this.board.outline.visible = placement.status === 'candidate';
        if (placement.status === 'placed') {
          this.board.root.visible = true;
          this.enter(this.readyForPlay ? 'brief' : 'brief');
          if (placement.mode === 'fallback') this.panels.strip.setText('strip-text', INSTRUCTION.move);
        }
        break;
      case 'brief': {
        if (!this.readyForPlay) break;
        const t = Math.min(1, this.phaseTime / RISE_S);
        this.board.setRise(1 - (1 - t) * (1 - t) * (1 - t));
        if (t >= 1) this.enter('plan');
        break;
      }
      case 'plan': {
        this.board.setRise(1);
        const left = Math.max(0, Math.ceil(PLAN_S - this.phaseTime));
        this.panels.brief.setText('start-label', `${BRIEF.start} ${left}`);
        if (this.phaseTime >= PLAN_S) this.startLive();
        break;
      }
      case 'live':
        if (!frozen) this.session?.update(dt);
        break;
      case 'timelapse': {
        const info = this.lapse;
        if (!info) break;
        let end = 1;
        for (let i = 0; i < info.burnedAt.length; i++) end = Math.max(end, info.burnedAt[i], info.ignitedAt[i]);
        const t = Math.min(1, this.phaseTime / LAPSE_S);
        this.board.setLapse(info.ignitedAt, info.burnedAt, t * (end + 1));
        if (t >= 1 && !frozen) {
          const last = this.session?.frame;
          if (last) this.board.applyFrame(last);
          this.enter('outcome');
          this.panels.strip.show(false);
        }
        break;
      }
    }
    this.board.update(dt, this.camWorld, frozen);
  }

  /** Development only (window.__holdlineDebug): end the live phase now. */
  debugSkipToEnd(): void {
    if (this.phase === 'live') this.session?.skipToEnd();
  }

  /** window.holdline: a read only status for the emulator scripts. */
  private exposeStatus(): void {
    const self = this;
    const status = {
      get value(): GameStatus {
        return {
          phase: self.phase,
          paused: self.paused,
          dayId: self.dayId,
          dayNumber: self.dayNumber,
          tick: self.session?.tick ?? 0,
          burning: self.board.burningNow,
          placement: `${placement.status}:${placement.mode}`,
          placementLabel: placement.label,
          candidates: placement.candidates,
          outcome: self.session?.outcome?.outcome ?? null,
          baseline: self.session?.baseline?.outcome ?? null,
        };
      },
    };
    (globalThis as unknown as { holdline: unknown }).holdline = status;
  }
}
