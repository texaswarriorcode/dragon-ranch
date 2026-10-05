import * as THREE from 'three';
import { DRAGONS, BUILDINGS, RARITY } from './config.js';
import { rarityColor, normalizeRarity } from './rarity.js';

/**
 * Low-poly red dragon. sex: 'male' | 'female'
 * Stages: baby | juvenile | adult. Optional rarity aura.
 */
export function createDragonMesh(sex, stageName, rarity = 'Common') {
  const g = new THREE.Group();
  g.name = 'dragon';
  g.userData.sex = sex;
  g.userData.stage = stageName;
  g.userData.rarity = rarity;

  const baseRed = sex === 'male' ? 0xc62828 : 0xe53955;
  const belly = sex === 'male' ? 0xffcc80 : 0xffe0b2;
  const bodyMat = new THREE.MeshStandardMaterial({ color: baseRed, roughness: 0.7, flatShading: true });
  const bellyMat = new THREE.MeshStandardMaterial({ color: belly, roughness: 0.65, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, flatShading: true });

  const stageIdx = DRAGONS.stages.findIndex((s) => s.name === stageName);
  const scale = DRAGONS.stages[Math.max(0, stageIdx)].scale;

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bodyMat);
  body.scale.set(1.1, 0.85, 1.4);
  body.position.y = 0.45;
  body.castShadow = true;
  g.add(body);

  const bel = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), bellyMat);
  bel.scale.set(0.9, 0.7, 1.2);
  bel.position.set(0, 0.35, 0.05);
  g.add(bel);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), bodyMat);
  head.position.set(0, 0.65, 0.45);
  head.castShadow = true;
  g.add(head);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.22), bodyMat);
  snout.position.set(0, 0.58, 0.62);
  g.add(snout);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffee58, emissive: 0xaa8800, emissiveIntensity: 0.4 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), eyeMat);
  eyeL.position.set(-0.1, 0.72, 0.58);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1;
  g.add(eyeL, eyeR);

  if (sex === 'male') {
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
    const frillMat = new THREE.MeshStandardMaterial({ color: 0xff8a80, flatShading: true });
    for (const a of [-0.5, 0, 0.5]) {
      const frill = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), frillMat);
      frill.position.set(Math.sin(a) * 0.15, 0.82, 0.35 + Math.cos(a) * 0.05);
      frill.rotation.z = a;
      g.add(frill);
    }
  }

  for (const [lx, lz] of [[-0.2, 0.2], [0.2, 0.2], [-0.2, -0.25], [0.2, -0.25]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.35, 5), darkMat);
    leg.position.set(lx, 0.18, lz);
    leg.castShadow = true;
    g.add(leg);
  }

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
    0, 0, 0, wingSpan, 0.15, -0.1, wingSpan * 0.3, 0.35, -0.05,
    0, 0, 0, -wingSpan, 0.15, -0.1, -wingSpan * 0.3, 0.35, -0.05,
  ]);
  wingGeo.setAttribute('position', new THREE.BufferAttribute(wp, 3));
  wingGeo.computeVertexNormals();
  const wings = new THREE.Mesh(wingGeo, wingMat);
  wings.position.set(0, 0.55, 0);
  g.add(wings);
  g.userData.wings = wings;

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.55, 5), bodyMat);
  tail.rotation.x = Math.PI / 2;
  tail.position.set(0, 0.4, -0.55);
  g.add(tail);

  // Rarity aura ring
  const col = rarityColor(rarity);
  const aura = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.04, 8, 20),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.75 })
  );
  aura.rotation.x = Math.PI / 2;
  aura.position.y = 0.08;
  g.add(aura);
  g.userData.aura = aura;

  // Soft glow light for uncommon+
  if (rarity !== 'Common') {
    const glow = new THREE.PointLight(col, rarity === 'Legendary' ? 1.2 : 0.55, 4);
    glow.position.y = 0.8;
    g.add(glow);
    g.userData.glow = glow;
  }

  // Legendary sparkle particles (simple instanced dots)
  if (rarity === 'Legendary') {
    const sparkCount = 12;
    const sg = new THREE.BufferGeometry();
    const positions = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1.2;
      positions[i * 3 + 1] = 0.3 + Math.random() * 1.2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
    }
    sg.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const sparks = new THREE.Points(
      sg,
      new THREE.PointsMaterial({ color: 0xffe082, size: 0.12, transparent: true, opacity: 0.9 })
    );
    g.add(sparks);
    g.userData.sparks = sparks;
  }

  g.scale.setScalar(scale);
  return g;
}

export function createEggMesh(rarity = 'Common') {
  const g = new THREE.Group();
  g.name = 'egg';
  const col = rarityColor(rarity);
  const egg = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xf5e6c8, roughness: 0.55, flatShading: true })
  );
  egg.scale.set(0.85, 1.15, 0.85);
  egg.position.y = 0.32;
  egg.castShadow = true;
  g.add(egg);
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.035, 6, 16),
    new THREE.MeshBasicMaterial({ color: col })
  );
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.35;
  g.add(band);
  return g;
}

function rebuildDragonMesh(d) {
  const name = DRAGONS.stages[d.stage]?.name || 'baby';
  const pos = d.mesh.position.clone();
  const rot = d.mesh.rotation.y;
  return { name, pos, rot };
}

export class DragonManager {
  constructor(scene) {
    this.scene = scene;
    this.dragons = [];
    this.nextId = 1;
    // Breeding state per breedingPen id:
    // { penId, breedStart, cooldownUntil, egg: { rarity, sex, hatchAt, mesh } | null, progressMesh }
    this.breeding = new Map();
  }

  countInPen(penId) {
    return this.dragons.filter((d) => d.penId === penId).length;
  }

  dragonsInPen(penId) {
    return this.dragons.filter((d) => d.penId === penId);
  }

  /** Place a dragon from inventory-like opts into a pen (dragonPen or breedingPen). */
  place(opts, pen, now) {
    const sex = opts.sex;
    const stage = opts.stage ?? 0;
    const rarity = normalizeRarity(opts.rarity || 'Common');
    const level = Math.max(1, Math.floor(opts.level) || 1);
    const xp = Math.max(0, opts.xp || 0);
    const isBreed = pen.type === 'breedingPen';
    const max = isBreed ? BUILDINGS.breedingPen.maxDragons : BUILDINGS.dragonPen.maxDragons;

    if (isBreed) {
      if (stage < 2) return null; // adults only
      if (this.countInPen(pen.id) >= max) return null;
    } else {
      if (this.countInPen(pen.id) >= max) return null;
    }

    const margin = 1.2;
    const x = pen.tx + margin + Math.random() * (pen.w - margin * 2);
    const z = pen.tz + margin + Math.random() * (pen.d - margin * 2);
    const stageName = DRAGONS.stages[stage]?.name || 'baby';
    const mesh = createDragonMesh(sex, stageName, rarity);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const d = {
      id: opts.id ?? this.nextId++,
      sex,
      stage,
      stageStart: now,
      penId: pen.id,
      penType: pen.type,
      rarity,
      level,
      xp: stage >= 2 ? xp : 0,
      missionRestUntil: opts.missionRestUntil || 0,
      mesh,
      x,
      z,
      roamTarget: null,
      roamTimer: 0,
    };
    this.nextId = Math.max(this.nextId, d.id + 1);
    this.dragons.push(d);
    return d;
  }

  /** Remove dragon from world, return inventory item data. */
  pickUp(dragon) {
    const item = {
      id: dragon.id,
      sex: dragon.sex,
      stage: dragon.stage,
      rarity: normalizeRarity(dragon.rarity),
      level: dragon.level ?? 1,
      xp: dragon.xp ?? 0,
      missionRestUntil: dragon.missionRestUntil || 0,
    };
    this.scene.remove(dragon.mesh);
    this.dragons = this.dragons.filter((d) => d.id !== dragon.id);
    return item;
  }

  feed(dragon, now) {
    const stage = DRAGONS.stages[dragon.stage];
    if (!stage || stage.duration <= 0) return false;
    const elapsed = now - dragon.stageStart;
    const remaining = Math.max(0, stage.duration - elapsed);
    dragon.stageStart -= remaining * DRAGONS.feedGrowthBoost;
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

  /** Advance growth clocks by skipped real-ms (rest). */
  advanceTime(ms, now) {
    for (const d of this.dragons) {
      d.stageStart -= ms;
    }
    for (const b of this.breeding.values()) {
      if (b.breedStart) b.breedStart -= ms;
      if (b.cooldownUntil) b.cooldownUntil -= ms;
      if (b.egg?.hatchAt) b.egg.hatchAt -= ms;
    }
    // Process growth catches-up in next update; force one growth pass
    this._growAll(now);
  }

  _growAll(now) {
    for (const d of this.dragons) {
      while (true) {
        const stageDef = DRAGONS.stages[d.stage];
        if (!stageDef || stageDef.duration <= 0) break;
        if (now - d.stageStart < stageDef.duration) break;
        d.stage = Math.min(d.stage + 1, DRAGONS.stages.length - 1);
        d.stageStart = now;
        const { name, pos, rot } = rebuildDragonMesh(d);
        this.scene.remove(d.mesh);
        d.mesh = createDragonMesh(d.sex, name, d.rarity);
        d.mesh.position.copy(pos);
        d.mesh.rotation.y = rot;
        this.scene.add(d.mesh);
      }
    }
  }

  _ensureBreedState(penId) {
    if (!this.breeding.has(penId)) {
      this.breeding.set(penId, {
        penId,
        breedStart: null,
        cooldownUntil: 0,
        egg: null,
      });
    }
    return this.breeding.get(penId);
  }

  getBreedState(penId) {
    return this._ensureBreedState(penId);
  }

  /** Idle XP for adults in pens. Uses grantFn(dragon, amount). */
  tickAdultIdleXp(dt, grantFn, perSec) {
    if (!perSec) return;
    for (const d of this.dragons) {
      if (d.stage < 2) continue;
      grantFn(d, perSec * dt);
    }
  }


  update(now, dt, buildings) {
    const pens = buildings.buildings.filter(
      (b) => b.type === 'dragonPen' || b.type === 'breedingPen'
    );
    const penById = new Map(pens.map((b) => [b.id, b]));

    this._growAll(now);

    for (const d of this.dragons) {
      const pen = penById.get(d.penId);
      if (!pen) continue;

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
        const step = Math.min(DRAGONS.wanderSpeed * dt, dist);
        d.x += (dx / dist) * step;
        d.z += (dz / dist) * step;
        d.mesh.position.x = d.x;
        d.mesh.position.z = d.z;
        d.mesh.rotation.y = Math.atan2(dx, dz);
      }
      if (d.mesh.userData.wings) {
        d.mesh.userData.wings.rotation.z = Math.sin(now * 0.008) * 0.15;
      }
      if (d.mesh.userData.aura) {
        d.mesh.userData.aura.rotation.z = now * 0.001;
      }
      if (d.mesh.userData.sparks) {
        d.mesh.userData.sparks.rotation.y = now * 0.002;
      }
    }

  }

  /** Called from game with rarity roller injected to keep update sync. */
  tickBreeding(now, buildings, breedingCfg, rollFn, onEggLaid, onHatched) {
    for (const pen of buildings.buildings.filter((b) => b.type === 'breedingPen')) {
      const st = this._ensureBreedState(pen.id);
      const adults = this.dragonsInPen(pen.id).filter((d) => d.stage >= 2);
      const male = adults.find((d) => d.sex === 'male');
      const female = adults.find((d) => d.sex === 'female');
      const pair = male && female;

      if (st.egg && now >= st.egg.hatchAt) {
        const egg = st.egg;
        this.scene.remove(egg.mesh);
        st.egg = null;
        st.cooldownUntil = now + breedingCfg.cooldownMs;
        st.breedStart = null;
        onHatched?.(egg, pen);
        continue;
      }

      if (st.egg) continue;

      if (pair && now >= (st.cooldownUntil || 0)) {
        if (!st.breedStart) st.breedStart = now;
        if (now - st.breedStart >= breedingCfg.breedDurationMs) {
          const result = rollFn(male.rarity, female.rarity);
          const mesh = createEggMesh(result.rarity);
          mesh.position.set(pen.tx + pen.w / 2, 0.15, pen.tz + pen.d / 2);
          this.scene.add(mesh);
          st.egg = {
            rarity: result.rarity,
            sex: result.sex,
            upgraded: result.upgraded,
            hatchAt: now + breedingCfg.hatchDurationMs,
            mesh,
            parentA: male.rarity,
            parentB: female.rarity,
          };
          st.breedStart = null;
          onEggLaid?.(st.egg, pen);
        }
      } else if (!pair) {
        st.breedStart = null;
      }
    }
  }

  /** Manual hatch if egg ready or player forces when hatchAt passed / early optional. */
  hatchEgg(penId, now, force = false) {
    const st = this.breeding.get(penId);
    if (!st?.egg) return null;
    if (!force && now < st.egg.hatchAt) return null;
    const egg = st.egg;
    this.scene.remove(egg.mesh);
    st.egg = null;
    st.cooldownUntil = now + 45_000; // overwritten by caller with config
    st.breedStart = null;
    return egg;
  }

  getBreedProgress(penId, now, breedingCfg) {
    const st = this.breeding.get(penId);
    if (!st) return null;
    if (st.egg) {
      const total = breedingCfg.hatchDurationMs;
      const left = Math.max(0, st.egg.hatchAt - now);
      return { phase: 'hatching', progress: 1 - left / total, egg: st.egg };
    }
    if (st.breedStart) {
      const total = breedingCfg.breedDurationMs;
      const elapsed = now - st.breedStart;
      return { phase: 'breeding', progress: Math.min(1, elapsed / total) };
    }
    if (st.cooldownUntil && now < st.cooldownUntil) {
      const total = breedingCfg.cooldownMs;
      const left = st.cooldownUntil - now;
      return { phase: 'cooldown', progress: 1 - left / total };
    }
    const adults = this.dragonsInPen(penId).filter((d) => d.stage >= 2);
    const hasPair =
      adults.some((d) => d.sex === 'male') && adults.some((d) => d.sex === 'female');
    return { phase: hasPair ? 'ready' : 'waiting', progress: 0 };
  }

  serialize() {
    return {
      dragons: this.dragons.map((d) => ({
        id: d.id,
        sex: d.sex,
        stage: d.stage,
        stageStart: d.stageStart,
        penId: d.penId,
        penType: d.penType,
        rarity: normalizeRarity(d.rarity),
        level: d.level ?? 1,
        xp: d.xp ?? 0,
        missionRestUntil: d.missionRestUntil || 0,
        x: d.x,
        z: d.z,
      })),
      breeding: [...this.breeding.entries()].map(([penId, st]) => ({
        penId,
        breedStart: st.breedStart,
        cooldownUntil: st.cooldownUntil,
        egg: st.egg
          ? {
              rarity: st.egg.rarity,
              sex: st.egg.sex,
              upgraded: st.egg.upgraded,
              hatchAt: st.egg.hatchAt,
              parentA: st.egg.parentA,
              parentB: st.egg.parentB,
            }
          : null,
      })),
    };
  }

  deserialize(data, now, buildings) {
    for (const d of this.dragons) this.scene.remove(d.mesh);
    for (const st of this.breeding.values()) {
      if (st.egg?.mesh) this.scene.remove(st.egg.mesh);
    }
    this.dragons = [];
    this.breeding.clear();
    this.nextId = 1;

    const list = Array.isArray(data) ? data : data?.dragons || [];
    const breedList = Array.isArray(data) ? [] : data?.breeding || [];

    for (const raw of list) {
      const rarity = normalizeRarity(raw.rarity);
      const name = DRAGONS.stages[raw.stage]?.name || 'baby';
      const mesh = createDragonMesh(raw.sex, name, rarity);
      mesh.position.set(raw.x, 0, raw.z);
      this.scene.add(mesh);
      this.dragons.push({
        id: raw.id,
        sex: raw.sex,
        stage: raw.stage,
        stageStart: raw.stageStart || now,
        penId: raw.penId,
        penType: raw.penType || 'dragonPen',
        rarity,
        level: raw.level ?? 1,
        xp: raw.xp ?? 0,
        missionRestUntil: raw.missionRestUntil || 0,
        mesh,
        x: raw.x,
        z: raw.z,
        roamTarget: null,
        roamTimer: 0,
      });
      this.nextId = Math.max(this.nextId, raw.id + 1);
    }

    const penById = new Map(buildings.buildings.map((b) => [b.id, b]));
    for (const raw of breedList) {
      const st = {
        penId: raw.penId,
        breedStart: raw.breedStart,
        cooldownUntil: raw.cooldownUntil || 0,
        egg: null,
      };
      if (raw.egg) {
        const mesh = createEggMesh(raw.egg.rarity);
        const pen = penById.get(raw.penId);
        if (pen) mesh.position.set(pen.tx + pen.w / 2, 0.15, pen.tz + pen.d / 2);
        this.scene.add(mesh);
        st.egg = { ...raw.egg, mesh };
      }
      this.breeding.set(raw.penId, st);
    }
  }
}

