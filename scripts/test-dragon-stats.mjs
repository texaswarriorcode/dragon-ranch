/**
 * Verify rarity L1 table, level breakpoints, and XP curve.
 * Run: node scripts/test-dragon-stats.mjs
 */
import { RARITY, DRAGON_STATS } from '../src/config.js';
import {
  rarityBaseStats, levelBonusStats, computeDragonStats, round1, levelUpIncrement,
  xpToNextLevel, grantDragonXp,
} from '../src/stats.js';

let failed = 0;
function check(name, cond, detail = '') {
  if (!cond) {
    console.error('FAIL', name, detail);
    failed++;
  } else {
    console.log('OK  ', name, detail);
  }
}

console.log('=== L1 rarity base table ===');
const table = {};
for (const tier of RARITY.tiers) {
  table[tier] = rarityBaseStats(tier);
  console.log(
    tier.padEnd(12),
    `HP ${table[tier].hp}  Def ${table[tier].defense}  Atk ${table[tier].attack}`
  );
}

check('Common L1 base', table.Common.hp === 100 && table.Common.defense === 5 && table.Common.attack === 10);
check('Epic doubles SR', table.Epic.hp === round1(table['Super Rare'].hp * 2));
check('Legendary doubles Exceptional', table.Legendary.hp === round1(table.Exceptional.hp * 2));

console.log('\n=== Level bonuses ===');
check('L1 bonus zero', levelBonusStats(1).hp === 0);
check('L10 +10% step', levelUpIncrement(10).hp === round1(DRAGON_STATS.base.hp * 0.1));
check('L50 +50% step', levelUpIncrement(50).hp === round1(DRAGON_STATS.base.hp * 0.5));

console.log('\n=== XP requirements ===');
check('XP 1→2 = 100', xpToNextLevel(1) === 100);
check('XP 2→3 = 110', xpToNextLevel(2) === 110);
check('XP 3→4 = 121', xpToNextLevel(3) === 121);

const baby = { stage: 0, level: 1, xp: 0 };
grantDragonXp(baby, 500);
check('Baby no XP', baby.xp === 0 && baby.level === 1);

const adult = { stage: 2, level: 1, xp: 0 };
const g = grantDragonXp(adult, 100);
check('Adult 100 XP levels to 2', g.level === 2 && g.leveled === 1, JSON.stringify(g));

console.log(failed ? `\n${failed} FAILED` : '\nALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
