import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://127.0.0.1:5173/?demo=1', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction(() => window.__dragonRanch, { timeout: 30000 });
await page.waitForTimeout(800);
await page.evaluate(() => window.__dragonRanch.renderer.setAnimationLoop(null));

async function shot(name, fn) {
  const meta = await page.evaluate(fn);
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(__dirname, name) });
  console.log('saved', name, meta);
}

await shot('15-xp-inventory.png', () => {
  const g = window.__dragonRanch;
  let adult = g.inventory.dragons.find((d) => d.stage >= 2);
  if (!adult) {
    adult = g.inventory.dragons[0];
    if (adult) adult.stage = 2;
  }
  if (adult) {
    adult.xp = 55;
    adult.level = adult.level || 1;
  }
  g.ui.setMarketplace(false);
  g.ui.setDragonPanel(true);
  g.ui.updateDragonList(g.inventory.dragons, g.selectedDragonId);
  g._refreshHud();
  g.camera.position.set(8, 12, 16);
  g.camera.lookAt(5, 1, 2);
  g.renderer.render(g.scene, g.camera);
  return { dragons: g.inventory.dragons.length, xp: adult?.xp };
});

await shot('16-bunkhouse.png', () => {
  const g = window.__dragonRanch;
  g.ui.setDragonPanel(false);
  g.ui.setMarketplace(false);
  const bunk = g.buildings.buildings.find((b) => b.type === 'workerBunkhouse');
  const cx = bunk ? bunk.tx + bunk.w / 2 : -12;
  const cz = bunk ? bunk.tz + bunk.d / 2 : 3;
  g.player.mesh.position.set(cx, 0, cz + 8);
  g.camera.position.set(cx + 6, 8, cz + 14);
  g.camera.lookAt(cx, 1.5, cz);
  g.renderer.render(g.scene, g.camera);
  return {
    bunk: !!bunk,
    workers: g.workers.count(),
    cap: g.buildings.bunkCapacity(),
  };
});

await shot('17-marketplace-handler.png', () => {
  const g = window.__dragonRanch;
  g.ui.setMarketplace(true);
  g.ui.marketplaceTab = 'farmWorkers';
  g.ui._buildMarketTabs();
  g.ui._renderMarketBody();
  g.ui.updateCoins(g.coins);
  g.camera.position.set(10, 12, 18);
  g.camera.lookAt(5, 1, 2);
  g.renderer.render(g.scene, g.camera);
  return { coins: g.coins, tab: g.ui.marketplaceTab };
});

await shot('18-hire-fail.png', () => {
  const g = window.__dragonRanch;
  // Fill capacity then attempt hire → fail toast
  const listing = {
    id: 'worker-dragon-handler',
    name: 'Dragon Handler',
    price: 50,
    grant: { kind: 'worker', key: 'dragonHandler' },
  };
  let last = null;
  for (let i = 0; i < 8; i++) last = g._purchase(listing);
  g.ui.setMarketplace(true);
  g.ui.marketplaceTab = 'farmWorkers';
  g.ui._buildMarketTabs();
  g.ui._renderMarketBody();
  g.ui.toast(last.message, 5000, !!last.ok);
  g._refreshHud();
  g.camera.position.set(10, 12, 18);
  g.camera.lookAt(5, 1, 2);
  g.renderer.render(g.scene, g.camera);
  return { workers: g.workers.count(), cap: g.buildings.bunkCapacity(), last };
});

await shot('19-hire-success.png', () => {
  const g = window.__dragonRanch;
  // Reset to one free bunk for success shot
  while (g.workers.workers.length > 0) {
    const w = g.workers.workers.pop();
    g.scene.remove(w.mesh);
  }
  g.coins = 200;
  const listing = {
    id: 'worker-dragon-handler',
    name: 'Dragon Handler',
    price: 50,
    grant: { kind: 'worker', key: 'dragonHandler' },
  };
  const last = g._purchase(listing);
  g.ui.setMarketplace(true);
  g.ui.marketplaceTab = 'farmWorkers';
  g.ui._buildMarketTabs();
  g.ui._renderMarketBody();
  g.ui.toast(last.message, 5000, !!last.ok);
  g._refreshHud();
  g.camera.position.set(10, 12, 18);
  g.camera.lookAt(5, 1, 2);
  g.renderer.render(g.scene, g.camera);
  return { workers: g.workers.count(), coins: g.coins, last };
});

console.log('errors', errors.filter((e) => !e.includes('Clock')).slice(0, 10));
await browser.close();
const fatal = errors.filter((e) => !/Clock|deprecated/i.test(e));
if (fatal.length) process.exit(1);
