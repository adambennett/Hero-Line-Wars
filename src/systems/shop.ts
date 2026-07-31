import type { ShopItemId } from "../data/shop";
import {
  SHOP_ITEMS,
  SHOP_REFRESHES_PER_WAVE,
  SHOP_REFRESH_INTERVAL_SEC,
  getShopItem,
  isTurretArtifact,
  rollShopOffer,
} from "../data/shop";
import type { GameState } from "../game/state";
import { placeTurret } from "./turrets";
import { playSfx } from "./audio";

export function refreshShopOffer(state: GameState): void {
  state.shopOffer = rollShopOffer(state.shopOffer);
  state.toast = "Shop stock refreshed";
  state.toastTimer = 1.2;
}

export function beginWaveShop(state: GameState): void {
  state.shopOffer = rollShopOffer(state.shopOffer);
  state.shopRefreshesLeft = SHOP_REFRESHES_PER_WAVE;
  state.shopRefreshTimer = SHOP_REFRESH_INTERVAL_SEC;
  // Don't clear freeze — player may keep shop frozen across waves
}

/** Tick mid-wave shop refreshes only while the wave is active (respects Frost freeze). */
export function tickShopRotation(state: GameState, dt: number, waveActive: boolean): void {
  if (!waveActive || state.shopRefreshesLeft <= 0) return;
  if (state.shopFrozen) return;
  state.shopRefreshTimer -= dt;
  if (state.shopRefreshTimer <= 0) {
    state.shopRefreshesLeft -= 1;
    refreshShopOffer(state);
    if (state.shopRefreshesLeft > 0) {
      state.shopRefreshTimer = SHOP_REFRESH_INTERVAL_SEC;
    }
  }
}

export function toggleShopFreeze(state: GameState): void {
  if (state.hero.heroId !== "frost") return;
  state.shopFrozen = !state.shopFrozen;
  state.toast = state.shopFrozen ? "Shop timer frozen" : "Shop timer resumed";
  state.toastTimer = 1.4;
  playSfx("ui");
}

export function shopItemCost(state: GameState, baseCost: number): number {
  return Math.max(1, Math.round(baseCost * state.modifiers.shopPriceMul));
}

export function buyShopItem(state: GameState, itemId: ShopItemId): string | null {
  if (!state.shopOffer.includes(itemId)) return "Not in current stock";
  const def = getShopItem(itemId) ?? SHOP_ITEMS.find((i) => i.id === itemId);
  if (!def) return "Unknown item";
  const owned = state.shopOwned[itemId] ?? 0;
  if (owned >= def.maxStacks) return "Max stacks owned";
  const cost = shopItemCost(state, def.cost);
  if (state.gold < cost) return "Not enough gold";

  if (isTurretArtifact(itemId)) {
    const err = placeTurret(state, itemId);
    if (err) {
      state.toast = err;
      state.toastTimer = 1.4;
      return err;
    }
  }

  state.gold -= cost;
  state.shopOwned[itemId] = owned + 1;

  switch (itemId) {
    case "boots":
      state.hero.speedBonus += 45;
      break;
    case "blade":
      state.hero.damageBonus += 7;
      break;
    case "vitality":
      state.hero.maxHp += 25;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 25);
      break;
    case "purse":
      state.incomePerSec += 0.8;
      break;
    case "greaves":
      state.hero.speedBonus += 30;
      state.hero.maxHp += 10;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 10);
      break;
    case "razor":
      state.hero.damageBonus += 5;
      state.hero.attackSpeedMul *= 0.92;
      break;
    case "aegis":
      state.baseHp = Math.min(state.map.base.maxHp + 40, state.baseHp + 20);
      break;
    case "siphon":
      state.hero.killGoldBonus += 2;
      break;
    case "blueprint":
      break;
    case "war_banner":
      state.incomePerSec += 0.25 * state.baseLevel;
      break;
    case "focus_lens":
      state.hero.luck += 0.12;
      break;
    case "iron_mail":
      state.hero.maxHp += 40;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 20);
      break;
    case "swift_quill":
      state.hero.attackSpeedMul *= 0.88;
      break;
    case "blood_charm":
      state.hero.damageBonus += 10;
      state.hero.maxHp += 15;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 15);
      break;
    case "storm_core":
      state.incomePerSec += 1;
      state.hero.damageBonus += 8;
      break;
    case "apex_relic":
      state.hero.damageBonus += 18;
      state.hero.maxHp += 30;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 30);
      state.incomePerSec += 0.5;
      break;
    case "ballista":
    case "brazier":
    case "hex_totem":
      break;
  }

  state.toast = `Bought ${def.name}`;
  state.toastTimer = 1.6;
  playSfx("buy");
  return null;
}
