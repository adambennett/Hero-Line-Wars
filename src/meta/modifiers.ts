/**
 * Compose run modifiers from Ascension + Barracks ranks.
 */

import { MAX_ASCENSION } from "./ascension";
import type { MetaUpgradeId } from "./upgrades";

export type StartingRelicTier = "none" | "common" | "uncommon" | "rare";

export type RunModifiers = {
  ascension: number;
  enemyHpMul: number;
  eliteBossHpExtra: number;
  enemyDamageMul: number;
  enemySpeedMul: number;
  enemyCountMul: number;
  incomeMul: number;
  /** Flat income/sec from Supply Lines (player meta). */
  incomeFlat: number;
  startingGoldDelta: number;
  baseHpMul: number;
  waveBreakMul: number;
  shopPriceMul: number;
  respawnMul: number;
  goldRewardMul: number;
  opponentAggressionMul: number;
  maxTurretsBonus: number;
  startingLevelDrafts: number;
  startingRelic: StartingRelicTier;
  applyPlayerMeta: boolean;
};

export type MetaRanks = Partial<Record<MetaUpgradeId, number>>;

function rank(ranks: MetaRanks, id: MetaUpgradeId): number {
  return ranks[id] ?? 0;
}

export function composeRunModifiers(
  ascension: number,
  ranks: MetaRanks,
  applyPlayerMeta: boolean,
): RunModifiers {
  const a = Math.max(0, Math.min(MAX_ASCENSION, Math.floor(ascension)));
  const mods: RunModifiers = {
    ascension: a,
    enemyHpMul: 1,
    eliteBossHpExtra: 1,
    enemyDamageMul: 1,
    enemySpeedMul: 1,
    enemyCountMul: 1,
    incomeMul: 1,
    incomeFlat: 0,
    startingGoldDelta: 0,
    baseHpMul: 1,
    waveBreakMul: 1,
    shopPriceMul: 1,
    respawnMul: 1,
    goldRewardMul: 1,
    opponentAggressionMul: 1,
    maxTurretsBonus: 0,
    startingLevelDrafts: 0,
    startingRelic: "none",
    applyPlayerMeta,
  };

  if (a >= 1) mods.enemyHpMul *= 1.12;
  if (a >= 2) mods.startingGoldDelta -= 12;
  if (a >= 3) mods.enemyDamageMul *= 1.12;
  if (a >= 4) mods.waveBreakMul *= 0.8;
  if (a >= 5) mods.enemyCountMul *= 1.15;
  if (a >= 6) mods.incomeMul *= 0.88;
  if (a >= 7) mods.opponentAggressionMul *= 1.45;
  if (a >= 8) mods.shopPriceMul *= 1.12;
  if (a >= 9) mods.eliteBossHpExtra *= 1.2;
  if (a >= 10) mods.respawnMul *= 1.2;
  if (a >= 11) mods.goldRewardMul *= 0.85;
  if (a >= 12) mods.enemySpeedMul *= 1.08;

  if (applyPlayerMeta) {
    mods.startingGoldDelta += rank(ranks, "war_chest") * 8;
    mods.incomeFlat = rank(ranks, "supply_lines") * 0.3;
    mods.baseHpMul *= 1 + rank(ranks, "fortified_keep") * 0.08;
    mods.respawnMul *= Math.max(0.55, 1 - rank(ranks, "field_medic") * 0.08);
    mods.shopPriceMul *= Math.max(0.7, 1 - rank(ranks, "quartermaster") * 0.05);
    mods.maxTurretsBonus += rank(ranks, "turret_permit");
    mods.startingLevelDrafts += rank(ranks, "drill_yard");
    const sn = rank(ranks, "scout_network");
    if (sn >= 3) mods.startingRelic = "rare";
    else if (sn >= 2) mods.startingRelic = "uncommon";
    else if (sn >= 1) mods.startingRelic = "common";
  }

  return mods;
}

export function defaultModifiers(): RunModifiers {
  return composeRunModifiers(0, {}, true);
}
