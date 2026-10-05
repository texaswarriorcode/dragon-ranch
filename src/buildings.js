import * as THREE from 'three';
import { BUILDINGS, WORLD } from './config.js';

function setShadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}

/** Build a low-poly farmhouse group (6x6 footprint, origin at SW corner of footprint). */
export function createFarmhouse() {
  const g = new THREE.Group();
  g.name = 'farmhouse';
  const w = BUILDINGS.farmhouse.w;
  const d = BUILDINGS.farmhouse.d;

  // Floor
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.2, 0.15, d - 0.2),
    new THREE.MeshStandardMaterial({ color: 0x8b6914 })
  );
  floor.position.set(w / 2, 0.08, d / 2);
  setShadow(floor);
  g.add(floor);

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xd4b896, roughness: 0.75 });
  const wallH = 2.4;
  const thick = 0.25;
  // Walls with door gap on south
  // South wall with door: two pieces
  const doorW = 1.2;
  const leftW = (w - doorW) / 2;
  const swL = new THREE.Mesh(new THREE.BoxGeometry(leftW, wallH, thick), wallMat);
  swL.position.set(leftW / 2, wallH / 2, thick / 2);
  setShadow(swL);
  g.add(swL);
  const swR = new THREE.Mesh(new THREE.BoxGeometry(leftW, wallH, thick), wallMat);
  swR.position.set(w - leftW / 2, wallH / 2, thick / 2);
  setShadow(swR);
  g.add(swR);

  // North
  const nw = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, thick), wallMat);
  nw.position.set(w / 2, wallH / 2, d - thick / 2);
  setShadow(nw);
  g.add(nw);
  // West / East
  const ww = new THREE.Mesh(new THREE.BoxGeometry(thick, wallH, d - thick * 2), wallMat);
  ww.position.set(thick / 2, wallH / 2, d / 2);
  setShadow(ww);
  g.add(ww);
  const ew = ww.clone();
  ew.position.x = w - thick / 2;
  g.add(ew);

  // Door
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(doorW * 0.9, 1.8, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x5c3317 })
  );
  door.position.set(w / 2, 0.9, thick / 2 + 0.05);
  g.add(door);

  // Roof (pitched)
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b3a2a, roughness: 0.85, flatShading: true });
  const ridge = wallH + 1.6;
  const eave = wallH - 0.05;
  // Simple two-plane roof via boxes rotated
  const roofL = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.15, d / 2 + 0.4), roofMat);
  roofL.position.set(w / 2, (eave + ridge) / 2, d / 4);
  roofL.rotation.x = Math.atan2(ridge - eave, d / 2);
  setShadow(roofL);
  g.add(roofL);
  const roofR = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.15, d / 2 + 0.4), roofMat);
  roofR.position.set(w / 2, (eave + ridge) / 2, (3 * d) / 4);
  roofR.rotation.x = -Math.atan2(ridge - eave, d / 2);
  setShadow(roofR);
  g.add(roofR);

  // Chimney
  const chim = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1.4, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x6a6a6a })
  );
  chim.position.set(w * 0.75, wallH + 1.2, d * 0.7);
  setShadow(chim);
  g.add(chim);

  // Window
  const win = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.7, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x87ceeb, emissive: 0x224466, emissiveIntensity: 0.3 })
  );
  win.position.set(w - thick / 2 - 0.02, 1.4, d / 2);
  g.add(win);

  return g;
}

/** 4x4 tilled soil plot. */
export function createFarmPlot() {
  const g = new THREE.Group();
  g.name = 'farmPlot';
  const w = BUILDINGS.farmPlot.w;
  const d = BUILDINGS.farmPlot.d;

  const soil = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.1, 0.12, d - 0.1),
    new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 1 })
  );
  soil.position.set(w / 2, 0.04, d / 2);
  soil.receiveShadow = true;
  g.add(soil);

  // Furrow lines
  const lineMat = new THREE.MeshStandardMaterial({ color: 0x4a2e14 });
  for (let i = 1; i < w; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, d - 0.2), lineMat);
    line.position.set(i, 0.1, d / 2);
    g.add(line);
  }
  for (let j = 1; j < d; j++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.04, 0.06), lineMat);
    line.position.set(w / 2, 0.1, j);
    g.add(line);
  }

  // Border planks
  const plank = new THREE.MeshStandardMaterial({ color: 0x7a5a30 });
  const frame = [
    new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, 0.15), plank),
    new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, 0.15), plank),
    new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, d), plank),
    new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, d), plank),
  ];
  frame[0].position.set(w / 2, 0.12, 0.05);
  frame[1].position.set(w / 2, 0.12, d - 0.05);
  frame[2].position.set(0.05, 0.12, d / 2);
  frame[3].position.set(w - 0.05, 0.12, d / 2);
  frame.forEach((m) => g.add(m));

  return g;
}

/** 8x8 fenced dragon pen with gate on south side. */
export function createDragonPen() {
  const g = new THREE.Group();
  g.name = 'dragonPen';
  const w = BUILDINGS.dragonPen.w;
  const d = BUILDINGS.dragonPen.d;

  // Ground dirt/sand inside
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.3, 0.08, d - 0.3),
    new THREE.MeshStandardMaterial({ color: 0x9a7b4f, roughness: 1 })
  );
  ground.position.set(w / 2, 0.02, d / 2);
  ground.receiveShadow = true;
  g.add(ground);

  const postMat = new THREE.MeshStandardMaterial({ color: 0x6b4e31 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x8b6914 });
  const postH = 1.5;
  const gateW = 1.6;

  const addPost = (x, z) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, postH, 6), postMat);
    p.position.set(x, postH / 2, z);
    setShadow(p);
    g.add(p);
  };
  const addRail = (x1, z1, x2, z2, y) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.08), railMat);
    rail.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    rail.rotation.y = -Math.atan2(dz, dx);
    g.add(rail);
  };

  // Posts around perimeter
  for (let i = 0; i <= w; i++) {
    addPost(i, 0);
    addPost(i, d);
  }
  for (let j = 1; j < d; j++) {
    addPost(0, j);
    addPost(w, j);
  }

  // Rails — south has gate gap in center
  const gateStart = (w - gateW) / 2;
  const gateEnd = gateStart + gateW;
  // South left / right
  for (const y of [0.5, 1.0]) {
    addRail(0, 0, gateStart, 0, y);
    addRail(gateEnd, 0, w, 0, y);
    addRail(0, d, w, d, y);
    addRail(0, 0, 0, d, y);
    addRail(w, 0, w, d, y);
  }

  // Gate (slightly open look — two posts + crossbar)
  const gateMat = new THREE.MeshStandardMaterial({ color: 0x5c4030 });
  const gate = new THREE.Mesh(new THREE.BoxGeometry(gateW * 0.9, 1.1, 0.08), gateMat);
  gate.position.set(w / 2, 0.7, -0.05);
  gate.rotation.y = 0.25;
  g.add(gate);

  // Water trough
  const trough = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.4, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x4a6a8a })
  );
  trough.position.set(w - 1.5, 0.25, d - 1.2);
  g.add(trough);

  return g;
}

export function createBuildingMesh(type) {
  switch (type) {
    case 'farmhouse': return createFarmhouse();
    case 'farmPlot': return createFarmPlot();
    case 'dragonPen': return createDragonPen();
    default: throw new Error('Unknown building ' + type);
  }
}

/** Ghost preview material helpers — reuses materials, only updates color. */
export function tintGhost(root, valid) {
  const color = valid ? 0x44cc66 : 0xcc4444;
  const opacity = 0.45;
  root.traverse((obj) => {
    if (obj.isMesh) {
      if (!obj.userData._ghostMat) {
        obj.userData._ghostMat = new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity,
          depthWrite: false,
        });
        obj.material = obj.userData._ghostMat;
      } else {
        obj.userData._ghostMat.color.setHex(color);
      }
    }
  });
}

export function footprintFor(type, rotation) {
  const b = BUILDINGS[type];
  let w = b.w;
  let d = b.d;
  // 90° / 270° swap
  if (rotation % 2 === 1) {
    return { w: d, d: w };
  }
  return { w, d };
}

export class BuildingManager {
  constructor(scene) {
    this.scene = scene;
    this.buildings = []; // { id, type, tx, tz, rotation, mesh, w, d }
    this.nextId = 1;
    this.ghost = null;
    this.ghostType = null;
    this.ghostRot = 0;
  }

  getColliders() {
    // Farm plots and pens are walkable; farmhouses block
    return this.buildings
      .filter((b) => b.type === 'farmhouse')
      .map((b) => ({
        minX: b.tx + 0.2,
        maxX: b.tx + b.w - 0.2,
        minZ: b.tz + 0.2,
        maxZ: b.tz + b.d - 0.2,
      }));
  }

  occupies(tx, tz, w, d, ignoreId = null) {
    for (const b of this.buildings) {
      if (ignoreId && b.id === ignoreId) continue;
      if (tx < b.tx + b.w && tx + w > b.tx && tz < b.tz + b.d && tz + d > b.tz) {
        return true;
      }
    }
    return false;
  }

  canPlace(type, tx, tz, rotation) {
    const { w, d } = footprintFor(type, rotation);
    const half = WORLD.half;
    if (tx < -half || tz < -half || tx + w > half || tz + d > half) return false;
    if (this.occupies(tx, tz, w, d)) return false;
    return true;
  }

  place(type, tx, tz, rotation = 0) {
    if (!this.canPlace(type, tx, tz, rotation)) return null;
    const { w, d } = footprintFor(type, rotation);
    const placed = this._addRotated(type, tx, tz, rotation);
    const entry = {
      id: this.nextId++,
      type,
      tx,
      tz,
      rotation,
      mesh: placed,
      w,
      d,
    };
    this.buildings.push(entry);
    return entry;
  }

  _addRotated(type, tx, tz, rotation) {
    const nat = BUILDINGS[type];
    const pivot = new THREE.Group();
    const mesh = createBuildingMesh(type);
    // Mesh built in [0..ow] x [0..od]. Center it, rotate, then position so AABB SW is at (tx,tz).
    const { w, d } = footprintFor(type, rotation);
    mesh.position.set(-nat.w / 2, 0, -nat.d / 2);
    pivot.add(mesh);
    pivot.rotation.y = -rotation * (Math.PI / 2);
    pivot.position.set(tx + w / 2, 0, tz + d / 2);
    this.scene.add(pivot);
    return pivot;
  }

  clearGhost() {
    if (this.ghost) {
      this.scene.remove(this.ghost);
      this.ghost = null;
      this.ghostType = null;
    }
  }

  setGhost(type) {
    this.clearGhost();
    this.ghostType = type;
    this.ghostRot = 0;
    if (!type) return;
    this.ghost = this._makeGhost(type, 0);
    this.scene.add(this.ghost);
  }

  _makeGhost(type, rotation) {
    const nat = BUILDINGS[type];
    const pivot = new THREE.Group();
    const mesh = createBuildingMesh(type);
    mesh.position.set(-nat.w / 2, 0, -nat.d / 2);
    pivot.add(mesh);
    pivot.rotation.y = -rotation * (Math.PI / 2);
    tintGhost(pivot, true);
    pivot.userData.isGhost = true;
    return pivot;
  }

  updateGhost(tx, tz, valid) {
    if (!this.ghost || !this.ghostType) return;
    const { w, d } = footprintFor(this.ghostType, this.ghostRot);
    this.ghost.position.set(tx + w / 2, 0.05, tz + d / 2);
    this.ghost.rotation.y = -this.ghostRot * (Math.PI / 2);
    tintGhost(this.ghost, valid);
  }

  rotateGhost() {
    if (!this.ghostType) return;
    this.ghostRot = (this.ghostRot + 1) % 4;
    // Rebuild ghost to refresh footprint orientation materials
    const type = this.ghostType;
    const rot = this.ghostRot;
    this.clearGhost();
    this.ghostType = type;
    this.ghostRot = rot;
    this.ghost = this._makeGhost(type, rot);
    this.scene.add(this.ghost);
  }

  findAt(tx, tz) {
    return this.buildings.find(
      (b) => tx >= b.tx && tx < b.tx + b.w && tz >= b.tz && tz < b.tz + b.d
    );
  }

  findPlotAt(tx, tz) {
    const b = this.findAt(tx, tz);
    return b && b.type === 'farmPlot' ? b : null;
  }

  findPenAt(tx, tz) {
    const b = this.findAt(tx, tz);
    return b && b.type === 'dragonPen' ? b : null;
  }

  serialize() {
    return this.buildings.map((b) => ({
      id: b.id,
      type: b.type,
      tx: b.tx,
      tz: b.tz,
      rotation: b.rotation,
    }));
  }

  deserialize(list) {
    // Clear existing
    for (const b of this.buildings) this.scene.remove(b.mesh);
    this.buildings = [];
    this.nextId = 1;
    for (const data of list) {
      const placed = this._addRotated(data.type, data.tx, data.tz, data.rotation || 0);
      const { w, d } = footprintFor(data.type, data.rotation || 0);
      const entry = {
        id: data.id,
        type: data.type,
        tx: data.tx,
        tz: data.tz,
        rotation: data.rotation || 0,
        mesh: placed,
        w,
        d,
      };
      this.buildings.push(entry);
      this.nextId = Math.max(this.nextId, data.id + 1);
    }
  }
}

