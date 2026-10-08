// Usage: node scripts/playtest/run.mjs <baseUrl> <label> [phases=movement,collision,workers,dragons,core,ui] [--video]
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { launch, Results, boot } from './lib.mjs';
import { movementPhase, collisionPhase } from './movement.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'screenshots/playtest');
fs.mkdirSync(OUT, { recursive: true });

const [base, label = 'run', phaseArg = 'movement,collision,workers,dragons,core,ui,land'] = process.argv.slice(2);
const phases = new Set(phaseArg.split(','));
const VIDEO = process.argv.includes('--video');
const R = new Results(label, base);

const videoDir = VIDEO ? path.join(OUT, `video-${label}`) : null;
const { browser, context } = await launch({ video: videoDir });
const page = await context.newPage();
page.on('pageerror', (e) => R.console.push({ type: 'pageerror', text: String(e), at: new Date().toISOString() }));
page.on('console', (m) => {
  if (['error', 'warning'].includes(m.type())) R.console.push({ type: m.type(), text: m.text().slice(0, 500) });
});

const shot = async (name) => {
  const f = path.join(OUT, `${label}-${name}.png`);
  await page.screenshot({ path: f });
  return f;
};
const url = (q = '') => base + q;

const mods = {};
async function phase(name, fn) {
  if (!phases.has(name)) return;
  const t0 = Date.now();
  console.log(`\n=== [${label}] phase ${name} ===`);
  try { await fn(); } catch (e) {
    R.add(name, `phase crashed: ${e.message.split('\n')[0]}`, false, { stack: String(e.stack).slice(0, 800) }, 'high');
    await shot(`crash-${name}`).catch(() => {});
  }
  console.log(`=== phase ${name} done in ${((Date.now() - t0) / 1000).toFixed(1)}s ===`);
}

await phase('movement', async () => {
  await boot(page, url('?demo=1'), R, { clear: true });
  await shot('boot-demo');
  await movementPhase(page, R, shot);
});
await phase('collision', async () => {
  await boot(page, url('?demo=1'), R, { clear: true });
  await collisionPhase(page, R, shot);
});
for (const name of ['workers', 'dragons', 'core', 'ui', 'land']) {
  await phase(name, async () => {
    mods[name] = mods[name] || (await import(`./${name}.mjs`));
    await mods[name].run(page, R, shot, { url, boot: (q, opts) => boot(page, url(q), R, opts), context });
  });
}

R.metrics.consoleCount = R.console.length;
const f = R.save(OUT);
const fails = R.tests.filter((t) => t.pass === false);
console.log(`\n[${label}] ${R.tests.filter((t) => t.pass).length} passed, ${fails.length} failed. Console msgs: ${R.console.length}. Results: ${f}`);
for (const c of R.console.slice(0, 20)) console.log('  console', c.type, c.text.slice(0, 200));
const vid = page.video();
await context.close();
if (vid) console.log('video:', await vid.path());
await browser.close();
