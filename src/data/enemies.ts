/** Enemy archetypes — distinct move/attack/targeting for readability. */

import type { GameTypeContentFilters } from "../meta/contentFilters";
import { isIdEnabled } from "../meta/contentFilters";

export type EnemyKind =
  | "grunt"
  | "hunter"
  | "berserker"
  | "archer"
  | "brute"
  | "sapper"
  | "sniper"
  | "mortar"
  | "sharder"
  | "hexer"
  | "charger"
  | "elite"
  | "boss"
  | "wraith"
  | "juggernaut"
  | "hexlord"
  | "colossus"
  | "siren"
  | "reaver"
  | "pusher"
  | "knocker"
  | "ironclad"
  | "aegis_drone"
  | "bulwark_boss"
  | "ward_boss"
  | "aegis_colossus";

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
  projectileRadius?: number;
  projectileColor?: string;
  /** Mortar / bomb shells explode for this AoE radius. */
  projectileAoe?: number;
  /** Fire a fan of N projectiles (sharder). */
  projectileCount?: number;
  /** Half-angle spread in radians for multi-shot. */
  projectileSpread?: number;
  /** Shell fuse time (mortar); explodes on timeout even if it misses. */
  projectileLife?: number;
  /** Hexer: apply this slow mul to the hero on hit. */
  heroSlowMul?: number;
  heroSlowDuration?: number;
  /** Charger: burst speed when in range. */
  dashSpeed?: number;
  dashRange?: number;
  dashDuration?: number;
  dashCooldown?: number;
  /** Boss/elite telegraphed slam radius. */
  slamRadius?: number;
  slamDamage?: number;
  slamCooldown?: number;
  /** Melee DPS vs turrets when in contact. */
  turretDamage?: number;
  /** Tier for HP scaling / UI. */
  tier?: "normal" | "elite" | "boss";
  /** Starting armor / shield pools. */
  armor?: number;
  shield?: number;
  /** Contact knockback impulse (px/s impulse feel). */
  knockbackForce?: number;
  /** Projectile knockback on hit. */
  projectileKnockback?: number;
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
    contactDamage: 10,
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
    contactDamage: 16,
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
    speed: 115,
    maxHp: 34,
    contactDamage: 22,
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
    maxHp: 26,
    contactDamage: 4,
    baseDamage: 5,
    goldReward: 6,
    ranged: true,
    attackRange: 160,
    attackCooldown: 1.05,
    attackDamage: 18,
    projectileSpeed: 320,
    projectileRadius: 4,
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
    contactDamage: 16,
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
    contactDamage: 9,
    baseDamage: 8,
    goldReward: 8,
    turretDamage: 28,
  },
  sniper: {
    kind: "sniper",
    name: "Sniper",
    intent: "hero",
    shape: "triangle",
    color: "#2a6a8a",
    stroke: "#7ec8ff",
    radius: 9,
    speed: 42,
    maxHp: 28,
    contactDamage: 3,
    baseDamage: 5,
    goldReward: 10,
    ranged: true,
    attackRange: 300,
    attackCooldown: 2.0,
    attackDamage: 42,
    projectileSpeed: 580,
    projectileRadius: 3.5,
    projectileColor: "#9ae0ff",
    turretDamage: 5,
  },
  mortar: {
    kind: "mortar",
    name: "Mortar",
    intent: "hero",
    shape: "square",
    color: "#8a5030",
    stroke: "#ffb070",
    radius: 14,
    speed: 36,
    maxHp: 58,
    contactDamage: 6,
    baseDamage: 12,
    goldReward: 11,
    ranged: true,
    attackRange: 250,
    attackCooldown: 2.5,
    attackDamage: 30,
    projectileSpeed: 150,
    projectileRadius: 8,
    projectileColor: "#ff9060",
    projectileAoe: 88,
    projectileLife: 1.6,
    turretDamage: 10,
  },
  sharder: {
    kind: "sharder",
    name: "Sharder",
    intent: "hero",
    shape: "star",
    color: "#7a3ab0",
    stroke: "#d8a0ff",
    radius: 11,
    speed: 62,
    maxHp: 36,
    contactDamage: 5,
    baseDamage: 7,
    goldReward: 9,
    ranged: true,
    attackRange: 155,
    attackCooldown: 1.55,
    attackDamage: 12,
    projectileSpeed: 280,
    projectileRadius: 3.5,
    projectileColor: "#e0b0ff",
    projectileCount: 5,
    projectileSpread: 0.58,
    turretDamage: 7,
  },
  hexer: {
    kind: "hexer",
    name: "Hexer",
    intent: "hero",
    shape: "hex",
    color: "#3a8a5a",
    stroke: "#80ffb0",
    radius: 12,
    speed: 50,
    maxHp: 40,
    contactDamage: 4,
    baseDamage: 6,
    goldReward: 10,
    ranged: true,
    attackRange: 175,
    attackCooldown: 1.75,
    attackDamage: 16,
    projectileSpeed: 210,
    projectileRadius: 6.5,
    projectileColor: "#60e090",
    heroSlowMul: 0.38,
    heroSlowDuration: 2.4,
    turretDamage: 6,
  },
  charger: {
    kind: "charger",
    name: "Charger",
    intent: "hero",
    shape: "diamond",
    color: "#c03030",
    stroke: "#ff8080",
    radius: 13,
    speed: 72,
    maxHp: 44,
    contactDamage: 30,
    baseDamage: 10,
    goldReward: 9,
    dashSpeed: 290,
    dashRange: 160,
    dashDuration: 0.38,
    dashCooldown: 2.5,
    turretDamage: 14,
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
    contactDamage: 20,
    baseDamage: 22,
    goldReward: 22,
    slamRadius: 70,
    slamDamage: 32,
    slamCooldown: 3.2,
    turretDamage: 22,
    tier: "elite",
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
    contactDamage: 28,
    baseDamage: 40,
    goldReward: 60,
    slamRadius: 95,
    slamDamage: 50,
    slamCooldown: 2.6,
    turretDamage: 30,
    tier: "boss",
  },
  wraith: {
    kind: "wraith",
    name: "Phase Wraith",
    intent: "hero",
    shape: "diamond",
    color: "#6a8ad4",
    stroke: "#c0d8ff",
    radius: 16,
    speed: 105,
    maxHp: 140,
    contactDamage: 14,
    baseDamage: 16,
    goldReward: 24,
    dashSpeed: 320,
    dashRange: 200,
    dashDuration: 0.32,
    dashCooldown: 2.2,
    turretDamage: 14,
    tier: "elite",
  },
  juggernaut: {
    kind: "juggernaut",
    name: "Iron Juggernaut",
    intent: "base",
    shape: "square",
    color: "#6a7078",
    stroke: "#c0c8d0",
    radius: 22,
    speed: 42,
    maxHp: 260,
    contactDamage: 24,
    baseDamage: 28,
    goldReward: 26,
    slamRadius: 85,
    slamDamage: 40,
    slamCooldown: 3.8,
    turretDamage: 30,
    tier: "elite",
  },
  hexlord: {
    kind: "hexlord",
    name: "Hexlord",
    intent: "hero",
    shape: "hex",
    color: "#2a8a6a",
    stroke: "#80ffc0",
    radius: 17,
    speed: 58,
    maxHp: 170,
    contactDamage: 8,
    baseDamage: 14,
    goldReward: 25,
    ranged: true,
    attackRange: 200,
    attackCooldown: 1.4,
    attackDamage: 22,
    projectileSpeed: 240,
    projectileRadius: 7,
    projectileColor: "#60ffb0",
    heroSlowMul: 0.3,
    heroSlowDuration: 2.8,
    turretDamage: 10,
    tier: "elite",
  },
  colossus: {
    kind: "colossus",
    name: "Siege Colossus",
    intent: "base",
    shape: "square",
    color: "#8a6030",
    stroke: "#ffd090",
    radius: 30,
    speed: 38,
    maxHp: 620,
    contactDamage: 32,
    baseDamage: 50,
    goldReward: 70,
    slamRadius: 120,
    slamDamage: 60,
    slamCooldown: 3.0,
    turretDamage: 40,
    tier: "boss",
  },
  siren: {
    kind: "siren",
    name: "Void Siren",
    intent: "hero",
    shape: "star",
    color: "#9030a0",
    stroke: "#e090ff",
    radius: 24,
    speed: 48,
    maxHp: 420,
    contactDamage: 12,
    baseDamage: 30,
    goldReward: 65,
    ranged: true,
    attackRange: 260,
    attackCooldown: 1.6,
    attackDamage: 28,
    projectileSpeed: 200,
    projectileRadius: 8,
    projectileColor: "#d070ff",
    projectileCount: 3,
    projectileSpread: 0.4,
    heroSlowMul: 0.45,
    heroSlowDuration: 2.0,
    slamRadius: 80,
    slamDamage: 35,
    slamCooldown: 4.0,
    turretDamage: 18,
    tier: "boss",
  },
  reaver: {
    kind: "reaver",
    name: "Blood Reaver",
    intent: "nearest",
    shape: "triangle",
    color: "#a02040",
    stroke: "#ff7090",
    radius: 25,
    speed: 72,
    maxHp: 500,
    contactDamage: 36,
    baseDamage: 35,
    goldReward: 68,
    dashSpeed: 340,
    dashRange: 220,
    dashDuration: 0.4,
    dashCooldown: 2.8,
    slamRadius: 90,
    slamDamage: 45,
    slamCooldown: 3.4,
    turretDamage: 28,
    tier: "boss",
  },
  pusher: {
    kind: "pusher",
    name: "Pusher",
    intent: "hero",
    shape: "diamond",
    color: "#6a8cff",
    stroke: "#b8c8ff",
    radius: 14,
    speed: 78,
    maxHp: 55,
    contactDamage: 4,
    baseDamage: 6,
    goldReward: 7,
    knockbackForce: 220,
    turretDamage: 6,
  },
  knocker: {
    kind: "knocker",
    name: "Knocker",
    intent: "hero",
    shape: "triangle",
    color: "#5aa0e0",
    stroke: "#a8d4ff",
    radius: 12,
    speed: 70,
    maxHp: 42,
    contactDamage: 3,
    baseDamage: 5,
    goldReward: 8,
    ranged: true,
    attackRange: 160,
    attackCooldown: 1.6,
    attackDamage: 7,
    projectileSpeed: 280,
    projectileRadius: 5,
    projectileColor: "#8ec8ff",
    projectileKnockback: 180,
    turretDamage: 5,
  },
  ironclad: {
    kind: "ironclad",
    name: "Ironclad",
    intent: "nearest",
    shape: "square",
    color: "#8a7a5a",
    stroke: "#d4c48a",
    radius: 16,
    speed: 55,
    maxHp: 90,
    contactDamage: 14,
    baseDamage: 12,
    goldReward: 12,
    armor: 55,
    turretDamage: 14,
    tier: "elite",
  },
  aegis_drone: {
    kind: "aegis_drone",
    name: "Aegis Drone",
    intent: "hero",
    shape: "hex",
    color: "#4ec4c8",
    stroke: "#a8fff8",
    radius: 13,
    speed: 88,
    maxHp: 48,
    contactDamage: 10,
    baseDamage: 8,
    goldReward: 11,
    shield: 40,
    turretDamage: 10,
    tier: "elite",
  },
  bulwark_boss: {
    kind: "bulwark_boss",
    name: "Bulwark",
    intent: "base",
    shape: "square",
    color: "#6a5a40",
    stroke: "#e0c878",
    radius: 26,
    speed: 48,
    maxHp: 420,
    contactDamage: 28,
    baseDamage: 30,
    goldReward: 70,
    armor: 120,
    slamRadius: 85,
    slamDamage: 40,
    slamCooldown: 3.6,
    turretDamage: 26,
    tier: "boss",
  },
  ward_boss: {
    kind: "ward_boss",
    name: "Wardlord",
    intent: "hero",
    shape: "hex",
    color: "#2a8a90",
    stroke: "#7ef0e8",
    radius: 24,
    speed: 58,
    maxHp: 360,
    contactDamage: 22,
    baseDamage: 28,
    goldReward: 72,
    shield: 140,
    ranged: true,
    attackRange: 200,
    attackCooldown: 1.4,
    attackDamage: 18,
    projectileSpeed: 320,
    projectileColor: "#6ef0e0",
    turretDamage: 20,
    tier: "boss",
  },
  aegis_colossus: {
    kind: "aegis_colossus",
    name: "Aegis Colossus",
    intent: "nearest",
    shape: "star",
    color: "#4a6080",
    stroke: "#c0e0ff",
    radius: 28,
    speed: 42,
    maxHp: 520,
    contactDamage: 32,
    baseDamage: 36,
    goldReward: 90,
    armor: 90,
    shield: 90,
    slamRadius: 95,
    slamDamage: 48,
    slamCooldown: 3.2,
    turretDamage: 30,
    tier: "boss",
  },
};

export const ENEMY_KINDS = Object.keys(ENEMY_DEFS) as EnemyKind[];

export const ELITE_KINDS: EnemyKind[] = [
  "elite",
  "wraith",
  "juggernaut",
  "hexlord",
  "ironclad",
  "aegis_drone",
];
export const BOSS_KINDS: EnemyKind[] = [
  "boss",
  "colossus",
  "siren",
  "reaver",
  "bulwark_boss",
  "ward_boss",
  "aegis_colossus",
];

export function isEliteKind(kind: EnemyKind): boolean {
  return ENEMY_DEFS[kind].tier === "elite" || ELITE_KINDS.includes(kind);
}

export function isBossKind(kind: EnemyKind): boolean {
  return ENEMY_DEFS[kind].tier === "boss" || BOSS_KINDS.includes(kind);
}

export function pickEliteKind(contentFilters?: GameTypeContentFilters | null): EnemyKind {
  const pool = ELITE_KINDS.filter((k) => isIdEnabled(contentFilters, "enemies", k));
  const src = pool.length ? pool : ELITE_KINDS;
  return src[Math.floor(Math.random() * src.length)]!;
}

export function pickBossKind(contentFilters?: GameTypeContentFilters | null): EnemyKind {
  const pool = BOSS_KINDS.filter((k) => isIdEnabled(contentFilters, "enemies", k));
  const src = pool.length ? pool : BOSS_KINDS;
  return src[Math.floor(Math.random() * src.length)]!;
}

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
    if (wave >= 4 && roll < 0.08) return "knocker";
    if (wave >= 3 && roll < 0.16) return "pusher";
    if (wave >= 4 && roll < 0.24) return "sniper";
    if (wave >= 3 && roll < 0.32) return "mortar";
    if (wave >= 2 && roll < 0.4) return "sharder";
    if (wave >= 2 && roll < 0.48) return "hexer";
    if (wave >= 2 && roll < 0.58) return "charger";
    if (roll < 0.68) return "hunter";
    if (roll < 0.76) return "berserker";
    if (roll < 0.84) return "archer";
    if (roll < 0.9) return "sapper";
    if (roll < 0.95) return "brute";
    return "grunt";
  }

  const roll = Math.random();
  if (wave >= 4 && roll < 0.07) return "knocker";
  if (wave >= 3 && roll < 0.14) return "pusher";
  if (wave >= 5 && roll < 0.22) return "sniper";
  if (wave >= 4 && roll < 0.3) return "mortar";
  if (wave >= 3 && roll < 0.38) return "sharder";
  if (wave >= 3 && roll < 0.46) return "hexer";
  if (wave >= 2 && roll < 0.56) return "charger";
  if (wave >= 3 && roll < 0.63) return "sapper";
  if (wave >= 4 && roll < 0.7) return "brute";
  if (wave >= 2 && roll < 0.78) return "hunter";
  if (wave >= 2 && roll < 0.86) return "berserker";
  if (wave >= 2 && roll < 0.94) return "archer";
  return "grunt";
}
