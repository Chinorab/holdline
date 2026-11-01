<!--
Sync Impact Report
- Version change: 1.0.0 -> 1.0.1 (PATCH: product renamed Holdline; wording only)
- Previous: template (unversioned) -> 1.0.0 (initial ratification, 2026-10-31)
- Principles defined: I. Hands First, Seated, Within Reach; II. Mixed Reality That Uses the
  Real Room; III. FoV Aware, Comfortable View; IV. Deterministic, Explained Simulation;
  V. Performance Budget; VI. Fast In, Clean Out; VII. Accessible by Default; VIII. Self
  Contained and Private; IX. Truthful, Plain Content; X. Verify, Slice, Ship
- Added sections: Platform and Submission Constraints; Development Workflow and Quality Gates
- Removed sections: none
- Templates: plan-template.md (Constitution Check reads this file at runtime), spec-template.md,
  tasks-template.md: compatible, no edits needed
- Deferred TODOs: none
-->

# Holdline Constitution

## Core Principles

### I. Hands First, Seated, Within Reach (NON-NEGOTIABLE)

- Every step, from the landing page button to the journal, MUST be completable with bare
  hands. Controllers MAY work through the same ray and select path and MUST never be required.
- Every interaction MUST work seated, inside a 60 cm radius around the player's resting
  position. No standing, walking, teleport or artificial locomotion.
- The input vocabulary is pinch, pinch and drag, pinch and hold, poke and grab. Fine finger
  poses MUST NOT be used.
- Every action MUST work with either hand and with one hand only. Every target MUST be
  reachable by gaze (eyes when the device tracks them, head pointing otherwise) plus pinch.

Rationale: competition hard requirement (hands first end to end, airplane seat test) and the
Experience Design criterion.

### II. Mixed Reality That Uses the Real Room

- The game runs in an immersive AR session with passthrough. The board MUST land on a real
  horizontal surface found by the system (table height 0.5 to 1.1 m, nearest the player) and
  stay anchored to it.
- A fallback MUST exist for no plane, several candidate planes, a lost plane and poor
  tracking: a comfortable seated pose in front of the player, with a grab handle to adjust.
- The real room MUST visibly change the experience: smoke leaves the board and drifts into
  the room along the game wind, and a light haze builds with the fire and clears once it is
  contained. Room effects stay a light tint and stay cheap to render.
- Every scene understanding path MUST have a tested fallback, so the game holds up in rooms
  the developer never tested.

Rationale: judges ask that passthrough be purposeful and that MR content hold up in untested
rooms.

### III. FoV Aware, Comfortable View

- The board is about 50 to 60 cm wide at 45 to 55 cm from the eyes.
- Essential UI MUST sit on the board's near edge or inside the central focus zone (30 by 20
  degrees, per the design identity), sized for the Meta VR Glasses perceived p90 field of view
  (58 by 54 degrees). Nothing essential MAY be head locked or in the periphery.
- A "Glasses view" setting turns on the IWSDK field of view mask. It is off by default.
- No camera motion, a stable horizon, and no flashing (never more than three flashes in any
  one second period).

Rationale: FoV aware design is judged explicitly, and seated play must stay comfortable.

### IV. Deterministic, Explained Simulation (NON-NEGOTIABLE)

- The fire model is a probabilistic cellular automaton inspired by Alexandridis et al.
  (2008). Every parameter MUST trace to the paper or be listed as a documented game tuning.
- All randomness MUST come from a seeded, counter based generator keyed by day seed, tick,
  cell and purpose. The daily seed comes from the calendar date.
- Player inputs MUST be recorded with tick numbers. Replay and the no intervention baseline
  MUST reproduce the same states exactly, proven by state hashes in unit tests.
- The simulation runs in a Web Worker at a fixed tick (4 to 8 Hz); visuals interpolate at
  frame rate.
- The product states "Simplified model, not a forecast." and points to local authorities for
  real fire safety.

Rationale: "your result versus no action" only means something if the comparison is exact,
and the model's limits must be stated plainly.

### V. Performance Budget (NON-NEGOTIABLE)

- 72 fps target and a 60 fps floor on Meta Quest 3 and 3S.
- Under 100 draw calls and under 250k visible triangles at all times; InstancedMesh for
  repeated vegetation; one terrain mesh with one custom shader (fuel, burn, contours); few
  transparent particles; no post processing; no real time shadows; no per frame allocation.
- Cold start under 5 s over Wi-Fi: procedural content, a small bundle, lazily loaded audio.
- Budgets MUST be measured with the runtime render stats at the end of every slice and
  recorded in PERF.md.

Rationale: the Technical Implementation criterion requires at least 60 fps on Quest hardware,
and WebXR pays more per draw call than native.

### VI. Fast In, Clean Out

- First contained fire within 3 minutes of entering XR; a complete fire day in 4 to 6 minutes;
  any session reaches a complete moment in under 10 minutes.
- Instructions use at most 4 words each, with icons and ghost hands showing the gesture. No
  wall of text.
- A large Pause control on the board edge, an automatic pause when the XR session loses
  visibility, and a resume that continues exactly where the player left.

Rationale: the competition's one bus stop test and the Best First Five Minutes award.

### VII. Accessible by Default

- One hand and either hand for every action; gaze and pinch for every target.
- High contrast mode; a color vision safe palette in which fire is never told apart by red
  versus green alone (lightness and an ink edge carry it too); captions for every audio cue;
  adjustable board size and height; an option to slow the fire.
- Panel text meets 4.5:1 contrast; targets are at least 3 degrees (80 px on a 1200 px panel)
  and at least 12 mm apart.

Rationale: inclusive by default, and the Best Accessibility Forward award.

### VIII. Self Contained and Private

- Original core: no backend, no account, no LLM or external API at runtime, no wrapper around
  a third party service. Every runtime asset ships from the game's own origin.
- No analytics or tracking. Progress lives only on the device (IndexedDB or localStorage). The
  game never reads camera images.
- A privacy page and a favicon ship with every deployment.
- No secrets in code. If one is ever needed, it lives in environment variables only.
- Third party code and assets MUST be licensed for this use. Sounds are original or CC0.
  Everything is listed in CREDITS.md.

Rationale: the competition's take it away test, and the privacy page must be literally true.

### IX. Truthful, Plain Content (NON-NEGOTIABLE)

- Every real world figure is checked against its cited source before it is quoted, and none
  is ever invented.
- Every number shown in the product comes from the player's own sessions. No fake player
  counts, reviews or testimonials.
- English only. Short titles and texts. No dash or hyphen characters in user facing text, no
  emojis (icons only), no generic marketing copy, and no mention or tag of AI in the product,
  its texts or its images.
- No identifiable people, real brands, logos or recognizable branded products, and no
  advertising. Suitable for ages 10 and up: structures can burn; no person is ever depicted on
  the board, so no person is ever shown hurt (crews and aircraft are generic machines).
- The visual identity follows the design canvas (Holdline, formerly Backburn): Archivo and Atkinson Hyperlegible
  Next, the ink, card, board and fire palette, corner radius 6 to 8 px and never pill shaped,
  no purple gradients.

Rationale: the user's non negotiable rules and the competition's content rules.

### X. Verify, Slice, Ship

- Before writing Quest, WebXR or IWSDK specific code, verify the API against current Meta
  documentation (metavr docs search, IWSDK reference). `iwsdk.config.json` and its JSON schema
  are the source of truth for config keys.
- Work ships in vertical slices, each playable in the emulator: (a) placement, terrain,
  simulation and replay; (b) dig line and outcome versus baseline; (c) water drop, backburn and
  onboarding; (d) daily seed, journal and audio; (e) accessibility, Glasses view and
  performance; (f) deploy, docs and video script.
- Nothing is claimed to work without a runtime screenshot and clean console logs from the
  emulator, plus passing tests where tests apply.
- One finished mechanic beats three half done. If time runs short, cut backburn before polish.

Rationale: there is no headset, so the emulator and the tests are the only proof.

## Platform and Submission Constraints

- Players: Meta Quest 3 and 3S in Meta Quest Browser (the judges' devices). The Meta VR
  Glasses emulator profile is used to check the FoV fit.
- Stack: IWSDK (`@iwsdk/core` 1.1.x) with Three.js imported through `@iwsdk/core`,
  TypeScript, Vite managed by `@iwsdk/cli`, static hosting on Vercel over HTTPS.
- Deadline: 2026-11-18 12:00 PT (20:00 UTC). From then until at least 2026-12-11 (winners
  announced) the deployed URL stays public, free and unchanged. No production deployment
  after the deadline.
- Video: public on YouTube or Vimeo, under 3 minutes (script under 2:45), real captured
  footage from the emulator or a headset only, no AI generated footage.
- New Experience division: all project code is written from 2026-09-24 onward on top of the
  public IWSDK starter.
- Deliverables: landing page, privacy page, favicon, public GitHub repository with a README
  (run steps and the 3 step judge test), DEVPOST.md, VIDEO_SCRIPT.md, TESTING.md, CREDITS.md,
  PERF.md.

## Development Workflow and Quality Gates

- Spec Kit flow: constitution, specify, clarify, plan, tasks, then implement slice by slice.
- Slice gate, all required before the next slice starts: typecheck; fire model unit tests;
  an emulator run with the Meta Quest 3 profile and with the Meta VR Glasses profile in Gaze
  plus Hands mode; board placement in at least two emulated rooms; runtime screenshot; zero
  console errors; render stats logged in PERF.md; PROGRESS.md updated; commit.
- The landing page, the privacy page and the Enter mixed reality flow are checked with
  Playwright, with zero console errors.
- The ECS conventions in AGENTS.md apply (queries, no allocation in `update()`, Three.js
  from `@iwsdk/core`, `createTransformEntity`, `RayInteractable` instead of manual raycasts)
  unless a documented performance reason requires otherwise.

## Governance

- This constitution overrides other practices in this project. Every spec, plan and task list
  passes a Constitution Check against it.
- Amendments are written into this file with a Sync Impact Report and a version bump: MAJOR
  for removing or redefining a principle, MINOR for adding one, PATCH for wording. Any change
  to a NON-NEGOTIABLE principle needs the user's approval.
- Conflicts: the competition rules and the user's brief win over the design canvas (for
  example board size and road behavior). Any deviation from a principle is recorded in the
  plan's Complexity Tracking with its reason.
- Runtime guidance for agents lives in AGENTS.md and PROGRESS.md.

**Version**: 1.0.1 | **Ratified**: 2026-10-31 | **Last Amended**: 2026-11-01
