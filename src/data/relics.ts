/** Build-defining relics — drafted after elite/boss waves. */

import type { Rarity } from "./rarity";
import { isRelicUnlocked } from "../meta/contentLocks";
import type { GameTypeContentFilters } from "../meta/contentFilters";
import { isIdEnabled } from "../meta/contentFilters";

export type RelicId =
  | "crowded_ledger"
  | "high_ground_oath"
  | "second_wind"
  | "blood_price"
  | "chain_spark"
  | "gold_fever"
  | "phantom_step"
  | "overcharge"
  | "iron_dividend"
  | "hungry_blade"
  | "war_tax"
  | "splinter_tip"
  | "foundation_spikes"
  | "send_sovereign"
  | "architects_favor"
  | "glass_cannon"
  | "frost_sigil"
  | "lucky_coin"
  | "tide_charm"
  | "mythic_engine"
  | "legend_crown"
  | "spare_clip"
  | "runners_band"
  | "penny_whistle"
  | "stone_skin"
  | "keen_eye"
  | "bounty_mark"
  | "rally_banner"
  | "echo_chamber"
  | "vampiric_edge"
  | "fortress_pact"
  | "haste_sigil"
  | "miser_purse"
  | "shockwave_core"
  | "last_stand"
  | "wave_rider"
  | "turret_overclock"
  | "blood_tithe"
  | "oracle_lens"
  | "phoenix_down"
  | "eternal_engine"
  | "worldbreaker"
  | "sovereign_seal"
  | "line_tyrant"
  | "quiet_market"
  | "send_silence"
  | "iron_breath"
  | "second_chance"
  | "flawless_oath"
  | "untouchable"
  | "elite_bane"
  | "trophy_hunter"
  | "chest_magnet"
  | "lucky_lockpick"
  | "relic_nest"
  | "stacked_fate"
  | "draft_sage"
  | "level_torrent"
  | "bare_hands"
  | "scrap_king"
  | "cleaver_crown"
  | "storm_sovereign"
  | "curse_mirror"
  | "twin_lanes"
  | "mentor_sigil"
  | "scholar_band"
  | "ascent_primer";

export type RelicDef = {
  id: RelicId;
  name: string;
  blurb: string;
  /** Short tag for draft UI. */
  tag: string;
  rarity: Rarity;
};

export const RELICS: Record<RelicId, RelicDef> = {
  crowded_ledger: {
    id: "crowded_ledger",
    name: "Crowded Ledger",
    blurb: "Send packs cost 20% less gold.",
    tag: "Economy",
    rarity: "common",
  },
  high_ground_oath: {
    id: "high_ground_oath",
    name: "High Ground Oath",
    blurb: "High-ground damage bonus becomes +65% (was +35%).",
    tag: "Offense",
    rarity: "uncommon",
  },
  second_wind: {
    id: "second_wind",
    name: "Second Wind",
    blurb: "Between waves, recover 35% of missing HP.",
    tag: "Sustain",
    rarity: "common",
  },
  blood_price: {
    id: "blood_price",
    name: "Blood Price",
    blurb: "+35% attack damage, but you take 25% more damage.",
    tag: "Risk",
    rarity: "rare",
  },
  chain_spark: {
    id: "chain_spark",
    name: "Chain Spark",
    blurb: "Basic-attack projectiles bounce to one extra enemy for 60% damage.",
    tag: "Attack",
    rarity: "uncommon",
  },
  gold_fever: {
    id: "gold_fever",
    name: "Gold Fever",
    blurb: "+60% gold from kills, but passive income is reduced by 25%.",
    tag: "Economy",
    rarity: "rare",
  },
  phantom_step: {
    id: "phantom_step",
    name: "Phantom Step",
    blurb: "Mobility cooldown reduced by 35%.",
    tag: "Mobility",
    rarity: "common",
  },
  overcharge: {
    id: "overcharge",
    name: "Overcharge",
    blurb: "Attack 30% faster, but deal 15% less damage per hit.",
    tag: "Attack",
    rarity: "uncommon",
  },
  iron_dividend: {
    id: "iron_dividend",
    name: "Iron Dividend",
    blurb: "Base takes 30% less damage; income −0.4/s.",
    tag: "Defense",
    rarity: "uncommon",
  },
  hungry_blade: {
    id: "hungry_blade",
    name: "Hungry Blade",
    blurb: "Heal for 18% of damage dealt by basic attacks.",
    tag: "Sustain",
    rarity: "rare",
  },
  war_tax: {
    id: "war_tax",
    name: "War Tax",
    blurb: "Send packs grant +40% more income.",
    tag: "Economy",
    rarity: "common",
  },
  splinter_tip: {
    id: "splinter_tip",
    name: "Splinter Tip",
    blurb: "On hit, splash 40% damage to nearby enemies.",
    tag: "Attack",
    rarity: "rare",
  },
  foundation_spikes: {
    id: "foundation_spikes",
    name: "Foundation Spikes",
    blurb: "+4 damage per base level (retroactive). Upgrading the base also heals you 20.",
    tag: "Base",
    rarity: "uncommon",
  },
  send_sovereign: {
    id: "send_sovereign",
    name: "Send Sovereign",
    blurb: "Sent creeps gain +12% HP per base level. Sending refunds 8% of the pack cost.",
    tag: "Sends",
    rarity: "rare",
  },
  architects_favor: {
    id: "architects_favor",
    name: "Architect's Favor",
    blurb: "Turrets gain +25% damage and +20 max HP. Max turret cap +1.",
    tag: "Artifacts",
    rarity: "mythic",
  },
  glass_cannon: {
    id: "glass_cannon",
    name: "Glass Cannon",
    blurb: "+50% damage, −20 max HP (applied once).",
    tag: "Risk",
    rarity: "mythic",
  },
  frost_sigil: {
    id: "frost_sigil",
    name: "Frost Sigil",
    blurb: "Basic attacks slow enemies by 25% for 1.2s.",
    tag: "Control",
    rarity: "uncommon",
  },
  lucky_coin: {
    id: "lucky_coin",
    name: "Lucky Coin",
    blurb: "+12% crit chance (stacks with luck passives).",
    tag: "Luck",
    rarity: "common",
  },
  tide_charm: {
    id: "tide_charm",
    name: "Tide Charm",
    blurb: "Between waves, gain +8 gold and heal 10 HP.",
    tag: "Sustain",
    rarity: "common",
  },
  mythic_engine: {
    id: "mythic_engine",
    name: "Mythic Engine",
    blurb: "+1.2 gold/sec income permanently.",
    tag: "Economy",
    rarity: "mythic",
  },
  legend_crown: {
    id: "legend_crown",
    name: "Crown of the Line",
    blurb: "+15% damage, +25 max HP, and +0.5 income.",
    tag: "Power",
    rarity: "legendary",
  },
  spare_clip: {
    id: "spare_clip",
    name: "Spare Clip",
    blurb: "Attack 12% faster.",
    tag: "Attack",
    rarity: "common",
  },
  runners_band: {
    id: "runners_band",
    name: "Runner's Band",
    blurb: "+35 move speed.",
    tag: "Mobility",
    rarity: "common",
  },
  penny_whistle: {
    id: "penny_whistle",
    name: "Penny Whistle",
    blurb: "+0.5 gold/sec income.",
    tag: "Economy",
    rarity: "common",
  },
  stone_skin: {
    id: "stone_skin",
    name: "Stone Skin",
    blurb: "+30 max HP (heals 15).",
    tag: "Defense",
    rarity: "common",
  },
  keen_eye: {
    id: "keen_eye",
    name: "Keen Eye",
    blurb: "+8% crit chance.",
    tag: "Luck",
    rarity: "uncommon",
  },
  bounty_mark: {
    id: "bounty_mark",
    name: "Bounty Mark",
    blurb: "+25% gold from kills.",
    tag: "Economy",
    rarity: "uncommon",
  },
  rally_banner: {
    id: "rally_banner",
    name: "Rally Banner",
    blurb: "Between waves, gain a 1.5s damage barrier.",
    tag: "Sustain",
    rarity: "uncommon",
  },
  echo_chamber: {
    id: "echo_chamber",
    name: "Echo Chamber",
    blurb: "Ultimate cooldown reduced by 20%.",
    tag: "Power",
    rarity: "uncommon",
  },
  vampiric_edge: {
    id: "vampiric_edge",
    name: "Vampiric Edge",
    blurb: "Heal for 10% of all damage you deal.",
    tag: "Sustain",
    rarity: "rare",
  },
  fortress_pact: {
    id: "fortress_pact",
    name: "Fortress Pact",
    blurb: "Base max HP +40 (repairs 40).",
    tag: "Defense",
    rarity: "rare",
  },
  haste_sigil: {
    id: "haste_sigil",
    name: "Haste Sigil",
    blurb: "Attack 20% faster and +25 move speed.",
    tag: "Attack",
    rarity: "rare",
  },
  miser_purse: {
    id: "miser_purse",
    name: "Miser's Purse",
    blurb: "Shop prices −12%.",
    tag: "Economy",
    rarity: "rare",
  },
  shockwave_core: {
    id: "shockwave_core",
    name: "Shockwave Core",
    blurb: "Basic attacks splash 55% damage nearby.",
    tag: "Attack",
    rarity: "mythic",
  },
  last_stand: {
    id: "last_stand",
    name: "Last Stand",
    blurb: "Below 35% HP, deal +40% damage.",
    tag: "Risk",
    rarity: "mythic",
  },
  wave_rider: {
    id: "wave_rider",
    name: "Wave Rider",
    blurb: "At wave start, heal 20 HP and gain +12 gold.",
    tag: "Sustain",
    rarity: "uncommon",
  },
  turret_overclock: {
    id: "turret_overclock",
    name: "Artifact Overclock",
    blurb: "Artifacts fire 30% faster. Max artifact cap +1.",
    tag: "Artifacts",
    rarity: "mythic",
  },
  blood_tithe: {
    id: "blood_tithe",
    name: "Blood Tithe",
    blurb: "+20% damage; kills heal 4 HP.",
    tag: "Offense",
    rarity: "rare",
  },
  oracle_lens: {
    id: "oracle_lens",
    name: "Oracle Lens",
    blurb: "+15% crit and +6 damage.",
    tag: "Luck",
    rarity: "mythic",
  },
  phoenix_down: {
    id: "phoenix_down",
    name: "Phoenix Down",
    blurb: "Once per run: on death, revive at 50% HP (consumes relic effect).",
    tag: "Survival",
    rarity: "legendary",
  },
  eternal_engine: {
    id: "eternal_engine",
    name: "Eternal Engine",
    blurb: "+2.0 gold/sec and send packs cost 10% less.",
    tag: "Economy",
    rarity: "legendary",
  },
  worldbreaker: {
    id: "worldbreaker",
    name: "Worldbreaker",
    blurb: "+25% damage, +40 max HP, attack 15% faster.",
    tag: "Power",
    rarity: "legendary",
  },
  sovereign_seal: {
    id: "sovereign_seal",
    name: "Sovereign Seal",
    blurb: "Sent creeps +25% HP; income from sends +25%.",
    tag: "Sends",
    rarity: "legendary",
  },
  line_tyrant: {
    id: "line_tyrant",
    name: "Line Tyrant",
    blurb: "+30% damage vs elites/bosses; base takes 15% less damage.",
    tag: "Power",
    rarity: "legendary",
  },
  quiet_market: {
    id: "quiet_market",
    name: "Quiet Market",
    blurb: "Shop prices −15%.",
    tag: "Economy",
    rarity: "rare",
  },
  send_silence: {
    id: "send_silence",
    name: "Send Silence",
    blurb: "Start each wave with +20 gold if you bought no sends last wave.",
    tag: "Economy",
    rarity: "uncommon",
  },
  iron_breath: {
    id: "iron_breath",
    name: "Iron Breath",
    blurb: "Respawn 20% faster.",
    tag: "Sustain",
    rarity: "uncommon",
  },
  second_chance: {
    id: "second_chance",
    name: "Second Chance",
    blurb: "Once: on lethal hit, survive at 1 HP with a 1.5s barrier.",
    tag: "Survival",
    rarity: "mythic",
  },
  flawless_oath: {
    id: "flawless_oath",
    name: "Flawless Oath",
    blurb: "While at full HP, deal +20% damage.",
    tag: "Offense",
    rarity: "rare",
  },
  untouchable: {
    id: "untouchable",
    name: "Untouchable",
    blurb: "+25 max HP and take 8% less damage.",
    tag: "Defense",
    rarity: "rare",
  },
  elite_bane: {
    id: "elite_bane",
    name: "Elite Bane",
    blurb: "+35% damage to elites.",
    tag: "Offense",
    rarity: "rare",
  },
  trophy_hunter: {
    id: "trophy_hunter",
    name: "Trophy Hunter",
    blurb: "Elite kills grant +12 gold.",
    tag: "Economy",
    rarity: "uncommon",
  },
  chest_magnet: {
    id: "chest_magnet",
    name: "Chest Magnet",
    blurb: "Chests open 30% faster.",
    tag: "Utility",
    rarity: "uncommon",
  },
  lucky_lockpick: {
    id: "lucky_lockpick",
    name: "Lucky Lockpick",
    blurb: "Chest spawn chance +50%.",
    tag: "Utility",
    rarity: "rare",
  },
  relic_nest: {
    id: "relic_nest",
    name: "Relic Nest",
    blurb: "+1 relic draft choice size.",
    tag: "Draft",
    rarity: "mythic",
  },
  stacked_fate: {
    id: "stacked_fate",
    name: "Stacked Fate",
    blurb: "Gain a free common relic when you own 4+ relics.",
    tag: "Draft",
    rarity: "rare",
  },
  draft_sage: {
    id: "draft_sage",
    name: "Draft Sage",
    blurb: "Level drafts offer +1 choice.",
    tag: "Draft",
    rarity: "rare",
  },
  level_torrent: {
    id: "level_torrent",
    name: "Level Torrent",
    blurb: "+15% XP from kills.",
    tag: "Growth",
    rarity: "uncommon",
  },
  bare_hands: {
    id: "bare_hands",
    name: "Bare Hands",
    blurb: "+18% damage while owning fewer than 3 shop items.",
    tag: "Risk",
    rarity: "mythic",
  },
  scrap_king: {
    id: "scrap_king",
    name: "Scrap King",
    blurb: "Kills refund 1 gold to your purse.",
    tag: "Economy",
    rarity: "common",
  },
  cleaver_crown: {
    id: "cleaver_crown",
    name: "Cleaver Crown",
    blurb: "+25% damage, +30 max HP, elites drop +8 gold.",
    tag: "Power",
    rarity: "legendary",
  },
  storm_sovereign: {
    id: "storm_sovereign",
    name: "Storm Sovereign",
    blurb: "Attack 25% faster; ultimates cool 15% faster.",
    tag: "Power",
    rarity: "legendary",
  },
  curse_mirror: {
    id: "curse_mirror",
    name: "Curse Mirror",
    blurb: "When hex-cursed, gain +15% damage for the duration.",
    tag: "Hex",
    rarity: "legendary",
  },
  twin_lanes: {
    id: "twin_lanes",
    name: "Twin Lanes",
    blurb: "Send income +20%; artifact damage +15%.",
    tag: "Command",
    rarity: "legendary",
  },
  mentor_sigil: {
    id: "mentor_sigil",
    name: "Mentor Sigil",
    blurb: "+12% XP from kills.",
    tag: "Growth",
    rarity: "uncommon",
  },
  scholar_band: {
    id: "scholar_band",
    name: "Scholar Band",
    blurb: "+8% XP from kills and +5% crit chance.",
    tag: "Growth",
    rarity: "rare",
  },
  ascent_primer: {
    id: "ascent_primer",
    name: "Ascent Primer",
    blurb: "+22% XP from kills, but deal 8% less damage.",
    tag: "Growth",
    rarity: "rare",
  },
};

export const RELIC_LIST: RelicDef[] = Object.values(RELICS);

/** Pick up to `count` relics the run does not already own. Soft-bias toward mid rarities. */
export function draftRelicChoices(
  owned: RelicId[],
  count = 3,
  contentFilters?: GameTypeContentFilters | null,
): RelicId[] {
  const pool = RELIC_LIST.map((r) => r.id).filter(
    (id) => !owned.includes(id) && isRelicUnlocked(id) && isIdEnabled(contentFilters, "relics", id),
  );
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count);
}
