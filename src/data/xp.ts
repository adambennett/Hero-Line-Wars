/** Hero XP curve and level-up passive drafts. */

export type LevelPassiveId =
  | "vitality"
  | "might"
  | "haste"
  | "luck"
  | "fury"
  | "fortune";

export type LevelPassiveDef = {
  id: LevelPassiveId;
  name: string;
  blurb: string;
  tag: string;
};

export const LEVEL_PASSIVES: Record<LevelPassiveId, LevelPassiveDef> = {
  vitality: {
    id: "vitality",
    name: "Vital Surge",
    blurb: "+30 max HP and heal 30.",
    tag: "Survive",
  },
  might: {
    id: "might",
    name: "Hardened Edge",
    blurb: "+6 attack damage.",
    tag: "Offense",
  },
  haste: {
    id: "haste",
    name: "Quickstep",
    blurb: "+35 move speed.",
    tag: "Mobility",
  },
  luck: {
    id: "luck",
    name: "Lucky Strike",
    blurb: "+8% crit chance (×1.75 damage).",
    tag: "Luck",
  },
  fury: {
    id: "fury",
    name: "Battle Tempo",
    blurb: "Attacks 10% faster.",
    tag: "Attack",
  },
  fortune: {
    id: "fortune",
    name: "Coin Glint",
    blurb: "+0.35 gold/sec income.",
    tag: "Economy",
  },
};

export const LEVEL_PASSIVE_LIST: LevelPassiveDef[] = Object.values(LEVEL_PASSIVES);

/** XP required to go from `level` → `level + 1` (level starts at 1). */
export function xpToNextLevel(level: number): number {
  // Early levels quick, then steeper.
  if (level <= 1) return 40;
  if (level === 2) return 70;
  if (level === 3) return 110;
  if (level === 4) return 160;
  if (level === 5) return 220;
  return Math.floor(220 + (level - 5) * 80 + (level - 5) * (level - 5) * 12);
}

export function draftLevelPassives(count = 3): LevelPassiveId[] {
  const pool = LEVEL_PASSIVE_LIST.map((p) => p.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count);
}

/** Base XP granted on kill before luck/relic modifiers. */
export function killXpForEnemy(goldReward: number, kindWeight = 1): number {
  return Math.max(4, Math.round(goldReward * 1.4 * kindWeight));
}
