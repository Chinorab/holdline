# Testing

What ran, where, and what still needs a headset. Updated at each slice gate.

## Automated

| Suite | Command | Slice a result |
|-------|---------|----------------|
| Typecheck (app and tests) | `npm run typecheck` | clean |
| Unit tests (fire model, storage, anchors, copy) | `npm test` | 12 files, 122 tests pass |
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

## Needs a headset

- Frame rate at 72 Hz and the feel of pinch timing.
- Real plane and mesh detection on a real table, including tables that Space Setup missed.
- Persistent anchors across browser restarts (the emulator restores them within its storage).
- Panel button clicks by hand ray, gaze and poke at full frame rate.
