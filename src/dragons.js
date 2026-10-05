import * as THREE from 'three';
import { DRAGONS, BUILDINGS } from './config.js';

/**
 * Low-poly red dragon. sex: 'male' | 'female'
 * Stages: baby | juvenile | adult — scale/proportions differ.
 */
export function createDragonMesh(sex, stageName) {
  const g = new THREE.Group();
  g.name = 'dragon';
  g.userData.sex = sex;
  g.userData.stage = stageName;

  const baseRed = sex === 'male' ? 0xc62828 : 0xe53955;
  const belly = sex === 'male' ? 0xffcc80 : 0xffe0b2;
  const bodyMat = new THREE.MeshStandardMaterial({ color: baseRed, roughness: 0.7, flatShading: true });
  const bellyMat = new THREE.MeshStandardMaterial({ color: belly, roughness: 0.65, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, flatShading: true });

  const stageIdx = DRAGONS.stages.findIndex((s) => s.name === stageName);
  const scale = DRAGONS.stages[Math.max(0, stageIdx)].scale;

  // Body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bodyMat);
  body.scale.set(1.1, 0.85, 1.4);
  body.position.y = 0.45;
  body.castShadow = true;
  g.add(body);

  const bel = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), bellyMat);
  bel.scale.set(0.9, 0.7, 1.2);
  bel.position.set(0, 0.35, 0.05);
  g.add(bel);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), bodyMat);
  head.position.set(0, 0.65, 0.45);
  head.castShadow = true;
  g.add(head);

  // Snout
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.22), bodyMat);
  snout.position.set(0, 0.58, 0.62);
  g.add(snout);

  // Eyes
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffee58, emissive: 0xaa8800, emissiveIntensity: 0.4 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), eyeMat);
  eyeL.position.set(-0.1, 0.72, 0.58);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1;
  g.add(eyeL, eyeR);

  // Sex distinction
  if (sex === 'male') {
    // Horns + larger crest
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xffecb3, flatShading: true });
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 5), hornMat);
    hornL.position.set(-0.1, 0.88, 0.4);
    hornL.rotation.x = -0.4;
    const hornR = hornL.clone();
    hornR.position.x = 0.1;
    g.add(hornL, hornR);
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 4), darkMat);
    crest.position.set(0, 0.9, 0.35);
    g.add(crest);
  } else {
    // Frill / softer crest
    const frillMat = new THREE.MeshStandardMaterial({ color: 0xff8a80, flatShading: true });
    for (const a of [-0.5, 0, 0.5]) {
      const frill = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), frillMat);
      frill.position.set(Math.sin(a) * 0.15, 0.82, 0.35 + Math.cos(a) * 0.05);
      frill.rotation.z = a;
      g.add(frill);
    }
  }

  // Legs
  for (const [lx, lz] of [[-0.2, 0.2], [0.2, 0.2], [-0.2, -0.25], [0.2, -0.25]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.35, 5), darkMat);
    leg.position.set(lx, 0.18, lz);
    leg.castShadow = true;
    g.add(leg);
  }

  // Wings — bigger on adult
  const wingSpan = stageName === 'adult' ? 0.7 : stageName === 'juvenile' ? 0.45 : 0.28;
  const wingMat = new THREE.MeshStandardMaterial({
    color: sex === 'male' ? 0xb71c1c : 0xec407a,
    side: THREE.DoubleSide,
    flatShading: true,
    transparent: true,
    opacity: 0.9,
  });
  const wingGeo = new THREE.BufferGeometry();
  const wp = new Float32Array([
    0, 0, 0,
    wingSpan, 0.15, -0.1,
    wingSpan * 0.3, 0.35, -0.05,
    0, 0, 0,
    -wingSpan, 0.15, -0.1,
    -wingSpan * 0.3, 0.35, -0.05,
  ]);
  wingGeo.setAttribute('position', new THREE.BufferAttribute(wp, 3));
  wingGeo.computeVertexNormals();
  const wings = new THREE.Mesh(wingGeo, wingMat);
  wings.position.set(0, 0.55, 0);
  g.add(wings);
  g.userData.wings = wings;

  // Tail
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.55, 5), bodyMat);
  tail.rotation.x = Math.PI / 2;
  tail.position.set(0, 0.4, -0.55);
  g.add(tail);

  g.scale.setScalar(scale);
  return g;
}

export class DragonManager {
  constructor(scene) {
    this.scene = scene;
    this.dragons = []; // { id, sex, stage, stageStart, penId, mesh, x, z, roamTarget, fedBoost }
    this.nextId = 1;
  }

  countInPen(penId) {
    return this.dragons.filter((d) => d.penId === penId).length;
  }

  place(sex, pen, now) {
    if (this.countInPen(pen.id) >= BUILDINGS.dragonPen.maxDragons) return null;
    const margin = 1.2;
    const x = pen.tx + margin + Math.random() * (pen.w - margin * 2);
    const z = pen.tz + margin + Math.random() * (pen.d - margin * 2);
    const mesh = createDragonMesh(sex, 'baby');
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const d = {
      id: this.nextId++,
      sex,
      stage: 0, // index into DRAGONS.stages
      stageStart: now,
      penId: pen.id,
      mesh,
      x,
      z,
      roamTarget: null,
      roamTimer: 0,
      fedBoost: 0, // ms of growth acceleration remaining conceptually via stageStart shift
    };
    this.dragons.push(d);
    return d;
  }

  feed(dragon, now) {
    // Speed growth: pull stageStart forward so remaining time shrinks
    const stage = DRAGONS.stages[dragon.stage];
    if (!stage || stage.duration <= 0) return false; // already adult
    const elapsed = now - dragon.stageStart;
    const remaining = Math.max(0, stage.duration - elapsed);
    const boost = remaining * DRAGONS.feedGrowthBoost;
    dragon.stageStart -= boost;
    // Happy bob
    dragon.mesh.position.y = 0.15;
    setTimeout(() => { if (dragon.mesh) dragon.mesh.position.y = 0; }, 200);
    return true;
  }

  findNear(x, z, radius = 2.5) {
    let best = null;
    let bestDist = radius;
    for (const d of this.dragons) {
      const dist = Math.hypot(d.x - x, d.z - z);
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    return best;
  }

  update(now, dt, buildings) {
    const penById = new Map(buildings.buildings.filter((b) => b.type === 'dragonPen').map((b) => [b.id, b]));

    for (const d of this.dragons) {
      const pen = penById.get(d.penId);
      if (!pen) continue;

      // Growth
      const stageDef = DRAGONS.stages[d.stage];
      if (stageDef.duration > 0 && now - d.stageStart >= stageDef.duration) {
        d.stage = Math.min(d.stage + 1, DRAGONS.stages.length - 1);
        d.stageStart = now;
        const sex = d.sex;
        const name = DRAGONS.stages[d.stage].name;
        const pos = d.mesh.position.clone();
        const rot = d.mesh.rotation.y;
        this.scene.remove(d.mesh);
        d.mesh = createDragonMesh(sex, name);
        d.mesh.position.copy(pos);
        d.mesh.rotation.y = rot;
        this.scene.add(d.mesh);
      }

      // Wander inside pen
      d.roamTimer -= dt;
      if (d.roamTimer <= 0 || !d.roamTarget) {
        const margin = 1.0;
        d.roamTarget = {
          x: pen.tx + margin + Math.random() * (pen.w - margin * 2),
          z: pen.tz + margin + Math.random() * (pen.d - margin * 2),
        };
        d.roamTimer = 2 + Math.random() * 4;
      }
      const dx = d.roamTarget.x - d.x;
      const dz = d.roamTarget.z - d.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.1) {
        const sp = DRAGONS.wanderSpeed * dt;
        const step = Math.min(sp, dist);
        d.x += (dx / dist) * step;
        d.z += (dz / dist) * step;
        d.mesh.position.x = d.x;
        d.mesh.position.z = d.z;
        d.mesh.rotation.y = Math.atan2(dx, dz);
        // Wing flutter
        if (d.mesh.userData.wings) {
          d.mesh.userData.wings.rotation.z = Math.sin(now * 0.008) * 0.15;
        }
      }
    }
  }

  serialize() {
    return this.dragons.map((d) => ({
      id: d.id,
      sex: d.sex,
      stage: d.stage,
      stageStart: d.stageStart,
      penId: d.penId,
      x: d.x,
      z: d.z,
    }));
  }

  deserialize(list, now) {
    for (const d of this.dragons) this.scene.remove(d.mesh);
    this.dragons = [];
    this.nextId = 1;
    for (const data of list) {
      const name = DRAGONS.stages[data.stage]?.name || 'baby';
      const mesh = createDragonMesh(data.sex, name);
      mesh.position.set(data.x, 0, data.z);
      this.scene.add(mesh);
      this.dragons.push({
        id: data.id,
        sex: data.sex,
        stage: data.stage,
        stageStart: data.stageStart || now,
        penId: data.penId,
        mesh,
        x: data.x,
        z: data.z,
        roamTarget: null,
        roamTimer: 0,
        fedBoost: 0,
      });
      this.nextId = Math.max(this.nextId, data.id + 1);
    }
  }
}
