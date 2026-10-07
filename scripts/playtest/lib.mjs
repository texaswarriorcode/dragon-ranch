// Shared helpers for the Dragon Ranch automated playtest (Playwright, real input).
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

export const GL_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl',
];

export async function launch({ video = null, viewport = { width: 1280, height: 720 } } = {}) {
  const browser = await chromium.launch({ headless: true, args: GL_ARGS });
  const ctxOpts = { viewport };
  if (video) ctxOpts.recordVideo = { dir: video, size: viewport };
  const context = await browser.newContext(ctxOpts);
  return { browser, context };
}

export class Results {
  constructor(label, base) {
    this.label = label; this.base = base; this.tests = []; this.console = []; this.metrics = {};
  }
  add(group, name, pass, details = {}, severity = null) {
    const t = { group, name, pass, severity: pass ? null : severity || 'medium', details };
    this.tests.push(t);
    const tag = pass === null ? 'INFO' : pass ? 'PASS' : 'FAIL';
    console.log(`[${this.label}] ${tag} ${group} :: ${name} ${JSON.stringify(details).slice(0, 400)}`);
    return t;
  }
  save(dir) {
    const f = path.join(dir, `results-${this.label}.json`);
    fs.writeFileSync(f, JSON.stringify(this, null, 2));
    return f;
  }
}

/** Install per-frame instrumentation (wraps renderer.render). */
export async function instrument(page) {
  await page.evaluate(() => {
    const g = window.__dragonRanch;
    if (window.__pt) return;
    const pt = (window.__pt = { rec: null, samples: [], frameTimes: [], renderMs: [], lastT: 0 });
    const orig = g.renderer.render.bind(g.renderer);
    g.renderer.render = (s, c) => {
      const t0 = performance.now();
      orig(s, c);
      const t1 = performance.now();
      if (pt.lastT) pt.frameTimes.push(t0 - pt.lastT);
      pt.lastT = t0;
      pt.renderMs.push(t1 - t0);
      if (pt.frameTimes.length > 6000) { pt.frameTimes.shift(); pt.renderMs.shift(); }
      if (pt.rec) { try { pt.samples.push(pt.rec(g, t0)); } catch (e) { pt.recErr = String(e); } }
    };
    pt.toScreen = (x, y, z) => {
      const v = g.camera.position.clone().set(x, y, z).project(g.camera);
      const r = g.renderer.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, inView: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1 };
    };
    /** Body-height mesh boxes of a building (heuristic "solid" geometry, independent of game colliders). */
    pt.solidBoxes = (b) => {
      const out = [];
      b.mesh.updateMatrixWorld(true);
      b.mesh.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
        if (bb.max.y < 0.45 || bb.min.y > 1.7) return;
        const ax = bb.max.x - bb.min.x, az = bb.max.z - bb.min.z;
        if (ax * az > 40) return;
        if (Math.max(ax, az) < 0.3) return;
        out.push({ name: o.geometry.type, minX: bb.min.x, maxX: bb.max.x, minZ: bb.min.z, maxZ: bb.max.z });
      });
      return out;
    };
  });
}

export const SAMPLERS = {
  player: `(g,t)=>({t,x:g.player.position.x,z:g.player.position.z,rotY:g.player.mesh.rotation.y,moving:g.player.moving,
    leg:g.player.mesh.userData.parts.legL.rotation.x,cx:g.camera.position.x,cy:g.camera.position.y,cz:g.camera.position.z,
    yaw:g.followCam.yaw,dist:g.followCam.distance,energy:g.energy})`,
  workers: `(g,t)=>({t,w:g.workers.workers.map(w=>({id:w.id,x:w.x,z:w.z,rotY:w.mesh.rotation.y,vis:w.mesh.visible,
    leg:(w.mesh.userData.parts&&w.mesh.userData.parts.legL?w.mesh.userData.parts.legL.rotation.x:(w.mesh.children.find(c=>c.name==='legL')||{rotation:{x:0}}).rotation.x),
    bunk:w.bunkhouseId,busy:!!w.busyMission}))})`,
  dragons: `(g,t)=>({t,d:g.dragons.dragons.map(d=>({id:d.id,x:d.x,z:d.z,pen:d.penId,rotY:d.mesh.rotation.y,stage:d.stage}))})`,
};

export async function startRec(page, kind) {
  await page.evaluate((src) => { window.__pt.samples = []; window.__pt.rec = eval(src); }, SAMPLERS[kind]);
}
export async function stopRec(page) {
  return page.evaluate(() => { const s = window.__pt.samples; window.__pt.rec = null; window.__pt.samples = []; return s; });
}

export async function holdKeys(page, keys, ms) {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of [...keys].reverse()) await page.keyboard.up(k);
}

export async function frames(page, n = 3) {
  for (let i = 0; i < n; i++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
}

/** Teleport player + snap camera (test setup only; movement itself uses real keys). */
export async function setPlayer(page, x, z, yaw = 0) {
  await page.evaluate(({ x, z, yaw }) => {
    const g = window.__dragonRanch;
    g.player.mesh.position.set(x, 0, z);
    g.followCam.yaw = yaw;
    g.followCam.target.set(x, 1.2, z);
  }, { x, z, yaw });
  await frames(page, 4);
}

export async function aimAt(page, x, z, y = 0) {
  await frames(page, 2);
  const p = await page.evaluate(({ x, y, z }) => window.__pt.toScreen(x, y, z), { x, y, z });
  await page.mouse.move(p.x, p.y, { steps: 4 });
  await frames(page, 3);
  return p;
}

export async function fps(page, ms = 4000) {
  await page.evaluate(() => { window.__pt.frameTimes = []; window.__pt.renderMs = []; });
  await page.waitForTimeout(ms);
  return page.evaluate(() => {
    const ft = window.__pt.frameTimes.slice(1), rm = window.__pt.renderMs.slice(1);
    const avg = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
    const sorted = [...ft].sort((a, b) => a - b);
    const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] || 0;
    const info = window.__dragonRanch.renderer.info.render;
    return {
      frames: ft.length, fps: +(1000 / avg(ft)).toFixed(1), avgFrameMs: +avg(ft).toFixed(1),
      p95FrameMs: +p(0.95).toFixed(1), maxFrameMs: +Math.max(0, ...ft).toFixed(1),
      avgRenderMs: +avg(rm).toFixed(1), drawCalls: info.calls, triangles: info.triangles,
      sceneObjects: (() => { let n = 0; window.__dragonRanch.scene.traverse(() => n++); return n; })(),
    };
  });
}

export function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

export async function boot(page, url, results, { clear = false } = {}) {
  if (clear) {
    await page.goto(url, { waitUntil: 'load', timeout: 90000 });
    // Disable the game's save-on-pagehide first (same flag New Game uses), then wipe storage
    await page.evaluate(() => { if (window.__dragonRanch) window.__dragonRanch._saveDisabled = true; localStorage.clear(); });
  }
  await page.goto(url, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__dragonRanch && window.__dragonRanch.renderer, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  await instrument(page);
  await frames(page, 3);
  const hit = await page.evaluate(() => {
    const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return el ? `${el.tagName.toLowerCase()}#${el.id}.${el.className}` : 'none';
  });
  if (!results._canvasChecked) {
    results._canvasChecked = true;
    const grid = await page.evaluate(() => {
      const bad = {}; let n = 0, ok = 0;
      for (let y = 0.1; y < 0.8; y += 0.1) for (let x = 0.3; x < 0.75; x += 0.1) {
        const el = document.elementFromPoint(innerWidth * x, innerHeight * y); n++;
        if (el && el.tagName === 'CANVAS') ok++; else { const k = el ? `${el.tagName.toLowerCase()}#${el.id}.${el.className}` : 'none'; bad[k] = (bad[k] || 0) + 1; }
      }
      return { pointsOnCanvas: ok, pointsTested: n, blockers: bad };
    });
    results.add('input', 'mouse events reach the 3D canvas (grid of points over the play area)', grid.pointsOnCanvas === grid.pointsTested, { topElementAtCentre: hit, ...grid }, 'critical');
  }
  if (!hit.startsWith('canvas') && process.env.PT_CSS_WORKAROUND) {
    await page.addStyleTag({ content: '#fade:not(.active),#prompt,#toast,#tooltip,#breed-hud,.hud-top{pointer-events:none!important}' });
    results.metrics.cssWorkaroundInjected = true;
  }
}
