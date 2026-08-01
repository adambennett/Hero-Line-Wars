# Hero Line Wars — Patch Notes

## 2026-08-01 · v0.0.2

### UI cleanup & design system
- Shared **shine / text-jump** hover (`.shine-btn`) for menu CTAs and hero
  cards — one CSS implementation, used consistently. Skipped on HUD, tiny
  tools, disabled, and destructive actions (Quit, Delete, Reset defaults).
- Wider multi-column shells for Settings, Controls, Cheats, AI Lab, and
  Compendium; creative toggles use a denser checkbox grid. Shell widths scale
  for 1080p → 4K / ultrawide via design tokens.
- Shorter menu copy; Game Info uses expandable help instead of long essays.
- Reduce-motion (settings + OS preference) disables shine and idle menu motion.
- Project rule updated with a clear **UI/UX design philosophy** so future
  agents keep the steel / amber-teal war-room look and shared layout classes.

### Map editor — playable shapes
- Custom maps can use a **Shape** (rectangle, circle, triangle, square, pentagon,
  hexagon, octagon, diamond, oval, trapezoid). Drag the playable edges to resize;
  **Reset lane bounds** restores that shape’s default size.
- Changing shape asks for confirmation and reports how many placed objects may be
  moved or removed. Required pads re-anchor; leftovers clamp or drop safely.
- Older custom maps without a shape still load as full-width **rectangles**.

### New map specials & tools
- Specials (editor toggles): **Ember rain** (wave AoE drops), **Supply drops**
  (free gold crates), **Chrono pulse** (brief creep freeze + hero haste).
- Tools: **Bounce** pads (impulse launch), **Portal** (one-way warp), **Relay**
  beacons (temporary damage buff while near).

### Run / creative options (SP + MP)
- **Fog thickness** (up to 100% = Flash-style blackout) and **Fog vision** circle
  size. Run fog, curse fog, and map eclipse fog stack: strongest opacity +
  tightest vision wins.
- New toggles: **Glass cannon**, **Gold rush**, **Wild chests**, **Cramped lane**.

### Built-in maps
- **Mazing** — maze corridors with dual spawn mouths (from the community Mazing
  layout).
- **Hex Bowl** — hexagonal arena with bounce pads and a center relay.
- **Capsule Coast** — oval shoreline lane with portals and flank relays.

### New heroes
- **Gunner** (Barracks commission) — no dash. LMB is a rapid machine gun. **Ult
  cycles** eight heavy weapons; **RMB fires** the equipped one (Rockets, Bolt
  Sniper, Auto Sniper, Shotgun, BR, AR, LMG, Laser). Snipers lock movement while
  aiming; in solo they also freeze the fight so you can line up the shot. Online
  with two humans the freeze is off, but you still plant and aim. Laser pierces
  walls and hurts you — watch for the red feedback flash.
- **Sapper** (Barracks) — lobbed grenades, Plant Mine, Detonate. Mine kills
  refund Plant Mine cooldown.
- **Vector** (challenge **Momentum Master**: reach wave 14, then Barracks) —
  build Momentum by moving; basics and dash scale with it; Kinetic Burst spends
  the bar for a shockwave.

### Level-up bonuses
- Every hero now has **3 rare hero-specific** level bonuses (Gunner has **6**
  weapon specializations). They show up occasionally in level drafts alongside
  the usual common passives, tagged with rarity and hero name.

### Compendium
- New **Bonuses** tab between Heroes and Items — rarity, description, and hero
  name when the bonus is unique.

### Pause — one rule everywhere
- Pausing now depends only on **how many humans are in the game**, not on which
  simulation the mode happens to use. Solo runs pause as always, including solo
  team modes, neural dual-lane and the AI Lab.
- With two or more humans **nothing** pauses the match — not Escape, not the bag,
  not shops, not reward drafts. Escape opens the same menu (Settings, Controls,
  Quit) with the match still running behind it.
- Fixed: **Escape no longer does nothing during combat.** It was being handled
  twice per press, so the pause menu opened and instantly closed again.

### Reward drafts
- Earning a reward while another draft is open now **queues** it instead of
  replacing it. You pick them one at a time and nothing is lost; the panel shows
  how many rewards are still waiting.
- In multi-human matches the draft panel is compact so you can still read the
  fight behind it, and the wave keeps advancing while you choose.
- Queued rewards survive host snapshots, so a client never loses a pick.

### Cheats
- Gameplay cheats (god mode, infinite gold, free shop, one-shot, skip wave, force
  chest, reveal fog, infinite rerolls) are **ignored whenever more than one human
  is playing**, host included. Unlock-everything still works everywhere.
- The Cheats menu states this up front.
- One-shot and reveal-fog were listed but did nothing — both work now.

### Run options
- **No Elites**, **No Bosses** and **Double Elites** were completely inert. They
  now apply in every mode, and a "no elites" wave gets its full creep count back
  instead of the reduced elite-wave count.

### Multiplayer fixes
- **Phoenix Down now revives you in dual-lane and online matches** (it only ever
  worked in singleplayer), using your own charges.
- **Any teammate can open a chest** on a shared lane — previously only the first
  player's hero could, and the reward now goes to whoever opened it.
- Clients now receive the world objects they were missing: chests and their open
  progress, hex zones, volatile orbs, teleporters, eclipse fog, moving hazards,
  shifting/shrinking lane geometry, Gyro blade and hook state, and shop refresh
  timers. Chest reward cards show the real reward instead of a stub.
- Lanes nobody is watching are sent as a small HUD summary (wave, base, enemy
  count, players) instead of every entity; switching to View lane pulls a full
  snapshot for that lane immediately. Big bandwidth cut with no pop-in on your
  own lane.

### Robustness
- Malformed network messages are dropped instead of throwing, remote inputs are
  clamped to legal values, and a flooding peer is rate-limited.
- Custom maps with corrupt lists (a zone list that is not a list, junk specials,
  absurd sizes) load safely instead of crashing the lobby. Existing maps are
  unaffected.
- Save import validates and clamps everything it reads — a corrupt or hand-edited
  file can no longer wreck Barracks progress. Older exports still import.

### Under the hood
- Added a test suite (`npm test`, Vitest): SP vs dual-lane parity harness, pause
  and cheat gating, draft queue, run-option flags, custom-map sanitizing and save
  round-trip.

---

## 2026-08-01 · v0.0.1

### Multiplayer — per-player independence
- Teammates on a shared lane no longer share one gold / shop / relic / draft pool.
  Each controller has their own economy bag (gold, shop stock, items, relics, XP
  drafts, utility, rerolls). The physical lane (enemies, base, map) stays shared.
- Draft picks (relic, level, utility, curse, chest, base branch, skip, rerolls)
  are sent as intents so **clients** resolve on the host sim — no more softlocks
  from local-only UI mutations.
- Snapshots sync utility / curse / chest / base-branch drafts and per-player bags
  so clients see the same draft UI as the host.
- Shop digit keys (4–6) resolve against **your** shop-open state, not the lane
  you are spectating with View lane.
- Camera / View lane is local-only — host snapshots no longer force every
  client's camera.

### Multiplayer — authority & disconnect
- Host binds intents to the PeerJS connection seat (client-claimed seat ignored).
- Mid-match disconnect shows a clear overlay (host left / player left) and ends
  the session. Full PeerJS reconnect is not supported mid-match.
- Fixed: starting a match no longer tears down the PeerJS session (lobby UI
  unmount kept the connection; previously `destroy()` always called
  `disconnectNet()` and killed online MP as soon as the match began).

### Multiplayer / solo dual-lane — sim parity
- Curse timers (shop / send / upgrade blocks, income tax, fog, shop-refresh slow),
  income tax on gold gain, and Hex DoT zones now tick in the dual-lane sim like
  singleplayer.
- AI allies (solo team size 2–3 and PvE extras) actually fight with scripted /
  neural intents instead of standing idle.

### Custom content safety
- Peer / session custom maps & heroes are sanitized (NaN coords, array caps,
  absurd stats, ability / passive id checks).
- New Settings toggle: **Reject peer custom content** — if on, joining a lobby
  that requires custom maps/heroes is refused so those payloads are never
  registered for the match.

---
