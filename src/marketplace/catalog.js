/**
 * Marketplace catalog — extension point for buyable assets.
 *
 * Listing shape:
 *   { id, name, description, price, rarity?, unlocked?, comingSoon?,
 *     grant?: { kind: 'building'|'worker', key: string, count?: number } }
 */

/** @typedef {'farmPlots'|'dragons'|'dragonBuildings'|'farmWorkers'|'farmBuildings'} MarketCategory */

/** @type {{ id: MarketCategory, label: string }[]} */
export const MARKETPLACE_TABS = [
  { id: 'farmPlots', label: 'Farm Plots' },
  { id: 'dragons', label: 'Dragons' },
  { id: 'dragonBuildings', label: 'Dragon Buildings' },
  { id: 'farmWorkers', label: 'Farm Workers' },
  { id: 'farmBuildings', label: 'Farm Buildings' },
];

function stubs(prefix, n = 2) {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-soon-${i + 1}`,
    name: 'Coming soon',
    description: 'Asset placeholder — not for sale yet.',
    price: 0,
    comingSoon: true,
  }));
}

export const MARKETPLACE_CATALOG = {
  farmPlots: [...stubs('farmPlots')],
  dragons: [...stubs('dragons')],
  dragonBuildings: [...stubs('dragonBuildings')],
  farmWorkers: [
    {
      id: 'worker-dragon-handler',
      name: 'Dragon Handler',
      description:
        'Cares for your dragons — tends pens and helps them gain experience. Requires a free bunk in a Worker Bunkhouse.',
      price: 50,
      grant: { kind: 'worker', key: 'dragonHandler' },
    },
    ...stubs('farmWorkers', 2),
  ],
  farmBuildings: [
    {
      id: 'bld-worker-bunkhouse',
      name: 'Worker Bunkhouse',
      description: 'Long bunkhouse (4×10) with beds for 4 farm workers. Place with the build hotbar after purchase.',
      price: 75,
      grant: { kind: 'building', key: 'workerBunkhouses', count: 1 },
    },
    ...stubs('farmBuildings', 2),
  ],
};

export function getActiveListings(category) {
  const list = MARKETPLACE_CATALOG[category] || [];
  return list.filter((l) => !l.comingSoon);
}

export function findListingById(id) {
  for (const cat of Object.keys(MARKETPLACE_CATALOG)) {
    const hit = MARKETPLACE_CATALOG[cat].find((l) => l.id === id);
    if (hit) return { listing: hit, category: cat };
  }
  return null;
}
