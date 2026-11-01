# Contract: player facing surfaces

Source of the look: the design canvas (identity, panels, style board). Every string below
is the exact copy; all strings live in `src/copy.ts` and are scanned in CI (no dash or
hyphen characters, no emojis, no "AI", at most 4 words for instructions).

## Web pages (DOM)

| Page | Content |
|------|---------|
| `/` landing | wordmark Holdline; "One wildfire a day, on your real table."; button "Enter mixed reality"; "Hands only." "Seated." "5 minutes."; link "Privacy"; hero = real capture of the board |
| `/` unsupported | one line: "Open this page in the Meta Quest browser." |
| `/privacy` | "No account", "No tracking", "Progress stays on this device", "No camera access", each with one sentence; link "Back to Holdline" |

Fonts self hosted (Archivo, Atkinson Hyperlegible Next). Favicon: H mark (fire line as the
crossbar) in SVG, ICO and PNG.

## In mixed reality

| Surface | Where | Elements (ids) |
|---------|-------|----------------|
| Placement | on the chosen surface | highlight; instruction "Pinch to place"; fallback handle; button `btn-rescan` "Scan table" (optional) |
| Instruction strip | above the board's near edge, center | icon, text (4 words max), ghost hand |
| Toolbar | along the near edge, tilted to the player | `tool-dig` "Dig line", `tool-water` "Water drop", `tool-backburn` "Backburn", `btn-pause` "Pause"; budget meter; water cooldown ring |
| Briefing card | panel stand at the far edge | "Day N", goal "Protect all 6 houses", wind vane, wind word (Calm, Light, Strong, Gale) with 4 step meter, `btn-start` "Start" |
| Pause card | panel stand | "Paused", `btn-resume` "Resume", `btn-settings`, `btn-about` |
| Result card | panel stand | "Day N"; "You" and "If no one had acted"; "6 of 6" houses; "441 ha burned" style lines; `btn-replay`; `btn-done` "Done"; "Slower fire" note when on |
| Journal | panel stand plus shelf beside the board | "Journal"; streak number and "days in a row"; scar tiles per day; empty slots; best; practice entry per past day |
| Settings | panel stand | High contrast, One hand mode, Glasses view, Slower fire, Sound, Captions, Dwell select, Head pointer, Board size, Board height, Replay Day 0 |
| About | panel stand | "Simplified model, not a forecast." and "For real fire safety, follow your local authorities." |
| Captions | just above the toolbar | short cue names: "Crackling", "Wind", "Aircraft", "Digging", "Water", "Wind shift" |
| Inspect tooltip | near the hovered cell, nudged toward view center | fuel name, slope in degrees, "Wet" when wet |

## Instruction copy (Day 0 and unlocks, 4 words max)

"Pinch to place", "Pinch to light", "It leans downwind", "Uphill runs faster", "Grass burns fast",
"Roads stop it", "Draw a line", "Contained", "Look, pinch, drag" (water), "Hold on a line"
(backburn), "Two hands to turn".

## Placement and size rules

- Essential surfaces fit the Meta VR Glasses design area (58 by 54 degrees) from the seated
  eye point, checked with the angle method of the iwsdk-glasses-test skill (horizontal within
  plus or minus 29 degrees, vertical within the design area around the natural downward gaze
  to the board).
- Targets at least 3 degrees and 12 mm apart; text at least 0.9 degrees tall; panel corners
  6 to 8 px equivalent, never pill shaped.
- Nothing essential is head locked. The Glasses view mask is head space but is not UI.

## Input map

| Gesture | Effect |
|---------|--------|
| Pinch on a highlighted surface | place the board |
| Pinch and drag on terrain (dig) | draw a planned line |
| Look or point, pinch, drag (water) | aim and launch the drop |
| Pinch and hold 1 s on a dug line (backburn) | light the fire facing side |
| Two hand pinch on the rim | turn and resize the board |
| Pinch on a button (ray, gaze or poke) | press |
| Rest gaze 1 s (dwell select on) | press, or start and end a line |
