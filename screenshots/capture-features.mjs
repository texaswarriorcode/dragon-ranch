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
await page.waitForTimeout(800);

await page.evaluate(() => {
  window.__dragonRanch.renderer.setAnimationLoop(null);
});

async function shot(name, fn) {
  await page.evaluate(fn);
  await page.waitForTimeout(50);
  await page.evaluate(({ cam, look }) => {
    const g = window.__dragonRanch;
    if (cam) {
      g.camera.position.set(...cam);
      g.camera.lookAt(...look);
      g.sun.position.set(look[0] + 30, 50, look[2] + 20);
      g.sun.target.position.set(...look);
      g.sun.target.updateMatrixWorld();
    }
    g.renderer.render(g.scene, g.camera);
  }, await page.evaluate(fn).then(() => ({})));
  // re-run setup for cam
  const setup = await page.evaluate(fn);
  if (setup?.cam) {
    await page.evaluate(({ cam, look }) => {
      const g = window.__dragonRanch;
      g.camera.position.set(...cam);
      g.camera.lookAt(...look);
      g.renderer.render(g.scene, g.camera);
    }, setup);
  } else {
    await page.evaluate(() => {
      const g = window.__dragonRanch;
      g.renderer.render(g.scene, g.camera);
    });
  }
  await page.screenshot({ path: path.join(__dirname, name) });
  console.log('saved', name, setup);
}

// Simpler shot helper
async function hardShot(name, setupFn) {
  const meta = await page.evaluate(setupFn);
  await page.screenshot({ path: path.join(__dirname, name) });
  console.log('saved', name, meta);
}

await hardShot('06-breeding-pen.png', () => {
  const g = window.__dragonRanch;
  g.player.mesh.visible = true;
  g.player.mesh.position.set(26, 0, 10);
  g.ui.setDragonPanel(false);
  g.camera.position.set(30, 12, 16);
  g.camera.lookAt(26, 1, 2);
  g.renderer.render(g.scene, g.camera);
  const bp = g.buildings.buildings.find((b) => b.type === 'breedingPen');
  const st = bp ? g.dragons.getBreedState(bp.id) : null;
  return {
    dragons: g.dragons.dragonsInPen(bp?.id).length,
    egg: !!st?.egg,
    rarity: st?.egg?.rarity,
  };
});

await hardShot('07-dragon-inventory.png', () => {
  const g = window.__dragonRanch;
  g.ui.setDragonPanel(true);
  g.ui.updateDragonList(g.inventory.dragons, g.selectedDragonId);
  g.ui.setCreativeVisible(true);
  g.camera.position.set(8, 14, 18);
  g.camera.lookAt(8, 0, 2);
  g.renderer.render(g.scene, g.camera);
  return { count: g.inventory.dragons.length };
});

await hardShot('08-legendary-closeup.png', () => {
  const g = window.__dragonRanch;
  g.ui.setDragonPanel(false);
  // Place a legendary adult in world near camera
  const pen = g.buildings.buildings.find((b) => b.type === 'dragonPen');
  // Remove existing and place legendary
  for (const d of [...g.dragons.dragons]) {
    if (d.penId === pen.id) g.dragons.pickUp(d);
  }
  const now = performance.now();
  g.dragons.place({ sex: 'male', stage: 2, rarity: 'Legendary' }, pen, now);
  g.dragons.place({ sex: 'female', stage: 2, rarity: 'Legendary' }, pen, now);
  const d = g.dragons.dragons.find((x) => x.rarity === 'Legendary');
  g.player.mesh.position.set(d.x, 0, d.z + 4);
  g.camera.position.set(d.x + 3, 3.5, d.z + 6);
  g.camera.lookAt(d.x, 1.2, d.z);
  g.renderer.render(g.scene, g.camera);
  return { at: [d.x, d.z], rarity: d.rarity };
});

await hardShot('09-rest-toast.png', () => {
  const g = window.__dragonRanch;
  g.player.mesh.position.set(-1, 0, 4);
  g.camera.position.set(4, 6, 12);
  g.camera.lookAt(-1, 1.5, 1);
  g.ui.setPrompt('Press F to rest');
  g.ui.toast('You feel rested');
  g.fadeEl.classList.add('active');
  g.fadeEl.style.opacity = '0.55';
  g.renderer.render(g.scene, g.camera);
  return { energy: g.energy };
});

// Restore fade for cleanliness
await page.evaluate(() => {
  window.__dragonRanch.fadeEl?.classList.remove('active');
  window.__dragonRanch.ui.fadeEl.style.opacity = '';
});

console.log('errors', errors.length ? errors : '(none)');
await browser.close();
if (errors.length) process.exit(1);
