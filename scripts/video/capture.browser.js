// Video capture helpers (dev page only), after the slice gate scripts.
window.cap = {
  hideOverlay() {
    let n = 0;
    for (const h of document.querySelectorAll('*')) {
      if (!h.shadowRoot) continue;
      for (const e of h.shadowRoot.querySelectorAll('div')) {
        const cs = getComputedStyle(e);
        if (cs.position === 'absolute' && (/59, 130, 246/.test(cs.boxShadow) || /Remote Control Active$/.test(e.textContent))) {
          e.style.setProperty('display', 'none', 'important'); n++;
        }
      }
    }
    return n;
  },
  /** Board frame [x, y, z] to world {x, y, z}. */
  bw(p) {
    const root = holdlineGate.board();
    const v = root.localToWorld(new root.position.constructor(...p));
    return { x: v.x, y: v.y, z: v.z };
  },
  pose: null,
  async cam(eye, target) {
    const r = holdlineGate.remote();
    await r.dispatch('set_transform', { device: 'headset', position: eye });
    await r.dispatch('look_at', { device: 'headset', target });
    this.pose = { eye, target };
  },
  /** Head pose in the board frame. */
  async bcam(eyeB, targetB) { return this.cam(this.bw(eyeB), this.bw(targetB)); },
  /** Smooth head move (ease in out) in the board frame over ms. */
  async bmove(eyeB, targetB, ms) {
    const from = this.pose;
    const to = { eye: this.bw(eyeB), target: this.bw(targetB) };
    const t0 = performance.now();
    const lerp = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
    for (;;) {
      const t = Math.min(1, (performance.now() - t0) / ms);
      const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      await this.cam(lerp(from.eye, to.eye, k), lerp(from.target, to.target, k));
      if (t >= 1) break;
      await new Promise((r) => requestAnimationFrame(r));
    }
  },
};
Object.assign(window.cap, {
  cursor() {
    if (document.getElementById('cap-cursor')) return;
    const c = document.createElement('div');
    c.id = 'cap-cursor';
    c.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24"><path d="M4 2.5l15 11.2-6.6.9 3.9 7.2-2.6 1.4-3.9-7.3L4 20.5z" fill="#1d1c1a" stroke="#f3f1ed" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    c.style.cssText = 'position:fixed;left:-60px;top:-60px;z-index:2147483647;pointer-events:none;transform:translate(-5px,-3px)';
    document.documentElement.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
  },
  hideCursor() { const c = document.getElementById('cap-cursor'); if (c) c.remove(); },
  /** After Enter: narrow view, hide the remote overlay (it appears with the session). */
  async xrLook() {
    IWER_DEVICE.fovy = (65 * Math.PI) / 180;
    this.hideCursor();
    for (let i = 0; i < 20; i++) { if (this.hideOverlay() >= 2) break; await new Promise((r) => setTimeout(r, 50)); }
  },
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  async hand(device, pB, targetB) {
    const r = holdlineGate.remote();
    await r.dispatch('set_transform', { device, position: this.bw(pB) });
    if (targetB) await r.dispatch('look_at', { device, target: this.bw(targetB) });
  },
  /** Smooth hand move in the board frame (position only), ms. */
  async handMove(device, fromB, toB, ms) {
    const t0 = performance.now();
    for (;;) {
      const t = Math.min(1, (performance.now() - t0) / ms);
      const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const p = fromB.map((a, i) => a + (toB[i] - a) * k);
      await holdlineGate.remote().dispatch('set_transform', { device, position: this.bw(p) });
      if (t >= 1) break;
      await new Promise((r) => requestAnimationFrame(r));
    }
  },
});
Object.assign(window.cap, {
  keepHidden() { if (!this._hid) this._hid = setInterval(() => this.hideOverlay(), 150); },
  async tapNear(device, cx, cy, restB) {
    const [x, z] = holdlineGate.cellXZ(cx, cy);
    const r = holdlineGate.remote();
    const from = this._hp?.[device] ?? restB;
    await this.handMove(device, from, [x, 0.06, z], 700);
    await this.handMove(device, [x, 0.06, z], [x, 0.02, z], 300);
    await r.dispatch('set_select_value', { device, value: 1 });
    await this.sleep(350);
    await r.dispatch('set_select_value', { device, value: 0 });
    await this.handMove(device, [x, 0.02, z], restB, 800);
    (this._hp ??= {})[device] = restB;
  },
  async drawNearSmooth(device, cells, ms, restB) {
    const pts = cells.map(([cx, cy]) => holdlineGate.cellXZ(cx, cy));
    const r = holdlineGate.remote();
    const lift = (i) => { const p = holdlineGate.boardPoint(pts[i][0], pts[i][1], 0.0); return p; };
    const from = this._hp?.[device] ?? restB;
    const a = [pts[0][0], 0.02, pts[0][1]];
    await this.handMove(device, from, [a[0], 0.06, a[2]], 700);
    await this.handMove(device, [a[0], 0.06, a[2]], a, 300);
    await r.dispatch('set_select_value', { device, value: 1 });
    await this.sleep(300);
    const per = ms / (pts.length - 1);
    for (let i = 1; i < pts.length; i++) await this.handMove(device, [pts[i - 1][0], 0.02, pts[i - 1][1]], [pts[i][0], 0.02, pts[i][1]], per);
    await r.dispatch('set_select_value', { device, value: 0 });
    await this.sleep(200);
    const e = pts[pts.length - 1];
    await this.handMove(device, [e[0], 0.02, e[1]], restB, 800);
    (this._hp ??= {})[device] = restB;
  },
});
window.shots = {
  async opening() {
    const g = holdlineGate, r = g.remote();
    await cap.xrLook(); cap.keepHidden();
    await r.dispatch('set_input_mode', { mode: 'hand' });
    await cap.cam({ x: 0.05, y: 1.32, z: -0.95 }, { x: 0, y: 0.76, z: -1.9 });
    await g.waitFor((s) => s.placement.startsWith('candidate') || s.placement.startsWith('placed'), 20000);
    cap.mark('candidate');
    await cap.sleep(1500);
    // Right hand comes up and pinches toward the outline (far ray).
    const b = window.__holdlineDebug.worldPos('Board');
    const head = cap.pose.eye;
    await r.dispatch('set_transform', { device: 'hand-right', position: { x: head.x + 0.16, y: head.y - 0.3, z: head.z - 0.3 } });
    await r.dispatch('look_at', { device: 'hand-right', target: { x: b[0], y: b[1] + 0.02, z: b[2] } });
    await cap.sleep(1200);
    await r.dispatch('select', { device: 'hand-right', duration: 0.4 });
    await g.waitFor((s) => s.placement.startsWith('placed'), 10000);
    cap.mark('placed');
    await r.dispatch('set_transform', { device: 'hand-right', position: { x: head.x + 0.3, y: head.y - 0.7, z: head.z + 0.2 } });
    await cap.sleep(1500);
    await cap.bmove([0, 0.42, 0.42], [0, 0, -0.03], 3000);
    return g.status();
  },
  async day0() {
    const g = holdlineGate;
    const restR = [0.36, -0.12, 0.34], restL = [-0.36, -0.12, 0.34];
    cap._hw = {}; await cap.rest('hand-right', restR, 0); await cap.rest('hand-left', restL, 0);
    const beats = [['wind', 14, 64, [-0.12, 0.34, 0.36], [-0.12, 0, 0.05]], ['slope', 24, 42, [-0.14, 0.33, 0.33], [-0.14, 0, -0.02]], ['breaks', 50, 20, [-0.04, 0.33, 0.3], [-0.04, 0, -0.06]]];
    const marks = {};
    for (const [beat, cx, cy, eye, tgt] of beats) {
      await g.waitFor((s) => s.day0 === `${beat}:prompt` && s.ghost, 300000);
      marks[beat] = g.status().playSeconds; cap.mark(beat);
      const mv = cap.bmove(eye, tgt, 2200);
      await cap.sleep(1800);
      await mv;
      await cap.tapNear('hand-left', cx, cy, restL);
    }
    await g.waitFor((s) => s.day0 === 'line:prompt' && s.ghost, 300000);
    marks.line = g.status().playSeconds; cap.mark('linePrompt');
    await cap.bmove([0.16, 0.33, 0.34], [0.16, 0, 0.02], 2200);
    await cap.sleep(3500);
    await cap.drawNearSmooth('hand-right', [[106, 58], [109, 58], [112, 58], [115, 58], [117, 58]], 2600, restR);
    marks.lines = g.status().lines; cap.mark('lineDrawn');
    await g.waitFor((s) => s.strip === 'Contained' || s.strip === 'Time ran out', 600000);
    marks.end = g.status().strip; marks.endS = g.status().playSeconds; cap.mark('contained');
    await cap.sleep(3000);
    return marks;
  },
};
Object.assign(window.cap, {
  _hw: {},
  /** Smooth hand move in world coordinates. */
  async handMoveW(device, from, to, ms) {
    const t0 = performance.now();
    for (;;) {
      const t = Math.min(1, (performance.now() - t0) / ms);
      const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      await holdlineGate.remote().dispatch('set_transform', { device, position: { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: from.z + (to.z - from.z) * k } });
      if (t >= 1) break;
      await new Promise((r) => requestAnimationFrame(r));
    }
    this._hw[device] = to;
  },
  cellW(cx, cy, lift) { const g = holdlineGate; return g.boardPoint(...g.cellXZ(cx, cy), lift); },
  async rest(device, restB, ms = 800) {
    const to = this.bw(restB);
    if (this._hw[device] && ms) await this.handMoveW(device, this._hw[device], to, ms);
    else { await holdlineGate.remote().dispatch('set_transform', { device, position: to }); this._hw[device] = to; }
  },
  async tapNear(device, cx, cy, restB) {
    const r = holdlineGate.remote();
    if (!this._hw[device]) await this.rest(device, restB, 0);
    await this.handMoveW(device, this._hw[device], this.cellW(cx, cy, 0.08), 700);
    await this.handMoveW(device, this._hw[device], this.cellW(cx, cy, 0.03), 300);
    await r.dispatch('set_select_value', { device, value: 1 });
    await this.sleep(350);
    await r.dispatch('set_select_value', { device, value: 0 });
    await this.sleep(150);
    await this.rest(device, restB, 800);
  },
  async drawNearSmooth(device, cells, ms, restB) {
    const r = holdlineGate.remote();
    if (!this._hw[device]) await this.rest(device, restB, 0);
    const pts = cells.map(([cx, cy]) => this.cellW(cx, cy, 0.03));
    await this.handMoveW(device, this._hw[device], this.cellW(cells[0][0], cells[0][1], 0.08), 700);
    await this.handMoveW(device, this._hw[device], pts[0], 300);
    await r.dispatch('set_select_value', { device, value: 1 });
    await this.sleep(300);
    const per = ms / (pts.length - 1);
    for (let i = 1; i < pts.length; i++) await this.handMoveW(device, pts[i - 1], pts[i], per);
    await this.sleep(150);
    await r.dispatch('set_select_value', { device, value: 0 });
    await this.sleep(200);
    await this.rest(device, restB, 800);
  },
  /** Far stroke by hand ray: aim, pinch, sweep, release. */
  async drawFarSmooth(device, cells, ms, handW) {
    const r = holdlineGate.remote();
    const pts = cells.map(([cx, cy]) => this.cellW(cx, cy, 0));
    if (handW) await r.dispatch('set_transform', { device, position: handW });
    await r.dispatch('look_at', { device, target: pts[0] });
    await this.sleep(500);
    await r.dispatch('set_select_value', { device, value: 1 });
    await this.sleep(300);
    const per = ms / (pts.length - 1);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i]; const t0 = performance.now();
      for (;;) {
        const t = Math.min(1, (performance.now() - t0) / per);
        await r.dispatch('look_at', { device, target: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t } });
        if (t >= 1) break;
        await new Promise((res) => requestAnimationFrame(res));
      }
    }
    await this.sleep(150);
    await r.dispatch('set_select_value', { device, value: 0 });
  },
});
Object.assign(window.cap, {
  async pressFar(name, ok, device = 'hand-right') {
    const g = holdlineGate, r = g.remote();
    const c = g.centerOf(name);
    await r.dispatch('look_at', { device, target: c });
    await this.sleep(450);
    await r.dispatch('select', { device, duration: 0.3 });
    await this.sleep(500);
    if (ok && !ok(g.status())) { g.click(name); await this.sleep(300); return 'fallback'; }
    return 'ray';
  },
});
Object.assign(window.shots, {
  async daily() {
    const g = holdlineGate, r = g.remote();
    const restL = [-0.36, -0.12, 0.34];
    const m = {};
    await cap.bcam([0, 0.36, 0.5], [0, 0.12, -0.14]);
    await g.waitFor((s) => s.phase === 'plan', 60000);
    cap.mark('plan');
    await cap.sleep(1500);
    await cap.bmove([0.04, 0.4, 0.42], [0.04, 0, -0.02], 2200);
    cap.mark('far');
    await cap.drawFarSmooth('hand-right', [[64, 40], [72, 46], [80, 52], [88, 58]], 2200);
    await cap.sleep(900);
    cap.mark('near');
    await cap.drawNearSmooth('hand-left', [[88, 58], [94, 62], [100, 66]], 1800, restL);
    m.plan = { lines: g.status().lines, budget: g.status().budgetLeft };
    await cap.sleep(800);
    await cap.bmove([0.02, 0.36, 0.46], [0.02, 0.08, -0.1], 1400);
    cap.mark('start');
    m.start = await cap.pressFar('btn-start', (s) => s.phase === 'live');
    await g.waitFor((s) => s.phase === 'live');
    await cap.bmove([0.02, 0.3, 0.3], [0.02, 0, 0], 2000);
    await cap.sleep(14000);
    // Backburn: arm it, then pinch and hold on the dug line.
    await cap.bmove([0.0, 0.34, 0.36], [0.0, 0.02, 0.02], 1200);
    cap.mark('backburn');
    m.bbArm = await cap.pressFar('btn-backburn', (s) => s.tool === 'backburn');
    await cap.bmove([-0.04, 0.26, 0.26], [-0.04, 0, -0.01], 1400);
    const bb = cap.cellW(66, 41, 0.03);
    await cap.handMoveW('hand-left', cap._hw['hand-left'] ?? cap.bw(restL), cap.cellW(66, 41, 0.08), 700);
    await cap.handMoveW('hand-left', cap._hw['hand-left'], bb, 300);
    const in0 = g.status().inputs;
    await r.dispatch('set_select_value', { device: 'hand-left', value: 1 });
    await cap.sleep(1900);
    await r.dispatch('set_select_value', { device: 'hand-left', value: 0 });
    m.backburn = g.status().inputs - in0;
    await cap.rest('hand-left', restL, 800);
    await cap.sleep(5000);
    // Water drop by hand ray.
    await cap.bmove([0.04, 0.38, 0.42], [0.04, 0.02, -0.04], 1400);
    cap.mark('water');
    m.waterArm = await cap.pressFar('btn-water', (s) => s.tool === 'water');
    const w0 = g.status().inputs;
    await cap.drawFarSmooth('hand-right', [[74, 38], [84, 31]], 900);
    m.water = g.status().inputs - w0;
    await cap.sleep(400);
    m.aircraft = g.status().aircraft;
    await g.waitFor((s) => !s.aircraft, 30000).catch(() => null);
    await cap.sleep(3000);
    cap.mark('smoke');
    await cap.bmove([0.05, 0.3, 0.5], [0.0, 0.55, -0.15], 2600);
    await cap.sleep(3500);
    await cap.bmove([0.02, 0.34, 0.38], [0.02, 0, -0.02], 2600);
    m.live = { burning: g.status().burning, caption: g.status().caption, haze: g.status().haze, stats: window.__holdlineDebug.stats() };
    await g.waitFor((s) => s.phase === 'outcome', 900000);
    m.outcome = g.status().outcome; m.baseline = g.status().baseline; cap.mark('outcome');
    await cap.sleep(1500);
    await cap.bmove([0, 0.3, 0.46], [0, 0.17, -0.2], 2200);
    await cap.sleep(5000);
    cap.mark('replay');
    m.replay = await cap.pressFar('btn-replay', (s) => s.phase === 'timelapse');
    await cap.bmove([0, 0.4, 0.4], [0, 0, -0.03], 1500);
    await g.waitFor((s) => s.phase === 'outcome', 60000);
    await cap.sleep(1500);
    cap.mark('journal');
    await cap.bmove([-0.2, 0.3, 0.36], [-0.38, 0.2, -0.02], 2600);
    await cap.sleep(4500);
    m.journal = { streak: g.status().streak };
    m.errors = window.__holdlineDebug.errors();
    return m;
  },
});
Object.assign(window.cap, {
  /** Turn the head smoothly toward a world target, eye fixed. */
  async lookTo(target, ms) {
    const from = this.pose;
    const t0 = performance.now();
    for (;;) {
      const t = Math.min(1, (performance.now() - t0) / ms);
      const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      await this.cam(from.eye, { x: from.target.x + (target.x - from.target.x) * k, y: from.target.y + (target.y - from.target.y) * k, z: from.target.z + (target.z - from.target.z) * k });
      if (t >= 1) break;
      await new Promise((r) => requestAnimationFrame(r));
    }
  },
});
Object.assign(window.shots, {
  async access() {
    const g = holdlineGate;
    const m = {};
    await cap.bmove([0.1, 0.34, 0.46], [0.1, 0.06, -0.02], 1500);
    m.pause = await cap.pressFar('btn-pause', (s) => s.paused);
    await cap.sleep(1200);
    m.settings = await cap.pressFar('btn-settings', () => !!g.centerOf('SettingsPanel') && g.board().parent && true);
    await cap.sleep(600);
    const sp = g.centerOf('SettingsPanel');
    await cap.lookTo(sp, 1500);
    await cap.sleep(1200);
    m.contrast = await cap.pressFar('set-high-contrast', null);
    await cap.sleep(1500);
    m.dwellOn = await cap.pressFar('set-dwell-select', null);
    await cap.sleep(1200);
    // Dwell only from here: the head rests on Close, then on Resume.
    await holdlineGate.remote().dispatch('set_transform', { device: 'hand-right', position: cap.bw([0.4, -0.2, 0.4]) });
    await cap.lookTo(g.centerOf('set-close'), 900);
    await cap.sleep(2600);
    m.closeAction = g.status().pointerAction;
    await cap.sleep(600);
    const rs = g.centerOf('btn-resume');
    if (rs) { await cap.lookTo(rs, 900); await cap.sleep(2600); }
    m.paused = g.status().paused;
    await cap.bmove([0.0, 0.4, 0.42], [0.0, 0, -0.02], 1800);
    await cap.sleep(4000);
    m.errors = window.__holdlineDebug.errors();
    return m;
  },
});
Object.assign(window.shots, {
  async access() {
    const g = holdlineGate, r = g.remote();
    const m = {};
    await cap.bmove([0.1, 0.34, 0.46], [0.1, 0.06, -0.02], 1500);
    m.pause = await cap.pressFar('btn-pause', (s) => s.paused);
    await cap.sleep(1200);
    m.settings = await cap.pressFar('btn-settings', null);
    await cap.sleep(500);
    const sp = g.centerOf('SettingsPanel');
    const eye = { x: sp.x + 0.02, y: sp.y - 0.08, z: sp.z + 0.55 };
    { const from = cap.pose; const t0 = performance.now(); for (;;) { const t = Math.min(1, (performance.now() - t0) / 1800); const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; const L = (a, b) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k }); await cap.cam(L(from.eye, eye), L(from.target, sp)); if (t >= 1) break; await new Promise((q) => requestAnimationFrame(q)); } }
    await cap.sleep(1000);
    m.contrast = await cap.pressFar('set-high-contrast', null);
    await cap.sleep(1400);
    m.dwellOn = await cap.pressFar('set-dwell-select', null);
    await cap.sleep(1000);
    await r.dispatch('set_transform', { device: 'hand-right', position: cap.bw([0.5, -0.3, 0.5]) });
    await cap.lookTo(g.centerOf('set-close'), 900);
    await g.waitFor((s) => /set-close/.test(s.pointerAction), 8000).catch(() => null);
    m.closeAction = g.status().pointerAction;
    const rs = g.centerOf('btn-resume');
    await cap.lookTo(rs, 700);
    await g.waitFor((s) => !s.paused, 8000).catch(() => null);
    m.resumed = !g.status().paused;
    await cap.sleep(400);
    await cap.bmove([0.0, 0.4, 0.42], [0.0, 0, -0.02], 1800);
    await cap.sleep(4000);
    m.errors = window.__holdlineDebug.errors();
    return m;
  },
});
Object.assign(window.cap, {
  /** Hide the emulator's own interface (toolbar, device panels, remote badge); XR canvases stay. */
  hideOverlay() {
    let n = 0;
    for (const h of document.querySelectorAll('*')) {
      if (h.shadowRoot && !h.shadowRoot.querySelector('canvas')) { h.style.setProperty('display', 'none', 'important'); n++; }
    }
    return n;
  },
});
cap.keepHidden();
window.__marks = [];
cap.mark = (n) => { window.__marks.push({ n, t: Date.now() / 1000 }); };
