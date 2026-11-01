// Slice a gate, run in the dev page (http://localhost:8081 with HOLDLINE_HTTP=1) from the
// browser console or an automation tool, after pressing "Enter mixed reality".
// It drives IWER through its remote control, the same actions the IWSDK CLI sends, and
// reads the game through window.holdline (status) and window.__holdlineDebug (dev only).
//
//   await holdlineGate.placeAtDesk()   // home_office: sit at the desk, pinch the board
//   await holdlineGate.fullLoop()      // start, pause, resume, end, result, time lapse
//   holdlineGate.report()              // stats and errors of this page load

window.holdlineGate = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  remote: () => window.IWER_DEVICE.remote,
  status: () => window.holdline.value,
  click(name) {
    const el = window.__holdlineDebug.world.scene.getObjectByName(name);
    if (!el) throw new Error(`no element ${name}`);
    el.dispatchEvent({ type: 'click' });
  },
  async waitFor(pred, timeoutMs = 30000) {
    const start = performance.now();
    while (!pred(this.status())) {
      if (performance.now() - start > timeoutMs) throw new Error(`timeout in ${this.status().phase}`);
      await this.sleep(300);
    }
    return this.status();
  },
  async placeAtDesk() {
    const r = this.remote();
    await r.dispatch('set_transform', { device: 'headset', position: { x: 0, y: 1.22, z: -1.25 } });
    await r.dispatch('look_at', { device: 'headset', target: { x: 0, y: 0.73, z: -1.85 } });
    await this.waitFor((s) => s.placement.startsWith('candidate') || s.placement.startsWith('placed'));
    if (this.status().placement.startsWith('candidate')) {
      const b = window.__holdlineDebug.worldPos('Board');
      await r.dispatch('look_at', { device: 'controller-right', target: { x: b[0], y: b[1] + 0.03, z: b[2] } });
      await this.sleep(1800);
      await r.dispatch('select', { device: 'controller-right', duration: 0.45 });
    }
    return this.waitFor((s) => s.placement.startsWith('placed'));
  },
  async fullLoop() {
    await this.waitFor((s) => s.phase === 'plan' || s.phase === 'brief');
    this.click('btn-start');
    await this.waitFor((s) => s.phase === 'live');
    await this.sleep(8000);
    this.click('btn-pause');
    const held = this.status().tick;
    await this.sleep(3000);
    const stillHeld = this.status().tick === held;
    this.click('btn-resume');
    window.__holdlineDebug.skipToEnd();
    const outcome = await this.waitFor((s) => s.phase === 'outcome', 60000);
    this.click('btn-replay');
    await this.waitFor((s) => s.phase === 'timelapse');
    await this.waitFor((s) => s.phase === 'outcome', 30000);
    return { pauseHeldTick: stillHeld, player: outcome.outcome.player, baseline: outcome.baseline };
  },
  report() {
    return { stats: window.__holdlineDebug.stats(), errors: window.__holdlineDebug.errors() };
  },
};
