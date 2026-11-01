# Research: Holdline, tabletop wildfire

Phase 0 of the plan. Each item: decision, rationale, alternatives. "Verified" means checked
on 2026-10-31/11-01 against the installed `@iwsdk/*` 1.1.0-rc.2 packages or Meta docs through
`metavr docs`. "Verify at slice start" items are API details to confirm with
hz-quest-verify-first and `iwsdk reference` right before the code that uses them.

## R1. Real world figures (Inspiration copy)

- Decision: quote only these, each with its source:
  - Mid October 2026: the season's first Santa Ana wind event brought "at least three
    significant wildfires" to Southern California; preventive power shutoffs affected
    "approximately 65,000 customers" in Los Angeles, Kern and Ventura counties (PAHO,
    Natural hazards monitoring, 16 October 2026).
  - As of 29 August 2026 (NIFC, reported by Idaho News): 51,774 wildfires that burned "more
    than 8.1 million acres" in the United States.
  - 2026 wildfires in Croatia (Hvar, Korcula, Lokva Rogoznica), Greece (Thessaloniki, Paros)
    and France (Trevillach, Fontainebleau, Saumos in Gironde) are listed by Wikipedia,
    "Wildfires in 2026", with dated press citations.
- Rationale: matches the brief's sources word for word; "several" becomes "at least three".
- Not used: the utility's name (a real brand) and any figure the sources do not state (areas
  burned in Europe are not given there).

## R2. Fire model and constants

- Decision: probabilistic cellular automaton after Alexandridis, Vakalis, Siettos and Bafas
  (2008), Applied Mathematics and Computation 204(1):191 to 201, doi 10.1016/j.amc.2008.06.046:
  `p_burn = p_h (1 + p_veg)(1 + p_den) p_w p_s`, `p_w = exp(c1 V) exp(c2 V (cos theta - 1))`,
  `p_s = exp(a theta_s)`, slope angle from the elevation difference over the cell distance
  (diagonal distance for diagonal neighbors). Starting constants from the brief:
  p_h 0.58, c1 0.045, c2 0.131, a 0.078 (theta_s in degrees, V in m/s).
- Status (2026-11-01, T010): the four constants are confirmed through an open access,
  peer reviewed secondary source: Freire and DaCamara (2019), Natural Hazards and Earth
  System Sciences 19:169 to 179, Section 2.5: "with p_0 = 0.58, a_s = 0.078, c_1 = 0.045 and
  c_2 = 0.131", parameters "set according to Alexandridis et al. (2008)". The primary paper's
  full text is still paywalled, so public copy cites the model as "after Alexandridis et al.
  (2008)" and the values as reported by Freire and DaCamara (2019). The slope sign
  (uphill positive, from the burning cell to its neighbor) is our convention, pinned by
  tests/sim/spread.test.ts; diagonal neighbors use sqrt(2) times the cell size.
- Game time scale (ours): p_h is multiplied by `TUNING.spreadScale` (0.25) so a fire takes
  about a minute to reach the town on a typical day (tests/sim/pacing.test.ts: over 60 dates
  with no action, houses are lost on 53 days, first loss after 57 s median, 43 s at the 10th
  percentile).
- Game tunings (documented as ours, not the paper's): the paper's vegetation classes
  (agricultural, thickets, pine) map to game fuels with per fuel burn durations, so grass
  catches fast and burns out fast, forest catches slowly and burns long ("slow, then
  fierce"); moisture factor; ember spotting downwind above a wind threshold (2 to 6 cells,
  jumps breaks); water strip wetting with decay; per fuel ember production.
- Time: sim tick 6 Hz (inputs, crews, aircraft, wetting). Fire spread steps every 6 ticks
  (1 s) at normal speed, every 9 ticks with Slower fire. Visuals interpolate from per cell
  ignition and burnout steps, so the board animates at frame rate.
- Alternatives: Rothermel based rate of spread (needs many fuel parameters, overkill for a
  5 minute game); a pure deterministic front (no chance, less lifelike).

## R3. Determinism

- Decision: counter based RNG `u32 = hash(daySeed, step, cell, channel)` (integer mixing with
  `Math.imul` only), synchronous CA update (new state computed from the previous state),
  inputs applied at the start of their tick in recorded order, and a small `detmath` module
  (exp, atan, cos from basic IEEE operations) so results never depend on a browser's `Math.exp`.
- Rationale: the player run and the no intervention run draw the same random number for the
  same event, so the comparison isolates the player's effect ("same fire, same luck"). Basic
  IEEE arithmetic is bit identical across engines; transcendental functions are not.
- Proof: state hash (FNV 1a over the state arrays) per step in unit tests; replay from inputs
  must hit the same hash; baseline hash per date pinned in a snapshot test.
- Alternatives: sequential PRNG stream (any extra draw shifts every later draw, breaking the
  baseline comparison); `Math.*` (risk of cross engine drift).

## R4. Grid, scale and board

- Decision: 128 by 80 cells, 30 m per cell (0.09 ha), 3.84 by 2.40 km (921.6 ha). Board 56 by
  35 cm by default (45 to 60 cm wide), horizontal scale about 1:6900. Relief drawn as stacked
  paper layers: one layer per 20 m of elevation, about 3.5 mm thick, slight vertical
  exaggeration, every fifth layer edged darker (index contour), per the style board.
- Rationale: at least 64 cells per side (brief), square cells, hectare numbers in the range of
  the mockups, and a board that fits the 58 by 54 degree design area at 45 to 55 cm.
- The canvas says 80 by 50 cm; the brief (FoV, 60 cm reach) wins, as the constitution says.

## R5. Terrain rendering

- Decision: one heightfield mesh of 256 by 160 quads (about 82k triangles) with heights
  quantized to layers on the CPU, so risers are about 2 mm wide and read as paper steps; one
  ShaderMaterial samples a 128 by 80 RGBA8 state texture (fuel, fire state, burn age, flags)
  plus an ignition time texture for frame rate interpolation; contour and index edges, fire
  front (light core, ink edge), watered hatch and high contrast variants all in that shader.
- Fallback if thin risers shimmer in the headset: smooth heightfield plus shader contours.
- Alternatives: extruded contour polygons (complex, many draw calls); per cell boxes (too many
  triangles).

## R6. Mixed reality placement and anchors (verified)

- IWSDK 1.1 exposes `SceneUnderstandingSystem` with `XRPlane` (`_plane`: raw XRPlane with
  orientation and polygon), `XRMesh` (`semanticLabel`, `isBounded3D`, `min`, `max`,
  `dimensions`) and `XRAnchor` (`attached` only, no persistence).
- Meta docs (WebXR mixed reality in Browser): planes arrive 2 to 3 s after session start and
  are horizontal or vertical rectangles on Quest; `session.initiateRoomCapture()` can start
  space setup once per session when no planes exist; persistent anchors use
  `anchor.requestPersistentHandle()` and `session.restorePersistentAnchor(handle)`, at most 8
  per site, not in private mode, erased with site history.
- Decision: placement scores horizontal planes and bounded meshes labelled table or desk at 0.5
  to 1.1 m above the floor, near and in front of the head, large enough for the board; 4 s
  timeout to the fallback pose; our own `AnchorService` on the raw WebXR anchors API for both
  the live anchor and the persistent handle (stored with the journal, old handles deleted to
  stay under 8). Optional "Scan table" button on the fallback calls `initiateRoomCapture`.
- Emulator: IWER rooms (13 listed in the config schema, for example living_room, home_office,
  kitchen, office_small, bedroom) carry planes and meshes for placement tests. Whether IWER
  emulates persistent handles was checked in slice a: it does (a second entry restored the
  board at the same pose); the service is also unit tested with a fake session. Legacy room
  ids (`living_room`, `office_small`, `meeting_room`, `music_room`, `office_large`) now load
  other rooms; use `sunlit_living_room`, `home_office`, `kitchen`, `open_office`, `bedroom`.

## R7. Input (verified, details at slice start)

- Verified: `RayInteractable` with `Hovered` and `Pressed` covers hand rays, controllers and
  gaze; gaze arrives as a ray pointer with `source: "gaze"`; `world.xr.features.gazeTracking`
  registers `GazeSystem`; `pointerTransformFollowsHand` (default true) makes a drag started by
  gaze follow the pinching hand; `GrabSystem.useHandPinchForGrab` defaults to true.
- IWSDK guidance: no head pose fallback for missing gaze in production; on Quest 3 and 3S
  (no eye tracking) targeting falls back to hand and controller rays. Decision: hand ray plus
  direct pinch over the board by default on Quest; a "Head pointer" option (on with dwell
  select, off otherwise) adds a head ray so every target is reachable by head pointing plus
  pinch, as the constitution requires.
- Drawing on the terrain: far, from `RayInteractable` pointer events on the terrain entity;
  near (pinch point within about 10 cm above the board), from the pinch midpoint projected
  straight down onto the heightfield.
- Verified at slice b start (IWSDK 1.1.0-rc.2 with @pmndrs/pointer-events 6.6.32 typings):
  objects under a `RayInteractable` entity receive `pointerdown`, `pointermove`, `pointerup`
  and `pointercancel` with `point` (world hit), `pointerId` and `pointerPosition` (ray origin);
  `object.setPointerCapture(pointerId)` keeps moves coming during a drag. Each hand runs a
  MultiPointer (touch over grab over ray), so the ray pointer's origin is that hand's
  `raySpaces` pose, which tells which hand a far stroke came from. Hand joints come from the
  raw WebXR frame (`getJointPose` on `thumb-tip` and `index-finger-tip`), relative to the
  reference space the player origin stands in; the emulator provides them in hand mode.
- Near beats far: a ray stroke from a hand that is over the board is ignored and a near pinch
  cancels a ray stroke in progress. Lines are rasterized 4 connected (an 8 neighbor fire
  cannot pass between two diagonal cells), not 8 connected as first planned.
- Board yaw and scale: our own two hand rim gesture (yaw only, scale clamped 45 to 60 cm,
  height kept on the table) because `TwoHandsGrabbable` rotates freely; one hand mode uses
  edge buttons. The fallback handle uses `OneHandGrabbable` or `DistanceGrabbable`.
- Dwell select: our `DwellSystem` reads the hovered target and fires select after 1 s with a
  fill ring; lines by dwell start, gaze path, dwell end.

## R8. Meta VR Glasses and Glasses view (verified)

- Meta docs, Meta VR Glasses field of view: 70 by 66 degrees visible, 74 by 68 render extent,
  recommended design area 58 by 54 degrees for essential UI. IWSDK glasses skill: 37 degrees
  left and right, 25 up, 43 down from the view direction; frame rates 72 to 120 Hz; no gaze
  cursor in production, so every target shows its own hover state.
- The IWSDK "field of view mask" is a toggle in the dev emulator overlay
  (`@iwsdk/vite-plugin-dev`), not a runtime API; the config schema has no such key.
- Decision: Glasses view is ours: a head space mask (inside out sphere, black outside the
  37/37/25/43 degree bounds, one draw call, only when on) plus a compact layout that pulls
  panels toward the center and lower; switchable at runtime, no URL flag needed. On real
  glasses (gaze source present) the compact layout turns on by itself and the mask stays off.

## R9. Spatial UI

- Decision: UIKitML panels (Horizon kit) for briefing, toolbar, result, journal, settings,
  about, pause, instruction strip and captions, turned from the canvas with image to code.
  Panel stand at the board's far edge, angular size within the 30 by 20 degree focus zone for
  essentials; toolbar along the near edge, tilted toward the player; targets at least 3
  degrees and 12 mm apart.
- Fonts: Archivo and Atkinson Hyperlegible Next (SIL OFL) as local MSDF fonts for UIKit and
  self hosted woff2 for the web pages, so nothing loads from a font CDN. The UIKitML font
  registration path is verified at slice a start (iwsdk-ui skill).
- Copy: all strings in one module, scanned in CI for dashes, hyphens, emojis and the word AI.

## R10. Room effects

- Decision: smoke as one instanced billboard draw (cap 200 puffs, alpha blended) rising from
  burning cells and drifting with the game wind past the board edge, fading within about 1.5 m;
  haze as one inside out sphere tinted warm grey, alpha 0 to 0.12 driven by burning cells,
  easing to 0 within seconds of containment; standing paper flames as alpha tested instanced
  cards (cap 400, no blending, gentle sway, no flicker above 3 Hz). Smoke stops at the
  detected ceiling plane when one exists (small, cheap, makes the real room matter).

## R11. Audio

- Decision: all sounds synthesized in code at first use (OfflineAudioContext): crackle at the
  fire front centroid scaled by burning cells, wind loop scaled by wind speed, aircraft pass,
  digging, water, soft UI tick. Played through IWSDK `AudioSource` with blob URLs, or three.js
  PositionalAudio if `AudioSource` cannot take generated buffers (verified at slice d start).
- Slice d: `AudioSource` takes a file URL, so the generated buffers go through three.js
  `PositionalAudio` with one `AudioListener` on the player's head (three is re-exported by
  @iwsdk/core). The context starts on the first press (the Enter mixed reality button).
  CREDITS.md states every sound is original.
- Alternatives: CC0 files (license bookkeeping, larger cold start).

## R12. Storage

- Decision: localStorage under versioned keys `holdline.v1.*` (settings, progress, journal,
  run in progress, anchor handle), every access in try and catch with an in memory fallback
  and a visible "cannot save" note. Journal entries store inputs and a 1.3 KB burned cell
  bitset, so any day can be replayed and its miniature redrawn.
- Alternatives: IndexedDB (more code, not needed at this size).

## R13. Daily seed and day numbers

- Decision: seed = hash of "holdline" and the device local date (YYYY-MM-DD). Day numbers are
  global, Day 1 = 2026-11-01, so a date's fire has one number for everyone; Day 0 is the
  tutorial. Practice covers the seven days before today.

## R14. Input profile assets (found during research)

- `@iwsdk/xr-input` fetches controller and hand profiles from
  `https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles` by default.
- Decision: self host the needed profiles under `public/input-profiles/` and point IWSDK at
  them (option verified at slice a start). If no option exists, hide the default controller
  models and keep hand visuals local; if a third party request remains, the privacy page says
  so plainly.

## R15. Performance

- Budget plan: about 55 draw calls (terrain 1, rim 1, lines 1, trees 1, shrubs 1, houses 1,
  flames 1, smoke 1, haze 1, vane 2, aircraft 1, crew 1, highlight 1, mask 1, panels about 30,
  hands 2) and about 140k triangles (terrain 82k, trees about 15k, the rest small).
- Session: request 72 Hz explicitly, fixed foveation level verified at slice e, no shadows, no
  post processing, no per frame allocation, state texture upload 40 KB per tick.
- Measurement: `iwsdk scene` render stats through CLI or MCP at every slice end, logged in
  PERF.md with the emulator profile and room.

## R16. Hosting and freeze

- Decision: Vite multi page build (index.html landing plus XR app, privacy.html) deployed as a
  static site on Vercel (`holdline` project if the name is free), HTTPS by default. Last
  production deploy before 2026-11-18 20:00 UTC, then no change until after 2026-12-11.
  `public/**/AGENTS.md` files are kept out of `dist/`.

## Slice a verification (2026-11-01, T009)

Checked with hz-quest-verify-first (`vr_docs_search`, `vr_docs_get_page`), `npx iwsdk reference
search` and the installed 1.1.0-rc.2 packages.

- Meta docs, "Mixed Reality Support in Browser": persistent anchors via
  `anchor.requestPersistentHandle()` and `session.restorePersistentAnchor(handle)`, at most 8
  per site, not in private mode, deleted with the site's history. Planes are horizontal or
  vertical rectangles, arrive 2 to 3 s after session start; `session.initiateRoomCapture()`
  may run once per session when none exist.
- IWSDK planes: `SceneUnderstandingSystem` adds a `Mesh` per plane directly to the scene at the
  plane pose (plane space: y is the normal) and an entity with `XRPlane { _plane }` (raw
  `XRPlane`, with `orientation`, `polygon`, `semanticLabel` when the browser provides it).
  Meshes: `XRMesh { semanticLabel, isBounded3D, min, max, dimensions }` at the mesh pose.
- Spatial panels at runtime: `PanelUI { config: url }` on a transform entity; the system adds
  `PanelDocument { document }`, a `UIKitDocument` with `getElementById`, `querySelector` and
  `setTargetDimensions(widthM, heightM)`. Panels need `RayInteractable` (rays and gaze) and
  `PokeInteractable` (touch) for clicks.
- Systems reach the raw WebXR frame, session and reference space through `this.renderer.xr`
  (three.js WebXRManager), which the raw anchors service uses.
- Input profiles: the profile JSON is bundled in `@iwsdk/xr-input` (no request), but hand and
  controller models load from jsDelivr through `AssetManager.loadGLTF`. Every load goes
  through the static `AssetManager.loadingManager`, so `setURLModifier` can point those URLs
  at files hosted with the game (T025).
- UIKit fonts: slice a uses the Horizon kit font; the local MSDF fonts are verified with the
  landing page fonts in slice f, as the plan's risk table allows.
- Still to verify at their slice start: pointer events with hit points and capture during a
  drag (slice b), hand joint access for near drawing (slice b), AudioSource with generated
  buffers (slice d), custom ray pointer for the head pointer (slice e).
