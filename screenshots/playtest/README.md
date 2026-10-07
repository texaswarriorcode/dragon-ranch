# Playtest results (Oct 7 2026)

- `results-live*.json` — live GitHub Pages build before fixes (a191ee0). Live mouse input is dead
  (fade overlay); the live gameplay phases ran with a test-only CSS workaround (`PT_CSS_WORKAROUND=1`).
- `results-final.json` / `final-movement-collision.log` — local production build: movement + collision
  + FPS (all pass). Its later workers/dragons/core/ui failures were caused by the New-Game/pagehide
  save bug, fixed in d2fde66.
- `results-final-b.json` — local production build after all fixes: workers, missions, save/reload,
  dragons, core loops, UI (54/54 pass).
- `results-local.json` — intermediate local run (dev server).
