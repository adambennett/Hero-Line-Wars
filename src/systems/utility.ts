import { UTILITIES, type UtilityId } from "../data/utilities";
import type { GameState } from "../game/state";
import {
  addFx,
  attackDamage,
  damageEnemiesInRadius,
  applySlow,
} from "./combat";
import { playSfx } from "./audio";

/** Apply chosen utility id — caller manages draft chaining. */
export function applyUtilityChoice(state: GameState, id: UtilityId): void {
  state.utilityId = id;
  state.utilityCd = 0;
  state.utilityDraft = null;
  state.toast = `Utility: ${UTILITIES[id].name}`;
  state.toastTimer = 2;
  playSfx("levelup");
}

export function tryCastUtility(state: GameState): void {
  const id = state.utilityId;
  if (!id || !state.hero.alive) return;
  if (state.utilityCd > 0) return;
  const def = UTILITIES[id];
  const ok = castUtility(state, id);
  if (ok) {
    state.utilityCd = def.cooldown;
    state.toast = def.name;
    state.toastTimer = 0.9;
    playSfx("cast");
  }
}

function castUtility(state: GameState, id: UtilityId): boolean {
  switch (id) {
    case "dash_refresh":
      if (state.hero.abilityCds[0] != null) state.hero.abilityCds[0] = 0;
      addFx(state, state.hero.x, state.hero.y, 36, "#7ef0ff88", 0.35);
      return true;
    case "gold_burst":
      state.gold += 55;
      addFx(state, state.hero.x, state.hero.y, 30, "#ffd24a88", 0.35);
      return true;
    case "temp_barrier":
      state.hero.barrierTimer = Math.max(state.hero.barrierTimer, 2.8);
      addFx(state, state.hero.x, state.hero.y, 40, "#ffe08a88", 0.4);
      return true;
    case "aoe_slow":
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.x - state.hero.x, e.y - state.hero.y) <= 110 + e.radius) {
          applySlow(e, 0.45, 2.5);
        }
      }
      addFx(state, state.hero.x, state.hero.y, 110, "#7ec8ff66", 0.4);
      return true;
    case "field_heal":
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + state.hero.maxHp * 0.28);
      addFx(state, state.hero.x, state.hero.y, 50, "#70e09088", 0.4);
      return true;
    case "income_spike":
      state.utilityIncomeBoost = Math.max(state.utilityIncomeBoost, 8);
      state.utilityIncomeAmount = 2.5;
      addFx(state, state.hero.x, state.hero.y, 34, "#ffd24a66", 0.35);
      return true;
    case "artifact_boost":
      state.utilityTurretBoost = Math.max(state.utilityTurretBoost, 6);
      addFx(state, state.hero.x, state.hero.y, 40, "#c8b8ff66", 0.35);
      return true;
    case "send_discount":
      state.utilitySendDiscount = true;
      addFx(state, state.hero.x, state.hero.y, 34, "#90c8ff66", 0.35);
      return true;
    case "sprint_burst":
      state.utilitySprintTimer = Math.max(state.utilitySprintTimer, 2.5);
      addFx(state, state.hero.x, state.hero.y, 36, "#5ef0a866", 0.3);
      return true;
    case "cleanse":
      state.hero.slowTimer = 0;
      state.hero.slowMul = 1;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 10);
      addFx(state, state.hero.x, state.hero.y, 40, "#b8ffe088", 0.35);
      return true;
    case "bounty_mark":
      state.utilityBountyKills = Math.max(state.utilityBountyKills, 4);
      addFx(state, state.hero.x, state.hero.y, 34, "#ffb06066", 0.35);
      return true;
    case "shockwave":
      damageEnemiesInRadius(state, state.hero.x, state.hero.y, 95, attackDamage(state) * 1.8);
      addFx(state, state.hero.x, state.hero.y, 95, "#ff886688", 0.4);
      return true;
    case "second_wind":
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + state.hero.maxHp * 0.18);
      state.hero.barrierTimer = Math.max(state.hero.barrierTimer, 1.6);
      addFx(state, state.hero.x, state.hero.y, 55, "#70e09066", 0.4);
      return true;
    case "market_favor":
      if (state.shopRefreshesLeft >= 0) {
        state.shopRefreshesLeft += 1;
      } else {
        state.gold += 25;
      }
      addFx(state, state.hero.x, state.hero.y, 34, "#ffd24a66", 0.35);
      return true;
    case "focus_lens":
      state.utilityDamageBoost = Math.max(state.utilityDamageBoost, 4);
      addFx(state, state.hero.x, state.hero.y, 36, "#ff6a3a66", 0.35);
      return true;
    default:
      return false;
  }
}

export function tickUtilityEffects(state: GameState, dt: number): void {
  if (state.utilityCd > 0) state.utilityCd = Math.max(0, state.utilityCd - dt);
  if (state.utilityIncomeBoost > 0) state.utilityIncomeBoost = Math.max(0, state.utilityIncomeBoost - dt);
  if (state.utilityTurretBoost > 0) state.utilityTurretBoost = Math.max(0, state.utilityTurretBoost - dt);
  if (state.utilitySprintTimer > 0) state.utilitySprintTimer = Math.max(0, state.utilitySprintTimer - dt);
  if (state.utilityDamageBoost > 0) state.utilityDamageBoost = Math.max(0, state.utilityDamageBoost - dt);
}
