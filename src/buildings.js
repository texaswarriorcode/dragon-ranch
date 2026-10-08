import * as THREE from 'three';
import { BUILDINGS, WORLD } from './config.js';

function setShadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}

/** Build a low-poly farmhouse group (6x6 footprint, origin at SW corner). */
export function createFarmhouse() {
  const g = new THREE.Group();
  g.name = 'farmhouse';
  const w = BUILDINGS.farmhouse.w;
  const d = BUILDINGS.farmhouse.d;

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xd4b896,
    roughness: 0.78,
    side: THREE.DoubleSide,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x8b3a2a,
    roughness: 0.85,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3317, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x87ceeb,
    emissive: 0x224466,
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });
  const brickMat = new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 0.95 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 1 });
  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x6b2a1a, roughness: 0.9 });

  const wallH = 2.5;
  const thick = 0.3;
  const doorW = 1.2;
  const doorH = 1.9;
  // Overhang only on the sloping eaves (N/S). Gable ends (E/W) stay nearly flush
  // so triangular gables meet the roof with no sky gaps.
  const eaveOverhang = 0.45;
  const gableOverhang = 0.12;
  const ridgeH = wallH + 1.55;
  const eaveY = wallH;

  const addBox = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    setShadow(m);
    g.add(m);
    return m;
  };

  // Floor
  addBox(new THREE.BoxGeometry(w - 0.1, 0.12, d - 0.1), floorMat, w / 2, 0.06, d / 2);

  // --- Walls with door on south ---
  const sideW = (w - doorW) / 2;
  addBox(new THREE.BoxGeometry(sideW, wallH, thick), wallMat, sideW / 2, wallH / 2, thick / 2);
  addBox(new THREE.BoxGeometry(sideW, wallH, thick), wallMat, w - sideW / 2, wallH / 2, thick / 2);
  const lintelH = wallH - doorH;
  addBox(new THREE.BoxGeometry(doorW, lintelH, thick), wallMat, w / 2, doorH + lintelH / 2, thick / 2);
  addBox(new THREE.BoxGeometry(w, wallH, thick), wallMat, w / 2, wallH / 2, d - thick / 2);
  addBox(new THREE.BoxGeometry(thick, wallH, d - thick * 2), wallMat, thick / 2, wallH / 2, d / 2);
  addBox(new THREE.BoxGeometry(thick, wallH, d - thick * 2), wallMat, w - thick / 2, wallH / 2, d / 2);

  // Door
  const door = new THREE.Mesh(new THREE.BoxGeometry(doorW * 0.9, doorH * 0.95, 0.1), woodMat);
  door.position.set(w / 2, doorH * 0.48, thick / 2 + 0.06);
  g.add(door);
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0xd4af37 })
  );
  knob.position.set(w / 2 + doorW * 0.28, doorH * 0.45, thick / 2 + 0.13);
  g.add(knob);

  // Windows
  const addWindow = (x, y, z, rotY = 0) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.12), woodMat);
    frame.position.set(x, y, z);
    frame.rotation.y = rotY;
    g.add(frame);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.68, 0.06), glassMat);
    glass.position.set(x + Math.sin(rotY) * 0.04, y, z + Math.cos(rotY) * 0.04);
    glass.rotation.y = rotY;
    g.add(glass);
  };
  addWindow(w - thick / 2, 1.5, d * 0.3, Math.PI / 2);
  addWindow(w - thick / 2, 1.5, d * 0.7, Math.PI / 2);
  addWindow(thick / 2, 1.5, d * 0.5, -Math.PI / 2);
  addWindow(w * 0.35, 1.5, d - thick / 2, Math.PI);
  addWindow(w * 0.65, 1.5, d - thick / 2, Math.PI);

  // --- Gable walls: pentagon matching roof line at the end wall plane ---
  // Roof y along Z: y(z) = ridgeH - |z - d/2| / (d/2 + eaveOverhang) * (ridgeH - eaveY)
  const run = d / 2 + eaveOverhang;
  const rise = ridgeH - eaveY;
  const roofYAt = (z) => ridgeH - (Math.abs(z - d / 2) / run) * rise;

  // Gables span the FULL roof depth (including eave overhangs) so the end
  // elevation is a solid triangle under the entire roof profile — no sky gaps.
  const buildGable = (x) => {
    const halfSpan = d / 2 + eaveOverhang; // matches roof run
    const shape = new THREE.Shape();
    // Local: X → house Z (centered at ridge), Y → up from eaveY
    shape.moveTo(-halfSpan, 0);
    shape.lineTo(0, ridgeH - eaveY);
    shape.lineTo(halfSpan, 0);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thick * 0.85, bevelEnabled: false });
    geo.translate(0, 0, -thick * 0.425);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(x, eaveY, d / 2);
    setShadow(mesh);
    g.add(mesh);
  };
  buildGable(thick / 2);
  buildGable(w - thick / 2);

  // --- Roof: two slabs with exact corners (eave overhang N/S, slight gable overhang E/W) ---
  const x0 = -gableOverhang;
  const x1 = w + gableOverhang;
  const zRidge = d / 2;
  const zSouth = -eaveOverhang;
  const zNorth = d + eaveOverhang;
  const thickness = 0.16;

  const makeRoofSlab = (zEave) => {
    // Bottom surface (underside)
    const A = [x0, eaveY, zEave];
    const B = [x1, eaveY, zEave];
    const C = [x1, ridgeH, zRidge];
    const D = [x0, ridgeH, zRidge];
    // Normal of roof plane (pointing roughly up)
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const e2 = [D[0] - A[0], D[1] - A[1], D[2] - A[2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1];
    let ny = e1[2] * e2[0] - e1[0] * e2[2];
    let nz = e1[0] * e2[1] - e1[1] * e2[0];
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const lift = (p) => [p[0] + nx * thickness, p[1] + ny * thickness, p[2] + nz * thickness];
    const At = lift(A), Bt = lift(B), Ct = lift(C), Dt = lift(D);

    const pos = [];
    const quad = (a, b, c, d) => { pos.push(...a, ...b, ...c, ...a, ...c, ...d); };
    quad(At, Bt, Ct, Dt); // top
    quad(A, D, C, B); // bottom
    quad(A, B, Bt, At); // eave edge
    quad(D, C, Ct, Dt); // ridge edge
    quad(A, At, Dt, D); // x0 side
    quad(B, C, Ct, Bt); // x1 side

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, roofMat);
    setShadow(mesh);
    g.add(mesh);
  };
  makeRoofSlab(zSouth);
  makeRoofSlab(zNorth);

  // Ridge beam
  addBox(
    new THREE.BoxGeometry(w + gableOverhang * 2 + 0.08, 0.14, 0.22),
    ridgeMat,
    w / 2,
    ridgeH + thickness * 0.6,
    d / 2
  );

  // Attic ceiling seal (horizontal plane at wall top) — prevents any see-through
  const attic = new THREE.Mesh(
    new THREE.BoxGeometry(w - thick, 0.08, d - thick),
    wallMat
  );
  attic.position.set(w / 2, wallH - 0.02, d / 2);
  g.add(attic);

  // Chimney through north slope
  const chimW = 0.55;
  const chimH = 1.75;
  const chimZ = d / 2 + run * 0.4;
  const chimRoofY = roofYAt(chimZ);
  const chim = new THREE.Mesh(new THREE.BoxGeometry(chimW, chimH, chimW), brickMat);
  chim.position.set(w * 0.72, chimRoofY + chimH * 0.32, chimZ);
  setShadow(chim);
  g.add(chim);
  addBox(
    new THREE.BoxGeometry(chimW + 0.14, 0.1, chimW + 0.14),
    brickMat,
    chim.position.x,
    chim.position.y + chimH / 2 + 0.05,
    chim.position.z
  );

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


/** 8x8 breeding pen — purple fence, nest/hay, sign. Adults only. */
export function createBreedingPen() {
  const g = new THREE.Group();
  g.name = 'breedingPen';
  const w = BUILDINGS.breedingPen.w;
  const d = BUILDINGS.breedingPen.d;

  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.3, 0.08, d - 0.3),
    new THREE.MeshStandardMaterial({ color: 0x6b4f7a, roughness: 1 })
  );
  ground.position.set(w / 2, 0.02, d / 2);
  ground.receiveShadow = true;
  g.add(ground);

  const postMat = new THREE.MeshStandardMaterial({ color: 0x6a1b9a });
  const railMat = new THREE.MeshStandardMaterial({ color: 0xab47bc });
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

  for (let i = 0; i <= w; i++) {
    addPost(i, 0);
    addPost(i, d);
  }
  for (let j = 1; j < d; j++) {
    addPost(0, j);
    addPost(w, j);
  }

  const gateStart = (w - gateW) / 2;
  const gateEnd = gateStart + gateW;
  for (const y of [0.5, 1.0]) {
    addRail(0, 0, gateStart, 0, y);
    addRail(gateEnd, 0, w, 0, y);
    addRail(0, d, w, d, y);
    addRail(0, 0, 0, d, y);
    addRail(w, 0, w, d, y);
  }

  const gate = new THREE.Mesh(
    new THREE.BoxGeometry(gateW * 0.9, 1.1, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x4a148c })
  );
  gate.position.set(w / 2, 0.7, -0.05);
  gate.rotation.y = 0.25;
  g.add(gate);

  // Hay / nest pile in center
  const hayMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 1, flatShading: true });
  const nest = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.35, 10), hayMat);
  nest.position.set(w / 2, 0.2, d / 2);
  setShadow(nest);
  g.add(nest);
  const nestInner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.85, 0.2, 10),
    new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: 1 })
  );
  nestInner.position.set(w / 2, 0.35, d / 2);
  g.add(nestInner);

  // Sign post
  const signPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, 1.8, 6),
    new THREE.MeshStandardMaterial({ color: 0x5d4037 })
  );
  signPost.position.set(w / 2, 0.9, d + 0.3);
  g.add(signPost);
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.7, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xce93d8 })
  );
  signBoard.position.set(w / 2, 1.6, d + 0.3);
  g.add(signBoard);
  // Heart mark on sign
  const heart = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0xe91e63 })
  );
  heart.position.set(w / 2, 1.6, d + 0.38);
  g.add(heart);

  return g;
}


/** Worker bunkhouse — 4×10 footprint (rotate for 10×4). Capacity 4. */
export function createWorkerBunkhouse() {
  const g = new THREE.Group();
  g.name = 'workerBunkhouse';
  const w = BUILDINGS.workerBunkhouse.w;
  const d = BUILDINGS.workerBunkhouse.d;

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xc4a484, roughness: 0.8 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.85, flatShading: true });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41 });
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x90caf9 });

  const wallH = 2.2;
  const thick = 0.22;

  // Floor
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.1, 0.1, d - 0.1),
    new THREE.MeshStandardMaterial({ color: 0x8d6e63 })
  );
  floor.position.set(w / 2, 0.05, d / 2);
  floor.receiveShadow = true;
  g.add(floor);

  // Long walls (east/west) and short ends
  const longL = new THREE.Mesh(new THREE.BoxGeometry(thick, wallH, d), wallMat);
  longL.position.set(thick / 2, wallH / 2, d / 2);
  setShadow(longL);
  g.add(longL);
  const longR = longL.clone();
  longR.position.x = w - thick / 2;
  g.add(longR);

  // North end full
  const north = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, thick), wallMat);
  north.position.set(w / 2, wallH / 2, d - thick / 2);
  setShadow(north);
  g.add(north);

  // South with door
  const doorW = 1.1;
  const sideW = (w - doorW) / 2;
  const swL = new THREE.Mesh(new THREE.BoxGeometry(sideW, wallH, thick), wallMat);
  swL.position.set(sideW / 2, wallH / 2, thick / 2);
  setShadow(swL);
  g.add(swL);
  const swR = new THREE.Mesh(new THREE.BoxGeometry(sideW, wallH, thick), wallMat);
  swR.position.set(w - sideW / 2, wallH / 2, thick / 2);
  setShadow(swR);
  g.add(swR);
  const door = new THREE.Mesh(new THREE.BoxGeometry(doorW * 0.9, 1.7, 0.08), woodMat);
  door.position.set(w / 2, 0.85, thick / 2 + 0.04);
  g.add(door);

  // Pitched roof along length (ridge on X, slopes on Z... actually long building: ridge along Z)
  const ridgeH = wallH + 0.9;
  const overhang = 0.25;
  const makeSlab = (z0, z1) => {
    const A = [-overhang, wallH, z0];
    const B = [w + overhang, wallH, z0];
    const C = [w + overhang, ridgeH, (z0 + z1) / 2];
    // simpler: two boxes
  };
  void makeSlab;
  const slopeLen = Math.hypot(w / 2 + overhang, ridgeH - wallH);
  const pitch = Math.atan2(ridgeH - wallH, w / 2 + overhang);
  const midY = (wallH + ridgeH) / 2;
  const roofL = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.12, d + overhang * 2), roofMat);
  roofL.position.set(w / 4, midY, d / 2);
  roofL.rotation.z = pitch;
  setShadow(roofL);
  g.add(roofL);
  const roofR = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.12, d + overhang * 2), roofMat);
  roofR.position.set((3 * w) / 4, midY, d / 2);
  roofR.rotation.z = -pitch;
  setShadow(roofR);
  g.add(roofR);

  // 4 bunks along the length (visible through "windows")
  for (let i = 0; i < 4; i++) {
    const bz = 1.5 + i * ((d - 2.5) / 3);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.7), bedMat);
    bed.position.set(w / 2, 0.4, bz);
    g.add(bed);
    const pillow = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.15, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xfffde7 })
    );
    pillow.position.set(w / 2 - 0.4, 0.62, bz);
    g.add(pillow);
    // Window on long wall
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.55, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x81d4fa, emissive: 0x224466, emissiveIntensity: 0.25 })
    );
    win.position.set(w - thick / 2 - 0.01, 1.3, bz);
    g.add(win);
  }

  // Sign
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.08), woodMat);
  sign.position.set(w / 2, 2.0, -0.15);
  g.add(sign);

  return g;
}


/** Dragon Field Training — 6×6 ruined stone arch + dirt ring. */
export function createDragonFieldTraining() {
  const g = new THREE.Group();
  g.name = 'dragonFieldTraining';
  const w = BUILDINGS.dragonFieldTraining.w;
  const d = BUILDINGS.dragonFieldTraining.d;
  const stone = new THREE.MeshStandardMaterial({ color: 0x8a9199, roughness: 0.9, flatShading: true });
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x5c636a, roughness: 0.92, flatShading: true });
  const dirt = new THREE.MeshStandardMaterial({ color: 0x8d6e4c, roughness: 1 });
  const moss = new THREE.MeshStandardMaterial({ color: 0x556b2f, roughness: 1 });

  // Dirt training ring (flattened torus-ish: disk + outer rim)
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.08, 24), dirt);
  pad.position.set(w / 2, 0.04, d / 2);
  pad.receiveShadow = true;
  g.add(pad);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.12, 6, 28), moss);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(w / 2, 0.1, d / 2);
  g.add(rim);

  // Pillar helper
  const addPillar = (x, z, h, lean = 0) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.55, h, 0.55), stone);
    p.position.set(x, h / 2, z);
    p.rotation.z = lean;
    p.castShadow = true;
    p.userData.solid = true;
    g.add(p);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.2, 0.75), stoneDark);
    cap.position.set(x + Math.sin(lean) * h * 0.5, h + 0.05, z);
    g.add(cap);
  };

  // Two standing pillars + cracked arch
  const px = w / 2;
  const pz = d / 2 - 0.4;
  addPillar(px - 1.4, pz, 2.8, -0.04);
  addPillar(px + 1.4, pz, 2.6, 0.06);

  // Broken arch (two wedges meeting imperfectly)
  const archL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 0.5), stone);
  archL.position.set(px - 0.7, 3.05, pz);
  archL.rotation.z = 0.35;
  g.add(archL);
  const archR = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.38, 0.5), stoneDark);
  archR.position.set(px + 0.75, 2.95, pz);
  archR.rotation.z = -0.4;
  g.add(archR);
  // Keystone crack / gap piece hanging
  const key = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.45), stone);
  key.position.set(px + 0.1, 3.25, pz);
  key.rotation.z = 0.15;
  g.add(key);

  // Fallen pillar stump + rubble
  const stump = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.6), stoneDark);
  stump.position.set(px - 2.2, 0.35, pz + 1.8);
  stump.rotation.z = 0.5;
  stump.rotation.y = 0.4;
  stump.userData.solid = true;
  g.add(stump);
  const fallen = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2.2), stone);
  fallen.position.set(px + 1.8, 0.28, pz + 1.6);
  fallen.rotation.z = Math.PI / 2;
  fallen.rotation.y = 0.5;
  fallen.userData.solid = true;
  g.add(fallen);
  for (const [sx, sz, s] of [
    [px - 1.8, pz + 2.2, 0.35],
    [px + 0.5, pz + 2.4, 0.28],
    [px + 2.0, pz + 0.8, 0.4],
    [px - 2.4, pz - 1.5, 0.3],
  ]) {
    const rock = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.7, s * 0.9), Math.random() > 0.5 ? stone : stoneDark);
    rock.position.set(sx, s * 0.35, sz);
    rock.rotation.y = sx + sz;
    g.add(rock);
  }

  // Small broken wall remnant behind arch
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 0.35), stoneDark);
  wall.position.set(px, 0.55, pz - 1.8);
  wall.rotation.y = 0.08;
  wall.userData.solid = true;
  g.add(wall);

  return g;
}

export function createBuildingMesh(type) {
  switch (type) {
    case 'farmhouse': return createFarmhouse();
    case 'farmPlot': return createFarmPlot();
    case 'dragonPen': return createDragonPen();
    case 'breedingPen': return createBreedingPen();
    case 'workerBunkhouse': return createWorkerBunkhouse();
    case 'dragonFieldTraining': return createDragonFieldTraining();
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

  /** Player colliders: farmhouse + bunkhouse block fully; Field Training blocks on its
   *  pillars / wall / fallen stones (the archway itself is walkable). Plots & pens are walkable. */
  getColliders() {
    const out = [];
    for (const b of this.buildings) {
      if (!b.colliders) b.colliders = this._computeColliders(b);
      for (const c of b.colliders) out.push(c);
    }
    return out;
  }

  _computeColliders(b) {
    if (b.type === 'farmhouse' || b.type === 'workerBunkhouse') {
      const inset = b.type === 'farmhouse' ? 0.2 : 0.1;
      return [{ minX: b.tx + inset, maxX: b.tx + b.w - inset, minZ: b.tz + inset, maxZ: b.tz + b.d - inset }];
    }
    if (b.type === 'dragonFieldTraining') {
      const out = [];
      b.mesh.updateMatrixWorld(true);
      const box = new THREE.Box3();
      b.mesh.traverse((o) => {
        if (!o.isMesh || !o.userData.solid) return;
        box.setFromObject(o);
        out.push({ minX: box.min.x + 0.05, maxX: box.max.x - 0.05, minZ: box.min.z + 0.05, maxZ: box.max.z - 0.05 });
      });
      return out;
    }
    return [];
  }

  /** Obstacles for NPC (worker) navigation: every structure except farm plots, full footprint. */
  getObstacles() {
    return this.buildings
      .filter((b) => b.type !== 'farmPlot')
      .map((b) => ({ id: b.id, type: b.type, minX: b.tx, maxX: b.tx + b.w, minZ: b.tz, maxZ: b.tz + b.d }));
  }

  /** World-space centre of the door face (doors are on the local south face, rotated with the building). */
  doorPoint(b, outward = 0) {
    const nat = BUILDINGS[b.type];
    const theta = -(b.rotation || 0) * (Math.PI / 2);
    const half = nat.d / 2 + outward;
    // local offset (0, -half) rotated about Y
    const ox = -half * Math.sin(theta);
    const oz = -half * Math.cos(theta);
    return { x: b.tx + b.w / 2 + ox, z: b.tz + b.d / 2 + oz, nx: Math.sign(Math.round(ox)), nz: Math.sign(Math.round(oz)) };
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
    if (this.land) {
      // Must sit entirely on owned land (home + bought expansions, any shape)
      if (!this.land.isRectOwned(tx, tz, tx + w, tz + d)) return false;
    } else {
      const half = WORLD.half;
      if (tx < -half || tz < -half || tx + w > half || tz + d > half) return false;
    }
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

  findBreedingPenAt(tx, tz) {
    const b = this.findAt(tx, tz);
    return b && b.type === 'breedingPen' ? b : null;
  }

  findAnyPenAt(tx, tz) {
    const b = this.findAt(tx, tz);
    return b && (b.type === 'dragonPen' || b.type === 'breedingPen') ? b : null;
  }

  bunkCapacity() {
    return this.buildings
      .filter((b) => b.type === 'workerBunkhouse')
      .reduce((n, b) => n + (BUILDINGS.workerBunkhouse.capacity || 4), 0);
  }

  findBunkhouses() {
    return this.buildings.filter((b) => b.type === 'workerBunkhouse');
  }

  findFarmhouseNear(x, z, radius = 5) {
    let best = null;
    let bestDist = radius;
    for (const b of this.buildings) {
      if (b.type !== 'farmhouse') continue;
      // Door follows the building's rotation (it used to assume the -z face for every rotation).
      const door = this.doorPoint(b);
      const dist = Math.hypot(x - door.x, z - door.z);
      if (dist < bestDist) {
        bestDist = dist;
        best = b;
      }
    }
    return best;
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

