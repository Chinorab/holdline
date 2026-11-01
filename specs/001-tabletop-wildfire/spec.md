# Feature Specification: Tabletop wildfire, one fire a day

**Feature Branch**: `001-tabletop-wildfire`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "Backburn (working name): a seated, hands first mixed reality game
for Meta Quest 3 and 3S, delivered as a public web page. One wildfire a day lands on the
player's real table as a 3D relief board about 56 cm wide; the player holds the line with their
hands (dig line, water drop, backburn, inspect), then sees their result against the exact same
fire with no intervention, replays it as a 10 s time lapse, and keeps a journal shelf of burn
scars, streak and best. Includes placement on detected table planes with fallback and anchors,
smoke and haze in the real room, a Day 0 onboarding by doing, daily seeded fires plus practice
on past days, accessibility, Glasses view FoV mask, pause and resume, spatial audio, and the
landing and privacy web pages from the Claude Design canvas."

Product name: **Holdline**. "Backburn" was the working name; an iOS game named "Backburn:
Wildfire Strategy" (2026) already ships with line building, water drops, burn outs and a daily
incident mode, so the product is renamed. The backburn tool keeps its name.

## Clarifications

### Session 2026-11-01

- Q: Keep the product name Backburn or rename it? → A: Rename to Holdline; the wordmark and
  mark are redrawn (the fire line becomes the H crossbar); the backburn tool keeps its name.
- Q: When do water drop and backburn unlock? → A: By fires played, not calendar days. Day 0
  counts as fire 1 (dig line), the next completed fire adds water drop, the one after adds
  backburn. Practice fires count, so one sitting can show every tool.
- Q: Add dwell select for limited hand mobility? → A: Yes, built in slice e, off by default.
- Q: Repository license? → A: All rights reserved, source visible; Meta's MIT starter files
  keep their own notice.

## User Scenarios & Testing *(mandatory)*

The player is seated at a table or desk, wearing a Meta Quest 3 or 3S, hands free. Judges
follow a 3 step test: open the URL in the headset browser, enter mixed reality, put the
controllers down.

### User Story 1: The fire lands on my table (Priority: P1)

The player opens the page, enters mixed reality and sees their real room. The table in front
of them is highlighted; a pinch drops the board on it. A paper relief landscape rises out of
the table, the wind shows in moving grass and a wind vane, and a smoke column marks where the
fire starts. When the fire goes live it spreads in real time: it leans with the wind, races
uphill, and moves differently through grass, brush and forest. Smoke drifts off the board into
the room. The player can pause and resume at any moment. When the fire has run its course, a
10 s time lapse replays it on the board.

**Why this priority**: this is the core proof that the idea works in mixed reality: real
table, readable slope, believable fire. Every other story builds on it.

**Independent Test**: in the emulator, enter mixed reality in a furnished room, drop the board
on the table, let a fire day run without touching anything, pause and resume once, watch the
time lapse. Repeat in a room with no table: the fallback places the board in front of the
player.

**Acceptance Scenarios**:

1. **Given** a room with a table between 0.5 and 1.1 m high in front of the player, **When**
   mixed reality starts, **Then** that table is highlighted within 4 s and a pinch places the
   board on it, level and anchored.
2. **Given** a room where no suitable surface is found within 4 s, **When** placement times
   out, **Then** the board appears at a comfortable seated pose in front of the player with a
   grab handle, and the player can move it with one hand.
3. **Given** the board is placed, **When** the brief plays, **Then** the landscape rises out of
   the table, the wind vane and grass show the wind, and a smoke column marks the ignition, all
   within about 10 s.
4. **Given** a live fire on a slope with wind blowing uphill, **When** the player watches,
   **Then** the fire visibly runs faster uphill and downwind than downhill and upwind.
5. **Given** a live fire, **When** the player presses Pause or the session loses visibility,
   **Then** the fire, smoke and timers freeze, and resuming continues from the exact same state.
6. **Given** a finished fire, **When** the outcome appears, **Then** a 10 s time lapse of the
   whole fire plays on the board.

---

### User Story 2: I dig a line and see what it changed (Priority: P1)

During the plan phase (fire paused, up to 30 s) and during the live fire, the player pinches
and drags across the terrain to draw a fire line. Crews dig it progressively from its start;
the day's crew budget limits total length. The fire cannot cross a dug line, but in strong wind
embers can jump it. At the end the player sees houses standing and area burned for their run
next to the exact same fire with no intervention.

**Why this priority**: the comparison with no action is the payoff and the lesson. With US1 it
forms the minimum complete game.

**Independent Test**: play one fire day using only the dig line; check the outcome shows both
results, and that replaying the same day with the same inputs gives identical numbers.

**Acceptance Scenarios**:

1. **Given** the plan phase, **When** the player pinches on the terrain and drags, **Then** a
   planned line follows the finger (direct touch over the board, hand ray from farther away)
   and the remaining crew budget shrinks as the line grows.
2. **Given** a planned line, **When** the fire goes live, **Then** crews dig it from its start
   at a steady pace and dug cells stop the fire.
3. **Given** a fire front reaching a dug line in light wind, **When** it arrives, **Then** it
   stops at the line; **Given** strong wind, **Then** an ember may start a spot fire beyond it.
4. **Given** the fire is over, **When** the outcome shows, **Then** it lists houses standing and
   area burned for "You" and "If no one had acted", from the same fire.
5. **Given** a finished day, **When** it is replayed from its recorded inputs, **Then** every
   cell and every number matches the original run exactly.

---

### User Story 3: The first five minutes teach me by doing (Priority: P2)

On a first visit, Day 0 runs before the first daily fire, in three beats of about 20 s each:
wind (light a test patch and watch it lean), slope (it races uphill), fuel and breaks (grass,
forest, road). Then the player digs a first line and contains a small fire. Each instruction
has at most 4 words, an icon, and a ghost hand showing the gesture. No wall of text.

**Why this priority**: judges are first time players; a fast, wordless start decides whether
they stay. It also targets the Best First Five Minutes award.

**Independent Test**: start with empty progress, enter mixed reality, follow Day 0 with hands
only; time from entering to the first contained fire.

**Acceptance Scenarios**:

1. **Given** a first visit, **When** the board lands, **Then** Day 0 starts by itself, with no
   menu to read.
2. **Given** each beat, **When** it starts, **Then** a ghost hand performs the gesture and a
   caption of 4 words or fewer names it.
3. **Given** a player who follows the beats, **When** they dig the first line, **Then** the
   small fire is contained within 3 minutes of entering mixed reality.
4. **Given** a returning player, **When** they enter, **Then** Day 0 is skipped and can be
   replayed from settings.

---

### User Story 4: More ways to fight it (Priority: P2 for water drop, P3 for backburn)

Water drop: the player looks at a target and pinches, drags while pinching to set the
direction, and a small generic aircraft crosses the board and wets a strip that slows the fire
and knocks down flames under it; cooldown about 20 s. Backburn: the player pinches and holds
1 s on a dug line to light a controlled fire on the side facing the fire; it burns toward the
main fire and starves it, but a wind shift can turn it against the player. Inspect: resting
the gaze on a cell shows its fuel and slope in a small tooltip near the center of view.

**Why this priority**: depth and replay value. Backburn is the first feature to cut if time
runs short; polish is not.

**Independent Test**: on a day where all three tools are available, use each once and check
its effect against the no intervention run.

**Acceptance Scenarios**:

1. **Given** water drop is available and ready, **When** the player looks at a spot, pinches
   and drags, **Then** an aircraft crosses along that direction and the strip below it shows as
   watered and burns more slowly for a while.
2. **Given** water drop was just used, **When** the player tries again, **Then** the tool shows
   its cooldown and stays unavailable for about 20 s.
3. **Given** a dug line, **When** the player pinches and holds on it for 1 s, **Then** a
   controlled fire starts along the fire facing side of the line.
4. **Given** the player rests their gaze on a cell for a moment with no tool in use, **Then** a
   tooltip names the fuel and the slope, without blocking any tool.
5. **Given** a player who has completed Day 0 only, **When** their next fire starts, **Then**
   water drop is available and introduced by a ghost hand and a caption of 4 words or fewer;
   **Given** two completed fires, **When** the third starts, **Then** backburn is introduced the
   same way. Practice fires count toward unlocks.

---

### User Story 5: One fire a day, and a reason to come back (Priority: P2)

Every calendar day has one new fire, the same for every player on that date. The player can
also practice on past days. Beside the board, a journal shelf shows a miniature burn scar for
each day played, the current streak and the personal best. Missed days show as empty slots.
Progress stays on the device.

**Why this priority**: the daily habit is the product's long term value and targets the Best
Reason to Come Back award.

**Independent Test**: play today's fire, then change the device date to the next day and play
again; check the new fire differs, the streak reads 2, both scars sit on the shelf, and a past
day can be practiced without changing the streak.

**Acceptance Scenarios**:

1. **Given** two players on the same date, **When** they start the daily fire, **Then** they
   get the same landscape, wind and ignition.
2. **Given** a completed daily fire, **When** the journal opens, **Then** today's burn scar sits
   on the shelf and the streak counts consecutive days played.
3. **Given** a missed day, **When** the player selects its empty slot, **Then** they can
   practice that day's fire; the result is marked as practice and does not change the streak.
4. **Given** a cleared browser storage, **When** the player returns, **Then** progress is empty
   and the game behaves as a first visit.

---

### User Story 6: The room feels the fire (Priority: P2)

Smoke rises off the board and drifts into the real room along the game wind. A light haze
builds in the room as the fire grows and clears once it is contained. Spatial sound places the
crackle at the fire front, louder as more cells burn, plus wind, the aircraft pass and digging.
Every sound has a short caption.

**Why this priority**: passthrough must change the experience, and sound sells the fire.

**Independent Test**: run a live fire in the emulator; check smoke leaves the board area along
the wind, the haze rises and falls with the number of burning cells, and each sound cue shows
its caption.

**Acceptance Scenarios**:

1. **Given** a live fire, **When** cells burn, **Then** smoke drifts beyond the board edge in
   the wind direction and fades in the room.
2. **Given** the fire grows, **When** many cells burn, **Then** the room takes a light warm
   tint that never hides the room, and it clears within a few seconds of containment.
3. **Given** sound is on, **When** the aircraft passes, **Then** the sound follows it across the
   board and a caption names it.

---

### User Story 7: I can play it my way (Priority: P2)

Every action works with either hand and with one hand only; every target can be reached by gaze
plus pinch. Settings offer high contrast, one hand mode, Glasses view (field of view mask, off
by default), slower fire, sound, captions, board size and board height. The palette never tells
fire apart by red versus green alone. Essential controls sit on the board's near edge or the
center of view, never head locked.

**Why this priority**: inclusive by default, FoV aware design is judged, and it targets the
Best Accessibility Forward award.

**Independent Test**: complete a fire day with the right hand only, then with the left hand
only, then with gaze plus pinch only; toggle each setting and see its effect; run the Meta VR
Glasses profile and confirm every essential control is inside its view.

**Acceptance Scenarios**:

1. **Given** one hand mode, **When** the player needs to rotate or resize the board, **Then**
   edge controls do it without a second hand.
2. **Given** high contrast, **When** it turns on, **Then** fuels deepen, rock and water lighten,
   ink lines double and fire gains a heavier edge.
3. **Given** Glasses view, **When** it turns on, **Then** the view is masked to the glasses'
   field and every essential control remains visible.
4. **Given** slower fire, **When** it is on, **Then** the fire spreads more slowly and the plan
   phase is longer, and the outcome notes it.
5. **Given** dwell select is on, **When** the player rests their gaze on a target for about
   1 s, **Then** a fill ring completes and the target is selected with no pinch; a line is drawn
   by dwelling on its start, moving the gaze along the path, and dwelling to finish.

---

### User Story 8: Judges find it and trust it (Priority: P1)

The public page shows the name, the line "One wildfire a day, on your real table.", a big
"Enter mixed reality" button and "Hands only. Seated. 5 minutes." A privacy page says: no
account, no tracking, progress stored only on this device, no camera access. The site has a
favicon and loads fast. In mixed reality, an About panel says "Simplified model, not a
forecast." and points to local authorities for real fire safety.

**Why this priority**: judges cannot score what they cannot launch, and every promise on the
privacy page must be literally true.

**Independent Test**: open the page on desktop and in the emulator; check the content, the
favicon, the privacy page, zero console errors, and the Enter mixed reality flow.

**Acceptance Scenarios**:

1. **Given** the page in the headset browser, **When** the player presses Enter mixed reality,
   **Then** the session starts with passthrough and hand tracking.
2. **Given** a browser that cannot start mixed reality, **When** the button is pressed, **Then**
   one short line explains to open the page in the Meta Quest browser.
3. **Given** the privacy page, **When** read, **Then** each of its four promises matches what
   the game does.

### Edge Cases

- No horizontal surface, several surfaces, a surface that disappears, or poor tracking during
  placement: fallback pose with a grab handle; placement can be redone from the board edge.
- A table smaller than the board: the board can overhang; size can be reduced to 45 cm.
- The player stands up or leans: the board stays anchored; nothing follows the head.
- Hands lost from tracking mid drag: the line stops at the last tracked point and the input is
  recorded up to there.
- Both hands pinch at once: a two hand pinch on the board rim moves or scales the board; a
  pinch on the terrain is a tool action; the two never mix.
- Headset removed or system menu opened: automatic pause; resume continues the same tick.
- Page reloaded or session ended mid fire: the day in progress resumes from its recorded inputs
  at the tick where it stopped.
- Midnight passes during a fire: the fire belongs to the date it started on.
- Device clock moved back: streak is computed from recorded dates; no day is played twice as a
  daily fire.
- Storage unavailable or full: the game still plays; the journal says progress cannot be saved.
- Crew budget used up: drawing more line is refused with a visible empty budget.
- Water drop tried during cooldown: refused with the remaining time shown on the tool.
- Backburn lit while wind shifts toward the protected side: it may escape; that is intended and
  shown in the outcome.
- Fire still burning at the time limit: the rest of the spread is resolved quickly so both
  outcomes are final.
- Controllers in hand: they work through the same pointing and select path; nothing needs them.
- Sound off: captions still show for cues; no information exists only in sound.

## Requirements *(mandatory)*

### Functional Requirements

**Entry and web pages**

- **FR-001**: The landing page MUST show the product name, "One wildfire a day, on your real
  table.", a large "Enter mixed reality" button and "Hands only. Seated. 5 minutes.", following
  the design canvas.
- **FR-002**: When mixed reality cannot start, the page MUST say so in one short line and point
  to the Meta Quest browser. There is no flat screen game mode.
- **FR-003**: A privacy page MUST state: no account, no tracking, progress stored only on this
  device, no camera access. Every page MUST have a favicon.
- **FR-004**: From the Enter press to the placement highlight MUST take under 5 s on home Wi-Fi.

**Placement**

- **FR-005**: The game MUST find horizontal surfaces, pick the best one between 0.5 and 1.1 m
  high that is near and in front of the player, highlight it, and place the board there on a
  pinch.
- **FR-006**: When several surfaces qualify, the player MUST be able to pick another one by
  pointing or looking at it and pinching.
- **FR-007**: When no surface qualifies within 4 s, or tracking is poor, the board MUST appear at
  a comfortable seated pose about 50 cm in front of the player, level and below eye level, with a
  grab handle.
- **FR-008**: The board MUST stay fixed to the real surface it was placed on. If that surface is
  lost, the board stays where it is and placement can be redone from the board edge.
- **FR-009**: When the device can remember anchors between visits, the board MUST return to the
  same spot on the same table on the next visit; otherwise placement runs again.
- **FR-010**: The board MUST default to 56 by 35 cm, adjustable from 45 to 60 cm wide, and its
  height MUST be adjustable within seated reach. A two hand pinch on the board rim rotates it
  around the vertical axis and scales it within those limits; one hand mode offers the same
  through edge controls.

**Fire day**

- **FR-011**: A fire day MUST run these phases in order: Place, Brief (about 10 s), Plan (up to
  30 s, fire paused, can be ended early), Live (about 3 min, real time), Outcome.
- **FR-012**: The Outcome MUST show houses standing and area burned for the player's run and for
  the same fire with no intervention, then a 10 s time lapse of the player's fire on the board,
  and save the result to the journal.
- **FR-013**: Live MUST end when nothing burns or at the time limit; at the limit, remaining
  spread is resolved quickly so both outcomes are final.
- **FR-014**: The same day with the same recorded inputs MUST produce the same fire, cell for
  cell. The no intervention result MUST come from the same day and the same chance events.
- **FR-015**: On some days the wind MUST shift during Live; each shift is announced a few seconds
  ahead by the wind vane and a caption.

**Landscape and fire behavior**

- **FR-016**: The landscape MUST be a grid of at least 64 by 64 cells, each with elevation, fuel
  (grass, shrub, forest, rock, water, road, structure), density, moisture and fire state
  (cannot burn, unburned, burning with time left, burned).
- **FR-017**: Each day's landscape MUST be generated from that day's seed with ridges and valleys
  where slope matters, a small town of houses, a river and a road. Contour lines MUST make slope
  readable at a glance, with steeper ground showing closer lines.
- **FR-018**: Spread MUST lean downwind, run faster uphill, depend on fuel, density and moisture,
  and never enter rock, water, road or dug line. In strong wind, embers MUST be able to start
  spot fires downwind beyond those breaks.
- **FR-019**: The About panel MUST say "Simplified model, not a forecast." and point to local
  authorities for real fire safety.

**Tools**

- **FR-020**: Dig line: pinch and drag on the terrain draws a line (direct touch over the board,
  hand ray from farther); crews dig it progressively from its start at a steady pace; a per day
  crew budget caps total length and is visible on the board edge; lines can be drawn in Plan and
  Live.
- **FR-021**: Water drop: look at a target and pinch, drag while pinching to set the direction;
  a generic aircraft crosses the board and wets a strip that slows spread for a while and knocks
  down flames in it; cooldown about 20 s, visible on the tool.
- **FR-022**: Backburn: pinch and hold 1 s on a dug line lights a controlled fire along the side
  of the line that faces the fire.
- **FR-023**: Inspect: resting the gaze or hand ray on a cell for a moment, with no tool in use,
  shows its fuel and slope in a small tooltip kept near the center of view.
- **FR-024**: Tools MUST unlock by completed fires: Day 0 (fire 1) teaches the dig line, the
  next completed fire unlocks water drop, the one after unlocks backburn. Daily and practice
  fires both count. Each unlock is introduced once by a ghost hand and a short caption.
- **FR-025**: The toolbar and a large Pause control MUST sit on the board's near edge; one tool
  is active at a time.

**Pause, resume, onboarding**

- **FR-026**: Pause MUST freeze fire, smoke, crews, aircraft and timers. Losing session visibility
  MUST pause automatically. Resume MUST continue from the exact same state, including after a
  page reload on the same day.
- **FR-027**: A first visit MUST run Day 0: three beats of about 20 s (wind, slope, fuel and
  breaks), then a first line that contains a small fire, within 3 minutes of entering mixed
  reality. Instructions use at most 4 words, an icon and a ghost hand. Returning players skip it
  and can replay it from settings.

**Daily fire and journal**

- **FR-028**: Each calendar date (device local date) MUST have one daily fire, the same for every
  player on that date. Past dates MUST be playable as practice.
- **FR-029**: A journal shelf beside the board MUST show a miniature burn scar per day played,
  the current streak and the personal best; missed days show an empty slot that offers practice.
- **FR-030**: The streak MUST count consecutive calendar days with a completed daily fire.
  Practice fires MUST NOT change the streak. Personal best is the most houses standing, then the
  least area burned.
- **FR-031**: Progress MUST be stored on the device only, with no account. If storage is
  unavailable, play continues and the journal says progress cannot be saved.
- **FR-032**: Every number shown in the product MUST come from the player's own sessions.

**Room, sound, captions**

- **FR-033**: Smoke MUST rise from burning cells and drift past the board edge into the room along
  the game wind, then fade. A light room haze MUST follow the amount of burning and clear once
  the fire is contained. Room effects never exceed a light tint and never flash.
- **FR-034**: Sound MUST place the crackle at the fire front, scaled by burning cells, plus wind,
  aircraft and digging. Sounds are original or CC0. Sound can be turned off.
- **FR-035**: Every sound cue MUST have a short caption near the board's near edge; captions are
  on by default.

**Access, comfort, content**

- **FR-036**: Every action MUST work with either hand and with one hand only; every target MUST be
  reachable by gaze plus pinch; controllers work through the same path and are never required.
- **FR-037**: Settings MUST offer high contrast, one hand mode, Glasses view (off by default),
  slower fire, sound, captions, board size and board height.
- **FR-038**: Fire MUST be distinguishable from every surface without relying on red versus
  green: it carries a light core and an ink edge and stays distinct in grayscale.
- **FR-039**: Essential UI MUST sit on the board's near edge or within the central focus zone
  and fit the Meta VR Glasses view; nothing essential is head locked or in the periphery.
- **FR-040**: The view MUST never move on its own, the horizon stays level, and nothing flashes.
- **FR-041**: User facing text MUST be English, short, free of dash and hyphen characters, free
  of emojis (icons only) and free of any mention of AI. No person, real brand, logo or
  advertising appears. People are never depicted; crews and aircraft are generic machines.
- **FR-042**: A dwell select setting (off by default) MUST let the player select any target by
  resting the gaze on it for about 1 s, with a visible fill ring, and draw lines by gaze path,
  so the whole game can be played without pinching.

### Key Entities

- **Day**: a calendar date with its seed, landscape, wind schedule (including shifts), ignition
  point, crew budget and the tools available that day. Day 0 is a fixed tutorial day.
- **Landscape**: the grid of cells (elevation, fuel, density, moisture) plus the town's houses,
  the river and the road, generated from the day's seed.
- **Fire run**: one play of a day: the day, the kind (daily, practice, tutorial), the ordered
  inputs with the tick each happened on, the settings that change the fire (slower fire), and
  the final state. Replaying the inputs rebuilds the run exactly.
- **Input**: one recorded player action: dig line path, water drop target and direction,
  backburn start, or pause and resume.
- **Outcome**: houses standing and area burned for the player's run and for the no intervention
  run of the same day, plus the burn scar used for the miniature and the time lapse.
- **Journal**: the list of days played with their best outcome and scar, the streak and the
  personal best.
- **Settings**: the player's choices for contrast, one hand mode, Glasses view, slower fire,
  sound, captions, board size and height.
- **Board placement**: where the board sits in the room, its size and the anchor that ties it to
  the real surface.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first time player sees the board on their table, or at the fallback pose, within
  10 s of entering mixed reality.
- **SC-002**: A first time player contains their first fire within 3 minutes of entering mixed
  reality.
- **SC-003**: A daily fire day takes 4 to 6 minutes from brief to outcome; a first session (Day 0
  plus the first daily fire) completes in under 10 minutes.
- **SC-004**: Every step of a fire day can be completed with the right hand only, with the left
  hand only, and with gaze plus pinch only (checked against the full test list in the emulator).
- **SC-005**: The game holds 72 frames per second and never drops below 60 during the most intense
  moment of a fire on Meta Quest 3 and 3S, within the visual budget set in the constitution.
- **SC-006**: Replaying any recorded day reproduces the identical outcome in 100% of runs, and
  the no intervention result for a date is identical on every device.
- **SC-007**: Placement succeeds, on a surface or by fallback, in 100% of tested emulated rooms,
  including one with no table.
- **SC-008**: Every essential control stays inside the Meta VR Glasses perceived view (58 by 54
  degrees) while seated at the board.
- **SC-009**: The landing page, the privacy page and the Enter mixed reality flow produce zero
  console errors.
- **SC-010**: The fire model passes repeatable checks: uphill spread faster than downhill,
  downwind faster than upwind, breaks stop spread except for embers, water slows spread.
- **SC-011**: 100% of instructions have 4 words or fewer; an automated scan finds zero dash or
  hyphen characters, emojis or mentions of AI in user facing text.
- **SC-012**: Panel text contrast is at least 4.5:1, and fire stays distinguishable from its
  closest surface under protanopia, deuteranopia, tritanopia and grayscale.

## Assumptions

- Judges play on Meta Quest 3 or 3S in the Meta Quest browser, seated at a table or desk, and
  may not have set up their room, so the fallback pose is a first class path.
- The brief wins over the design canvas where they differ: the board is 56 by 35 cm by default
  (the canvas says 80 by 50 cm), roads stop the fire like dug lines (the canvas says roads slow
  it), and Glasses view is off by default (the settings mockup shows it on).
- Areas are shown in hectares, as in the design canvas.
- The day boundary is the device's local date. A fire belongs to the date it started on.
- Only the player's own results are ever shown; there is no leaderboard or social feature.
- Visitors without a mixed reality capable browser see the landing page with instructions; no
  flat screen game is offered.
- The landing page hero becomes a real capture of the game board once it renders, replacing the
  mockup image.
- Sounds are made for the game (original) or come from CC0 sources; no music is used.
- The demonstration video is recorded from the emulator; this feature provides its script.
- The repository is public for judging under all rights reserved; the IWSDK starter files keep
  Meta's MIT notice.
- Out of scope: multiplayer, accounts, leaderboards, voice commands, real map data, and any
  flat screen version.
