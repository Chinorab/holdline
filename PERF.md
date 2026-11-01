# Performance log

Budget (constitution V): 72 fps target, never below 60; under 100 draw calls and 250k
triangles; no post processing, no realtime shadows; cold start under 5 s.

Numbers come from `renderer.info` read in the page after a frame (`__holdlineDebug.stats()`,
development builds only). In an immersive session three.js draws each eye, so the counts
below are **per frame, both eyes together**; per eye is about half.

## Slice a (2026-11-01)

Emulator: IWER, Meta Quest 3 profile, rooms `sunlit_living_room` and `home_office`, inside
the Claude desktop browser pane (see TESTING.md for why not the IWSDK managed browser).

| Moment | Draw calls | Triangles | Notes |
|--------|-----------:|----------:|-------|
| Brief, first build | 48 | 247,168 | terrain 256 by 160 quads everywhere, two trees per dense forest cell, 8 sided brush |
| Brief, after the pass | 52 | 171,252 | flat terrace cells drawn as one quad, one 4 sided tree per forest cell, 4 sided brush; controller models visible |
| Live, 57 cells burning | 42 | 166,764 | controllers, smoke and flames on |
| Live, hands, pause card shown | 62 | 170,184 | highest draw count seen |
| Outcome after the time lapse | 38 | 165,788 | |

Peak fire adds at most 400 flame cards and 200 smoke cards, under 1,600 triangles for both
eyes, so the worst case stays near 172k triangles and about 62 draw calls.

Frame rate: not measurable here. The emulated session ran at about 3 fps in the browser
pane (software rendering of the emulated room plus both eyes), which says nothing about a
Quest 3. A frame rate claim needs a headset (TESTING.md).

## Slice b (2026-11-01)

Same emulator setup (Quest 3 profile, `home_office`, browser pane). Read from the last XR
frame before any still is rendered (a still renders the scene once more and resets the
counters).

| Moment | Draw calls | Triangles | Notes |
|--------|-----------:|----------:|-------|
| Live, 2 lines (74 cells), 3 crew pawns, hand models, smoke | 54 | 171,136 | full toolbar (4 tools and the crew line meter) |

Lines add two draw calls (all committed lines share one mesh, the line being drawn has its
own) and at most 12,288 plus 4,096 preallocated vertices; the crew is one instanced draw.
The extra draw calls against slice a come mostly from the larger toolbar panel.

## Slice c (2026-11-01)

| Moment | Draw calls | Triangles | Notes |
|--------|-----------:|----------:|-------|
| Live, Meta VR Glasses profile, wet strip, inspect tooltip shown, 39 cells burning | 54 | 169,540 | read from the last XR frame |

New draws, only while shown:
water preview 1, aircraft 3 (body, outline, shadow) plus the water veil 1, hold ring 1,
ghost hand 2 fills and 14 outline lines, inspect tooltip (one small panel).

## Slice d (2026-11-01)

| Moment | Draw calls | Triangles | Notes |
|--------|-----------:|----------:|-------|
| Live, Quest 3, 45 cells burning, captions shown, haze on | 76 | 172,336 | read from the last XR frame |

Captions add one small panel, the haze one sphere, the smoke plume no draw (same instanced
mesh). The draw count is the highest so far and still under 100; slice e checks it again
with the settings card.

Production build (`npm run build`): main chunk 2.46 MB (680 KB gzip), UIKit font 423 KB,
MSDF worker 456 KB, simulation worker 202 KB. Cold start to the placement highlight is
measured on the deployed site in slice f.
