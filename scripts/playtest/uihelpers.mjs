import { setPlayer, aimAt, frames } from './lib.mjs';

export const KEY_FOR = { farmhouse: '1', farmPlot: '2', dragonPen: '3', breedingPen: '4', workerBunkhouse: '5', dragonFieldTraining: '6' };

/** Place a building through the real UI: hotbar key, R rotations, mouse aim, left click. */
export async function placeViaUI(page, type, ax, az, rot = 0, standOff = { x: 0, z: 6 }) {
  await page.evaluate(() => { const g = window.__dragonRanch; g.ui.select(null); });
  await setPlayer(page, ax + standOff.x, az + standOff.z, 0);
  const before = await page.evaluate(() => window.__dragonRanch.buildings.buildings.length);
  await page.keyboard.press(KEY_FOR[type]);
  await frames(page, 2);
  for (let i = 0; i < rot; i++) { await page.keyboard.press('r'); await frames(page, 2); }
  await aimAt(page, ax + 0.5, az + 0.5);
  const prompt = await page.evaluate(() => document.getElementById('prompt')?.textContent || '');
  await page.mouse.down(); await frames(page, 1); await page.mouse.up();
  await frames(page, 3);
  const after = await page.evaluate(() => {
    const g = window.__dragonRanch; const b = g.buildings.buildings[g.buildings.buildings.length - 1];
    return { n: g.buildings.buildings.length, last: b && { id: b.id, type: b.type, tx: b.tx, tz: b.tz, w: b.w, d: b.d, rotation: b.rotation } };
  });
  await page.keyboard.press('Escape');
  await frames(page, 2);
  return { ok: after.n === before + 1 && after.last.type === type, prompt, ...after.last };
}

export async function openMarketTabAndBuy(page, listingId, times = 1) {
  const res = [];
  if (!(await page.evaluate(() => window.__dragonRanch.ui.marketplaceOpen))) { await page.keyboard.press('m'); await frames(page, 3); }
  const tabs = await page.$$eval('.market-tab', (els) => els.map((e) => e.dataset.id));
  for (const t of tabs) {
    await page.click(`.market-tab[data-id="${t}"]`);
    await frames(page, 1);
    if (await page.$(`.market-buy[data-id="${listingId}"]`)) break;
  }
  for (let i = 0; i < times; i++) {
    const before = await page.evaluate(() => ({ coins: window.__dragonRanch.coins, workers: window.__dragonRanch.workers.workers.length }));
    await page.click(`.market-buy[data-id="${listingId}"]`);
    await frames(page, 2);
    const after = await page.evaluate(() => ({ coins: window.__dragonRanch.coins, workers: window.__dragonRanch.workers.workers.length, toast: document.getElementById('toast')?.textContent }));
    res.push({ before, after });
  }
  return res;
}
