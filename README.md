# Holdline

One wildfire a day, on your real table. A seated, hands first mixed reality game for
Meta Quest 3 and 3S, played in the Meta Quest browser.

Status: in development for the Meta VR Start Developer Competition 2026. The judge test,
the deployed link and the full documentation arrive with slice f (see `PROGRESS.md`).

## Run it locally

```sh
npm install
npm run typecheck
npm test
npx iwsdk dev up --ai-mode agent --foreground
```

The dev server opens a managed browser with IWER, the IWSDK emulator of a Meta Quest
headset, so the game runs without a headset.

## Where things are

- `specs/001-tabletop-wildfire/`: specification, plan, research, data model, contracts, tasks
- `.specify/memory/constitution.md`: the project rules
- `src/sim/`: the fire model (pure TypeScript, also runs in Node tests)
- `iwsdk.config.json`: XR features, emulator device and room

## License

All rights reserved. See `LICENSE`.
