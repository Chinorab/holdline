# Data model: Holdline

Pure data shared by the simulation (worker and tests) and the game. Grid indices are
`i = y * W + x`, `W = 128`, `H = 80`, `y = 0` at the board's far edge.

## Enums

| Enum | Values |
|------|--------|
| Fuel | `grass` 0, `shrub` 1, `forest` 2, `rock` 3, `water` 4, `road` 5, `structure` 6 |
| Density | `sparse` 0, `normal` 1, `dense` 2 |
| CellState | `unburnable` 0, `fuel` 1, `burning` 2, `burned` 3 |
| RunKind | `tutorial`, `daily`, `practice` |
| Tool | `dig`, `water`, `backburn` |
| Phase | `landing`, `placing`, `day0`, `brief`, `plan`, `live`, `resolving`, `outcome`, `timelapse`, `journal` (plus `paused` as an overlay flag) |

## DayConfig

| Field | Type | Rule |
|-------|------|------|
| `dayId` | string | `YYYY-MM-DD` local date, or a Day 0 beat (`day0-wind`, `day0-slope`, `day0-breaks`, `day0-line`) |
| `dayNumber` | int | days since 2026-11-01 plus 1; 0 for `day0` |
| `seed` | uint32 | hash("holdline", dayId) |
| `wind` | `{ speedMs, dirDeg }` | speed 2 to 12 m/s; direction the wind blows toward |
| `windShifts` | `{ announceTick, tick, dirDeg, speedMs }[]` | 0 to 2 per day; announce 8 s ahead |
| `ignition` | `{ cell, step }[]` | 1 or 2 ignitions, never inside the town |
| `crewBudgetCells` | int | 40 to 80, tuned so a line can save the town but not the whole map |
| `liveTicks` | int | 1080 (3 min at 6 Hz); with Slower fire the spread period grows, not the clock |
| `spreadPeriodTicks` | int | 6 normal, 9 with Slower fire |
| `tools` | Tool[] | from unlocks at the time the run starts |

## Landscape (generated from `seed`, immutable during a run)

| Field | Type | Rule |
|-------|------|------|
| `elevationM` | Float32Array(W*H) | 0 to about 420 m, ridges and valleys, slope up to about 30 degrees |
| `fuel` | Uint8Array | Fuel enum; river, road and town placed first |
| `density` | Uint8Array | Density enum |
| `baseMoisture` | Uint8Array | 0 to 255, higher near the river |
| `houses` | `{ id, cells: int[] }[]` | 6 houses by default, 2 by 2 cells each, in the town |
| `cellSizeM` | number | 30 |

Validation: every house reachable by fire in the no intervention run on at least most days
(checked by a generator test over 60 dates), at least one ridge between ignition and town on
most days, river and road continuous.

## SimState (owned by the worker)

| Field | Type | Meaning |
|-------|------|---------|
| `tick` | int | 6 Hz clock, frozen while paused |
| `step` | int | fire spread steps done |
| `state` | Uint8Array | CellState |
| `burnLeft` | Uint8Array | steps left while burning (per fuel: grass 2, shrub 4, forest 8, structure 10; tunable) |
| `ignitedAt` | Int32Array | step of ignition, -1 if never |
| `burnedAt` | Int32Array | step of burnout, -1 if never |
| `lineAt` | Int32Array | tick a cell was dug, -1 if not |
| `wetUntil` | Int32Array | tick until a cell stays wet, -1 if dry |
| `flags` | Uint8Array | bit 0 controlled (backburn), bit 1 spotted ember, bit 2 doused |
| `crewQueue` | cell index list | planned line cells not yet dug, FIFO |
| `waterReadyAt` | int | tick the water drop is ready again |

State transitions per cell: `fuel -> burning` (neighbor spread, ember, backburn, ignition);
`burning -> burned` (burnLeft reaches 0, or doused by water); `fuel -> unburnable` (dug line);
nothing leaves `unburnable` or `burned`.

## Input (recorded, replayable)

| Kind | Fields | Validation |
|------|--------|------------|
| `dig` | `tick`, `lineId`, `cells: int[]` (ordered, 4 connected) | tool available, cells within budget left, skips water, rock and road |
| `water` | `tick`, `startCell`, `dirDeg`, `lengthCells` 24, `widthCells` 3 | tool available, `tick >= waterReadyAt`; cooldown 120 ticks (20 s) |
| `backburn` | `tick`, `lineId`, `cell`, `side: 0..3` (neighbor direction toward the fire: east, near, west, far) | tool available, cell on a dug line, not contained; from that cell, the nearest line cells (breadth first) light the fuel on that side, up to 12 cells |
| `pause` / `resume` | `tick` | bookkeeping only, no effect on the fire |

Order: inputs apply at the start of their tick, in recorded order. An input that fails
validation is rejected before it is recorded.

## Run

| Field | Type |
|-------|------|
| `runId` | string (dayId plus start time) |
| `dayId`, `kind` | DayConfig ref, RunKind |
| `settings` | `{ slowerFire: boolean }` (the only setting that changes the fire) |
| `inputs` | Input[] |
| `status` | `in_progress`, `complete` |
| `pausedAtTick` | int, for resume after reload |
| `outcome` | Outcome, when complete |

## Outcome

| Field | Type |
|-------|------|
| `player` | `{ housesStanding, housesTotal, burnedCells, burnedHa }` |
| `baseline` | same shape, from the same day with no inputs |
| `scarBits` | base64 bitset of burned cells (1280 bytes) |
| `endTick`, `resolvedByFastForward` | int, boolean |

`burnedHa = burnedCells * 0.09`, shown rounded to whole hectares.

## Journal and progress (device only)

| Entity | Fields |
|--------|--------|
| JournalEntry | `dayId`, `dayNumber`, `kind` (daily or practice), `best` Outcome summary, `scarBits`, `inputs`, `settings`, `playedAt` |
| Progress | `firstDay`, `completedFires` (unlock counter, Day 0 counts), `introsShown` per tool, `day0Done`, `anchorHandle`, `version` |
| Settings | `highContrast`, `oneHand`, `glassesView`, `slowerFire`, `sound`, `captions` (default on), `dwellSelect`, `headPointer`, `boardWidthCm` (45 to 60, default 56), `boardHeightCm` (offset, -10 to +10) |

Derived: streak = consecutive local dates with a completed daily run ending today or
yesterday; best = max houses standing, then min burned cells, over daily runs.

## BoardPlacement

| Field | Type |
|-------|------|
| `mode` | `plane`, `fallback`, `restored` |
| `pose` | position and yaw in the local floor space |
| `widthM` | 0.45 to 0.60 |
| `anchor` | live XRAnchor, plus persistent handle when available |
