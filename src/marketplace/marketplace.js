import { MARKETPLACE_CATALOG, getActiveListings } from './catalog.js';

/**
 * Stub purchase handler. Returns false until real assets / economy exist.
 * Later: check coins, unlock flags, grant inventory, deduct currency.
 *
 * @param {object} listing
 * @param {{ coins?: number, inventory?: object }} _ctx  reserved for future use
 * @returns {{ ok: boolean, message: string }}
 */
export function tryPurchase(listing, _ctx = {}) {
  if (!listing || listing.comingSoon) {
    return { ok: false, message: 'Not for sale yet' };
  }
  // Real listings will be handled here once catalog assets are added.
  return { ok: false, message: 'Not for sale yet' };
}

export function getCatalog() {
  return MARKETPLACE_CATALOG;
}

export { getActiveListings };
