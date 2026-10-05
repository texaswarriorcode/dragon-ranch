# Dragon Ranch

A low-poly 3D farming & dragon-ranching browser game built with **Three.js** + **Vite**. All models are procedural primitives — no external runtime asset downloads.

## How to run

```bash
npm install
npm run dev          # http://localhost:5173
# or
npm run build && npm run preview
```

Demo scene:

```
http://localhost:5173/?demo=1
```

Breeding odds unit check:

```bash
node scripts/test-breeding-odds.mjs
```

## Controls

| Input | Action |
|-------|--------|
| **WASD** / arrows | Move |
| **Q** / **E** (hold) | Rotate camera |
| **RMB drag** | Orbit |
| **Scroll** | Zoom |
| **1–9** | Hotbar |
| **LMB** / **F** | Interact / place |
| **R** | Rotate building ghost |
| **Esc** | Cancel / close panel |
| **I** / **Tab** | Dragon inventory |
| **M** | Marketplace |
| **N** | Missions panel |

### Hotbar

1. Farmhouse · 2. Farm plot · 3. Dragon pen · 4. Breeding pen  
5. Worker bunkhouse · 6. Field Training (6×6) · 7. Seeds · 8. Dragons · 9. Dragonfruit

## Features

- **Farming:** plant / grow / harvest dragonfruit on 4×4 plots
- **Dragon pens:** raise babies → adults; feed fruit to speed growth (adults gain XP instead)
- **XP / levels:** adults only; 100 XP → L2 then +10% compounding; shown on inventory + tooltips; persisted
- **Breeding pens:** place one adult ♂ + ♀; after ~60s an egg appears; hatch for a baby with rarity rolls
- **Rarity (8 tiers):** Common → … → Legendary. Upgrade only when both parents share a tier (see `src/config.js`)
- **Workers:** hire Dragon Handlers (50 coins) if a Worker Bunkhouse has a free bunk (4 per house)
- **Worker bunkhouse:** 4×10 buildable (hotbar **5** / Farm Buildings market); HUD shows Workers used/capacity
- **Rest:** near a farmhouse door, **F** to rest — fade, skip time, advance growth, restore energy, small adult XP
- **Energy:** light stamina bar; low energy slows movement (never blocks play)
- **Save/load:** `localStorage` autosave (v2; legacy v1 migrates to Common dragons)

## Marketplace

Open with **M** or the **Marketplace** button. Tabs: Farm Plots, Dragons, Dragon Buildings, Farm Workers, Farm Buildings, **Dragon Development**.

Starting coins: **200**. Buy **Dragon Handler** (50) under Farm Workers (needs free bunk) and **Worker Bunkhouse** (75, 4×10, holds 4 workers) under Farm Buildings.

Catalog data lives in `src/marketplace/catalog.js`. Real purchases via `tryPurchase()` in `src/marketplace/marketplace.js` (bunkhouses + Dragon Handlers). HUD shows Workers used/capacity and coins.

## Dragon stats

Common L1 base: **HP 100 / Def 5 / Atk 10**. Adults earn **XP** (100 to reach L2, then +10% compounding per level). Feed fruit, rest, or idle in pens to gain XP. Each rarity compounds **+10%** on the previous (1 decimal), except **Epic** (×2 Super Rare) and **Legendary** (×2 Exceptional). Levels add bonuses from the common base (+5% per level, +10% on ×10, +50% on ×50). Final = rarity base + level bonus. See `src/config.js` (`DRAGON_STATS`) and `src/stats.js`.

```bash
npm run test:stats
```

## Field missions

**Dragon Field Training** (6×6 ruined arch + dirt ring) is sold under Marketplace → Dragon Development (100 coins) and placed with hotbar **6**. Open **Missions** (**N**, help button, or **F** near a Dragon Handler):

1. Select a free Dragon Handler  
2. Select an adult dragon (inventory or pen; not on mission / not resting)  
3. Select a placed Field Training structure  
4. Choose a mission and **Start**

First mission **Take Dragon For A Run**: 5 min → **+100 XP** to the dragon and **+20 coins**; then the dragon rests **10 min** before another mission. Progress and rest timers persist in save (`MISSIONS` in `src/config.js`).

## Creative mode

Toggle **Creative** in the help panel for unlimited buildings and a spawn grid of any sex / age / rarity.

## Project layout

```
src/
  config.js     timings, rarity odds, rest/energy
  rarity.js     breeding roll (pure, tested)
  dragons.js    dragons, auras, eggs, breeding state
  buildings.js  farmhouse, plot, pens
  crops.js      crop growth
  game.js       orchestration
  ui.js         HUD, dragon panel, fade
  …
scripts/
  test-breeding-odds.mjs
```
