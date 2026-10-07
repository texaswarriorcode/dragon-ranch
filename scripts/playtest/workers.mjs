import { startRec, stopRec, setPlayer, frames, angDiff, holdKeys } from './lib.mjs';
import { placeViaUI, openMarketTabAndBuy } from './uihelpers.mjs';

export function analyseWorkers(samples, buildings) {
  const solid = buildings.filter((b) => b.type !== 'farmPlot');
  const st = {}; let stackFrames = 0, minPair = Infinity, outOfWorld = 0;
  for (let i = 0; i < samples.length; i++) {
    const ws = samples[i].w.filter((w) => w.vis);
    for (let a = 0; a < ws.length; a++) for (let b = a + 1; b < ws.length; b++) {
      const d = Math.hypot(ws[a].x - ws[b].x, ws[a].z - ws[b].z);
      minPair = Math.min(minPair, d);
      if (d < 0.5) stackFrames++;
    }
    for (const w of ws) {
      const s = (st[w.id] ||= { id: w.id, inside: {}, path: 0, spin: 0, faceErr: 0, movingFrames: 0, noAnimFrames: 0, maxBunkDist: 0, idleFrames: 0 });
      if (Math.abs(w.x) > 498.5 || Math.abs(w.z) > 498.5) outOfWorld++;
      for (const b of solid) {
        if (w.x > b.tx + 0.1 && w.x < b.tx + b.w - 0.1 && w.z > b.tz + 0.1 && w.z < b.tz + b.d - 0.1) {
          s.inside[b.type] = (s.inside[b.type] || 0) + 1;
        }
      }
      const bunk = buildings.find((b) => b.id === w.bunk);
      if (bunk) s.maxBunkDist = Math.max(s.maxBunkDist, Math.hypot(w.x - (bunk.tx + bunk.w / 2), w.z - (bunk.tz + bunk.d / 2)));
      const prev = i > 0 ? samples[i - 1].w.find((p) => p.id === w.id && p.vis) : null;
      if (prev) {
        const dx = w.x - prev.x, dz = w.z - prev.z, m = Math.hypot(dx, dz);
        s.path += m;
        if (angDiff(w.rotY, prev.rotY) > 1.2) s.spin++;
        if (m > 0.02) {
          s.movingFrames++;
          if (angDiff(w.rotY, Math.atan2(dx, dz)) > 0.35) s.faceErr++;
          if (Math.abs(w.leg) < 0.03 && Math.abs(prev.leg) < 0.03) s.noAnimFrames++;
        } else s.idleFrames++;
      }
    }
  }
  const per = Object.values(st).map((s) => ({ ...s, path: +s.path.toFixed(1), maxBunkDist: +s.maxBunkDist.toFixed(1) }));
  return { per, stackFrames, minPair: +minPair.toFixed(2), outOfWorld, frames: samples.length };
}

export async function run(page, R, shot, { boot }) {
  const G = 'workers';
  await boot('', { clear: true });
  // Layout via real UI
  const placements = [
    ['workerBunkhouse', 0, -10, 0], ['dragonPen', 12, -10, 0], ['breedingPen', -12, -10, 1],
    ['farmhouse', 0, 6, 0], ['workerBunkhouse', 0, 20, 1], ['dragonFieldTraining', 14, 8, 0],
  ];
  const placed = [];
  for (const [type, x, z, rot] of placements) {
    const r = await placeViaUI(page, type, x, z, rot);
    placed.push(r);
    R.add('core-buildings', `place ${type} rot${rot} via hotbar+mouse (${x},${z})`, r.ok && (rot % 2 === 0 || r.w !== r.h), r, 'high');
  }
  const bunkR = placed[4];
  R.add('core-buildings', 'R rotation swaps bunkhouse footprint to 10x4', bunkR.ok && bunkR.w === 10 && bunkR.d === 4, { w: bunkR.w, d: bunkR.d }, 'medium');

  // Hire 4 handlers with the 200 starting coins via marketplace clicks
  const buys = await openMarketTabAndBuy(page, 'worker-dragon-handler', 5);
  const nW = await page.evaluate(() => window.__dragonRanch.workers.workers.length);
  R.add(G, 'hire 4 Dragon Handlers with 200 starting coins (5th fails: no coins)', nW === 4 && buys[4].after.workers === 4,
    { workers: nW, coinsAfter: buys[4].after.coins, lastToast: buys[4].after.toast }, 'high');
  await shot('marketplace-hire');
  await page.keyboard.press('Escape');
  // Creative for more coins, hire 4 more (second bunkhouse), 9th should fail on capacity
  await page.click('#btn-creative');
  await frames(page, 2);
  const buys2 = await openMarketTabAndBuy(page, 'worker-dragon-handler', 5);
  const nW2 = await page.evaluate(() => window.__dragonRanch.workers.workers.map((w) => w.bunkhouseId));
  R.add(G, 'hire up to capacity 8 across 2 bunkhouses; 9th refused', nW2.length === 8, { bunkAssignments: nW2, lastToast: buys2[4].after.toast }, 'high');
  await page.keyboard.press('Escape');
  await frames(page, 2);

  // Spawn positions
  const spawn = await page.evaluate(() => {
    const g = window.__dragonRanch;
    return g.workers.workers.map((w) => {
      const b = g.buildings.buildings.find((x) => x.id === w.bunkhouseId);
      const inside = b && w.x > b.tx && w.x < b.tx + b.w && w.z > b.tz && w.z < b.tz + b.d;
      return { id: w.id, x: +w.x.toFixed(2), z: +w.z.toFixed(2), insideOwnBunk: inside };
    });
  });
  R.add(G, 'workers spawn outside building walls (not inside bunkhouse geometry)', spawn.every((s) => !s.insideOwnBunk), { spawn }, 'medium');

  // Observe wandering for 45s real time
  const buildings = await page.evaluate(() => window.__dragonRanch.buildings.buildings.map((b) => ({ id: b.id, type: b.type, tx: b.tx, tz: b.tz, w: b.w, d: b.d })));
  await setPlayer(page, 0, 30, 0);
  await page.evaluate(() => { const g = window.__dragonRanch; g.followCam.distance = 40; g.followCam.pitch = 1.1; });
  await startRec(page, 'workers');
  await page.waitForTimeout(20000);
  await shot('workers-wandering-overview');
  await page.evaluate(() => { const g = window.__dragonRanch; const w = g.workers.workers[0]; g.player.mesh.position.set(w.x + 3, 0, w.z + 3); g.followCam.distance = 10; g.followCam.pitch = 0.6; });
  await page.waitForTimeout(25000);
  await shot('workers-closeup');
  const ws = await stopRec(page);
  const A = analyseWorkers(ws, buildings);
  const insideAny = A.per.filter((p) => Object.keys(p.inside).length);
  R.add(G, 'workers never walk inside buildings/pens (through walls/fences) over 45s', insideAny.length === 0,
    { offenders: insideAny.map((p) => ({ id: p.id, framesInside: p.inside })), frames: A.frames }, 'high');
  R.add(G, 'workers stay inside world bounds', A.outOfWorld === 0, { outOfWorld: A.outOfWorld });
  R.add(G, 'workers do not stack (pair distance < 0.5)', A.stackFrames === 0, { stackFrames: A.stackFrames, minPairDist: A.minPair }, 'medium');
  const spins = A.per.reduce((s, p) => s + p.spin, 0), faceErr = A.per.reduce((s, p) => s + p.faceErr, 0), mov = A.per.reduce((s, p) => s + p.movingFrames, 0);
  R.add(G, 'workers face walk direction, no spin jitter', spins <= A.per.length * 4 && faceErr / Math.max(1, mov) < 0.05, { spins, facingErrFrames: faceErr, movingFrames: mov }, 'low');
  const noAnim = A.per.reduce((s, p) => s + p.noAnimFrames, 0);
  R.add(G, 'workers play a walk animation while moving (no sliding)', noAnim / Math.max(1, mov) < 0.2, { framesMovingWithoutLegSwing: noAnim, movingFrames: mov }, 'medium');
  R.add(G, 'workers keep moving (none frozen) and stay near home', A.per.every((p) => p.path > 2) && A.per.every((p) => p.maxBunkDist < 30),
    { paths: A.per.map((p) => p.path), maxBunkDist: A.per.map((p) => p.maxBunkDist) }, 'medium');
  R.metrics.workerWander = A.per;

  // ---- Mission via the real wizard ----
  const MG = 'missions';
  const w1 = await page.evaluate(() => { const w = window.__dragonRanch.workers.workers[0]; return { id: w.id, x: w.x, z: w.z }; });
  // Walk up: freeze the worker briefly by standing right next to it
  await page.evaluate(() => { const g = window.__dragonRanch; g.followCam.distance = 16; g.followCam.pitch = 0.7; });
  await setPlayer(page, w1.x + 1.2, w1.z + 1.2, 0);
  await page.evaluate(({ x, z }) => { const g = window.__dragonRanch; const w = g.workers.workers[0]; g.player.mesh.position.set(w.x + 1, 0, w.z + 1); }, w1);
  await frames(page, 3);
  const prompt = await page.evaluate(() => document.getElementById('prompt').textContent);
  await page.keyboard.press('f');
  await frames(page, 3);
  const mo = await page.evaluate(() => ({ open: window.__dragonRanch.ui.missionsOpen, sel: { ...window.__dragonRanch.ui.missionSel } }));
  R.add(MG, 'F next to a handler opens Missions with handler preselected', mo.open && !!mo.sel.workerId, { prompt, ...mo }, 'high');
  if (!mo.open) await page.keyboard.press('n');
  await frames(page, 2);
  // Real-user interaction checks against the per-frame re-render
  await page.click('#ms-dragon').catch(() => {});
  await page.waitForTimeout(400);
  const focus = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  R.add(MG, 'mission dropdown keeps focus after click (panel not rebuilt every frame)', focus === 'ms-dragon', { activeElementAfter400ms: focus }, 'high');
  const pBefore = await page.evaluate(() => ({ x: window.__dragonRanch.player.position.x, z: window.__dragonRanch.player.position.z, v: document.getElementById('ms-dragon')?.value }));
  await page.focus('#ms-dragon').catch(() => {});
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  const pAfter = await page.evaluate(() => ({ x: window.__dragonRanch.player.position.x, z: window.__dragonRanch.player.position.z, v: document.getElementById('ms-dragon')?.value }));
  const moved = Math.hypot(pAfter.x - pBefore.x, pAfter.z - pBefore.z);
  R.add(MG, 'arrow keys in a focused dropdown do not move the player', moved < 0.05, { playerMoved: +moved.toFixed(2), selectValueBefore: pBefore.v, after: pAfter.v }, 'medium');
  // Fill remaining steps (Playwright selectOption = change event)
  for (const id of ['#ms-dragon', '#ms-building', '#ms-mission']) {
    for (let tries = 0; tries < 5; tries++) {
      try {
        const v = await page.$eval(id, (el) => el.value);
        if (v) break;
        await page.selectOption(id, { index: 1 }, { timeout: 2000 });
        break;
      } catch (e) { await page.waitForTimeout(100); }
    }
    await frames(page, 2);
  }
  const selState = await page.evaluate(() => ({ ...window.__dragonRanch.ui.missionSel }));
  await shot('mission-wizard-filled');
  // Realistic click: 120 ms between press and release
  const box = await page.$eval('#ms-start', (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, disabled: el.disabled }; });
  await page.mouse.move(box.x, box.y);
  await page.mouse.down(); await page.waitForTimeout(120); await page.mouse.up();
  await frames(page, 3);
  let active = await page.evaluate(() => window.__dragonRanch.missions.active.length);
  R.add(MG, 'Start mission registers with a human-speed click (120ms press)', active === 1, { selState, startDisabled: box.disabled, activeMissions: active }, 'high');
  if (active === 0) {
    await page.click('#ms-start', { timeout: 3000 }).catch(() => {});
    await frames(page, 3);
    active = await page.evaluate(() => window.__dragonRanch.missions.active.length);
    R.add(MG, 'Start mission works with an instant click (fallback)', active === 1, { activeMissions: active }, 'high');
  }
  if (active) {
    const m = await page.evaluate(() => { const g = window.__dragonRanch; const m = g.missions.active[0]; const w = g.workers.getById(m.workerId); return { workerId: m.workerId, vis: w.mesh.visible, busy: w.busyMission, x: w.x, z: w.z, dragon: { ...m.dragon }, coins: g.coins }; });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(3000);
    const m2 = await page.evaluate((id) => { const w = window.__dragonRanch.workers.getById(id); return { vis: w.mesh.visible, x: w.x, z: w.z }; }, m.workerId);
    R.add(MG, 'handler hidden & parked while on mission', !m.vis && m.busy && !m2.vis && m2.x === m.x && m2.z === m.z, { before: m, after: m2 }, 'medium');
    await shot('mission-active-handler-hidden');
    // time-skip the mission end (test hook), wait for real completion handling
    await page.evaluate(() => { window.__dragonRanch.missions.active[0].endsAt = Date.now() + 1500; });
    await page.waitForTimeout(3000);
    const done = await page.evaluate(({ id, did }) => {
      const g = window.__dragonRanch; const w = g.workers.getById(id);
      const d = g.inventory.dragons.find((x) => x.id === did);
      return { active: g.missions.active.length, vis: w.mesh.visible, busy: !!w.busyMission, coins: g.coins, dragon: d && { xp: d.xp, level: d.level, restLeftMs: d.missionRestUntil - Date.now() }, toast: document.getElementById('toast').textContent };
    }, { id: m.workerId, did: m.dragon.id });
    R.add(MG, 'mission completes: handler returns visible, +20 coins, dragon back with XP and 10-min rest', done.active === 0 && done.vis && !done.busy && done.coins === m.coins + 20 && done.dragon && done.dragon.restLeftMs > 590000,
      { before: { coins: m.coins, xp: m.dragon.xp, level: m.dragon.level }, done }, 'high');
    // after return, does the handler wander again within 6s?
    const p0 = await page.evaluate((id) => { const w = window.__dragonRanch.workers.getById(id); return { x: w.x, z: w.z }; }, m.workerId);
    await page.waitForTimeout(6000);
    const p1 = await page.evaluate((id) => { const w = window.__dragonRanch.workers.getById(id); return { x: w.x, z: w.z }; }, m.workerId);
    R.add(MG, 'returned handler resumes wandering', Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.3, { p0, p1 }, 'low');
  }

  // Start a second mission (left in progress) for persistence
  await page.keyboard.press('n'); await frames(page, 2);
  for (const id of ['#ms-worker', '#ms-dragon', '#ms-building', '#ms-mission']) {
    for (let tries = 0; tries < 5; tries++) {
      try { const v = await page.$eval(id, (el) => el.value); if (v) break; await page.selectOption(id, { index: 1 }, { timeout: 2000 }); break; } catch (e) { await page.waitForTimeout(100); }
    }
    await frames(page, 2);
  }
  await page.click('#ms-start', { timeout: 3000 }).catch(() => {});
  await frames(page, 3);
  await page.keyboard.press('Escape');
  // Put some adults into pens so ID persistence can be checked (highest inventory IDs)
  await page.evaluate(() => {
    const g = window.__dragonRanch; const now = performance.now();
    const pen = g.buildings.buildings.find((b) => b.type === 'dragonPen');
    const adults = g.inventory.dragons.filter((d) => d.stage >= 2).sort((a, b) => b.id - a.id).slice(0, 3);
    for (const a of adults) { if (g.dragons.place(a, pen, now)) g._consumeDragonItem(a); }
  });
  const pre = await page.evaluate(() => {
    const g = window.__dragonRanch;
    return { workers: g.workers.workers.length, busy: g.workers.workers.filter((w) => w.busyMission).map((w) => w.id), missions: g.missions.active.map((m) => ({ key: m.missionKey, workerId: m.workerId, endsAt: m.endsAt })), buildings: g.buildings.buildings.length, coins: g.coins, penDragons: g.dragons.dragons.map((d) => d.id), inv: g.inventory.dragons.map((d) => d.id) };
  });
  await page.waitForTimeout(9000); // real autosave interval is 8s
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__dragonRanch && window.__dragonRanch.renderer);
  await page.waitForTimeout(1500);
  const post = await page.evaluate(() => {
    const g = window.__dragonRanch;
    return { workers: g.workers.workers.length, busy: g.workers.workers.filter((w) => w.busyMission).map((w) => w.id), hiddenBusy: g.workers.workers.filter((w) => w.busyMission).every((w) => !w.mesh.visible), missions: g.missions.active.map((m) => ({ key: m.missionKey, workerId: m.workerId, endsAt: m.endsAt })), buildings: g.buildings.buildings.length, coins: g.coins, penDragons: g.dragons.dragons.map((d) => d.id), inv: g.inventory.dragons.map((d) => d.id) };
  });
  R.add('persistence', 'save/reload keeps workers, busy handler, in-progress mission, buildings, coins, pen dragons',
    post.workers === pre.workers && JSON.stringify(post.missions) === JSON.stringify(pre.missions) && JSON.stringify(post.busy) === JSON.stringify(pre.busy) && post.hiddenBusy && post.buildings === pre.buildings && post.coins === pre.coins && post.penDragons.length === pre.penDragons.length,
    { pre, post }, 'high');
  // New dragon IDs after reload must not collide with pen / mission dragons
  const ids = await page.evaluate(() => {
    const g = window.__dragonRanch;
    g.ui.onCreativeSpawn({ sex: 'male', stage: 2, rarity: 'Common' });
    const newId = g.inventory.dragons[g.inventory.dragons.length - 1].id;
    const taken = [...g.dragons.dragons.map((d) => d.id), ...g.missions.active.map((m) => m.dragon.id), ...g.inventory.dragons.slice(0, -1).map((d) => d.id)];
    return { newId, collides: taken.includes(newId), taken };
  });
  R.add('persistence', 'dragon IDs stay unique after reload (no collision with pen/mission dragons)', !ids.collides, ids, 'high');
  if (ids.collides) {
    const loss = await page.evaluate((newId) => {
      const g = window.__dragonRanch;
      const w = g.dragons.dragons.find((d) => d.id === newId);
      if (!w) return { note: 'collision with mission dragon' };
      const before = g.inventory.dragons.length + g.dragons.dragons.length;
      g._addDragonItem(g.dragons.pickUp(w)); // same as pressing F on it
      const pen = g.buildings.buildings.find((b) => b.type === 'dragonPen');
      const item = g.inventory.dragons.find((d) => d.id === newId);
      const placed = g.dragons.place(item, pen, performance.now());
      if (placed) g._consumeDragonItem(item); // same as clicking a pen
      return { totalDragonsBefore: before, totalAfter: g.inventory.dragons.length + g.dragons.dragons.length };
    }, ids.newId);
    R.add('persistence', 'duplicate IDs → placing one dragon deletes its twin (data loss)', false, loss, 'high');
  }
}
