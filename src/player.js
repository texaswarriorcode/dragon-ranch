import * as THREE from 'three';
import { PLAYER } from './config.js';

function makeAvatar() {
  const g = new THREE.Group();
  g.name = 'player';

  // Body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.7, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x3a6ea5, roughness: 0.7 })
  );
  body.position.y = 0.95;
  body.castShadow = true;
  g.add(body);

  // Head
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.38, 0.38),
    new THREE.MeshStandardMaterial({ color: 0xe8c4a0, roughness: 0.65 })
  );
  head.position.y = 1.5;
  head.castShadow = true;
  g.add(head);

  // Eyes on the +z face (the avatar's forward) so facing direction reads at a glance
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  for (const ex of [-0.08, 0.08]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), eyeMat);
    eye.position.set(ex, 1.54, 0.195);
    g.add(eye);
  }

  // Hat brim
  const hat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.12, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b4423 })
  );
  hat.position.y = 1.72;
  g.add(hat);
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.04, 8),
    new THREE.MeshStandardMaterial({ color: 0x5a3820 })
  );
  brim.position.y = 1.66;
  g.add(brim);

  // Legs
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.2), legMat);
  legL.position.set(-0.14, 0.35, 0);
  legL.castShadow = true;
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legL, legR);

  // Arms
  const armMat = new THREE.MeshStandardMaterial({ color: 0x3a6ea5 });
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), armMat);
  armL.position.set(-0.38, 1.0, 0);
  armL.castShadow = true;
  const armR = armL.clone();
  armR.position.x = 0.38;
  g.add(armL, armR);

  g.userData.parts = { body, head, legL, legR, armL, armR };
  return g;
}

export class Player {
  constructor(scene) {
    this.mesh = makeAvatar();
    this.mesh.position.set(0, 0, 0);
    scene.add(this.mesh);

    this.velocity = new THREE.Vector3();
    this.facing = 0; // yaw
    this.walkPhase = 0;
    this.moving = false;
    this.radius = PLAYER.radius;
    this.speed = PLAYER.speed;
    this.reach = PLAYER.reach;
  }

  get position() {
    return this.mesh.position;
  }

  /** Move with camera-relative WASD. collisions = array of {minX,maxX,minZ,maxZ}. */
  update(dt, input, cameraYaw, world, collisions, speedMult = 1) {
    const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));

    const wish = new THREE.Vector3();
    if (input.forward) wish.add(forward);
    if (input.back) wish.sub(forward);
    if (input.left) wish.sub(right);
    if (input.right) wish.add(right);

    this.moving = wish.lengthSq() > 0.001;
    if (this.moving) {
      wish.normalize().multiplyScalar(this.speed * speedMult * dt);
      const pos = this.mesh.position;

      // Axis-separated collision
      const tryX = pos.x + wish.x;
      const tryZ = pos.z + wish.z;
      const r = this.radius;

      // Colliders we already overlap (e.g. something was placed on top of us) are ignored
      // so the player can always walk out instead of being stuck forever.
      const blocking = collisions.filter((c) => !this._overlaps(pos.x, pos.z, r, c));
      if (!this._hitsAny(tryX, pos.z, r, blocking)) pos.x = tryX;
      if (!this._hitsAny(pos.x, tryZ, r, blocking)) pos.z = tryZ;

      world.clampPosition(pos, 1.5);

      this.facing = Math.atan2(wish.x, wish.z);
      this.mesh.rotation.y = this.facing;

      this.walkPhase += dt * 10;
      this._animateWalk(true, dt);
    } else {
      this._animateWalk(false, dt);
    }
  }

  _overlaps(x, z, r, c) {
    return x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ;
  }

  _hitsAny(x, z, r, collisions) {
    for (const c of collisions) {
      if (this._overlaps(x, z, r, c)) return true;
    }
    return false;
  }

  _animateWalk(walking, dt = 1 / 60) {
    const { legL, legR, armL, armR, body } = this.mesh.userData.parts;
    if (walking) {
      const s = Math.sin(this.walkPhase);
      legL.rotation.x = s * 0.55;
      legR.rotation.x = -s * 0.55;
      armL.rotation.x = -s * 0.4;
      armR.rotation.x = s * 0.4;
      body.position.y = 0.95 + Math.abs(s) * 0.04;
    } else {
      const k = Math.pow(0.8, dt * 60); // same settle speed at any frame rate
      legL.rotation.x *= k;
      legR.rotation.x *= k;
      armL.rotation.x *= k;
      armR.rotation.x *= k;
      body.position.y = 0.95;
    }
  }

  distanceTo(x, z) {
    const dx = this.mesh.position.x - x;
    const dz = this.mesh.position.z - z;
    return Math.hypot(dx, dz);
  }

  withinReach(x, z) {
    return this.distanceTo(x, z) <= this.reach;
  }
}
