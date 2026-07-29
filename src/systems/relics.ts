import type { RelicId } from "../data/relics";
import { RELICS } from "../data/relics";
import type { GameState } from "../game/state";

export function hasRelic(state: GameState, id: RelicId): boolean {
  return state.relics.includes(id);
}

export function pickRelic(state: GameState, id: RelicId): void {
  if (state.relics.includes(id)) return;
  state.relics.push(id);
  state.relicDraft = null;

  if (id === "gold_fever") {
    state.incomePerSec *= 0.75;
  }
  if (id === "iron_dividend") {
    state.incomePerSec = Math.max(0.4, state.incomePerSec - 0.4);
  }
  if (id === "foundation_spikes") {
    state.hero.damageBonus += 4 * state.baseLevel;
  }
  if (id === "glass_cannon") {
    state.hero.damageBonus += 20;
    state.hero.maxHp = Math.max(40, state.hero.maxHp - 20);
    state.hero.hp = Math.min(state.hero.hp, state.hero.maxHp);
  }
  if (id === "lucky_coin") {
    state.hero.luck += 0.12;
  }
  if (id === "mythic_engine") {
    state.incomePerSec += 1.2;
  }
  if (id === "legend_crown") {
    state.hero.damageBonus += 8;
    state.hero.maxHp += 25;
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 25);
    state.incomePerSec += 0.5;
  }

  if (state.pendingLevelUps > 0 || state.levelDraft) {
    state.draftKind = "level";
    state.pausedForDraft = true;
  } else {
    state.draftKind = null;
    state.pausedForDraft = false;
  }

  state.toast = `Relic: ${RELICS[id].name}`;
  state.toastTimer = 2.2;
}

export function applySecondWind(state: GameState): void {
  if (hasRelic(state, "second_wind")) {
    const missing = state.hero.maxHp - state.hero.hp;
    if (missing > 0) {
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + missing * 0.35);
    }
  }
  if (hasRelic(state, "tide_charm")) {
    state.gold += 8;
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 10);
  }
}

export function sendCostMul(state: GameState): number {
  return hasRelic(state, "crowded_ledger") ? 0.8 : 1;
}

export function sendIncomeMul(state: GameState): number {
  return hasRelic(state, "war_tax") ? 1.4 : 1;
}

export function sendRefundMul(state: GameState): number {
  return hasRelic(state, "send_sovereign") ? 0.08 : 0;
}

export function sendHpMulFromRelics(state: GameState): number {
  if (!hasRelic(state, "send_sovereign")) return 1;
  return 1 + state.baseLevel * 0.12;
}

export function mobilityCdMul(state: GameState): number {
  return hasRelic(state, "phantom_step") ? 0.65 : 1;
}

export function baseDamageTakenMul(state: GameState): number {
  return hasRelic(state, "iron_dividend") ? 0.7 : 1;
}
