import * as THREE from 'three';
import { WORLD, LAND } from './config.js';

/** Procedural tiling grass texture via canvas. */
function makeGrassTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#4a7a32';
  ctx.fillRect(0, 0, size, size);

  // subtle noise blades
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const h = 3 + Math.random() * 8;
    const shade = 40 + Math.floor(Math.random() * 50);
    ctx.strokeStyle = `rgb(${shade},${100 + shade / 2},${30 + shade / 4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 2, y - h);
    ctx.stroke();
  }

  // faint dirt patches
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 4 + Math.random() * 12;
    ctx.fillStyle = `rgba(90, 70, 40, ${0.08 + Math.random() * 0.12})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(LAND.regionSize / 8, LAND.regionSize / 8); // per region tile
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const FOG_TINT = new THREE.Color(0.42, 0.45, 0.42); // unowned land: darker, desaturated
const WHITE = new THREE.Color(1, 1, 1);

function makeTuftGeometry() {
  const geo = new THREE.BufferGeometry();
  const blades = 5;
  const positions = [];
  const colors = [];
  for (let i = 0; i < blades; i++) {
    const angle = (i / blades) * Math.PI * 2 + Math.random() * 0.4;
    const len = 0.25 + Math.random() * 0.35;
    const lean = 0.05 + Math.random() * 0.08;
    const ox = Math.cos(angle) * 0.08;
    const oz = Math.sin(angle) * 0.08;
    positions.push(ox, 0, oz, ox + Math.cos(angle) * lean, len, oz + Math.sin(angle) * lean);
    const g = 0.45 + Math.random() * 0.35;
    colors.push(0.2, g, 0.12, 0.25, g + 0.1, 0.15);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

export class World {
  constructor(scene, land) {
    this.scene = scene;
    this.land = land;
    this.size = WORLD.size;
    this.half = WORLD.half;
    this.fullHalf = (LAND.regionSize * 3) / 2; // whole 3×3 map

    // Ground: one quad per 1000×1000 region (9 draw calls, no overdraw). Unowned regions
    // share the same grass texture with a darkened material instead of a transparent overlay.
    const grass = makeGrassTexture();
    this._groundMat = new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95, metalness: 0 });
    this._fogMat = new THREE.MeshStandardMaterial({ map: grass, roughness: 1, metalness: 0, color: FOG_TINT });
    const tileGeo = new THREE.PlaneGeometry(LAND.regionSize, LAND.regionSize, 1, 1);
    tileGeo.rotateX(-Math.PI / 2);
    this.ground = new THREE.Group();
    this.ground.name = 'ground';
    this._tiles = new Map(); // regionId -> mesh
    for (const r of LAND.regions) {
      const m = new THREE.Mesh(tileGeo, this._groundMat);
      m.position.set(r.rx * LAND.regionSize, 0, r.rz * LAND.regionSize);
      m.receiveShadow = true;
      m.name = `ground-${r.id}`;
      this.ground.add(m);
      this._tiles.set(r.id, m);
    }
    scene.add(this.ground);

    // Unowned (fogged) regions + owned-land border fence / glow line (rebuilt on purchase)
    this._fogged = new Set();
    this._fading = [];
    this.borderGroup = new THREE.Group();
    this.borderGroup.name = 'landBorders';
    scene.add(this.borderGroup);
    this.refreshLand();

    // Instanced grass tufts near player
    this.tuftCount = 800;
    this.tuftRadius = 28;
    const tuftGeo = makeTuftGeometry();
    const tuftMat = new THREE.LineBasicMaterial({ vertexColors: true });
    this.tufts = new THREE.LineSegments(tuftGeo, tuftMat);
    // Use InstancedMesh of a simple cone tuft instead for better look
    scene.remove(this.tufts);

    const bladeGeo = new THREE.ConeGeometry(0.06, 0.4, 3);
    bladeGeo.translate(0, 0.2, 0);
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0x3d8a28 });
    this.grassInstanced = new THREE.InstancedMesh(bladeGeo, bladeMat, this.tuftCount);
    this.grassInstanced.frustumCulled = false;
    this.grassInstanced.castShadow = false;
    this.grassInstanced.receiveShadow = false;
    scene.add(this.grassInstanced);
    this._dummy = new THREE.Object3D();
    this._lastTuftUpdate = 0;

    // Tile grid overlay (near cursor)
    this.gridHelper = this._makeGridOverlay();
    scene.add(this.gridHelper);
    this.gridHelper.visible = false;

    // Raycaster helpers
    this.raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
  }

  /** Rebuild overlays + borders from land ownership. `revealed` = ids just bought (fade out). */
  refreshLand(revealed = null) {
    const land = this.land;
    for (const r of LAND.regions) {
      const owned = !land || land.isOwned(r.id);
      const tile = this._tiles.get(r.id);
      if (!owned && !this._fogged.has(r.id)) {
        this._fogged.add(r.id);
        tile.material = this._fogMat;
      } else if (owned && this._fogged.has(r.id)) {
        this._fogged.delete(r.id);
        if (revealed && revealed.includes(r.id)) {
          // short reveal: brighten the darkened tile back to normal grass
          tile.material = this._fogMat.clone();
          this._fading.push({ mesh: tile, t: 0 });
        } else {
          tile.material = this._groundMat;
        }
      }
    }
    this._buildBorders();
  }

  /** Fence posts + rail along every owned edge; a glowing gold line where the
   *  neighbouring land is buyable/locked (not the outer map edge). */
  _buildBorders() {
    const g = this.borderGroup;
    for (const c of [...g.children]) {
      g.remove(c);
      c.geometry?.dispose?.();
    }
    const S = LAND.regionSize;
    const H = S / 2;
    const segs = []; // { x0, z0, x1, z1, glow }
    const owned = (rx, rz) => (this.land ? this.land.ownedCell(rx, rz) : rx === 0 && rz === 0);
    const inMap = (rx, rz) => Math.abs(rx) <= 1 && Math.abs(rz) <= 1;
    for (const r of LAND.regions) {
      if (!owned(r.rx, r.rz)) continue;
      const cx = r.rx * S, cz = r.rz * S;
      const edges = [
        [r.rx, r.rz - 1, cx - H, cz - H, cx + H, cz - H],
        [r.rx, r.rz + 1, cx - H, cz + H, cx + H, cz + H],
        [r.rx - 1, r.rz, cx - H, cz - H, cx - H, cz + H],
        [r.rx + 1, r.rz, cx + H, cz - H, cx + H, cz + H],
      ];
      for (const [nx, nz, x0, z0, x1, z1] of edges) {
        if (owned(nx, nz)) continue;
        segs.push({ x0, z0, x1, z1, glow: inMap(nx, nz) });
      }
    }
    const postH = 1.2;
    const posts = [];
    for (const s of segs) {
      const len = Math.hypot(s.x1 - s.x0, s.z1 - s.z0);
      for (let d = 0; d <= len; d += 50) {
        posts.push([s.x0 + ((s.x1 - s.x0) * d) / len, s.z0 + ((s.z1 - s.z0) * d) / len]);
      }
    }
    const postMat = this._postMat || (this._postMat = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.85 }));
    const railMat = this._railMat || (this._railMat = new THREE.MeshStandardMaterial({ color: 0x6b5040 }));
    const glowMat = this._glowMat || (this._glowMat = new THREE.MeshBasicMaterial({
      color: 0xffd54a, transparent: true, opacity: 0.85, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    }));
    if (posts.length) {
      const inst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.3, postH, 6), postMat, posts.length);
      const dummy = new THREE.Object3D();
      posts.forEach((p, i) => {
        dummy.position.set(p[0], postH / 2, p[1]);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      });
      inst.castShadow = true;
      g.add(inst);
    }
    for (const s of segs) {
      const horiz = s.z0 === s.z1;
      const len = Math.hypot(s.x1 - s.x0, s.z1 - s.z0);
      const mx = (s.x0 + s.x1) / 2, mz = (s.z0 + s.z1) / 2;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 0.2, 0.15, horiz ? 0.2 : len), railMat);
      rail.position.set(mx, 0.7, mz);
      g.add(rail);
      if (s.glow) {
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(horiz ? len : 0.5, horiz ? 0.5 : len), glowMat);
        strip.rotation.x = -Math.PI / 2;
        strip.position.set(mx, 0.02, mz);
        strip.renderOrder = 2;
        g.add(strip);
      }
    }
    this.borderSegments = segs;
  }

  /** Per-frame: land reveal fades. */
  update(dt) {
    for (let i = this._fading.length - 1; i >= 0; i--) {
      const f = this._fading[i];
      f.t += dt;
      f.mesh.material.color.copy(FOG_TINT).lerp(WHITE, Math.min(1, f.t / 1.5));
      if (f.t >= 1.5) {
        f.mesh.material.dispose();
        f.mesh.material = this._groundMat;
        this._fading.splice(i, 1);
      }
    }
  }

  _makeGridOverlay() {
    const group = new THREE.Group();
    group.name = 'tileGrid';
    const size = 9; // 9x9 tiles around cursor
    const half = Math.floor(size / 2);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const points = [];
    for (let i = 0; i <= size; i++) {
      const a = i - half;
      points.push(a, 0.02, -half, a, 0.02, half);
      points.push(-half, 0.02, a, half, 0.02, a);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    group.add(new THREE.LineSegments(geo, mat));
    return group;
  }

  /** Update grass instances near player. */
  updateGrass(playerPos, time) {
    if (time - this._lastTuftUpdate < 0.4) return;
    this._lastTuftUpdate = time;
    const R = this.tuftRadius;
    const seed = Math.floor(playerPos.x / 4) * 10007 + Math.floor(playerPos.z / 4);
    let n = 0;
    // Deterministic-ish scatter in a square around player
    for (let i = 0; i < this.tuftCount; i++) {
      const sx = ((seed * (i + 1) * 1103515245 + 12345) >>> 0) / 0xffffffff;
      const sz = ((seed * (i + 7) * 1664525 + 1013904223) >>> 0) / 0xffffffff;
      const x = playerPos.x + (sx - 0.5) * R * 2;
      const z = playerPos.z + (sz - 0.5) * R * 2;
      // tufts only on owned land (unowned land reads as bare / unavailable)
      if (this.land ? !this.land.isPointOwned(x, z) : Math.abs(x) > this.half - 1 || Math.abs(z) > this.half - 1) {
        this._dummy.scale.set(0, 0, 0);
      } else {
        const h = 0.6 + (sx * 0.8);
        this._dummy.scale.set(1, h, 1);
        this._dummy.position.set(x, 0, z);
        this._dummy.rotation.y = sx * Math.PI * 2;
      }
      this._dummy.updateMatrix();
      this.grassInstanced.setMatrixAt(n++, this._dummy.matrix);
    }
    this.grassInstanced.instanceMatrix.needsUpdate = true;
  }

  showGridAt(tileX, tileZ) {
    this.gridHelper.visible = true;
    this.gridHelper.position.set(Math.floor(tileX) + 0.5, 0, Math.floor(tileZ) + 0.5);
  }

  hideGrid() {
    this.gridHelper.visible = false;
  }

  /** Can a body of half-size `margin` stand at (x, z)? (owned land only) */
  canOccupy(x, z, margin = 1) {
    if (this.land) return this.land.canOccupy(x, z, margin);
    const lim = this.half - margin;
    return Math.abs(x) <= lim && Math.abs(z) <= lim;
  }

  /** Move one axis from `from` toward `to` (other axis fixed at `other`) staying on owned land.
   *  If the full move would leave owned land, stop flush at the crossed region edge. */
  moveAxis(from, to, other, axis, m) {
    const ok = (v) => (axis === 'x' ? this.canOccupy(v, other, m) : this.canOccupy(other, v, m));
    if (ok(to)) return to;
    if (to === from) return from;
    const S = LAND.regionSize, H = S / 2;
    const dir = Math.sign(to - from);
    const edge = dir > 0 ? Math.floor((from + m + H) / S) * S + H : Math.ceil((from - m - H) / S) * S - H;
    const cand = edge - dir * m;
    if ((dir > 0 ? cand >= from && cand <= to : cand <= from && cand >= to) && ok(cand - dir * 1e-6)) return cand;
    return from;
  }

  /** Clamp position to the home region bounds (legacy helper). */
  clampPosition(pos, margin = 1) {
    const lim = this.half - margin;
    pos.x = Math.max(-lim, Math.min(lim, pos.x));
    pos.z = Math.max(-lim, Math.min(lim, pos.z));
    return pos;
  }

  /** Raycast ground from NDC mouse. Returns world Vector3 or null. */
  groundHit(camera, ndcX, ndcY) {
    this._mouse.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this._mouse, camera);
    const hits = this.raycaster.intersectObject(this.ground);
    if (hits.length) return hits[0].point;
    return null;
  }

  tileFromWorld(x, z) {
    return { tx: Math.floor(x), tz: Math.floor(z) };
  }

  inBounds(tx, tz, w = 1, d = 1) {
    if (this.land) return this.land.isRectOwned(tx, tz, tx + w, tz + d);
    const half = this.half;
    return (
      tx >= -half &&
      tz >= -half &&
      tx + w <= half &&
      tz + d <= half
    );
  }
}
