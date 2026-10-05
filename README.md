# Dragon Ranch

A low-poly 3D farming & dragon-ranching browser game built with **Three.js** + **Vite**. All models are procedural primitives — no external runtime asset downloads.

## How to run

```bash
npm install
npm run dev          # http://localhost:5173
# or
npm run build && npm run preview
```

Demo scene (pre-placed farmhouse, crops, dragons):

```
http://localhost:5173/?demo=1
```

## Controls

| Input | Action |
|-------|--------|
| **WASD** / Arrow keys | Move |
| **Q** / **E** (hold) | Rotate camera |
| **Right-mouse drag** (or Shift+LMB) | Orbit camera |
| **Scroll** | Zoom |
| **1–7** | Select hotbar item |
| **LMB** / **F** / **E** (tap) | Interact / place |
| **R** | Rotate building ghost |
| **Esc** | Cancel build / deselect |

### Hotbar

1. Farmhouse (6×6)  
2. Farm plot (4×4)  
3. Dragon pen (8×8)  
4. Dragonfruit seeds  
5. Male dragon baby  
6. Female dragon baby  
7. Dragonfruit (feed dragons)

## Features

- 1000×1000 tile grass world with procedural texture + nearby instanced grass tufts
- Tile grid overlay near cursor for placement
- Low-poly player with walk animation, third-person camera, building collision
- Build ghost with green/red validity, rotation, reach check, no overlap
- Crops grow sprout → plant → cactus → fruiting (~2–3 min); harvest for fruit + seeds
- Dragons (♂/♀ visually distinct) wander in pens, grow baby → juvenile → adult (~5 min; faster when fed)
- Day/night lighting, HUD, inventory, contextual prompts
- Autosave to `localStorage`; **New game** button to reset
- **Creative** button for unlimited items (testing)

Timings live in `src/config.js`.

## Project layout

```
src/
  main.js       entry
  game.js       orchestration
  config.js     timings & balance
  world.js      ground, grass, grid, bounds
  player.js     avatar + movement
  camera.js     third-person follow
  input.js      keyboard / mouse
  buildings.js  farmhouse, plot, pen
  crops.js      planting & growth
  dragons.js    dragons & growth
  ui.js         HUD / hotbar
  save.js       localStorage
  style.css
```
