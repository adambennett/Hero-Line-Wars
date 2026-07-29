# Hero Line Wars

2D top-down prototype of a Warcraft 3–style line wars game (Vite + TypeScript).

## Play

```bash
npm install
npm run dev
```

Open the printed local URL. The **main menu** appears first (Singleplayer, Multiplayer, Compendium, Settings, Quit).

| Control | Action |
|---------|--------|
| WASD / arrows | Move |
| LMB (hold) | Basic attack (unique per hero) |
| RMB | Mobility ability |
| MMB | Ultimate |
| 1–6 | Send packs (upgrade base to unlock & strengthen) |
| U / Upgrade Base | Spend gold — unlocks packs and raises cost/power of existing ones |
| F | Open/close shop (stand on the SHOP pad near base) |
| 4–6 | Buy offered shop items while the shop is open |
| Esc / Pause | Pause (Continue, Settings, abandon with confirm) |
| Bag | Inspect owned relics/items + passive |

Remap Attack / Mobility / Ultimate under **Settings → Controls**. Master volume scales procedural Web Audio SFX.

Survive **10 waves**. High ground grants bonus damage. You **respawn** if downed — only a destroyed **base** ends the run.

## Systems in this slice

- **Maps** — Classic Lane, Split Ridge, Narrow Pass, Open Flank on a larger 1600×560 playfield.
- **Heroes** — Ranger, Warden, Scatter, Arbalest, Prism, **Frost**, **RNG Wizard** — each with a distinct passive (see Compendium).
- **Base upgrades** — unlock stronger send packs *and* scale cost/income/HP of already-unlocked packs.
- **XP / relics** — XP bar sits on the lane width; relic draft supports **Skip**; Inventory shows descriptions.
- **Artifacts / turrets** — shop Artifacts auto-place on a random free slot near base.
- **SFX** — procedural Web Audio (hits, casts, buys, level-up, boss slam rumble).

## Build

| Script | Output | Use |
|--------|--------|-----|
| `npm run build:pages` | `dist/` | GitHub Pages (static multi-file) |
| `npm run build:release` | `dist-release/` | Single HTML for GitHub Releases |
| `npm run desktop:dev` | — | Vite + Electron window |
| `npm run desktop:dist` | `dist-desktop/` | **itch / Steam** Windows packages |
| `npm run preview` | — | Preview the Pages build |

Desktop (itch upload + Steam roadmap): **[`DESKTOP.md`](./DESKTOP.md)**.

## Later

Real multiplayer / AI opponent sends, meta progression, Ascension-style modifiers.
