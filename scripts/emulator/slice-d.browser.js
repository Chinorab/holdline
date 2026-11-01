// Slice d gate helpers, after slice-a, b and c.browser.js. The date is injected with
// localStorage holdline.dev.today (development builds only) and the page reloaded.
//
//   holdlineGate.setToday('2026-11-03')   // then reload, enter, place
//   await holdlineGate.playDaily()        // start, sample sound and captions, skip to the end
//   holdlineGate.journalState()

Object.assign(window.holdlineGate, {
  setToday(dayId) {
    localStorage.setItem('holdline.dev.today', dayId);
  },
  /** Seed progress so Day 0 is skipped and every tool is unlocked. */
  seedReturning() {
    const p = { version: 1, firstDay: null, completedFires: 2, introsShown: { water: true, backburn: true }, day0Done: true, anchorHandle: null };
    localStorage.setItem('holdline.v1.progress', JSON.stringify(p));
  },
  journalState() {
    const s = this.status();
    return { today: s.today, kind: s.kind, streak: s.streak, journal: s.journal };
  },
  /** From the brief or plan: start, let it burn, read sound, captions and haze, then end. */
  async playDaily(snapPrefix = '') {
    await this.waitFor((s) => s.phase === 'plan' || s.phase === 'brief', 60000);
    await this.waitFor((s) => s.phase === 'plan', 60000);
    const out = { dayId: this.status().dayId, kind: this.status().kind };
    this.click('btn-start');
    await this.waitFor((s) => s.phase === 'live');
    await this.waitFor((s) => s.burning > 40, 120000);
    const live = this.status();
    out.live = { audio: live.audio, levels: live.levels, caption: live.caption, haze: live.haze, ceiling: live.ceiling, burning: live.burning };
    out.stats = window.__holdlineDebug.stats();
    if (snapPrefix) out.snapLive = await this.snap(`${snapPrefix}-live.jpg`, [0.1, 0.25, 0.42], [0.1, 0.03, 0.12]);
    window.__holdlineDebug.skipToEnd();
    await this.waitFor((s) => s.phase === 'outcome', 120000);
    await this.sleep(2500);
    const done = this.status();
    out.after = { haze: done.haze, caption: done.caption, ...this.journalState() };
    if (snapPrefix) out.snapJournal = await this.snap(`${snapPrefix}-journal.jpg`, [-0.2, 0.3, 0.35], [-0.38, 0.22, -0.02]);
    return out;
  },
});
