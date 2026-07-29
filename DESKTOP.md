# Desktop shipping (itch today, Steam later)

The game stays a **Vite web build**. Electron (and later Steam) is only a shell that loads `dist/`. No second game rewrite.

## Targets

| Target | Command | Output |
|--------|---------|--------|
| Browser / GitHub Pages | `npm run build:pages` | `dist/` |
| Single-file download | `npm run build:release` | `dist-release/` |
| Desktop (itch / Steam) | `npm run desktop:dist` | `dist-desktop/` |

## Local desktop play

```bash
npm install
npm run desktop:dev          # Vite + Electron (hot reload)
# or
npm run build && npm run desktop        # production dist/ in Electron
```

Main menu **Quit** closes the app window when running under Electron (`window.heroLineWarsDesktop`).

## itch.io — ship today

1. **Build Windows packages**
   ```bash
   npm run desktop:dist
   ```
   Produces under `dist-desktop/`:
   - `Hero Line Wars-*-portable.exe` — portable (no installer; good for itch “download & run”)
   - `Hero Line Wars-*-win-x64.exe` — NSIS installer
   - `.zip` — unpacked folder

2. **Create the itch page** (if needed): game page → Edit → **Distribute this project** → create a channel (e.g. `windows`).

3. **Upload**
   - Web UI: upload the **portable `.exe`** or the **`.zip`** to the Windows channel, mark as **This file is a game for Windows**.
   - Or [butler](https://itch.io/docs/butler/):
     ```bash
     butler push "dist-desktop/Hero Line Wars-0.1.0-portable.exe" yourname/hero-line-wars:windows
     butler push dist-desktop/win-unpacked yourname/hero-line-wars:windows
     ```

4. **Channel tips**
   - Prefer **one** primary Windows build (portable *or* zip).
   - Minimum requirements: recent 64-bit Windows; GPU with Canvas 2D.
   - Optional: also upload `dist-release/*.html` as a browser/offline extra.

5. **Icon (optional)**  
   Drop a square PNG (≥256×256) at `build/icon.png`, then re-run `npm run desktop:dist`.

## What Electron does *not* change

- Gameplay, shop, waves, and UI stay in `src/`.
- Offline singleplayer needs no network.

`window.heroLineWarsDesktop` is set in the Electron preload (`isDesktop`, `platform`, `quit`, versions). Browser builds leave it undefined.

---

## Steam — eventual plan (no rewrite)

Same Vite `dist/` + Electron shell. Steam is **distribution + optional SDK**, not a new engine.

### Phase A — store presence

1. Steamworks partner account + app ID.
2. Ship the same `electron-builder` artifacts via SteamPipe depots.
3. Add `steam_appid.txt` next to the exe for local testing (dev only).
4. Store page, capsules, build branches (`default`, `beta`).

### Phase B — Steamworks (optional)

Thin adapter only (not in core sim):

| Feature | Approach |
|---------|----------|
| Achievements | Hooks from run end / milestones in `game/` / UI |
| Cloud saves | Mirror settings / meta via IPC → Steam Cloud |
| Overlay | Launch via Steam; overlay works with Electron |

### What *not* to do

- Do **not** fork a second codebase for Steam.
- Do **not** block itch on Steamworks — ship the portable build first.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank window after pack | Confirm `dist/index.html` exists; `desktop:dist` runs `build` first |
| Assets 404 | Keep `base: './'` in `vite.config.ts` |
| Huge download | Electron ships Chromium (~80–100MB+). Tauri is a future size option using the same `dist/` |
