import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://127.0.0.1:5173/?demo=1', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__dragonRanch);
await page.waitForTimeout(500);
await page.evaluate(() => window.__dragonRanch.renderer.setAnimationLoop(null));

// Inventory with stats
await page.evaluate(() => {
  const g = window.__dragonRanch;
  g.ui.setMarketplace(false);
  g.ui.setDragonPanel(true);
  g.ui.updateDragonList(g.inventory.dragons, g.selectedDragonId);
  g.camera.position.set(8, 12, 16);
  g.camera.lookAt(6, 1, 2);
  g.renderer.render(g.scene, g.camera);
});
await page.screenshot({ path: path.join(__dirname, '13-inventory-stats.png') });
console.log('saved 13-inventory-stats.png');

// Legendary L50 in world + tooltip-ish view
await page.evaluate(async () => {
  const g = window.__dragonRanch;
  g.ui.setDragonPanel(false);
  const { computeDragonStats } = await import('/src/stats.js');
  const pen = g.buildings.buildings.find((b) => b.type === 'dragonPen');
  for (const d of [...g.dragons.dragons.filter((x) => x.penId === pen.id)]) {
    g.dragons.pickUp(d);
  }
  const now = performance.now();
  const d = g.dragons.place(
    { sex: 'male', stage: 2, rarity: 'Legendary', level: 50 },
    pen,
    now
  );
  g.player.mesh.position.set(d.x, 0, d.z + 3);
  g.camera.position.set(d.x + 2.5, 3.2, d.z + 5);
  g.camera.lookAt(d.x, 1.3, d.z);
  const stats = computeDragonStats('Legendary', 50);
  g.ui.setTooltip(
    g.ui.dragonTooltip(d),
    640,
    280
  );
  g.ui.toast(`Legendary L50 — HP ${stats.hp} Def ${stats.defense} Atk ${stats.attack}`, 5000, true);
  g.renderer.render(g.scene, g.camera);
  window.__legStats = stats;
});
await page.screenshot({ path: path.join(__dirname, '14-legendary-stats.png') });
const stats = await page.evaluate(() => window.__legStats);
console.log('saved 14-legendary-stats.png', stats);

console.log('errors', errors.length ? errors : '(none)');
await browser.close();
if (errors.length) process.exit(1);
