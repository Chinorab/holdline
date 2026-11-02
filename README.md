# Holdline

One wildfire a day, on your real table. A seated, hands first mixed reality game for
Meta Quest 3 and 3S, played in the Meta Quest browser. Built with the Immersive Web SDK
(WebXR) for the Meta VR Start Developer Competition 2026 (Gaming track, New Experience).

Play: [HOLDLINE_URL] in the Meta Quest browser.

## Judge test (3 steps)

1. Sit at a table with the Quest on and open the link in the Meta Quest browser. Press
   **Enter mixed reality** and allow what the browser asks (hand tracking, room surfaces).
2. Look at the table: the board's outline appears on it. **Pinch** to place it. (No table in
   reach: the board waits in front of you with a grab bar.) A first visit starts Day 0, about
   two minutes that teach wind, slope, breaks and the first line by doing.
3. Then today's fire: read the wind, **pinch and drag on the board to draw a line**, press
   Start. The crews dig it; the fire runs. At the end the card puts your result next to the
   same fire with no one acting. Pause is on the toolbar; Settings and accessibility options
   are on the pause card.

Everything works with hands only, with either hand alone, with gaze and pinch on Meta VR
Glasses, with a head pointer, or with dwell select (no pinch at all).

## What it does

- A paper relief board, 56 by 35 cm, lands on your real table (plane and mesh detection,
  persistent anchors), with a fallback pose when no table is found.
- One fire a day, the same for everyone on that date; past days as practice.
- Tools unlocked by fires played: dig line (crews dig it in order within a budget), water drop
  (an aircraft crosses and wets a strip), backburn (hold on a dug line).
- Every outcome is compared with the exact same fire with no action: the simulation is
  deterministic, so the comparison and the 10 s time lapse replay are exact.
- Journal beside the board: streak, best, a burn scar per day.
- Sound synthesized in code and placed in the room, with captions; smoke rises into the room
  and stops at the ceiling; a light haze follows the fire.

## Run it locally

```sh
npm install
npm run typecheck
npm test
HOLDLINE_HTTP=1 npx iwsdk dev up --ai-mode agent --foreground --no-open
```

Then open http://localhost:8081: the dev server injects IWER, the IWSDK emulator of a Meta
Quest headset, so the game runs without a headset. `npm run build` makes the static site in
`dist/` and checks it (`scripts/check-dist.mjs`). Web page tests: `npx playwright test`.

## Where things are

- `src/sim/`: the fire model (pure TypeScript, deterministic, runs in a Web Worker and in
  Node tests)
- `src/game/`, `src/input/`, `src/render/`, `src/xr/`, `src/ui/`, `src/audio/`: the game
- `public/ui/*.uikitml`: the panels
- `specs/001-tabletop-wildfire/`: specification, plan, research, data model, tasks
- `TESTING.md`: what ran where and what still needs a headset; `PERF.md`: render budget
- `CREDITS.md`: fonts, models, sources

## License

All rights reserved. See `LICENSE`.
