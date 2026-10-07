import { startRec, stopRec, setPlayer, frames, aimAt, angDiff } from './lib.mjs';

export async function run(page, R, shot, { boot }) {
  const G = 'dragons';
  await boot('?demo=1', { clear: true });
  // Add rotated pens with dragons (setup), then observe wander with real time
  await page.evaluate(() => {
    const g = window.__dragonRanch; const now = performance.now();
    const p = g.buildings.place('dragonPen', 40, -2, 1);
    const bp = g.buildings.place('breedingPen', 52, -2, 3);
    const edge = g.buildings.place('dragonPen', 490, 490, 2); // pen touching world corner
    for (const s of [{ sex: 'male', stage: 2 }, { sex: 'female', stage: 1 }, { sex: 'male', stage: 0 }, { sex: 'female', stage: 2 }]) g.dragons.place({ ...s, rarity: 'Rare' }, p, now);
    g.dragons.place({ sex: 'male', stage: 2, rarity: 'Legendary' }, bp, now);
    g.dragons.place({ sex: 'female', stage: 2, rarity: 'Legendary' }, bp, now);
    for (let i = 0; i < 4; i++) g.dragons.place({ sex: i % 2 ? 'male' : 'female', stage: 2, rarity: 'Common' }, edge, now);
  });
  const pens = await page.evaluate(() => window.__dragonRanch.buildings.buildings.filter((b) => /Pen$/.test(b.type)).map((b) => ({ id: b.id, type: b.type, tx: b.tx, tz: b.tz, w: b.w, d: b.d, rot: b.rotation })));
  await setPlayer(page, 30, 16, 0);
  await page.evaluate(() => { const g = window.__dragonRanch; g.followCam.distance = 34; g.followCam.pitch = 1.0; });
  await startRec(page, 'dragons');
  await page.waitForTimeout(40000);
  await shot('dragons-in-pens');
  const ds = await stopRec(page);
  let escapes = 0, worst = 0, spin = 0, faceErr = 0, moving = 0; const offenders = new Set();
  for (let i = 0; i < ds.length; i++) {
    for (const d of ds[i].d) {
      const p = pens.find((x) => x.id === d.pen);
      if (!p) continue;
      const m = 0.3; // fence inset
      const out = Math.max(p.tx + m - d.x, d.x - (p.tx + p.w - m), p.tz + m - d.z, d.z - (p.tz + p.d - m));
      if (out > 0) { escapes++; worst = Math.max(worst, out); offenders.add(d.id); }
      const prev = i ? ds[i - 1].d.find((x) => x.id === d.id) : null;
      if (prev) {
        const dx = d.x - prev.x, dz = d.z - prev.z;
        if (Math.hypot(dx, dz) > 0.01) { moving++; if (angDiff(d.rotY, Math.atan2(dx, dz)) > 0.35) faceErr++; }
        if (angDiff(d.rotY, prev.rotY) > 1.2 && Math.hypot(dx, dz) < 0.05) spin++;
      }
    }
  }
  R.add(G, 'dragons stay inside pen fences over 40s (incl. rotated + world-corner pens)', escapes === 0,
    { escapes, worstOutside: +worst.toFixed(2), offenders: [...offenders], dragons: ds[0]?.d.length, frames: ds.length, pens: pens.map((p) => `${p.type} r${p.rot}`) }, 'high');
  R.add(G, 'dragons face their walking direction (no spin-in-place)', faceErr / Math.max(1, moving) < 0.05 && spin < 10, { faceErr, moving, spinInPlace: spin }, 'low');

  // Growth: baby → juvenile, mesh gets bigger
  const grow = await page.evaluate(async () => {
    const g = window.__dragonRanch;
    const d = g.dragons.dragons.find((x) => x.stage === 0);
    const size = (m) => { m.updateMatrixWorld(true); let maxY = 0; m.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); maxY = Math.max(maxY, b.max.y); } }); return maxY; };
    const before = size(d.mesh), id = d.id;
    d.stageStart -= 200000; // time-skip the stage timer
    await new Promise((r) => setTimeout(r, 500));
    const d2 = g.dragons.dragons.find((x) => x.id === id);
    return { id, stageBefore: 0, stageAfter: d2.stage, heightBefore: +before.toFixed(2), heightAfter: +size(d2.mesh).toFixed(2) };
  });
  R.add(G, 'dragon grows (stage up + mesh scales up)', grow.stageAfter >= 1 && grow.heightAfter > grow.heightBefore, grow, 'medium');

  // Pick up an adult with real input (aim + F), then place back with hotbar 8 + click
  const pen = pens.find((p) => p.type === 'dragonPen' && p.rot === 1);
  await page.evaluate(() => { const g = window.__dragonRanch; g.followCam.distance = 14; g.followCam.pitch = 0.8; });
  await setPlayer(page, pen.tx + pen.w / 2, pen.tz + pen.d + 3, 0);
  const target = await page.evaluate((pid) => { const d = window.__dragonRanch.dragons.dragons.find((x) => x.penId === pid && x.stage >= 2); return { id: d.id, x: d.x, z: d.z }; }, pen.id);
  await page.evaluate((id) => { const d = window.__dragonRanch.dragons.dragons.find((x) => x.id === id); d.roamTarget = { x: d.x, z: d.z }; d.roamTimer = 30; }, target.id);
  const invBefore = await page.evaluate(() => window.__dragonRanch.inventory.dragons.length);
  const idClash = await page.evaluate(() => { const g = window.__dragonRanch; const inv = new Set(g.inventory.dragons.map((d) => d.id)); return g.dragons.dragons.filter((d) => inv.has(d.id)).map((d) => d.id); });
  R.add(G, 'demo/world dragon IDs do not collide with inventory dragon IDs', idClash.length === 0, { clashingIds: idClash }, 'medium');
  await aimAt(page, target.x, target.z, 0.6);
  const pPrompt = await page.evaluate(() => document.getElementById('prompt').textContent);
  await page.keyboard.press('f');
  await frames(page, 3);
  const picked = await page.evaluate(({ id, n }) => ({ inWorld: window.__dragonRanch.dragons.dragons.some((d) => d.id === id), invCount: window.__dragonRanch.inventory.dragons.length, invBefore: n, dupIds: window.__dragonRanch.inventory.dragons.filter((d) => d.id === id).length }), { id: target.id, n: invBefore });
  R.add(G, 'pick up adult dragon (aim + F)', !picked.inWorld && picked.invCount === invBefore + 1, { prompt: pPrompt, ...picked }, 'high');
  await page.keyboard.press('8');
  await frames(page, 3);
  const items = await page.$$('#dragon-list .dragon-item');
  const idx = await page.evaluate((id) => window.__dragonRanch.inventory.dragons.findIndex((d) => d.id === id), target.id);
  if (items[idx]) await items[idx].click();
  await frames(page, 2);
  await shot('dragon-panel-open');
  await page.click('#btn-dragon-close').catch(() => {});
  await page.evaluate(() => { if (window.__dragonRanch.ui.selected !== 'dragons') window.__dragonRanch.ui.select('dragons'); });
  await aimAt(page, pen.tx + pen.w / 2, pen.tz + pen.d / 2);
  const plPrompt = await page.evaluate(() => document.getElementById('prompt').textContent);
  await page.mouse.down(); await frames(page, 1); await page.mouse.up();
  await frames(page, 3);
  const back = await page.evaluate((id) => { const d = window.__dragonRanch.dragons.dragons.find((x) => x.id === id); return d ? { penId: d.penId } : null; }, target.id);
  R.add(G, 'place dragon back into pen (hotbar 8 + click)', back && back.penId === pen.id, { prompt: plPrompt, back, selectedDragon: idx }, 'high');
  await page.keyboard.press('Escape');

  // Breeding: skip cooldown + most of the 60s timer, then let the game lay; egg hatches on its real 15s timer
  const bp = await page.evaluate(() => window.__dragonRanch.buildings.buildings.find((b) => b.type === 'breedingPen').id);
  await page.evaluate((id) => { const g = window.__dragonRanch; const st = g.dragons.getBreedState(id); if (st.egg) { g.scene.remove(st.egg.mesh); st.egg = null; } st.cooldownUntil = 0; st.breedStart = performance.now() - 58000; }, bp);
  await page.waitForFunction((id) => !!window.__dragonRanch.dragons.getBreedState(id)?.egg, bp, { timeout: 15000 }).catch(() => {});
  const egg = await page.evaluate((id) => !!window.__dragonRanch.dragons.getBreedState(id)?.egg, bp);
  R.add('core-breeding', 'adult pair lays an egg after breed timer', egg, {}, 'high');
  const inv0 = await page.evaluate(() => window.__dragonRanch.inventory.dragons.length);
  await page.waitForFunction((id) => !window.__dragonRanch.dragons.getBreedState(id)?.egg, bp, { timeout: 25000 }).catch(() => {});
  await frames(page, 2);
  const inv1 = await page.evaluate(() => window.__dragonRanch.inventory.dragons.length);
  R.add('core-breeding', 'egg hatches into a baby in inventory (real 15s timer)', inv1 >= inv0 + 1, { inv0, inv1, note: 'second (rotated) breeding pen may hatch too' }, 'high');

  // Feeding a baby with fruit (hotbar 9 + click)
  const baby = await page.evaluate(() => { const d = window.__dragonRanch.dragons.dragons.find((x) => x.stage < 2); d.roamTarget = { x: d.x, z: d.z }; d.roamTimer = 30; return { id: d.id, x: d.x, z: d.z, ss: d.stageStart }; });
  await setPlayer(page, baby.x, baby.z + 4, 0);
  await page.keyboard.press('9');
  await aimAt(page, baby.x, baby.z, 0.3);
  const fPrompt = await page.evaluate(() => document.getElementById('prompt').textContent);
  await page.mouse.down(); await frames(page, 1); await page.mouse.up();
  await frames(page, 2);
  const fed = await page.evaluate((id) => window.__dragonRanch.dragons.dragons.find((x) => x.id === id)?.stageStart, baby.id);
  R.add('core-feeding', 'feed baby dragonfruit (hotbar 9 + click) speeds growth', fed < baby.ss, { prompt: fPrompt, stageStartBefore: Math.round(baby.ss), after: Math.round(fed) }, 'medium');
  await page.keyboard.press('Escape');
}
