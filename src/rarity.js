import { RARITY } from './config.js';

export function tierIndex(name) {
  const i = RARITY.tiers.indexOf(name);
  return i >= 0 ? i : 0;
}

export function tierName(index) {
  return RARITY.tiers[Math.max(0, Math.min(RARITY.tiers.length - 1, index))] || 'Common';
}

export function rarityColor(name) {
  return RARITY.colors[name] ?? RARITY.colors.Common;
}

export function rarityCss(name) {
  return RARITY.cssColors[name] ?? RARITY.cssColors.Common;
}

/**
 * Pure breeding roll — easy to unit-test.
 * @param {string} rarityA
 * @param {string} rarityB
 * @param {() => number} rng  returns [0,1)
 * @returns {{ rarity: string, upgraded: boolean, sex: 'male'|'female' }}
 */
export function rollBreedingResult(rarityA, rarityB, rng = Math.random) {
  const ia = tierIndex(rarityA);
  const ib = tierIndex(rarityB);
  const sex = rng() < 0.5 ? 'male' : 'female';

  // Differing tiers → lower parent's tier, no upgrade chance
  if (ia !== ib) {
    const low = Math.min(ia, ib);
    return { rarity: tierName(low), upgraded: false, sex };
  }

  const parentTier = tierName(ia);
  // Two Legendaries always Legendary
  if (parentTier === 'Legendary') {
    return { rarity: 'Legendary', upgraded: false, sex };
  }

  const chance = RARITY.upgradeChance[parentTier] ?? 0;
  if (rng() < chance) {
    return { rarity: tierName(ia + 1), upgraded: true, sex };
  }
  return { rarity: parentTier, upgraded: false, sex };
}

/** Normalize unknown/missing rarity to Common (save migration). */
export function normalizeRarity(r) {
  return RARITY.tiers.includes(r) ? r : 'Common';
}
