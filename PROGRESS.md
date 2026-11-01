# Holdline (formerly Backburn): progress

Last update: 2026-11-01 (Paris), slice d done

## Goal
Mixed reality wildfire game for the Meta VR Start Developer Competition 2026 (Devpost
`start-developer-competition-26`), Gaming track, New Experience division. Deadline
2026-11-18 20:00 UTC (12:00 PT, 21:00 Paris). Deployed HTTPS URL + video under 3 min.

## Current step
Slice d is done. Next: slice e, T069 onward in `specs/001-tabletop-wildfire/tasks.md`
(settings, accessibility, Glasses layout, Scan table, cold start).

## Done
- [x] Spec Kit: constitution v1.0.1, spec, clarifications, plan, research, data model,
      contracts, quickstart, tasks (88 tasks); plugin `meta-vr@meta-vr`; IWSDK scaffold
- [x] Slice a (T001 to T040): setup, fire simulation with 122 unit tests, worker, storage,
      session clock, board (terraced terrain shader, props, flames, smoke, wind vane),
      placement on tables with fallback and persistent anchors, brief, plan, live, pause,
      auto pause, result placeholder, 10 s time lapse, self hosted input profiles,
      PERF.md, TESTING.md. Alexandridis constants confirmed via Freire and DaCamara 2019.

- [x] Slice b (T041 to T048): dig line near (pinch over the board) and far (ray, gaze),
      crews dig in order and cut the trees, budget meter, toolbar with locked tools, result
      card with km of line, resume after reload; gate in the emulator, replay identical.

- [x] Slice c (T049 to T058): water drop with aircraft and cooldown, inspect tooltip,
      backburn first cut (hold 1 s on a dug line), unlocks by fires played with one intro
      per tool, Day 0 by doing (wind, slope, breaks, guided first line) with the ghost hand,
      Day 0 button on the pause card. Gate: Day 0 contained at 118 s of game time.

- [x] Slice d (T060 to T068): journal with streak, best and burn scars, practice on the 7
      days before today, synthesized spatial sound, captions, room haze, smoke plume that
      stops at a detected ceiling. Gate: two dates by injection, streak 2, practice kept it.

## Next
- [ ] Slices d, e, f as in tasks.md
- [ ] Slice e items noted during slice a: compact Glasses layout (briefing card top is
      cut in the glasses view), Scan table button, cold start check

## Decisions
- Product renamed Holdline; folder stays `D:\claude\backburn`; repo will be `Chinorab/holdline`.
- Tools unlock by fires played (Day 0 = fire 1). Dwell select in slice e. All rights reserved.
- Brief wins over the canvas: board 56 by 35 cm, roads stop fire, Glasses view off by default.
- Game time scale: `TUNING.spreadScale` 0.25 on p_h; 5 cell ignition; fuels remapped (grass
  catches fastest). Pacing test pins it.
- Instruction strip sits low in front of the near edge and takes no rays (it hid the board
  center from a seated player and caught gaze).
- Git identity for this repo (local config): Chinorab, GitHub noreply address.

## Commands
- Dev server here: `HOLDLINE_HTTP=1 npx iwsdk dev up --ai-mode agent --foreground --no-open`
  (launch config `holdline-dev` in `D:\claude\.claude\launch.json`), then open
  `http://localhost:8081` in the desktop browser pane and keep the pane visible.
- Emulator gate helpers: in the page, `await import('/scripts/emulator/slice-a.browser.js')`
  and `slice-b.browser.js`, then `holdlineGate.placeAtDesk()`, `fullLoop()`, `sliceB()`.
  Stills: start a local receiver that saves POST bodies to artifacts/slice-x on
  127.0.0.1:8790, then `holdlineGate.snap(name)`.
- Checks: `npm run typecheck`, `npm test`, `npm run build` (runs the dist check).

## Pitfalls
- The IWSDK managed browser cannot start from this agent's sandbox (Chromium "side by side
  configuration" error, spawn UNKNOWN), so the `npx iwsdk xr|browser|scene` commands are not
  available here; use the browser pane plus `IWER_DEVICE.remote.dispatch` instead.
- The browser pane does not trust the dev certificate: use `HOLDLINE_HTTP=1`.
- A hidden browser pane gets no animation frames: World.create hangs in loadLevel.
- The emulated session runs at about 3 fps in the pane: UIKit clicks (800 ms window) are
  missed; hover works; dispatch click events on named elements to test handlers.
- IWER resets the head to (0, 1.6, 0) at session start; legacy room ids load other rooms.
- `--no-locomotion` is rejected for `--target ar` by the create CLI.
- iwsdk-runtime MCP only loads when Claude Code starts in this folder.
- A captured pointer drag reports points on a plane through the first hit: march the event
  ray over the heightfield instead (tool-system.ts).
- Ribbons built in code face down: line materials are double sided.
- Rendering into a render target skips the sRGB conversion unless the target texture's
  colorSpace is SRGBColorSpace.
- A UIKit text that grows after layout can wrap: give button labels a fixed width.
- An InstancedMesh that never got setColorAt has no instanceColor: the prop shader fails.
- The emulator runs far below real time in the pane: gate scripts wait on game state
  (status fields), never on wall clock; report game seconds (`playSeconds`).
- The browser pane needs the session window open: if the window is closed, the world never
  finishes loading.
- Dates in development: `localStorage holdline.dev.today = 'YYYY-MM-DD'` then reload
  (src/game/clock.ts); production ignores it.
- Smoke and the haze run on frame time; the fire runs on the capped clock: in the slow
  pane the smoke looks fast relative to the fire.
- Glasses profile in the emulator: `set_input_mode` hand first, gaze is the `gaze` device,
  pinch with `select` on `hand-left` (duration 1.2 s at the pane's frame rate).
- Changing iwsdk.config.json restarts the dev server; a server started by an older session
  stops instead, so start `holdline-dev` again.
