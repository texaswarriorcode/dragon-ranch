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

await page.evaluate(() => {
  const g = window.__dragonRanch;
  g.player.mesh.position.set(-1, 0, 4);
  g.camera.position.set(4, 6, 12);
  g.camera.lookAt(-1, 1.5, 1);
  g.ui.setPrompt('Press F to rest');
  g.ui.toast('You feel rested');
  g.ui.fadeEl.classList.add('active');
  g.ui.fadeEl.style.transition = 'none';
  g.ui.fadeEl.style.opacity = '0.5';
  g.renderer.render(g.scene, g.camera);
});
await page.screenshot({ path: path.join(__dirname, '09-rest-toast.png') });
console.log('saved 09-rest-toast.png');
console.log('errors', errors.length ? errors : '(none)');
await browser.close();
if (errors.length) process.exit(1);
