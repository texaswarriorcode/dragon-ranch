import { MARKETPLACE_CATALOG, getActiveListings } from './catalog.js';
import { BUILDINGS, ECONOMY, WORKERS } from '../config.js';

/**
 * Attempt to purchase a listing.
 *
 * @param {object} listing
 * @param {{
 *   coins: number,
 *   inventory: object,
 *   creative?: boolean,
 *   bunkCapacity?: number,
 *   workerCount?: number,
 *   onHireWorker?: (typeId: string) => { ok: boolean, message?: string },
 * }} ctx
 * @returns {{ ok: boolean, message: string, coins?: number, inventory?: object }}
 */
export function tryPurchase(listing, ctx = {}) {
  if (!listing || listing.comingSoon) {
    return { ok: false, message: 'Not for sale yet' };
  }
  if (!listing.grant) {
    return { ok: false, message: 'Not for sale yet' };
  }

  const creative = !!ctx.creative;
  let coins = ctx.coins ?? 0;
  const price = listing.price ?? 0;

  if (!creative && coins < price) {
    return { ok: false, message: `Need ${price} coins (have ${coins})` };
  }

  const inv = ctx.inventory;
  const grant = listing.grant;

  if (grant.kind === 'building') {
    if (!creative) coins -= price;
    const n = grant.count ?? 1;
    inv[grant.key] = (inv[grant.key] || 0) + n;
    return {
      ok: true,
      message: `Purchased ${listing.name} ×${n}`,
      coins: creative ? coins : coins,
      inventory: inv,
    };
  }

  if (grant.kind === 'worker') {
    const capacity = ctx.bunkCapacity ?? 0;
    const workerCount = ctx.workerCount ?? 0;
    if (capacity <= 0 || workerCount >= capacity) {
      return { ok: false, message: 'Need a free bunk in a Worker Bunkhouse' };
    }
    if (!WORKERS.types[grant.key]) {
      return { ok: false, message: 'Unknown worker type' };
    }
    const hired = ctx.onHireWorker?.(grant.key);
    if (!hired?.ok) {
      return { ok: false, message: hired?.message || 'Need a free bunk in a Worker Bunkhouse' };
    }
    if (!creative) coins -= price;
    return {
      ok: true,
      message: `Hired ${listing.name}!`,
      coins,
      inventory: inv,
    };
  }

  return { ok: false, message: 'Not for sale yet' };
}

export function getCatalog() {
  return MARKETPLACE_CATALOG;
}

export { getActiveListings };
