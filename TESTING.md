# Testing

What ran, where, and what still needs a headset. Updated at each slice gate.

## Automated

| Suite | Command | Slice a result |
|-------|---------|----------------|
| Typecheck (app and tests) | `npm run typecheck` | clean |
| Unit tests (fire model, storage, anchors, copy) | `npm test` | slice a: 12 files, 122 tests; slice b: 15 files, 142 tests; slice c: 19 files, 167 tests pass |
| Production build and dist check | `npm run build` | builds; `scripts/check-dist.mjs` ok (no agent notes, no source maps, every library URL explained) |

The fire model tests cover: same day and inputs give the same state hash at every tick;
replay of recorded inputs reaches the same hash; the no action baseline equals a fresh run;
uphill faster than downhill; downwind faster than upwind; grass catches faster and forest
burns longer; rock, water, road and a dug line stop the fire with embers off; embers jump a
road in strong wind; water delays the crossing and douses burning cells; pacing over 60
dates (houses lost on 53 days with no action, first loss after 57 s median).

## Emulator (slice a)

**Environment.** The IWSDK managed browser cannot start on this machine: Windows refuses to
build Chromium's startup context for any process launched from the agent sandbox ("side by
side configuration is incorrect", spawn UNKNOWN). The checks therefore ran in the Claude
desktop browser pane against the same dev server with IWER injected (`HOLDLINE_HTTP=1` serves
it over `http://localhost`, a secure context for WebXR, because the pane does not trust the
generated certificate). The emulator was driven through IWER's own remote control
(`IWER_DEVICE.remote.dispatch`: `look_at`, `select`, `set_input_mode`, `set_transform`), the
same actions the IWSDK CLI sends. Helper: `scripts/emulator/slice-a.browser.js`.

**Frame rate limit.** The emulated session ran at about 3 fps in the pane. UIKit counts a
click only when press and release fall within 800 ms; at 3 fps the emulator reports
"frames are slow enough that an 800 ms click window may be missed". Rays and gaze did hover
the buttons (`Hovered` tag observed), but the clicks on panel buttons were exercised by
dispatching their click events. The board pinch, which uses the `Pressed` tag, went through
the full emulated input path.

| Scenario | Profile, room | How | Result |
|----------|---------------|-----|--------|
| Landing renders the day's board | browser | page load | board, river, road, town, ignition visible; "Enter mixed reality" enabled |
| Enter mixed reality | Quest 3, both rooms | real click on the landing button | session starts, landing hides |
| No table in reach: seated fallback with grab bar | Quest 3, sunlit_living_room (coffee table 0.45 m) | wait | `placed:fallback` after the timeout, "Grab to move" |
| Table found and placed by pinch | Quest 3, home_office, head seated at the desk | controller ray `select` on the board | 2 candidates (desk plane and desk mesh), board on the desk at 0.74 m, edges parallel, 3 cm from the front edge, `placed:surface` |
| Gaze plus pinch, either hand | Meta VR Glasses, home_office | gaze `look_at` the board, `select` with the left hand | `gaze-tracking` granted, board hovered by gaze, `placed:surface` |
| Anchor restored on the next visit | Quest 3, both rooms | re-enter after a placement | `placed:restored` at the same pose |
| Brief, landscape rises, plan counts down, auto start | Quest 3 | wait | brief then plan "Start 27..." then live at 0 |
| Live fire, smoke, flames, wind vane | Quest 3 | watch | burning cells grow, smoke drifts downwind |
| Pause and resume | Quest 3 | Pause and Resume click events | tick frozen while paused (16 held for 3 s), resumes from the same tick |
| Auto pause on focus loss | Quest 3 | `IWER_DEVICE.updateVisibilityState('visible-blurred')` | paused, tick frozen, stays paused after focus returns |
| End of time, fast forward, result card | Quest 3 | development skip to the time limit | result 3 of 6 houses, 349 ha, equal to the no action baseline (no input given) |
| 10 s time lapse | Quest 3 | Replay click event | fronts replay with flames and smoke, back to the result card |
| Console | Quest 3, one full loop in one page load | in page error collector | zero errors |
| Hand and controller models from our origin | Quest 3 | network log | `/input-profiles/meta-quest-touch-plus/*.glb` 200, no CDN request |

Screenshots: `artifacts/slice-a/` (local, not committed).

## Emulator (slice b)

Same environment as slice a (browser pane, IWER remote control). Helper:
`scripts/emulator/slice-b.browser.js` (`holdlineGate.sliceB()` runs the whole gate in one
page load). Stills come from a development only hook (`__holdlineDebug.snapshot`) that
renders the scene once from a seated eye point at 1280 by 800, without the emulated room,
and posts the JPEG to a local receiver on 127.0.0.1:8790 started by hand for the gate.

| Scenario | Profile, room | How | Result |
|----------|---------------|-----|--------|
| Far line in the plan phase | Quest 3 controllers, home_office | right controller ray: `look_at` the terrain, `set_select_value` 1, sweep 4 points, release | stroke kind `far`, 51 cells planned, dashed line on the board, budget meter drops |
| Near line while live | Quest 3 hands, home_office | left hand `set_transform` 3 cm above the board, pinch held (`set_select_value` 1), moved, released | stroke kind `near`, cells under the hand path (x 17 to 38 for a stroke from x = 0.20 to 0.11 m left of center) |
| Crews dig | Quest 3 | watch | dashed turns to solid ink from the line start, trees on dug cells cut, three pawns walk the line |
| Budget runs out | Quest 3 | second line longer than the budget left | trimmed to the 12 cells left, budget 0 in the status |
| Outcome equals the worker outcome, replay identical | Quest 3 | skip to the time limit, then `playOut` of the stored inputs in the page | equal (3 of 6 houses, 3882 cells, 74 dug), and equal across two page loads |
| Result card | Quest 3 | still of the card | You: 3 of 6, 349 ha, 2.2 km line dug; If no one had acted: 3 of 6, 349 ha, No line |
| Resume after reload | Quest 3 | reload during a live run, enter, place, Resume | replays to tick 37 with the line and the budget (25 cells) restored, then runs live |
| Console | Quest 3, full gate in one page load | in page error collector | zero errors |

Screenshots: `artifacts/slice-b/` (local, not committed).

## Emulator (slice c)

Same environment. Helper: `scripts/emulator/slice-c.browser.js` (`day0`, `waterDrop`,
`backburnHold`, `inspectRest`). The emulator ran well below real time in the pane, so times
are given in game seconds (frame time capped at 0.25 s, the same cap as the fire clock);
on a headset at 72 Hz game time is real time.

| Scenario | Profile, room | How | Result |
|----------|---------------|-----|--------|
| Day 0 from fresh storage | Quest 3 controllers, home_office | storage cleared, enter, place on the desk, controller ray pinch on each patch, guided line drawn with the ray | wind, slope, breaks beats each lit by the pinch; line beat contained, both houses standing; Contained at 118 s of game time after entering (328 s of wall time in the pane); then Day 1 brief with dig and water, completed fires 1 |
| Ghost hand | Quest 3 | status and stills | shown on every Day 0 prompt and on each unlock intro; stops when the beat starts or a stroke begins |
| Water drop intro | Quest 3 | second fire, plan phase | water drop selected, ghost hand drag, strip "Look, pinch, drag", intro saved once |
| Water drop by hand ray | Quest 3 hands | right hand ray: pinch at one cell, drag 12 cells, release | aircraft crosses, drop accepted when it reaches the strip, wet strip shown, cooldown 20 s on the button |
| Inspect | Quest 3 controllers | ray resting on one cell for 3 s | tooltip for exactly that cell (fuel, slope in degrees) |
| Backburn intro and hold | Quest 3 controllers | third fire (practice counts): line drawn, fire started, Backburn selected, ray pinch held 2.5 s on a dug cell | ring fills, input accepted, 12 controlled cells, all on the side facing the fire |
| Console | Quest 3, Day 0 and the tools in one page load | in page error collector | zero errors after the fix below |

Found and fixed during the gate: on a board without shrubs (Day 0) the instanced shrub mesh
had no color attribute and its shader failed to compile; Day 0's auto start counted from
entering the phase instead of from the moment the beat was ready.

Not run yet: the water drop by gaze on the Meta VR Glasses profile. The session window was
closed during the gate, and a hidden browser pane gets no frames.

## Needs a headset

- Frame rate at 72 Hz and the feel of pinch timing.
- Real plane and mesh detection on a real table, including tables that Space Setup missed.
- Persistent anchors across browser restarts (the emulator restores them within its storage).
- Panel button clicks by hand ray, gaze and poke at full frame rate.
- Drawing feel: pinch thresholds (1.5 cm close, 3 cm open) and the 10 cm near zone with real
  hand tracking; the emulator's pinch is a pose switch.
