export type SendPackId =
  | "scout"
  | "raider"
  | "assault"
  | "vanguard"
  | "siege"
  | "tyrant";

export type SendPackDef = {
  id: SendPackId;
  name: string;
  /** Hotkey Digit1–6 when unlocked (UI shows digit; locked packs hidden). */
  digit: 1 | 2 | 3 | 4 | 5 | 6;
  cost: number;
  /** Minimum base level required to unlock. */
  minBaseLevel: number;
  /** Extra creeps added to the next wave. */
  enemies: number;
  /** Flat income boost after purchase. */
  incomeBonus: number;
  /** HP multiplier applied to sent creeps only. */
  hpScale: number;
  blurb: string;
  /** Longer tooltip for UI / compendium. */
  detail: string;
};

/** Classic loop: pay gold → harden next wave → raise income. Higher packs unlock via base upgrades. */
export const SEND_PACKS: SendPackDef[] = [
  {
    id: "scout",
    name: "Scout Pack",
    digit: 1,
    cost: 25,
    minBaseLevel: 0,
    enemies: 1,
    incomeBonus: 0.35,
    hpScale: 1,
    blurb: "+1 next wave · +0.35/s",
    detail: "Sends 1 light creep. Cheap income bump. Scales with base upgrades.",
  },
  {
    id: "raider",
    name: "Raider Pack",
    digit: 2,
    cost: 55,
    minBaseLevel: 0,
    enemies: 2,
    incomeBonus: 0.7,
    hpScale: 1.1,
    blurb: "+2 next wave · +0.7/s",
    detail: "Sends 2 hunters-weighted creeps with slight HP bump.",
  },
  {
    id: "assault",
    name: "Assault Pack",
    digit: 3,
    cost: 95,
    minBaseLevel: 1,
    enemies: 4,
    incomeBonus: 1.25,
    hpScale: 1.25,
    blurb: "+4 next wave · +1.25/s",
    detail: "Mid pack — unlocks at Base Lv 1. Solid income + pressure.",
  },
  {
    id: "vanguard",
    name: "Vanguard Pack",
    digit: 4,
    cost: 140,
    minBaseLevel: 2,
    enemies: 5,
    incomeBonus: 1.7,
    hpScale: 1.4,
    blurb: "+5 tough creeps · +1.7/s",
    detail: "Unlocks at Base Lv 2. Tougher sent creeps.",
  },
  {
    id: "siege",
    name: "Siege Pack",
    digit: 5,
    cost: 200,
    minBaseLevel: 3,
    enemies: 6,
    incomeBonus: 2.2,
    hpScale: 1.65,
    blurb: "+6 brutes-weighted · +2.2/s",
    detail: "Unlocks at Base Lv 3. Heavy HP scale — siege pressure.",
  },
  {
    id: "tyrant",
    name: "Tyrant Pack",
    digit: 6,
    cost: 280,
    minBaseLevel: 4,
    enemies: 8,
    incomeBonus: 3,
    hpScale: 1.9,
    blurb: "+8 elite pressure · +3/s",
    detail: "Unlocks at Base Lv 4. Keeps scaling with further base upgrades — no max level.",
  },
];

/** Packs visible/buyable at the player's current base level (plus scale from upgrades). */
export function unlockedSendPacks(baseLevel: number): SendPackDef[] {
  return SEND_PACKS.filter((p) => p.minBaseLevel <= baseLevel);
}

/** Extra HP scale on all sends from base level (and relics applied separately). */
export function baseLevelSendHpBonus(baseLevel: number): number {
  return 1 + baseLevel * 0.08;
}

/**
 * Upgrading the base strengthens already-unlocked packs:
 * +12% cost, +8% income, +6% HP per base level above the pack's unlock.
 * Past Base Lv 4 the final packs keep scaling (slightly faster).
 */
export function baseUpgradePackMul(baseLevel: number, pack: SendPackDef): {
  costMul: number;
  incomeMul: number;
  hpMul: number;
} {
  const steps = Math.max(0, baseLevel - pack.minBaseLevel);
  const late = Math.max(0, baseLevel - 4);
  return {
    costMul: 1 + steps * 0.12 + late * 0.04,
    incomeMul: 1 + steps * 0.08 + late * 0.05,
    hpMul: 1 + steps * 0.06 + late * 0.04,
  };
}
