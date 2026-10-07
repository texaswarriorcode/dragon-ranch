import * as THREE from 'three';
import { CROPS } from './config.js';

/** Visual mesh for a crop at a given stage (0 empty .. 4 fruiting). */
export function createCropMesh(stage) {
  const g = new THREE.Group();
  g.name = 'crop';

  if (stage <= 0) return g;

  if (stage === 1) {
    // Sprout — tiny green nub
    const s = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.2, 4),
      new THREE.MeshStandardMaterial({ color: 0x5cb85c })
    );
    s.position.y = 0.12;
    g.add(s);
  } else if (stage === 2) {
    // Young plant
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.06, 0.45, 5),
      new THREE.MeshStandardMaterial({ color: 0x3d8b3d })
    );
    stem.position.y = 0.25;
    g.add(stem);
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 6, 4),
      new THREE.MeshStandardMaterial({ color: 0x4caf50 })
    );
    leaf.scale.set(1, 0.5, 1);
    leaf.position.y = 0.45;
    g.add(leaf);
  } else if (stage === 3) {
    // Cactus-like dragonfruit plant
    const mat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, flatShading: true });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 6), mat);
    trunk.position.y = 0.5;
    trunk.castShadow = true;
    g.add(trunk);
    for (const [ox, oz, ang] of [[0.2, 0, 0.6], [-0.15, 0.15, -0.5], [0.05, -0.2, 0.4]]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.45, 5), mat);
      arm.position.set(ox, 0.7, oz);
      arm.rotation.z = ang;
      g.add(arm);
    }
  } else {
    // Fruiting — cactus + pink dragonfruit
    const mat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, flatShading: true });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.95, 6), mat);
    trunk.position.y = 0.52;
    trunk.castShadow = true;
    g.add(trunk);
    for (const [ox, oz, ang] of [[0.22, 0, 0.55], [-0.18, 0.12, -0.5]]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.5, 5), mat);
      arm.position.set(ox, 0.75, oz);
      arm.rotation.z = ang;
      g.add(arm);
    }
    // Dragonfruits
    const fruitMat = new THREE.MeshStandardMaterial({ color: 0xe91e8c, roughness: 0.55 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x66bb6a });
    for (const [fx, fy, fz] of [[0.28, 0.85, 0.05], [-0.22, 0.95, 0.1], [0.05, 1.05, -0.2]]) {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), fruitMat);
      fruit.scale.set(1, 1.25, 1);
      fruit.position.set(fx, fy, fz);
      g.add(fruit);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), leafMat);
      tip.position.set(fx, fy + 0.16, fz);
      g.add(tip);
    }
  }

  return g;
}

export class CropManager {
  constructor(scene) {
    this.scene = scene;
    // Map key `${plotId}:${lx}:${lz}` -> { plotId, lx, lz, stage, stageStart, mesh, worldX, worldZ }
    this.crops = new Map();
  }

  key(plotId, lx, lz) {
    return `${plotId}:${lx}:${lz}`;
  }

  get(plotId, lx, lz) {
    return this.crops.get(this.key(plotId, lx, lz));
  }

  /** Plant on a plot local tile (0..3, 0..3). */
  plant(plot, lx, lz, now) {
    const k = this.key(plot.id, lx, lz);
    if (this.crops.has(k)) return false;
    const worldX = plot.tx + lx + 0.5;
    const worldZ = plot.tz + lz + 0.5;
    const mesh = createCropMesh(1);
    mesh.position.set(worldX, 0.1, worldZ);
    this.scene.add(mesh);
    this.crops.set(k, {
      plotId: plot.id,
      lx,
      lz,
      stage: 1,
      stageStart: now,
      mesh,
      worldX,
      worldZ,
    });
    return true;
  }

  harvest(plotId, lx, lz) {
    const k = this.key(plotId, lx, lz);
    const c = this.crops.get(k);
    if (!c || c.stage < 4) return null;
    this.scene.remove(c.mesh);
    this.crops.delete(k);
    return { fruit: CROPS.harvestFruit, seeds: CROPS.harvestSeeds };
  }

  findAtWorld(tx, tz, buildings) {
    const plot = buildings.findPlotAt(tx, tz);
    if (!plot) return null;
    const lx = tx - plot.tx;
    const lz = tz - plot.tz;
    if (lx < 0 || lz < 0 || lx >= plot.w || lz >= plot.d) return null;
    const crop = this.get(plot.id, lx, lz);
    return { plot, lx, lz, crop };
  }

  advanceTime(ms) {
    for (const c of this.crops.values()) {
      c.stageStart -= ms;
    }
  }

  update(now) {
    const stageDurations = CROPS.stages.map((s) => s.duration);
    for (const c of this.crops.values()) {
      while (c.stage < 4) {
        const dur = stageDurations[c.stage];
        if (!(dur > 0 && now - c.stageStart >= dur)) break;
        c.stage += 1;
        // Carry leftover time so a long time skip (rest) can advance several stages
        c.stageStart += dur;
        this.scene.remove(c.mesh);
        c.mesh = createCropMesh(c.stage);
        c.mesh.position.set(c.worldX, 0.1, c.worldZ);
        this.scene.add(c.mesh);
      }
    }
  }

  serialize() {
    return [...this.crops.values()].map((c) => ({
      plotId: c.plotId,
      lx: c.lx,
      lz: c.lz,
      stage: c.stage,
      stageStart: c.stageStart,
    }));
  }

  deserialize(list, buildings, now) {
    for (const c of this.crops.values()) this.scene.remove(c.mesh);
    this.crops.clear();
    const plotById = new Map(buildings.buildings.map((b) => [b.id, b]));
    for (const data of list) {
      const plot = plotById.get(data.plotId);
      if (!plot) continue;
      const worldX = plot.tx + data.lx + 0.5;
      const worldZ = plot.tz + data.lz + 0.5;
      const mesh = createCropMesh(data.stage);
      mesh.position.set(worldX, 0.1, worldZ);
      this.scene.add(mesh);
      this.crops.set(this.key(data.plotId, data.lx, data.lz), {
        plotId: data.plotId,
        lx: data.lx,
        lz: data.lz,
        stage: data.stage,
        stageStart: data.stageStart || now,
        mesh,
        worldX,
        worldZ,
      });
    }
  }
}
