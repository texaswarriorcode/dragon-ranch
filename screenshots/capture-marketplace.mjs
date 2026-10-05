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
await page.waitForTimeout(400);
await page.evaluate(() => window.__dragonRanch.renderer.setAnimationLoop(null));

async function shot(name, tabId) {
  await page.evaluate((tabId) => {
    const g = window.__dragonRanch;
    g.ui.setMarketplace(true);
    if (tabId) {
      g.ui.marketplaceTab = tabId;
      g.ui._buildMarketTabs();
      g.ui._renderMarketBody();
    }
    g.camera.position.set(10, 12, 18);
    g.camera.lookAt(5, 1, 2);
    g.renderer.render(g.scene, g.camera);
  }, tabId);
  await page.screenshot({ path: path.join(__dirname, name) });
  console.log('saved', name, tabId);
}

await shot('10-marketplace-main.png', 'farmPlots');
await shot('11-marketplace-dragons.png', 'dragons');
await shot('12-marketplace-workers.png', 'farmWorkers');

// Esc closes marketplace
const closed = await page.evaluate(() => {
  const g = window.__dragonRanch;
  g.ui.setMarketplace(true);
  g.ui.setDragonPanel(true); // should close market, open dragons
  const afterDragon = { market: g.ui.marketplaceOpen, dragon: g.ui.dragonPanelOpen };
  g.ui.setMarketplace(true);
  g.ui.closeTopPanel();
  return { afterDragon, afterEsc: { market: g.ui.marketplaceOpen, dragon: g.ui.dragonPanelOpen } };
});
console.log('panel stack', closed);

// M key via keyboard
await page.evaluate(() => window.__dragonRanch.ui.setMarketplace(false));
await page.keyboard.press('m');
await page.waitForTimeout(50);
const mOpen = await page.evaluate(() => window.__dragonRanch.ui.marketplaceOpen);
console.log('M opens market', mOpen);

console.log('errors', errors.length ? errors : '(none)');
await browser.close();
if (errors.length) process.exit(1);
