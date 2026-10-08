import * as THREE from 'three';
import { WORKERS } from './config.js';

function createWorkerAvatar(typeId = 'dragonHandler') {
  const g = new THREE.Group();
  g.name = 'worker';
  const shirt = typeId === 'dragonHandler' ? 0x5c6bc0 : 0x78909c;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.6, 0.3),
    new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.7 })
  );
  body.position.y = 0.9;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.32, 0.32),
    new THREE.MeshStandardMaterial({ color: 0xe0b090 })
  );
  head.position.y = 1.38;
  g.add(head);
  // Eyes on the +z face so you can tell which way a handler is facing
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  for (const ex of [-0.07, 0.07]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), eyeMat);
    eye.position.set(ex, 1.42, 0.165);
    g.add(eye);
  }
  const hat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.22, 0.14, 8),
    new THREE.MeshStandardMaterial({ color: 0x37474f })
  );
  hat.position.y = 1.58;
  g.add(hat);
  // Legs pivot at the hip so they can swing while walking
  const legMat = new THREE.MeshStandardMaterial({ color: 0x455a64 });
  const makeLeg = (x) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.55, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.16), legMat);
    leg.position.y = -0.25;
    leg.castShadow = true;
    hip.add(leg);
    return hip;
  };
  const legL = makeLeg(-0.12);
  const legR = makeLeg(0.12);
  g.add(legL, legR);
  const armMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.7 });
  const makeArm = (x) => {
    const sh = new THREE.Group();
    sh.position.set(x, 1.15, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.42, 0.11), armMat);
    arm.position.y = -0.2;
    sh.add(arm);
    return sh;
  };
  const armL = makeArm(-0.29);
  const armR = makeArm(0.29);
  g.add(armL, armR);
  g.userData.parts = { body, legL, legR, armL, armR };
  return g;
}

const WORKER_RADIUS = 0.3;
const WORKER_SPEED = 1.6;
const WORLD_LIMIT = 498.5;

function pointInBox(x, z, b, pad) {
  return x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad;
}

/** Liang–Barsky style segment vs. expanded AABB test. */
function segmentHitsBox(x0, z0, x1, z1, b, pad) {
  const minX = b.minX - pad, maxX = b.maxX + pad, minZ = b.minZ - pad, maxZ = b.maxZ + pad;
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dz = z1 - z0;
  const clip = (p, q) => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  if (!clip(-dx, x0 - minX) || !clip(dx, maxX - x0) || !clip(-dz, z0 - minZ) || !clip(dz, maxZ - z0)) return null;
  return t0;
}

export class WorkerManager {
  constructor(scene) {
    this.scene = scene;
    this.workers = []; // { id, type, bunkhouseId, mesh, x, z, roamTarget, roamTimer }
    this.nextId = 1;
  }

  count() {
    return this.workers.length;
  }

  findNear(x, z, radius = 2.2) {
    let best = null;
    let bestD = radius;
    for (const w of this.workers) {
      const d = Math.hypot(w.x - x, w.z - z);
      if (d < bestD) {
        bestD = d;
        best = w;
      }
    }
    return best;
  }

  getById(id) {
    return this.workers.find((w) => w.id === id) || null;
  }

  hire(typeId, bunkhouse, now, door = null) {
    const def = WORKERS.types[typeId];
    if (!def || !bunkhouse) return null;
    // Spawn just outside the door (never inside the walls). `door` = BuildingManager.doorPoint(b, 1.2)
    let x, z;
    if (door) {
      const side = (Math.random() - 0.5) * 1.6;
      x = door.x + (door.nz !== 0 ? side : 0);
      z = door.z + (door.nx !== 0 ? side : 0);
    } else {
      x = bunkhouse.tx + bunkhouse.w / 2 + (Math.random() - 0.5) * 1.6;
      z = bunkhouse.tz - 1.2;
    }
    const mesh = createWorkerAvatar(typeId);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const w = {
      id: this.nextId++,
      type: typeId,
      name: def.name,
      bunkhouseId: bunkhouse.id,
      mesh,
      x,
      z,
      roamTarget: null,
      roamTimer: 0,
    };
    this.workers.push(w);
    return w;
  }

  /** Pick a bunkhouse with remaining capacity. */
  findFreeBunk(buildings, capacityPer = 4) {
    const bunks = buildings.buildings.filter((b) => b.type === 'workerBunkhouse');
    for (const b of bunks) {
      const used = this.workers.filter((w) => w.bunkhouseId === b.id).length;
      if (used < capacityPer) return b;
    }
    return null;
  }

  /** Pick a free spot near `box` (outside it and every obstacle), `minGap`..`maxGap` away. */
  _spotAround(box, minGap, maxGap, obstacles, avoid = []) {
    for (let tries = 0; tries < 12; tries++) {
      const side = Math.floor(Math.random() * 4);
      const gap = minGap + Math.random() * (maxGap - minGap);
      const u = Math.random();
      let x, z;
      if (side === 0) { x = box.minX - 0.5 + u * (box.maxX - box.minX + 1); z = box.minZ - gap; }
      else if (side === 1) { x = box.minX - 0.5 + u * (box.maxX - box.minX + 1); z = box.maxZ + gap; }
      else if (side === 2) { x = box.minX - gap; z = box.minZ - 0.5 + u * (box.maxZ - box.minZ + 1); }
      else { x = box.maxX + gap; z = box.minZ - 0.5 + u * (box.maxZ - box.minZ + 1); }
      if (this.land ? !this.land.canOccupy(x, z, 1) : Math.abs(x) > WORLD_LIMIT - 1 || Math.abs(z) > WORLD_LIMIT - 1) continue;
      if (obstacles.some((o) => pointInBox(x, z, o, WORKER_RADIUS + 0.25))) continue;
      if (avoid.some((p) => Math.hypot(p.x - x, p.z - z) < 1.0)) continue;
      return { x, z };
    }
    return null;
  }

  /** First obstacle blocking the straight line to (tx,tz) → detour via its best corner. */
  _waypoint(w, tx, tz, obstacles) {
    let hit = null, best = Infinity;
    for (const o of obstacles) {
      if (pointInBox(w.x, w.z, o, WORKER_RADIUS)) continue; // already overlapping: let separation push out
      const t = segmentHitsBox(w.x, w.z, tx, tz, o, WORKER_RADIUS + 0.05);
      if (t != null && t < best) { best = t; hit = o; }
    }
    if (!hit) return null;
    const pad = WORKER_RADIUS + 0.55;
    const corners = [
      { x: hit.minX - pad, z: hit.minZ - pad }, { x: hit.maxX + pad, z: hit.minZ - pad },
      { x: hit.minX - pad, z: hit.maxZ + pad }, { x: hit.maxX + pad, z: hit.maxZ + pad },
    ];
    let pick = null, cost = Infinity;
    for (const c of corners) {
      if (obstacles.some((o) => o !== hit && pointInBox(c.x, c.z, o, WORKER_RADIUS))) continue;
      // corner must be reachable directly from here
      if (segmentHitsBox(w.x, w.z, c.x, c.z, hit, WORKER_RADIUS)) continue;
      const k = Math.hypot(c.x - w.x, c.z - w.z) + Math.hypot(tx - c.x, tz - c.z);
      if (k < cost) { cost = k; pick = c; }
    }
    if (!pick) {
      // all corners "behind" the box from here: step to the nearest corner along an edge
      for (const c of corners) {
        const k = Math.hypot(c.x - w.x, c.z - w.z);
        if (k < cost) { cost = k; pick = c; }
      }
    }
    return pick;
  }

  _chooseTarget(w, bunk, pens, obstacles) {
    const avoid = this.workers.filter((o) => o !== w && o.roamTarget).map((o) => o.roamTarget);
    let t = null;
    if (pens.length && Math.random() < 0.35) {
      const pen = pens[Math.floor(Math.random() * pens.length)];
      t = this._spotAround({ minX: pen.tx, maxX: pen.tx + pen.w, minZ: pen.tz, maxZ: pen.tz + pen.d }, 0.9, 1.8, obstacles, avoid);
    }
    if (!t && bunk) {
      t = this._spotAround({ minX: bunk.tx, maxX: bunk.tx + bunk.w, minZ: bunk.tz, maxZ: bunk.tz + bunk.d }, 0.9, 3.5, obstacles, avoid);
    }
    return t || { x: w.x, z: w.z };
  }

  update(dt, buildings) {
    const bunkById = new Map(
      buildings.buildings.filter((b) => b.type === 'workerBunkhouse').map((b) => [b.id, b])
    );
    const pens = buildings.buildings.filter(
      (b) => b.type === 'dragonPen' || b.type === 'breedingPen'
    );
    const obstacles = buildings.getObstacles ? buildings.getObstacles() : [];

    for (const w of this.workers) {
      if (w.busyMission) continue; // away on mission — hidden & parked (handled by game)
      const bunk = bunkById.get(w.bunkhouseId);
      w.roamTimer -= dt;
      if (w.roamTimer <= 0 || !w.roamTarget) {
        w.roamTarget = this._chooseTarget(w, bunk, pens, obstacles);
        w.roamTimer = 4 + Math.random() * 5;
        w.stuckTime = 0;
        w.waypoint = null;
      }

      // Route around buildings / pen fences via corner waypoints
      if (w.waypoint && Math.hypot(w.waypoint.x - w.x, w.waypoint.z - w.z) < 0.25) w.waypoint = null;
      if (!w.waypoint) w.waypoint = this._waypoint(w, w.roamTarget.x, w.roamTarget.z, obstacles);
      const goal = w.waypoint || w.roamTarget;

      let mx = goal.x - w.x;
      let mz = goal.z - w.z;
      const dist = Math.hypot(mx, mz);
      let moving = false;
      if (dist <= 0.12) {
        if (w.waypoint) w.waypoint = null;
        // Idle but crowded: walk off to a fresh spot instead of overlapping another handler
        const crowded = this.workers.some(
          (o) => o !== w && !o.busyMission && o.id < w.id && Math.hypot(o.x - w.x, o.z - w.z) < 0.7
        );
        if (crowded) w.roamTimer = Math.min(w.roamTimer, 0);
      } else {
        mx /= dist;
        mz /= dist;
        // Steer around other handlers while walking (no stacking / walking through each other)
        for (const o of this.workers) {
          if (o === w || o.busyMission) continue;
          let ox = w.x - o.x, oz = w.z - o.z, od = Math.hypot(ox, oz);
          if (od < 1e-4) { ox = Math.cos(w.id); oz = Math.sin(w.id); od = 1e-4; }
          if (od < 1.0) {
            const push = (1.0 - od) / 1.0;
            mx += (ox / od) * push * 2.2;
            mz += (oz / od) * push * 2.2;
          }
        }
        const ml = Math.hypot(mx, mz) || 1;
        mx /= ml;
        mz /= ml;
        // Turn toward the walk direction at a capped rate; big turns happen in place first
        const want = Math.atan2(mx, mz);
        let dAng = want - w.mesh.rotation.y;
        while (dAng > Math.PI) dAng -= Math.PI * 2;
        while (dAng < -Math.PI) dAng += Math.PI * 2;
        const maxTurn = 9 * dt;
        w.mesh.rotation.y += Math.max(-maxTurn, Math.min(maxTurn, dAng));
        if (Math.abs(dAng) < 0.6) {
          const step = Math.min(WORKER_SPEED * dt, dist);
          const nx = w.x + mx * step;
          const nz = w.z + mz * step;
          const ox0 = w.x, oz0 = w.z;
          // Axis-separated collision as a safety net (slide along walls/fences)
          const crowd = this.workers.filter((o) => o !== w && !o.busyMission && Math.hypot(o.x - ox0, o.z - oz0) < 1.5);
          const offLand = (x, z) => (this.land ? !this.land.canOccupy(x, z, WORKER_RADIUS) : false);
          const blocked = (x, z) =>
            offLand(x, z) ||
            obstacles.some((o) => !pointInBox(ox0, oz0, o, WORKER_RADIUS) && pointInBox(x, z, o, WORKER_RADIUS)) ||
            // personal space: never step closer than 0.6 to another handler
            crowd.some((o) => {
              const nd = Math.hypot(o.x - x, o.z - z);
              return nd < 0.6 && nd < Math.hypot(o.x - ox0, o.z - oz0);
            });
          if (!blocked(nx, w.z)) w.x = nx;
          if (!blocked(w.x, nz)) w.z = nz;
          if (!this.land) {
            w.x = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, w.x));
            w.z = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, w.z));
          }
          const moved = Math.hypot(w.x - ox0, w.z - oz0);
          moving = moved > step * 0.2;
          w.stuckTime = moving ? 0 : (w.stuckTime || 0) + dt;
          if (w.stuckTime > 0.8) w.roamTimer = 0; // give up, pick a new spot next frame
          w.mesh.position.x = w.x;
          w.mesh.position.z = w.z;
        }
      }
      this._animate(w, moving, dt);
    }
  }

  _animate(w, moving, dt) {
    const p = w.mesh.userData.parts;
    if (!p) return;
    if (moving) {
      w.walkPhase = (w.walkPhase || 0) + dt * 7;
      const s = Math.sin(w.walkPhase);
      p.legL.rotation.x = s * 0.6;
      p.legR.rotation.x = -s * 0.6;
      p.armL.rotation.x = -s * 0.45;
      p.armR.rotation.x = s * 0.45;
      p.body.position.y = 0.9 + Math.abs(s) * 0.03;
    } else {
      const k = Math.pow(0.8, dt * 60);
      p.legL.rotation.x *= k;
      p.legR.rotation.x *= k;
      p.armL.rotation.x *= k;
      p.armR.rotation.x *= k;
      p.body.position.y = 0.9;
    }
  }

  serialize() {
    return this.workers.map((w) => ({
      id: w.id,
      type: w.type,
      name: w.name,
      bunkhouseId: w.bunkhouseId,
      x: w.x,
      z: w.z,
    }));
  }

  deserialize(list) {
    for (const w of this.workers) this.scene.remove(w.mesh);
    this.workers = [];
    this.nextId = 1;
    for (const raw of list || []) {
      const mesh = createWorkerAvatar(raw.type);
      mesh.position.set(raw.x, 0, raw.z);
      this.scene.add(mesh);
      this.workers.push({
        id: raw.id,
        type: raw.type,
        name: raw.name,
        bunkhouseId: raw.bunkhouseId,
        mesh,
        x: raw.x,
        z: raw.z,
        roamTarget: null,
        roamTimer: 0,
      });
      this.nextId = Math.max(this.nextId, raw.id + 1);
    }
  }
}
