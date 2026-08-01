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

export type BaseLevelPassiveId =
  | "vitality"
  | "might"
  | "haste"
  | "luck"
  | "fury"
  | "fortune";

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
 * Draft level passives for a hero. Base commons are always eligible;
 * hero-specific bonuses only appear for the matching hero and are rare.
 */
export function draftLevelPassives(count = 3, heroId?: HeroId): LevelPassiveId[] {
  const pool: LevelPassiveDef[] = [...BASE_LEVEL_PASSIVE_LIST];
  if (heroId) {
    for (const p of HERO_PERK_DEFS) {
      if (p.heroId === heroId) pool.push(LEVEL_PASSIVES[p.id as LevelPassiveId]!);
    }
  }
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
