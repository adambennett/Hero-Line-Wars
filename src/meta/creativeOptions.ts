/**
 * Creative run option enums, multipliers, and shared damage/size ladders.
 * Used by Game Types, RunOptions, and combat systems.
 */

/** Sentinel for Instant Kill / Instant Death in select ladders. */
export const MUL_INSTANT = -1;

/** Chest despawn: never auto-remove. */
export const CHEST_DESPAWN_NEVER = -1;
/** Chest open: stand-time 0 = instant open. */
export const CHEST_OPEN_INSTANT = 0;

export type RelicDropMode =
  | "elites_bosses"
  | "bosses_only"
  | "elites_only"
  | "every_wave"
  | "never";

export type CritLotteryMode = "off" | "ten" | "twentyfive" | "fifty" | "always";
export type EnemyMutationMode = "none" | "speedy" | "tanky" | "glass" | "mixed";

/** Shared × multiplier ladder + Instant Kill (-1). */
export const DAMAGE_MUL_POOL = [
  0.1, 0.25, 0.5, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, MUL_INSTANT,
] as const;

export const WALL_BOUNCE_POOL = [
  0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 5, 10, 20, 50, MUL_INSTANT,
] as const;

export const UNIT_SPEED_POOL = [
  0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 100, 200, 500, 1000,
] as const;

/** Hard ceiling on player/enemy size — bigger than this wedges units into map geometry. */
export const MAX_UNIT_SIZE_MUL = 5;

export const UNIT_SIZE_POOL = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, MAX_UNIT_SIZE_MUL] as const;

/** Keep legacy / imported size multipliers inside the supported ladder. */
export function clampUnitSize(n: number, fb: number): number {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return fb;
  return Math.min(n, MAX_UNIT_SIZE_MUL);
}

export const RESPAWN_MUL_POOL = [0, 0.5, 0.75, 1, 1.25, 1.5] as const;

export const CHEST_OPEN_MUL_POOL = [CHEST_OPEN_INSTANT, 0.75, 1, 1.25, 1.5, 2] as const;

export const CHEST_DESPAWN_POOL = [12, 20, 28, 40, 60, CHEST_DESPAWN_NEVER] as const;

export const RELIC_DROP_MODES: RelicDropMode[] = [
  "elites_bosses",
  "bosses_only",
  "elites_only",
  "every_wave",
  "never",
];

export const CRIT_LOTTERY_MODES: CritLotteryMode[] = [
  "off",
  "ten",
  "twentyfive",
  "fifty",
  "always",
];

export const ENEMY_MUTATION_MODES: EnemyMutationMode[] = [
  "none",
  "speedy",
  "tanky",
  "glass",
  "mixed",
];

export function formatMul(n: number, instantLabel = "Instant Kill"): string {
  if (n === MUL_INSTANT) return instantLabel;
  if (n === 0) return "0×";
  const s = Number.isInteger(n) ? String(n) : String(n);
  return `${s}×`;
}

export function formatRespawnMul(n: number): string {
  if (n === 0) return "0× (always instant)";
  return formatMul(n);
}

export function formatChestOpen(n: number): string {
  if (n === CHEST_OPEN_INSTANT) return "Instant";
  return `${n}× open time`;
}

export function formatChestDespawn(n: number): string {
  if (n === CHEST_DESPAWN_NEVER) return "Never";
  return `${n}s despawn`;
}

export function formatRelicDrop(m: RelicDropMode): string {
  switch (m) {
    case "elites_bosses":
      return "Elites & bosses";
    case "bosses_only":
      return "Only bosses";
    case "elites_only":
      return "Only elites";
    case "every_wave":
      return "Every wave";
    case "never":
      return "Never";
  }
}

export function formatCritLottery(m: CritLotteryMode): string {
  switch (m) {
    case "off":
      return "Off";
    case "ten":
      return "10%";
    case "twentyfive":
      return "25%";
    case "fifty":
      return "50%";
    case "always":
      return "Always";
  }
}

export function formatEnemyMutation(m: EnemyMutationMode): string {
  switch (m) {
    case "none":
      return "None";
    case "speedy":
      return "Speedy";
    case "tanky":
      return "Tanky";
    case "glass":
      return "Glass";
    case "mixed":
      return "Mixed bag";
  }
}

export function critChance(mode: CritLotteryMode): number {
  switch (mode) {
    case "off":
      return 0;
    case "ten":
      return 0.1;
    case "twentyfive":
      return 0.25;
    case "fifty":
      return 0.5;
    case "always":
      return 1;
  }
}

/** Scale a damage number by a creative mul; Instant Kill (−1) is lethal. */
export function scaleDamage(base: number, mul: number): number {
  if (mul === MUL_INSTANT) return Math.max(base, 1) * 1e7;
  if (!Number.isFinite(mul) || mul <= 0) return 0;
  return base * mul;
}

export function isInstantMul(mul: number): boolean {
  return mul === MUL_INSTANT;
}

/** Defaults for all creative extras (merged into RUN_OPTION_DEFAULTS). */
export const CREATIVE_OPTION_DEFAULTS = {
  relicDrop: "elites_bosses" as RelicDropMode,
  enemyProjectileDmgMul: 1,
  enemyCollisionDmgMul: 1,
  playerDmgLmbMul: 1,
  playerDmgRmbMul: 1,
  playerDmgMmbMul: 1,
  wallBounciness: 0,
  playerSpeedMul: 1,
  playerSizeMul: 1,
  enemySizeMul: 1,
  // Expanded enemy speed defaults still 1; pool expanded separately.
  // Creative dropdowns
  critLottery: "off" as CritLotteryMode,
  enemyMutation: "none" as EnemyMutationMode,
  // User toggles
  randomizeUtilityWave: false,
  doubleAllProjectiles: false,
  immuneToProjectiles: false,
  randomizeHeroWave: false,
  randomizeMapWave: false,
  artifactDamageDoubled: false,
  artifactsFree: false,
  itemsFree: false,
  infiniteRerolls: false,
  // Invented spicy toggles (9)
  thornsAura: false,
  bloodTax: false,
  echoBarrage: false,
  pacifistPays: false,
  berserkerEdge: false,
  slipNSlide: false,
  vampiricCreeps: false,
  corpseExplosion: false,
  bounceHouse: false,
};

export type CreativeOptionDefaults = typeof CREATIVE_OPTION_DEFAULTS;
