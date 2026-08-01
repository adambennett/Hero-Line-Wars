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
  /** Multiplier on War Crest payout. */
  crestGainMul: number;
  sendCostMul: number;
  sendIncomeMetaMul: number;
  startingDamageFlat: number;
  startingHpFlat: number;
  attackSpeedMetaMul: number;
  baseDamageTakenMetaMul: number;
  /** Multiplier on chest spawn chance (Ascension 13). */
  chestSpawnMul: number;
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
    crestGainMul: 1,
    sendCostMul: 1,
    sendIncomeMetaMul: 1,
    startingDamageFlat: 0,
    startingHpFlat: 0,
    attackSpeedMetaMul: 1,
    baseDamageTakenMetaMul: 1,
    chestSpawnMul: 1,
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
  if (a >= 13) mods.chestSpawnMul *= 0.7;
  if (a >= 14) mods.baseHpMul *= 0.85;
  if (a >= 15) {
    mods.enemyDamageMul *= 1.1;
    mods.eliteBossHpExtra *= 1.1;
  }

  if (applyPlayerMeta) {
    mods.startingGoldDelta += rank(ranks, "war_chest") * 8;
    mods.incomeFlat = rank(ranks, "supply_lines") * 0.3;
    mods.baseHpMul *= 1 + rank(ranks, "fortified_keep") * 0.08;
    mods.respawnMul *= Math.max(0.55, 1 - rank(ranks, "field_medic") * 0.08);
    mods.shopPriceMul *= Math.max(0.7, 1 - rank(ranks, "quartermaster") * 0.05);
    mods.maxTurretsBonus += rank(ranks, "turret_permit");
    mods.startingLevelDrafts += rank(ranks, "drill_yard");
    mods.crestGainMul *= 1 + rank(ranks, "crest_forge") * 0.01;
    mods.goldRewardMul *= 1 + rank(ranks, "bounty_board") * 0.04;
    mods.startingGoldDelta += rank(ranks, "veteran_pay") * 6;
    mods.incomeFlat += rank(ranks, "veteran_pay") * 0.1;
    mods.startingDamageFlat += rank(ranks, "lane_optics") * 2;
    mods.startingHpFlat += rank(ranks, "steel_ration") * 6;
    mods.sendCostMul *= Math.max(0.7, 1 - rank(ranks, "courier_guild") * 0.04);
    mods.shopPriceMul *= Math.max(0.7, 1 - rank(ranks, "arcane_cache") * 0.03);
    mods.attackSpeedMetaMul *= Math.max(0.75, 1 - rank(ranks, "war_drums") * 0.03);
    mods.baseDamageTakenMetaMul *= Math.max(0.75, 1 - rank(ranks, "bastion_rites") * 0.04);
    mods.sendIncomeMetaMul *= 1 + rank(ranks, "send_doctrine") * 0.05;
    mods.startingLevelDrafts += rank(ranks, "relic_attunement") >= 1 ? 1 : 0;
    const sn = rank(ranks, "scout_network");
    if (sn >= 3) mods.startingRelic = "rare";
    else if (sn >= 2) mods.startingRelic = "uncommon";
    else if (sn >= 1) mods.startingRelic = "common";
    if (rank(ranks, "relic_attunement") >= 2 && mods.startingRelic === "none") {
      mods.startingRelic = "uncommon";
    } else if (rank(ranks, "relic_attunement") >= 2 && mods.startingRelic === "common") {
      mods.startingRelic = "uncommon";
    }
  }

  return mods;
}

export function defaultModifiers(): RunModifiers {
  return composeRunModifiers(0, {}, true);
}
