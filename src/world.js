import * as THREE from 'three';
import { WORLD } from './config.js';

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
  tex.repeat.set(WORLD.size / 8, WORLD.size / 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

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
  constructor(scene) {
    this.scene = scene;
    this.size = WORLD.size;
    this.half = WORLD.half;

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(this.size, this.size, 1, 1);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      map: makeGrassTexture(),
      roughness: 0.95,
      metalness: 0,
    });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.receiveShadow = true;
    this.ground.name = 'ground';
    scene.add(this.ground);

    // Soft edge border walls (invisible collision boxes + visual fence posts sparingly)
    this._addBorders(scene);

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

  _addBorders(scene) {
    const edge = this.half;
    const h = 1.2;
    const mat = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.85 });
    const posts = [];
    // Corner markers + mid-edge posts every 50 units
    for (let i = -edge; i <= edge; i += 50) {
      posts.push([i, -edge], [i, edge], [-edge, i], [edge, i]);
    }
    const geo = new THREE.CylinderGeometry(0.25, 0.3, h, 6);
    const inst = new THREE.InstancedMesh(geo, mat, posts.length);
    const dummy = new THREE.Object3D();
    posts.forEach((p, idx) => {
      dummy.position.set(p[0], h / 2, p[1]);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
    });
    inst.castShadow = true;
    scene.add(inst);

    // Visual edge fence rails
    const railMat = new THREE.MeshStandardMaterial({ color: 0x6b5040 });
    const makeRail = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, d), railMat);
      m.position.set(x, 0.7, z);
      scene.add(m);
    };
    makeRail(this.size, 0.2, 0, -edge);
    makeRail(this.size, 0.2, 0, edge);
    makeRail(0.2, this.size, -edge, 0);
    makeRail(0.2, this.size, edge, 0);
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
      if (Math.abs(x) > this.half - 1 || Math.abs(z) > this.half - 1) {
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

  /** Clamp position to world bounds (with margin for player radius). */
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
    const half = this.half;
    return (
      tx >= -half &&
      tz >= -half &&
      tx + w <= half &&
      tz + d <= half
    );
  }
}
