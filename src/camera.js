import * as THREE from 'three';
import { CAMERA } from './config.js';

export class FollowCamera {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.yaw = 0;
    this.pitch = CAMERA.defaultPitch;
    this.distance = CAMERA.defaultDistance;
    this.target = new THREE.Vector3();
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey)) {
        this._dragging = true;
        this._lastX = e.clientX;
        this._lastY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - this._lastX;
      const dy = e.clientY - this._lastY;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      this.yaw -= dx * CAMERA.rotateSpeed;
      this.pitch = Math.max(
        CAMERA.minPitch,
        Math.min(CAMERA.maxPitch, this.pitch + dy * CAMERA.rotateSpeed)
      );
    });
    canvas.addEventListener('pointerup', (e) => {
      this._dragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.distance = Math.max(
        CAMERA.minDistance,
        Math.min(CAMERA.maxDistance, this.distance + e.deltaY * CAMERA.zoomSpeed * 0.05)
      );
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update(dt, targetPos, input) {
    if (input.rotLeft) this.yaw += CAMERA.keyRotateSpeed * dt;
    if (input.rotRight) this.yaw -= CAMERA.keyRotateSpeed * dt;

    this.target.lerp(targetPos, 1 - Math.pow(0.001, dt));
    this.target.y = targetPos.y + 1.2;

    const x = this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance;
    const y = this.target.y + Math.sin(this.pitch) * this.distance;
    const z = this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance;

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }

  get yawAngle() {
    return this.yaw;
  }
}
