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
  if (id === "spare_clip") {
    state.hero.attackSpeedMul *= 0.88;
  }
  if (id === "runners_band") {
    state.hero.speedBonus += 35;
  }
  if (id === "penny_whistle") {
    state.incomePerSec += 0.5;
  }
  if (id === "stone_skin") {
    state.hero.maxHp += 30;
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 15);
  }
  if (id === "keen_eye") {
    state.hero.luck += 0.08;
  }
  if (id === "fortress_pact") {
    state.map.base.maxHp += 40;
    state.baseHp = Math.min(state.map.base.maxHp, state.baseHp + 40);
  }
  if (id === "haste_sigil") {
    state.hero.attackSpeedMul *= 0.8;
    state.hero.speedBonus += 25;
  }
  if (id === "miser_purse") {
    state.modifiers.shopPriceMul *= 0.88;
  }
  if (id === "turret_overclock") {
    state.maxTurrets += 1;
  }
  if (id === "oracle_lens") {
    state.hero.luck += 0.15;
    state.hero.damageBonus += 6;
  }
  if (id === "eternal_engine") {
    state.incomePerSec += 2;
  }
  if (id === "worldbreaker") {
    state.hero.damageBonus += 12;
    state.hero.maxHp += 40;
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 40);
    state.hero.attackSpeedMul *= 0.85;
  }
  if (id === "phoenix_down") {
    state.phoenixCharges = (state.phoenixCharges ?? 0) + 1;
  }
  if (id === "scholar_band") {
    state.hero.luck += 0.05;
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
  if (hasRelic(state, "rally_banner")) {
    state.hero.barrierTimer = Math.max(state.hero.barrierTimer, 1.5);
  }
}

export function applyWaveRider(state: GameState): void {
  if (!hasRelic(state, "wave_rider")) return;
  state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 20);
  state.gold += 12;
}

export function sendCostMul(state: GameState): number {
  let mul = 1;
  if (hasRelic(state, "crowded_ledger")) mul *= 0.8;
  if (hasRelic(state, "eternal_engine")) mul *= 0.9;
  return mul;
}

export function sendIncomeMul(state: GameState): number {
  let mul = 1;
  if (hasRelic(state, "war_tax")) mul *= 1.4;
  if (hasRelic(state, "sovereign_seal")) mul *= 1.25;
  return mul;
}

export function sendRefundMul(state: GameState): number {
  return hasRelic(state, "send_sovereign") ? 0.08 : 0;
}

export function sendHpMulFromRelics(state: GameState): number {
  let mul = 1;
  if (hasRelic(state, "send_sovereign")) mul *= 1 + state.baseLevel * 0.12;
  if (hasRelic(state, "sovereign_seal")) mul *= 1.25;
  return mul;
}

export function mobilityCdMul(state: GameState): number {
  let mul = 1;
  if (hasRelic(state, "phantom_step")) mul *= 0.65;
  if ((state.shopOwned.temporal_coil ?? 0) > 0) mul *= 0.82;
  return mul;
}

export function ultimateCdMul(state: GameState): number {
  let mul = 1;
  if (hasRelic(state, "echo_chamber")) mul *= 0.8;
  if ((state.shopOwned.temporal_coil ?? 0) > 0) mul *= 0.82;
  return mul;
}

export function baseDamageTakenMul(state: GameState): number {
  let mul = state.modifiers.baseDamageTakenMetaMul ?? 1;
  if (hasRelic(state, "iron_dividend")) mul *= 0.7;
  if (hasRelic(state, "line_tyrant")) mul *= 0.85;
  return mul;
}

export function killGoldRelicMul(state: GameState): number {
  let mul = 1;
  if (hasRelic(state, "gold_fever")) mul *= 1.6;
  if (hasRelic(state, "bounty_mark")) mul *= 1.25;
  return mul;
}

export function relicDamageMul(state: GameState): number {
  let mul = 1;
  if (hasRelic(state, "blood_tithe")) mul *= 1.2;
  if (hasRelic(state, "line_tyrant")) mul *= 1; // applied vs elite/boss in combat
  if (hasRelic(state, "last_stand") && state.hero.hp / Math.max(1, state.hero.maxHp) < 0.35) {
    mul *= 1.4;
  }
  if (hasRelic(state, "ascent_primer")) mul *= 0.92;
  return mul;
}

export function tryPhoenixRevive(state: GameState): boolean {
  if ((state.phoenixCharges ?? 0) <= 0) return false;
  if (!hasRelic(state, "phoenix_down")) return false;
  state.phoenixCharges = (state.phoenixCharges ?? 1) - 1;
  state.hero.alive = true;
  state.hero.hp = state.hero.maxHp * 0.5;
  state.toast = "Phoenix Down!";
  state.toastTimer = 2;
  return true;
}
