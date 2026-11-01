# Quickstart: run and validate Holdline

Validation guide. Commands run from the repository root. Details of messages, storage and
copy are in [contracts/](./contracts/) and [data-model.md](./data-model.md).

## Prerequisites

- Node 22.12 or newer (this machine: 24.22.1), npm 11.
- `npm install` done (the scaffold already ran it).
- For agent sessions: start Claude Code in this folder so `.mcp.json` loads the
  `iwsdk-runtime`, `iwsdk-reference` and `metavr` MCP servers. The same actions exist as
  `npx iwsdk <domain> <action>` from any shell.

## Everyday loop

```bash
npm run typecheck
npm test                      # Vitest: fire model, storage, unlocks, copy scan
npx iwsdk dev up --ai-mode agent --foreground
npx iwsdk dev status          # wait for browserCommandReady: true
```

## Emulator scenarios (each slice gate)

1. Enter mixed reality with hands:
   `npx iwsdk xr status`, `npx iwsdk xr enter`, `npx iwsdk xr status` (sessionActive true),
   `npx iwsdk xr set-input-mode --input-json '{"mode":"hand"}'`.
2. Placement: wait 4 s, `npx iwsdk scene runtime-hierarchy` shows `PlacementHighlight` on the
   chosen surface; pinch with `npx iwsdk xr select --input-json '{"device":"hand-right"}'`;
   `npx iwsdk scene transform` of `Board` lies on that surface (height within 1 cm).
3. Rooms: repeat step 2 with `dev.emulator.environment` set to `sunlit_living_room`,
   `home_office`, `kitchen`, `open_office` and `bedroom` (`living_room` and `office_small` are
   legacy rooms that IWSDK 1.1 replaces); at least one must end in the fallback pose. IWER
   starts the head standing at the room center, so seat it near the table first.
4. Fire: `npx iwsdk ecs pause`, `npx iwsdk ecs step`, `npx iwsdk ecs snapshot`,
   `npx iwsdk ecs diff` around a few steps to show burning cells grow downwind and uphill.
5. Tools: `npx iwsdk xr run-sequence` with a pinch and drag across the terrain (dig line), a
   gaze or ray pinch with a drag (water drop), and a 1 s pinch on a dug cell (backburn);
   check the worker's `inputResult` in `npx iwsdk browser logs`.
6. Glasses: set `dev.emulator.device` to `metaVRGlasses`, follow the iwsdk-glasses-test steps
   (gaze `xr look-at`, pinch with either hand, gaze disconnected fallback), and compute the
   angles of every essential element; screenshot shows the mask.
7. Evidence: `npx iwsdk browser screenshot --output-file artifacts/<slice>.png`,
   `npx iwsdk browser logs` with zero errors, `npx iwsdk scene render-stats` numbers into
   PERF.md.

## When the IWSDK managed browser cannot start

On a machine where Chromium cannot be launched from the shell (see TESTING.md), run the dev
server with `HOLDLINE_HTTP=1` (plain `http://localhost`, a secure context for WebXR) and
`--no-open`, open it in any local browser, and drive IWER from the page with
`scripts/emulator/slice-a.browser.js` (`IWER_DEVICE.remote.dispatch`, the same actions as the
CLI). Keep the page visible: a hidden page gets no animation frames and IWSDK waits.

## Web pages

```bash
npm run build && npm run preview
npx playwright test           # landing, privacy, unsupported message, zero console errors
```

Against the dev server (emulator injected), the Playwright flow presses "Enter mixed
reality" and checks that the session starts with no console error.

## Expected outcomes

- Same day plus same inputs gives the same state hash (unit test prints it).
- Outcome card numbers equal the worker's `outcome` message for both runs.
- `dist/` holds no `AGENTS.md`, no source maps in production, and no request to another
  origin at runtime (checked in the Playwright network log).
- Render stats stay under 100 draw calls and 250k triangles at the most intense fire moment.

## Deploy (slice f)

```bash
npx vercel --prod             # project "holdline"; last production deploy before 2026-11-18 20:00 UTC
```

After the deadline: no production deploy until after 2026-12-11.
