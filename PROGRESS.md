# Holdline (formerly Backburn): progress

Last update: 2026-11-01 04:20 (Paris)

## Goal
Mixed reality wildfire game for the Meta VR Start Developer Competition 2026 (Devpost
`start-developer-competition-26`), Gaming track, New Experience division. Deadline
2026-11-18 20:00 UTC (12:00 PT, 21:00 Paris). Deployed HTTPS URL + video under 3 min.

## Current step
Slice a is done and committed on branch `001-tabletop-wildfire`. Next: slice b, T041 to T048
in `specs/001-tabletop-wildfire/tasks.md` (dig line near and far, crews, budget, toolbar
tools, result card against the baseline, resume after reload). Start with the slice b
verification items in research.md (pointer events with hit points, capture during a drag,
hand joints for near drawing).

## Done
- [x] Spec Kit: constitution v1.0.1, spec, clarifications, plan, research, data model,
      contracts, quickstart, tasks (88 tasks); plugin `meta-vr@meta-vr`; IWSDK scaffold
- [x] Slice a (T001 to T040): setup, fire simulation with 122 unit tests, worker, storage,
      session clock, board (terraced terrain shader, props, flames, smoke, wind vane),
      placement on tables with fallback and persistent anchors, brief, plan, live, pause,
      auto pause, result placeholder, 10 s time lapse, self hosted input profiles,
      PERF.md, TESTING.md. Alexandridis constants confirmed via Freire and DaCamara 2019.

## Next
- [ ] Slice b (T041 to T048), then c, d, e, f as in tasks.md
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
- Emulator gate helper: paste `scripts/emulator/slice-a.browser.js`, then
  `holdlineGate.placeAtDesk()`, `holdlineGate.fullLoop()`, `holdlineGate.report()`.
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
