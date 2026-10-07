import { setPlayer, frames, aimAt, holdKeys } from './lib.mjs';

const rect = (page, sel) => page.$eval(sel, (el) => { const cs = getComputedStyle(el); if (el.classList.contains('hidden') || cs.display === 'none' || cs.visibility === 'hidden') return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }).catch(() => null);
const overlap = (a, b) => a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export async function run(page, R, shot, { boot }) {
  const G = 'ui';
  await boot('?demo=1', { clear: true });
  // Keys while marketplace open
  await setPlayer(page, 4, 14, 0);
  await page.keyboard.press('m'); await frames(page, 2);
  const p0 = await page.evaluate(() => ({ x: window.__dragonRanch.player.position.x, z: window.__dragonRanch.player.position.z, sel: window.__dragonRanch.ui.selected }));
  await page.keyboard.press('1'); await frames(page, 2);
  await holdKeys(page, ['w'], 500);
  const p1 = await page.evaluate(() => ({ x: window.__dragonRanch.player.position.x, z: window.__dragonRanch.player.position.z, sel: window.__dragonRanch.ui.selected, open: window.__dragonRanch.ui.marketplaceOpen }));
  R.add(G, 'hotbar keys ignored while Marketplace is open', p1.sel === p0.sel, { before: p0.sel, after: p1.sel }, 'low');
  R.add(G, 'movement while Marketplace open (info: player can walk with panel open)', null, { moved: +Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(2) });
  await page.evaluate(() => window.__dragonRanch.ui.select(null));
  // Overlaps with HUD for each panel
  const hud = { help: await rect(page, '#help-panel'), hotbar: await rect(page, '#hotbar'), inv: await rect(page, '#inv-strip'), day: await rect(page, '#day-ind') };
  const ov = {};
  for (const [key, sel] of [['m', '#market-panel'], ['i', '#dragon-panel'], ['n', '#mission-panel']]) {
    await page.evaluate(() => { const g = window.__dragonRanch; while (g.ui.closeTopPanel()); });
    await page.keyboard.press(key); await frames(page, 3);
    const r = await rect(page, sel);
    ov[sel] = Object.entries(hud).filter(([, h]) => overlap(r, h)).map(([k]) => k);
    await shot(`panel-${sel.slice(1)}`);
  }
  R.add(G, 'panels do not overlap HUD (help/hotbar/inventory/day)', Object.values(ov).every((v) => v.length === 0), { overlaps: ov, hud }, 'low');
  // Esc closes top panel, then deselects
  await page.evaluate(() => { const g = window.__dragonRanch; while (g.ui.closeTopPanel()); });
  await page.keyboard.press('3'); await page.keyboard.press('n'); await frames(page, 2);
  await page.keyboard.press('Escape'); await frames(page, 2);
  const e1 = await page.evaluate(() => ({ missions: window.__dragonRanch.ui.missionsOpen, sel: window.__dragonRanch.ui.selected }));
  await page.keyboard.press('Escape'); await frames(page, 2);
  const e2 = await page.evaluate(() => ({ missions: window.__dragonRanch.ui.missionsOpen, sel: window.__dragonRanch.ui.selected }));
  R.add(G, 'Esc closes top panel first, then clears selection', !e1.missions && e1.sel === 'dragonPen' && e2.sel == null, { afterFirstEsc: e1, afterSecondEsc: e2 }, 'low');

  // E tap at farmhouse door: should only rotate camera, not rest
  const fh = await page.evaluate(() => { const b = window.__dragonRanch.buildings.buildings.find((x) => x.type === 'farmhouse'); return { tx: b.tx, tz: b.tz, w: b.w }; });
  await setPlayer(page, fh.tx + fh.w / 2, fh.tz - 1.2, 0);
  await page.keyboard.press('e');
  await page.waitForTimeout(300);
  const restE = await page.evaluate(() => window.__dragonRanch._resting);
  R.add(G, 'tapping E (camera rotate key) near the door does not trigger rest/interact', !restE, { restingAfterE: restE }, 'medium');
  await page.waitForTimeout(3000);
  // E with a building selected must not place it
  await setPlayer(page, 60, 60, 0);
  await page.keyboard.press('2'); await aimAt(page, 60.5, 55.5);
  const nB = await page.evaluate(() => window.__dragonRanch.buildings.buildings.length);
  await page.keyboard.press('e'); await frames(page, 3);
  const nB2 = await page.evaluate(() => window.__dragonRanch.buildings.buildings.length);
  R.add(G, 'tapping E with a build item selected does not place it', nB2 === nB, { before: nB, after: nB2 }, 'medium');
  await page.keyboard.press('Escape');

  // Clicking a ripe crop while a handler stands nearby should harvest, not open Missions
  const crop = await page.evaluate(() => {
    const g = window.__dragonRanch; const c = g.crops.serialize().find((x) => x.stage >= 4); const plot = g.buildings.buildings.find((b) => b.type === 'farmPlot');
    const w = g.workers.workers[0];
    const wx = plot.tx + c.lx + 0.5, wz = plot.tz + c.lz + 0.5;
    g.player.mesh.position.set(wx, 0, wz + 4);
    w.x = wx + 1.5; w.z = wz + 3; w.mesh.position.set(w.x, 0, w.z); w.roamTarget = { x: w.x, z: w.z }; w.roamTimer = 30;
    g.followCam.target.set(wx, 1.2, wz + 4);
    return { x: wx, z: wz, n: g.crops.serialize().length };
  });
  await frames(page, 3);
  await aimAt(page, crop.x, crop.z);
  await page.mouse.down(); await frames(page, 1); await page.mouse.up(); await frames(page, 3);
  const after = await page.evaluate(() => ({ missionsOpen: window.__dragonRanch.ui.missionsOpen, crops: window.__dragonRanch.crops.serialize().length }));
  R.add(G, 'click on ripe crop near a handler harvests (does not hijack into Missions)', !after.missionsOpen && after.crops === crop.n - 1, { cropsBefore: crop.n, ...after }, 'medium');
  await page.evaluate(() => { const g = window.__dragonRanch; while (g.ui.closeTopPanel()); });

  // Focus loss while holding W: player should stop
  await setPlayer(page, 80, 80, 0);
  await page.keyboard.down('w');
  await page.waitForTimeout(200);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(150);
  const b0 = await page.evaluate(() => window.__dragonRanch.player.position.z);
  await page.waitForTimeout(700);
  const b1 = await page.evaluate(() => ({ z: window.__dragonRanch.player.position.z, moving: window.__dragonRanch.player.moving }));
  await page.keyboard.up('w');
  R.add(G, 'held keys released on window blur (no stuck movement after alt-tab)', Math.abs(b1.z - b0) < 0.05, { movedAfterBlur: +Math.abs(b1.z - b0).toFixed(2) }, 'medium');
}
