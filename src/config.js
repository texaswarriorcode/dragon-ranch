/** Central game timing and balance config — easy to tune for demos. */

export const WORLD = {
  size: 1000,
  half: 500,
};

export const PLAYER = {
  speed: 12,
  reach: 8,
  height: 1.7,
  radius: 0.4,
  energyMax: 100,
  energyDrainPerSecMoving: 2.5,
  energyDrainAction: 4,
  energyRestRestore: 100,
  lowEnergyThreshold: 25,
  lowEnergySpeedMult: 0.55,
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
  breedingPen: { w: 8, d: 8, label: 'Breeding Pen', color: 0x9b59b6, maxDragons: 2 },
  /** Footprint 4 wide × 10 long; R rotates to 10×4. */
  workerBunkhouse: { w: 4, d: 10, label: 'Worker Bunkhouse', color: 0x8d6e63, capacity: 4 },
  /** Footprint 6×6; R rotates (square). Ruined training arch + ring. */
  dragonFieldTraining: { w: 6, d: 6, label: 'Dragon Field Training', color: 0x78909c },
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
  feedGrowthBoost: 0.5,
  wanderSpeed: 1.2,
  maxPerPen: 4,
};

/**
 * Combat/farming stats for dragons.
 * rarityBase = Common L1 scaled by rarity rules (see src/stats.js).
 * levelBonus = cumulative increments of BASE for levels 2..L.
 * final = rarityBase + levelBonus.
 */
export const DRAGON_STATS = {
  base: { hp: 100, defense: 5, attack: 10 },
  /** Normal step between rarities (compounding). */
  rarityStepMult: 1.1,
  /** Tiers that double the previous tier instead of +10%. */
  rarityDoubleTiers: ['Epic', 'Legendary'],
  levelUp: {
    normal: 0.05,   // +5% of base each level
    every10: 0.1,   // +10% of base on levels divisible by 10
    every50: 0.5,   // +50% of base on levels divisible by 50
  },
  xp: {
    /** XP required to go from level 1 → 2. */
    baseToLevel2: 100,
    /** Each further level needs prior requirement × this (compounding). */
    levelReqMult: 1.1,
    maxLevel: 100,
    /** Feeding dragonfruit to an adult in a growth pen. */
    feedAdult: 20,
    /** Granted to each adult when player rests. */
    restAdult: 8,
    /** Idle trickle per second while adult in a pen. */
    idlePerSec: 0.15,
  },
};

export const ECONOMY = {
  startingCoins: 200,
  creativeInfinite: true, // Creative mode treats coins as unlimited
};

export const WORKERS = {
  types: {
    dragonHandler: {
      id: 'dragonHandler',
      name: 'Dragon Handler',
      description: 'Cares for dragons — feeds and grants slight XP near pens.',
      price: 50,
    },
  },
};



/**
 * Rarity tiers (ascending). Upgrade only when BOTH parents share the same
 * tier N and the roll succeeds — baby becomes N+1. Otherwise baby is the
 * lower of the two parent tiers. Two Legendaries always stay Legendary.
 */
export const RARITY = {
  tiers: [
    'Common',
    'Uncommon',
    'Rare',
    'Very Rare',
    'Super Rare',
    'Epic',
    'Exceptional',
    'Legendary',
  ],
  /** Chance to upgrade when both parents are this tier (key = parent tier). */
  upgradeChance: {
    Common: 0.8,
    Uncommon: 0.65,
    Rare: 0.5,
    'Very Rare': 0.35,
    'Super Rare': 0.22,
    Epic: 0.12,
    Exceptional: 0.05,
    Legendary: 0, // always Legendary; no higher tier
  },
  colors: {
    Common: 0x9e9e9e,
    Uncommon: 0x4caf50,
    Rare: 0x2196f3,
    'Very Rare': 0x9c27b0,
    'Super Rare': 0xe91e63,
    Epic: 0xff9800,
    Exceptional: 0xf44336,
    Legendary: 0xffd700,
  },
  cssColors: {
    Common: '#9e9e9e',
    Uncommon: '#4caf50',
    Rare: '#2196f3',
    'Very Rare': '#9c27b0',
    'Super Rare': '#e91e63',
    Epic: '#ff9800',
    Exceptional: '#f44336',
    Legendary: '#ffd700',
  },
};

export const BREEDING = {
  breedDurationMs: 60_000,
  hatchDurationMs: 15_000,
  cooldownMs: 45_000,
  maxAdults: 2,
};

export const REST = {
  fadeMs: 700,
  skipHoursIfDay: 4, // in-game hours (~ DAY.lengthMs / 24 * 4)
  morningFrac: 0.28, // wake around morning
};

export const DAY = {
  lengthMs: 8 * 60_000,
  sunrise: 0.22,
  sunset: 0.78,
};

export const MISSIONS = {
  /** Buildings that host missions (type → mission keys). */
  buildings: {
    dragonFieldTraining: ['takeDragonForARun'],
  },
  defs: {
    takeDragonForARun: {
      id: 'takeDragonForARun',
      name: 'Take Dragon For A Run',
      description: 'Send a handler and adult dragon on a training jog around the field.',
      durationMs: 5 * 60_000,
      restMs: 10 * 60_000,
      rewards: { xp: 100, coins: 20 },
      buildingType: 'dragonFieldTraining',
    },
  },
};

export const STARTING = {
  seeds: 20,
  dragonfruit: 5,
  // Baby Common dragons (migrated from old male/female counts)
  maleBabies: 2,
  femaleBabies: 2,
  farmhouses: 99,
  farmPlots: 99,
  dragonPens: 99,
  breedingPens: 99,
  workerBunkhouses: 99,
  fieldTrainings: 99,
};

export const SAVE_KEY = 'dragon-ranch-save-v2';
export const SAVE_KEY_LEGACY = 'dragon-ranch-save-v1';
