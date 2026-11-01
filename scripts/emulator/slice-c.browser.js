// Slice c gate helpers, after slice-a and slice-b.browser.js (they extend window.holdlineGate).
// Day 0 from fresh storage, the water drop by ray (and by gaze on the Glasses profile), the
// backburn hold, and inspect by resting a ray.
//
//   await holdlineGate.day0('controller-right')     // fresh storage; times entry to Contained
//   await holdlineGate.waterDrop('hand-right')       // needs the water drop unlocked
//   await holdlineGate.backburnHold('controller-right')
//   await holdlineGate.inspectRest('controller-right')

Object.assign(window.holdlineGate, {
  /** Board local [x, z] of a cell center. */
  cellXZ(cx, cy) {
    return [((cx + 0.5) / 128 - 0.5) * 0.56, ((cy + 0.5) / 80 - 0.5) * 0.35];
  },
  async tapCell(device, cx, cy, frameMs = 900) {
    const r = this.remote();
    const [x, z] = this.cellXZ(cx, cy);
    await r.dispatch('look_at', { device, target: this.boardPoint(x, z) });
    await this.sleep(frameMs * 2);
    await r.dispatch('set_select_value', { device, value: 1 });
    await this.sleep(frameMs);
    await r.dispatch('set_select_value', { device, value: 0 });
    await this.sleep(frameMs);
  },
  /** Fresh Day 0: pinch to light three beats, draw the guided line, wait for Contained. */
  async day0(device, frameMs = 900) {
    const t0 = performance.now();
    const marks = {};
    await this.placeAtDesk();
    const beats = [
      ['wind', 14, 64],
      ['slope', 24, 42],
      ['breaks', 50, 20],
    ];
    // The emulator runs far below real time: wait generously, by game state, not by clock.
    for (const [beat, cx, cy] of beats) {
      await this.waitFor((s) => s.day0 === `${beat}:prompt` && s.ghost, 600000);
      marks[`${beat}Prompt`] = this.status().playSeconds;
      await this.tapCell(device, cx, cy, frameMs);
      marks[`${beat}Started`] = this.status().day0;
      if (beat === 'wind') {
        await this.sleep(6000);
        marks.snapWind = await this.snap('01-day0-wind.jpg', [-0.15, 0.32, 0.38], [-0.15, 0.02, 0.05]);
      }
    }
    await this.waitFor((s) => s.day0 === 'line:prompt' && s.ghost, 600000);
    marks.linePrompt = this.status().playSeconds;
    marks.snapGuide = await this.snap('02-day0-guide.jpg', [0.2, 0.3, 0.38], [0.2, 0.02, 0.05]);
    const guide = [[106, 58], [109, 58], [112, 58], [115, 58], [117, 58]].map(([cx, cy]) => this.cellXZ(cx, cy));
    await this.drawFar(device, guide, frameMs);
    marks.lineDrawn = { lines: this.status().lines, day0: this.status().day0 };
    await this.waitFor((s) => s.strip === 'Contained' || s.strip === 'Time ran out', 900000);
    marks.contained = this.status().strip;
    marks.containedAtS = Math.round((performance.now() - t0) / 1000);
    marks.containedPlayS = this.status().playSeconds;
    marks.snapContained = await this.snap('03-day0-contained.jpg', [0.2, 0.3, 0.38], [0.2, 0.02, 0.05]);
    await this.waitFor((s) => s.phase === 'brief' || s.phase === 'plan', 120000);
    const s = this.status();
    marks.after = { phase: s.phase, completedFires: s.completedFires, tools: s.tools, dayId: s.dayId };
    return marks;
  },
  /** Water drop: pinch on a spot, drag across, release; the aircraft crosses, the strip wets. */
  async waterDrop(device, from, to, frameMs = 900) {
    const before = this.status();
    await this.drawFar(device, [from, to], frameMs);
    const flying = this.status().aircraft;
    await this.waitFor((s) => !s.aircraft, 20000);
    const after = this.status();
    return { before: { tool: before.tool, cooldown: before.waterCooldown }, flying, inputs: after.inputs - before.inputs, cooldown: after.waterCooldown };
  },
  /** Backburn: pinch and hold 1.5 s on a dug line cell. */
  async backburnHold(device, cx, cy, frameMs = 900) {
    const r = this.remote();
    const [x, z] = this.cellXZ(cx, cy);
    const before = this.status();
    await r.dispatch('look_at', { device, target: this.boardPoint(x, z) });
    await this.sleep(frameMs * 2);
    await r.dispatch('set_select_value', { device, value: 1 });
    await this.sleep(Math.max(2500, frameMs * 3));
    await r.dispatch('set_select_value', { device, value: 0 });
    await this.sleep(frameMs * 2);
    const after = this.status();
    return { inputs: after.inputs - before.inputs, strip: after.strip, burning: after.burning };
  },
  /** Inspect: rest the ray on one spot. */
  async inspectRest(device, cx, cy, frameMs = 900) {
    const r = this.remote();
    const [x, z] = this.cellXZ(cx, cy);
    await r.dispatch('look_at', { device, target: this.boardPoint(x, z) });
    await this.sleep(Math.max(3000, frameMs * 4));
    return this.status().inspect;
  },
});
