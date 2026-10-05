/**
 * Verify rarity L1 table and level breakpoints.
 * Run: node scripts/test-dragon-stats.mjs
 */
import { RARITY, DRAGON_STATS } from '../src/config.js';
import {
  rarityBaseStats, levelBonusStats, computeDragonStats, round1, levelUpIncrement,
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

const c = table.Common;
check('Common L1 base', c.hp === 100 && c.defense === 5 && c.attack === 10, JSON.stringify(c));

// Uncommon = Common * 1.1
check(
  'Uncommon = Common*1.1',
  table.Uncommon.hp === round1(100 * 1.1) &&
    table.Uncommon.defense === round1(5 * 1.1) &&
    table.Uncommon.attack === round1(10 * 1.1),
  JSON.stringify(table.Uncommon)
);

// Epic doubles Super Rare
check(
  'Epic = Super Rare * 2',
  table.Epic.hp === round1(table['Super Rare'].hp * 2) &&
    table.Epic.defense === round1(table['Super Rare'].defense * 2) &&
    table.Epic.attack === round1(table['Super Rare'].attack * 2),
  `SR=${JSON.stringify(table['Super Rare'])} Epic=${JSON.stringify(table.Epic)}`
);

// Exceptional = Epic * 1.1
check(
  'Exceptional = Epic * 1.1',
  table.Exceptional.hp === round1(table.Epic.hp * 1.1),
  JSON.stringify(table.Exceptional)
);

// Legendary doubles Exceptional
check(
  'Legendary = Exceptional * 2',
  table.Legendary.hp === round1(table.Exceptional.hp * 2) &&
    table.Legendary.defense === round1(table.Exceptional.defense * 2) &&
    table.Legendary.attack === round1(table.Exceptional.attack * 2),
  JSON.stringify(table.Legendary)
);

console.log('\n=== Level bonuses (on Common base) ===');
const b = DRAGON_STATS.base;
check('L1 bonus zero', levelBonusStats(1).hp === 0);

const inc2 = levelUpIncrement(2);
check('L2 increment +5% HP', inc2.hp === round1(b.hp * 0.05), String(inc2.hp));

const inc10 = levelUpIncrement(10);
check('L10 increment +10% HP', inc10.hp === round1(b.hp * 0.1), String(inc10.hp));

const inc50 = levelUpIncrement(50);
check('L50 increment +50% HP', inc50.hp === round1(b.hp * 0.5), String(inc50.hp));

// Manual cumulative L10
let manual = { hp: 0, defense: 0, attack: 0 };
for (let lv = 2; lv <= 10; lv++) {
  const inc = levelUpIncrement(lv);
  manual.hp = round1(manual.hp + inc.hp);
  manual.defense = round1(manual.defense + inc.defense);
  manual.attack = round1(manual.attack + inc.attack);
}
const l10 = levelBonusStats(10);
check('L10 cumulative matches', l10.hp === manual.hp, `got ${l10.hp} expect ${manual.hp}`);

const commonL10 = computeDragonStats('Common', 10);
check(
  'Common L10 = base + bonus',
  commonL10.hp === round1(100 + l10.hp),
  JSON.stringify(commonL10)
);

const legL50 = computeDragonStats('Legendary', 50);
console.log('\nSample Legendary L50:', legL50);
check('Legendary L50 > L1', legL50.hp > table.Legendary.hp);

console.log(failed ? `\n${failed} FAILED` : '\nALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
