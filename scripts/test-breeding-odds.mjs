/**
 * Monte-Carlo check that rollBreedingResult matches RARITY.upgradeChance.
 * Run: node scripts/test-breeding-odds.mjs
 */
import { RARITY } from '../src/config.js';
import { rollBreedingResult, tierName, tierIndex } from '../src/rarity.js';

const N = 50_000;
const results = {};

console.log(`Running ${N} rolls per same-tier pair...\n`);

for (let i = 0; i < RARITY.tiers.length - 1; i++) {
  const tier = RARITY.tiers[i];
  const expected = RARITY.upgradeChance[tier];
  let upgrades = 0;
  let same = 0;
  for (let n = 0; n < N; n++) {
    const r = rollBreedingResult(tier, tier);
    if (r.upgraded) upgrades++;
    else same++;
  }
  const observed = upgrades / N;
  const err = Math.abs(observed - expected);
  const ok = err < 0.015; // 1.5% absolute tolerance
  results[tier] = { expected, observed, err, ok, upgrades, same };
  console.log(
    `${tier.padEnd(12)} expect ${(expected * 100).toFixed(1)}%  ` +
      `got ${(observed * 100).toFixed(2)}%  err=${(err * 100).toFixed(2)}%  ${ok ? 'OK' : 'FAIL'}`
  );
}

// Differing tiers → always lower
let diffOk = 0;
for (let n = 0; n < N; n++) {
  const r = rollBreedingResult('Epic', 'Common');
  if (r.rarity === 'Common' && !r.upgraded) diffOk++;
}
console.log(`\nMixed Epic+Common → Common: ${((diffOk / N) * 100).toFixed(2)}% (expect 100%)`);

// Legendary+Legendary
let leg = 0;
for (let n = 0; n < N; n++) {
  if (rollBreedingResult('Legendary', 'Legendary').rarity === 'Legendary') leg++;
}
console.log(`Legendary+Legendary → Legendary: ${((leg / N) * 100).toFixed(2)}% (expect 100%)`);

const allOk = Object.values(results).every((r) => r.ok) && diffOk === N && leg === N;
console.log(allOk ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
process.exit(allOk ? 0 : 1);
