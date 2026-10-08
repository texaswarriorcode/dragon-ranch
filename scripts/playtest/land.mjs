// Map expansions: market Land tab, prices, movement / placement bounds, L-shape, save + migration.
import { holdKeys, setPlayer, frames } from './lib.mjs';
import { placeViaUI } from './uihelpers.mjs';

const EXPECTED = [0, 1000, 10000, 20000, 30000, 40000, 50000, 60000];
const st = (page) => page.evaluate(() => {
  const g = window.__dragonRanch;
  return { owned: g.land.serialize().sort(), coins: g.coins, next: g.land.nextPrice(), overlays: g.world._fogged.size, p: { x: +g.player.position.x.toFixed(3), z: +g.player.position.z.toFixed(3) } };
});
const setCoins = (page, n) => page.evaluate((n) => { const g = window.__dragonRanch; g.coins = n; g.ui.updateCoins(n); }, n);

async function openLandTab(page) {
  if (!(await page.evaluate(() => window.__dragonRanch.ui.marketplaceOpen))) { await page.keyboard.press('m'); await frames(page, 3); }
  await page.click('.market-tab[data-id="land"]');
  await frames(page, 2);
}
async function closeMarket(page) {
  if (await page.evaluate(() => window.__dragonRanch.ui.marketplaceOpen)) { await page.keyboard.press('m'); await frames(page, 3); }
}
async function cards(page) {
  return page.$$eval('.land-card', (els) => els.map((e) => ({
    id: e.dataset.region, cls: e.className, price: e.querySelector('.market-price')?.textContent.trim(),
    desc: e.querySelector('.market-card-desc')?.textContent.trim(), btn: e.querySelector('button')?.textContent.trim(),
    disabled: e.querySelector('button')?.disabled,
  })));
}
async function buyUI(page, id) {
  const before = await st(page);
  await page.click(`.land-buy[data-region="${id}"]`);
  await frames(page, 2);
  const after = await st(page);
  const toast = await page.evaluate(() => document.getElementById('toast')?.textContent || '');
  return { id, before: before.coins, after: after.coins, paid: before.coins - after.coins, owned: after.owned.includes(id), toast };
}
async function walk(page, x, z, keys, ms = 1600) {
  await setPlayer(page, x, z, 0);
  await holdKeys(page, keys, ms);
  await frames(page, 2);
  return (await st(page)).p;
}

export async function run(page, R, shot, { boot, url }) {
  const G = 'land';
  await boot('', { clear: true });
  let s = await st(page);
  R.add(G, 'new game owns only the home region; 8 unowned regions are fogged', s.owned.join() === 'C' && s.overlays === 8, s, 'high');
  const cfg = await page.evaluate(() => { const g = window.__dragonRanch; return { prices: g._landState().prices, total: g.land.totalExpansions }; });
  R.add(G, 'config price table = [0,1000,10000,20000,...,60000] for 8 expansions', JSON.stringify(cfg.prices) === JSON.stringify(EXPECTED) && cfg.total === 8, cfg, 'high');

  // ---- Market Land tab
  await setCoins(page, 0);
  await openLandTab(page);
  let c = await cards(page);
  const avail = c.filter((x) => /available/.test(x.cls)).map((x) => x.id).sort();
  const locked = c.filter((x) => /locked/.test(x.cls));
  R.add(G, 'Land tab lists 8 expansions: N/E/S/W available, corners locked with a reason', c.length === 8 && avail.join() === 'E,N,S,W' && locked.length === 4 && locked.every((x) => /Buy .+ or .+ first/.test(x.desc) && x.disabled), { cards: c }, 'high');
  const header = await page.$eval('.land-next', (e) => e.textContent);
  R.add(G, 'header shows next expansion FREE + 3x3 minimap', /FREE/.test(header) && (await page.$$('.land-map.big .land-cell')).length === 9, { header });
  await shot('market-land-tab');

  // ---- 1st free (with 0 coins), 2nd 1000
  const b1 = await buyUI(page, 'N');
  R.add(G, '1st expansion (North) is free — bought with 0 coins', b1.owned && b1.paid === 0, b1, 'critical');
  const fading = await page.evaluate(() => window.__dragonRanch.world._fading.length);
  R.add(G, 'purchase toast + reveal fade', /unlocked/i.test(b1.toast) && fading > 0, { toast: b1.toast, fading });
  c = await cards(page);
  R.add(G, 'after N: price shows 1,000 and NE/NW become available', c.find((x) => x.id === 'E').price.includes('1,000') && /available/.test(c.find((x) => x.id === 'NE').cls) && /available/.test(c.find((x) => x.id === 'NW').cls), { cards: c.map((x) => [x.id, x.cls.split(' ').pop(), x.price]) });
  await setCoins(page, 999);
  const poor = await buyUI(page, 'E');
  R.add(G, '2nd expansion refused with 999 coins', !poor.owned && poor.paid === 0 && /1,?000/.test(poor.toast), poor, 'high');
  await setCoins(page, 1000);
  const b2 = await buyUI(page, 'E');
  R.add(G, '2nd expansion (East) costs 1000', b2.owned && b2.paid === 1000 && b2.after === 0, b2, 'critical');
  await closeMarket(page);
  s = await st(page);
  R.add(G, 'owned = C,E,N; 6 overlays left', s.owned.join() === 'C,E,N' && s.overlays === 6, s);

  // ---- Movement into owned / unowned land (real keys)
  let p = await walk(page, 0, -497, ['w']);
  R.add(G, 'walk north from home into owned North expansion', p.z < -501, p, 'critical');
  p = await walk(page, 497, 0, ['d']);
  R.add(G, 'walk east into owned East expansion', p.x > 501, p, 'critical');
  p = await walk(page, -496, 0, ['a']);
  R.add(G, 'blocked at unowned West edge (stops flush at -498.5)', Math.abs(p.x - -498.5) < 0.05, p, 'critical');
  p = await walk(page, 0, 496, ['s']);
  R.add(G, 'blocked at unowned South edge (stops flush at 498.5)', Math.abs(p.z - 498.5) < 0.05, p, 'critical');
  // L-shape: C + N + E, NE (x>500, z<-500) unowned
  p = await walk(page, 496, -600, ['d']);
  R.add(G, 'L-shape: from North, cannot walk east into unowned NE', Math.abs(p.x - 498.5) < 0.05, p, 'critical');
  p = await walk(page, 600, -496, ['w']);
  R.add(G, 'L-shape: from East, cannot walk north into unowned NE', Math.abs(p.z - -498.5) < 0.05, p, 'critical');
  p = await walk(page, 494, -494, ['w', 'd'], 2000);
  R.add(G, 'L-shape inner corner: diagonal walk never enters NE', !(p.x > 498.5 + 1e-6 && p.z < -498.5 - 1e-6), p, 'critical');
  const occ = await page.evaluate(() => { const l = window.__dragonRanch.land; return { NE: l.canOccupy(600, -600, 1.5), N: l.canOccupy(0, -800, 1.5), E: l.canOccupy(800, 0, 1.5), W: l.canOccupy(-800, 0, 1.5) }; });
  R.add(G, 'canOccupy: N/E true, NE/W false', occ.N && occ.E && !occ.NE && !occ.W, occ);
  p = await walk(page, 1496, 0, ['d']);
  R.add(G, 'map edge in East expansion stops at 1498.5', Math.abs(p.x - 1498.5) < 0.05, p, 'high');

  // ---- Building placement
  const inN = await placeViaUI(page, 'farmhouse', 0, -540, 0);
  R.add(G, 'farmhouse placed inside North expansion', inN.ok, inN, 'critical');
  const inW = await placeViaUI(page, 'farmPlot', -540, 0, 0);
  R.add(G, 'placement blocked on unowned West land, with land prompt', !inW.ok && /Land not owned/.test(inW.prompt), inW, 'critical');
  const can = await page.evaluate(() => {
    const b = window.__dragonRanch.buildings;
    return { straddleW: b.canPlace('farmPlot', -502, 0, 0), straddleN: b.canPlace('farmPlot', 0, -502, 0), NE: b.canPlace('farmPlot', 600, -600, 0), E: b.canPlace('farmPlot', 700, 10, 0) };
  });
  R.add(G, 'canPlace: across owned N edge ok; across W edge / in NE blocked', can.straddleN && !can.straddleW && !can.NE && can.E, can);
  await setPlayer(page, 0, -520, 0);
  await page.evaluate(() => { const g = window.__dragonRanch; g.followCam.distance = 60; g.followCam.pitch = 0.75; g.followCam.yaw = -0.6; });
  await frames(page, 8);
  await shot('expansion-building');
  await setPlayer(page, -485, 30, Math.PI / 2);
  await page.evaluate(() => { const g = window.__dragonRanch; g.followCam.distance = 45; g.followCam.pitch = 0.55; g.followCam.yaw = Math.PI / 2 + 0.4; });
  await frames(page, 8);
  await shot('world-border');
  await setPlayer(page, 485, -485, 0);
  await page.evaluate(() => { const g = window.__dragonRanch; g.followCam.distance = 60; g.followCam.pitch = 0.8; g.followCam.yaw = -Math.PI / 4; });
  await frames(page, 8);
  await shot('l-shape-corner');
  await page.evaluate(() => { const g = window.__dragonRanch; g.followCam.distance = 16; g.followCam.pitch = 0.7; });

  // ---- Save / reload persistence
  await setPlayer(page, 0, -560, 0);
  await boot('');
  s = await st(page);
  const bN = await page.evaluate(() => window.__dragonRanch.buildings.buildings.filter((b) => b.tz < -500).length);
  R.add(G, 'reload: owned expansions, player in expansion, and building persist', s.owned.join() === 'C,E,N' && s.overlays === 6 && bN === 1 && s.p.z < -500, { ...s, buildingsInN: bN }, 'critical');
  // Old save (no `land` key) → home only
  await page.evaluate(() => {
    const g = window.__dragonRanch; g._saveDisabled = true;
    const k = Object.keys(localStorage).find((k) => /dragon/i.test(k));
    const d = JSON.parse(localStorage.getItem(k)); delete d.land; d.player.x = 0; d.player.z = 0; localStorage.setItem(k, JSON.stringify(d));
  });
  await boot('');
  s = await st(page);
  R.add(G, 'old save without land data migrates to home region only', s.owned.join() === 'C' && s.overlays === 8 && s.next === 0, s, 'high');

  // ---- Full price ladder via UI (no creative)
  await boot('', { clear: true });
  await setCoins(page, 1000000);
  await openLandTab(page);
  const order = ['N', 'E', 'S', 'W', 'NE', 'SE', 'SW', 'NW'];
  const ladder = [];
  for (const id of order) {
    const shown = (await cards(page)).find((x) => x.id === id).price;
    const r = await buyUI(page, id);
    ladder.push({ id, shown, paid: r.paid, owned: r.owned });
  }
  R.add(G, 'prices for expansions 1..8 = 0,1000,10000,20000,30000,40000,50000,60000 (shown + charged)', ladder.every((l, i) => l.owned && l.paid === EXPECTED[i]) && ladder[0].shown === 'FREE' && ladder[7].shown.includes('60,000'), { ladder }, 'critical');
  s = await st(page);
  const allHdr = await page.$eval('.land-next', (e) => e.textContent);
  R.add(G, 'all 8 owned: no overlays, header says all owned', s.overlays === 0 && s.next === null && /All land owned/.test(allHdr) && s.coins === 1000000 - 211000, { ...s, allHdr });
  await closeMarket(page);

  // ---- Creative unlock all
  await boot('', { clear: true });
  await page.evaluate(() => window.__dragonRanch.ui.onToggleCreative());
  await openLandTab(page);
  await page.click('#land-unlock-all');
  await frames(page, 2);
  s = await st(page);
  R.add(G, 'Creative: "Unlock all" owns all 9 regions', s.owned.length === 9 && s.overlays === 0, s, 'high');
  await closeMarket(page);
  p = await walk(page, -1000, -1000, ['w', 'a'], 1500);
  R.add(G, 'can roam in NW corner region after unlock all', p.x < -1000 && p.z < -1000, p);
  await page.evaluate(() => window.__dragonRanch.ui.onToggleCreative());
  await boot('', { clear: true });
}
