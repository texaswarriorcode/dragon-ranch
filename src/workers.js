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
  const hat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.22, 0.14, 8),
    new THREE.MeshStandardMaterial({ color: 0x37474f })
  );
  hat.position.y = 1.58;
  g.add(hat);
  const legL = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.45, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x455a64 })
  );
  legL.position.set(-0.12, 0.3, 0);
  const legR = legL.clone();
  legR.position.x = 0.12;
  g.add(legL, legR);
  return g;
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

  hire(typeId, bunkhouse, now) {
    const def = WORKERS.types[typeId];
    if (!def || !bunkhouse) return null;
    const margin = 1.2;
    const x = bunkhouse.tx + margin + Math.random() * (bunkhouse.w - margin * 2);
    const z = bunkhouse.tz + margin + Math.random() * Math.min(3, bunkhouse.d - margin);
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

  update(dt, buildings) {
    const bunkById = new Map(
      buildings.buildings.filter((b) => b.type === 'workerBunkhouse').map((b) => [b.id, b])
    );
    const pens = buildings.buildings.filter(
      (b) => b.type === 'dragonPen' || b.type === 'breedingPen'
    );

    for (const w of this.workers) {
      if (w.busyMission) continue; // away on mission — stay put / hidden handled by game
      const bunk = bunkById.get(w.bunkhouseId);
      w.roamTimer -= dt;
      if (w.roamTimer <= 0 || !w.roamTarget) {
        // Prefer wander near bunkhouse; sometimes visit a pen
        if (pens.length && Math.random() < 0.35) {
          const pen = pens[Math.floor(Math.random() * pens.length)];
          w.roamTarget = {
            x: pen.tx + pen.w / 2 + (Math.random() - 0.5) * 2,
            z: pen.tz + pen.d + 1 + Math.random(),
          };
        } else if (bunk) {
          const m = 1;
          w.roamTarget = {
            x: bunk.tx + m + Math.random() * (bunk.w - m * 2),
            z: bunk.tz + m + Math.random() * Math.min(4, bunk.d - m),
          };
        } else {
          w.roamTarget = { x: w.x, z: w.z };
        }
        w.roamTimer = 3 + Math.random() * 5;
      }
      const dx = w.roamTarget.x - w.x;
      const dz = w.roamTarget.z - w.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.1) {
        const step = Math.min(1.6 * dt, dist);
        w.x += (dx / dist) * step;
        w.z += (dz / dist) * step;
        w.mesh.position.x = w.x;
        w.mesh.position.z = w.z;
        w.mesh.rotation.y = Math.atan2(dx, dz);
      }
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
