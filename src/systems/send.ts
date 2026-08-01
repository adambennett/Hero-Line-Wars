import type { SendPackId } from "../data/send";
import {
  SEND_PACKS,
  baseLevelSendHpBonus,
  baseUpgradePackMul,
  unlockedSendPacks,
  type SendPackDef,
} from "../data/send";
import type { GameState, PendingSend } from "../game/state";
import { sendCostMul, sendIncomeMul, sendRefundMul, sendHpMulFromRelics } from "./relics";
import { queueSendToOpponent } from "./opponent";
import { playSfx } from "./audio";

export function sendPackCost(state: GameState, packId: SendPackId): number {
  const def = SEND_PACKS.find((p) => p.id === packId);
  if (!def) return Infinity;
  const mul = baseUpgradePackMul(state.baseLevel, def);
  return Math.ceil(def.cost * mul.costMul * sendCostMul(state) * state.modifiers.sendCostMul);
}

/** Available packs for this hero/base, with hotkeys remapped to 1..9. */
export function availableSendPacks(state: GameState): SendPackDef[] {
  const packs = unlockedSendPacks(state.baseLevel, state.hero.heroId);
  // Prefer shared packs first, then hero-unique; limit to 9 for digit keys
  const shared = packs.filter((p) => !p.heroId);
  const unique = packs.filter((p) => p.heroId);
  const ordered = [...shared, ...unique].slice(0, 9);
  return ordered.map((p, i) => ({ ...p, digit: i + 1 }));
}

export function buySendPack(state: GameState, packId: SendPackId): string | null {
  const def = SEND_PACKS.find((p) => p.id === packId);
  if (!def) return "Unknown pack";
  if (def.heroId && def.heroId !== state.hero.heroId) return "Wrong hero";
  if (def.minBaseLevel > state.baseLevel) return "Upgrade your base to unlock";
  const cost = sendPackCost(state, packId);
  if (state.gold < cost) return "Not enough gold";

  state.gold -= cost;
  const refund = cost * sendRefundMul(state);
  if (refund > 0) state.gold += refund;

  const mul = baseUpgradePackMul(state.baseLevel, def);
  const income = def.incomeBonus * mul.incomeMul * sendIncomeMul(state) * state.modifiers.sendIncomeMetaMul;
  state.incomePerSec += income;

  const hpScale =
    def.hpScale *
    mul.hpMul *
    baseLevelSendHpBonus(state.baseLevel) *
    sendHpMulFromRelics(state);

  const pending: PendingSend = {
    enemies: def.enemies,
    hpScale,
  };
  if (state.mpLane) {
    state.pendingSends.push(pending);
  } else {
    queueSendToOpponent(state, pending, def.name);
  }
  state.sendsThisRun += 1;

  state.toast = `Sent ${def.name} to enemy (+${income.toFixed(2)}/s)`;
  state.toastTimer = 1.6;
  playSfx("send");
  return null;
}

export function consumePendingSends(state: GameState): PendingSend[] {
  const batch = state.pendingSends.splice(0, state.pendingSends.length);
  if (state.opponent) {
    const n = batch.reduce((sum, s) => sum + s.enemies, 0);
    state.opponent.sendingToPlayer = Math.max(0, state.opponent.sendingToPlayer - n);
  }
  return batch;
}
