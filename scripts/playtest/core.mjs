import { setPlayer, frames, aimAt, holdKeys } from './lib.mjs';
import { placeViaUI, openMarketTabAndBuy } from './uihelpers.mjs';

export async function run(page, R, shot, { boot }) {
  const G = 'core';
  await boot('', { clear: true });
  const types = [['farmhouse', 0, 0, 0], ['farmPlot', 10, 0, 0], ['dragonPen', 20, 0, 1], ['breedingPen', 32, 0, 2], ['workerBunkhouse', -12, 0, 1], ['dragonFieldTraining', -26, 0, 3], ['farmhouse', 0, 16, 2]];
  for (const [t, x, z, rot] of types) {
    const r = await placeViaUI(page, t, x, z, rot);
    R.add('core-buildings', `place ${t} with ${rot}x R via UI`, r.ok && r.rotation === rot, r, 'high');
  }
  await setPlayer(page, 2, 14, 0.4);
  await page.evaluate(() => { const g = window.__dragonRanch; g.followCam.distance = 40; g.followCam.pitch = 0.9; });
  await frames(page, 10);
  await shot('all-buildings');
  await page.evaluate(() => { const g = window.__dragonRanch; g.followCam.distance = 16; g.followCam.pitch = 0.7; });

  // Plant 4 seeds via hotbar 7 + clicks
  const plot = await page.evaluate(() => { const b = window.__dragonRanch.buildings.buildings.find((x) => x.type === 'farmPlot'); return { id: b.id, tx: b.tx, tz: b.tz }; });
  await setPlayer(page, plot.tx + 2, plot.tz + 7, 0);
  await page.keyboard.press('7');
  const seeds0 = await page.evaluate(() => window.__dragonRanch.inventory.seeds);
  for (const [lx, lz] of [[0, 0], [1, 1], [2, 2], [3, 3]]) {
    await aimAt(page, plot.tx + lx + 0.5, plot.tz + lz + 0.5);
    await page.mouse.down(); await frames(page, 1); await page.mouse.up(); await frames(page, 2);
  }
  const planted = await page.evaluate(() => ({ crops: window.__dragonRanch.crops.serialize().length, seeds: window.__dragonRanch.inventory.seeds }));
  R.add('core-farming', 'plant 4 seeds via hotbar 7 + click', planted.crops === 4 && planted.seeds === seeds0 - 4, { seeds0, ...planted }, 'high');
  await page.keyboard.press('7'); // deselect
  // Grow: time accel test hook
  await page.evaluate(() => { const g = window.__dragonRanch; g.crops.advanceTime(10 * 60 * 1000); });
  await frames(page, 4);
  const stages = await page.evaluate(() => window.__dragonRanch.crops.serialize().map((c) => c.stage));
  const fruit0 = await page.evaluate(() => window.__dragonRanch.inventory.dragonfruit);
  for (const [lx, lz] of [[0, 0], [1, 1], [2, 2], [3, 3]]) {
    await aimAt(page, plot.tx + lx + 0.5, plot.tz + lz + 0.5);
    await page.mouse.down(); await frames(page, 1); await page.mouse.up(); await frames(page, 2);
  }
  const harvested = await page.evaluate(() => ({ crops: window.__dragonRanch.crops.serialize().length, fruit: window.__dragonRanch.inventory.dragonfruit }));
  R.add('core-farming', 'crops grow to stage 4 and harvest by click', stages.every((s) => s >= 4) && harvested.fruit > fruit0, { stages, fruit0, ...harvested }, 'high');

  // Rest at farmhouse door (rotation 0, door on -z face)
  const fh = await page.evaluate(() => window.__dragonRanch.buildings.buildings.filter((b) => b.type === 'farmhouse').map((b) => ({ tx: b.tx, tz: b.tz, w: b.w, d: b.d, rot: b.rotation })));
  await page.evaluate(() => { const g = window.__dragonRanch; g.energy = 20; g.ui.updateEnergy(20); });
  await setPlayer(page, fh[0].tx + fh[0].w / 2, fh[0].tz - 1.2, 0);
  const restPrompt = await page.evaluate(() => document.getElementById('prompt').textContent);
  const gt0 = await page.evaluate(() => window.__dragonRanch.gameTime);
  await page.keyboard.press('f');
  await page.waitForTimeout(400);
  const resting = await page.evaluate(() => window.__dragonRanch._resting);
  await page.waitForTimeout(3000);
  const rest = await page.evaluate(() => ({ resting: window.__dragonRanch._resting, energy: window.__dragonRanch.energy, gameTime: window.__dragonRanch.gameTime }));
  R.add('core-rest', 'F at farmhouse door rests (fade, time skip, energy refilled)', resting && !rest.resting && rest.energy === 100 && rest.gameTime > gt0 + 10000, { restPrompt, gt0: Math.round(gt0), ...rest }, 'high');
  // Rotated (180°) farmhouse: door faces +z. Rest prompt should be at the real door, not the back wall.
  const f2 = fh[1];
  await setPlayer(page, f2.tx + f2.w / 2, f2.tz + f2.d + 1.2, 0);
  const atDoor = await page.evaluate(() => document.getElementById('prompt').textContent);
  await setPlayer(page, f2.tx + f2.w / 2, f2.tz - 1.2, 0);
  const atBack = await page.evaluate(() => document.getElementById('prompt').textContent);
  R.add('core-rest', 'rotated farmhouse: rest prompt at the actual door, not the back wall', /rest/i.test(atDoor) && !/rest/i.test(atBack), { atDoor, atBack }, 'medium');

  // Marketplace purchase (building) with coins
  const inv0 = await page.evaluate(() => ({ coins: window.__dragonRanch.coins, bunks: window.__dragonRanch.inventory.workerBunkhouses }));
  await openMarketTabAndBuy(page, 'bld-worker-bunkhouse', 1);
  const inv1 = await page.evaluate(() => ({ coins: window.__dragonRanch.coins, bunks: window.__dragonRanch.inventory.workerBunkhouses }));
  R.add('core-market', 'buy Worker Bunkhouse (75 coins) → inventory +1', inv1.coins === inv0.coins - 75 && inv1.bunks === inv0.bunks + 1, { inv0, inv1 }, 'high');
  await shot('marketplace-buy');
  await page.keyboard.press('Escape');
}
