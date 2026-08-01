/** Challenge-locked content gates — Barracks purchase after challenge. */

import type { MetaUpgradeId } from "../meta/upgrades";
import { isContentPackUnlocked } from "../meta/store";

/** Shop item ids locked behind packs. */
export const LOCKED_ITEM_PACK: Partial<Record<string, MetaUpgradeId>> = {
  shadow_greaves: "unlock_challenge_items_a",
  monk_beads: "unlock_challenge_items_a",
  rust_nail: "unlock_challenge_items_a",
  quiet_ledger: "unlock_challenge_items_b",
  beggar_cloak: "unlock_challenge_items_b",
  copper_spike: "unlock_challenge_items_b",
  boss_fang: "unlock_challenge_items_c",
  trophy_ring: "unlock_challenge_items_c",
  marrow_flask: "unlock_challenge_items_c",
  marathon_boots: "unlock_challenge_items_d",
  endurance_charm: "unlock_challenge_items_d",
  longwatch_scope: "unlock_challenge_items_d",
  architect_hammer: "unlock_challenge_items_e",
  scaffold_kit: "unlock_challenge_items_e",
  keystone_shard: "unlock_challenge_items_e",
  miser_coin: "unlock_challenge_items_f",
  thrift_seal: "unlock_challenge_items_f",
  empty_purse: "unlock_challenge_items_f",
  legend_quill: "unlock_challenge_items_g",
  ascent_crown: "unlock_challenge_items_g",
  void_thread: "unlock_challenge_items_h",
  starfall_lens: "unlock_challenge_items_h",
  mentor_tome: "unlock_challenge_items_g",
  forge_heart: "unlock_challenge_items_e",
  nest_core: "unlock_challenge_items_c",
  reroll_token: undefined, // always available
  reroll_pouch: undefined,
};

export const LOCKED_RELIC_PACK: Partial<Record<string, MetaUpgradeId>> = {
  quiet_market: "unlock_challenge_relics_a",
  send_silence: "unlock_challenge_relics_a",
  iron_breath: "unlock_challenge_relics_b",
  second_chance: "unlock_challenge_relics_b",
  flawless_oath: "unlock_challenge_relics_c",
  untouchable: "unlock_challenge_relics_c",
  elite_bane: "unlock_challenge_relics_d",
  trophy_hunter: "unlock_challenge_relics_d",
  chest_magnet: "unlock_challenge_relics_e",
  lucky_lockpick: "unlock_challenge_relics_e",
  relic_nest: "unlock_challenge_relics_f",
  stacked_fate: "unlock_challenge_relics_f",
  draft_sage: "unlock_challenge_relics_g",
  level_torrent: "unlock_challenge_relics_g",
  bare_hands: "unlock_challenge_relics_h",
  scrap_king: "unlock_challenge_relics_h",
  cleaver_crown: "unlock_challenge_relics_i",
  storm_sovereign: "unlock_challenge_relics_i",
  curse_mirror: "unlock_challenge_relics_i",
  twin_lanes: "unlock_challenge_relics_i",
  mentor_sigil: undefined,
  scholar_band: undefined,
  ascent_primer: "unlock_challenge_relics_g",
};

export const LOCKED_MAP_PACK: Partial<Record<string, MetaUpgradeId>> = {
  hex_warrens: "unlock_challenge_maps_a",
  ascendant_spine: "unlock_challenge_maps_b",
  treasure_vein: "unlock_challenge_maps_c",
  tourist_loop: "unlock_challenge_maps_d",
};

export const LOCKED_SEND_PACK: Partial<Record<string, MetaUpgradeId>> = {
  pressure_swarm: "unlock_challenge_sends_a",
  pressure_siege: "unlock_challenge_sends_a",
  emplacement_crew: "unlock_challenge_sends_b",
  overwatch_pack: "unlock_challenge_sends_b",
  dual_banner: "unlock_challenge_sends_c",
  command_squad: "unlock_challenge_sends_c",
};

export function isItemUnlocked(id: string): boolean {
  const pack = LOCKED_ITEM_PACK[id];
  if (!pack) return true;
  return isContentPackUnlocked(pack);
}

export function isRelicUnlocked(id: string): boolean {
  const pack = LOCKED_RELIC_PACK[id];
  if (!pack) return true;
  return isContentPackUnlocked(pack);
}

export function isMapUnlocked(id: string): boolean {
  const pack = LOCKED_MAP_PACK[id];
  if (!pack) return true;
  return isContentPackUnlocked(pack);
}

export function isSendUnlocked(id: string): boolean {
  const pack = LOCKED_SEND_PACK[id];
  if (!pack) return true;
  return isContentPackUnlocked(pack);
}
