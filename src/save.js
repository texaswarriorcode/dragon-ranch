import { SAVE_KEY, STARTING } from './config.js';

export function defaultInventory() {
  return {
    seeds: STARTING.seeds,
    dragonfruit: STARTING.dragonfruit,
    maleDragons: STARTING.maleDragons,
    femaleDragons: STARTING.femaleDragons,
    farmhouses: STARTING.farmhouses,
    farmPlots: STARTING.farmPlots,
    dragonPens: STARTING.dragonPens,
  };
}

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      inventory: state.inventory,
      player: { x: state.player.position.x, z: state.player.position.z },
      buildings: state.buildings.serialize(),
      crops: state.crops.serialize(),
      dragons: state.dragons.serialize(),
      gameTime: state.gameTime,
      creative: state.creative,
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
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Load failed', e);
    return null;
  }
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
