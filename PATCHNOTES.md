# Hero Line Wars — Patch Notes

Newest first. Every change that a player or a future agent would care about gets
an entry here in the same change set — see `.cursor/rules/hero-line-wars.mdc`.
Write player-facing; implementation detail belongs in the commit message.

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
