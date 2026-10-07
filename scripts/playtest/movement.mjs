import { startRec, stopRec, holdKeys, setPlayer, frames, fps, angDiff, aimAt } from './lib.mjs';

const KEYDIR = { // camera-relative basis multipliers [fwd, right]
  w: [1, 0], ArrowUp: [1, 0], s: [-1, 0], ArrowDown: [-1, 0],
  a: [0, -1], ArrowLeft: [0, -1], d: [0, 1], ArrowRight: [0, 1],
};

function expectedDir(keys, yaw) {
  let f = 0, r = 0;
  for (const k of keys) { if (!KEYDIR[k]) continue; f += KEYDIR[k][0]; r += KEYDIR[k][1]; }
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const x = f * fx + r * rx, z = f * fz + r * rz, n = Math.hypot(x, z);
  return { x: x / n, z: z / n };
}

/** Analyse a hold: direction, steady speed (per game-dt and per real second), facing, leg anim. */
function analyse(samples, yaw, keys) {
  const mv = samples.filter((s) => s.moving);
  if (mv.length < 3) return { ok: false, reason: 'no movement samples', n: samples.length };
  const a = mv[0], b = mv[mv.length - 1];
  const dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz);
  const exp = expectedDir(keys, yaw);
  const dirErrDeg = (Math.acos(Math.max(-1, Math.min(1, (dx * exp.x + dz * exp.z) / (dist || 1)))) * 180) / Math.PI;
  // per-frame speed normalised by the game's clamped dt
  const sp = [];
  for (let i = Math.floor(mv.length * 0.2) + 1; i < mv.length; i++) {
    const p = mv[i - 1], c = mv[i];
    const dtReal = (c.t - p.t) / 1000;
    if (dtReal <= 0) continue;
    sp.push(Math.hypot(c.x - p.x, c.z - p.z) / Math.min(dtReal, 0.05));
  }
  sp.sort((x, y) => x - y);
  const med = sp[Math.floor(sp.length / 2)] || 0;
  const realSpeed = dist / ((b.t - a.t) / 1000);
  const facingErrDeg = (angDiff(b.rotY, Math.atan2(exp.x, exp.z)) * 180) / Math.PI;
  const legAmp = Math.max(...mv.map((s) => Math.abs(s.leg)));
  return { ok: true, dist: +dist.toFixed(2), dirErrDeg: +dirErrDeg.toFixed(1), speedPerGameSec: +med.toFixed(2), realSpeed: +realSpeed.toFixed(2), facingErrDeg: +facingErrDeg.toFixed(1), legAmp: +legAmp.toFixed(2), frames: mv.length };
}

async function moveTest(page, keys, ms = 900) {
  const yaw = await page.evaluate(() => window.__dragonRanch.followCam.yaw);
  await startRec(page, 'player');
  await holdKeys(page, keys, ms);
  await page.waitForTimeout(400);
  const s = await stopRec(page);
  const r = analyse(s, yaw, keys);
  const after = s.filter((x) => !x.moving);
  r.legAfterStop = after.length ? +Math.abs(after[after.length - 1].leg).toFixed(3) : null;
  r.yaw = +yaw.toFixed(3);
  return { r, samples: s };
}

export async function movementPhase(page, R, shot, { fpsOnly = false } = {}) {
  const G = 'player-movement';
  // Clear area far from buildings
  await page.evaluate(() => { const g = window.__dragonRanch; g.energy = 100; g.ui.select(null); g.ui.closeTopPanel(); g.ui.closeTopPanel(); g.ui.closeTopPanel(); });
  R.metrics.fps = R.metrics.fps || {};
  R.metrics.fps.idleSpawn = await fps(page, 4000);
  if (fpsOnly) return;

  await setPlayer(page, 100, 100, 0);
  // 1. Each key, yaw 0
  for (const k of ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']) {
    await setPlayer(page, 100, 100, 0);
    const { r } = await moveTest(page, [k]);
    const pass = r.ok && r.dirErrDeg < 5 && r.speedPerGameSec > 10.5 && r.speedPerGameSec < 13.5 && r.facingErrDeg < 5;
    R.add(G, `key ${k} @yaw0: direction/speed/facing`, pass, r, 'high');
  }
  // 2. Diagonals not faster
  const straight = (await moveTest(page, ['w'])).r;
  for (const combo of [['w', 'd'], ['s', 'a'], ['ArrowUp', 'ArrowLeft']]) {
    await setPlayer(page, 100, 100, 0);
    const { r } = await moveTest(page, combo);
    const ratio = r.speedPerGameSec / straight.speedPerGameSec;
    R.add(G, `diagonal ${combo.join('+')} speed ratio vs straight`, r.ok && ratio < 1.05 && r.dirErrDeg < 5, { ...r, ratio: +ratio.toFixed(3) }, 'medium');
  }
  // 3. Rotate camera with Q (hold), then W should follow the new yaw
  await setPlayer(page, 100, 100, 0);
  const y0 = await page.evaluate(() => window.__dragonRanch.followCam.yaw);
  await holdKeys(page, ['q'], 700);
  const y1 = await page.evaluate(() => window.__dragonRanch.followCam.yaw);
  R.add(G, 'Q hold rotates camera', y1 - y0 > 0.3, { yawDelta: +(y1 - y0).toFixed(3), note: 'expected 1.8 rad/game-s; game dt clamps at 50ms so slower at <20fps' });
  for (const k of ['w', 'd']) {
    const { r } = await moveTest(page, [k]);
    R.add(G, `key ${k} after Q rotation follows camera`, r.ok && r.dirErrDeg < 5, r, 'high');
  }
  // E hold rotate the other way
  const e0 = await page.evaluate(() => window.__dragonRanch.followCam.yaw);
  await holdKeys(page, ['e'], 700);
  const e1 = await page.evaluate(() => window.__dragonRanch.followCam.yaw);
  R.add(G, 'E hold rotates camera (opposite of Q)', e1 - e0 < -0.3, { yawDelta: +(e1 - e0).toFixed(3) });
  // 4. Right-drag rotate
  await setPlayer(page, 100, 100, 0);
  await page.mouse.move(640, 360);
  await page.mouse.down({ button: 'right' });
  for (let i = 1; i <= 10; i++) { await page.mouse.move(640 + i * 25, 360 - i * 4); await page.waitForTimeout(16); }
  await page.mouse.up({ button: 'right' });
  const dragYaw = await page.evaluate(() => ({ yaw: window.__dragonRanch.followCam.yaw, pitch: window.__dragonRanch.followCam.pitch }));
  R.add(G, 'right-drag rotates camera yaw (and pitch)', Math.abs(dragYaw.yaw - -1.25) < 0.2, { ...dragYaw, expectYaw: -1.25 });
  for (const k of ['w', 'ArrowLeft']) {
    const { r } = await moveTest(page, [k]);
    R.add(G, `key ${k} after right-drag follows camera`, r.ok && r.dirErrDeg < 5, r, 'high');
  }
  // pitch clamp
  await page.mouse.move(640, 300); await page.mouse.down({ button: 'right' });
  for (let i = 1; i <= 15; i++) { await page.mouse.move(640, 300 + i * 20); await page.waitForTimeout(10); }
  await page.mouse.up({ button: 'right' });
  const pMax = await page.evaluate(() => window.__dragonRanch.followCam.pitch);
  await page.mouse.move(640, 520); await page.mouse.down({ button: 'right' });
  for (let i = 1; i <= 15; i++) { await page.mouse.move(640, 520 - i * 30); await page.waitForTimeout(10); }
  await page.mouse.up({ button: 'right' });
  const pMin = await page.evaluate(() => window.__dragonRanch.followCam.pitch);
  R.add(G, 'pitch clamped to [0.25, 1.35]', Math.abs(pMax - 1.35) < 0.01 && Math.abs(pMin - 0.25) < 0.01, { pMax, pMin });
  await page.evaluate(() => { window.__dragonRanch.followCam.pitch = 0.7; });

  // 5. Sprint / energy
  await setPlayer(page, 100, 100, 0);
  const sprint = (await moveTest(page, ['Shift', 'w'])).r;
  R.add(G, 'sprint (Shift) — exists?', null, { speedWithShift: sprint.speedPerGameSec, normal: straight.speedPerGameSec, note: 'No sprint mechanic in game (Shift has no effect)' });
  await page.evaluate(() => { const g = window.__dragonRanch; g.energy = 10; g.ui.updateEnergy(10); });
  await setPlayer(page, 100, 100, 0);
  const tired = (await moveTest(page, ['w'])).r;
  const tr = tired.speedPerGameSec / straight.speedPerGameSec;
  R.add(G, 'low energy (<25) slows to 0.55x', Math.abs(tr - 0.55) < 0.06, { ...tired, ratio: +tr.toFixed(3) });
  await page.evaluate(() => { const g = window.__dragonRanch; g.energy = 100; g.ui.updateEnergy(100); });
  const e100 = await page.evaluate(() => window.__dragonRanch.energy);
  await holdKeys(page, ['w'], 2000);
  const eAfter = await page.evaluate(() => window.__dragonRanch.energy);
  R.add(G, 'energy drains ~2.5/s while moving', eAfter < e100 && e100 - eAfter < 7, { drained: +(e100 - eAfter).toFixed(2) });

  // 6. Walk animation plays/stops
  await setPlayer(page, 100, 100, 0);
  const anim = (await moveTest(page, ['d'], 800)).r;
  await page.waitForTimeout(1200);
  anim.legAfterStop = +Math.abs(await page.evaluate(() => window.__dragonRanch.player.mesh.userData.parts.legL.rotation.x)).toFixed(3);
  R.add(G, 'walk animation plays while moving & settles when stopped', anim.legAmp > 0.3 && anim.legAfterStop < 0.05, { legAmp: anim.legAmp, legAfterStop: anim.legAfterStop });

  // 7. Camera follow smoothness (3s straight walk)
  await setPlayer(page, 0, 300, 0.6);
  await startRec(page, 'player');
  await holdKeys(page, ['w'], 3000);
  await page.waitForTimeout(2500);
  const cs = await stopRec(page);
  const steady = cs.filter((s, i) => s.moving && i > cs.length * 0.35);
  const camSp = [], dirs = [];
  for (let i = 1; i < steady.length; i++) {
    const p = steady[i - 1], c = steady[i];
    const dt = Math.min((c.t - p.t) / 1000, 0.05);
    if (dt <= 0) continue;
    camSp.push(Math.hypot(c.cx - p.cx, c.cz - p.cz) / dt);
    dirs.push(Math.atan2(c.cx - p.cx, c.cz - p.cz));
  }
  const mean = camSp.reduce((a, b) => a + b, 0) / camSp.length;
  const cv = Math.sqrt(camSp.reduce((a, b) => a + (b - mean) ** 2, 0) / camSp.length) / mean;
  const dirJ = Math.max(...dirs.map((d) => angDiff(d, dirs[0]))) * 180 / Math.PI;
  // after stop camera should settle (no oscillation)
  const tail = cs.slice(-8);
  const tailMove = Math.max(...tail.slice(1).map((c, i) => Math.hypot(c.cx - tail[i].cx, c.cz - tail[i].cz)));
  R.add(G, 'camera follow smooth (steady speed CV, no direction jitter, settles)', cv < 0.15 && dirJ < 3 && tailMove < 0.05,
    { camSpeedMean: +mean.toFixed(2), camSpeedCV: +cv.toFixed(3), maxDirDeviationDeg: +dirJ.toFixed(2), settleStepMax: +tailMove.toFixed(4), frames: camSp.length });

  // 8. Zoom limits (wheel)
  await page.mouse.move(640, 360);
  const z0 = await page.evaluate(() => window.__dragonRanch.followCam.distance);
  let notchesToMax = 0;
  for (let i = 0; i < 120; i++) {
    await page.mouse.wheel(0, 100); notchesToMax++;
    if (i % 10 === 9) { await frames(page, 1); if ((await page.evaluate(() => window.__dragonRanch.followCam.distance)) >= 40) break; }
  }
  const zMax = await page.evaluate(() => window.__dragonRanch.followCam.distance);
  await shot('zoom-max-out');
  for (let i = 0; i < 160; i++) { await page.mouse.wheel(0, -100); if (i % 10 === 9) await frames(page, 1); }
  const zMin = await page.evaluate(() => window.__dragonRanch.followCam.distance);
  await frames(page, 4);
  await shot('zoom-max-in');
  R.add(G, 'zoom clamps at [6, 40]', zMax === 40 && zMin === 6, { start: z0, zMax, zMin, notchesFromDefaultToMax: notchesToMax, unitsPerNotch: 100 * 0.08 * 0.05 });
  if (notchesToMax > 40) R.add(G, 'zoom feels slow (wheel notches default→max)', false, { notchesToMax, note: 'each 100px wheel notch = 0.4 units' }, 'low');
  await page.evaluate(() => { window.__dragonRanch.followCam.distance = 16; });

  // 9. World edges (world spans -500..500)
  const edges = [
    { name: '+X edge', x: 496, z: 0, keys: ['d'], axis: 'x', lim: 498.5 },
    { name: '-X edge', x: -496, z: 0, keys: ['a'], axis: 'x', lim: -498.5 },
    { name: '+Z edge', x: 0, z: 496, keys: ['s'], axis: 'z', lim: 498.5 },
    { name: '-Z edge', x: 0, z: -496, keys: ['w'], axis: 'z', lim: -498.5 },
  ];
  for (const e of edges) {
    await setPlayer(page, e.x, e.z, 0);
    await holdKeys(page, e.keys, 1200);
    const p = await page.evaluate(() => ({ x: window.__dragonRanch.player.position.x, z: window.__dragonRanch.player.position.z }));
    const v = p[e.axis];
    const ok = Math.abs(v - e.lim) < 0.05 && Number.isFinite(v);
    R.add(G, `world bound ${e.name} clamps at ±498.5`, ok, { pos: p, limit: e.lim });
  }
  // corner + slide along edge + not stuck
  await setPlayer(page, 496, 496, 0);
  await holdKeys(page, ['s', 'd'], 1000);
  const corner = await page.evaluate(() => ({ x: window.__dragonRanch.player.position.x, z: window.__dragonRanch.player.position.z }));
  await holdKeys(page, ['w', 'd'], 800);
  const slid = await page.evaluate(() => ({ x: window.__dragonRanch.player.position.x, z: window.__dragonRanch.player.position.z }));
  R.add(G, 'corner clamp + slides along edge + not stuck', corner.x === 498.5 && corner.z === 498.5 && slid.z < 495 && slid.x === 498.5, { corner, afterSlide: slid });
  await page.evaluate(() => { const g = window.__dragonRanch; g.followCam.yaw = Math.PI * 0.75; g.followCam.distance = 30; g.followCam.pitch = 0.5; });
  await frames(page, 30);
  await shot('world-edge-corner');
  R.metrics.fps.worldCorner = await fps(page, 3000);
  await page.evaluate(() => { const g = window.__dragonRanch; g.followCam.distance = 16; g.followCam.pitch = 0.7; });

  // 10. FPS while walking a long distance across the world
  await setPlayer(page, -450, 0, -Math.PI / 2); // yaw -90deg: W -> +x
  await page.keyboard.down('w');
  R.metrics.fps.walking = await fps(page, 5000);
  await page.keyboard.up('w');
  const walked = await page.evaluate(() => window.__dragonRanch.player.position.x);
  R.metrics.fps.walking.walkedToX = +walked.toFixed(1);
}

/** Collision tests against farmhouse, bunkhouse, field training (rot 0 and 1). */
export async function collisionPhase(page, R, shot) {
  const G = 'player-collision';
  const specs = [
    { type: 'farmhouse', tx: 150, tz: 150, rot: 0 },
    { type: 'farmhouse', tx: 170, tz: 150, rot: 1 },
    { type: 'workerBunkhouse', tx: 150, tz: 170, rot: 0 },
    { type: 'workerBunkhouse', tx: 170, tz: 172, rot: 1 },
    { type: 'dragonFieldTraining', tx: 150, tz: 195, rot: 0 },
    { type: 'dragonFieldTraining', tx: 170, tz: 195, rot: 1 },
  ];
  for (const sp of specs) {
    const b = await page.evaluate((sp) => {
      const g = window.__dragonRanch;
      let e = g.buildings.buildings.find((x) => x.tx === sp.tx && x.tz === sp.tz);
      if (!e) e = g.buildings.place(sp.type, sp.tx, sp.tz, sp.rot);
      if (!e) return null;
      return { id: e.id, tx: e.tx, tz: e.tz, w: e.w, d: e.d, solids: window.__pt.solidBoxes(e) };
    }, sp);
    if (!b) { R.add(G, `place ${sp.type} r${sp.rot}`, false, { reason: 'place failed' }, 'high'); continue; }
    const cx = b.tx + b.w / 2, cz = b.tz + b.d / 2;
    const approaches = [
      { from: 'south(-z)', x: cx, z: b.tz - 3, key: 's' }, // yaw 0: S moves +z
      { from: 'north(+z)', x: cx, z: b.tz + b.d + 3, key: 'w' },
      { from: 'west(-x)', x: b.tx - 3, z: cz, key: 'd' },
      { from: 'east(+x)', x: b.tx + b.w + 3, z: cz, key: 'a' },
      // off-centre lines to hit pillars / walls rather than the archway gap
      { from: 'south off-centre', x: cx - 1.3, z: b.tz - 3, key: 's' },
      { from: 'west off-centre', x: b.tx - 3, z: cz - 0.4, key: 'd' },
    ];
    let worstPen = 0, worstFrom = null, passedThrough = [], stuck = [];
    for (const a of approaches) {
      await setPlayer(page, a.x, a.z, 0);
      await startRec(page, 'player');
      await holdKeys(page, [a.key], 1300);
      const s = await stopRec(page);
      // penetration into heuristic solid boxes with body radius 0.25
      const r = 0.25;
      for (const smp of s) {
        for (const bx of b.solids) {
          const px = Math.min(smp.x + r - bx.minX, bx.maxX - (smp.x - r));
          const pz = Math.min(smp.z + r - bx.minZ, bx.maxZ - (smp.z - r));
          if (px > 0 && pz > 0) {
            const pen = Math.min(px, pz);
            if (pen > worstPen) { worstPen = pen; worstFrom = a.from; }
          }
        }
      }
      const last = s[s.length - 1];
      const crossed = a.key === 's' ? last.z > b.tz + b.d : a.key === 'w' ? last.z < b.tz : a.key === 'd' ? last.x > b.tx + b.w : last.x < b.tx;
      if (crossed) passedThrough.push(a.from);
      // back out (not stuck)
      const opp = { s: 'w', w: 's', a: 'd', d: 'a' }[a.key];
      const before = await page.evaluate(() => ({ x: window.__dragonRanch.player.position.x, z: window.__dragonRanch.player.position.z }));
      await holdKeys(page, [opp], 400);
      const after = await page.evaluate(() => ({ x: window.__dragonRanch.player.position.x, z: window.__dragonRanch.player.position.z }));
      if (Math.hypot(after.x - before.x, after.z - before.z) < 1) stuck.push(a.from);
    }
    const solidType = sp.type !== 'dragonFieldTraining';
    const pass = worstPen < 0.05 && stuck.length === 0 && (solidType ? passedThrough.length === 0 : true);
    R.add(G, `${sp.type} rot${sp.rot}: blocks player, no clipping, not stuck`, pass,
      { footprint: `${b.w}x${b.d}`, worstPenetration: +worstPen.toFixed(2), worstFrom, walkedThroughFrom: passedThrough, stuckFrom: stuck, solidParts: b.solids.length }, 'high');

    // Sliding: push diagonally into the south face
    await setPlayer(page, cx - 1, b.tz - 1.0, 0);
    await startRec(page, 'player');
    await holdKeys(page, ['s', 'd'], 600);
    const s2 = await stopRec(page);
    const f = s2[0], l = s2[s2.length - 1];
    R.add(G, `${sp.type} rot${sp.rot}: slides along wall when pushing diagonally`, l.x - f.x > 1.2 && (solidType ? l.z < b.tz : true),
      { dx: +(l.x - f.x).toFixed(2), dz: +(l.z - f.z).toFixed(2), endZ: +l.z.toFixed(2), faceZ: b.tz }, 'medium');
    if (sp.rot === 0 && sp.type !== 'farmhouse') {
      await setPlayer(page, cx + 0.3, cz + 0.2, 0.5);
      await page.evaluate(() => { const g = window.__dragonRanch; g.followCam.distance = 9; });
      await frames(page, 10);
      await shot(`clip-check-inside-${sp.type}`);
      await page.evaluate(() => { const g = window.__dragonRanch; g.followCam.distance = 16; });
    }
  }

  // Player already inside a solid collider (old save / teleport) can walk out
  const bunkIn = await page.evaluate(() => { const b = window.__dragonRanch.buildings.buildings.find((x) => x.type === 'workerBunkhouse'); return { cx: b.tx + b.w / 2, cz: b.tz + b.d / 2 }; });
  await setPlayer(page, bunkIn.cx, bunkIn.cz, 0);
  await holdKeys(page, ['d'], 1200);
  const outP = await page.evaluate(() => window.__dragonRanch.player.position.x);
  R.add(G, 'player starting inside a building can walk out (never trapped)', outP - bunkIn.cx > 2.5, { startX: bunkIn.cx, endX: +outP.toFixed(2) }, 'high');

  // Building placed on top of the player via real UI → can the player escape?
  await setPlayer(page, 230.5, 150.5, 0);
  await page.keyboard.press('1');
  await frames(page, 3);
  await aimAt(page, 230.5, 150.5);
  await page.mouse.down(); await page.mouse.up();
  await frames(page, 4);
  const placedOver = await page.evaluate(() => window.__dragonRanch.buildings.buildings.some((b) => b.type === 'farmhouse' && b.tx <= 230 && b.tx + b.w > 230 && b.tz <= 150 && b.tz + b.d > 150));
  await page.keyboard.press('Escape'); await page.keyboard.press('1'); await page.keyboard.press('1');
  await page.evaluate(() => window.__dragonRanch.ui.select(null));
  let escaped = false;
  if (placedOver) {
    for (const k of ['w', 'a', 's', 'd']) {
      await holdKeys(page, [k], 900);
    }
    const p = await page.evaluate(() => window.__dragonRanch.player.position);
    escaped = Math.hypot(p.x - 230.5, p.z - 150.5) > 2;
    R.add(G, 'farmhouse placed on top of player (UI) — player can walk out', escaped, { placedOver, pos: { x: p.x, z: p.z } }, 'high');
  } else {
    R.add(G, 'cannot place a building on top of the player', true, { placedOver });
  }
}
