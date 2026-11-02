// Slice e gate helpers, after slice-a to d.browser.js: settings, dwell select (head ray, no
// pinch), head pointer with a pinch, and the Meta VR Glasses fit check (angles of every
// essential element from the eyes while looking at the board).
//
//   holdlineGate.seedSettings({ dwellSelect: true })   // then reload
//   await holdlineGate.dwellOn(worldPoint, seconds)
//   holdlineGate.fit()

Object.assign(window.holdlineGate, {
  seedSettings(change) {
    const key = 'holdline.v1.settings';
    const base = JSON.parse(localStorage.getItem(key) ?? 'null') ?? {
      version: 1, highContrast: false, oneHand: false, glassesView: false, slowerFire: false, sound: true,
      captions: true, dwellSelect: false, headPointer: false, boardWidthCm: 56, boardHeightCm: 0,
    };
    localStorage.setItem(key, JSON.stringify({ ...base, ...change }));
  },
  /** World center of a named object (a panel element after poll names it). */
  centerOf(name) {
    const o = window.__holdlineDebug.world.scene.getObjectByName(name);
    if (!o) return null;
    o.updateWorldMatrix(true, true);
    const box = new (o.position.constructor)();
    // Element meshes: use the world position of the object.
    o.getWorldPosition(box);
    return { x: box.x, y: box.y, z: box.z };
  },
  /** Aim the head (dwell / head pointer ray) at a world point. */
  async look(target, ms = 600) {
    await this.remote().dispatch('look_at', { device: 'headset', target });
    await this.sleep(ms);
  },
  async dwellOn(target, seconds = 2.5) {
    await this.look(target, seconds * 1000);
    return { pointer: this.status().pointer, action: this.status().pointerAction };
  },
  /**
   * Angles of each essential element's corners from the eyes, in degrees: x right, y up,
   * relative to the view direction. Inside the glasses means x in [-37, 37], y in [-43, 25].
   */
  fit() {
    const w = window.__holdlineDebug.world;
    const head = w.player.head;
    head.updateWorldMatrix(true, false);
    const V = head.position.constructor;
    const inv = head.matrixWorld.clone().invert();
    const angles = (p) => {
      const v = new V(p.x, p.y, p.z).applyMatrix4(inv);
      return { x: (Math.atan2(v.x, -v.z) * 180) / Math.PI, y: (Math.atan2(v.y, Math.hypot(v.x, v.z)) * 180) / Math.PI };
    };
    const rows = [];
    const check = (name, corners) => {
      const a = corners.map(angles);
      const xs = a.map((c) => c.x);
      const ys = a.map((c) => c.y);
      const box = { left: Math.min(...xs), right: Math.max(...xs), down: Math.min(...ys), up: Math.max(...ys) };
      rows.push({ name, ...Object.fromEntries(Object.entries(box).map(([k, v]) => [k, Math.round(v)])), inside: box.left >= -37 && box.right <= 37 && box.down >= -43 && box.up <= 25 });
    };
    const board = w.scene.getObjectByName('Board');
    board.updateWorldMatrix(true, false);
    const bw = 0.28;
    const bd = 0.175;
    check('Board', [[-bw, 0, -bd], [bw, 0, -bd], [bw, 0, bd], [-bw, 0, bd]].map(([x, y, z]) => new V(x, y, z).applyMatrix4(board.matrixWorld)));
    const panels = { Toolbar: [0.225, 0.077], InstructionStrip: [0.16, 0.03], Captions: [0.16, 0.022], BriefingPanel: [0.4, 0.25], ResultPanel: [0.4, 0.25], PausePanel: [0.32, 0.198], SettingsPanel: [0.34, 0.3], JournalPanel: [0.2, 0.18] };
    for (const [name, [pw, ph]] of Object.entries(panels)) {
      const o = w.scene.getObjectByName(name);
      if (!o) continue;
      o.updateWorldMatrix(true, false);
      check(name, [[-pw / 2, -ph / 2, 0], [pw / 2, -ph / 2, 0], [pw / 2, ph / 2, 0], [-pw / 2, ph / 2, 0]].map(([x, y, z]) => new V(x, y, z).applyMatrix4(o.matrixWorld)));
    }
    return rows;
  },
});

/** Dwell only, no pinch: place (or restore), Start, arm Dig line, draw a line, Pause, Resume. */
window.holdlineGate.dwellGate = async function dwellGate() {
  const g = this;
  const r = g.remote();
  const out = {};
  await r.dispatch('set_transform', { device: 'headset', position: { x: 0, y: 1.22, z: -1.25 } });
  await r.dispatch('look_at', { device: 'headset', target: { x: 0, y: 0.73, z: -1.85 } });
  await g.waitFor((s) => s.placement.startsWith('candidate') || s.placement.startsWith('placed'), 40000);
  if (g.status().placement.startsWith('candidate')) {
    const b = window.__holdlineDebug.worldPos('Board');
    await g.dwellOn({ x: b[0], y: b[1] + 0.02, z: b[2] }, 4);
  }
  await g.waitFor((s) => s.placement.startsWith('placed'), 30000);
  out.placement = g.status().placement;
  await g.waitFor((s) => s.phase === 'plan', 60000);
  out.start = await g.dwellOn(g.centerOf('btn-start'), 5);
  await g.waitFor((s) => s.phase === 'live', 20000);
  out.arm = await g.dwellOn(g.centerOf('btn-dig'), 3.5);
  const pts = [[30, 50], [36, 50], [42, 50], [48, 50], [54, 50]].map(([x, y]) => g.boardPoint(...g.cellXZ(x, y)));
  out.begin = await g.dwellOn(pts[0], 3);
  for (const p of pts.slice(1)) await g.look(p, 1500);
  out.end = await g.dwellOn(pts[pts.length - 1], 4);
  await g.sleep(1500);
  const s = g.status();
  out.line = { lines: s.lines, lastStroke: s.lastStroke, inputs: s.inputs };
  out.pause = await g.dwellOn(g.centerOf('btn-pause'), 4);
  out.paused = g.status().paused;
  out.resume = await g.dwellOn(g.centerOf('btn-resume'), 4);
  out.resumed = !g.status().paused;
  out.errors = window.__holdlineDebug.errors();
  return out;
};
