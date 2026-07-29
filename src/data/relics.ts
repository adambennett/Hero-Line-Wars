/** Build-defining relics — drafted after elite/boss waves. */

import type { Rarity } from "./rarity";

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
  | "legend_crown";

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
};

export const RELIC_LIST: RelicDef[] = Object.values(RELICS);

/** Pick up to `count` relics the run does not already own. Soft-bias toward mid rarities. */
export function draftRelicChoices(owned: RelicId[], count = 3): RelicId[] {
  const pool = RELIC_LIST.map((r) => r.id).filter((id) => !owned.includes(id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count);
}
