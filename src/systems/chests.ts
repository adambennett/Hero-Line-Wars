/** Lane chests — rare stand-to-open rewards near the spawner. */

import { draftRelicChoices, type RelicId } from "../data/relics";
import { RELICS } from "../data/relics";
import { SHOP_ITEMS, type ShopItemId } from "../data/shop";
import { dist } from "../game/math";
import type { ChestRarity, ChestUnit, GameState } from "../game/state";
import { buyShopItem } from "./shop";
import { pickRelic } from "./relics";
import { playSfx } from "./audio";
import { addFx } from "./combat";
import { MAP_W } from "../data/constants";

const RARITY_WEIGHTS: { rarity: ChestRarity; w: number; openSec: number }[] = [
  { rarity: "common", w: 55, openSec: 1.4 },
  { rarity: "uncommon", w: 28, openSec: 2.0 },
  { rarity: "rare", w: 14, openSec: 2.8 },
  { rarity: "mythic", w: 3, openSec: 3.6 },
];

function rollChestRarity(): { rarity: ChestRarity; openSec: number } {
  const total = RARITY_WEIGHTS.reduce((s, r) => s + r.w, 0);
  let roll = Math.random() * total;
  for (const r of RARITY_WEIGHTS) {
    roll -= r.w;
    if (roll <= 0) return { rarity: r.rarity, openSec: r.openSec };
  }
  return { rarity: "common", openSec: 1.4 };
}

function grantChestReward(state: GameState, rarity: ChestRarity): void {
  const roll = Math.random();
  if (rarity === "common") {
    const gold = 18 + Math.floor(Math.random() * 16);
    state.gold += gold;
    state.toast = `Chest: +${gold} gold`;
  } else if (rarity === "uncommon") {
    if (roll < 0.55) {
      const gold = 35 + Math.floor(Math.random() * 25);
      state.gold += gold;
      state.toast = `Chest: +${gold} gold`;
    } else {
      const pool = SHOP_ITEMS.filter((i) => i.category === "gear" && i.rarity === "common");
      const item = pool[Math.floor(Math.random() * pool.length)];
      if (item) {
        state.shopOffer = [item.id, ...state.shopOffer.filter((x) => x !== item.id)].slice(0, 3);
        const err = buyShopItem(state, item.id);
        state.toast = err ? `Chest: ${item.name} (couldn't buy)` : `Chest: ${item.name}`;
        if (err) state.gold += 40;
      }
    }
  } else if (rarity === "rare") {
    if (roll < 0.4) {
      const gold = 70 + Math.floor(Math.random() * 40);
      state.gold += gold;
      state.toast = `Chest: +${gold} gold`;
    } else {
      const pool = SHOP_ITEMS.filter(
        (i) => i.category === "gear" && (i.rarity === "uncommon" || i.rarity === "rare"),
      );
      const item = pool[Math.floor(Math.random() * pool.length)];
      if (item) {
        // Force-apply as free grant
        const prevOffer = state.shopOffer;
        state.shopOffer = [item.id];
        const costGold = state.gold;
        state.gold += 9999;
        buyShopItem(state, item.id as ShopItemId);
        state.gold = costGold;
        state.shopOffer = prevOffer;
        state.toast = `Chest: ${item.name}`;
      }
    }
  } else {
    // mythic — small relic or big gold
    if (roll < 0.55) {
      const choices = draftRelicChoices(state.relics, 1).filter((id) => {
        const r = RELICS[id].rarity;
        return r === "common" || r === "uncommon";
      });
      const id = (choices[0] ?? draftRelicChoices(state.relics, 1)[0]) as RelicId | undefined;
      if (id) {
        pickRelic(state, id);
        state.toast = `Chest relic: ${RELICS[id].name}`;
      } else {
        state.gold += 120;
        state.toast = "Chest: +120 gold";
      }
    } else {
      const g = 100 + Math.floor(Math.random() * 60);
      state.gold += g;
      state.toast = `Chest: mythic haul +${g} gold`;
    }
  }
  state.toastTimer = 2;
  playSfx("buy");
}

export function trySpawnChest(state: GameState): void {
  if (state.chests.length >= 1) return;
  const living = state.enemies.some((e) => e.alive);
  if (!living) return;
  if (Math.random() > state.chestSpawnChance) return;

  const { rarity, openSec } = rollChestRarity();
  const map = state.map;
  const x =
    map.spawner.x -
    80 -
    Math.random() * Math.min(220, map.spawner.x - map.base.x - 200);
  const y =
    map.laneTop +
    40 +
    Math.random() * Math.max(40, map.laneBottom - map.laneTop - 80);
  const chest: ChestUnit = {
    id: state.nextId++,
    x,
    y,
    radius: 18,
    rarity,
    openDuration: openSec * state.chestOpenMul,
    openProgress: 0,
    life: state.chestDespawnSec,
  };
  state.chests.push(chest);
  state.toast = `${rarity} chest appeared`;
  state.toastTimer = 1.4;
}

/** Update chests + special map behaviors. */
export function tickChests(state: GameState, dt: number): void {
  state.chestSpawnCd -= dt;
  if (state.chestSpawnCd <= 0) {
    state.chestSpawnCd = 6 + Math.random() * 8;
    trySpawnChest(state);
  }

  for (const c of state.chests) {
    c.life -= dt;
    const standing =
      state.hero.alive && dist(state.hero, c) <= state.hero.radius + c.radius + 4;
    if (standing) {
      c.openProgress += dt;
      if (c.openProgress >= c.openDuration) {
        grantChestReward(state, c.rarity);
        addFx(state, c.x, c.y, 36, "#ffe080aa", 0.45);
        c.life = -1;
      }
    } else {
      c.openProgress = Math.max(0, c.openProgress - dt * 0.6);
    }
  }
  state.chests = state.chests.filter((c) => c.life > 0);
}

export function tickMapSpecials(state: GameState, dt: number, waveActive: boolean): void {
  const map = state.map;
  state.mapSpecialTimer += dt;

  if (map.shrinkingLane && waveActive) {
    const shrink = dt * 4.5;
    const mid = (map.laneTop + map.laneBottom) / 2;
    const minHalf = 70;
    if (mid - map.laneTop > minHalf) map.laneTop = Math.min(mid - minHalf, map.laneTop + shrink);
    if (map.laneBottom - mid > minHalf) map.laneBottom = Math.max(mid + minHalf, map.laneBottom - shrink);
    // Clamp heroes into lane
    for (const h of [state.hero, ...state.allies]) {
      if (h.y < map.laneTop + h.radius) h.y = map.laneTop + h.radius;
      if (h.y > map.laneBottom - h.radius) h.y = map.laneBottom - h.radius;
    }
  }

  if (map.movingHazards) {
    state.mapHazardX += Math.sin(state.mapSpecialTimer * 0.7) * 55 * dt;
    state.mapHazardX = Math.max(map.base.x + 160, Math.min(MAP_W - 120, state.mapHazardX));
    const hz = state.mapHazardX;
    const hy = (map.laneTop + map.laneBottom) / 2;
    const hr = 42;
    for (const h of [state.hero, ...state.allies]) {
      if (!h.alive) continue;
      if (dist(h, { x: hz, y: hy }) <= hr + h.radius) {
        h.hp -= 18 * dt;
        if (h.hp <= 0 && h === state.hero) {
          // damage handled by caller via apply — soft clamp
          h.hp = 0.01;
        }
      }
    }
  }

  if (map.eclipseFog) {
    // Toggle fog every ~8s during waves
    if (waveActive && Math.floor(state.mapSpecialTimer / 8) % 2 === 1) {
      state.mapFogActive = true;
    } else {
      state.mapFogActive = false;
    }
  }

  if (map.dualSpawners && waveActive) {
    // Alternate which Y band spawns prefer — flip every 4s
    state.mapActiveSpawner = Math.floor(state.mapSpecialTimer / 4) % 2 === 0 ? 0 : 1;
  }
}
