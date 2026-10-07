import * as THREE from 'three';
import {
  DAY, BUILDINGS, DRAGONS, PLAYER, BREEDING, REST, RARITY,
  ECONOMY, DRAGON_STATS, MISSIONS,
} from './config.js';
import { World } from './world.js';
import { Player } from './player.js';
import { FollowCamera } from './camera.js';
import { Input } from './input.js';
import { BuildingManager, footprintFor } from './buildings.js';
import { CropManager, createCropMesh } from './crops.js';
import { DragonManager, createDragonMesh, createEggMesh } from './dragons.js';
import { WorkerManager } from './workers.js';
import { MissionManager, getMissionDef, missionsForBuildingType } from './missions.js';
import { UI } from './ui.js';
import {
  saveGame, loadGame, clearSave, defaultInventory, makeDragonItem, nextInvId, reserveInvId,
} from './save.js';
import { rollBreedingResult, rarityCss } from './rarity.js';
import { grantDragonXp } from './stats.js';
import { tryPurchase } from './marketplace/marketplace.js';

const BUILD_TYPES = new Set(['farmhouse', 'farmPlot', 'dragonPen', 'breedingPen', 'workerBunkhouse', 'dragonFieldTraining']);
// Structures the player collides with — can't be placed on top of the player.
const SOLID_BUILDINGS = new Set(['farmhouse', 'workerBunkhouse', 'dragonFieldTraining']);

export class Game {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.timer = new THREE.Timer(); // THREE.Clock is deprecated
    this.timer.connect(document);
    this.gameTime = DAY.lengthMs * 0.3;
    this.creative = false;
    this.inventory = defaultInventory();
    this.coins = ECONOMY.startingCoins;
    this.energy = PLAYER.energyMax;
    this.selectedDragonId = this.inventory.dragons[0]?.id ?? null;
    this._autosaveAcc = 0;
    this._resting = false;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap was removed in r18x
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b8e0);
    this.scene.fog = new THREE.Fog(0x87b8e0, 80, 220);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);
    this.followCam = new FollowCamera(this.camera, canvas);

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

    this.world = new World(this.scene);
    this.player = new Player(this.scene);
    this.input = new Input(canvas);
    this.buildings = new BuildingManager(this.scene);
    this.crops = new CropManager(this.scene);
    this.dragons = new DragonManager(this.scene);
    this.workers = new WorkerManager(this.scene);
    this.missions = new MissionManager();
    this.ui = new UI(uiRoot);
    this.ui.coins = this.coins;
    this.ui.updateCoins(this.coins);

    this.ui.onSelect = (id) => this._onSelect(id);
    this.ui.onNewGame = () => this.newGame();
    this.ui.onSelectDragon = (id) => {
      this.selectedDragonId = id;
    };
    this.ui.onCreativeSpawn = (opts) => {
      if (!this.creative) return;
      const item = makeDragonItem(opts);
      this.inventory.dragons.push(item);
      this.selectedDragonId = item.id;
      this.ui.updateInventory(this.inventory, this.selectedDragonId);
      this.ui.toast(`Spawned ${opts.rarity} ${opts.sex} ${DRAGONS.stages[opts.stage].name}`);
    };
    this.ui.onPurchase = (listing) => this._purchase(listing);
    this.ui.onGetMissionOptions = () => this._missionOptions();
    this.ui.onStartMission = (sel) => this._startMission(sel);

    this.ui.onToggleCreative = () => {
      this.creative = !this.creative;
      if (this.creative) {
        this.inventory.seeds = 999;
        this.inventory.dragonfruit = 999;
        this.inventory.farmhouses = 999;
        this.inventory.farmPlots = 999;
        this.inventory.dragonPens = 999;
        this.inventory.breedingPens = 999;
        this.inventory.workerBunkhouses = 999;
        this.inventory.fieldTrainings = 999;
        this.coins = 99999;
        this.ui.updateCoins(this.coins);
        // Seed a few rarities for testing if empty of non-common
        const hasLegend = this.inventory.dragons.some((d) => d.rarity === 'Legendary');
        if (!hasLegend) {
          for (const tier of ['Uncommon', 'Rare', 'Epic', 'Legendary']) {
            this.inventory.dragons.push(makeDragonItem({ sex: 'male', stage: 2, rarity: tier }));
            this.inventory.dragons.push(makeDragonItem({ sex: 'female', stage: 2, rarity: tier }));
          }
        }
        this.ui.toast('Creative ON — unlimited builds + spawn any dragon');
      } else {
        this.ui.toast('Creative mode OFF');
      }
      this.ui.setCreativeVisible(this.creative);
      this.ui.updateInventory(this.inventory, this.selectedDragonId);
    };

    window.addEventListener('resize', () => this._onResize());
    // Save when the tab is closed / reloaded / hidden so nothing since the last autosave is lost
    const flush = () => { if (!this._resting) saveGame(this); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

    const params = new URLSearchParams(location.search);
    if (params.get('demo') === '1') this._loadDemo();
    else {
      const saved = loadGame();
      if (saved) this._applySave(saved);
      else this._placeStarterHint();
    }

    this.ui.updateInventory(this.inventory, this.selectedDragonId);
    this.ui.updateEnergy(this.energy);
    this.ui.setCreativeVisible(this.creative);
    this.ui.updateCoins(this.coins);
    this._refreshHud();
    this.ui.select(null);
  }

  _placeStarterHint() {
    this.player.mesh.position.set(2, 0, 8);
  }

  _loadDemo() {
    clearSave();
    this.inventory = defaultInventory();
    this.energy = PLAYER.energyMax;
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
          c.stage = stages[lx + lz * 4];
          c.stageStart = now;
          this.scene.remove(c.mesh);
          c.mesh = createCropMesh(c.stage);
          c.mesh.position.set(c.worldX, 0.1, c.worldZ);
          this.scene.add(c.mesh);
        }
      }
    }

    const pen = this.buildings.place('dragonPen', 12, -2, 0);
    if (pen) {
      const specs = [
        { sex: 'male', stage: 1, rarity: 'Common' },
        { sex: 'female', stage: 2, rarity: 'Uncommon' },
        { sex: 'male', stage: 0, rarity: 'Common' },
        { sex: 'female', stage: 0, rarity: 'Common' },
      ];
      for (const spec of specs) {
        this.dragons.place(spec, pen, now);
      }
    }

    // Breeding pen with two adults + egg for screenshots (?demo=1)
    const bp = this.buildings.place('breedingPen', 22, -2, 0);
    if (bp) {
      this.dragons.place({ sex: 'male', stage: 2, rarity: 'Epic' }, bp, now);
      this.dragons.place({ sex: 'female', stage: 2, rarity: 'Epic' }, bp, now);
      const st = this.dragons.getBreedState(bp.id);
      const mesh = createEggMesh('Exceptional');
      mesh.position.set(bp.tx + bp.w / 2, 0.15, bp.tz + bp.d / 2);
      this.scene.add(mesh);
      st.egg = {
        rarity: 'Exceptional',
        sex: 'female',
        upgraded: true,
        hatchAt: now + BREEDING.hatchDurationMs,
        mesh,
        parentA: 'Epic',
        parentB: 'Epic',
      };
    }

    // Legendary adult in inventory for panel screenshots
    this.inventory.dragons.push(makeDragonItem({ sex: 'male', stage: 2, rarity: 'Legendary', level: 50 }));
    this.inventory.dragons.push(makeDragonItem({ sex: 'female', stage: 2, rarity: 'Exceptional' }));
    this.inventory.dragons.push(makeDragonItem({ sex: 'male', stage: 0, rarity: 'Rare' }));
    this.selectedDragonId = this.inventory.dragons[0]?.id;

    this.inventory.farmhouses = Math.max(0, this.inventory.farmhouses - 1);
    this.inventory.farmPlots = Math.max(0, this.inventory.farmPlots - 1);
    this.inventory.dragonPens = Math.max(0, this.inventory.dragonPens - 1);
    this.inventory.breedingPens = Math.max(0, this.inventory.breedingPens - 1);
    const bunk = this.buildings.place('workerBunkhouse', -14, -2, 0);
    if (bunk) {
      this.inventory.workerBunkhouses = Math.max(0, (this.inventory.workerBunkhouses ?? 99) - 1);
      this.workers.hire('dragonHandler', bunk, now, this.buildings.doorPoint(bunk, 1.2));
    }
    const train = this.buildings.place('dragonFieldTraining', -8, 10, 0);
    if (train) {
      this.inventory.fieldTrainings = Math.max(0, (this.inventory.fieldTrainings ?? 99) - 1);
    }
    this.coins = ECONOMY.startingCoins;
    this.ui.updateCoins(this.coins);
    this._refreshHud();
    this.ui.toast('Demo scene loaded');
  }


  _applySave(data) {
    const now = performance.now();
    this.inventory = data.inventory || defaultInventory();
    this.gameTime = data.gameTime ?? this.gameTime;
    this.creative = !!data.creative;
    this.energy = data.player?.energy ?? PLAYER.energyMax;
    this.coins = data.coins ?? ECONOMY.startingCoins;
    this.selectedDragonId = data.selectedDragonId ?? this.inventory.dragons[0]?.id ?? null;
    if (data.player) this.player.mesh.position.set(data.player.x, 0, data.player.z);
    this.buildings.deserialize(data.buildings || []);
    this.crops.deserialize(data.crops || [], this.buildings, now);
    this.dragons.deserialize(data.dragons || [], now, this.buildings);
    this.workers.deserialize(data.workers || []);
    this.missions.deserialize(data.missions || []);
    // Dragon IDs share one counter: keep it above pen + mission dragons too, not just inventory,
    // otherwise new dragons reuse a pen dragon's ID and placing one deletes its twin.
    for (const d of this.dragons.dragons) reserveInvId(d.id);
    for (const m of this.missions.active) reserveInvId(m.dragon?.id);
    // Old saves spawned handlers inside the bunkhouse walls — move them out to the door.
    for (const w of this.workers.workers) {
      const inside = this.buildings.getObstacles().find(
        (o) => w.x > o.minX && w.x < o.maxX && w.z > o.minZ && w.z < o.maxZ
      );
      if (inside) {
        const bunk = this.buildings.buildings.find((b) => b.id === w.bunkhouseId);
        if (bunk) {
          const door = this.buildings.doorPoint(bunk, 1.2);
          w.x = door.x; w.z = door.z;
          w.mesh.position.set(w.x, 0, w.z);
        }
      }
    }
    this._syncWorkerMissionBusy();
    this.ui.setCreativeVisible(this.creative);
    this.ui.updateCoins(this.coins);
    this._refreshHud();
    this.ui.toast('Game loaded');
  }

  newGame() {
    clearSave();
    location.href = location.pathname;
  }

  _onSelect(id) {
    if (BUILD_TYPES.has(id)) this.buildings.setGhost(id);
    else this.buildings.clearGhost();
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
      breedingPen: 'breedingPens',
      workerBunkhouse: 'workerBunkhouses',
      dragonFieldTraining: 'fieldTrainings',
      seeds: 'seeds',
      dragonfruit: 'dragonfruit',
    };
    return map[selected];
  }

  _hasItem(selected) {
    if (selected === 'dragons') {
      return !!this._getSelectedDragonItem();
    }
    const k = this._invKeyFor(selected);
    return k && this.inventory[k] > 0;
  }

  _getSelectedDragonItem() {
    if (this.selectedDragonId == null) return this.inventory.dragons[0] || null;
    return this.inventory.dragons.find((d) => d.id === this.selectedDragonId) || null;
  }

  _consume(selected, n = 1) {
    const k = this._invKeyFor(selected);
    if (!k) return;
    if (!this.creative) this.inventory[k] = Math.max(0, this.inventory[k] - n);
    this.ui.updateInventory(this.inventory, this.selectedDragonId);
  }

  _consumeDragonItem(item) {
    this.inventory.dragons = this.inventory.dragons.filter((d) => d.id !== item.id);
    if (this.selectedDragonId === item.id) {
      this.selectedDragonId = this.inventory.dragons[0]?.id ?? null;
    }
    this.ui.updateInventory(this.inventory, this.selectedDragonId);
  }

  _add(invKey, n = 1) {
    this.inventory[invKey] = (this.inventory[invKey] || 0) + n;
    this.ui.updateInventory(this.inventory, this.selectedDragonId);
  }

  _addDragonItem(item) {
    this.inventory.dragons.push(item);
    this.selectedDragonId = item.id;
    this.ui.updateInventory(this.inventory, this.selectedDragonId);
  }

  _spendEnergy(amount) {
    this.energy = Math.max(0, this.energy - amount);
    this.ui.updateEnergy(this.energy);
  }

  async _doRest() {
    if (this._resting) return;
    this._resting = true;
    const frac = ((this.gameTime % DAY.lengthMs) + DAY.lengthMs) % DAY.lengthMs / DAY.lengthMs;
    let skipMs;
    if (frac >= DAY.sunset || frac < DAY.sunrise) {
      // Skip to next morning
      let target = Math.floor(this.gameTime / DAY.lengthMs) * DAY.lengthMs + REST.morningFrac * DAY.lengthMs;
      if (target <= this.gameTime) target += DAY.lengthMs;
      skipMs = target - this.gameTime;
    } else {
      skipMs = (REST.skipHoursIfDay / 24) * DAY.lengthMs;
    }

    await this.ui.fadeRest(REST.fadeMs, () => {
      this.gameTime += skipMs;
      const now = performance.now();
      this.crops.advanceTime(skipMs);
      this.crops.update(now);
      this.dragons.advanceTime(skipMs, now);
      for (const d of this.dragons.dragons) {
        this._grantXpToDragon(d, DRAGON_STATS.xp.restAdult, true);
      }
      this.energy = PLAYER.energyMax;
      this.ui.updateEnergy(this.energy);
    });
    this.ui.toast('You feel rested');
    this._resting = false;
  }

  start() {
    this.renderer.setAnimationLoop(() => this._frame());
  }

  _frame() {
    if (this._resting) {
      this.renderer.render(this.scene, this.camera);
      this.input.endFrame();
      return;
    }

    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const now = performance.now();
    this.gameTime += dt * 1000;

    // Esc closes the top panel first (and only that); otherwise it cancels the selection below.
    if (this.input.cancel && this.ui.closeTopPanel()) {
      this.input.justPressed.delete('escape');
    }
    // Marketplace / Missions are modal-ish: hotbar keys shouldn't change the build tool behind them.
    const modalOpen = this.ui.marketplaceOpen || this.ui.missionsOpen;

    // Hotbar + inventory panel keys
    for (const item of this.ui.hotbarItems) {
      if (!modalOpen && this.input.pressed(item.key)) {
        if (item.id === 'dragons') {
          this.ui.setDragonPanel(!this.ui.dragonPanelOpen);
          this.ui.select('dragons');
          this.ui.updateDragonList(this.inventory.dragons, this.selectedDragonId);
        } else {
          this.ui.select(this.ui.selected === item.id ? null : item.id);
        }
      }
    }
    if (this.input.pressed('i') || this.input.pressed('tab')) {
      this.ui.setDragonPanel(!this.ui.dragonPanelOpen);
      this.ui.updateDragonList(this.inventory.dragons, this.selectedDragonId);
    }
    if (this.input.pressed('m')) {
      this.ui.setMarketplace(!this.ui.marketplaceOpen);
    }
    if (this.input.pressed('n')) {
      this.ui.setMissions(!this.ui.missionsOpen);
    }

    this.missions.tick(Date.now(), (mission, def) => this._onMissionComplete(mission, def));
    // Refresh the Missions panel a few times per second without rebuilding the dropdowns
    // (rebuilding every frame closed open <select>s and swallowed clicks on "Start mission").
    if (this.ui.missionsOpen) {
      this._missionRefreshAcc = (this._missionRefreshAcc || 0) + dt;
      if (this._missionRefreshAcc > 0.25) {
        this._missionRefreshAcc = 0;
        this.ui.refreshMissions();
      }
    }

    // Energy drain while moving
    const speedMult =
      this.energy < PLAYER.lowEnergyThreshold ? PLAYER.lowEnergySpeedMult : 1;

    this.followCam.update(dt, this.player.position, this.input);
    this.player.update(
      dt,
      this.input,
      this.followCam.yawAngle,
      this.world,
      this.buildings.getColliders(),
      speedMult
    );
    if (this.player.moving) {
      this._spendEnergy(PLAYER.energyDrainPerSecMoving * dt);
    }
    this.world.updateGrass(this.player.position, this.timer.getElapsed());

    this._updateLighting();
    this.ui.updateDay(this.gameTime, DAY.lengthMs);

    this.crops.update(now);
    this.dragons.update(now, dt, this.buildings);
    this.workers.update(dt, this.buildings);
    for (const w of this.workers.workers) {
      if (w.mesh) w.mesh.visible = !w.busyMission;
    }
    this.dragons.tickAdultIdleXp(dt, (d, amt) => this._grantXpToDragon(d, amt, false), DRAGON_STATS.xp.idlePerSec);
    this.dragons.tickBreeding(
      now,
      this.buildings,
      BREEDING,
      rollBreedingResult,
      (egg) => {
        this.ui.toast(`An egg was laid! (${egg.rarity})`);
      },
      (egg) => {
        const item = makeDragonItem({ sex: egg.sex, stage: 0, rarity: egg.rarity, level: 1 });
        this._addDragonItem(item);
        const flair = egg.upgraded;
        const msg = egg.upgraded
          ? `✨ HATCHED ${egg.rarity.toUpperCase()} ${egg.sex} baby! Upgrade!`
          : `Hatched ${egg.rarity} ${egg.sex} baby dragon`;
        this.ui.toast(msg, flair ? 3500 : 2200, flair);
      }
    );

    const hit = this.world.groundHit(this.camera, this.input.mouseNdc.x, this.input.mouseNdc.y);
    let prompt = '';
    let tooltip = '';
    let breedHud = '';

    // Is the cursor on something the default (no tool) interaction would act on?
    // Then F / click should do that instead of opening Missions / resting.
    let aimActionable = false;
    if (hit && !this.ui.selected) {
      const { tx: atx, tz: atz } = this.world.tileFromWorld(hit.x, hit.z);
      const info = this.crops.findAtWorld(atx, atz, this.buildings);
      if (info?.crop?.stage >= 4 && this.player.withinReach(atx + 0.5, atz + 0.5)) aimActionable = true;
      const dAim = this.dragons.findNear(hit.x, hit.z, 2.2);
      if (dAim && dAim.stage >= 2 && this.player.withinReach(dAim.x, dAim.z)) aimActionable = true;
      const bpAim = this.buildings.findBreedingPenAt(atx, atz);
      if (bpAim && this.dragons.getBreedState(bpAim.id)?.egg) aimActionable = true;
    }
    const fPressed = this.input.pressed('f');
    const clicked = this.input.leftClick;

    // Near a Dragon Handler → missions (F nearby, or click on the handler)
    const nearWorker = this.workers.findNear(
      this.player.position.x,
      this.player.position.z,
      3.2
    );
    if (nearWorker && !nearWorker.busyMission && !this.ui.selected && !aimActionable) {
      prompt = 'Press F to assign missions';
      const clickedWorker = clicked && hit && Math.hypot(hit.x - nearWorker.x, hit.z - nearWorker.z) < 1.3;
      if (fPressed || clickedWorker) {
        this.ui.setMissions(true, { workerId: nearWorker.id });
        this._finishFrame(prompt, tooltip, breedHud);
        return;
      }
    }

    // Rest at farmhouse door
    const nearHouse = this.buildings.findFarmhouseNear(
      this.player.position.x,
      this.player.position.z,
      4.5
    );
    if (nearHouse && !this.ui.selected && !nearWorker && !aimActionable) {
      prompt = 'Press F to rest';
      const clickedHouse = clicked && hit &&
        hit.x > nearHouse.tx - 0.5 && hit.x < nearHouse.tx + nearHouse.w + 0.5 &&
        hit.z > nearHouse.tz - 0.5 && hit.z < nearHouse.tz + nearHouse.d + 0.5;
      if (fPressed || clickedHouse) {
        this._doRest();
        this._finishFrame(prompt, tooltip, breedHud);
        return;
      }
    }

    if (hit) {
      const { tx, tz } = this.world.tileFromWorld(hit.x, hit.z);
      this.world.showGridAt(tx, tz);
      const selected = this.ui.selected;

      // Breeding progress when looking at breeding pen
      const bpLook = this.buildings.findBreedingPenAt(tx, tz);
      if (bpLook) {
        const prog = this.dragons.getBreedProgress(bpLook.id, now, BREEDING);
        if (prog) {
          const pct = Math.floor((prog.progress || 0) * 100);
          if (prog.phase === 'breeding') {
            breedHud = `Breeding… ${pct}%<div class="pbar"><i style="width:${pct}%"></i></div>`;
          } else if (prog.phase === 'hatching') {
            breedHud = `Egg hatching (${prog.egg.rarity})… ${pct}%<div class="pbar"><i style="width:${pct}%"></i></div>`;
          } else if (prog.phase === 'cooldown') {
            breedHud = `Breeding cooldown… ${pct}%<div class="pbar"><i style="width:${pct}%"></i></div>`;
          } else if (prog.phase === 'ready') {
            breedHud = 'Pair ready to breed';
          } else {
            breedHud = 'Need 1 adult ♂ and 1 adult ♀';
          }
        }
      }

      if (selected && BUILD_TYPES.has(selected)) {
        if (this.input.rotateBuild) this.buildings.rotateGhost();
        if (this.input.cancel) this.ui.select(null);
        else {
          const { w, d } = footprintFor(selected, this.buildings.ghostRot);
          const gtx = tx - Math.floor(w / 2);
          const gtz = tz - Math.floor(d / 2);
          const inReach = this.player.withinReach(gtx + w / 2, gtz + d / 2);
          const pp = this.player.position;
          const pr = this.player.radius;
          const onPlayer =
            SOLID_BUILDINGS.has(selected) &&
            pp.x + pr > gtx && pp.x - pr < gtx + w && pp.z + pr > gtz && pp.z - pr < gtz + d;
          const valid =
            this._hasItem(selected) &&
            this.buildings.canPlace(selected, gtx, gtz, this.buildings.ghostRot) &&
            inReach &&
            !onPlayer;
          this.buildings.updateGhost(gtx, gtz, valid);
          prompt = valid
            ? `Click / F to place ${BUILDINGS[selected].label}`
            : !inReach
              ? 'Too far away'
              : !this._hasItem(selected)
                ? 'None left'
                : onPlayer
                  ? 'You are standing there — step aside'
                  : 'Cannot place here';
          if (valid && this.input.interactKey) {
            const placed = this.buildings.place(selected, gtx, gtz, this.buildings.ghostRot);
            if (placed) {
              this._consume(selected);
              this._spendEnergy(PLAYER.energyDrainAction);
              if (selected === 'workerBunkhouse') this._refreshHud();
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
                this._spendEnergy(PLAYER.energyDrainAction);
                this.ui.toast('Planted dragonfruit seed');
              }
            }
          } else if (!reach) prompt = 'Move closer to plant';
        } else if (info?.crop) {
          prompt = info.crop.stage >= 4 ? 'Ready to harvest!' : 'Already planted';
        } else prompt = 'Plant seeds on a farm plot';
      } else if (selected === 'dragons') {
        const item = this._getSelectedDragonItem();
        const pen = this.buildings.findAnyPenAt(tx, tz);
        if (!item) prompt = 'No dragon selected (press I)';
        else if (!pen) {
          prompt =
            item.stage >= 2
              ? 'Place adults in a pen or breeding pen'
              : 'Place babies/juveniles in a dragon pen';
        } else {
          const reach = this.player.withinReach(tx + 0.5, tz + 0.5);
          const isBreed = pen.type === 'breedingPen';
          if (isBreed && item.stage < 2) {
            prompt = 'Breeding pens only accept adults';
          } else if (!isBreed && item.stage >= 2) {
            // Adults can go in regular pens too
          }
          const max = isBreed ? BUILDINGS.breedingPen.maxDragons : BUILDINGS.dragonPen.maxDragons;
          const count = this.dragons.countInPen(pen.id);
          if (isBreed && item.stage < 2) {
            /* already prompted */
          } else if (!reach) prompt = 'Move closer';
          else if (count >= max) prompt = 'Pen is full';
          else {
            const label = `${item.rarity} ${DRAGONS.stages[item.stage].name} ${item.sex}`;
            prompt = `Press F / click to place ${label}`;
            if (this.input.interactKey) {
              const d = this.dragons.place(item, pen, now);
              if (d) {
                this._consumeDragonItem(item);
                this._spendEnergy(PLAYER.energyDrainAction);
                this.ui.toast(`Placed ${label}`);
              } else this.ui.toast('Cannot place here');
            }
          }
        }
      } else if (selected === 'dragonfruit') {
        const dragon = this.dragons.findNear(hit.x, hit.z, 2.5);
        if (dragon && this._hasItem('dragonfruit')) {
          const reach = this.player.withinReach(dragon.x, dragon.z);
          if (reach) {
            const stage = DRAGONS.stages[dragon.stage]?.name;
            prompt =
              stage === 'adult'
                ? 'Press F / click to feed adult (+XP)'
                : 'Press F / click to feed';
            if (this.input.interactKey) {
              if (dragon.stage >= 2) {
                // Adults: feeding grants XP (no growth boost needed)
                this._consume('dragonfruit');
                this._spendEnergy(PLAYER.energyDrainAction);
                this._grantXpToDragon(dragon, DRAGON_STATS.xp.feedAdult, true);
                this.ui.toast(`Fed adult — +${DRAGON_STATS.xp.feedAdult} XP`);
              } else if (this.dragons.feed(dragon, now)) {
                this._consume('dragonfruit');
                this._spendEnergy(PLAYER.energyDrainAction);
                this.ui.toast('Fed dragon — growth sped up!');
              }
            }
          }
        } else prompt = 'Feed dragonfruit to a growing dragon';
      } else {
        // Default: harvest, pick up adults, hatch eggs, rest already handled
        const info = this.crops.findAtWorld(tx, tz, this.buildings);
        if (info?.crop?.stage >= 4) {
          const reach = this.player.withinReach(tx + 0.5, tz + 0.5);
          if (reach) {
            prompt = 'Press F / click to harvest';
            if (this.input.interactKey) {
              const y = this.crops.harvest(info.plot.id, info.lx, info.lz);
              if (y) {
                this._add('dragonfruit', y.fruit);
                this._add('seeds', y.seeds);
                this._spendEnergy(PLAYER.energyDrainAction);
                this.ui.toast(`Harvested +${y.fruit} fruit, +${y.seeds} seed`);
              }
            }
          } else prompt = 'Move closer to harvest';
        }

        // Hatch egg
        const bp = this.buildings.findBreedingPenAt(tx, tz);
        if (bp) {
          const st = this.dragons.getBreedState(bp.id);
          if (st?.egg) {
            const reach = this.player.withinReach(bp.tx + bp.w / 2, bp.tz + bp.d / 2);
            if (reach) {
              const ready = now >= st.egg.hatchAt;
              prompt = ready
                ? 'Press F to hatch egg'
                : `Egg hatching… (${st.egg.rarity}) — F to wait or auto`;
              if (this.input.interactKey && ready) {
                const egg = this.dragons.hatchEgg(bp.id, now, true);
                if (egg) {
                  st.cooldownUntil = now + BREEDING.cooldownMs;
                  const item = makeDragonItem({ sex: egg.sex, stage: 0, rarity: egg.rarity, level: 1 });
                  this._addDragonItem(item);
                  const flair = egg.upgraded;
                  this.ui.toast(
                    flair
                      ? `✨ HATCHED ${egg.rarity.toUpperCase()} ${egg.sex} baby! Upgrade!`
                      : `Hatched ${egg.rarity} ${egg.sex} baby`,
                    flair ? 3500 : 2200,
                    flair
                  );
                  this._spendEnergy(PLAYER.energyDrainAction);
                }
              }
            }
          }
        }

        // Pick up adult dragon (into inventory)
        const dragon = this.dragons.findNear(hit.x, hit.z, 2.2);
        if (dragon) {
          tooltip = this.ui.dragonTooltip(dragon);
          if (!prompt) {
            const reach = this.player.withinReach(dragon.x, dragon.z);
            if (reach && dragon.stage >= 2) {
              prompt = 'Press F to pick up adult dragon';
              if (this.input.interactKey) {
                const item = this.dragons.pickUp(dragon);
                this._addDragonItem(item);
                this._spendEnergy(PLAYER.energyDrainAction);
                this.ui.toast(`Picked up ${item.rarity} adult ${item.sex}`);
              }
            } else if (reach && dragon.stage < 2) {
              prompt = 'Grow to adult before moving to a breeding pen';
            }
          }
        }
      }
    } else {
      this.world.hideGrid();
    }

    if (this.input.cancel && this.ui.selected) this.ui.select(null);

    this.ui.setPrompt(prompt);
    this.ui.setTooltip(tooltip, this.input.clientX || 0, this.input.clientY || 0);
    this.ui.setBreedHud(breedHud);

    this.sun.position.set(
      this.player.position.x + 40,
      60,
      this.player.position.z + 20
    );
    this.sun.target.position.copy(this.player.position);
    this.sun.target.updateMatrixWorld();

    // Real seconds (dt is clamped to 50ms, so game-time autosave stretched out at low FPS)
    this._autosaveAcc += this.timer.getDelta();
    if (this._autosaveAcc > 8) {
      this._autosaveAcc = 0;
      saveGame(this);
    }

    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  /** Early-exit path of _frame: still update HUD and render so the frame isn't dropped. */
  _finishFrame(prompt, tooltip, breedHud) {
    this.ui.setPrompt(prompt);
    this.ui.setTooltip(tooltip, this.input.clientX || 0, this.input.clientY || 0);
    this.ui.setBreedHud(breedHud);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  _updateLighting() {
    const t = ((this.gameTime % DAY.lengthMs) + DAY.lengthMs) % DAY.lengthMs;
    const frac = t / DAY.lengthMs;
    let sunIntensity = 1.1;
    let hemiIntensity = 0.55;
    let ambIntensity = 0.25;
    const bg = new THREE.Color(0x87b8e0);
    if (frac < 0.2 || frac > 0.85) {
      const night = frac < 0.2 ? (0.2 - frac) / 0.2 : (frac - 0.85) / 0.15;
      sunIntensity = 0.35 + (1 - night) * 0.3;
      hemiIntensity = 0.3;
      ambIntensity = 0.2;
      bg.set(0x1a2040).lerp(new THREE.Color(0x87b8e0), 1 - night * 0.7);
    } else if (frac < 0.3) {
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
  }

  _refreshHud() {
    const used = this.workers.count();
    const cap = this.buildings.bunkCapacity();
    this.inventory._workersLabel = `Workers: <b>${used}/${cap || 0}</b>`;
    this.inventory._coins = this.coins;
    const now = Date.now();
    for (const d of this.inventory.dragons) {
      const left = this.missions.dragonRestRemaining(d, now);
      d._restLabel = left > 0 ? `Resting ${this.missions.formatRemaining(left)}` : '';
      d._away = false;
    }
    this.ui.updateCoins(this.coins);
    this.ui.updateInventory(this.inventory, this.selectedDragonId);
  }

  _purchase(listing) {
    const bunk = this.workers.findFreeBunk(
      this.buildings,
      BUILDINGS.workerBunkhouse.capacity || 4
    );
    const result = tryPurchase(listing, {
      coins: this.coins,
      inventory: this.inventory,
      creative: this.creative,
      bunkCapacity: this.buildings.bunkCapacity(),
      workerCount: this.workers.count(),
      onHireWorker: (typeId) => {
        const free = this.workers.findFreeBunk(
          this.buildings,
          BUILDINGS.workerBunkhouse.capacity || 4
        );
        if (!free) {
          return { ok: false, message: 'Need a free bunk in a Worker Bunkhouse' };
        }
        const w = this.workers.hire(typeId, free, performance.now(), this.buildings.doorPoint(free, 1.2));
        if (!w) return { ok: false, message: 'Could not hire worker' };
        return { ok: true, worker: w };
      },
    });
    if (result.ok) {
      if (result.coins != null) this.coins = result.coins;
      this._refreshHud();
      saveGame(this);
    }
    return result;
  }

  _grantXpToDragon(dragon, amount, toastOnLevel = false) {
    if (!dragon || amount <= 0) return;
    const before = dragon.level ?? 1;
    const result = grantDragonXp(dragon, amount);
    if (toastOnLevel && result.leveled > 0) {
      this.ui.toast(
        `${dragon.rarity || 'Dragon'} leveled up! Lv${before} → Lv${result.level}`,
        2800,
        true
      );
      // Keep inventory copy in sync if this is a world dragon with matching id
      if (dragon.id != null) {
        const inv = this.inventory.dragons.find((d) => d.id === dragon.id);
        if (inv) {
          inv.level = dragon.level;
          inv.xp = dragon.xp;
        }
      }
      if (this.ui.dragonPanelOpen) {
        this.ui.updateDragonList(this.inventory.dragons, this.selectedDragonId);
      }
    }
    return result;
  }


  _syncWorkerMissionBusy() {
    const busy = new Set(this.missions.active.map((m) => m.workerId));
    for (const w of this.workers.workers) {
      w.busyMission = busy.has(w.id);
      if (w.mesh) w.mesh.visible = !w.busyMission;
    }
  }

  _missionOptions() {
    const now = Date.now();
    const workers = this.workers.workers
      .filter((w) => !w.busyMission)
      .map((w) => ({
        id: w.id,
        label: `${w.name || 'Handler'} #${w.id}`,
      }));

    const dragons = [];
    const seen = new Set();
    for (const d of this.inventory.dragons) {
      if ((d.stage ?? 0) < 2) continue;
      if (this.missions.isDragonOnMission(d.id)) continue;
      if (this.missions.isDragonResting(d, now)) continue;
      seen.add(d.id);
      const stage = DRAGONS.stages[d.stage]?.name || 'adult';
      dragons.push({
        id: d.id,
        label: `${d.rarity} ${stage} ${d.sex === 'male' ? '♂' : '♀'} (inv) · Lv${d.level ?? 1}`,
        source: 'inventory',
      });
    }
    for (const d of this.dragons.dragons) {
      if ((d.stage ?? 0) < 2) continue;
      if (seen.has(d.id)) continue;
      if (this.missions.isDragonOnMission(d.id)) continue;
      if (this.missions.isDragonResting(d, now)) continue;
      const stage = DRAGONS.stages[d.stage]?.name || 'adult';
      dragons.push({
        id: d.id,
        label: `${d.rarity} ${stage} ${d.sex === 'male' ? '♂' : '♀'} (pen) · Lv${d.level ?? 1}`,
        source: 'world',
      });
    }

    const buildings = this.buildings.buildings
      .filter((b) => b.type === 'dragonFieldTraining')
      .map((b) => ({
        id: b.id,
        label: `Field Training #${b.id} (${b.w}×${b.d})`,
        type: b.type,
      }));

    const missionsByBuilding = {};
    for (const b of buildings) {
      missionsByBuilding[b.id] = missionsForBuildingType(b.type).map((m) => ({
        id: m.id,
        label: m.name,
        description: m.description,
        meta: `+${m.rewards.xp} XP · +${m.rewards.coins} coins · ${Math.round(m.durationMs / 60000)} min · rest ${Math.round(m.restMs / 60000)} min`,
      }));
    }

    const active = this.missions.active.map((m) => {
      const prog = this.missions.progress(m, now);
      const def = getMissionDef(m.missionKey);
      const d = m.dragon;
      return {
        title: def?.name || m.missionKey,
        subtitle: `${d.rarity} ${d.sex} Lv${d.level} · Away on mission`,
        eta: this.missions.formatRemaining(prog.remainingMs),
        ratio: prog.ratio,
      };
    });

    const resting = [];
    for (const d of this.inventory.dragons) {
      const left = this.missions.dragonRestRemaining(d, now);
      if (left > 0) {
        resting.push({
          label: `${d.rarity} ${d.sex} Lv${d.level ?? 1}`,
          eta: this.missions.formatRemaining(left),
        });
      }
    }
    for (const d of this.dragons.dragons) {
      const left = this.missions.dragonRestRemaining(d, now);
      if (left > 0) {
        resting.push({
          label: `${d.rarity} ${d.sex} Lv${d.level ?? 1} (pen)`,
          eta: this.missions.formatRemaining(left),
        });
      }
    }

    return { workers, dragons, buildings, missionsByBuilding, active, resting };
  }

  _startMission(sel) {
    const workerId = Number(sel.workerId);
    const dragonId = Number(sel.dragonId);
    const buildingId = Number(sel.buildingId);
    const missionKey = sel.missionKey;
    const worker = this.workers.getById(workerId);
    if (!worker) return { ok: false, message: 'Select a Dragon Handler' };
    if (worker.busyMission) return { ok: false, message: 'Handler already on a mission' };

    const building = this.buildings.buildings.find((b) => b.id === buildingId);
    if (!building || building.type !== 'dragonFieldTraining') {
      return { ok: false, message: 'Select a Dragon Field Training structure' };
    }

    let dragon = this.inventory.dragons.find((d) => d.id === dragonId);
    if (!dragon) {
      const world = this.dragons.dragons.find((d) => d.id === dragonId);
      if (!world) return { ok: false, message: 'Dragon not found' };
      dragon = this.dragons.pickUp(world);
    } else {
      this.inventory.dragons = this.inventory.dragons.filter((d) => d.id !== dragon.id);
      if (this.selectedDragonId === dragon.id) {
        this.selectedDragonId = this.inventory.dragons[0]?.id ?? null;
      }
    }

    const result = this.missions.start({
      workerId: worker.id,
      buildingId: building.id,
      buildingType: building.type,
      dragon,
      missionKey,
    });
    if (!result.ok) {
      this.inventory.dragons.push(dragon);
      this._refreshHud();
      return result;
    }

    worker.busyMission = true;
    if (worker.mesh) worker.mesh.visible = false;
    this._refreshHud();
    saveGame(this);
    return { ok: true, message: `Sent ${dragon.rarity} dragon on ${result.def.name}` };
  }

  _onMissionComplete(mission, def) {
    const rewards = def?.rewards || { xp: 0, coins: 0 };
    const dragon = { ...mission.dragon };
    const xpResult = grantDragonXp(dragon, rewards.xp || 0);
    dragon.missionRestUntil = Date.now() + (def?.restMs || 0);
    this.inventory.dragons.push(
      makeDragonItem({
        sex: dragon.sex,
        stage: dragon.stage,
        rarity: dragon.rarity,
        level: dragon.level,
        xp: dragon.xp,
        id: dragon.id,
        missionRestUntil: dragon.missionRestUntil,
      })
    );
    this.coins += rewards.coins || 0;
    const worker = this.workers.getById(mission.workerId);
    if (worker) {
      worker.busyMission = false;
      worker.roamTimer = 0; // pick a fresh wander target right away
      if (worker.mesh) worker.mesh.visible = true;
    }
    const lvlNote = xpResult.leveled > 0 ? ` · leveled to ${dragon.level}!` : '';
    this.ui.toast(
      `Mission complete! +${rewards.xp} XP · +${rewards.coins} coins${lvlNote}`,
      4000,
      true
    );
    this._refreshHud();
    saveGame(this);
    if (this.ui.missionsOpen) this.ui.renderMissions();
  }

}
