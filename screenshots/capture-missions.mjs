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
await page.waitForTimeout(700);
await page.evaluate(() => window.__dragonRanch.renderer.setAnimationLoop(null));

async function shot(name, fn) {
  const meta = await page.evaluate(fn);
  await page.waitForTimeout(80);
  await page.screenshot({ path: path.join(__dirname, name) });
  console.log('saved', name, meta);
}

await shot('20-field-training.png', () => {
  const g = window.__dragonRanch;
  g.ui.setMissions(false);
  g.ui.setMarketplace(false);
  g.ui.setDragonPanel(false);
  const b = g.buildings.buildings.find((x) => x.type === 'dragonFieldTraining');
  const cx = b.tx + b.w / 2;
  const cz = b.tz + b.d / 2;
  g.player.mesh.position.set(cx + 4, 0, cz + 6);
  g.camera.position.set(cx + 7, 7, cz + 10);
  g.camera.lookAt(cx, 1.5, cz);
  g.renderer.render(g.scene, g.camera);
  return { placed: !!b, footprint: `${b.w}x${b.d}` };
});

await shot('21-marketplace-dev.png', () => {
  const g = window.__dragonRanch;
  g.ui.setMarketplace(true);
  g.ui.marketplaceTab = 'dragonDevelopment';
  g.ui._buildMarketTabs();
  g.ui._renderMarketBody();
  g.ui.updateCoins(g.coins);
  g.camera.position.set(10, 12, 18);
  g.camera.lookAt(5, 1, 2);
  g.renderer.render(g.scene, g.camera);
  return { tab: g.ui.marketplaceTab, coins: g.coins };
});

await shot('22-mission-ui.png', () => {
  const g = window.__dragonRanch;
  g.ui.setMarketplace(false);
  const worker = g.workers.workers[0];
  g.ui.setMissions(true, { workerId: worker?.id });
  // Progressive fill for screenshot clarity
  const opts = g._missionOptions();
  if (opts.dragons[0]) g.ui.missionSel.dragonId = String(opts.dragons[0].id);
  if (opts.buildings[0]) g.ui.missionSel.buildingId = String(opts.buildings[0].id);
  const missions = opts.missionsByBuilding[g.ui.missionSel.buildingId] || [];
  if (missions[0]) g.ui.missionSel.missionKey = missions[0].id;
  g.ui.renderMissions();
  g.camera.position.set(8, 10, 16);
  g.camera.lookAt(4, 1, 4);
  g.renderer.render(g.scene, g.camera);
  return { sel: g.ui.missionSel, dragons: opts.dragons.length, buildings: opts.buildings.length };
});

await shot('23-mission-active.png', () => {
  const g = window.__dragonRanch;
  const opts = g._missionOptions();
  g.ui.missionSel = {
    workerId: String(opts.workers[0]?.id || ''),
    dragonId: String(opts.dragons[0]?.id || ''),
    buildingId: String(opts.buildings[0]?.id || ''),
    missionKey: 'takeDragonForARun',
  };
  const start = g._startMission({ ...g.ui.missionSel });
  g.ui.setMissions(true);
  g.ui.renderMissions();
  g.camera.position.set(8, 10, 16);
  g.camera.lookAt(4, 1, 4);
  g.renderer.render(g.scene, g.camera);
  return { start, active: g.missions.active.length };
});

await shot('24-mission-complete.png', () => {
  const g = window.__dragonRanch;
  // Force-complete any active missions
  for (const m of [...g.missions.active]) m.endsAt = Date.now() - 1;
  g.missions.tick(Date.now(), (mission, def) => g._onMissionComplete(mission, def));
  g.ui.setMissions(true);
  g.ui.renderMissions();
  g.camera.position.set(8, 10, 16);
  g.camera.lookAt(4, 1, 4);
  g.renderer.render(g.scene, g.camera);
  return { coins: g.coins, active: g.missions.active.length };
});

const fatal = errors.filter((e) => !/Clock|deprecated/i.test(e));
console.log('errors', fatal.slice(0, 8));
await browser.close();
if (fatal.length) process.exit(1);
