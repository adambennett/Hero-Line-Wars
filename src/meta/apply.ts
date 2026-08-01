/** Apply run-start bonuses that need drafts / relic picks after createState. */

import { RELIC_LIST, type RelicId } from "../data/relics";
import type { Rarity } from "../data/rarity";
import type { GameState } from "../game/state";
import { pickRelic } from "../systems/relics";
import { openLevelDraft, openRunStartUtilityDraft } from "../systems/xp";
import type { RunModifiers, StartingRelicTier } from "./modifiers";

const RARITY_MIN: Record<Exclude<StartingRelicTier, "none">, Rarity[]> = {
  common: ["common"],
  uncommon: ["common", "uncommon"],
  rare: ["uncommon", "rare", "mythic", "legendary"],
};

function pickStartingRelicId(tier: StartingRelicTier, owned: RelicId[]): RelicId | null {
  if (tier === "none") return null;
  const allowed = new Set(RARITY_MIN[tier]);
  const pool = RELIC_LIST.filter((r) => allowed.has(r.rarity) && !owned.includes(r.id));
  if (pool.length === 0) return null;
  // Prefer higher rarity within the allowed set
  pool.sort((a, b) => {
    const order = ["common", "uncommon", "rare", "legendary"];
    return order.indexOf(b.rarity) - order.indexOf(a.rarity);
  });
  const top = pool.filter((r) => r.rarity === pool[0]!.rarity);
  return top[Math.floor(Math.random() * top.length)]!.id;
}

/** Call after createState for the player lane. */
export function applyRunStartExtras(state: GameState, mods: RunModifiers): void {
  // Creative option: utility draft immediately at run start (before waves).
  openRunStartUtilityDraft(state);

  if (!mods.applyPlayerMeta) return;

  if (mods.startingRelic !== "none") {
    const id = pickStartingRelicId(mods.startingRelic, state.relics);
    if (id) pickRelic(state, id);
  }

  if (mods.startingLevelDrafts > 0) {
    state.pendingLevelUps += mods.startingLevelDrafts;
    if (!state.pausedForDraft) openLevelDraft(state);
  }
}
