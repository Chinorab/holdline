# Implementation Plan: Holdline, tabletop wildfire

**Branch**: `001-tabletop-wildfire` | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-tabletop-wildfire/spec.md`

## Summary

A WebXR mixed reality game built on IWSDK: today's procedurally generated landscape lands
on the player's real table as a stacked paper relief board; a deterministic cellular
automaton (after Alexandridis et al. 2008) runs the fire in a Web Worker; the player digs
lines, calls water drops and lights backburns with pinch gestures; the outcome compares the
run with the same fire and the same chance events without intervention, then replays it as
a time lapse and files it in a local journal. Six vertical slices, each playable and proven
in the IWSDK emulator, ship to a static HTTPS site on Vercel before 2026-11-18 20:00 UTC.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), ES2022 modules, GLSL ES 3.0 shaders

**Primary Dependencies**: `@iwsdk/core` 1.1.0-rc.2 (ECS, XR session, input, spatial UI,
scene understanding, audio; Three.js re-exported as super-three 0.185), `@pmndrs/uikit`
with the Horizon kit (UIKitML panels), `@iwsdk/cli` and `@iwsdk/vite-plugin-dev` (dev server,
IWER emulator, agent bridge), Vite 7. Dev only: Vitest, Playwright, `@meta-quest/metavr`.

**Storage**: browser localStorage, versioned keys (contracts/storage-schema.md)

**Testing**: Vitest for the simulation and pure logic; IWSDK CLI or MCP scripted XR
sessions in the emulator (Meta Quest 3 and Meta VR Glasses profiles, five rooms); Playwright
for web pages and the Enter mixed reality flow

**Target Platform**: Meta Quest Browser on Meta Quest 3 and 3S (judges); Meta VR Glasses
fit checked in the emulator; desktop and phone browsers see the landing page only

**Project Type**: single web application (static site plus WebXR app), no backend

**Performance Goals**: 72 fps, never below 60; under 100 draw calls and 250k triangles;
cold start under 5 s to the placement highlight; sim tick 6 Hz with frame rate visuals

**Constraints**: hands only, seated, 60 cm reach; deterministic replay; no network at
runtime beyond the site's own origin; English only copy rules; deadline 2026-11-18 20:00 UTC

**Scale/Scope**: 128 by 80 cell grid, one board, about 12 panels, 6 tools and controls,
one player per device, journal up to 400 days

## Constitution Check

*Gate before Phase 0, re-checked after Phase 1. Constitution v1.0.1.*

| Principle | Plan compliance | Status |
|-----------|-----------------|--------|
| I. Hands first, seated | pinch, drag, hold, poke, grab only; 60 cm reach; either hand; one hand mode; gaze plus pinch on Glasses, hand ray plus pinch on Quest, Head pointer option for head pointing plus pinch; dwell select | Pass, see CT1 |
| II. Room | plane and table mesh scoring, 4 s fallback with handle, raw WebXR anchors with persistent handle, smoke into the room, haze, smoke stops at a detected ceiling, five room tests | Pass, see CT4 |
| III. FoV aware | board 56 cm at 45 to 55 cm, essentials on the near edge or panel stand inside 58 by 54, angle checks per slice, runtime Glasses view mask off by default, no camera motion, no flicker above 3 Hz | Pass, see CT3 |
| IV. Deterministic sim | counter based RNG, synchronous CA, recorded inputs, detmath, state hash tests, baseline from same keys, worker at 6 Hz, About copy | Pass; constants pending T010 |
| V. Performance | about 55 draw calls and 140k triangles planned, instancing, one terrain shader, no shadows or post, 72 Hz request, render stats in PERF.md each slice | Pass |
| VI. Fast in, clean out | Day 0 under 3 min, fire day 4 to 6 min, 4 word instructions with ghost hands, Pause on the edge, auto pause, resume after reload | Pass |
| VII. Accessible | one hand, either hand, gaze, high contrast, CVD safe fire (light core, ink edge), captions on by default, board size and height, slower fire, dwell | Pass |
| VIII. Private | no backend, localStorage only, no camera, self hosted fonts and input profiles, synthesized sounds, CREDITS.md | Pass, see R14 risk |
| IX. Truthful copy | figures from R1 only, copy module with CI scan, no people on the board, no brands, identity from the canvas, renamed Holdline | Pass |
| X. Verify, slice | verify first at each slice start, six slices with gates, screenshot plus clean console per claim, backburn cut first | Pass |

Post design re-check: the design artifacts below add no violation beyond CT1 to CT4.

## Project Structure

### Documentation (this feature)

```text
specs/001-tabletop-wildfire/
├── plan.md              # this file
├── research.md          # Phase 0 decisions R1 to R16
├── data-model.md        # entities, enums, transitions
├── quickstart.md        # run and validation guide
├── contracts/           # worker-protocol.md, storage-schema.md, ui-contract.md
├── checklists/          # requirements.md
└── tasks.md             # Phase 2 (speckit-tasks)
```

### Source Code (repository root)

```text
index.html               # landing page (DOM) and XR canvas host
privacy.html             # privacy page (DOM)
iwsdk.config.json        # project authority: XR features, emulator device and room
public/
├── favicon.svg, favicon.ico, icon-192.png
├── fonts/               # woff2 for pages, MSDF json and png for UIKit
├── input-profiles/      # self hosted hand and controller profiles (R14)
├── ui/*.uikitml         # briefing, toolbar, result, journal, settings, about, pause, strip
└── scenes/main.iwsdk.scene.json   # minimal composition (lights only)
src/
├── index.ts             # World.create, system registration, landing wiring
├── assets.ts            # defineAssets: UIKitML panels
├── components.ts        # defineComponents: Board, Tool, Placement, Dwell, etc.
├── copy.ts              # every user facing string
├── sim/                 # pure TypeScript, no DOM, no Three: shared by worker and tests
│   ├── detmath.ts  rng.ts  grid.ts  terrain-gen.ts  day.ts
│   ├── model.ts    sim.ts  inputs.ts  outcome.ts  hash.ts
├── worker/              # sim.worker.ts, protocol.ts, client.ts
├── game/                # session.ts (clock, inputs, persistence), phases.ts, unlocks.ts, day0.ts
├── xr/                  # placement-system.ts, anchor-service.ts, board-transform.ts,
│                        # visibility-system.ts, glasses-view.ts, head-pointer.ts
├── render/              # board.ts, terrain-mesh.ts, terrain.glsl.ts, state-texture.ts,
│                        # vegetation.ts, houses.ts, flames.ts, lines.ts, smoke.ts, haze.ts,
│                        # aircraft.ts, crew.ts, wind-vane.ts, ghost-hand.ts, timelapse.ts
├── input/               # tool-system.ts, dig.ts, water.ts, backburn.ts, inspect.ts, dwell-system.ts
├── ui/                  # panels.ts, toolbar.ts, captions.ts, instructions.ts, journal-view.ts
├── audio/               # synth.ts, audio-system.ts
├── store/               # storage.ts, progress.ts, journal.ts, migrations.ts
└── web/                 # landing.ts, capability.ts
tests/
├── sim/                 # determinism, spread, breaks, water, backburn, outcome, generator
├── logic/               # unlocks, streak, storage, copy scan
└── web/                 # playwright specs
scripts/emulator/        # repeatable CLI sequences per slice (placement, tools, glasses)
README.md DEVPOST.md VIDEO_SCRIPT.md TESTING.md CREDITS.md PERF.md PROGRESS.md LICENSE
```

**Structure Decision**: one Vite project, as scaffolded by `npm create @iwsdk@latest`. The
template's demo content (robot, studio scene, welcome panel, chime) is removed in slice a.
`src/sim` stays framework free so Vitest runs it in Node and the worker runs it unchanged.

## Slices

Each slice ends with the gate from the constitution: typecheck, tests, emulator run (Quest 3
and Glasses profiles), two or more rooms, screenshot, zero console errors, PERF.md numbers,
PROGRESS.md, commit.

| Slice | Delivers | Target dates |
|-------|----------|--------------|
| a | template cleanup, rename, sim core and tests, terrain generator, board and terrain shader, placement with fallback and anchors, brief, live fire, pause and resume, smoke, time lapse | Nov 1 to 3 |
| b | dig line (near and far), crew digging, budget, toolbar, outcome versus baseline, result card, resume after reload | Nov 4 to 5 |
| c | water drop and aircraft, backburn, inspect tooltip, Day 0 in three beats plus first line, ghost hands, unlocks by fires played | Nov 6 to 8 |
| d | daily seed and day numbers, practice on past days, journal shelf and panel, streak and best, synthesized spatial audio, captions, room haze, ceiling stop | Nov 9 to 10 |
| e | high contrast, one hand mode, board size and height, slower fire, dwell select, head pointer, Glasses view mask and compact layout, glasses angle checks, performance pass | Nov 11 to 13 |
| f | landing and privacy pages from the canvas, favicon, real hero capture, Vercel deploy, README, DEVPOST, VIDEO_SCRIPT, TESTING, CREDITS, PERF, final pass | Nov 14 to 17 |

Nov 18 is a buffer: submit on Devpost before 20:00 UTC (21:00 Paris).

## Risks

| Risk | Mitigation |
|------|------------|
| No headset: hand feel, real planes, persistent anchors and frame rate unproven on device | emulator scripts for every path, conservative budgets, fallback placement first class, TESTING.md states what only a headset can prove |
| Constants of the paper unverified | T010 before any public number; DEVPOST says "inspired by" until then |
| IWSDK 1.1 is a release candidate | pin exact versions, verify APIs at each slice start, no upgrade after slice c |
| Thin terrace risers shimmer | MSAA, fallback to smooth relief with shader contours (R5) |
| UIKit custom fonts | verify MSDF path in slice a; fallback to the kit font with the same sizes |
| Input profile CDN fetch | self host (R14); disclose if any request remains |
| Time | backburn is cut first; polish is protected |

## Complexity Tracking

| Deviation | Why needed | Simpler alternative rejected because |
|-----------|------------|-------------------------------------|
| CT1: head pointing is an option, not the default fallback | IWSDK guidance: no head pose fallback for gaze in production; Quest uses hand rays | a default head ray would fight the hand ray on Quest and hover everything the head faces |
| CT2: near drawing projects the pinch point onto the heightfield instead of a RayInteractable ray | drawing on a table with a wrist ray is awkward; pointer events have no pinch point pointer | ray only drawing fails the "direct touch over the board" requirement |
| CT3: own Glasses view mask | IWSDK's field of view mask exists only in the dev emulator overlay | a URL flag still needs our own mask in production |
| CT4: raw WebXR anchors instead of the IWSDK `XRAnchor` component | `XRAnchor` has no persistent handle | without it the board cannot return to the same table |
| CT5: custom two hand yaw and scale instead of `TwoHandsGrabbable` | the board must stay level on the table with clamped size | free rotation would tilt the landscape and the horizon |
