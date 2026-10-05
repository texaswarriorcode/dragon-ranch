import * as THREE from 'three';
import { WORLD, DAY, BUILDINGS, PLAYER, DRAGONS } from './config.js';
import { World } from './world.js';
import { Player } from './player.js';
import { FollowCamera } from './camera.js';
import { Input } from './input.js';
import { BuildingManager, footprintFor } from './buildings.js';
import { CropManager, createCropMesh } from './crops.js';
import { DragonManager, createDragonMesh } from './dragons.js';
import { UI } from './ui.js';
import { saveGame, loadGame, clearSave, defaultInventory } from './save.js';

const BUILD_TYPES = new Set(['farmhouse', 'farmPlot', 'dragonPen']);

export class Game {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.gameTime = DAY.lengthMs * 0.3; // start morning
    this.creative = false;
    this.inventory = defaultInventory();
    this._autosaveAcc = 0;
    this._hoverDragon = null;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b8e0);
    this.scene.fog = new THREE.Fog(0x87b8e0, 80, 220);

    // Camera
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);
    this.followCam = new FollowCamera(this.camera, canvas);

    // Lights
    this.hemi = new THREE.HemisphereLight(0xb1e1ff, 0x4a7a32, 0.55);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d0, 1.1);
    this.sun.position.set(40, 60, 20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 160;
    this.sun.shadow.camera.left = -50;
    this.sun.shadow.camera.right = 50;
    this.sun.shadow.camera.top = 50;
    this.sun.shadow.camera.bottom = -50;
    this.scene.add(this.sun);
    this.amb = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(this.amb);

    // Systems
    this.world = new World(this.scene);
    this.player = new Player(this.scene);
    this.input = new Input(canvas);
    this.buildings = new BuildingManager(this.scene);
    this.crops = new CropManager(this.scene);
    this.dragons = new DragonManager(this.scene);
    this.ui = new UI(uiRoot);

    this.ui.onSelect = (id) => this._onSelect(id);
    this.ui.onNewGame = () => this.newGame();
    this.ui.onToggleCreative = () => {
      this.creative = !this.creative;
      if (this.creative) {
        this.inventory.seeds = 999;
        this.inventory.dragonfruit = 999;
        this.inventory.maleDragons = 999;
        this.inventory.femaleDragons = 999;
        this.inventory.farmhouses = 999;
        this.inventory.farmPlots = 999;
        this.inventory.dragonPens = 999;
        this.ui.toast('Creative mode ON — unlimited items');
      } else {
        this.ui.toast('Creative mode OFF');
      }
      this.ui.updateInventory(this.inventory);
    };

    window.addEventListener('resize', () => this._onResize());

    // Demo / load
    const params = new URLSearchParams(location.search);
    if (params.get('demo') === '1') {
      this._loadDemo();
    } else {
      const saved = loadGame();
      if (saved) this._applySave(saved);
      else this._placeStarterHint();
    }

    this.ui.updateInventory(this.inventory);
    this.ui.select(null);
  }

  _placeStarterHint() {
    // Spawn player near origin; nothing pre-placed
    this.player.mesh.position.set(2, 0, 8);
  }


  _loadDemo() {
    clearSave();
    this.inventory = defaultInventory();
    this.gameTime = DAY.lengthMs * 0.35;
    this.player.mesh.position.set(4, 0, 14);

    const now = performance.now();

    this.buildings.place('farmhouse', -4, -2, 0);

    const plot = this.buildings.place('farmPlot', 6, 0, 0);
    if (plot) {
      const stages = [1, 2, 3, 4, 4, 3, 2, 1, 4, 3, 2, 4, 1, 2, 3, 4];
      for (let lz = 0; lz < 4; lz++) {
        for (let lx = 0; lx < 4; lx++) {
          this.crops.plant(plot, lx, lz, now);
          const c = this.crops.get(plot.id, lx, lz);
          const want = stages[lx + lz * 4];
          c.stage = want;
          c.stageStart = now;
          this.scene.remove(c.mesh);
          c.mesh = createCropMesh(want);
          c.mesh.position.set(c.worldX, 0.1, c.worldZ);
          this.scene.add(c.mesh);
        }
      }
    }

    const pen = this.buildings.place('dragonPen', 12, -2, 0);
    if (pen) {
      const specs = [
        { sex: 'male', stage: 1 },
        { sex: 'female', stage: 2 },
        { sex: 'male', stage: 0 },
        { sex: 'female', stage: 0 },
      ];
      for (const spec of specs) {
        const d = this.dragons.place(spec.sex, pen, now);
        if (!d) continue;
        if (spec.stage > 0) {
          d.stage = spec.stage;
          d.stageStart = now;
          const pos = d.mesh.position.clone();
          this.scene.remove(d.mesh);
          d.mesh = createDragonMesh(d.sex, DRAGONS.stages[spec.stage].name);
          d.mesh.position.copy(pos);
          this.scene.add(d.mesh);
        }
      }
    }

    this.inventory.farmhouses = Math.max(0, this.inventory.farmhouses - 1);
    this.inventory.farmPlots = Math.max(0, this.inventory.farmPlots - 1);
    this.inventory.dragonPens = Math.max(0, this.inventory.dragonPens - 1);
    this.inventory.maleDragons = Math.max(0, this.inventory.maleDragons - 2);
    this.inventory.femaleDragons = Math.max(0, this.inventory.femaleDragons - 2);
    this.ui.updateInventory(this.inventory);
    this.ui.toast('Demo scene loaded');
  }

  _applySave(data) {
    const now = performance.now();
    this.inventory = { ...defaultInventory(), ...data.inventory };
    this.gameTime = data.gameTime ?? this.gameTime;
    this.creative = !!data.creative;
    if (data.player) {
      this.player.mesh.position.set(data.player.x, 0, data.player.z);
    }
    this.buildings.deserialize(data.buildings || []);
    this.crops.deserialize(data.crops || [], this.buildings, now);
    this.dragons.deserialize(data.dragons || [], now);
    this.ui.toast('Game loaded');
  }

  newGame() {
    clearSave();
    location.href = location.pathname;
  }

  _onSelect(id) {
    if (BUILD_TYPES.has(id)) {
      this.buildings.setGhost(id);
    } else {
      this.buildings.clearGhost();
    }
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _invKeyFor(selected) {
    const map = {
      farmhouse: 'farmhouses',
      farmPlot: 'farmPlots',
      dragonPen: 'dragonPens',
      seeds: 'seeds',
      maleDragon: 'maleDragons',
      femaleDragon: 'femaleDragons',
      dragonfruit: 'dragonfruit',
    };
    return map[selected];
  }

  _hasItem(selected) {
    const k = this._invKeyFor(selected);
    return k && this.inventory[k] > 0;
  }

  _consume(selected, n = 1) {
    const k = this._invKeyFor(selected);
    if (!k) return;
    if (!this.creative) this.inventory[k] = Math.max(0, this.inventory[k] - n);
    this.ui.updateInventory(this.inventory);
  }

  _add(invKey, n = 1) {
    this.inventory[invKey] = (this.inventory[invKey] || 0) + n;
    this.ui.updateInventory(this.inventory);
  }

  start() {
    this.renderer.setAnimationLoop(() => this._frame());
  }

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();
    this.gameTime += dt * 1000;

    // Hotbar number keys
    for (const item of this.ui.hotbarItems) {
      if (this.input.pressed(item.key)) {
        this.ui.select(this.ui.selected === item.id ? null : item.id);
      }
    }

    // Camera + player
    this.followCam.update(dt, this.player.position, this.input);
    this.player.update(dt, this.input, this.followCam.yawAngle, this.world, this.buildings.getColliders());
    this.world.updateGrass(this.player.position, this.clock.elapsedTime);

    // Day/night
    this._updateLighting();
    this.ui.updateDay(this.gameTime, DAY.lengthMs);

    // Growth systems
    this.crops.update(now);
    this.dragons.update(now, dt, this.buildings);

    // Cursor ground hit / build ghost
    const hit = this.world.groundHit(this.camera, this.input.mouseNdc.x, this.input.mouseNdc.y);
    let prompt = '';
    let tooltip = '';

    if (hit) {
      const { tx, tz } = this.world.tileFromWorld(hit.x, hit.z);
      this.world.showGridAt(tx, tz);

      const selected = this.ui.selected;

      if (selected && BUILD_TYPES.has(selected)) {
        if (this.input.rotateBuild) this.buildings.rotateGhost();
        if (this.input.cancel) {
          this.ui.select(null);
        } else {
          const { w, d } = footprintFor(selected, this.buildings.ghostRot);
          // Snap ghost so footprint SW corner is on tile under cursor (adjusted so cursor is near center)
          const gtx = tx - Math.floor(w / 2);
          const gtz = tz - Math.floor(d / 2);
          const inReach = this.player.withinReach(gtx + w / 2, gtz + d / 2);
          const valid =
            this._hasItem(selected) &&
            this.buildings.canPlace(selected, gtx, gtz, this.buildings.ghostRot) &&
            inReach;
          this.buildings.updateGhost(gtx, gtz, valid);
          prompt = valid
            ? `Click / F to place ${BUILDINGS[selected].label}`
            : !inReach
              ? 'Too far away'
              : !this._hasItem(selected)
                ? 'None left in inventory'
                : 'Cannot place here';

          if (valid && this.input.interactKey) {
            const placed = this.buildings.place(selected, gtx, gtz, this.buildings.ghostRot);
            if (placed) {
              this._consume(selected);
              this.ui.toast(`Placed ${BUILDINGS[selected].label}`);
            }
          }
        }
      } else if (selected === 'seeds') {
        const info = this.crops.findAtWorld(tx, tz, this.buildings);
        if (info && !info.crop) {
          const reach = this.player.withinReach(tx + 0.5, tz + 0.5);
          if (reach && this._hasItem('seeds')) {
            prompt = 'Press F / click to plant seed';
            if (this.input.interactKey) {
              if (this.crops.plant(info.plot, info.lx, info.lz, now)) {
                this._consume('seeds');
                this.ui.toast('Planted dragonfruit seed');
              }
            }
          } else if (!reach) prompt = 'Move closer to plant';
        } else if (info?.crop) {
          prompt = info.crop.stage >= 4 ? 'Ready to harvest! (select hand / empty)' : 'Tile already planted';
        } else {
          prompt = 'Plant seeds on a farm plot';
        }
      } else if (selected === 'maleDragon' || selected === 'femaleDragon') {
        const pen = this.buildings.findPenAt(tx, tz);
        const sex = selected === 'maleDragon' ? 'male' : 'female';
        if (pen) {
          const count = this.dragons.countInPen(pen.id);
          const reach = this.player.withinReach(tx + 0.5, tz + 0.5);
          if (reach && this._hasItem(selected) && count < BUILDINGS.dragonPen.maxDragons) {
            prompt = `Press F / click to place ${sex} dragon baby (${count}/${BUILDINGS.dragonPen.maxDragons})`;
            if (this.input.interactKey) {
              const d = this.dragons.place(sex, pen, now);
              if (d) {
                this._consume(selected);
                this.ui.toast(`Placed ${sex} dragon`);
              }
            }
          } else if (count >= BUILDINGS.dragonPen.maxDragons) {
            prompt = 'Pen is full';
          } else if (!reach) prompt = 'Move closer';
        } else {
          prompt = 'Place dragons inside a dragon pen';
        }
      } else if (selected === 'dragonfruit') {
        const dragon = this.dragons.findNear(hit.x, hit.z, 2.5);
        if (dragon && this._hasItem('dragonfruit')) {
          const reach = this.player.withinReach(dragon.x, dragon.z);
          if (reach) {
            const stage = DRAGONS.stages[dragon.stage]?.name;
            prompt =
              stage === 'adult'
                ? 'Dragon is already adult'
                : 'Press F / click to feed dragonfruit';
            if (stage !== 'adult' && this.input.interactKey) {
              if (this.dragons.feed(dragon, now)) {
                this._consume('dragonfruit');
                this.ui.toast('Fed dragon — growth sped up!');
              }
            }
          }
        } else {
          prompt = 'Feed dragonfruit to a dragon in a pen';
        }
      } else {
        // Default interact: harvest crops
        const info = this.crops.findAtWorld(tx, tz, this.buildings);
        if (info?.crop?.stage >= 4) {
          const reach = this.player.withinReach(tx + 0.5, tz + 0.5);
          if (reach) {
            prompt = 'Press F / click to harvest dragonfruit';
            if (this.input.interactKey) {
              const yield_ = this.crops.harvest(info.plot.id, info.lx, info.lz);
              if (yield_) {
                this._add('dragonfruit', yield_.fruit);
                this._add('seeds', yield_.seeds);
                this.ui.toast(`Harvested +${yield_.fruit} fruit, +${yield_.seeds} seed`);
              }
            }
          } else prompt = 'Move closer to harvest';
        }

        // Hover dragons for tooltip
        const dragon = this.dragons.findNear(hit.x, hit.z, 2.0);
        if (dragon) {
          tooltip = this.ui.dragonTooltip(dragon);
        }
      }
    } else {
      this.world.hideGrid();
    }

    if (this.input.cancel && this.ui.selected) {
      this.ui.select(null);
    }

    this.ui.setPrompt(prompt);
    this.ui.setTooltip(tooltip, this.input.clientX || 0, this.input.clientY || 0);

    // Shadow follow player
    this.sun.position.set(
      this.player.position.x + 40,
      60,
      this.player.position.z + 20
    );
    this.sun.target.position.copy(this.player.position);
    this.sun.target.updateMatrixWorld();

    // Autosave
    this._autosaveAcc += dt;
    if (this._autosaveAcc > 8) {
      this._autosaveAcc = 0;
      saveGame(this);
    }

    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  _updateLighting() {
    const t = ((this.gameTime % DAY.lengthMs) + DAY.lengthMs) % DAY.lengthMs;
    const frac = t / DAY.lengthMs;
    // Bright enough to play: night dips but not too dark
    let sunIntensity = 1.1;
    let hemiIntensity = 0.55;
    let ambIntensity = 0.25;
    let bg = new THREE.Color(0x87b8e0);
    if (frac < 0.2 || frac > 0.85) {
      // night
      const night = frac < 0.2 ? (0.2 - frac) / 0.2 : (frac - 0.85) / 0.15;
      sunIntensity = 0.35 + (1 - night) * 0.3;
      hemiIntensity = 0.3;
      ambIntensity = 0.2;
      bg.set(0x1a2040).lerp(new THREE.Color(0x87b8e0), 1 - night * 0.7);
    } else if (frac < 0.3) {
      // sunrise
      const k = (frac - 0.2) / 0.1;
      sunIntensity = 0.5 + k * 0.6;
      bg.set(0xff9966).lerp(new THREE.Color(0x87b8e0), k);
    } else if (frac > 0.72) {
      const k = (frac - 0.72) / 0.13;
      sunIntensity = 1.1 - k * 0.5;
      bg.set(0x87b8e0).lerp(new THREE.Color(0xff7744), k * 0.6);
    }
    this.sun.intensity = sunIntensity;
    this.hemi.intensity = hemiIntensity;
    this.amb.intensity = ambIntensity;
    this.scene.background.copy(bg);
    this.scene.fog.color.copy(bg);

    const angle = (frac - 0.25) * Math.PI * 2;
    this._sunAngle = angle;
  }
}

