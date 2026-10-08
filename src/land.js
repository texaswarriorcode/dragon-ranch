import { LAND } from './config.js';

const S = LAND.regionSize;
const HALF = S / 2;
const byId = new Map(LAND.regions.map((r) => [r.id, r]));
const byCell = new Map(LAND.regions.map((r) => [`${r.rx},${r.rz}`, r]));

/** Which 3×3 cell a coordinate falls in (−1, 0, 1) or null outside the full map. */
function cellOf(v) {
  const c = Math.floor((v + HALF) / S);
  return c >= -1 && c <= 1 ? c : null;
}

/**
 * Owned land = union of 1000×1000 regions (home + bought expansions).
 * All bounds checks go through here so L-shapes / any union work.
 */
export class LandManager {
  constructor() {
    this.owned = new Set(['C']);
    this.onChange = null;
  }

  get expansionsOwned() {
    return this.owned.size - 1;
  }

  get totalExpansions() {
    return LAND.regions.length - 1;
  }

  /** Price of the next expansion (by purchase count), or null when all are owned. */
  nextPrice() {
    const n = this.expansionsOwned;
    return n < LAND.expansionPrices.length ? LAND.expansionPrices[n] : null;
  }

  region(id) {
    return byId.get(id) || null;
  }

  regionBounds(id) {
    const r = byId.get(id);
    return { minX: r.rx * S - HALF, maxX: r.rx * S + HALF, minZ: r.rz * S - HALF, maxZ: r.rz * S + HALF };
  }

  isOwned(id) {
    return this.owned.has(id);
  }

  ownedCell(rx, rz) {
    const r = byCell.get(`${rx},${rz}`);
    return !!r && this.owned.has(r.id);
  }

  /** Point (x, z) lies on owned land. */
  isPointOwned(x, z) {
    const rx = cellOf(x);
    const rz = cellOf(z);
    return rx != null && rz != null && this.ownedCell(rx, rz);
  }

  /** A square of half-size `m` around (x, z) is fully on owned land. Since m ≪ region size,
   *  checking the 4 corners covers every region the square touches (handles L-shapes). */
  canOccupy(x, z, m = 0) {
    // Max edges are inclusive (a square touching x = 500 from below is still inside cell 0)
    const e = 1e-6;
    return (
      this.isPointOwned(x - m, z - m) &&
      this.isPointOwned(x + m - e, z - m) &&
      this.isPointOwned(x - m, z + m - e) &&
      this.isPointOwned(x + m - e, z + m - e)
    );
  }

  /** Axis-aligned rect [minX,maxX)×[minZ,maxZ) fully on owned land (building footprints). */
  isRectOwned(minX, minZ, maxX, maxZ) {
    const e = 1e-6;
    return this.canOccupyRect(minX, minZ, maxX - e, maxZ - e);
  }

  canOccupyRect(minX, minZ, maxX, maxZ) {
    return (
      this.isPointOwned(minX, minZ) &&
      this.isPointOwned(maxX, minZ) &&
      this.isPointOwned(minX, maxZ) &&
      this.isPointOwned(maxX, maxZ)
    );
  }

  /** Status of an expansion for the market: owned | available | locked (+ reason). */
  status(id) {
    if (this.owned.has(id)) return { status: 'owned' };
    const r = byId.get(id);
    if (!r) return { status: 'locked', reason: 'Unknown region' };
    if (LAND.requireAdjacent) {
      const nb = [[r.rx + 1, r.rz], [r.rx - 1, r.rz], [r.rx, r.rz + 1], [r.rx, r.rz - 1]];
      if (!nb.some(([x, z]) => this.ownedCell(x, z))) {
        const sides = nb
          .map(([x, z]) => byCell.get(`${x},${z}`))
          .filter((n) => n && n.id !== 'C')
          .map((n) => n.name);
        return { status: 'locked', reason: `Buy ${sides.join(' or ')} first` };
      }
    }
    return { status: 'available' };
  }

  /** Unlock without charging (purchase logic decides the price). */
  unlock(id) {
    const st = this.status(id);
    if (st.status !== 'available') return { ok: false, message: st.status === 'owned' ? 'Already owned' : st.reason };
    this.owned.add(id);
    this.onChange?.([id]);
    return { ok: true };
  }

  /** Creative: own everything. */
  unlockAll() {
    const added = LAND.regions.map((r) => r.id).filter((id) => !this.owned.has(id));
    for (const id of added) this.owned.add(id);
    if (added.length) this.onChange?.(added);
    return added;
  }

  serialize() {
    return [...this.owned];
  }

  /** Old saves have no `land` → home only. Unknown ids are ignored. */
  deserialize(list) {
    this.owned = new Set(['C']);
    if (Array.isArray(list)) for (const id of list) if (byId.has(id)) this.owned.add(id);
    this.onChange?.(null);
  }
}

export { cellOf };
