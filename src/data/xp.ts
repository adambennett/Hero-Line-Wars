/** Hero XP curve and level-up passive drafts. */

import type { HeroId } from "./heroes";
import {
  HERO_PERKS,
  HERO_PERK_DEFS,
  isHeroPerkId,
  perkDraftWeight,
  type HeroPerkId,
} from "./heroPerks";
import type { Rarity } from "./rarity";
import type { GameTypeContentFilters } from "../meta/contentFilters";
import { isIdEnabled } from "../meta/contentFilters";

export type BaseLevelPassiveId =
  | "vitality"
  | "might"
  | "haste"
  | "luck"
  | "fury"
  | "fortune"
  | "thick_hide"
  | "keen_eye"
  | "sprint_laces"
  | "coin_purse"
  | "second_wind"
  | "honed_edge"
  | "quick_hands"
  | "field_ration"
  | "steady_aim"
  | "scrap_scavenger"
  | "iron_soles"
  | "blood_warmth"
  | "bounty_scrap"
  | "light_step"
  | "ranged_focus"
  | "calloused"
  // global rare / mythic / legendary
  | "war_tax"
  | "bulwark_frame"
  | "adrenaline_surge"
  | "crit_lattice"
  | "gold_vein"
  | "apex_tempo"
  | "phoenix_sinew"
  | "siege_blood"
  | "fortune_engine"
  | "ghost_stride"
  | "godfall_edge"
  | "immortal_grove"
  | "treasury_core"
  | "void_reflex"
  | "worldbreaker";

export type LevelPassiveId = BaseLevelPassiveId | HeroPerkId;

export type LevelPassiveDef = {
  id: LevelPassiveId;
  name: string;
  blurb: string;
  tag: string;
  rarity: Rarity;
  /** Set for hero-unique bonuses. */
  heroId?: HeroId;
};

const BASE_PASSIVES: Record<BaseLevelPassiveId, LevelPassiveDef> = {
  vitality: {
    id: "vitality",
    name: "Vital Surge",
    blurb: "+30 max HP and heal 30.",
    tag: "Survive",
    rarity: "common",
  },
  might: {
    id: "might",
    name: "Hardened Edge",
    blurb: "+6 attack damage.",
    tag: "Offense",
    rarity: "common",
  },
  haste: {
    id: "haste",
    name: "Quickstep",
    blurb: "+35 move speed.",
    tag: "Mobility",
    rarity: "common",
  },
  luck: {
    id: "luck",
    name: "Lucky Strike",
    blurb: "+8% crit chance (×1.75 damage).",
    tag: "Luck",
    rarity: "common",
  },
  fury: {
    id: "fury",
    name: "Battle Tempo",
    blurb: "Attacks 10% faster.",
    tag: "Attack",
    rarity: "common",
  },
  fortune: {
    id: "fortune",
    name: "Coin Glint",
    blurb: "+0.35 gold/sec income.",
    tag: "Economy",
    rarity: "common",
  },
  thick_hide: {
    id: "thick_hide",
    name: "Thick Hide",
    blurb: "+22 max HP.",
    tag: "Survive",
    rarity: "common",
  },
  keen_eye: {
    id: "keen_eye",
    name: "Keen Eye",
    blurb: "+4 attack damage.",
    tag: "Offense",
    rarity: "common",
  },
  sprint_laces: {
    id: "sprint_laces",
    name: "Sprint Laces",
    blurb: "+25 move speed.",
    tag: "Mobility",
    rarity: "common",
  },
  coin_purse: {
    id: "coin_purse",
    name: "Coin Purse",
    blurb: "+0.25 gold/sec income.",
    tag: "Economy",
    rarity: "common",
  },
  second_wind: {
    id: "second_wind",
    name: "Second Wind",
    blurb: "Heal 40 HP now.",
    tag: "Survive",
    rarity: "common",
  },
  honed_edge: {
    id: "honed_edge",
    name: "Honed Edge",
    blurb: "+5 attack damage.",
    tag: "Offense",
    rarity: "common",
  },
  quick_hands: {
    id: "quick_hands",
    name: "Quick Hands",
    blurb: "Attacks 7% faster.",
    tag: "Attack",
    rarity: "common",
  },
  field_ration: {
    id: "field_ration",
    name: "Field Ration",
    blurb: "+18 max HP and heal 18.",
    tag: "Survive",
    rarity: "common",
  },
  steady_aim: {
    id: "steady_aim",
    name: "Steady Aim",
    blurb: "+5% crit chance.",
    tag: "Luck",
    rarity: "common",
  },
  scrap_scavenger: {
    id: "scrap_scavenger",
    name: "Scrap Scavenger",
    blurb: "+1 gold per kill.",
    tag: "Economy",
    rarity: "common",
  },
  iron_soles: {
    id: "iron_soles",
    name: "Iron Soles",
    blurb: "+18 move speed and +10 max HP.",
    tag: "Mobility",
    rarity: "common",
  },
  blood_warmth: {
    id: "blood_warmth",
    name: "Blood Warmth",
    blurb: "+15 max HP and +3 damage.",
    tag: "Hybrid",
    rarity: "common",
  },
  bounty_scrap: {
    id: "bounty_scrap",
    name: "Bounty Scrap",
    blurb: "+12 starting gold next wave… +0.15g/s now.",
    tag: "Economy",
    rarity: "common",
  },
  light_step: {
    id: "light_step",
    name: "Light Step",
    blurb: "+20 move speed.",
    tag: "Mobility",
    rarity: "common",
  },
  ranged_focus: {
    id: "ranged_focus",
    name: "Ranged Focus",
    blurb: "+3 damage; attacks 5% faster.",
    tag: "Attack",
    rarity: "common",
  },
  calloused: {
    id: "calloused",
    name: "Calloused",
    blurb: "+25 max HP.",
    tag: "Survive",
    rarity: "common",
  },
  war_tax: {
    id: "war_tax",
    name: "War Tax",
    blurb: "+0.65 gold/sec and +8 damage.",
    tag: "Economy",
    rarity: "rare",
  },
  bulwark_frame: {
    id: "bulwark_frame",
    name: "Bulwark Frame",
    blurb: "+50 max HP and heal 50.",
    tag: "Survive",
    rarity: "rare",
  },
  adrenaline_surge: {
    id: "adrenaline_surge",
    name: "Adrenaline Surge",
    blurb: "Attacks 15% faster; +40 move speed.",
    tag: "Tempo",
    rarity: "rare",
  },
  crit_lattice: {
    id: "crit_lattice",
    name: "Crit Lattice",
    blurb: "+14% crit chance.",
    tag: "Luck",
    rarity: "rare",
  },
  gold_vein: {
    id: "gold_vein",
    name: "Gold Vein",
    blurb: "+2 gold per kill and +0.4g/s.",
    tag: "Economy",
    rarity: "rare",
  },
  apex_tempo: {
    id: "apex_tempo",
    name: "Apex Tempo",
    blurb: "Attacks 20% faster; +10 damage.",
    tag: "Attack",
    rarity: "mythic",
  },
  phoenix_sinew: {
    id: "phoenix_sinew",
    name: "Phoenix Sinew",
    blurb: "+70 max HP, heal to full, +25 move.",
    tag: "Survive",
    rarity: "mythic",
  },
  siege_blood: {
    id: "siege_blood",
    name: "Siege Blood",
    blurb: "+18 damage and +1.5 gold per kill.",
    tag: "Offense",
    rarity: "mythic",
  },
  fortune_engine: {
    id: "fortune_engine",
    name: "Fortune Engine",
    blurb: "+1.1 gold/sec income.",
    tag: "Economy",
    rarity: "mythic",
  },
  ghost_stride: {
    id: "ghost_stride",
    name: "Ghost Stride",
    blurb: "+70 move speed; attacks 10% faster.",
    tag: "Mobility",
    rarity: "mythic",
  },
  godfall_edge: {
    id: "godfall_edge",
    name: "Godfall Edge",
    blurb: "+30 damage and +18% crit.",
    tag: "Offense",
    rarity: "legendary",
  },
  immortal_grove: {
    id: "immortal_grove",
    name: "Immortal Grove",
    blurb: "+100 max HP, heal fully, +0.5g/s.",
    tag: "Survive",
    rarity: "legendary",
  },
  treasury_core: {
    id: "treasury_core",
    name: "Treasury Core",
    blurb: "+1.6 gold/sec and +3 gold per kill.",
    tag: "Economy",
    rarity: "legendary",
  },
  void_reflex: {
    id: "void_reflex",
    name: "Void Reflex",
    blurb: "Attacks 28% faster; +55 move speed.",
    tag: "Tempo",
    rarity: "legendary",
  },
  worldbreaker: {
    id: "worldbreaker",
    name: "Worldbreaker",
    blurb: "+22 damage, +45 HP, attacks 12% faster.",
    tag: "Hybrid",
    rarity: "legendary",
  },
};

const HERO_AS_LEVEL: Record<string, LevelPassiveDef> = Object.fromEntries(
  HERO_PERK_DEFS.map((p) => [
    p.id,
    {
      id: p.id as LevelPassiveId,
      name: p.name,
      blurb: p.blurb,
      tag: p.tag,
      rarity: p.rarity,
      heroId: p.heroId,
    } satisfies LevelPassiveDef,
  ]),
);

export const LEVEL_PASSIVES: Record<LevelPassiveId, LevelPassiveDef> = {
  ...BASE_PASSIVES,
  ...HERO_AS_LEVEL,
} as Record<LevelPassiveId, LevelPassiveDef>;

export const LEVEL_PASSIVE_LIST: LevelPassiveDef[] = Object.values(LEVEL_PASSIVES);

export const BASE_LEVEL_PASSIVE_LIST: LevelPassiveDef[] = Object.values(BASE_PASSIVES);

/** XP required to go from `level` → `level + 1` (level starts at 1). */
export function xpToNextLevel(level: number): number {
  if (level <= 1) return 40;
  if (level === 2) return 70;
  if (level === 3) return 110;
  if (level === 4) return 160;
  if (level === 5) return 220;
  return Math.floor(220 + (level - 5) * 80 + (level - 5) * (level - 5) * 12);
}

function weightedPick(
  pool: LevelPassiveDef[],
  count: number,
): LevelPassiveId[] {
  const available = [...pool];
  const out: LevelPassiveId[] = [];
  for (let n = 0; n < count && available.length > 0; n++) {
    let total = 0;
    for (const d of available) total += perkDraftWeight(d.rarity);
    let roll = Math.random() * total;
    let idx = 0;
    for (; idx < available.length; idx++) {
      roll -= perkDraftWeight(available[idx]!.rarity);
      if (roll <= 0) break;
    }
    idx = Math.min(idx, available.length - 1);
    const pick = available.splice(idx, 1)[0]!;
    out.push(pick.id);
  }
  return out;
}

/**
 * Draft level passives for a hero. Global bonuses (any rarity without heroId)
 * are always eligible; hero-specific bonuses only for the matching hero.
 */
export function draftLevelPassives(
  count = 3,
  heroId?: HeroId,
  contentFilters?: GameTypeContentFilters | null,
): LevelPassiveId[] {
  const pool: LevelPassiveDef[] = [...BASE_LEVEL_PASSIVE_LIST].filter((p) =>
    isIdEnabled(contentFilters, "bonuses", p.id),
  );
  if (heroId) {
    for (const p of HERO_PERK_DEFS) {
      if (p.heroId === heroId && isIdEnabled(contentFilters, "bonuses", p.id)) {
        pool.push(LEVEL_PASSIVES[p.id as LevelPassiveId]!);
      }
    }
  }
  if (!pool.length) return [];
  return weightedPick(pool, count);
}

/** Base XP granted on kill before luck/relic modifiers. */
export function killXpForEnemy(goldReward: number, kindWeight = 1): number {
  return Math.max(4, Math.round(goldReward * 1.4 * kindWeight));
}

export function levelPassiveRarity(id: LevelPassiveId): Rarity {
  return LEVEL_PASSIVES[id]?.rarity ?? "common";
}

export { isHeroPerkId, HERO_PERKS };
