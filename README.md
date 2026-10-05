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
| **1–7** | Hotbar |
| **LMB** / **F** | Interact / place |
| **R** | Rotate building ghost |
| **Esc** | Cancel / close panel |
| **I** / **Tab** | Dragon inventory |

### Hotbar

1. Farmhouse · 2. Farm plot · 3. Dragon pen · 4. Breeding pen  
5. Seeds · 6. Dragons (opens inventory) · 7. Dragonfruit

## Features

- **Farming:** plant / grow / harvest dragonfruit on 4×4 plots
- **Dragon pens:** raise babies → adults; feed fruit to speed growth
- **Breeding pens:** place one adult ♂ + ♀; after ~60s an egg appears; hatch for a baby with rarity rolls
- **Rarity (8 tiers):** Common → … → Legendary. Upgrade only when both parents share a tier (see `src/config.js`)
- **Rest:** near a farmhouse door, **F** to rest — fade, skip time, advance growth, restore energy
- **Energy:** light stamina bar; low energy slows movement (never blocks play)
- **Save/load:** `localStorage` autosave (v2; legacy v1 migrates to Common dragons)

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
