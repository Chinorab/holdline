// The game loop: landing preview, placing, Day 0 on a first visit, brief (the landscape
// rises), plan (30 s, the fire waits), live (3 minutes), resolving, outcome and the 10 s time
// lapse, with pause on top. Tools: dig line, water drop, backburn; inspect on hover.

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
import { ABOUT, BRIEF, INSTRUCTION, PAUSE, RESULT, STATUS } from '../copy.js';
import { FireAudio } from '../audio/audio-system.js';
import { BackburnTool } from '../input/backburn.js';
import { DigTool } from '../input/dig-tool.js';
import { Inspect } from '../input/inspect.js';
import { ToolInput, type StrokeTool } from '../input/tool-system.js';
import { WaterTool } from '../input/water.js';
import { Board } from '../render/board.js';
import { Haze } from '../render/haze.js';
import { TICK_HZ, dayNumber, windWord } from '../sim/day.js';
import { lineCells, WATER_LENGTH_CELLS, WATER_WIDTH_CELLS } from '../sim/inputs.js';
import { W } from '../sim/grid.js';
import type { BackburnSide, Input, OutcomeSide, RunKind, Tool } from '../sim/types.js';
import { JournalStore, personalBest, shelfSlots, streak } from '../store/journal.js';
import { ProgressStore, type StoredRun } from '../store/progress.js';
import { SafeStore } from '../store/storage.js';
import { Panel, uiUrl } from '../ui/panels.js';
import { Captions, type CaptionKey } from '../ui/captions.js';
import { JournalView } from '../ui/journal-view.js';
import { Toolbar } from '../ui/toolbar.js';
import type { OutcomeInfo } from '../worker/client.js';
import { placement } from '../xr/placement-system.js';
import { todayId } from './clock.js';
import { DAY0_END_S, DAY0_SCRIPT } from './day0.js';
import { Session } from './session.js';
import { BoardHandle, BoardHitProxy, BoardRoot } from './tags.js';
import { introFor, toolsFor } from './unlocks.js';

export type Phase = 'landing' | 'placing' | 'day0' | 'brief' | 'plan' | 'live' | 'resolving' | 'outcome' | 'timelapse';

const RISE_S = 8;
const PLAN_S = 30;
const LAPSE_S = 10;
/** How long a status line (No crew line left) stays on the strip. */
const NOTICE_S = 2.5;
/** Toolbar size in meters (UIKitML authored at 0.25 mm per px: 900 by 308). */
const TOOLBAR_W = 0.225;
const TOOLBAR_H = 0.077;
/** Where the board waits in the browser view (matches iwsdk.config.json's camera). */
const PREVIEW_POSITION = new Vector3(0, 0.76, -0.47);
const INTRO_TEXT: Record<'water' | 'backburn', string> = { water: INSTRUCTION.water, backburn: INSTRUCTION.backburn };

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
  budgetLeft: number;
  lines: number;
  inputs: number;
  drawing: boolean;
  lastStroke: 'far' | 'near' | null;
  resumable: boolean;
  dugCells: number;
  tools: Tool[];
  tool: Tool | null;
  day0: string;
  completedFires: number;
  intro: Tool | null;
  waterCooldown: number;
  aircraft: boolean;
  inspect: number;
  strip: string;
  ghost: boolean;
  /** Seconds of game time since entering mixed reality (frames capped like the fire clock). */
  playSeconds: number;
  kind: RunKind;
  audio: string;
  levels: Record<string, number>;
  caption: string;
  haze: number;
  ceiling: number | null;
  today: string;
  streak: number;
  journal: string[];
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
  private panels!: Record<'brief' | 'strip' | 'toolbar' | 'pause' | 'about' | 'result' | 'inspect' | 'journal' | 'captions', Panel>;
  private audio!: FireAudio;
  private captions!: Captions;
  private haze!: Haze;
  private wasFlying = false;
  /** The crew is idle for one tick between cells: digging holds for a second. */
  private digHold = 0;
  private captionText = '';
  private readonly ongoing = new Set<CaptionKey>();
  private journal!: JournalStore;
  private journalView!: JournalView;
  private readonly camWorld = new Vector3();
  private readonly camWorld2 = new Vector3();
  private immersive = false;
  private toolbar!: Toolbar;
  private tools!: ToolInput;
  private digTool!: DigTool;
  private waterTool!: WaterTool;
  private backburnTool!: BackburnTool;
  private lightTool!: StrokeTool;
  private inspect!: Inspect;
  private lineId = 0;
  private lineCount = 0;
  private pendingCells = 0;
  private notice = 0;
  private stripText = '';
  private storedRun: StoredRun | null = null;
  private dayTools: Tool[] = ['dig'];
  private intro: Tool | null = null;
  /** Day 0: beat index, its stage, and whether a re-placement should come back to it. */
  private day0Index = -1;
  private day0Stage: 'prompt' | 'live' | 'ending' = 'prompt';
  private playSeconds = 0;
  /** Game seconds the current Day 0 prompt has been waiting for a pinch. */
  private day0Wait = 0;

  init(): void {
    const safe = new SafeStore();
    this.store = new ProgressStore(safe);
    this.journal = new JournalStore(safe);
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
    this.createTools();
    this.createRoom();
    placement.footprint = { widthM: dims.widthM, depthM: dims.depthM };
    placement.onHandle = (h) => this.store.saveProgress({ anchorHandle: h });

    this.cleanupFuncs.push(
      this.visibilityState.subscribe((state) => this.onVisibility(state)),
    );
    this.exposeStatus();
    this.startDay(todayId(), 'daily');
  }

  private createPanels(): void {
    const parent = this.boardEntity;
    const make = (id: string, file: string, w: number, h: number, interactive = true) =>
      new Panel(this.world, parent, id, uiUrl(file), w, h, interactive);
    this.panels = {
      brief: make('BriefingPanel', 'briefing.uikitml', 0.4, 0.25),
      strip: make('InstructionStrip', 'strip.uikitml', 0.16, 0.03, false),
      toolbar: make('Toolbar', 'toolbar.uikitml', TOOLBAR_W, TOOLBAR_H),
      pause: make('PausePanel', 'pause.uikitml', 0.32, 0.198),
      about: make('AboutPanel', 'about.uikitml', 0.32, 0.198),
      result: make('ResultPanel', 'result.uikitml', 0.4, 0.25),
      inspect: make('InspectPanel', 'inspect.uikitml', 0.088, 0.022, false),
      journal: make('JournalPanel', 'journal.uikitml', 0.2, 0.18),
      captions: make('Captions', 'captions.uikitml', 0.16, 0.022, false),
    };
    const { widthM, depthM } = this.board.dims;
    const stand = (p: Panel) => p.place(0, 0.1 + p.heightM / 2, -depthM / 2 - 0.03, -0.2);
    stand(this.panels.brief);
    stand(this.panels.pause);
    stand(this.panels.about);
    stand(this.panels.result);
    // Just in front of the near edge, low, so they never cover the board from the eyes:
    // the strip on the left half, the toolbar on the right.
    this.panels.strip.place(-widthM / 2 + 0.16, 0.03, depthM / 2 + 0.045, -0.95);
    this.panels.toolbar.place(widthM / 2 - TOOLBAR_W / 2 - 0.005, 0.035, depthM / 2 + 0.06, -0.85);
    // Captions in front of the strip, low and nearly flat: never over the board.
    this.panels.captions.place(-widthM / 2 + 0.16, 0.012, depthM / 2 + 0.085, -1.15);

    this.panels.brief.onClick('btn-start', () => this.startLive());
    this.toolbar = new Toolbar(this.panels.toolbar, () => this.pause());
    this.panels.brief.onClick('btn-resume-run', () => this.resumeRun());
    this.panels.pause.onClick('btn-resume', () => this.resume());
    this.panels.pause.onClick('btn-about', () => this.showAbout(true));
    this.panels.pause.onClick('btn-place', () => this.placeAgain());
    this.panels.pause.onClick('btn-day0', () => this.replayDay0());
    this.panels.about.onClick('btn-close', () => this.showAbout(false));
    this.panels.result.onClick('btn-replay', () => this.startLapse());
    this.panels.result.onClick('btn-done', () => this.playAgain());
    // The journal stands left of the board, turned toward the player.
    this.panels.journal.place(-widthM / 2 - 0.13, 0.1 + 0.09, -0.02, -0.15, 0.45);
    this.journalView = new JournalView(this.panels.journal);
    this.journalView.onPick = (dayId) => this.practiceDay(dayId);
    this.panels.about.setText('about-model', ABOUT.model);
    this.panels.about.setText('about-safety', ABOUT.safety);
  }

  private createTools(): void {
    this.tools = new ToolInput(this.world, this.board, this.boardEntity, this.player.raySpaces, this.player);
    const packed = () => this.session?.frame?.stateRGBA ?? null;
    this.digTool = new DigTool(this.board, {
      packed,
      budgetLeft: () => this.budgetLeft(),
      firePoint: () => this.firePoint(),
      commit: (cells) => this.dig(cells),
      outOfBudget: () => this.showNotice(STATUS.noBudget),
    });
    this.waterTool = new WaterTool(this.board, this.board.waterPreview, {
      cooldownLeft: () => this.waterCooldownLeft(),
      windDeg: () => this.session?.frame?.wind.dirDeg ?? this.session?.day?.wind.dirDeg ?? 0,
      drop: (startCell, dirDeg) => this.water(startCell, dirDeg),
      notReady: (seconds) => this.showNotice(STATUS.readyIn(seconds)),
    });
    this.backburnTool = new BackburnTool(this.board, this.board.holdRing, {
      packed,
      firePoint: () => this.firePoint(),
      light: (cell, side) => this.backburn(cell, side),
      noLine: () => this.showNotice(STATUS.noLineHere),
    });
    // Day 0's "Pinch to light": any pinch on the board starts the beat.
    this.lightTool = {
      begin: () => this.startDay0Beat(),
      move: () => {},
      end: () => {},
      cancel: () => {},
    };
    this.inspect = new Inspect(this.board, this.panels.inspect, {
      packed,
      elevation: () => this.board.elevationM,
    });
    this.tools.hoverListener = this.inspect;
    this.toolbar.onSelect = (tool) => this.tools.setTool(this.strokeTool(tool));
  }

  /** Sound, captions and haze: the parts of the fire that reach the room. */
  private createRoom(): void {
    this.audio = new FireAudio(this.player.head, this.board.aircraft.plane, this.board.aircraft.veil);
    this.board.root.add(this.audio.crackleAnchor, this.audio.digAnchor);
    this.audio.setEnabled(this.store.settings.sound);
    // Browsers start audio only from a gesture: the first press anywhere (Enter mixed reality).
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    this.cleanupFuncs.push(() => window.removeEventListener('pointerdown', unlock));
    this.captions = new Captions(this.panels.captions);
    this.captions.enabled = this.store.settings.captions;
    this.haze = new Haze();
    this.player.head.add(this.haze.mesh);
  }

  private strokeTool(tool: Tool | null): StrokeTool | null {
    if (tool === 'dig') return this.digTool;
    if (tool === 'water') return this.waterTool;
    if (tool === 'backburn') return this.backburnTool;
    return null;
  }

  /** A fresh session for a day: the daily fire, a practice run, or a Day 0 beat. */
  private openSession(dayId: string, kind: RunKind, tools: Tool[]): Session {
    this.session?.dispose();
    this.dayId = dayId;
    this.kind = kind;
    this.readyForPlay = false;
    this.lapse = null;
    this.lineId = 0;
    this.lineCount = 0;
    this.pendingCells = 0;
    this.tools.setEnabled(false);
    this.board.ghost.stop();
    this.intro = null;
    this.dayTools = tools;
    const session = new Session(this.store, dayId, kind, `${dayId}:${Date.now()}`, tools);
    this.session = session;
    session.onFrame = (frame) => {
      // A Day 0 beat that ran out is fast forwarded in the worker: not worth showing.
      if (this.phase === 'timelapse' || (kind === 'tutorial' && session.resolving)) return;
      this.board.applyFrame(frame);
      for (const e of frame.events) if (e.type === 'windShiftAnnounce') this.captions.cue('windShift');
    };
    return session;
  }

  private startDay(dayId: string, requested: RunKind): void {
    // A date's daily fire counts once; playing it again is practice.
    const kind: RunKind = requested === 'daily' && this.journal.hasDaily(dayId) ? 'practice' : requested;
    const stored = this.store.loadRun();
    const tools = toolsFor(this.store.progress.completedFires);
    const session = this.openSession(dayId, kind, tools);
    this.storedRun =
      kind === 'daily' && stored && stored.dayId === dayId && stored.status === 'in_progress' && stored.pausedAtTick > 0 &&
      stored.settings.slowerFire === this.store.settings.slowerFire
        ? stored
        : null;
    session.onOutcome = (info) => this.showOutcome(info);
    void session.start().then((ready) => {
      if (this.session !== session) return;
      this.dayNumber = ready.day.dayNumber;
      this.showLandscape(ready, dayId);
      const word = windWord(ready.day.wind.speedMs);
      this.panels.brief.setText('brief-day', kind === 'practice' ? BRIEF.practice(ready.day.dayNumber) : BRIEF.day(ready.day.dayNumber));
      this.panels.brief.setText('brief-goal', BRIEF.goal(ready.landscape.houses.length));
      this.panels.brief.setText('brief-wind', BRIEF.windWords[word]);
      for (let k = 1; k <= 4; k++) {
        this.panels.brief.setProps(`bar-${k}`, { backgroundColor: k <= word + 1 ? '#1d1c1a' : '#f3f1ed' });
      }
      // The dial faces the player like the board: up is the far edge.
      this.panels.brief.setProps('brief-arrow', { transformRotateZ: -ready.day.wind.dirDeg });
      this.toolbar.setUnlocked(ready.day.tools);
      this.toolbar.select('dig');
      const run = this.storedRun;
      this.panels.brief.setProps('btn-resume-run', { display: run ? 'flex' : 'none' });
      if (run) this.panels.brief.setText('resume-label', STATUS.resume((ready.day.liveTicks - run.pausedAtTick) / TICK_HZ));
      this.readyForPlay = true;
      if (this.phase === 'landing') this.board.setRise(1);
      if (this.phase === 'brief' || this.phase === 'plan') this.enter('brief');
    });
  }

  private showLandscape(ready: { day: { wind: { speedMs: number; dirDeg: number }; spreadPeriodTicks: number }; landscape: Parameters<Board['setLandscape']>[0] }, key: string): void {
    if (this.board.landscapeKey === key) this.board.resetFire();
    else this.board.setLandscape(ready.landscape, key);
    this.board.setWind(ready.day.wind.speedMs, ready.day.wind.dirDeg, true);
    this.board.setStepSeconds(ready.day.spreadPeriodTicks / TICK_HZ);
  }

  // Day 0 ---------------------------------------------------------------------------------

  private get day0Active(): boolean {
    return this.day0Index >= 0;
  }

  private startDay0(): void {
    this.day0Index = 0;
    this.openDay0Beat();
  }

  private replayDay0(): void {
    this.paused = false;
    this.panels.pause.show(false);
    this.panels.about.show(false);
    this.startDay0();
  }

  private openDay0Beat(): void {
    const step = DAY0_SCRIPT[this.day0Index];
    const session = this.openSession(`day0-${step.beat}`, 'tutorial', step.beat === 'line' ? ['dig'] : []);
    session.onOutcome = (info) => this.day0Outcome(info);
    this.day0Stage = 'prompt';
    this.enter('day0');
    void session.start().then((ready) => {
      if (this.session !== session) return;
      this.dayNumber = 0;
      this.showLandscape(ready, 'day0');
      this.board.setRise(1);
      this.toolbar.setUnlocked(ready.day.tools);
      this.readyForPlay = true;
      this.day0Wait = 0;
      this.say(step.prompt);
      this.board.ghost.play(this.ghostPath(step.path), step.demo);
      if (step.beat === 'line') {
        this.panels.toolbar.show(true);
        this.toolbar.select('dig');
        // The guide: a dashed line where the first line goes.
        const guide = lineCells(step.path.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 })));
        this.board.lines.setPreview(guide, ready.day.crewBudgetCells, this.firePoint());
      } else {
        this.tools.setTool(this.lightTool);
      }
    });
  }

  /** The beat's fire starts: on the player's pinch (or line), or by itself after a while. */
  private startDay0Beat(): void {
    if (this.phase !== 'day0' || this.day0Stage !== 'prompt' || !this.readyForPlay || !this.session) return;
    const step = DAY0_SCRIPT[this.day0Index];
    this.day0Stage = 'live';
    this.phaseTime = 0;
    this.board.ghost.stop();
    if (step.beat !== 'line') this.tools.setTool(null);
    this.say(step.during);
    this.session.beginLive();
  }

  private day0Outcome(info: OutcomeInfo): void {
    const step = DAY0_SCRIPT[this.day0Index];
    if (step.beat !== 'line') {
      this.day0Index++;
      this.openDay0Beat();
      return;
    }
    this.day0Stage = 'ending';
    this.phaseTime = 0;
    this.tools.setTool(null);
    this.say(info.outcome.resolvedByFastForward ? RESULT.outOfTime : INSTRUCTION.contained);
  }

  private finishDay0(): void {
    const progress = this.store.progress;
    // Day 0 counts as a completed fire (it unlocks the water drop for the next one).
    this.store.saveProgress({ day0Done: true, completedFires: progress.completedFires + 1 });
    this.day0Index = -1;
    this.startDay(todayId(), 'daily');
    this.enter('brief');
  }

  private ghostPath(cells: readonly { x: number; y: number }[]): { x: number; y: number; z: number }[] {
    const d = this.board.dims;
    return cells.map((c) => ({ x: d.xOf(c.x), y: this.board.cellHeight[c.y * W + c.x], z: d.zOf(c.y) }));
  }

  // Phases --------------------------------------------------------------------------------

  private onVisibility(state: VisibilityState): void {
    const immersive = state !== VisibilityState.NonImmersive;
    if (immersive && !this.immersive) {
      this.immersive = true;
      this.playSeconds = 0;
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
      if (this.day0Active) {
        this.day0Index = -1;
        this.startDay(todayId(), 'daily');
      }
      this.enter('landing');
    }
    if (state === VisibilityState.VisibleBlurred) this.pause();
  }

  private say(text: string): void {
    this.stripText = text;
    this.panels.strip.setText('strip-text', text);
  }

  private enter(phase: Phase): void {
    this.phase = phase;
    this.phaseTime = 0;
    const p = this.panels;
    p.brief.show(phase === 'brief' || phase === 'plan');
    p.result.show(phase === 'outcome');
    p.journal.show(phase === 'outcome' || phase === 'brief');
    if (phase === 'outcome' || phase === 'brief') this.refreshJournal();
    const day0Line = phase === 'day0' && DAY0_SCRIPT[this.day0Index]?.beat === 'line';
    p.toolbar.show(phase === 'live' || phase === 'brief' || phase === 'plan' || phase === 'timelapse' || day0Line);
    p.pause.show(false);
    p.about.show(false);
    p.strip.show(phase !== 'landing' && phase !== 'outcome' && phase !== 'resolving');
    this.board.outline.visible = false;
    if (phase !== 'plan' && phase !== 'day0') this.board.ghost.stop();
    switch (phase) {
      case 'placing':
        this.say(INSTRUCTION.place);
        break;
      case 'brief':
        this.board.setRise(0);
        this.say(INSTRUCTION.plan);
        p.brief.setText('start-label', BRIEF.start);
        break;
      case 'plan':
        this.startIntro();
        break;
      case 'live':
        this.say(this.lineCount > 0 ? INSTRUCTION.watch : INSTRUCTION.draw);
        break;
      case 'timelapse':
        this.say(RESULT.replay);
        this.board.crew.root.visible = false;
        break;
    }
  }

  /** A tool new in this fire: selected, shown once by the ghost hand, named on the strip. */
  private startIntro(): void {
    const tool = this.kind === 'tutorial' ? null : introFor(this.dayTools, this.store.progress.introsShown);
    this.intro = tool;
    if (tool !== 'water' && tool !== 'backburn') {
      this.say(INSTRUCTION.draw);
      return;
    }
    this.toolbar.select(tool);
    this.say(INTRO_TEXT[tool]);
    // Between the fire and the town, where the tool would help.
    const fire = this.firePoint();
    const town = this.session?.ready?.landscape.town ?? fire;
    const mx = Math.round(fire.x + (town.x - fire.x) * 0.4);
    const my = Math.round(fire.y + (town.y - fire.y) * 0.4);
    const path = tool === 'water' ? [{ x: mx - 6, y: my }, { x: mx + 6, y: my }] : [{ x: mx, y: my }];
    const clamp = (c: { x: number; y: number }) => ({ x: Math.min(W - 1, Math.max(0, c.x)), y: Math.min(79, Math.max(0, c.y)) });
    this.board.ghost.play(this.ghostPath(path.map(clamp)), tool === 'water' ? 'drag' : 'hold');
    this.store.saveProgress({ introsShown: { ...this.store.progress.introsShown, [tool]: true } });
  }

  private startLive(): void {
    if ((this.phase !== 'brief' && this.phase !== 'plan') || !this.session || !this.readyForPlay) return;
    this.board.setRise(1);
    this.storedRun = null;
    this.session.beginLive();
    this.enter('live');
  }

  /** Resume after a reload: the stored run replays to its tick, then plays live. */
  private resumeRun(): void {
    const run = this.storedRun;
    if ((this.phase !== 'brief' && this.phase !== 'plan') || !this.session || !this.readyForPlay || !run) return;
    this.storedRun = null;
    this.board.setRise(1);
    const fire = this.firePoint();
    for (const input of run.inputs) {
      if (input.kind !== 'dig') continue;
      this.board.lines.add(input.cells, fire);
      this.lineId = Math.max(this.lineId, input.lineId);
      this.lineCount++;
    }
    this.session.resumeFrom(run);
    this.enter('live');
  }

  private budgetLeft(): number {
    const day = this.session?.day;
    const left = this.session?.frame?.budgetLeft ?? day?.crewBudgetCells ?? 0;
    return Math.max(0, left - this.pendingCells);
  }

  private waterCooldownLeft(): number {
    // While the aircraft is on its way the drop is not applied yet: count it as cooling.
    if (this.board.aircraft.busy) return 20;
    return this.session?.waterCooldownLeft ?? 0;
  }

  /** Where the line ticks point: the fire front, or the ignition before it spreads. */
  private firePoint(): { x: number; y: number } {
    const front = this.session?.frame?.frontCentroid;
    if (front && front[0] >= 0) return { x: front[0], y: front[1] };
    const cell = this.session?.day?.ignition[0]?.cell ?? 0;
    return { x: cell % W, y: Math.floor(cell / W) };
  }

  private canAct(): boolean {
    return (this.phase === 'plan' || this.phase === 'live' || (this.phase === 'day0' && this.day0Stage !== 'ending')) && !this.paused;
  }

  private send(input: Input, onOk: (input: Input) => void): void {
    const session = this.session;
    if (!session) return;
    void session.sendInput(input).then((reply) => {
      if (this.session !== session) return;
      if (reply.ok) onOk(reply.input);
      else if (reply.reason === 'budget') this.showNotice(STATUS.noBudget);
      else if (reply.reason === 'cooldown') this.showNotice(STATUS.readyIn(session.waterCooldownLeft));
      else if (input.kind === 'backburn') this.showNotice(STATUS.noLineHere);
    });
  }

  private dig(cells: number[]): void {
    if (!this.session) return;
    const lineId = ++this.lineId;
    this.pendingCells += cells.length;
    const fire = this.firePoint();
    const session = this.session;
    void session.sendInput({ kind: 'dig', tick: 0, lineId, cells }).then((reply) => {
      this.pendingCells = Math.max(0, this.pendingCells - cells.length);
      if (this.session !== session) return;
      if (!reply.ok) {
        if (reply.reason === 'budget') this.showNotice(STATUS.noBudget);
        return;
      }
      if (reply.input.kind !== 'dig') return;
      this.board.lines.add(reply.input.cells, fire);
      this.lineCount++;
      if (this.phase === 'day0') this.startDay0Beat();
      if (this.phase === 'live' && this.notice <= 0) this.say(INSTRUCTION.watch);
    });
  }

  private water(startCell: number, dirDeg: number): void {
    const session = this.session;
    if (!session) return;
    this.board.ghost.stop();
    this.board.aircraft.fly(startCell, dirDeg, () => {
      if (this.session !== session || !this.canActOn()) return;
      this.send({ kind: 'water', tick: 0, startCell, dirDeg, lengthCells: WATER_LENGTH_CELLS, widthCells: WATER_WIDTH_CELLS }, () => {});
      this.audio.water();
      this.captions.cue('water');
    });
  }

  /** The aircraft may arrive after a pause; it drops only while the fire can still be fought. */
  private canActOn(): boolean {
    return this.phase === 'plan' || this.phase === 'live';
  }

  private backburn(cell: number, side: BackburnSide): void {
    this.board.ghost.stop();
    this.send({ kind: 'backburn', tick: 0, lineId: 0, cell, side }, () => {});
  }

  private showNotice(text: string): void {
    this.notice = NOTICE_S;
    this.panels.strip.setText('strip-text', text);
  }

  private pause(): void {
    if (this.paused) return;
    if (this.phase === 'landing' || this.phase === 'placing' || this.phase === 'outcome') return;
    this.paused = true;
    this.session?.pause();
    this.audio.setPaused(true);
    this.panels.pause.show(true);
    this.panels.pause.setText('day0-label', PAUSE.day0);
    this.panels.brief.show(false);
    this.panels.result.show(false);
  }

  private resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.session?.resume();
    this.audio.setPaused(false);
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
    r.setText('you-line', RESULT.line(this.dugCells(info)));
    r.setText('base-line', RESULT.noLine);
    const progress = this.store.progress;
    this.store.saveProgress({
      completedFires: progress.completedFires + 1,
      firstDay: progress.firstDay ?? this.dayId,
    });
    this.journal.record(this.dayId, this.kind === 'daily' ? 'daily' : 'practice', you, info.outcome.scarBits, Date.now());
    this.enter('outcome');
    this.panels.strip.show(true);
    this.say(info.outcome.resolvedByFastForward ? RESULT.outOfTime : INSTRUCTION.contained);
  }

  private dugCells(info: OutcomeInfo | null): number {
    if (!info) return 0;
    let n = 0;
    for (let i = 0; i < info.lineAt.length; i++) if (info.lineAt[i] >= 0) n++;
    return n;
  }

  private refreshJournal(): void {
    const today = todayId();
    const best = personalBest(this.journal.days);
    this.journalView.render(shelfSlots(this.journal.days, today), streak(this.journal.days, today), best, best ? dayNumber(best.dayId) : 0, this.store.notSaved);
  }

  /** A past day from the journal, played as practice. */
  private practiceDay(dayId: string): void {
    if (this.phase !== 'outcome' && this.phase !== 'brief') return;
    this.startDay(dayId, 'practice');
    this.enter('brief');
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
    if (this.immersive) this.playSeconds += Math.min(dt, 0.25);

    const acting = this.canAct() && this.readyForPlay;
    this.tools.setEnabled(acting);
    if (acting) this.tools.update(this.renderer.xr.getFrame(), this.renderer.xr.getReferenceSpace(), dt);
    this.inspect.update(acting ? dt : 0, this.tools.drawing || !acting);
    if (this.intro && this.tools.drawing) this.board.ghost.stop();
    const day = this.session?.day;
    if (day) {
      this.toolbar.setBudget(this.budgetLeft(), day.crewBudgetCells, this.digTool.previewCells);
      this.toolbar.setCooldown(this.waterCooldownLeft() > 0 && !this.board.aircraft.busy ? this.waterCooldownLeft() : 0);
    }
    if (this.notice > 0) {
      this.notice -= dt;
      if (this.notice <= 0) this.panels.strip.setText('strip-text', this.restingText());
    }
    this.player.head.getWorldPosition(this.camWorld);
    if (!this.immersive) this.world.camera.getWorldPosition(this.camWorld);

    switch (this.phase) {
      case 'placing':
        this.board.outline.visible = placement.status === 'candidate';
        if (placement.status === 'placed') {
          this.board.root.visible = true;
          if (this.day0Active) this.enter('day0');
          else if (!this.store.progress.day0Done) this.startDay0();
          else this.enter('brief');
          if (placement.mode === 'fallback' && !this.day0Active) this.say(INSTRUCTION.move);
        }
        break;
      case 'day0': {
        if (frozen || !this.readyForPlay) break;
        const step = DAY0_SCRIPT[this.day0Index];
        this.day0Wait += Math.min(dt, 0.25);
        if (this.day0Stage === 'prompt' && this.day0Wait >= step.autoStartS) this.startDay0Beat();
        else if (this.day0Stage === 'live') this.session?.update(dt);
        else if (this.day0Stage === 'ending' && this.phaseTime >= DAY0_END_S) this.finishDay0();
        break;
      }
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
    this.updateRoom(frozen ? 0 : dt);
    this.board.update(dt, this.camWorld, frozen);
  }

  private updateRoom(dt: number): void {
    const frame = this.session?.frame;
    const live = !this.paused && (this.phase === 'live' || (this.phase === 'day0' && this.day0Stage === 'live'));
    const burning = this.board.burningNow;
    const d = this.board.dims;
    let front: { x: number; y: number; z: number } | null = null;
    if (frame && frame.frontCentroid[0] >= 0) {
      const [fx, fy] = frame.frontCentroid;
      const cell = Math.round(fy) * W + Math.round(fx);
      front = { x: d.xOf(fx), y: this.board.cellHeight[cell] ?? 0, z: d.zOf(fy) };
    }
    if (frame && frame.crew.cell >= 0) this.digHold = 1;
    else this.digHold = Math.max(0, this.digHold - dt);
    const digging = this.digHold > 0;
    if (frame && frame.crew.cell >= 0) {
      const c = frame.crew.cell;
      this.audio.digAnchor.position.set(d.xOf(c % W), this.board.cellHeight[c], d.zOf(Math.floor(c / W)));
    }
    const windMs = frame?.wind.speedMs ?? 0;
    this.audio.update({ live, burning, front, windMs, digging }, dt);
    const flying = this.board.aircraft.busy;
    if (flying && !this.wasFlying) this.audio.aircraft();
    this.wasFlying = flying;

    this.ongoing.clear();
    if (live && burning > 0) this.ongoing.add('crackling');
    if (live && windMs >= 3.5) this.ongoing.add('wind');
    if (live && digging) this.ongoing.add('digging');
    if (flying) this.ongoing.add('aircraft');
    this.captionText = this.captions.update(dt, this.ongoing, this.immersive && this.phase !== 'landing');
    this.haze.update(dt, burning, this.immersive && live);
    this.board.smoke.ceilingY = placement.ceilingY === null ? Infinity : placement.ceilingY - this.boardWorldY();
  }

  private boardWorldY(): number {
    this.board.root.getWorldPosition(this.camWorld2);
    return this.camWorld2.y;
  }

  /** What the strip goes back to after a notice. */
  private restingText(): string {
    if (this.phase === 'day0') return this.stripText;
    if (this.phase === 'plan' && this.intro && (this.intro === 'water' || this.intro === 'backburn')) return INTRO_TEXT[this.intro];
    if (this.phase === 'live' && this.lineCount > 0) return INSTRUCTION.watch;
    if (this.phase === 'live' || this.phase === 'plan') return INSTRUCTION.draw;
    return this.stripText;
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
          budgetLeft: self.budgetLeft(),
          lines: self.lineCount,
          inputs: self.session?.inputs.length ?? 0,
          drawing: self.tools.drawing,
          lastStroke: self.tools.lastKind,
          resumable: self.storedRun !== null,
          dugCells: self.dugCells(self.session?.outcome ?? null),
          kind: self.kind,
          audio: self.audio.state,
          levels: self.audio.levels(),
          caption: self.captionText,
          haze: Math.round(self.haze.level * 1000) / 1000,
          ceiling: placement.ceilingY,
          today: todayId(),
          streak: streak(self.journal.days, todayId()),
          journal: shelfSlots(self.journal.days, todayId()).map((slot) => `${slot.dayNumber}:${slot.state}`),
          tools: self.dayTools,
          tool: self.toolbar.selected,
          day0: self.day0Active ? `${DAY0_SCRIPT[self.day0Index].beat}:${self.day0Stage}` : '',
          completedFires: self.store.progress.completedFires,
          intro: self.intro,
          waterCooldown: self.waterCooldownLeft(),
          aircraft: self.board.aircraft.busy,
          inspect: self.inspect.shownCell,
          strip: self.stripText,
          ghost: self.board.ghost.active,
          playSeconds: Math.round(self.playSeconds),
        };
      },
    };
    (globalThis as unknown as { holdline: unknown }).holdline = status;
  }
}
