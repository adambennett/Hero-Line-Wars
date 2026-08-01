# Hero Line Wars

2D top-down Warcraft 3–style line wars game (Vite + TypeScript). Hold your lane, grow income, send packs into the enemy wave, and destroy their base (or clear the win-wave count).

## Play

```bash
npm install
npm run dev
```

Open the printed local URL. The **main menu** covers Singleplayer, Multiplayer, **AI Lab**, Compendium, Game Info, Settings, and Quit.

| Control | Action |
|---------|--------|
| WASD / arrows | Move |
| LMB (hold) | Basic attack (unique per hero; mouse-aimed except Prism auto-beam) |
| RMB | Mobility ability |
| MMB | Ultimate |
| 1–6 | Send packs (upgrade base to unlock & strengthen) |
| U / Upgrade Base | Spend gold — unlocks packs and raises cost/power of existing ones |
| F | Open/close shop (stand on the SHOP pad near base) |
| 4–6 | Buy offered shop items while the shop is open |
| Esc / Pause | Pause (Continue, Settings, abandon with confirm) |
| Bag | Inspect owned relics/items + passive |
| View lane | Flip the camera to the opponent’s lane |

Remap Attack / Mobility / Ultimate under **Settings → Controls**. Master volume scales procedural Web Audio SFX.

Default win condition is **10 waves** (configurable; **Unlimited** = base death only). High ground grants bonus damage. You **respawn** if downed — only a destroyed **base** (or clearing the wave goal) ends the run.

## Modes

- **Singleplayer** — Classic abstract opponent, or a trained neural school (Rookie → Brutal) on a real dual lane. Run options: map, max turrets, starting gold, waves to win, friendly fire, **Ascension**.
- **Barracks** — Spend **War Crests** (earned at run end) on permanent upgrades and hero commissions (Coil / Thorn start locked).
- **Ascension** — A0–A12 cumulative modifiers (StS-style). Win at your highest unlocked level to open the next; Crests scale with Ascension.
- **Multiplayer** — PeerJS lobbies (private code or public find-match). Modes: **1v1 / 2v2 / 3v3** PvP and **2p / 3p PvE**. Host-authoritative sim; shared lane for allies.
- **AI Lab** — In-browser genetic training on unlimited-wave duels (base death wins). Recipes + checkpoints save as difficulty tiers for solo/PvE.

## Systems

- **Maps** — Classic Lane, Split Ridge, Narrow Pass, Open Flank, Twin Gates, Serpentine, Fortress Approach, Crossfire, Island Hop, Shifting Grounds.
- **Heroes** — Ranger, Warden, Scatter, Arbalest, Prism, Frost, RNG Wizard, Coil, Thorn — each with aim mode (free / engage / auto), passive, and abilities (see Compendium).
- **Sends & income** — Passive gold/sec; spend gold to queue enemies into the **opponent’s** next wave (and raise your income).
- **Base upgrades** — Unlock stronger send packs and scale cost/income/HP of already-unlocked packs.
- **XP / relics** — Level drafts and relic drafts (Skip supported); Inventory shows descriptions.
- **Shop / turrets** — Between and during waves; Artifacts auto-place on a free slot near base.
- **Opponent panel** — Live enemy HP, wave, income, and send status without leaving your lane.
- **SFX** — Procedural Web Audio (hits, casts, buys, level-up, boss slam rumble).

## Build

| Script | Output | Use |
|--------|--------|-----|
| `npm run build:pages` | `dist/` | GitHub Pages (static multi-file) |
| `npm run build:release` | `dist-release/` | Single HTML for GitHub Releases |
| `npm run desktop:dev` | — | Vite + Electron window |
| `npm run desktop:dist` | `dist-desktop/` | **itch / Steam** Windows packages |
| `npm run desktop:dist:win` | `dist-desktop/` | Windows-only desktop package |
| `npm run preview` | — | Preview the Pages build |

**GitHub Pages:** pushes to `master` run [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml), which builds `dist/` and deploys it. One-time: **Settings → Pages → Source: GitHub Actions**. URL is `https://<owner>.github.io/<repo>/`.

Desktop (itch upload + Steam roadmap): **[`DESKTOP.md`](./DESKTOP.md)**.

## Later

Deeper AI / balance polish, more Barracks nodes, and Ascension tuning based on playtests.
