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
await page.waitForTimeout(600);

// Freeze the game loop so camera stays put
await page.evaluate(() => {
  const g = window.__dragonRanch;
  g.renderer.setAnimationLoop(null);
});

async function hardShot(name, cam, look, playerPos) {
  await page.evaluate(({ cam, look, playerPos }) => {
    const g = window.__dragonRanch;
    if (playerPos) g.player.mesh.position.set(...playerPos);
    g.camera.position.set(...cam);
    g.camera.lookAt(...look);
    g.camera.updateMatrixWorld(true);
    // keep day lighting nice
    g.sun.position.set(look[0] + 40, 60, look[2] + 20);
    g.sun.target.position.set(...look);
    g.sun.target.updateMatrixWorld();
    g.renderer.render(g.scene, g.camera);
  }, { cam, look, playerPos });
  await page.screenshot({ path: path.join(__dirname, name) });
  console.log('saved', name);
}

// House center ≈ (-1, —, 1); plot center ≈ (8, —, 2); pen ≈ (16, —, 2)
await hardShot('03-demo-scene.png', [14, 16, 20], [6, 1.2, 2], [6, 0, 12]);
await hardShot('04-demo-closeup.png', [10, 8, 14], [5, 2, 2], [5, 0, 9]);

// Farmhouse closeup from south-east — door on south should be visible
await hardShot('05-farmhouse-closeup.png', [5, 4.5, 9], [-1, 2.4, 1], [1, 0, 7]);

// Side (east gable) and true front (south door)
await hardShot('05b-farmhouse-side.png', [8, 3.8, 1], [-1, 2.6, 1], [5, 0, 1]);
await hardShot('05c-farmhouse-front.png', [-1, 3.5, -6], [-1, 2.2, 1], [-1, 0, -3]);

// Rotated 90° house
await page.evaluate(() => {
  const g = window.__dragonRanch;
  g.buildings.place('farmhouse', -16, -2, 1);
});
await hardShot('05d-farmhouse-rotated.png', [-6, 6, 10], [-12, 2.5, 2], [-8, 0, 8]);

console.log('errors', errors.length ? errors : '(none)');
await browser.close();
if (errors.length) process.exit(1);
