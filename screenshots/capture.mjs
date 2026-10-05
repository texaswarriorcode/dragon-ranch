import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = __dirname;
const BASE = 'http://127.0.0.1:5173';

const consoleErrors = [];
const pageErrors = [];

async function waitFrames(page, n = 30) {
  await page.evaluate(async (frames) => {
    await new Promise((resolve) => {
      let i = 0;
      const tick = () => {
        i++;
        if (i >= frames) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, n);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  // --- Screenshot 1: fresh world with player ---
  console.log('Loading fresh game...');
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await waitFrames(page, 60);

  // Wait for game to expose itself
  await page.waitForFunction(() => window.__dragonRanch != null, { timeout: 10000 });

  // Move player with WASD
  await page.keyboard.down('w');
  await page.waitForTimeout(800);
  await page.keyboard.up('w');
  await page.keyboard.down('d');
  await page.waitForTimeout(500);
  await page.keyboard.up('d');
  await waitFrames(page, 30);

  const pos1 = await page.evaluate(() => {
    const p = window.__dragonRanch.player.position;
    return { x: p.x, z: p.z };
  });
  console.log('Player after move:', pos1);

  await page.screenshot({ path: path.join(outDir, '01-world-player.png'), fullPage: false });
  console.log('Saved 01-world-player.png');

  // Test building placement via API + keyboard selection
  console.log('Testing build placement...');
  await page.keyboard.press('1'); // select farmhouse
  await page.waitForTimeout(200);

  // Place via game API for reliability, then also try ghost interaction
  const placeResult = await page.evaluate(() => {
    const g = window.__dragonRanch;
    const px = Math.floor(g.player.position.x);
    const pz = Math.floor(g.player.position.z);
    // Place farmhouse near player
    const h = g.buildings.place('farmhouse', px + 4, pz + 2, 0);
    const plot = g.buildings.place('farmPlot', px - 6, pz + 2, 0);
    const pen = g.buildings.place('dragonPen', px + 4, pz - 10, 0);
    return {
      house: !!h,
      plot: !!plot,
      pen: !!pen,
      buildingCount: g.buildings.buildings.length,
    };
  });
  console.log('Placement result:', placeResult);

  // Rotate camera a bit for a nicer angle
  await page.keyboard.down('q');
  await page.waitForTimeout(400);
  await page.keyboard.up('q');
  await waitFrames(page, 20);

  await page.screenshot({ path: path.join(outDir, '02-buildings.png'), fullPage: false });
  console.log('Saved 02-buildings.png');

  // --- Screenshot 3: full demo scene ---
  console.log('Loading demo scene...');
  await page.goto(BASE + '/?demo=1', { waitUntil: 'networkidle', timeout: 30000 });
  await waitFrames(page, 90);
  await page.waitForFunction(() => window.__dragonRanch != null, { timeout: 10000 });

  // Give demo async restaging a moment (now sync, but wait anyway)
  await page.waitForTimeout(500);
  await waitFrames(page, 45);

  // Orbit camera to show the scene
  await page.keyboard.down('q');
  await page.waitForTimeout(600);
  await page.keyboard.up('q');

  // Move closer to the buildings
  await page.evaluate(() => {
    const g = window.__dragonRanch;
    g.player.mesh.position.set(8, 0, 12);
    g.followCam.yaw = 0.6;
    g.followCam.pitch = 0.55;
    g.followCam.distance = 22;
  });
  await waitFrames(page, 45);

  const demoState = await page.evaluate(() => {
    const g = window.__dragonRanch;
    return {
      buildings: g.buildings.buildings.map((b) => b.type),
      crops: g.crops.crops.size,
      dragons: g.dragons.dragons.length,
      player: { x: g.player.position.x, z: g.player.position.z },
    };
  });
  console.log('Demo state:', demoState);

  await page.screenshot({ path: path.join(outDir, '03-demo-scene.png'), fullPage: false });
  console.log('Saved 03-demo-scene.png');

  // Another angle — look at pen/crops
  await page.evaluate(() => {
    const g = window.__dragonRanch;
    g.player.mesh.position.set(10, 0, 8);
    g.followCam.yaw = -0.4;
    g.followCam.pitch = 0.65;
    g.followCam.distance = 18;
  });
  await waitFrames(page, 40);
  await page.screenshot({ path: path.join(outDir, '04-demo-closeup.png'), fullPage: false });
  console.log('Saved 04-demo-closeup.png');

  // Simulate seed plant via keyboard flow
  await page.keyboard.press('Escape');
  await page.keyboard.press('4'); // seeds
  await page.waitForTimeout(100);
  const selected = await page.evaluate(() => window.__dragonRanch.ui.selected);
  console.log('Selected after key 4:', selected);

  await browser.close();

  console.log('\n=== Console errors ===');
  console.log(consoleErrors.length ? consoleErrors : '(none)');
  console.log('=== Page errors ===');
  console.log(pageErrors.length ? pageErrors : '(none)');

  if (pageErrors.length) process.exitCode = 1;
  if (consoleErrors.some((e) => !e.includes('DevTools'))) process.exitCode = 1;

  // Movement check
  if (Math.abs(pos1.x) < 0.1 && Math.abs(pos1.z) < 0.1) {
    console.warn('WARNING: player may not have moved');
  } else {
    console.log('Player movement confirmed');
  }
  if (!placeResult.house || !placeResult.plot || !placeResult.pen) {
    console.warn('WARNING: some placements failed', placeResult);
    process.exitCode = 1;
  } else {
    console.log('Building placement confirmed');
  }
  if (demoState.dragons < 2 || demoState.crops < 8) {
    console.warn('WARNING: demo scene incomplete', demoState);
    process.exitCode = 1;
  } else {
    console.log('Demo scene confirmed');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
