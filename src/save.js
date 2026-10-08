import { SAVE_KEY, SAVE_KEY_LEGACY, STARTING, PLAYER, ECONOMY } from './config.js';

let _id = 1;
export function nextInvId() {
  return _id++;
}

/** Make sure future IDs are above `id` (used after loading pen / mission dragons). */
export function reserveInvId(id) {
  if (Number.isFinite(id) && id >= _id) _id = id + 1;
}

export function makeDragonItem({ sex, stage = 0, rarity = 'Common', level = 1, xp = 0, id = null, missionRestUntil = 0 }) {
  return {
    id: id ?? nextInvId(),
    sex,
    stage,
    rarity,
    level: Math.max(1, Math.floor(level) || 1),
    xp: Math.max(0, xp || 0),
    missionRestUntil: missionRestUntil || 0,
  };
}

export function defaultInventory() {
  const dragons = [];
  for (let i = 0; i < STARTING.maleBabies; i++) {
    dragons.push(makeDragonItem({ sex: 'male', stage: 0, rarity: 'Common' }));
  }
  for (let i = 0; i < STARTING.femaleBabies; i++) {
    dragons.push(makeDragonItem({ sex: 'female', stage: 0, rarity: 'Common' }));
  }
  return {
    seeds: STARTING.seeds,
    dragonfruit: STARTING.dragonfruit,
    farmhouses: STARTING.farmhouses,
    farmPlots: STARTING.farmPlots,
    dragonPens: STARTING.dragonPens,
    breedingPens: STARTING.breedingPens,
    workerBunkhouses: STARTING.workerBunkhouses ?? 99,
    fieldTrainings: STARTING.fieldTrainings ?? 99,
    dragons,
  };
}

export function migrateInventory(raw) {
  if (!raw) return defaultInventory();
  const base = defaultInventory();
  const inv = {
    seeds: raw.seeds ?? base.seeds,
    dragonfruit: raw.dragonfruit ?? base.dragonfruit,
    farmhouses: raw.farmhouses ?? base.farmhouses,
    farmPlots: raw.farmPlots ?? base.farmPlots,
    dragonPens: raw.dragonPens ?? base.dragonPens,
    breedingPens: raw.breedingPens ?? base.breedingPens,
    workerBunkhouses: raw.workerBunkhouses ?? base.workerBunkhouses,
    fieldTrainings: raw.fieldTrainings ?? base.fieldTrainings,
    dragons: [],
  };

  if (Array.isArray(raw.dragons)) {
    inv.dragons = raw.dragons.map((d) =>
      makeDragonItem({
        sex: d.sex,
        stage: d.stage ?? 0,
        rarity: d.rarity || 'Common',
        level: d.level ?? 1,
        xp: d.xp ?? 0,
        id: d.id,
        missionRestUntil: d.missionRestUntil ?? 0,
      })
    );
  } else {
    // Legacy v1 counts → Common babies
    const males = raw.maleDragons ?? 0;
    const females = raw.femaleDragons ?? 0;
    for (let i = 0; i < males; i++) inv.dragons.push(makeDragonItem({ sex: 'male' }));
    for (let i = 0; i < females; i++) inv.dragons.push(makeDragonItem({ sex: 'female' }));
  }

  // Keep id counter ahead
  for (const d of inv.dragons) {
    if (d.id >= _id) _id = d.id + 1;
  }
  return inv;
}

export function saveGame(state) {
  try {
    const data = {
      version: 2,
      savedAt: Date.now(),
      inventory: state.inventory,
      player: {
        x: state.player.position.x,
        z: state.player.position.z,
        energy: state.energy,
      },
      buildings: state.buildings.serialize(),
      crops: state.crops.serialize(),
      dragons: state.dragons.serialize(),
      gameTime: state.gameTime,
      creative: state.creative,
      selectedDragonId: state.selectedDragonId,
      coins: state.coins,
      workers: state.workers?.serialize?.() ?? state.workers ?? [],
      missions: state.missions?.serialize?.() ?? [],
      land: state.land?.serialize?.() ?? ['C'],
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('Save failed', e);
    return false;
  }
}

export function loadGame() {
  try {
    let raw = localStorage.getItem(SAVE_KEY);
    if (!raw) raw = localStorage.getItem(SAVE_KEY_LEGACY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    data.inventory = migrateInventory(data.inventory);
    if (data.player && data.player.energy == null) data.player.energy = PLAYER.energyMax;
    if (data.coins == null) data.coins = ECONOMY.startingCoins;
    return data;
  } catch (e) {
    console.warn('Load failed', e);
    return null;
  }
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(SAVE_KEY_LEGACY);
}
