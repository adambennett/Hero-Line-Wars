# Hero Line Wars — Patch Notes

## 2026-08-04 · v0.0.6

A large content and systems update:
- Campaign
- Named Game Types
- Armor and energy shields
- Free Artifact placement
- More level-up bonuses

### Campaign
- New **Campaign** mode from the main menu: branching 3-act map with combat,
  elite, boss, shop, event, rest, and chest nodes.
- Lobby: pick hero and game type, then (optional) choose **1 of 3 run-start
  bonuses** before the map — short power bumps, often with HP tradeoffs. Toggle
  start bonuses in **Settings** (on by default).
- Fights are 10-wave runs; base HP carries between nodes. Mid-fight progress is
  checkpointed — leave and return to the **same map** (Random does not re-roll on
  resume). **Back to menu** from campaign combat returns to the map without an
  abandon scare; intentional abandon still confirms.
- Map screen: standout **stats panel** (Credits, base, hero, act) and a **Bag**
  for items, relics, and run perks.
- Campaign shops and chests show clearer rewards (relic name, description, art).

### Game Types
- SP, MP, and Campaign use **named game types** instead of a raw options grid:
  **Outlast** (default for SP/MP — unlimited waves), **Race** (clear a set number
  of waves; default for Campaign), and **Survival** (run lives, invincible bases,
  sends still go to the enemy lane by default). SP/MP **Reset** restores Outlast
  plus the default 0-ally / 1-enemy AI roster.
- **Game Type Editor** in Workshop (and Edit Gametypes from lobbies): tune rules,
  write a short description, import/export JSON, and save custom types. Lists show
  your description, not a wall of setting names.
- **Content filters** on custom types — restrict heroes, bonuses, items,
  Artifacts, relics, enemies, sends, maps, and base upgrades. Built-ins leave
  everything enabled. Empty a category (e.g. all sends or Artifacts) and that
  feature/UI stays off for the type. Saves still need at least one hero and one
  enemy.
- Extra rules you can dial in: send own vs enemy lane, Artifact slots (Map Default
  / fixed counts / Unlimited), **Free** vs **Locked** Artifact placement,
  lane-clear speed **%**, between-wave timer, invincible player/enemy bases,
  respawn minigame, whether **Barracks combat upgrades** apply, and other options
  that used to live only as checkboxes.

### Artifacts
- Default on built-ins: buy an Artifact and **place it yourself** with the next
  attack click (short placement debounce — disable under Settings if you prefer).
  Custom types can keep map-locked auto slots.
- You cannot place more Artifacts than the map allows unless the type sets
  Unlimited slots.

### Shop & economy
- **Reroll Token** is a permanent dedicated shop row. Price scales with wave and
  climbs each purchase that wave; resets on the next wave.
- **Reroll stock** refreshes gear and the Artifact offer for gold that scales up
  over the whole run (some chest finds can ease the cost). The token offer itself
  does not re-roll.
- Clear separators between gear, Artifact, and token. Buys are click-only so send
  hotkeys still work with the shop open. The shop hides entirely while paused.

### Combat
- Sends sit in a compact **2-column** card next to gold (base upgrade full-width
  on top; packs arranged 1|3 / 2|4 / ·|5) so wide maps like Mazing keep a stable
  panel instead of stretching across the mid-lane.
- **Armor** (flat value, no regen) and **Energy Shields** (regen after a quiet
  stretch). Warden passive is **Platebound**; Prism is **Aegis Lattice**. New
  armored/shielded creeps, elites (**Ironclad**, **Aegis Drone**), and bosses
  (**Bulwark**, **Wardlord**, **Aegis Colossus**).
- New pressure creeps: **Pusher** (melee shove toward spawn) and **Knocker**
  (knockback bolts).
- With **Show damage numbers** on, hits spawn floating combat text.
- **Respawn precision minigame** (default on for built-in types): time Space while
  dead to cut respawn, floored at 1 second.

### Level-ups & base upgrades
- Many new **global** level bonuses — extra common variety, plus new Rare /
  Mythic / Legendary options any hero can draft (hero-tied rare+ are still there).
- Base branch upgrades now have **rarities**. Compendium tab is **Base Upgrades**.

### Meta & challenges
- Barracks **combat** ranks no longer apply in multiplayer or campaign by default
  (unlocks still do). Re-enable per game type for SP/MP, or with the **Barracks
  in Campaign** cheat.
- New challenge **Crest Siege**: reach wave 18 on Ascension 3+ with ≤4 deaths —
  large Crest payout and a barracks unlock (fills the challenges grid).

### Compendium & info
- Ascension list shows each level's own effect only (not a stacked A1…An summary).
- Bonuses tab sorts commons-first by default.
- Game Info is fuller and fully expanded by default.

### Menus
- Main menu is centered and roomier; Workshop includes **Game Type Editor**
  between Map Editor and Hero Editor.
- SP **Reset** restores the selected game type's defaults and AI roster to
  **0 ally / 1 enemy**.
- Lobbies pick a game type first; deeper rules live in the editor.

### Creative run options (Game Types)
- Many new creative dropdowns and toggles: relic drop timing, enemy/player damage
  × ladders (Primary/Mobility/Ultimate + Instant Kill), wall bounciness, player/enemy size & speed,
  expanded enemy speed list, Enemy density up to **50×**, Respawn **0×** (always instant), chest open
  **Instant** / despawn **Never**, Crit Lottery, Enemy Mutation, plus spicy
  toggles (double projectiles, immune projectiles, free items/artifacts,
  randomize hero/map/utility each wave, thorns, blood tax, corpse explosion,
  and more). Wired through combat, shops, waves, and MP lobby extras.

### New built-in content
- **Maps:** Grandma's House — tight square deathbox with four Artifact slots.
  Excluded from **Random** map rolls (and Fiesta map scramble) unless a game type
  filter only allows it; still pickable by name in other modes.
- **Game types (order):** Outlast, Race, Survival, Endless, Brutal,
  Fiesta Outlast, Fiesta Race, Fiesta Survival, Giant Explosive Race,
  Grandma's House (map locked; density 5×; chaos multipliers).

### Workshop safety
- Map / Hero / Game Type editors require a confirm dialog before deleting custom
  library content.

### Draft UI
- Level and relic choose-3: **Skip** and **Reroll** share one bottom row
  (Skip left, Reroll right). Reroll label is `Reroll (X)` or `No reroll tokens`.
- Level-up title is only **Level Up! (Lv X)** — no reroll count or “choose
  passive” subtitle.
- Base branch title is **Base Upgrade (Lv X)** (subtitle removed).

### Menus & polish
- Main-menu Workshop / Progress / Library chips keep shine clipped per button
  (no cross-button sweep) and fit four Workshop labels without overlap.
- Player damage run options labeled **Primary / Mobility / Ultimate** (not mouse
  buttons — remaps apply).
- Theme-styled scrollbars (dark blue track / steel thumb) instead of OS white.
- Survival built-in description: `Ten lives, invincible bases, unlimited waves.`
- Game Type Editor no longer duplicates the description blurb under the type chips.
- Respawn minigame is a large HTML bar stacked directly under the centered
  respawn timer (uses remapped Utility key for the shave prompt).
- Hero Editor **Basic / Advanced** as compact mode chips (not stretched column
  buttons); Advanced exposes deep combat knobs (spread, projectile extras,
  ability power, pierce/bounce, ability text, wider stat clamps).

### Fixes
- **Enemy size** run option now applies on every spawn. It was only taking effect
  when Enemy Mutation was also set, so **Giant Explosive Race** shipped with
  normal-sized creeps.
- Heroes no longer get pinned inside a wall they spawn or respawn inside — that
  obstacle stops colliding until you step clear of it (giant heroes, tight maps).
- Respawning keeps your size multiplier instead of snapping back to base radius.
- Player/enemy size options cap at **5×**; the old 10× and 20× entries are gone
  (saved game types are clamped on load).

## 2026-08-04 · v0.0.5

### Bug Fix
- Fixed Multiplayer lobbies not being possible to start due to a bug with the "Start Match" button.
 
## 2026-08-03 · v0.0.4

### Balance — Cloud
- Faster default move speed (**238 → 272**) and more max HP (**88 → 108**).

### Balance — Gunner
- Machine-gun primary range roughly **halved** (attack range + projectile lifetime).
- LMG: much wider bullet spread and shorter projectile lifetime so spray is less
  dominant at mid/long range.

### Chests
- Drafts always offer **two unique reward families** (no duplicate gold/gold).
- New small rewards: **XP**, **heal** (% max HP), **reroll tokens**, and **base
  repair**.
- Gold / XP / base-repair amounts **scale with wave** so late chests stay relevant.

### AI Lab
- **Training run options** panel (ascension, double elites, density/HP/speed,
  income, fog, cramped lane, and other creative toggles) so you can train
  schools against harsh setups.

### Desktop
- Electron upgraded to **^42.3.3** (CVE-clean line; resolves to 42.8.x).

### Patch Notes (in-game)
- Main menu **Library → Patch Notes** opens the changelog. Newest version first;
  pager arrows flip between versions (one page each).

## 2026-08-01 · v0.0.3

### Combat HUD
- Gold panel, pause, and abilities dock to the **lane edges** (not the viewport
  gutters). Abilities sit in one row under the right side of the lane.
- Lane playfield uses tighter vertical margins so the board reads larger; the
  bottom control-hint line is gone.

### Pathfinding
- Extra corner separation + a slightly thicker flow-field blocked radius so
  creeps stop snagging on obstacle / high-ground corners (Island Hop, etc.).

### Enemy lane view
- Send / upgrade / economy UI always acts on **your** lane while the canvas can
  show theirs; wave pill clarifies when you’re watching their fight.

### Lobby AI roster (SP + MP)
- Beyond Mode presets, add AI allies/enemies up to **3 combatants per team**.
- Each AI seat has its own difficulty (Classic or a trained school tier) and
  hero — asymmetric setups like 1v2 with Brutal + Classic are supported.
- MP host can start once every human is ready and each fighting side has 1–3
  bodies (AI fillers count); mode seat caps no longer block asymmetric starts.
- AI roster selects use the same dark menu chrome as run options; lane columns
  share aligned row heights (You row ↔ first enemy).

### Fixes
- Dual-lane with AI allies no longer soft-locks mid-run (AI drafts were pausing
  the whole lane without auto-resolving). Enemy-lane view uses the purple rival
  tint on the real sim again.
- Pause → Settings → back returns to the pause menu instead of dumping you on
  the main menu with no way back into the run.

### New hero — Cloud
- Poison ninja unlocked via Barracks (**Commission: Cloud**, no challenge).
- **LMB Poison Dash** — zooms through enemies, phases contact damage during the
  dash, and applies light poison DoT stacks (poison never heals you).
- **RMB Wall Dart** — short wind-up, then rapid top↔bottom ricochets (2 hits
  each side). Drops a small poison cloud on every wall hit. Low cooldown.
- **MMB Gas Spew** — spew larger poison clouds for a few seconds while free to
  move and dash; enemies in clouds stack poison.
- **Passive: Venom Cache** — poisoned kills leave a tiny poison puff.
- Hero level bonuses: Toxic Reserve, Wall Runner, Miasma Engine.

### Gunner
- Weapon switching is **locked while the equipped weapon reloads or cools
  down** — the HUD label shows the lock.
- Reload rebalance: LMG 4.5s → **10s**, Rockets 3.2s → **5.5s**, and every
  other arsenal weapon reloads slightly longer. Machine-gun primary damage
  7 → **5**.

### Sapper
- Detonate with **no armed mines** no longer explodes anything and spends no
  cooldown; mines still arming stay planted. Grenade primary fires slightly
  slower.

### Maps & pathfinding
- Shaped maps (Hex Bowl, Capsule Coast): walls now **slide you smoothly**
  along the edge instead of teleporting you back inside. Dashes and knockbacks
  respect map shapes too.
- Enemies use real **flow-field pathfinding** — they navigate mazes (Mazing)
  and shifting obstacles instead of wedging into corners. The emergency
  "unstick" hop only fires when a creep is truly sealed in.

### Multiplayer
- Viewing the enemy lane now shows their **actual fight** — no more stale /
  ghost enemies — and the View lane keybind works in multiplayer.

### Menu redesign
- Every menu screen now sits on a **shared grid layout system**: multi-column
  Main Menu, grouped Settings / Controls cards, and denser SP / MP run setup.
  Screens fit 1366×768 without scrollbars.
- Map Editor: tools moved to a **toolbar above the canvas**; the template
  picker and library live in a footer bar, so the options panel no longer
  scrolls.
- Online Lobby: consolidated run options with a collapsible **Creative**
  section and a single footer action row.
- New **live map preview** in SP and MP run setup. Compendium and preview
  thumbnails render each map's true shape, including custom maps.
- The Creative options fold shows an **"N active"** badge and auto-expands
  only when something is non-default.

### Combat HUD
- Top chrome anchors to the **viewport edges** (not the centered lane box):
  player economy left, rival panel right, wave pill centered, sends spanning
  the full band between the side panels.
- Only the **5 strongest** unlocked send packs are shown (hotkeys 1–5), laid
  out in equal grid columns so chips no longer crush/overlap.
- Dropped the redundant “Your lane / Enemy lane” stack under the wave number
  and the send-bar caption; map name lives in the gold panel.

### Fixes
- Ability tooltips no longer get stuck on screen through pauses, run end, and
  menus.
- Map editor: the shape-change confirmation could softlock the client.
- Main-menu music: hardens first-load unlock (window gesture hook, muted
  autoplay fallback, Electron `no-user-gesture-required`) so BGM is not stuck
  waiting for a submenu click.

---

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
