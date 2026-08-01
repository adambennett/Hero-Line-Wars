/** Shared run-option tooltips + helpers for SP/MP setup panels. */

import { DEFAULT_MAX_TURRETS } from "../data/turrets";
import { STARTING_GOLD, WIN_WAVES } from "../data/constants";
import { DEFAULT_UTILITY_DRAFT_LEVEL, UTILITY_DRAFT_LEVEL_OPTIONS } from "../data/utilities";

export const RUN_OPTION_TIPS = {
  map: "Lane layout for this run. Random picks among unlocked built-ins (and customs when present).",
  ascension: "Stacked difficulty modifiers. Higher Ascension unlocks over wins.",
  opponentAi: "Rival-lane AI. Classic rules or a trained neural school from AI Lab.",
  mode: "1v1 classic, team sizes with AI allies, or Endless solo survival (no rival lane).",
  artifacts: "Max placeable shop Artifacts (turrets) near your base this run.",
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
  doubleElites: "Elite spawns are doubled when elites are enabled.",
} as const;

export type RunOptionTipKey = keyof typeof RUN_OPTION_TIPS;

export function runTip(key: RunOptionTipKey): string {
  return RUN_OPTION_TIPS[key];
}

export function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export const RUN_OPTION_DEFAULTS = {
  mapChoice: "random" as const,
  maxTurrets: DEFAULT_MAX_TURRETS,
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
  doubleElites: false,
};

export const RUN_OPTION_POOLS = {
  maxTurrets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const,
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
};
