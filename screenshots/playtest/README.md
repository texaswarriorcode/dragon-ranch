# Playtest results (Oct 7 2026)

- `results-live*.json` — live GitHub Pages build before fixes (a191ee0). Live mouse input is dead
  (fade overlay); the live gameplay phases ran with a test-only CSS workaround (`PT_CSS_WORKAROUND=1`).
- `results-final.json` / `final-movement-collision.log` — local production build: movement + collision
  + FPS (all pass). Its later workers/dragons/core/ui failures were caused by the New-Game/pagehide
  save bug, fixed in d2fde66.
- `results-final-b.json` — local production build after all fixes: workers, missions, save/reload,
  dragons, core loops, UI (54/54 pass).
- `results-local.json` — intermediate local run (dev server).

## Map expansions (Oct 2026)
- `results-land3.json`: movement + **land** phase (`node scripts/playtest/run.mjs <url> land3 movement,land`), 58/58 pass.
  The land phase checks the price ladder (Free, 1000, then 10000 to 60000), the 1st expansion bought with 0 coins, the 2nd refused at 999 and bought at 1000, walking into owned land but not unowned, the L-shape (C+N+E) corner, blocked placement on unowned land, save/reload, migration of old saves to home-only, and Creative "Unlock all".
- `results-final-land.json`: the earlier suites (collision, workers, dragons, core, ui) re-run on the expansion build.
