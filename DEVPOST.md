# Holdline: Devpost submission text

Copy rules hold here too: no dashes or hyphens, no emojis, short, every figure sourced.
Replace https://holdline-kappa.vercel.app and [VIDEO_URL] once deployed and uploaded.

## Form fields

- **Name:** Holdline
- **Tagline (140 max):** One wildfire a day lands on your real table. Read the wind, dig a
  line with your hands, and see what you saved.
- **Track:** Gaming
- **Division:** New
- **Build path:** IWSDK (Web XR)
- **URL:** https://holdline-kappa.vercel.app
- **Video:** [VIDEO_URL]
- **Target launch date:** Spring 2027, as a progressive web app on the Meta Horizon Store.

## Description (under 500 words)

### Inspiration

In mid October 2026 the season's first Santa Ana wind event brought at least three
significant wildfires to Southern California, and preventive power shutoffs reached about
65,000 customers in Los Angeles, Kern and Ventura counties (PAHO, natural hazards monitoring,
16 October 2026). As of 29 August 2026 the United States had counted 51,774 wildfires that
burned more than 8.1 million acres (NIFC, reported by Idaho News). Europe had its own summer:
Hvar and Korcula in Croatia, Thessaloniki and Paros in Greece, Gironde in France.

Fire lines are about terrain, wind and time. Those are hard to feel on a flat map and easy
to feel on a model you can lean over. So Holdline puts the model on your table.

### What it does

A paper relief valley, 56 by 35 cm, lands on your real table. Each day brings one fire, the
same for everyone on that date. You read the wind, pinch and drag on the board to draw a
line, and crews dig it while the fire runs: fast in grass, slow in forest, racing uphill,
stopped by roads and by your line. Later fires add a water drop and a backburn.

When it ends, the card puts your result next to the exact same fire with no one acting, and
a 10 second time lapse replays it. A journal beside the board keeps your streak, your best
and a burn scar for every day. A first visit starts with Day 0: about two minutes that teach
wind, slope, breaks and the first line by doing, shown by a paper ghost hand.

### How we built it

Immersive Web SDK on WebXR: plane and mesh detection to find a table, persistent anchors to
keep it there, hand tracking for every action, gaze on Meta VR Glasses, UIKit panels. The fire
is a cellular automaton after Alexandridis et al. 2008, written to be deterministic (counter
based random numbers, our own exp and trig), so the no action comparison and every replay
are exact. It runs in a Web Worker; the main thread owns the clock, so pause is real pause.
Sounds are synthesized in code and placed in the room. 208 automated tests cover the model,
storage, unlocks, the journal and the copy.

### Challenges

Building without a headset: every claim was checked in the IWSDK emulator with scripted hands,
gaze and controllers, and what still needs real hardware is listed in TESTING.md.

### What we learned

A table changes how people read a map. Accessibility shaped the input design: the same
strokes work by pinch over the board, by ray, by gaze, by a head pointer, or by dwell alone.

### What's next

Weekly seasons with new valleys, shared daily results, and a store release as a progressive
web app in spring 2027.

## Meta VR capabilities used

Passthrough mixed reality (immersive AR session), plane detection and mesh detection (table
and ceiling), persistent spatial anchors, hand tracking with joint poses, gaze input on Meta
VR Glasses, controller support through the same input path, FoV aware compact layout for the
glasses' field of view, 72 Hz request and fixed foveation.

## How hand interactions work

Every action is a pinch. Near the board, a pinch within 10 cm of the surface draws right under
your fingers (thumb and index tip joints, projected onto the relief). From farther away, the
hand ray does the same; a drag is followed over the relief, not over a flat plane. Water drop:
pinch where the strip starts and drag for its direction. Backburn: pinch and hold 1 second on a
dug line. The board is placed with a pinch, and in one hand mode it turns and resizes from
buttons at its edge. Either hand works alone. On Meta VR Glasses, gaze aims and a pinch from
either hand acts. Players who cannot pinch can turn on dwell select: rest your gaze for one
second on a button, or on the board to start and end a line.

## What excites us about the future of VR (under 150 words)

Mixed reality lets a game use the room you are already in. A table becomes a terrain model, a
ceiling stops the smoke, and a daily puzzle fits between two other things in your day. We want
more games that respect a short sitting, run on any headset or pair of glasses, and teach
something true about the real world without pretending to be a forecast.
