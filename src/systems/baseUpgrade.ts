import { baseUpgradeCost } from "../data/baseUpgrades";
import type { GameState } from "../game/state";
import { hasRelic } from "./relics";

export function upgradeBaseCost(state: GameState): number {
  let cost = baseUpgradeCost(state.baseLevel);
  if ((state.shopOwned.blueprint ?? 0) > 0) cost = Math.ceil(cost * 0.8);
  return cost;
}

export function tryUpgradeBase(state: GameState): string | null {
  const cost = upgradeBaseCost(state);
  if (state.gold < cost) return "Not enough gold";

  state.gold -= cost;
  state.baseLevel += 1;

  // War Banner: +0.25 income per base level on each upgrade
  if ((state.shopOwned.war_banner ?? 0) > 0) {
    state.incomePerSec += 0.25;
  }

  if (hasRelic(state, "foundation_spikes")) {
    state.hero.damageBonus += 4;
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 20);
  }

  state.toast = `Base upgraded to Lv ${state.baseLevel}!`;
  if (state.baseLevel > 4) {
    state.toast = `Base Lv ${state.baseLevel} — sends grow stronger!`;
  }
  state.toastTimer = 2;
  return null;
}
