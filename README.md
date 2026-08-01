# Hero Line Wars

2D top-down Warcraft 3–style line wars game (Vite + TypeScript). Hold your lane, grow income, send packs into the enemy wave, and destroy their base (or clear the win-wave count).

## Play

```bash
npm install
npm run dev
```

Open the printed local URL. The **main menu** covers Singleplayer, Multiplayer, Barracks / Stats / Challenges, Workshop editors, **AI Lab**, Compendium, Game Info, Settings, and Quit. Menus use a shared dark steel / amber-teal layout system (grids + `.shine-btn` hover); Reduce motion in Settings turns hover shine and idle FX off.

| Control | Action |
|---------|--------|
| WASD / arrows | Move |
| LMB (hold) | Basic attack (unique per hero; mouse-aimed except Prism auto-beam) |
| RMB | Mobility ability (Gunner: fire equipped heavy weapon) |
| MMB | Ultimate (Gunner: cycle arsenal) |
| 1–6 | Send packs (upgrade base to unlock & strengthen) |
| U / Upgrade Base | Spend gold — unlocks packs and raises cost/power of existing ones |
| F | Open/close shop (stand on the SHOP pad near base) |
| 4–6 | Buy offered shop items while the shop is open |
| Esc / Pause | Pause (Continue, Settings, abandon with confirm). With two or more human players it opens the same menu **without** pausing — the match keeps running |
| Bag | Inspect owned relics/items + passive |
| View lane | Flip the camera to the opponent’s lane |

Remap Attack / Mobility / Ultimate under **Settings → Controls**. Master volume scales procedural Web Audio SFX. **Reject peer custom content** (Settings) refuses multiplayer matches that require workshop maps/heroes so those payloads are never loaded for that match.

Anything that would stop the clock — pause, bag, shop, reward drafts — only pauses when exactly **one** human is playing (offline solo runs still pause, even the dual-lane and AI Lab ones). In multi-human matches reward drafts appear in a compact panel, queue up if you earn several, and never freeze the wave. Gameplay cheats are likewise ignored whenever more than one human is in the game.

Default win condition is **10 waves** (configurable; **Unlimited** = base death only). High ground grants bonus damage. You **respawn** if downed — only a destroyed **base** (or clearing the wave goal) ends the run.

## Modes

- **Singleplayer** — Classic abstract opponent, or a trained neural school (Rookie → Brutal) on a real dual lane. Run options: map, max turrets, starting gold, waves to win, friendly fire, **Ascension**.
- **Barracks** — Spend **War Crests** (earned at run end) on permanent upgrades and hero commissions (Coil / Thorn start locked).
- **Ascension** — A0–A12 cumulative modifiers (StS-style). Win at your highest unlocked level to open the next; Crests scale with Ascension.
- **Multiplayer** — PeerJS lobbies (private code or public find-match). Modes: **1v1 / 2v2 / 3v3** PvP and **2p / 3p PvE**. Host-authoritative sim; allies share a physical lane but keep **independent** gold, shop, items, relics, and drafts. Mid-match disconnect shows an end overlay (no mid-match reconnect).
- **AI Lab** — In-browser genetic training on unlimited-wave duels (base death wins). Recipes + checkpoints save as difficulty tiers for solo/PvE.

## Systems

- **Maps** — Classic Lane through Orb Foundry, plus **Mazing**, **Hex Bowl**, and **Capsule Coast**. Workshop editor supports non-rect playable shapes, new specials (ember rain / supply drops / chrono pulse), and bounce / portal / relay tools.
- **Heroes** — Full roster including signature kits (Warp, Gyro, Gunner, Sapper, Vector, …). Each has aim mode, passive, and abilities (see Compendium). Hero-specific level bonuses appear as rare draft picks.
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
| `npm test` | — | Vitest suite (sim parity, pause/cheat policy, drafts, save + custom-map validation) |
| `npm run typecheck` | — | Type-check `src` **and** `tests` |

**GitHub Pages:** pushes to `master` run [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml), which builds `dist/` and deploys it. One-time: **Settings → Pages → Source: GitHub Actions**. URL is `https://<owner>.github.io/<repo>/`.

Desktop (itch upload + Steam roadmap): **[`DESKTOP.md`](./DESKTOP.md)**.

## Later

Deeper AI / balance polish, more Barracks nodes, Ascension tuning, and optional mid-match reconnect if PeerJS session restore becomes feasible.

Player-facing change log: **[`PATCHNOTES.md`](./PATCHNOTES.md)**.
