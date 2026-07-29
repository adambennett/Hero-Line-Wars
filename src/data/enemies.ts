/** Enemy archetypes — distinct move/attack/targeting for readability. */

export type EnemyKind =
  | "grunt"
  | "hunter"
  | "berserker"
  | "archer"
  | "brute"
  | "sapper"
  | "elite"
  | "boss";

/**
 * Who the unit prioritizes while moving / attacking.
 * - ignore_turrets: never path to turrets (treat as base/hero only)
 * - turret: prioritize living turrets
 * - nearest: hero / base / turret by proximity
 */
export type EnemyIntent = "base" | "hero" | "nearest" | "turret" | "ignore_turrets";

export type EnemyShape = "circle" | "diamond" | "triangle" | "square" | "hex" | "star";

export type EnemyDef = {
  kind: EnemyKind;
  name: string;
  intent: EnemyIntent;
  shape: EnemyShape;
  color: string;
  stroke: string;
  radius: number;
  speed: number;
  maxHp: number;
  /** DPS while overlapping the hero. */
  contactDamage: number;
  /** Flat damage dealt to the base on contact (unit dies). */
  baseDamage: number;
  goldReward: number;
  ranged?: boolean;
  attackRange?: number;
  attackCooldown?: number;
  attackDamage?: number;
  projectileSpeed?: number;
  /** Boss/elite telegraphed slam radius. */
  slamRadius?: number;
  slamDamage?: number;
  slamCooldown?: number;
  /** Melee DPS vs turrets when in contact. */
  turretDamage?: number;
};

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  grunt: {
    kind: "grunt",
    name: "Grunt",
    intent: "ignore_turrets",
    shape: "circle",
    color: "#c44b4b",
    stroke: "#ff9a9a",
    radius: 12,
    speed: 72,
    maxHp: 38,
    contactDamage: 8,
    baseDamage: 10,
    goldReward: 5,
    turretDamage: 10,
  },
  hunter: {
    kind: "hunter",
    name: "Hunter",
    intent: "hero",
    shape: "triangle",
    color: "#d4782a",
    stroke: "#ffc078",
    radius: 11,
    speed: 95,
    maxHp: 30,
    contactDamage: 11,
    baseDamage: 6,
    goldReward: 6,
    turretDamage: 8,
  },
  berserker: {
    kind: "berserker",
    name: "Berserker",
    intent: "nearest",
    shape: "diamond",
    color: "#c43a6e",
    stroke: "#ff8ab8",
    radius: 13,
    speed: 110,
    maxHp: 34,
    contactDamage: 14,
    baseDamage: 8,
    goldReward: 7,
    turretDamage: 16,
  },
  archer: {
    kind: "archer",
    name: "Archer",
    intent: "hero",
    shape: "diamond",
    color: "#5a8fd4",
    stroke: "#a8c8ff",
    radius: 10,
    speed: 58,
    maxHp: 24,
    contactDamage: 3,
    baseDamage: 5,
    goldReward: 6,
    ranged: true,
    attackRange: 150,
    attackCooldown: 1.35,
    attackDamage: 9,
    projectileSpeed: 280,
    turretDamage: 6,
  },
  brute: {
    kind: "brute",
    name: "Brute",
    intent: "base",
    shape: "square",
    color: "#6a4a3a",
    stroke: "#c8a070",
    radius: 16,
    speed: 48,
    maxHp: 75,
    contactDamage: 12,
    baseDamage: 16,
    goldReward: 9,
    turretDamage: 18,
  },
  sapper: {
    kind: "sapper",
    name: "Sapper",
    intent: "turret",
    shape: "star",
    color: "#8a6a20",
    stroke: "#ffe080",
    radius: 11,
    speed: 88,
    maxHp: 32,
    contactDamage: 7,
    baseDamage: 8,
    goldReward: 8,
    turretDamage: 28,
  },
  elite: {
    kind: "elite",
    name: "Elite Champion",
    intent: "nearest",
    shape: "hex",
    color: "#a34bd4",
    stroke: "#e0a0ff",
    radius: 18,
    speed: 78,
    maxHp: 185,
    contactDamage: 16,
    baseDamage: 22,
    goldReward: 22,
    slamRadius: 70,
    slamDamage: 28,
    slamCooldown: 3.2,
    turretDamage: 22,
  },
  boss: {
    kind: "boss",
    name: "Lane Tyrant",
    intent: "hero",
    shape: "hex",
    color: "#ff3a3a",
    stroke: "#ffd0a0",
    radius: 26,
    speed: 55,
    maxHp: 480,
    contactDamage: 22,
    baseDamage: 40,
    goldReward: 60,
    slamRadius: 95,
    slamDamage: 45,
    slamCooldown: 2.6,
    turretDamage: 30,
  },
};

export type WaveTier = "normal" | "elite" | "boss";

/** Wave 3 elite, wave 5 boss; then every 3rd elite, every 5th boss (boss wins ties). */
export function waveTier(wave: number): WaveTier {
  if (wave <= 0) return "normal";
  if (wave % 5 === 0) return "boss";
  if (wave % 3 === 0) return "elite";
  return "normal";
}

export function waveTierLabel(tier: WaveTier): string {
  if (tier === "boss") return "BOSS WAVE";
  if (tier === "elite") return "ELITE WAVE";
  return "";
}

/** Composition weights for a normal wave (scaled by wave number). */
export function pickEnemyKind(wave: number, sent: boolean): EnemyKind {
  if (sent) {
    const roll = Math.random();
    if (roll < 0.28) return "hunter";
    if (roll < 0.45) return "berserker";
    if (roll < 0.58) return "archer";
    if (roll < 0.7) return "sapper";
    if (roll < 0.82) return "brute";
    return "grunt";
  }

  const roll = Math.random();
  if (wave >= 3 && roll < 0.1) return "sapper";
  if (wave >= 4 && roll < 0.22) return "brute";
  if (wave >= 2 && roll < 0.36) return "hunter";
  if (wave >= 2 && roll < 0.48) return "berserker";
  if (wave >= 3 && roll < 0.6) return "archer";
  return "grunt";
}
