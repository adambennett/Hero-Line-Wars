import { baseUpgradeCost } from "../data/baseUpgrades";
import {
  draftBaseBranches,
  recomputeBranchMods,
  shouldOfferBaseBranch,
  type BaseBranchId,
} from "../data/baseBranches";
import type { GameState } from "../game/state";
import { hasRelic } from "./relics";

export function upgradeBaseCost(state: GameState): number {
  let cost = baseUpgradeCost(state.baseLevel);
  if ((state.shopOwned.blueprint ?? 0) > 0) cost = Math.ceil(cost * 0.8);
  return cost;
}

export function tryUpgradeBase(state: GameState): string | null {
  if (state.curseUpgradeBlock > 0) return "Base upgrades cursed!";
  if (state.pausedForDraft) return "Finish your draft first";
  const cost = upgradeBaseCost(state);
  if (state.gold < cost) return "Not enough gold";

  state.gold -= cost;
  state.goldSpent += cost;
  state.baseLevel += 1;
  state.baseUpgrades += 1;

  // War Banner: +0.25 income per base level on each upgrade
  if ((state.shopOwned.war_banner ?? 0) > 0) {
    state.incomePerSec += 0.25;
  }

  if (hasRelic(state, "foundation_spikes")) {
    state.hero.damageBonus += 4;
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 20);
  }

  if (shouldOfferBaseBranch(state.baseLevel) && !state.baseBranchDraft) {
    state.baseBranchDraft = draftBaseBranches(state.baseBranches);
    state.pausedForDraft = true;
    state.draftKind = "base";
    state.toast = `Base Lv ${state.baseLevel} — choose a branch!`;
    state.toastTimer = 2;
    return null;
  }

  state.toast = `Base upgraded to Lv ${state.baseLevel}!`;
  if (state.baseLevel > 4) {
    state.toast = `Base Lv ${state.baseLevel} — sends grow stronger!`;
  }
  state.toastTimer = 2;
  return null;
}

export function chooseBaseBranch(state: GameState, id: BaseBranchId): void {
  if (!state.baseBranchDraft?.includes(id)) return;
  state.baseBranches.push(id);
  state.baseBranchMods = recomputeBranchMods(state.baseBranches);
  applyBranchImmediate(state, id);
  state.baseBranchDraft = null;
  if (state.levelDraft || state.relicDraft) {
    state.draftKind = state.levelDraft ? "level" : "relic";
    state.pausedForDraft = true;
  } else {
    state.draftKind = null;
    state.pausedForDraft = false;
  }
  state.toast = `Branch: ${id.replace(/_/g, " ")}`;
  state.toastTimer = 2;
}

function applyBranchImmediate(state: GameState, id: BaseBranchId): void {
  const mods = state.baseBranchMods;
  // Re-apply cumulative hero/base effects from latest recompute deltas is hard;
  // apply the single choice's obvious flats from defs via recompute diff:
  void id;
  state.hero.damageBonus += 0; // kept via combat reading baseBranchMods.damageFlat
  if (mods.heroHpFlat > 0) {
    // Approximate: only add HP for the latest choice by comparing — use branch def apply once
  }
  // Directly apply from the chosen def:
  const before = recomputeBranchMods(state.baseBranches.slice(0, -1));
  const after = mods;
  const dHp = after.heroHpFlat - before.heroHpFlat;
  const dBase = after.baseHpFlat - before.baseHpFlat;
  const dSpd = after.moveSpeedFlat - before.moveSpeedFlat;
  const dKill = after.killGoldFlat - before.killGoldFlat;
  const dIncome = after.incomeFlat - before.incomeFlat;
  if (dHp > 0) {
    state.hero.maxHp += dHp;
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + dHp);
  }
  if (dBase > 0) {
    state.map.base.maxHp += dBase;
    state.baseHp = Math.min(state.map.base.maxHp, state.baseHp + dBase);
  }
  if (dSpd > 0) state.hero.speedBonus += dSpd;
  if (dKill > 0) state.hero.killGoldBonus += dKill;
  if (dIncome > 0) state.incomePerSec += dIncome;
  state.modifiers.shopPriceMul *= after.shopPriceMul / Math.max(0.01, before.shopPriceMul);
  state.maxTurrets += after.maxTurretsBonus - before.maxTurretsBonus;
}
