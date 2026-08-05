/** Lane chests — rare stand-to-open rewards near the spawner. */

import { draftRelicChoices, type RelicId } from "../data/relics";
import { RELICS } from "../data/relics";
import { SHOP_ITEMS, type ShopItemId } from "../data/shop";
import { dist } from "../game/math";
import type {
  ChestRarity,
  ChestRewardOption,
  ChestUnit,
  GameState,
  HeroRuntime,
} from "../game/state";
import { buyShopItem } from "./shop";
import { pickRelic } from "./relics";
import { playSfx } from "./audio";
import { addFx } from "./combat";
import { MAP_W } from "../data/constants";
import { clampToPlayable, playBounds, shrinkPlayBounds } from "../game/playBounds";
import { openOrQueueDraft, syncDraftFlags } from "./drafts";
import { withPlayerBag } from "../net/playerBag";
import { tryLevelUp } from "./xp";

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

/** Wave-scaled multiplier so chest payouts stay relevant in long runs. */
export function chestWaveScale(wave: number): number {
  const w = Math.max(1, wave);
  return 1 + (w - 1) * 0.12;
}

function scaledGold(base: number, wave: number): number {
  return Math.max(1, Math.round(base * chestWaveScale(wave)));
}

function rewardKey(opt: ChestRewardOption): string {
  switch (opt.kind) {
    case "gold":
      return "gold";
    case "xp":
      return "xp";
    case "heal":
      return "heal";
    case "reroll":
      return "reroll";
    case "base_repair":
      return "base_repair";
    case "stock_discount":
      return "stock_discount";
    case "item":
      return `item:${opt.itemId}`;
    case "relic":
      return `relic:${opt.relicId}`;
  }
}

function rollGoldReward(state: GameState, rarity: ChestRarity): ChestRewardOption {
  const roll = Math.random();
  let base = 14;
  let blurb = "Quick pocket change.";
  if (rarity === "uncommon") {
    base = roll < 0.5 ? 28 : 38;
    blurb = "A solid haul.";
  } else if (rarity === "rare") {
    base = 52 + Math.floor(Math.random() * 18);
    blurb = "Heavy purse.";
  } else if (rarity === "mythic") {
    base = 80 + Math.floor(Math.random() * 30);
    blurb = "Mythic haul.";
  } else {
    base = 12 + Math.floor(Math.random() * 10);
  }
  const amount = scaledGold(base, state.wave);
  return { kind: "gold", amount, label: `+${amount} Gold`, blurb };
}

function rollXpReward(state: GameState, rarity: ChestRarity): ChestRewardOption {
  const base =
    rarity === "common"
      ? 18
      : rarity === "uncommon"
        ? 32
        : rarity === "rare"
          ? 55
          : 85;
  const amount = scaledGold(base, state.wave);
  return {
    kind: "xp",
    amount,
    label: `+${amount} XP`,
    blurb: "Instant hero experience.",
  };
}

function rollHealReward(state: GameState, rarity: ChestRarity): ChestRewardOption {
  const pct =
    rarity === "common"
      ? 0.22
      : rarity === "uncommon"
        ? 0.32
        : rarity === "rare"
          ? 0.45
          : 0.6;
  const amount = Math.round(state.hero.maxHp * pct);
  return {
    kind: "heal",
    amount,
    label: `Heal ${amount} HP`,
    blurb: "Restore hero health now.",
  };
}

function rollRerollReward(rarity: ChestRarity): ChestRewardOption {
  const amount = rarity === "common" || rarity === "uncommon" ? 1 : rarity === "rare" ? 2 : 3;
  return {
    kind: "reroll",
    amount,
    label: `+${amount} Reroll${amount > 1 ? "s" : ""}`,
    blurb: "Extra level or relic draft reroll.",
  };
}

function rollBaseRepairReward(state: GameState, rarity: ChestRarity): ChestRewardOption {
  const base =
    rarity === "common"
      ? 12
      : rarity === "uncommon"
        ? 22
        : rarity === "rare"
          ? 36
          : 55;
  const amount = scaledGold(base, state.wave);
  return {
    kind: "base_repair",
    amount,
    label: `+${amount} Base HP`,
    blurb: "Patch your lane base.",
  };
}

function rollItemReward(rarity: ChestRarity): ChestRewardOption | null {
  const pool =
    rarity === "common" || rarity === "uncommon"
      ? SHOP_ITEMS.filter((i) => i.category === "gear" && i.rarity === "common")
      : SHOP_ITEMS.filter(
          (i) => i.category === "gear" && (i.rarity === "uncommon" || i.rarity === "rare"),
        );
  if (!pool.length) return null;
  const item = pool[Math.floor(Math.random() * pool.length)]!;
  return {
    kind: "item",
    itemId: item.id,
    label: item.name,
    blurb: item.effect,
  };
}

function rollRelicReward(state: GameState, rarity: ChestRarity): ChestRewardOption | null {
  const allowHigh = rarity === "rare" || rarity === "mythic";
  const choices = draftRelicChoices(state.relics, 3).filter((id) => {
    const r = RELICS[id].rarity;
    if (rarity === "mythic") return r === "common" || r === "uncommon" || r === "rare";
    if (allowHigh) return r === "common" || r === "uncommon";
    return r === "common";
  });
  const id = (choices[0] ?? draftRelicChoices(state.relics, 1)[0]) as RelicId | undefined;
  if (!id) return null;
  return {
    kind: "relic",
    relicId: id,
    label: RELICS[id].name,
    blurb: RELICS[id].blurb,
  };
}

function rollStockDiscountReward(rarity: ChestRarity): ChestRewardOption {
  const amount =
    rarity === "common" ? 8 : rarity === "uncommon" ? 14 : rarity === "rare" ? 22 : 30;
  return {
    kind: "stock_discount",
    amount,
    label: `−${amount}g stock reroll`,
    blurb: "Cheapens shop stock rerolls for the rest of the run.",
  };
}

type RewardFamily =
  | "gold"
  | "xp"
  | "heal"
  | "reroll"
  | "base_repair"
  | "item"
  | "relic"
  | "stock_discount";

function familiesForRarity(rarity: ChestRarity): RewardFamily[] {
  if (rarity === "common") {
    return ["gold", "xp", "heal", "reroll", "base_repair", "stock_discount"];
  }
  if (rarity === "uncommon") {
    return ["gold", "xp", "heal", "reroll", "base_repair", "item", "stock_discount"];
  }
  if (rarity === "rare") {
    return ["gold", "xp", "heal", "reroll", "base_repair", "item", "relic", "stock_discount"];
  }
  return ["gold", "xp", "heal", "reroll", "base_repair", "item", "relic", "stock_discount"];
}

function rollFamilyReward(
  state: GameState,
  rarity: ChestRarity,
  family: RewardFamily,
): ChestRewardOption | null {
  switch (family) {
    case "gold":
      return rollGoldReward(state, rarity);
    case "xp":
      return rollXpReward(state, rarity);
    case "heal":
      return rollHealReward(state, rarity);
    case "reroll":
      return rollRerollReward(rarity);
    case "base_repair":
      return rollBaseRepairReward(state, rarity);
    case "item":
      return rollItemReward(rarity);
    case "relic":
      return rollRelicReward(state, rarity);
    case "stock_discount":
      return rollStockDiscountReward(rarity);
  }
}

function buildChestDraft(state: GameState, rarity: ChestRarity): ChestRewardOption[] {
  const families = [...familiesForRarity(rarity)];
  // Shuffle families Fisher–Yates
  for (let i = families.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [families[i], families[j]] = [families[j]!, families[i]!];
  }

  const options: ChestRewardOption[] = [];
  const used = new Set<string>();

  for (const family of families) {
    if (options.length >= 2) break;
    for (let attempt = 0; attempt < 8; attempt++) {
      const opt = rollFamilyReward(state, rarity, family);
      if (!opt) continue;
      const key = rewardKey(opt);
      if (used.has(key)) continue;
      used.add(key);
      options.push(opt);
      break;
    }
  }

  // Guaranteed two unique choices — fall back to distinct gold tiers if pool exhausted.
  while (options.length < 2) {
    const fallback = rollGoldReward(state, rarity);
    fallback.label = `${fallback.label} (alt)`;
    const key = rewardKey(fallback) + options.length;
    if (!used.has(key)) {
      used.add(key);
      options.push(fallback);
    } else {
      options.push({
        kind: "xp",
        amount: scaledGold(20, state.wave),
        label: `+${scaledGold(20, state.wave)} XP`,
        blurb: "Bonus experience.",
      });
    }
  }

  return options.slice(0, 2);
}

/** @internal tests */
export function __testBuildChestDraft(state: GameState, rarity: ChestRarity): ChestRewardOption[] {
  return buildChestDraft(state, rarity);
}

export function applyChestReward(state: GameState, opt: ChestRewardOption): void {
  if (opt.kind === "gold") {
    state.gold += opt.amount;
    state.toast = `Chest: ${opt.label}`;
  } else if (opt.kind === "xp") {
    state.xp += opt.amount;
    tryLevelUp(state);
    state.toast = `Chest: ${opt.label}`;
  } else if (opt.kind === "heal") {
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + opt.amount);
    state.toast = `Chest: ${opt.label}`;
  } else if (opt.kind === "reroll") {
    state.rerollTokens += opt.amount;
    state.toast = `Chest: ${opt.label}`;
  } else if (opt.kind === "base_repair") {
    state.baseHp = Math.min(state.map.base.maxHp, state.baseHp + opt.amount);
    state.toast = `Chest: ${opt.label}`;
  } else if (opt.kind === "stock_discount") {
    state.shopStockRerollDiscount = Math.min(80, state.shopStockRerollDiscount + opt.amount);
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
  syncDraftFlags(state);
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
  const chance =
    state.chestSpawnChance *
    (state.map.chestMagnet ? 2.25 : 1) *
    (state.wildChests ? 3 : 1);
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

/**
 * Crack a chest for whoever stood on it. The reward draft is routed to the
 * opener's bag in shared-lane MP so the right player picks the reward.
 */
function openChestFor(state: GameState, c: ChestUnit, opener: HeroRuntime): void {
  const grant = () => {
    openOrQueueDraft(state, { kind: "chest", options: buildChestDraft(state, c.rarity) });
  };
  const slot = opener.controllerSlot;
  if (state.playerBags && slot != null && slot >= 0) withPlayerBag(state, slot, grant);
  else grant();
  state.toast = "Chest open — pick a reward!";
  state.toastTimer = 2;
  addFx(state, c.x, c.y, 36, "#ffe080aa", 0.45);
  state.chestsOpened += 1;
  c.life = -1;
  playSfx("ui");
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
    // Any living hero on the lane opens chests — not just the primary hero,
    // otherwise allies in 2v2 / 3v3 could never crack one.
    const opener = [state.hero, ...(state.allies ?? [])].find(
      (h) => h.alive && dist(h, c) <= h.radius + c.radius + 4,
    );
    if (opener) {
      c.openProgress += dt;
      if (c.openProgress >= c.openDuration) {
        openChestFor(state, c, opener);
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
    shrinkPlayBounds(map, dt * 4.5, 70);
    for (const h of [state.hero, ...state.allies]) {
      const c = clampToPlayable(map, h.x, h.y, h.radius);
      h.x = c.x;
      h.y = c.y;
    }
  }

  if (map.movingHazards) {
    state.mapHazardX += Math.sin(state.mapSpecialTimer * 0.7) * 55 * dt;
    state.mapHazardX = Math.max(map.base.x + 160, Math.min(MAP_W - 120, state.mapHazardX));
    const hz = state.mapHazardX;
    const b = playBounds(map);
    const hy = (b.top + b.bottom) / 2;
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

  state.mapEclipseActive = !!(
    map.eclipseFog &&
    waveActive &&
    Math.floor(state.mapSpecialTimer / 8) % 2 === 1
  );

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
      const c = clampToPlayable(map, h.x, h.y, h.radius);
      h.x = c.x;
      h.y = c.y;
    }
  }

  for (const h of heroes) {
    if ((h.bounceCd ?? 0) > 0) h.bounceCd = Math.max(0, (h.bounceCd ?? 0) - dt);
    if ((h.portalCd ?? 0) > 0) h.portalCd = Math.max(0, (h.portalCd ?? 0) - dt);
    if ((h.relayDmgTimer ?? 0) > 0) h.relayDmgTimer = Math.max(0, (h.relayDmgTimer ?? 0) - dt);
  }

  for (const zone of map.bouncePads ?? []) {
    for (const h of heroes) {
      if (!h.alive || (h.bounceCd ?? 0) > 0) continue;
      if (!pointInRect(h.x, h.y, zone)) continue;
      h.x += zone.impulseX * 0.16;
      h.y += zone.impulseY * 0.16;
      const c = clampToPlayable(map, h.x, h.y, h.radius);
      h.x = c.x;
      h.y = c.y;
      h.bounceCd = 0.55;
      addFx(state, h.x, h.y, 28, "#80e0ff66", 0.25);
    }
  }

  for (const portal of map.mapPortals ?? []) {
    for (const h of heroes) {
      if (!h.alive || (h.portalCd ?? 0) > 0) continue;
      if (dist(h, portal) > h.radius + portal.radius) continue;
      const exit = clampToPlayable(map, portal.exitX, portal.exitY, h.radius);
      h.x = exit.x;
      h.y = exit.y;
      h.portalCd = 1.2;
      addFx(state, portal.x, portal.y, portal.radius, "#c080ff66", 0.3);
      addFx(state, exit.x, exit.y, portal.radius, "#c080ff66", 0.3);
    }
  }

  for (const beacon of map.relayBeacons ?? []) {
    for (const h of heroes) {
      if (!h.alive) continue;
      if (dist(h, beacon) <= h.radius + beacon.radius) {
        h.relayDmgTimer = Math.max(h.relayDmgTimer ?? 0, 0.35);
        h.relayDmgBonus = beacon.damageBonus ?? 0.15;
      }
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
      const b = playBounds(map);
      addFx(state, midX, (b.top + b.bottom) / 2, 80, "#a090ff55", 0.4);
      for (const h of heroes) {
        if (!h.alive) continue;
        const dir = Math.sign(midX - h.x) || 1;
        const c = clampToPlayable(map, h.x + dir * yank, h.y, h.radius);
        h.x = c.x;
        h.y = c.y;
      }
      for (const e of state.enemies) {
        if (!e.alive) continue;
        const dir = Math.sign(midX - e.x) || 1;
        const c = clampToPlayable(map, e.x + dir * yank, e.y, e.radius);
        e.x = c.x;
        e.y = c.y;
      }
    }
  }

  if (map.emberRain && waveActive) {
    const phase = Math.floor(state.mapSpecialTimer / 3.2);
    const prev = Math.floor((state.mapSpecialTimer - dt) / 3.2);
    if (phase !== prev) {
      const b = playBounds(map);
      for (let i = 0; i < 3; i++) {
        const drop = clampToPlayable(
          map,
          b.left + 40 + Math.random() * Math.max(40, b.right - b.left - 80),
          b.top + 40 + Math.random() * Math.max(40, b.bottom - b.top - 80),
          0,
        );
        const r = 46;
        addFx(state, drop.x, drop.y, r, "#ff704066", 0.4);
        for (const h of heroes) {
          if (!h.alive) continue;
          if (dist(h, drop) <= r + h.radius) {
            h.hp -= 16;
            if (h.hp < 0.01 && h === state.hero) h.hp = 0.01;
          }
        }
        for (const e of state.enemies) {
          if (!e.alive) continue;
          if (dist(e, drop) <= r + e.radius) e.hp -= 12;
        }
      }
    }
  }

  if (map.supplyDrops) {
    if (!state.mapSupplyCrates) state.mapSupplyCrates = [];
    if (waveActive) {
      const phase = Math.floor(state.mapSpecialTimer / 7);
      const prev = Math.floor((state.mapSpecialTimer - dt) / 7);
      if (phase !== prev) {
        const b = playBounds(map);
        const p = clampToPlayable(
          map,
          b.left + 80 + Math.random() * Math.max(40, b.right - b.left - 160),
          (b.top + b.bottom) / 2 + (Math.random() - 0.5) * 80,
          18,
        );
        state.mapSupplyCrates.push({
          id: state.nextId++,
          x: p.x,
          y: p.y,
          radius: 22,
          life: 14,
          gold: 12 + Math.floor(Math.random() * 10),
        });
      }
    }
    for (const crate of state.mapSupplyCrates) {
      crate.life -= dt;
      const opener = heroes.find((h) => h.alive && dist(h, crate) <= h.radius + crate.radius);
      if (opener) {
        const grant = () => {
          state.gold += crate.gold;
        };
        const slot = opener.controllerSlot;
        if (state.playerBags && slot != null && slot >= 0) withPlayerBag(state, slot, grant);
        else grant();
        addFx(state, crate.x, crate.y, 30, "#ffe08088", 0.35);
        crate.life = -1;
        playSfx("ui");
      }
    }
    state.mapSupplyCrates = state.mapSupplyCrates.filter((c) => c.life > 0);
  }

  if (map.chronoPulse && waveActive) {
    const phase = Math.floor(state.mapSpecialTimer / 6);
    const prev = Math.floor((state.mapSpecialTimer - dt) / 6);
    if (phase !== prev) {
      const b = playBounds(map);
      addFx(state, (b.left + b.right) / 2, (b.top + b.bottom) / 2, 90, "#60e0ff55", 0.45);
      for (const h of heroes) {
        if (!h.alive) continue;
        h.zipSpeedTimer = Math.max(h.zipSpeedTimer ?? 0, 1.1);
      }
      for (const e of state.enemies) {
        if (!e.alive) continue;
        e.slowMul = Math.min(e.slowMul ?? 1, 0.15);
        e.slowTimer = Math.max(e.slowTimer ?? 0, 1.4);
      }
    }
  }

  if (map.volatileOrbs) {
    if (!state.mapOrbs) state.mapOrbs = [];
    if (waveActive) {
      const phase = Math.floor(state.mapSpecialTimer / 4);
      const prev = Math.floor((state.mapSpecialTimer - dt) / 4);
      if (phase !== prev) {
        const b = playBounds(map);
        const midY = (b.top + b.bottom) / 2;
        const p = clampToPlayable(
          map,
          map.base.x + 180 + Math.random() * Math.max(40, MAP_W - map.base.x - 280),
          midY + (Math.random() - 0.5) * Math.max(40, b.bottom - b.top - 60),
          20,
        );
        state.mapOrbs.push({
          x: p.x,
          y: p.y,
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
