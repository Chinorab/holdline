# Contract: device storage

localStorage only, on the player's device. No server ever receives any of it. Every read
and write is wrapped in try and catch; on failure the game keeps an in memory copy and the
journal shows "Progress not saved".

| Key | Value (JSON) | Notes |
|-----|--------------|-------|
| `holdline.v1.settings` | Settings | see data-model.md |
| `holdline.v1.progress` | Progress | unlock counter, Day 0 done, intros shown, anchor handle |
| `holdline.v1.journal` | `JournalEntry[]` sorted by `dayId` | best result per day and kind; capped at 400 entries |
| `holdline.v1.run` | Run (status `in_progress`) | written on every input, on pause and every 5 s; cleared on outcome |

## Versioning

- `version` field inside each value; a reader that meets an unknown future version keeps
  the data untouched and runs from defaults for the session.
- A migration function per version bump, unit tested with fixtures.

## Size budget

A journal entry is about 3 KB (inputs plus a 1280 byte bitset in base64), so a year of play
stays near 1 MB, well under the 5 MB browser quota.

## Privacy page claims this contract must keep true

- No account: nothing identifies the player.
- No tracking: no analytics, no network calls with game data.
- Progress stays on this device: only the keys above, only localStorage.
- No camera access: the game never requests camera images; it reads hand joints, head pose
  and room surfaces from the XR session while playing and stores only the anchor handle.
