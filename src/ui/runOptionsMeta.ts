/** Shared run-option tooltips + helpers for SP/MP setup panels. */

import { STARTING_GOLD, WIN_WAVES } from "../data/constants";
import { DEFAULT_UTILITY_DRAFT_LEVEL, UTILITY_DRAFT_LEVEL_OPTIONS } from "../data/utilities";

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
  chestOpen: "How long you must stand on a chest to open it.",
  chestDespawn: "Seconds before an unopened chest disappears.",
  chestSpawn: "Chance a chest appears after clearing a wave.",
  enemyDensity: "How many creeps spawn relative to normal.",
  enemyHp: "Enemy hit-point multiplier.",
  enemySpeed: "Enemy move-speed multiplier.",
  income: "Passive gold/sec and related income scaling.",
  respawn: "Hero respawn timer multiplier (lower = faster return).",
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
};

export const RUN_OPTION_POOLS = {
  maxTurrets: [-1, -2, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const,
  startingGold: [0, 10, 45, 50, 60, 80, 100, 150, 200, 500, 1000] as const,
  wavesToWin: [1, 2, 3, 5, 8, 10, 12, 15, 20, 25, 50, 100, 500, 0] as const,
  livesPerWave: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const,
  livesPerRun: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 50, 100] as const,
  chestOpenMul: [0.75, 1, 1.25, 1.5, 2] as const,
  chestDespawnSec: [12, 20, 28, 40, 60] as const,
  chestSpawnChance: [0.04, 0.08, 0.12, 0.2] as const,
  enemyDensityMul: [0.75, 1, 1.25, 1.5, 2] as const,
  enemyHpMul: [0.75, 1, 1.25, 1.5, 2] as const,
  enemySpeedMul: [0.8, 1, 1.15, 1.3] as const,
  incomeMul: [0.75, 1, 1.25, 1.5, 2] as const,
  respawnMul: [0.5, 0.75, 1, 1.25, 1.5] as const,
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
};
