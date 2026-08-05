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
  return Math.ceil(
    def.cost *
      mul.costMul *
      sendCostMul(state) *
      state.modifiers.sendCostMul *
      (state.baseBranchMods?.sendCostMul ?? 1) *
      (state.utilitySendDiscount ? 0.6 : 1),
  );
}

/** Max send chips shown in the HUD (hotkeys 1–5). */
export const MAX_VISIBLE_SEND_PACKS = 5;

/**
 * Available packs for this hero/base. Once many packs are unlocked we only
 * surface the strongest few — players spam the top tier anyway, and the old
 * full list drowned the top HUD. Hotkeys are remapped to 1..N for the visible set.
 */
export function availableSendPacks(state: GameState): SendPackDef[] {
  const packs = unlockedSendPacks(state.baseLevel, state.hero.heroId, state.contentFilters);
  // Strongest first by base cost (tier proxy), keep top N, then show cheap→expensive.
  const strongest = [...packs]
    .sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name))
    .slice(0, MAX_VISIBLE_SEND_PACKS)
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  return strongest.map((p, i) => ({ ...p, digit: i + 1 }));
}

export function buySendPack(state: GameState, packId: SendPackId): string | null {
  if (state.disableSends || state.curseSendBlock > 0) return "Sends blocked";
  const def = SEND_PACKS.find((p) => p.id === packId);
  if (!def) return "Unknown pack";
  if (def.heroId && def.heroId !== state.hero.heroId) return "Wrong hero";
  if (def.minBaseLevel > state.baseLevel) return "Upgrade your base to unlock";
  const cost = sendPackCost(state, packId);
  if (state.gold < cost) return "Not enough gold";

  state.gold -= cost;
  state.goldSpent += cost;
  if (state.utilitySendDiscount) state.utilitySendDiscount = false;
  const refund = cost * sendRefundMul(state);
  if (refund > 0) {
    state.gold += refund;
    state.goldSpent = Math.max(0, state.goldSpent - refund);
  }

  const mul = baseUpgradePackMul(state.baseLevel, def);
  const income =
    def.incomeBonus *
    mul.incomeMul *
    sendIncomeMul(state) *
    state.modifiers.sendIncomeMetaMul *
    (state.baseBranchMods?.sendIncomeMul ?? 1);
  state.incomePerSec += income;

  const hpScale =
    def.hpScale *
    mul.hpMul *
    baseLevelSendHpBonus(state.baseLevel) *
    sendHpMulFromRelics(state) *
    (state.baseBranchMods?.sendHpMul ?? 1);

  const pending: PendingSend = {
    enemies: def.enemies,
    hpScale,
  };
  // Own lane (explicit or endless default), MP always buffers for host routing,
  // otherwise classic send into the rival wave.
  const toOwn = state.sendLocation === "own" || (!state.mpLane && state.endless);
  if (toOwn) {
    state.pendingSends.push(pending);
  } else if (state.mpLane) {
    state.pendingSends.push(pending);
  } else {
    queueSendToOpponent(state, pending, def.name);
  }
  state.sendsThisRun += 1;

  const ownMsg = toOwn || (state.endless && state.sendLocation !== "enemy");
  state.toast = ownMsg
    ? `Queued ${def.name} into your next wave (+${income.toFixed(2)}/s)`
    : `Sent ${def.name} to enemy (+${income.toFixed(2)}/s)`;
  state.toastTimer = 1.6;
  playSfx("send");
  return null;
}

export function consumePendingSends(state: GameState): PendingSend[] {
  const batch = state.pendingSends.splice(0, state.pendingSends.length);
  if (state.opponent && !state.endless) {
    const n = batch.reduce((sum, s) => sum + s.enemies, 0);
    state.opponent.sendingToPlayer = Math.max(0, state.opponent.sendingToPlayer - n);
  }
  return batch;
}
