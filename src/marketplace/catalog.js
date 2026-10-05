/**
 * Marketplace catalog — extension point for future buyable assets.
 *
 * Each category is an array of listing objects:
 *   {
 *     id: string,
 *     name: string,
 *     description: string,
 *     price: number,          // coins (currency wired later)
 *     rarity?: string,        // optional; dragons etc.
 *     unlocked?: boolean,     // optional gate
 *     comingSoon?: boolean,   // grayed placeholder card
 *   }
 *
 * Add real listings here later; the UI reads MARKETPLACE_CATALOG directly.
 * Purchase flow goes through tryPurchase() in ./marketplace.js.
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

/** Coming-soon silhouette stubs so empty tabs still show layout. */
function stubs(prefix) {
  return [
    {
      id: `${prefix}-soon-1`,
      name: 'Coming soon',
      description: 'Asset placeholder — not for sale yet.',
      price: 0,
      comingSoon: true,
    },
    {
      id: `${prefix}-soon-2`,
      name: 'Coming soon',
      description: 'Asset placeholder — not for sale yet.',
      price: 0,
      comingSoon: true,
    },
    {
      id: `${prefix}-soon-3`,
      name: 'Coming soon',
      description: 'Asset placeholder — not for sale yet.',
      price: 0,
      comingSoon: true,
    },
  ];
}

/**
 * Live catalog. Start empty of real items; stubs are display-only.
 * To add a real listing later, push an object WITHOUT comingSoon:true
 * into the appropriate array (and implement tryPurchase).
 */
export const MARKETPLACE_CATALOG = {
  farmPlots: [...stubs('farmPlots')],
  dragons: [...stubs('dragons')],
  dragonBuildings: [...stubs('dragonBuildings')],
  farmWorkers: [...stubs('farmWorkers')],
  farmBuildings: [...stubs('farmBuildings')],
};

/** Real (non-stub) listings only — useful when filtering later. */
export function getActiveListings(category) {
  const list = MARKETPLACE_CATALOG[category] || [];
  return list.filter((l) => !l.comingSoon);
}
