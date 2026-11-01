---
description: "Task list for Holdline, tabletop wildfire"
---

# Tasks: Holdline, tabletop wildfire

**Input**: design documents in `specs/001-tabletop-wildfire/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md
**Tests**: requested by the brief (fire model unit tests, emulator runs, Playwright), so they
are included.

**Slices to stories**: a = US1, b = US2, c = US4 and US3, d = US5 and US6, e = US7, f = US8.
Every slice ends with a gate task: emulator run (Meta Quest 3 profile and Meta VR Glasses
profile in Gaze plus Hands mode), screenshots, zero console errors, render stats in PERF.md,
PROGRESS.md updated, commit.

**FIRST CUT** marks backburn work: drop it before any polish if time runs short.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 to US8 from spec.md

---

## Phase 1: Setup

- [x] T001 Remove template demo content (src/robot.ts, src/robot-component.ts, src/panel.ts, src/scene-assets/*.scene-asset.ts, public/ui/welcome.uikitml, public/ui/label-*.uikitml, public/audio/chime.mp3) and reset src/index.ts, src/assets.ts, src/components.ts and public/scenes/main.iwsdk.scene.json to a minimal AR app that typechecks
- [x] T002 Rename to Holdline in package.json (name), index.html (title) and README.md; add LICENSE (all rights reserved, Meta's MIT notice kept on starter files)
- [x] T003 Set iwsdk.config.json: `xr.offer` none, features handTracking, planeDetection, meshDetection, anchors, hitTest, gazeTracking (optional), sceneUnderstanding without wireframe, spatialUI light scheme, emulator device metaQuest3 and room living_room; validate against the schema
- [x] T004 [P] Add Vitest with vitest.config.ts and `npm test`, tests running sim code in Node
- [x] T005 [P] Add Playwright with playwright.config.ts (projects: dev server with emulator, production preview) and `npm run test:web` (config and script in place; the specs themselves are T081)
- [x] T006 [P] Keep public/**/AGENTS.md out of dist via a build step in vite.config.ts, plus scripts/check-dist.mjs (no AGENTS.md, no source maps, no foreign origins in built files)
- [x] T007 [P] Create src/copy.ts with every string of contracts/ui-contract.md and tests/logic/copy-scan.test.ts (no dash or hyphen characters, no emojis, no "AI", instructions at most 4 words)
- [x] T008 Extend .gitignore (artifacts/, .specify/feature.json) and commit the scaffold, specs and constitution

---

## Phase 2: Foundational (blocks every story)

- [x] T009 Verify first (hz-quest-verify-first, `metavr docs search`, `npx iwsdk reference search`): pointer events with hit point and capture, hand joint access, UIKitML MSDF fonts, input profile base path, IWER planes and anchors in emulated rooms, render stats output; write answers in research.md under "Slice a verification"
- [x] T010 Verify the Alexandridis et al. (2008) constants and slope formula against the paper's full text; record the result in research.md R2; until verified, public copy says "inspired by" with no number
- [x] T011 [P] Implement src/sim/detmath.ts (exp, atan, cos with basic IEEE operations) with tests/sim/detmath.test.ts (relative error under 1e-9 against Math, stable across calls)
- [x] T012 [P] Implement src/sim/rng.ts counter based hash RNG with tests/sim/rng.test.ts (uniformity, key independence)
- [x] T013 [P] Implement src/sim/grid.ts (W 128, H 80, index helpers, 8 neighbor offsets and distances) and src/sim/hash.ts (FNV 1a over typed arrays)
- [x] T014 Implement src/sim/terrain-gen.ts (seeded ridges and valleys, river, road, town of 6 houses, fuel, density, moisture) with tests/sim/terrain-gen.test.ts (same seed same arrays, river and road continuous, 6 houses, slope within range over 60 dates)
- [x] T015 Implement src/sim/day.ts (DayConfig for a date and for day0: seed, wind, shifts, ignitions, crew budget, spread period, tools) with tests/sim/day.test.ts
- [x] T016 Implement src/sim/model.ts (p_burn with p_veg, p_den, p_w, p_s, moisture factor, ember spotting) and src/sim/sim.ts (state arrays, synchronous step, events, hash)
- [x] T017 [P] tests/sim/determinism.test.ts: same day and inputs give the same hash at every step; replay from recorded inputs matches; baseline equals a fresh no input run
- [x] T018 [P] tests/sim/spread.test.ts: uphill faster than downhill on a synthetic slope; downwind faster than upwind on flat ground; grass catches faster than forest and forest burns longer
- [x] T019 [P] tests/sim/breaks.test.ts: rock, water, road and dug line stop spread with spotting off; with strong wind and spotting on, a seeded case starts a spot fire beyond the break
- [x] T020 [P] tests/sim/water.test.ts: a watered strip delays ignition and crossing compared with dry ground, and douses burning cells
- [x] T021 Implement src/sim/inputs.ts (Input types and validation: budget, cooldown, locked tools) and src/sim/outcome.ts (resolve to extinction with a 600 step cap, houses standing, hectares, scar bits)
- [x] T022 Implement src/worker/protocol.ts, src/worker/sim.worker.ts and src/worker/client.ts per contracts/worker-protocol.md (init, advance, input, resolve, replay, background baseline)
- [x] T023 Implement src/store/storage.ts (safe localStorage with in memory fallback), src/store/progress.ts and src/store/migrations.ts with tests/logic/storage.test.ts
- [x] T024 Implement src/game/session.ts: unpaused frame time to tick, input recording, run persisted on every input, on pause and every 5 s

**Checkpoint**: `npm test` green; the fire runs headless in Node.

---

## Phase 3: US1, the fire lands on my table (P1, slice a)

**Goal**: board on a real table (or fallback), brief, live fire that leans with wind and
slope, smoke into the room, pause and resume, time lapse.
**Independent test**: quickstart scenarios 1 to 4 in two rooms, one ending in the fallback.

- [x] T025 [US1] Self host input profiles in public/input-profiles/ and point IWSDK at them (or hide controller models) per research R14; the network log shows no third party request
- [x] T026 [P] [US1] Board root, paper plinth and grab rim in src/render/board.ts (56 by 35 cm default)
- [x] T027 [P] [US1] Terraced heightfield mesh (256 by 160 quads) in src/render/terrain-mesh.ts
- [x] T028 [US1] Terrain shader in src/render/terrain.glsl.ts with src/render/state-texture.ts: style board palette, contours and index edges, burning cells with light core and ink edge, burned ash, interpolation from ignition steps
- [x] T029 [P] [US1] Instanced trees, shrubs and houses with burned variants in src/render/vegetation.ts and src/render/houses.ts
- [x] T030 [P] [US1] Standing paper flames in src/render/flames.ts (alpha tested instanced cards, cap 400, sway under 3 Hz)
- [x] T031 [P] [US1] Smoke in src/render/smoke.ts (instanced billboards, cap 200, drifts with the wind past the board edge, ignition column in the brief)
- [x] T032 [P] [US1] Wind vane and grass sway in src/render/wind-vane.ts
- [x] T033 [US1] Placement in src/xr/placement-system.ts: score horizontal planes and table or desk meshes (0.5 to 1.1 m, near, in front, big enough), highlight, pinch to place, switch candidate, 4 s fallback pose with handle, redo from the edge, optional Scan table button (the optional Scan table button moves to slice e)
- [x] T034 [US1] Anchors in src/xr/anchor-service.ts (raw WebXR createAnchor, persistent handle save, restore and delete, at most 8, feature detected) with tests/logic/anchor-service.test.ts on a fake session
- [x] T035 [US1] Phase machine in src/game/phases.ts: placing, brief (landscape rises in about 10 s), plan (30 s, paused, Start ends early), live, resolving, outcome placeholder, time lapse
- [x] T036 [US1] Pause in src/xr/visibility-system.ts (auto pause on visibility loss) with public/ui/pause.uikitml; resume continues the exact tick (done in src/game/phases.ts through the visibility signal; no separate file)
- [x] T037 [US1] Time lapse in src/render/timelapse.ts (10 s, from ignition, burnout and line ticks) (done in src/render/board.ts and state-texture.ts)
- [x] T038 [US1] Briefing card public/ui/briefing.uikitml and instruction strip public/ui/strip.uikitml from the canvas, registered in src/assets.ts, fonts per T009 (Horizon kit font for now; local MSDF fonts with the web fonts in slice f)
- [x] T039 [US1] Gate: scripts/emulator/slice-a.mjs (enter XR with hands, placement in living_room and office_small, fire runs, pause and resume, time lapse), screenshots in artifacts/slice-a/, zero console errors, Glasses profile pass (ran in the desktop browser pane with IWER remote control because the IWSDK managed browser cannot start under the agent sandbox; see TESTING.md and scripts/emulator/slice-a.browser.js)
- [x] T040 [US1] Gate: peak fire render stats into PERF.md, PROGRESS.md, commit "slice a"

**Checkpoint**: a full fire plays on a real or fallback board with no input.

---

## Phase 4: US2, dig a line and see what it changed (P1, slice b)

**Goal**: dig lines near and far, crews dig progressively within a budget, outcome versus
the same fire with no action.
**Independent test**: one fire day with only the dig line; replay gives identical numbers.

- [ ] T041 [P] [US2] tests/sim/dig.test.ts: crews dig from the line start at a set pace, budget enforced, dug cells stop spread, burning and burned cells skipped
- [ ] T042 [P] [US2] tests/sim/outcome.test.ts: outcome numbers equal a recount of the final state, baseline ignores inputs, fast forward at the time limit
- [ ] T043 [US2] Tool input in src/input/tool-system.ts and src/input/dig.ts: far drawing from terrain pointer events, near drawing from the pinch point projected on the heightfield, rasterized to 8 connected cells, budget preview
- [ ] T044 [P] [US2] Lines (planned dashed, dug ink, ticks facing the fire) in src/render/lines.ts and the crew machine in src/render/crew.ts
- [ ] T045 [US2] Toolbar public/ui/toolbar.uikitml from the canvas (Dig line, Water drop, Backburn, Pause, budget meter) with src/ui/toolbar.ts
- [ ] T046 [US2] Result card public/ui/result.uikitml from the canvas (You, If no one had acted, houses, hectares, replay, Done) bound in src/ui/panels.ts
- [ ] T047 [US2] Resume after reload in src/game/session.ts: a stored run for today offers Resume and replays to its paused tick
- [ ] T048 [US2] Gate: scripts/emulator/slice-b.mjs (far line with the right hand ray, near line with the left hand, outcome card equals the worker outcome, replay identical), screenshots, PERF.md, commit "slice b"

**Checkpoint (MVP)**: US1 and US2 make a complete, honest game.

---

## Phase 5: US4 and US3, more tools and the first five minutes (slice c)

**Goal**: water drop, backburn (first cut), inspect, Day 0 by doing, unlocks by fires.
**Independent test**: fresh storage, Day 0 with hands only, contained in under 3 minutes;
then each tool once against the baseline.

- [ ] T049 [P] [US4] tests/sim/water-input.test.ts: 120 tick cooldown, strip from start and direction, douses burning cells
- [ ] T050 [US4] Water drop in src/input/water.ts: look or point, pinch, drag for direction (gaze drag follows the hand), preview strip, cooldown ring on the toolbar
- [ ] T051 [P] [US4] Generic aircraft and water reveal in src/render/aircraft.ts
- [ ] T052 [US4] Inspect tooltip in src/input/inspect.ts (400 ms hover, fuel, slope in degrees, Wet; nudged toward view center; hidden during a drag)
- [ ] T053 [P] [US4] FIRST CUT: tests/sim/backburn.test.ts (fire facing side, up to 12 cells, burns fuel ahead of the front, can escape after a wind shift)
- [ ] T054 [US4] FIRST CUT: backburn in src/input/backburn.ts (pinch and hold 1 s on a dug line, fill ring, side from the line ticks)
- [ ] T055 [US3] Unlocks in src/game/unlocks.ts with tests/logic/unlocks.test.ts (Day 0 is fire 1, water after 1 completed fire, backburn after 2, practice counts, intro once)
- [ ] T056 [US3] Day 0 in src/game/day0.ts with the day0 config in src/sim/day.ts: fixed layout, beats wind, slope, fuel and breaks, guided first line, tutorial crew speed
- [ ] T057 [P] [US3] Paper cutout ghost hand in src/render/ghost-hand.ts (open and pinch frames, follows a path) driven by src/ui/instructions.ts
- [ ] T058 [US3] First visit flow in src/game/phases.ts: Day 0 after placement, skipped for returning players, Replay Day 0 in settings, unlock intro beats
- [ ] T059 [US3] Gate: scripts/emulator/slice-c.mjs (fresh storage, Day 0 timed from xr enter to Contained, water by gaze on the Glasses profile and by hand ray on Quest 3, backburn hold), screenshots, PERF.md, commit "slice c"

---

## Phase 6: US5 and US6, daily habit and the room (slice d)

**Goal**: daily seed, practice, journal, streak and best; synthesized spatial sound,
captions, room haze, smoke stops at the ceiling.
**Independent test**: two dates give two fires, streak 2, a practice day leaves the streak;
each sound shows its caption.

- [ ] T060 [P] [US5] tests/logic/journal.test.ts: streak over dates (clock moved back too), practice keeps the streak, best order, missed days
- [ ] T061 [US5] Daily seed and numbers in src/sim/day.ts (local date, Day 1 = 2026-11-01, practice on the 7 previous days, a fire belongs to its start date)
- [ ] T062 [US5] Journal store src/store/journal.ts and scar miniatures in src/ui/journal-view.ts
- [ ] T063 [US5] Journal panel public/ui/journal.uikitml from the canvas and the shelf beside the board in src/render/shelf.ts
- [ ] T064 [P] [US6] Sound synthesis in src/audio/synth.ts (crackle, wind, aircraft, dig, water, tick) after the first gesture
- [ ] T065 [US6] Spatial audio in src/audio/audio-system.ts (crackle at the front scaled by burning cells, wind by speed, aircraft and crew positioned, Sound setting)
- [ ] T066 [US6] Captions in src/ui/captions.ts with public/ui/captions.uikitml (on by default, above the toolbar)
- [ ] T067 [P] [US6] Room haze in src/render/haze.ts (alpha 0 to 0.12 from burning cells, clears on containment) and smoke stop at a detected ceiling in src/render/smoke.ts
- [ ] T068 [US5] Gate: scripts/emulator/slice-d.mjs (two dates by clock injection, streak, journal tiles, practice, captions), screenshots, PERF.md, commit "slice d"

---

## Phase 7: US7, play it my way (slice e)

**Goal**: every access option, Glasses view, verified fit, performance pass.
**Independent test**: a fire day with the right hand only, the left hand only, gaze plus
pinch only, and dwell only; every essential element inside the glasses design area.

- [ ] T069 [US7] Settings panel public/ui/settings.uikitml from the canvas plus Captions, Dwell select, Head pointer, Board size, Board height, Replay Day 0, with src/ui/settings.ts
- [ ] T070 [P] [US7] High contrast palette in src/render/terrain.glsl.ts and the panels, with scripts/cvd-check.mjs (fire against its closest surface under protanopia, deuteranopia, tritanopia, grayscale)
- [ ] T071 [US7] Board transform in src/xr/board-transform.ts: two hand rim yaw and scale (45 to 60 cm), one hand edge controls, height offset
- [ ] T072 [US7] Slower fire from settings to the DayConfig spread period, longer plan, note on the result card
- [ ] T073 [US7] Dwell select in src/input/dwell-system.ts and head pointer in src/xr/head-pointer.ts (verify the custom ray pointer API at task start)
- [ ] T074 [US7] Glasses view in src/xr/glasses-view.ts (head space mask 37, 37, 25, 43 degrees, compact layout, automatic compact layout on gaze devices)
- [ ] T075 [US7] Fit check scripts/emulator/glasses-fit.mjs (iwsdk-glasses-test angle method for each essential element), table in TESTING.md
- [ ] T076 Performance pass: request 72 Hz, fixed foveation, profile the peak fire, fix any breach, final numbers in PERF.md
- [ ] T077 [US7] Gate: scripts/emulator/slice-e.mjs (right hand only, left hand only, gaze and pinch only, dwell only), screenshots, commit "slice e"

---

## Phase 8: US8, judges find it and trust it (slice f)

**Goal**: public pages, deploy, documents.
**Independent test**: production URL passes Playwright with zero console errors and no
third party request; the 3 step judge test works in the emulator.

- [ ] T078 [P] [US8] H mark and Holdline wordmark as SVG, favicon.svg, favicon.ico, icon-192.png in public/
- [ ] T079 [US8] Landing page index.html and src/web/landing.ts from canvas Main and Landing-phone (image to code), capability check, unsupported line, self hosted fonts in public/fonts/
- [ ] T080 [P] [US8] Privacy page privacy.html from canvas Privacy (four promises, back link)
- [ ] T081 [P] [US8] Playwright specs tests/web/landing.spec.ts, tests/web/privacy.spec.ts, tests/web/enter-mr.spec.ts (zero console errors, no third party requests)
- [ ] T082 [US8] Replace the mockup hero with a real capture of the board from the emulator in public/hero.webp
- [ ] T083 [US8] Vercel deploy with vercel.json (headers, clean URLs), project holdline, production URL checked with Playwright
- [ ] T084 [US8] Public GitHub repository Chinorab/holdline with LICENSE, pushed
- [ ] T085 [P] README.md (run steps, 3 step judge test), TESTING.md (what ran where, what needs a headset), CREDITS.md (fonts OFL, IWSDK MIT, sounds original, paper citation), PERF.md final
- [ ] T086 [P] DEVPOST.md (Inspiration with research R1 sources, What it does, How we built it, Challenges, Accomplishments, What we learned, What's next with a spring 2027 Meta Horizon Store PWA target, form answers for capabilities and hand interactions)
- [ ] T087 [P] VIDEO_SCRIPT.md under 2:45 (problem in 10 s, board landing, a full fire day, outcome versus no action, journal; real capture only)
- [ ] T088 Final pass: copy scan, dist check, full emulator run on both profiles, design skill review of pages and panels, PROGRESS.md, release tag, production frozen until after 2026-12-11

---

## Dependencies and order

- Phase 1, then Phase 2 (T009 and T010 first), then stories in slice order a, b, c, d, e, f.
- US2 needs US1 (board, terrain, phases). US4 and US3 need US2 (tools, toolbar). US5 needs
  US2 (outcome). US6 needs US1 (fire visuals). US7 touches every surface, so it runs after
  c and d. US8 needs a working game for the hero capture and judge test.
- Inside a story: tests first (they must fail), then sim or logic, then rendering and input,
  then panels, then the gate.

## Parallel examples

- Phase 2: T011, T012, T013 together; then T017 to T020 together once T016 lands.
- US1: T026, T027, T029, T030, T031, T032 together after T028's texture layout is fixed.
- US4: T049, T051, T053 together. US6: T064 and T067 together. US8: T078, T080, T081, T085,
  T086, T087 together.

## Implementation strategy

- MVP: Phases 1 and 2, then US1 and US2 (slices a and b): a complete fire day with the dig
  line and the honest comparison. Deploy a preview build after slice b to catch hosting
  issues early (production deploy stays in slice f).
- Then c, d, e, f in order. If time runs short: cut T053 and T054 (backburn), never the gates,
  the copy rules or the accessibility basics.
