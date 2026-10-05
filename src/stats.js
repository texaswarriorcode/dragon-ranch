import { DRAGON_STATS, RARITY } from './config.js';

export function round1(n) {
  return Math.round(n * 10) / 10;
}

function scaleStatBlock(stats, mult) {
  return {
    hp: round1(stats.hp * mult),
    defense: round1(stats.defense * mult),
    attack: round1(stats.attack * mult),
  };
}

/**
 * Rarity-scaled base stats (Common L1 → tier), rounded to 1 decimal per step.
 */
export function rarityBaseStats(rarity = 'Common') {
  let cur = {
    hp: round1(DRAGON_STATS.base.hp),
    defense: round1(DRAGON_STATS.base.defense),
    attack: round1(DRAGON_STATS.base.attack),
  };
  const tiers = RARITY.tiers;
  const target = tiers.includes(rarity) ? rarity : 'Common';
  if (target === 'Common') return cur;

  const doubles = new Set(DRAGON_STATS.rarityDoubleTiers);
  for (let i = 1; i < tiers.length; i++) {
    const tier = tiers[i];
    const mult = doubles.has(tier) ? 2 : DRAGON_STATS.rarityStepMult;
    cur = scaleStatBlock(cur, mult);
    if (tier === target) return cur;
  }
  return cur;
}

/** Increment applied when reaching `level` from level-1 (level >= 2). */
export function levelUpIncrement(level) {
  const b = DRAGON_STATS.base;
  const { normal, every10, every50 } = DRAGON_STATS.levelUp;
  let frac = normal;
  if (level % 50 === 0) frac = every50;
  else if (level % 10 === 0) frac = every10;
  return {
    hp: round1(b.hp * frac),
    defense: round1(b.defense * frac),
    attack: round1(b.attack * frac),
  };
}

/** Cumulative level bonus for levels 2..level (L1 = zero). */
export function levelBonusStats(level = 1) {
  const L = Math.max(1, Math.floor(level) || 1);
  const out = { hp: 0, defense: 0, attack: 0 };
  for (let lv = 2; lv <= L; lv++) {
    const inc = levelUpIncrement(lv);
    out.hp = round1(out.hp + inc.hp);
    out.defense = round1(out.defense + inc.defense);
    out.attack = round1(out.attack + inc.attack);
  }
  return out;
}

/**
 * Final stats: rarityScaledBase + levelBonus
 * (= commonBase + rarityBonus + levelBonus).
 */
export function computeDragonStats(rarity = 'Common', level = 1) {
  const rarityBase = rarityBaseStats(rarity);
  const levelBonus = levelBonusStats(level);
  return {
    hp: round1(rarityBase.hp + levelBonus.hp),
    defense: round1(rarityBase.defense + levelBonus.defense),
    attack: round1(rarityBase.attack + levelBonus.attack),
    level: Math.max(1, Math.floor(level) || 1),
    rarity: rarity,
    rarityBase,
    levelBonus,
  };
}

export function formatStatsLine(stats) {
  return `Lv${stats.level} · HP ${stats.hp} · Def ${stats.defense} · Atk ${stats.attack}`;
}
