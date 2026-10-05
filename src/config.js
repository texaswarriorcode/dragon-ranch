/** Central game timing and balance config — easy to tune for demos. */

export const WORLD = {
  size: 1000, // tiles (1 tile = 1 world unit)
  half: 500,
};

export const PLAYER = {
  speed: 12,
  reach: 8,
  height: 1.7,
  radius: 0.4,
};

export const CAMERA = {
  minDistance: 6,
  maxDistance: 40,
  defaultDistance: 16,
  minPitch: 0.25,
  maxPitch: 1.35,
  defaultPitch: 0.7,
  rotateSpeed: 0.005,
  keyRotateSpeed: 1.8,
  zoomSpeed: 0.08,
};

export const BUILDINGS = {
  farmhouse: { w: 6, d: 6, label: 'Farmhouse', color: 0xc4a574 },
  farmPlot: { w: 4, d: 4, label: 'Farm Plot', color: 0x6b4423 },
  dragonPen: { w: 8, d: 8, label: 'Dragon Pen', color: 0x8b7355, maxDragons: 4 },
};

/** Crop growth in milliseconds (demo-tuned ~2–3 min to mature). */
export const CROPS = {
  stages: [
    { name: 'empty', duration: 0 },
    { name: 'sprout', duration: 30_000 },
    { name: 'plant', duration: 45_000 },
    { name: 'cactus', duration: 50_000 },
    { name: 'fruiting', duration: 40_000 },
  ],
  // total ~165s ≈ 2.75 min
  harvestSeeds: 1,
  harvestFruit: 1,
};

/** Dragon growth in milliseconds (~5 min to adult unfed). */
export const DRAGONS = {
  stages: [
    { name: 'baby', duration: 90_000, scale: 0.45 },
    { name: 'juvenile', duration: 120_000, scale: 0.75 },
    { name: 'adult', duration: 0, scale: 1.15 },
  ],
  // baby+juvenile = 210s ≈ 3.5 min; with feed boost ≈ faster to ~5 total feel
  feedGrowthBoost: 0.5, // each feed removes 50% remaining stage time
  wanderSpeed: 1.2,
  maxPerPen: 4,
};

export const DAY = {
  lengthMs: 8 * 60_000, // 8 real minutes = 1 game day
  sunrise: 0.22,
  sunset: 0.78,
};

export const STARTING = {
  seeds: 20,
  dragonfruit: 5,
  maleDragons: 2,
  femaleDragons: 2,
  farmhouses: 99,
  farmPlots: 99,
  dragonPens: 99,
};

export const SAVE_KEY = 'dragon-ranch-save-v1';
