# Anvil Calc — Jim rebuild (live at https://anvil.jim.anims.club/)

Fork of [aviettran/minecraft-anvil-calc](https://github.com/aviettran/minecraft-anvil-calc).

What changed:
- Original React 18 + Bootstrap UI replaced with a lightweight responsive
  single-page frontend (`rebuilt/index.html` + `style.css` + `calc.js` + `app.js`).
- Same anvil combine logic, ported 1:1 to vanilla JS (`calc.js`).
- Mobile-friendly Minecraft-dark theme, preset picker, shareable URL state.
- Data files (`data/*.json`) reused unchanged from upstream.
- Served as a static site: `python3 server.py` (port 8123) behind Caddy.

Run locally: `cd rebuilt && python3 ../rebuilt/server.py` — no npm needed.
