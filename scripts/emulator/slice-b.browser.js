// Slice b gate, run in the dev page after slice-a.browser.js (it extends window.holdlineGate).
// Draws real strokes through IWER's remote control: a far line with a ray (select held while
// the ray sweeps the terrain) and a near line with a tracked hand (pinch held while the hand
// moves just above the board).
//
//   await holdlineGate.placeAtDesk()
//   await holdlineGate.toPlan()
//   await holdlineGate.drawFar('controller-right', [[-0.1, 0.05], [0.05, 0.05]])
//   await holdlineGate.drawNear('hand-left', [[-0.15, -0.05], [-0.05, -0.05]])
//
// Board points are [x, z] in meters in the board's frame (x right, z toward the player).

Object.assign(window.holdlineGate, {
  board() {
    const root = window.__holdlineDebug.world.scene.getObjectByName('Board');
    root.updateWorldMatrix(true, false);
    return root;
  },
  /** World point on the terrain (or `lift` meters above it) at board [x, z]. */
  boardPoint(x, z, lift = 0) {
    const root = this.board();
    const terrain = root.getObjectByName('Terrain');
    const v = new root.position.constructor(x, 0.2, z);
    root.localToWorld(v);
    const down = new root.position.constructor(0, -1, 0);
    const caster = new (window.__holdlineDebug.Raycaster)(v, down);
    const hit = caster.intersectObject(terrain, false)[0];
    const p = hit ? hit.point : root.localToWorld(new root.position.constructor(x, 0.02, z));
    return { x: p.x, y: p.y + lift, z: p.z };
  },
  async toPlan() {
    await this.waitFor((s) => s.phase === 'plan', 30000);
    return this.status();
  },
  async drawFar(device, points, frameMs = 900) {
    const r = this.remote();
    const pts = points.map(([x, z]) => this.boardPoint(x, z));
    await r.dispatch('look_at', { device, target: pts[0] });
    await this.sleep(frameMs * 2);
    await r.dispatch('set_select_value', { device, value: 1 });
    await this.sleep(frameMs);
    for (const p of pts.slice(1)) {
      await r.dispatch('look_at', { device, target: p });
      await this.sleep(frameMs);
    }
    await r.dispatch('set_select_value', { device, value: 0 });
    await this.sleep(frameMs * 2);
    return this.status();
  },
  async drawNear(device, points, frameMs = 900) {
    const r = this.remote();
    const pts = points.map(([x, z]) => this.boardPoint(x, z, 0.03));
    await r.dispatch('set_transform', { device, position: pts[0] });
    await this.sleep(frameMs * 2);
    await r.dispatch('set_select_value', { device, value: 1 });
    await this.sleep(frameMs * 2);
    for (const p of pts.slice(1)) {
      await r.dispatch('set_transform', { device, position: p });
      await this.sleep(frameMs);
    }
    await r.dispatch('set_select_value', { device, value: 0 });
    await this.sleep(frameMs * 2);
    return this.status();
  },
});

// Development stills: render the board from a seated eye point and save the JPEG through a
// local receiver (POST http://127.0.0.1:8790/save?name=...), started by hand for the gate.
window.holdlineGate.snap = async function snap(name, eyeBoard = [0, 0.42, 0.42], targetBoard = [0, 0, -0.02]) {
  const root = this.board();
  const eye = root.localToWorld(new root.position.constructor(...eyeBoard)).toArray();
  const target = root.localToWorld(new root.position.constructor(...targetBoard)).toArray();
  const blob = await window.__holdlineDebug.snapshot(eye, target);
  const res = await fetch(`http://127.0.0.1:8790/save?name=${name}`, { method: 'POST', body: blob });
  return res.status;
};

/**
 * The whole slice b gate in one page load, from a fresh run (call after entering XR):
 * far line by the right controller ray in the plan phase, near line by the left hand pinch
 * while live, outcome against a replay of the recorded inputs, time lapse, stats.
 */
window.holdlineGate.sliceB = async function sliceB() {
  const g = this;
  const r = g.remote();
  const out = {};
  await g.placeAtDesk();
  await g.toPlan();
  await r.dispatch('set_input_mode', { mode: 'controller' });
  await g.sleep(2500);
  const far = await g.drawFar('controller-right', [[-0.05, -0.1], [0.02, -0.06], [0.09, -0.02], [0.16, 0.02]]);
  out.far = { lines: far.lines, kind: far.lastStroke, budget: far.budgetLeft };
  out.snapPlan = await g.snap('03-plan-far-line.jpg');
  out.snapToolbar = await g.snap('08-toolbar.jpg', [0.15, 0.2, 0.42], [0.15, 0.03, 0.2]);
  g.click('btn-start');
  await g.waitFor((s) => s.phase === 'live');
  g.click('btn-pause');
  await r.dispatch('set_input_mode', { mode: 'hand' });
  await g.sleep(2500);
  g.click('btn-resume');
  const near = await g.drawNear('hand-left', [[-0.2, 0.09], [-0.17, 0.09], [-0.14, 0.09], [-0.11, 0.09]]);
  out.near = { lines: near.lines, kind: near.lastStroke, budget: near.budgetLeft };
  await g.sleep(9000);
  // Stats of the last XR frame (both eyes); read before any still, which renders once more.
  out.stats = window.__holdlineDebug.stats();
  out.snapLive = await g.snap('04-live-crews.jpg');
  out.snapClose = await g.snap('05-live-close.jpg', [-0.05, 0.22, 0.2], [-0.02, 0.04, -0.03]);
  const run = JSON.parse(localStorage.getItem('holdline.v1.run'));
  window.__holdlineDebug.skipToEnd();
  const done = await g.waitFor((s) => s.phase === 'outcome', 90000);
  out.outcome = done.outcome;
  out.dugCells = done.dugCells;
  // Replay the recorded inputs with the same code the worker runs.
  const { makeDay } = await import('/src/sim/day.ts');
  const { playOut } = await import('/src/sim/outcome.ts');
  const made = makeDay(run.dayId, { slowerFire: run.settings.slowerFire, tools: ['dig'] });
  const replay = playOut(made.day, made.land, run.inputs);
  out.replay = replay.side;
  out.replayDug = replay.sim.dugCells;
  out.replayEqual = JSON.stringify(replay.side) === JSON.stringify(done.outcome.player) && replay.sim.dugCells === done.dugCells;
  out.snapResult = await g.snap('06-result.jpg', [0, 0.3, 0.45], [0, 0.2, -0.2]);
  g.click('btn-replay');
  await g.waitFor((s) => s.phase === 'timelapse');
  await g.sleep(4000);
  out.snapLapse = await g.snap('07-timelapse.jpg');
  await g.waitFor((s) => s.phase === 'outcome', 30000);
  out.errors = window.__holdlineDebug.errors();
  return out;
};
