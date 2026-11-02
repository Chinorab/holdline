# Testing

What ran, where, and what still needs a headset. Updated at each slice gate.

## Automated

| Suite | Command | Slice a result |
|-------|---------|----------------|
| Typecheck (app and tests) | `npm run typecheck` | clean |
| Unit tests (fire model, storage, anchors, copy) | `npm test` | slice a: 12 files, 122 tests; slice b: 15 files, 142 tests; slice c: 19 files, 167 tests; slice d: 20 files, 189 tests; slice e: 20 files, 208 tests pass |
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

Water drop by gaze, run afterwards on the Meta VR Glasses profile (home_office, progress
seeded with one completed fire so the water drop is unlocked): the board was placed by gaze
on it plus a left hand pinch; in the plan phase the water drop intro selected the tool; gaze
on a cell plus a held left hand pinch showed the strip preview and called the aircraft; the
drop was accepted (cooldown 20 s) and the wet strip shows. Stroke kind `far` (the gaze
pointer). Zero errors. The emulator needs `set_input_mode` hand before a hand pinch counts,
and the gaze is its own device (`look_at` with device `gaze`).

## Emulator (slice d)

Quest 3 profile, home_office. Helper: `scripts/emulator/slice-d.browser.js`. Dates were set
with `localStorage holdline.dev.today` (read by development builds only, src/game/clock.ts)
and progress seeded so Day 0 is skipped and every tool is unlocked.

| Scenario | How | Result |
|----------|-----|--------|
| Day 3 daily fire | date 2026-11-03, enter, place, start, skip to the end | journal: Day 3 played, Days 2 and 1 missed, streak 1 day, best 6 of 6 |
| Next date | date 2026-11-04, reload, play | streak 2 days, two burn scars on the shelf |
| Practice a missed day | Day 2 tile, play, skip to the end | brief "Day 2 practice", Day 2 tile shows its scar, streak stays 2 |
| Daily fire counts once | reload on 2026-11-04 after its daily | the day opens as practice |
| Sound | while live | context running after the Enter press; crackle 0.6, wind 0.14 to 0.36 by wind speed; digging 0.5 while crews dig; aircraft 0.9 and water 0.8 on a drop |
| Captions | while live | "Crackling, Wind"; "Digging" while crews dig; "Aircraft" and "Water" on a drop; at most three at once |
| Room haze | while live, then contained | rises with burning cells (0.017 at 45 cells), back to 0 after the end |
| Ceiling | home_office | ceiling plane found at 2.7 m; plume puffs stop 4 cm under it (9 of 63 puffs at the cap) |
| Console | each run | zero errors |

Found and fixed: the digging caption and sound flickered (the crew is idle for one tick
between cells; digging now holds for a second); the scar miniatures drew unburned land in
the tile color; plume puffs faded before reaching a ceiling 2 m above the table.

## Emulator (slice e)

Helper: `scripts/emulator/slice-e.browser.js` (`dwellGate`, `fit`, `seedSettings`). Settings
were seeded in localStorage, or changed on the settings card through the head pointer.

| Scenario | Profile | How | Result |
|----------|---------|-----|--------|
| Dwell only, no pinch | Quest 3 | head `look_at` only: the highlighted desk, Start, Dig line (arms one stroke), a board point, 4 more points, rest, Pause, Resume | placed on the desk, fire started, 1 line (stroke kind `pointer`), paused, resumed; watching the board alone draws nothing |
| Head pointer and a pinch | Quest 3 hands | head `look_at` Start, right hand pinch; head `look_at` along 4 board points with the left hand pinch held | Start pressed, 1 line drawn |
| Settings by head pointer | Quest 3 hands | Pause, Settings, High contrast, Board size up, Board height up twice, Turn right and left, Close, Resume | high contrast on (ink gain 1.6, fire edge 0.2, lines twice as wide), board 57 cm (scale 1.018), board 2 cm higher on top of its anchored pose, turned 15 degrees and back |
| One hand | Quest 3 | One hand on | edge controls beside the near left corner; Smaller sets 55 cm |
| Slower fire | Quest 3 | Slower fire on, next fire | plan 45 s, result card notes Slower fire |
| Glasses view on a Quest | Quest 3 | Glasses view on | dark frame outside 37, 37, 25, 43 degrees; compact layout |
| Compact layout on the glasses | Meta VR Glasses | Glasses view off | compact layout turns on by itself (the session has gaze tracking) |
| Fit check, eyes on the board center | Meta VR Glasses | `holdlineGate.fit()` | every essential element inside (degrees, left..right and down..up): Board -23..23, -8..7; Toolbar 5..25, -14..-6; Strip -18..-4, -11..-8; Captions -19..-4, -14..-12; Briefing and Result -11..11, 10..22; Pause -9..9, 10..20; Settings -8..8, 10..23; Journal -23..-11, 8..18 |
| Gaze and pinch only | Meta VR Glasses | gaze `look_at` Start, left hand pinch | Start pressed (a first press fell in the slow frame click window and was missed, as known) |
| Either hand alone | Meta VR Glasses hands | a near pinch line with the right hand, then with the left | 2 lines, stroke kind `near` each |
| Color vision | n/a | `node scripts/cvd-check.mjs` | every view passes, both palettes (weakest surface: brush, still 46 Delta E or more from a band of the front) |
| Console | all runs | in page error collector | zero errors |

Found and fixed: the anchor pose is reapplied every frame, which undid the height and turn
settings (now applied on top of the anchor pose); a dwell stroke ended while the gaze had
not moved yet; watching the board under dwell started strokes (a tool must now be armed);
a dwell player could not confirm the table (the highlighted board is now a target); a
recursive raycast does not reach UIKit buttons (each button is asked); the Settings card
top reached the edge of the glasses view (smaller in the compact layout).

## Needs a headset

- Frame rate at 72 Hz and the feel of pinch timing.
- Real plane and mesh detection on a real table, including tables that Space Setup missed.
- Persistent anchors across browser restarts (the emulator restores them within its storage).
- Panel button clicks by hand ray, gaze and poke at full frame rate.
- Sound levels and spatial placement on real speakers; the emulator only proves the sources
  play at the intended volumes.
- 72 Hz: the session asks for it when the headset lists it; the emulator lists no rates.
- Dwell and head pointer comfort over a whole fire.
- Haze strength over real passthrough (alpha is capped at 0.12).
- Drawing feel: pinch thresholds (1.5 cm close, 3 cm open) and the 10 cm near zone with real
  hand tracking; the emulator's pinch is a pose switch.
