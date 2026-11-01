# Contract: simulation worker messages

The worker owns the fire. The main thread owns the clock: it converts unpaused XR frame
time to a target tick and asks the worker to advance. All messages are plain objects;
typed arrays are transferred, not copied. Types live in `src/worker/protocol.ts`.

## Main to worker

| Message | Payload | Reply |
|---------|---------|-------|
| `init` | `{ day: DayConfig, settings: { slowerFire } }` | `ready` |
| `advance` | `{ toTick }` | `frame` (one per call, after stepping to `toTick`) |
| `input` | `{ input: Input }` (its `tick` must be the current tick) | `inputResult` |
| `resolve` | `{}` (time limit reached: fast forward to extinction, cap 600 steps) | `outcome` |
| `replay` | `{ inputs: Input[], toTick }` (rebuild a run, for resume after reload) | `frame` then `ready` |
| `dispose` | `{}` | none |

## Worker to main

| Message | Payload |
|---------|---------|
| `ready` | `{ landscape: { elevationM, fuel, density, houses }, baselinePending: true }` |
| `baseline` | `{ outcome: OutcomeSide, ignitedAt, burnedAt }` (computed in the background after `ready`) |
| `frame` | `{ tick, step, stateRGBA: Uint8Array(W*H*4), burning: int, frontCentroid: [x, y], crew: { cell, progress }, waterReadyAt, events: SimEvent[] }` |
| `inputResult` | `{ ok, reason?: 'budget' \| 'cooldown' \| 'locked' \| 'invalid', input? }` |
| `outcome` | `{ outcome: Outcome, ignitedAt, burnedAt, lineAt }` |
| `error` | `{ message }` |

`stateRGBA` channels: R fuel and state packed, G burn age in steps (0 to 255), B wet level,
A flags. `SimEvent` covers `ignite`, `ember`, `houseLost`, `windShiftAnnounce`, `windShift`,
`contained`, used for captions, sound and the time lapse.

## Rules

- Same `init` plus the same ordered inputs always produce the same frames (tested).
- The baseline uses the same `DayConfig` and the same RNG keys with no inputs.
- The worker never reads time itself; pause is simply the absence of `advance`.
- Time lapse: built on the main thread from `ignitedAt`, `burnedAt` and `lineAt`, so it
  needs no second simulation.
