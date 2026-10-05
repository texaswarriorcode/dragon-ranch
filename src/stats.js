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

/** XP required to advance FROM `level` TO level+1 (level is current). */
export function xpToNextLevel(level = 1) {
  const { baseToLevel2, levelReqMult, maxLevel } = DRAGON_STATS.xp;
  const L = Math.max(1, Math.floor(level) || 1);
  if (L >= maxLevel) return 0;
  // L1→2 = base; L2→3 = base*1.1; ... requirement for going from L to L+1
  // = base * mult^(L-1)
  let req = baseToLevel2;
  for (let i = 1; i < L; i++) {
    req = Math.round(req * levelReqMult);
  }
  return req;
}

/**
 * Apply XP to an adult dragon. Mutates { xp, level }.
 * Babies/juveniles (stage < 2) gain nothing.
 * @returns {{ leveled: number, xp: number, level: number }}
 */
export function grantDragonXp(dragon, amount) {
  const stage = dragon.stage ?? 0;
  if (stage < 2 || amount <= 0) {
    return { leveled: 0, xp: dragon.xp || 0, level: dragon.level || 1 };
  }
  const maxLevel = DRAGON_STATS.xp.maxLevel;
  let level = Math.max(1, Math.floor(dragon.level) || 1);
  let xp = Math.max(0, dragon.xp || 0) + amount;
  let leveled = 0;
  while (level < maxLevel) {
    const need = xpToNextLevel(level);
    if (xp < need) break;
    xp -= need;
    level += 1;
    leveled += 1;
  }
  if (level >= maxLevel) {
    level = maxLevel;
    // keep overflow xp or zero — keep overflow for display
  }
  dragon.level = level;
  dragon.xp = Math.round(xp * 10) / 10;
  return { leveled, xp: dragon.xp, level: dragon.level };
}

export function xpProgress(dragon) {
  const level = Math.max(1, Math.floor(dragon.level) || 1);
  const xp = Math.max(0, dragon.xp || 0);
  const need = xpToNextLevel(level);
  const adult = (dragon.stage ?? 0) >= 2;
  return {
    level,
    xp: adult ? xp : 0,
    need,
    ratio: !adult || need <= 0 ? (level >= DRAGON_STATS.xp.maxLevel ? 1 : 0) : Math.min(1, xp / need),
    adult,
    maxed: level >= DRAGON_STATS.xp.maxLevel,
  };
}

export function formatXpLine(dragon) {
  const p = xpProgress(dragon);
  if (!p.adult) return 'XP — (adults only)';
  if (p.maxed) return `XP MAX · Lv${p.level}`;
  return `XP ${Math.floor(p.xp)}/${p.need}`;
}
