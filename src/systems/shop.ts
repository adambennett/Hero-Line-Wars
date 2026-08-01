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
import { isItemUnlocked } from "../meta/contentLocks";
import { areCheatsEnabled, loadCheatOptions } from "../meta/cheats";

export function refreshShopOffer(state: GameState): void {
  state.shopOffer = rollShopOffer(state.shopOffer);
  state.toast = "Shop stock refreshed";
  state.toastTimer = 1.2;
}

export function beginWaveShop(state: GameState): void {
  state.shopOffer = rollShopOffer(state.shopOffer);
  state.shopRefreshesLeft = SHOP_REFRESHES_PER_WAVE;
  state.shopRefreshTimer = SHOP_REFRESH_INTERVAL_SEC;
}

export function tickShopRotation(state: GameState, dt: number, waveActive: boolean): void {
  if (!waveActive || state.shopRefreshesLeft <= 0) return;
  if (state.shopFrozen) return;
  const slow = state.curseShopRefreshSlowTimer > 0 ? state.curseShopRefreshSlowMul : 1;
  state.shopRefreshTimer -= dt / slow;
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
  if (areCheatsEnabled() && loadCheatOptions().freeShop) return 0;
  return Math.max(
    1,
    Math.round(baseCost * state.modifiers.shopPriceMul * (state.baseBranchMods?.shopPriceMul ?? 1)),
  );
}

function applyGear(state: GameState, itemId: ShopItemId): void {
  switch (itemId) {
    case "boots": state.hero.speedBonus += 45; break;
    case "blade": state.hero.damageBonus += 7; break;
    case "vitality":
      state.hero.maxHp += 25;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 25);
      break;
    case "purse": state.incomePerSec += 0.8; break;
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
    case "siphon": state.hero.killGoldBonus += 2; break;
    case "war_banner": state.incomePerSec += 0.25 * state.baseLevel; break;
    case "focus_lens": state.hero.luck += 0.12; break;
    case "iron_mail":
      state.hero.maxHp += 40;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 20);
      break;
    case "swift_quill": state.hero.attackSpeedMul *= 0.88; break;
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
    case "lucky_dice": state.hero.luck += 0.06; break;
    case "copper_ring": state.incomePerSec += 0.35; break;
    case "leather_wrap": state.hero.speedBonus += 20; break;
    case "whetstone": state.hero.damageBonus += 4; break;
    case "traveler_cloak":
      state.hero.speedBonus += 25;
      state.hero.maxHp += 8;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 8);
      break;
    case "merchant_seal": state.modifiers.shopPriceMul *= 0.92; break;
    case "thorn_bracer":
      state.hero.damageBonus += 3;
      state.hero.maxHp += 12;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 12);
      break;
    case "crystal_vial":
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 35);
      break;
    case "scout_glass":
      state.hero.attackSpeedMul *= 0.94;
      state.hero.damageBonus += 3;
      break;
    case "iron_spikes":
      state.baseHp = Math.min(state.map.base.maxHp + 60, state.baseHp + 15);
      break;
    case "gold_magnet": state.hero.killGoldBonus += 3; break;
    case "berserker_tonic":
      state.hero.damageBonus += 14;
      state.hero.maxHp = Math.max(40, state.hero.maxHp - 10);
      state.hero.hp = Math.min(state.hero.hp, state.hero.maxHp);
      break;
    case "guardian_crest":
      state.hero.maxHp += 50;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 25);
      state.baseHp = Math.min(state.map.base.maxHp + 40, state.baseHp + 10);
      break;
    case "chrono_sand": state.hero.attackSpeedMul *= 0.82; break;
    case "phantom_ink": state.hero.speedBonus += 55; break;
    case "warhorn": state.incomePerSec += 1; break;
    case "soul_lantern":
      state.hero.damageBonus += 12;
      state.incomePerSec += 0.6;
      break;
    case "dragon_scale":
      state.hero.maxHp += 45;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 45);
      state.hero.damageBonus += 8;
      state.baseHp = Math.min(state.map.base.maxHp + 80, state.baseHp + 25);
      break;
    case "void_splinter":
      state.hero.damageBonus += 20;
      state.hero.attackSpeedMul *= 0.9;
      break;
    case "king_scepter":
      state.hero.damageBonus += 15;
      state.incomePerSec += 1.5;
      state.hero.maxHp += 20;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 20);
      break;
    case "reroll_token": state.rerollTokens += 1; break;
    case "reroll_pouch": state.rerollTokens += 3; break;
    case "shadow_greaves":
      state.hero.speedBonus += 40;
      state.hero.damageBonus += 8;
      break;
    case "monk_beads":
      state.incomePerSec += 0.5;
      state.hero.maxHp += 10;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 10);
      break;
    case "rust_nail": state.hero.damageBonus += 6; break;
    case "quiet_ledger": state.modifiers.shopPriceMul *= 0.94; break;
    case "beggar_cloak": state.hero.speedBonus += 35; break;
    case "copper_spike":
      state.hero.damageBonus += 5;
      state.hero.killGoldBonus += 2;
      break;
    case "boss_fang": state.hero.damageBonus += 10; break;
    case "trophy_ring":
      state.incomePerSec += 0.8;
      state.hero.maxHp += 8;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 8);
      break;
    case "marrow_flask":
      state.hero.maxHp += 15;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 40);
      break;
    case "marathon_boots":
      state.hero.speedBonus += 50;
      state.incomePerSec += 0.3;
      break;
    case "endurance_charm":
      state.hero.maxHp += 35;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 35);
      break;
    case "longwatch_scope":
      state.hero.damageBonus += 8;
      state.hero.attackSpeedMul *= 0.94;
      break;
    case "architect_hammer":
      state.map.base.maxHp += 30;
      state.baseHp = Math.min(state.map.base.maxHp, state.baseHp + 30);
      state.incomePerSec += 0.2;
      break;
    case "scaffold_kit":
      state.map.base.maxHp += 20;
      state.baseHp = Math.min(state.map.base.maxHp, state.baseHp + 20);
      break;
    case "keystone_shard":
      state.hero.damageBonus += 10;
      state.incomePerSec += 0.5;
      break;
    case "miser_coin": state.hero.killGoldBonus += 4; break;
    case "thrift_seal": state.modifiers.shopPriceMul *= 0.9; break;
    case "empty_purse": state.incomePerSec += 0.45; break;
    case "legend_quill":
      state.hero.damageBonus += 16;
      state.hero.maxHp += 20;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 20);
      break;
    case "ascent_crown":
      state.incomePerSec += 1.2;
      state.hero.damageBonus += 12;
      break;
    case "void_thread":
      state.hero.attackSpeedMul *= 0.85;
      state.hero.damageBonus += 8;
      break;
    case "starfall_lens":
      state.hero.luck += 0.15;
      state.hero.damageBonus += 10;
      break;
    default:
      break;
  }
}

export function buyShopItem(state: GameState, itemId: ShopItemId): string | null {
  if (state.disableShop || state.curseShopBlock > 0) return "Shop blocked";
  if (!isItemUnlocked(itemId)) return "Item locked";
  if (!state.shopOffer.includes(itemId)) return "Not in current stock";
  const def = getShopItem(itemId) ?? SHOP_ITEMS.find((i) => i.id === itemId);
  if (!def) return "Unknown item";
  const owned = state.shopOwned[itemId] ?? 0;
  if (owned >= def.maxStacks) return "Max stacks owned";
  const cost = shopItemCost(state, def.cost);
  if (state.gold < cost) return "Not enough gold";

  if (isTurretArtifact(itemId)) {
    if (state.disableArtifacts) return "Artifacts disabled";
    const err = placeTurret(state, itemId);
    if (err) {
      state.toast = err;
      state.toastTimer = 1.4;
      return err;
    }
    state.artifactsPlaced += 1;
  }

  state.gold -= cost;
  state.goldSpent += cost;
  state.shopOwned[itemId] = owned + 1;
  state.shopBuys += 1;
  applyGear(state, itemId);

  state.toast = `Bought ${def.name}`;
  state.toastTimer = 1.6;
  playSfx("buy");
  return null;
}
