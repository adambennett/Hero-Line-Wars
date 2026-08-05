/** Shared run-option tooltips + helpers for SP/MP setup panels. */

import { STARTING_GOLD, WIN_WAVES } from "../data/constants";
import { DEFAULT_UTILITY_DRAFT_LEVEL, UTILITY_DRAFT_LEVEL_OPTIONS } from "../data/utilities";
import {
  CHEST_DESPAWN_NEVER,
  CHEST_DESPAWN_POOL,
  CHEST_OPEN_INSTANT,
  CHEST_OPEN_MUL_POOL,
  CREATIVE_OPTION_DEFAULTS,
  CRIT_LOTTERY_MODES,
  DAMAGE_MUL_POOL,
  ENEMY_MUTATION_MODES,
  RELIC_DROP_MODES,
  RESPAWN_MUL_POOL,
  UNIT_SIZE_POOL,
  UNIT_SPEED_POOL,
  WALL_BOUNCE_POOL,
} from "../meta/creativeOptions";

export const RUN_OPTION_TIPS = {
  map: "Lane layout for this run. Random picks among unlocked built-ins (and customs when present).",
  ascension: "Stacked difficulty modifiers. Higher Ascension unlocks over wins.",
  opponentAi: "Rival-lane AI. Classic rules or a trained neural school from AI Lab.",
  mode: "Disables the enemy lane",
  artifacts:
    "Max placeable shop Artifacts. Map default uses that map's slot count; Unlimited ignores the map soft cap.",
  startingGold: "Gold in hand when the run begins.",
  wavesToWin: "Clear this many waves to win. Unlimited fights until a base falls.",
  livesWave:
    "Deaths allowed per wave. After they're spent you wait until the next wave to respawn. Unlimited = no wave limit.",
  livesRun:
    "Deaths allowed for the whole run. At 0 you never respawn; if every ally is out, that side loses. Unlimited = no run limit.",
  utilityDraft:
    "Hero level when you draft the Space utility (or Run Start before combat, or Never).",
  friendlyFire: "Allied heroes can damage each other when On (teams only).",
  chestOpen: "How long you must stand on a chest to open it. Instant skips the channel.",
  chestDespawn: "Seconds before an unopened chest disappears. Never keeps them until opened.",
  chestSpawn: "Chance a chest appears after clearing a wave.",
  enemyDensity: "How many creeps spawn relative to normal.",
  enemyHp: "Enemy hit-point multiplier.",
  enemySpeed: "Enemy move-speed multiplier.",
  income: "Passive gold/sec and related income scaling.",
  respawn: "Hero respawn timer multiplier (lower = faster). 0× = always instant for the whole run.",
  startBase: "Starting base upgrade level (unlocks stronger sends earlier).",
  levelDraft: "How many passive choices appear on level-up.",
  relicDraft: "How many relic choices appear after elite/boss clears.",
  allyAi: "Aggression of AI teammates on your lane.",
  suddenDeath: "If set, bases start at this HP (sudden-death pressure).",
  noArtifacts: "Disable shop Artifacts / turret placement.",
  noChests: "No wave-clear chests.",
  noElites: "No elite enemies.",
  noBosses: "No boss enemies.",
  noShop: "Shop pad purchases disabled.",
  noSends: "Cannot buy send packs.",
  noRelics: "No relic drafts.",
  fogAlways: "Fog of war stays on for the whole run.",
  fogThickness:
    "How black the fog shroud is. 100% blacks out the lane except your vision circle (Flash-style).",
  fogVision: "Size of the clear vision circle around you while fogged.",
  glassCannon: "Heroes deal +50% damage and take +50% damage.",
  goldRush: "Kill gold is doubled.",
  wildChests: "Chest spawn chance is tripled.",
  crampedLane: "Start with a tighter playable area (shape shrinks inward).",
  doubleElites: "Elite spawns are doubled when elites are enabled.",
  playerBaseInvincible:
    "Your base cannot be destroyed. Pair with Lives / run for a survival-style challenge.",
  enemyBaseInvincible: "Enemy / rival bases cannot be destroyed (wave goals only).",
  waveBreak: "Seconds to wait after both lanes clear before the next wave.",
  laneClearSpeed:
    "Move-speed while your lane has no living enemies. 0% = normal; 100% ≈ double; −100% freezes you until the next fight.",
  respawnMinigame:
    "While dead, hit Space in the scrolling precision window to shave respawn time (locked under 1s).",
  sendLocation:
    "Queue bought send packs into your own next wave (income still rises) or into the enemy lane.",
  gameType: "Named ruleset for lives, waves, creative flags, and send location. Edit Gametypes to change.",
  artifactPlacement:
    "Free: next attack click places a bought Artifact at the cursor. Locked: auto-place on map slots only.",
  allowBarracks:
    "Apply Barracks gameplay upgrades (gold, HP, damage, etc.) this match. Unlocks always apply.",
  relicDrop: "When wave-clear relic drafts appear (elites, bosses, every wave, or never).",
  enemyProjectileDmg: "Multiplier on enemy projectile damage vs heroes. Instant Kill is lethal.",
  enemyCollisionDmg: "Multiplier on enemy body-contact / melee DPS vs heroes. Instant Kill is lethal.",
  playerDmgLmb: "Multiplier on player primary (basic attack) damage — default LMB; remappable.",
  playerDmgRmb: "Multiplier on player mobility ability damage — default RMB; remappable.",
  playerDmgMmb: "Multiplier on player ultimate ability damage — default MMB; remappable.",
  wallBounciness:
    "Bounce heroes/enemies off map obstacles/walls (not lane edges). 0× is current no-bounce. Instant Death kills on wall touch.",
  playerSpeed: "Player move-speed multiplier.",
  playerSize: "Player body radius multiplier.",
  enemySize: "Enemy body radius multiplier.",
  critLottery: "Player basic attacks roll critical hits for double damage.",
  enemyMutation: "Mutate spawn stats: speedy / tanky / glass / mixed random per creep.",
  randomizeUtilityWave: "Pick a new Space utility every wave (keeps inventory/relics).",
  doubleAllProjectiles: "Double every projectile spawned (players, enemies, Artifacts).",
  immuneToProjectiles: "Players ignore enemy projectile damage (friendly fire still applies).",
  randomizeHeroWave:
    "Reshuffle your hero kit each wave. Levels, items, relics stay; hero-tied bonuses apply when that hero rolls again.",
  randomizeMapWave: "Swap to a random unlocked map between waves.",
  artifactDamageDoubled: "Shop Artifact weapon damage ×2.",
  artifactsFree: "Shop Artifacts cost 0 gold.",
  itemsFree: "Non-Artifact shop gear costs 0 gold.",
  infiniteRerolls: "Everyone has infinite draft reroll tokens (players + AIs).",
  thornsAura: "Enemies that touch you take damage back.",
  bloodTax: "Each kill deals a little self-damage.",
  echoBarrage: "Basic attacks fire a delayed ghost follow-up shot.",
  pacifistPays: "No kill gold — passive income ×3.",
  berserkerEdge: "Below 35% HP, deal double damage.",
  slipNSlide: "Heroes keep sliding with built-up momentum.",
  vampiricCreeps: "Enemy contact heals the creep slightly.",
  corpseExplosion: "Kills detonate a small damage AoE.",
  bounceHouse: "Player basics always chain-bounce once more.",
} as const;

export type RunOptionTipKey = keyof typeof RUN_OPTION_TIPS;

export function runTip(key: RunOptionTipKey): string {
  return RUN_OPTION_TIPS[key];
}

export function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Lane-clear speed % options (−100 freeze … 0 normal … large boost). */
export const LANE_CLEAR_SPEED_POOL = [
  -100, -50, -25, -20, -10, -5, 0, 5, 10, 15, 25, 50, 75, 100, 150, 200, 250, 300, 500, 1000, 3000,
] as const;

export const RUN_OPTION_DEFAULTS = {
  mapChoice: "random" as const,
  /** -1 = map default slot count; -2 = unlimited. */
  maxTurrets: -1,
  startingGold: STARTING_GOLD,
  wavesToWin: WIN_WAVES,
  livesPerWave: 0,
  livesPerRun: 0,
  utilityDraftLevel: DEFAULT_UTILITY_DRAFT_LEVEL,
  friendlyFire: false,
  ascension: 0,
  teamSize: 1 as const,
  endless: false,
  chestOpenMul: 1,
  chestDespawnSec: 28,
  chestSpawnChance: 0.08,
  enemyDensityMul: 1,
  enemyHpMul: 1,
  enemySpeedMul: 1,
  incomeMul: 1,
  respawnMul: 1,
  startingBaseLevel: 0,
  levelDraftSize: 3,
  relicDraftSize: 3,
  allyAi: 1,
  suddenDeathBaseHp: 0,
  disableArtifacts: false,
  disableChests: false,
  disableElites: false,
  disableBosses: false,
  disableShop: false,
  disableSends: false,
  disableRelics: false,
  fogAlways: false,
  fogThicknessPct: 55,
  fogVisionRadius: 120,
  doubleElites: false,
  glassCannon: false,
  goldRush: false,
  wildChests: false,
  crampedLane: false,
  playerBaseInvincible: false,
  enemyBaseInvincible: false,
  waveBreakSec: 5,
  /** Percent extra move while lane clear (0 = no bonus). */
  laneClearSpeedPct: 0,
  respawnMinigame: true,
  artifactPlacement: "free" as const,
  allowBarracks: false,
  ...CREATIVE_OPTION_DEFAULTS,
};

export const RUN_OPTION_POOLS = {
  maxTurrets: [-1, -2, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const,
  startingGold: [0, 10, 45, 50, 60, 80, 100, 150, 200, 500, 1000] as const,
  wavesToWin: [1, 2, 3, 5, 8, 10, 12, 15, 20, 25, 50, 100, 500, 0] as const,
  livesPerWave: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const,
  livesPerRun: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 50, 100] as const,
  chestOpenMul: CHEST_OPEN_MUL_POOL,
  chestDespawnSec: CHEST_DESPAWN_POOL,
  chestSpawnChance: [0.04, 0.08, 0.12, 0.2] as const,
  enemyDensityMul: [0.75, 1, 1.25, 1.5, 2, 2.5, 3, 5, 10, 25, 50] as const,
  enemyHpMul: [0.75, 1, 1.25, 1.5, 2] as const,
  enemySpeedMul: UNIT_SPEED_POOL,
  incomeMul: [0.75, 1, 1.25, 1.5, 2] as const,
  respawnMul: RESPAWN_MUL_POOL,
  startingBaseLevel: [0, 1, 2, 3, 4] as const,
  levelDraftSize: [2, 3, 4, 5] as const,
  relicDraftSize: [2, 3, 4, 5] as const,
  allyAi: [0.7, 1, 1.4, 1.8] as const,
  suddenDeathBaseHp: [0, 40, 60, 80] as const,
  teamSize: [1, 2, 3] as const,
  utilityDraftLevel: UTILITY_DRAFT_LEVEL_OPTIONS,
  fogThicknessPct: [25, 40, 55, 70, 85, 100] as const,
  fogVisionRadius: [60, 90, 120, 160, 220] as const,
  waveBreakSec: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 45, 60, 120] as const,
  laneClearSpeedPct: LANE_CLEAR_SPEED_POOL,
  damageMul: DAMAGE_MUL_POOL,
  wallBounciness: WALL_BOUNCE_POOL,
  unitSpeed: UNIT_SPEED_POOL,
  unitSize: UNIT_SIZE_POOL,
  relicDrop: RELIC_DROP_MODES,
  critLottery: CRIT_LOTTERY_MODES,
  enemyMutation: ENEMY_MUTATION_MODES,
};

// Re-export specials for callers
export { CHEST_DESPAWN_NEVER, CHEST_OPEN_INSTANT };
