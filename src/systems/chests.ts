/** Lane chests — rare stand-to-open rewards near the spawner. */

import { draftRelicChoices, type RelicId } from "../data/relics";
import { RELICS } from "../data/relics";
import { SHOP_ITEMS, type ShopItemId } from "../data/shop";
import { dist } from "../game/math";
import type { ChestRarity, ChestRewardOption, ChestUnit, GameState } from "../game/state";
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

function rollRewardOption(rarity: ChestRarity): ChestRewardOption {
  const roll = Math.random();
  if (rarity === "common") {
    const gold = 18 + Math.floor(Math.random() * 16);
    return { kind: "gold", amount: gold, label: `+${gold} Gold`, blurb: "Quick pocket change." };
  }
  if (rarity === "uncommon") {
    if (roll < 0.55) {
      const gold = 35 + Math.floor(Math.random() * 25);
      return { kind: "gold", amount: gold, label: `+${gold} Gold`, blurb: "A solid haul." };
    }
    const pool = SHOP_ITEMS.filter((i) => i.category === "gear" && i.rarity === "common");
    const item = pool[Math.floor(Math.random() * pool.length)];
    if (item) {
      return {
        kind: "item",
        itemId: item.id,
        label: item.name,
        blurb: item.effect,
      };
    }
    return { kind: "gold", amount: 40, label: "+40 Gold", blurb: "Fallback purse." };
  }
  if (rarity === "rare") {
    if (roll < 0.4) {
      const gold = 70 + Math.floor(Math.random() * 40);
      return { kind: "gold", amount: gold, label: `+${gold} Gold`, blurb: "Heavy purse." };
    }
    const pool = SHOP_ITEMS.filter(
      (i) => i.category === "gear" && (i.rarity === "uncommon" || i.rarity === "rare"),
    );
    const item = pool[Math.floor(Math.random() * pool.length)];
    if (item) {
      return {
        kind: "item",
        itemId: item.id,
        label: item.name,
        blurb: item.effect,
      };
    }
    return { kind: "gold", amount: 80, label: "+80 Gold", blurb: "Fallback purse." };
  }
  // mythic
  if (roll < 0.55) {
    const choices = draftRelicChoices([], 1).filter((id) => {
      const r = RELICS[id].rarity;
      return r === "common" || r === "uncommon";
    });
    const id = (choices[0] ?? draftRelicChoices([], 1)[0]) as RelicId | undefined;
    if (id) {
      return {
        kind: "relic",
        relicId: id,
        label: RELICS[id].name,
        blurb: RELICS[id].blurb,
      };
    }
  }
  const g = 100 + Math.floor(Math.random() * 60);
  return { kind: "gold", amount: g, label: `+${g} Gold`, blurb: "Mythic haul." };
}

function buildChestDraft(state: GameState, rarity: ChestRarity): ChestRewardOption[] {
  const rollFor = (): ChestRewardOption => {
    if (rarity === "mythic" && Math.random() < 0.55) {
      const choices = draftRelicChoices(state.relics, 1).filter((id) => {
        const r = RELICS[id].rarity;
        return r === "common" || r === "uncommon";
      });
      const id = (choices[0] ?? draftRelicChoices(state.relics, 1)[0]) as RelicId | undefined;
      if (id) {
        return {
          kind: "relic",
          relicId: id,
          label: RELICS[id].name,
          blurb: RELICS[id].blurb,
        };
      }
    }
    return rollRewardOption(rarity);
  };
  const a = rollFor();
  let b = rollFor();
  for (let i = 0; i < 6 && a.label === b.label; i++) b = rollFor();
  return [a, b];
}

export function applyChestReward(state: GameState, opt: ChestRewardOption): void {
  if (opt.kind === "gold") {
    state.gold += opt.amount;
    state.toast = `Chest: ${opt.label}`;
  } else if (opt.kind === "item") {
    const prevOffer = state.shopOffer;
    state.shopOffer = [opt.itemId];
    const costGold = state.gold;
    state.gold += 9999;
    buyShopItem(state, opt.itemId as ShopItemId);
    state.gold = costGold;
    state.shopOffer = prevOffer;
    state.toast = `Chest: ${opt.label}`;
  } else {
    pickRelic(state, opt.relicId);
    state.toast = `Chest relic: ${opt.label}`;
  }
  state.toastTimer = 2.2;
  playSfx("buy");
}

export function chooseChestReward(state: GameState, index: number): void {
  if (!state.chestDraft || index < 0 || index >= state.chestDraft.length) return;
  const opt = state.chestDraft[index]!;
  applyChestReward(state, opt);
  state.chestDraft = null;
  state.draftKind = null;
  state.pausedForDraft = !!(
    state.relicDraft ||
    state.levelDraft ||
    state.baseBranchDraft ||
    state.utilityDraft ||
    state.curseDraft
  );
}

function pointInRect(
  x: number,
  y: number,
  r: { x: number; y: number; w: number; h: number },
): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function trySpawnChest(state: GameState): void {
  if (state.chests.length >= 1) return;
  const living = state.enemies.some((e) => e.alive);
  if (!living) return;
  const chance = state.chestSpawnChance * (state.map.chestMagnet ? 2.25 : 1);
  if (Math.random() > chance) return;

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
        // Pick-1-of-2 draft (pauses SP / local lane)
        state.chestDraft = buildChestDraft(state, c.rarity);
        state.pausedForDraft = true;
        state.draftKind = "chest";
        state.toast = "Chest open — pick a reward!";
        state.toastTimer = 2;
        addFx(state, c.x, c.y, 36, "#ffe080aa", 0.45);
        state.chestsOpened += 1;
        c.life = -1;
        playSfx("ui");
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

  const heroes = [state.hero, ...state.allies];

  for (const zone of map.healSprings ?? []) {
    for (const h of heroes) {
      if (!h.alive) continue;
      if (pointInRect(h.x, h.y, zone)) {
        const before = h.hp;
        h.hp = Math.min(h.maxHp, h.hp + 14 * dt);
        if (h === state.hero) state.healingDone += Math.max(0, h.hp - before);
      }
    }
  }

  for (const zone of map.slowMires ?? []) {
    for (const h of heroes) {
      if (!h.alive) continue;
      if (pointInRect(h.x, h.y, zone)) {
        h.slowMul = Math.min(h.slowMul ?? 1, 0.55);
        h.slowTimer = Math.max(h.slowTimer ?? 0, 0.2);
      }
    }
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (pointInRect(e.x, e.y, zone)) {
        e.slowMul = Math.min(e.slowMul ?? 1, 0.6);
        e.slowTimer = Math.max(e.slowTimer ?? 0, 0.25);
      }
    }
  }

  for (const zone of map.hastePads ?? []) {
    for (const h of heroes) {
      if (!h.alive) continue;
      if (pointInRect(h.x, h.y, zone)) {
        h.zipSpeedTimer = Math.max(h.zipSpeedTimer ?? 0, 0.35);
      }
    }
  }

  for (const zone of map.goldVents ?? []) {
    if (state.hero.alive && pointInRect(state.hero.x, state.hero.y, zone)) {
      state.gold += 2.5 * dt;
    }
  }

  for (const zone of map.windCurrents ?? []) {
    for (const h of heroes) {
      if (!h.alive) continue;
      if (!pointInRect(h.x, h.y, zone)) continue;
      h.x += zone.vx * dt;
      h.y += zone.vy * dt;
      h.y = Math.max(map.laneTop + h.radius, Math.min(map.laneBottom - h.radius, h.y));
      h.x = Math.max(h.radius, Math.min(MAP_W - h.radius, h.x));
    }
  }

  for (const spike of map.spikePulses ?? []) {
    // Pulse every ~2.2s
    const phase = Math.floor(state.mapSpecialTimer / 2.2);
    const prev = Math.floor((state.mapSpecialTimer - dt) / 2.2);
    if (phase === prev) continue;
    const r = spike.radius || 36;
    const dmg = spike.damage ?? 22;
    addFx(state, spike.x, spike.y, r, "#ff706055", 0.35);
    for (const h of heroes) {
      if (!h.alive) continue;
      if (dist(h, spike) <= r + h.radius) {
        h.hp -= dmg;
        if (h.hp < 0.01 && h === state.hero) h.hp = 0.01;
      }
    }
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (dist(e, spike) <= r + e.radius) {
        e.hp -= dmg * 0.65;
      }
    }
  }

  if (map.riftSurges && waveActive) {
    const phase = Math.floor(state.mapSpecialTimer / 5);
    const prev = Math.floor((state.mapSpecialTimer - dt) / 5);
    if (phase !== prev) {
      const midX = (map.base.x + map.spawner.x) / 2;
      const yank = 40 + Math.random() * 20;
      addFx(state, midX, (map.laneTop + map.laneBottom) / 2, 80, "#a090ff55", 0.4);
      for (const h of heroes) {
        if (!h.alive) continue;
        const dir = Math.sign(midX - h.x) || 1;
        h.x += dir * yank;
        h.x = Math.max(h.radius, Math.min(MAP_W - h.radius, h.x));
      }
      for (const e of state.enemies) {
        if (!e.alive) continue;
        const dir = Math.sign(midX - e.x) || 1;
        e.x += dir * yank;
        e.x = Math.max(e.radius, Math.min(MAP_W - e.radius, e.x));
      }
    }
  }

  if (map.volatileOrbs) {
    if (!state.mapOrbs) state.mapOrbs = [];
    if (waveActive) {
      const phase = Math.floor(state.mapSpecialTimer / 4);
      const prev = Math.floor((state.mapSpecialTimer - dt) / 4);
      if (phase !== prev) {
        const midY = (map.laneTop + map.laneBottom) / 2;
        state.mapOrbs.push({
          x: map.base.x + 180 + Math.random() * (MAP_W - map.base.x - 280),
          y: midY + (Math.random() - 0.5) * (map.laneBottom - map.laneTop - 60),
          radius: 38,
          fuse: 2.2,
          damage: 28,
        });
      }
    }
    for (const orb of state.mapOrbs) {
      orb.fuse -= dt;
      if (orb.fuse > 0) continue;
      addFx(state, orb.x, orb.y, orb.radius, "#ff906055", 0.45);
      for (const h of heroes) {
        if (!h.alive) continue;
        if (dist(h, orb) <= orb.radius + h.radius) {
          h.hp -= orb.damage;
          if (h.hp < 0.01 && h === state.hero) h.hp = 0.01;
        }
      }
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (dist(e, orb) <= orb.radius + e.radius) {
          e.hp -= orb.damage * 0.7;
        }
      }
    }
    state.mapOrbs = state.mapOrbs.filter((o) => o.fuse > 0);
  }
}
