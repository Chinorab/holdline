# Holdline (formerly Backburn): progress

Last update: 2026-11-01 01:30 (Paris)

## Goal
Mixed reality wildfire game for the Meta VR Start Developer Competition 2026 (Devpost
`start-developer-competition-26`), Gaming track, New Experience division. Deadline
2026-11-18 20:00 UTC (12:00 PT, 21:00 Paris). Deployed HTTPS URL + video under 3 min.

## Current step
Waiting for the user's approval of spec and plan. Next: slice a, starting with T001 to
T010 in `specs/001-tabletop-wildfire/tasks.md`. No game code written yet. Nothing committed.

## Done
- [x] Design canvas read (claude.ai/artifact/HKQBDjf3AVzwjgJod3NuPj), Devpost rules, criteria,
      special awards and dates read (France eligible, Start membership required)
- [x] Wildfire figures checked against the 3 sources (research.md R1)
- [x] Plugin `meta-vr@meta-vr` installed (marketplace registers as `meta-vr`)
- [x] Project scaffolded with `npm create @iwsdk@latest` 1.1.0-rc.2 (AR, TS, grabbing,
      scene understanding, environment raycast, no physics, git init)
- [x] Spec Kit: constitution v1.0.1, spec, clarifications, plan, research, data model,
      contracts, quickstart, tasks (88 tasks)

## Next
- [ ] Slice a (T001 to T040), b (T041 to T048), c (T049 to T059), d (T060 to T068),
      e (T069 to T077), f (T078 to T088)

## Decisions
- Product renamed Holdline (iOS game "Backburn: Wildfire Strategy" exists). Folder stays
  `D:\claude\backburn`; GitHub repo will be `Chinorab/holdline`.
- Tools unlock by fires played: Day 0 = fire 1 (dig line), next fire adds water drop, the
  one after adds backburn; practice counts.
- Dwell select in slice e (off by default). Repo license: all rights reserved.
- Brief wins over the canvas: board 56 by 35 cm, roads stop fire, Glasses view off by default.
- Glasses view = our own runtime mask (IWSDK FoV mask is dev emulator only).
- Head pointer is an option (IWSDK: no head pose fallback in production).
- Day numbers global, Day 1 = 2026-11-01; device local date seeds the daily fire.

## Commands
- Dev server (managed browser + emulator): `npx iwsdk dev up --ai-mode agent --foreground`
- Status: `npx iwsdk dev status` (wait for browserCommandReady)
- Typecheck: `npm run typecheck`

## Pitfalls
- `--no-locomotion` is rejected for `--target ar` by the create CLI.
- iwsdk-runtime MCP only loads when Claude Code starts in this folder; else use `npx iwsdk`.
- IWSDK fetches input profiles from jsDelivr by default (self host, task T025).
- Alexandridis constants unverified (paywalled paper, task T010).
