# Demo video tooling

How the demo video was made, kept so it can be checked and made again. Everything is real
capture of the game running in the IWSDK emulator (Meta Quest 3 profile, home_office room) in
a headed Chromium on a GTX 1050 at about 50 frames per second; nothing is mocked.

1. `driver.cjs`: keeps one headed Chromium on the dev page (`HOLDLINE_HTTP=1`, port 8081) and
   takes commands over HTTP on 127.0.0.1:8795: evaluate, click, screenshot, and record (CDP
   screencast frames with timestamps plus the game's own sound, tapped from its AudioListener).
2. `capture.browser.js`: page helpers loaded after `scripts/emulator/slice-*.browser.js`.
   Narrows the emulator view to 65 degrees, hides the emulator's own interface (its canvases
   stay), moves the head and hands smoothly, and holds the shot lists (`shots.opening`,
   `shots.day0`, `shots.daily`, `shots.access`) with time marks for the edit.
3. `master.py`: turns a take into a 30 fps master with its sound.
4. `voice.py`: narration with Piper (`en_US-ryan-high`), local. `render.cjs`: caption plates,
   speed badges and the end card with the site's own fonts.
5. `edit.py`: cuts the masters at the marks, speeds up long stretches with a visible badge,
   lays the narration and the same words as captions, and ducks the game sound under it.

The journal history in the video (days 12 to 15) was played in the emulator the same way
before the recorded day. Outputs go to `VIDEO_OUT` (default `video-out/`); `CHROME_EXE` and
`PIPER_VOICE` point at a Chromium build and the Piper voice file.
