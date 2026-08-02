/**
 * Feature extraction + neural mood → CombatIntent for a lane.
 */

import {
  argmaxMood,
  forward,
  type Genome,
  type MacroMood,
  N_IN,
} from "./brain";
import { MAP_W } from "../data/constants";
import { resolveHero } from "../custom/registry";
import { hasLineOfSight, mapShops } from "../data/maps";
import { dist, normalize } from "../game/math";
import type { GameState } from "../game/state";
import { nearestEnemy } from "../systems/combat";
import { availableSendPacks, sendPackCost } from "../systems/send";
import { emptyIntent, type CombatIntent } from "../net/types";
import { canUpgradeBase } from "../data/baseUpgrades";

const _out = new Float64Array(8);
const _in = new Float64Array(N_IN);

export function extractFeatures(state: GameState): Float64Array {
  const h = state.hero;
  const map = state.map;
  const laneH = Math.max(1, map.laneBottom - map.laneTop);
  const enemies = state.enemies.filter((e) => e.alive);
  const nearest = nearestEnemy(state);
  const nearD = nearest ? dist(h, nearest) / 200 : 1.5;
  const enemyCount = Math.min(1, enemies.length / 12);
  const sentNear = enemies.filter((e) => e.sent).length / Math.max(1, enemies.length);
  const hp = h.alive ? h.hp / Math.max(1, h.maxHp) : 0;
  const base = state.baseHp / Math.max(1, map.base.maxHp);
  const gold = Math.min(1, state.gold / 200);
  const income = Math.min(1, state.incomePerSec / 12);
  const wave = Math.min(1, state.wave / 20);
  const midX = MAP_W * 0.45;
  const hx = (h.x / MAP_W) * 2 - 1;
  const hy = ((h.y - map.laneTop) / laneH) * 2 - 1;
  const nearShop = state.nearShop ? 1 : 0;
  const shopOpen = state.shopOpen ? 1 : 0;
  const cd0 = h.abilityCds[0]! > 0 ? 0 : 1;
  const cd1 = h.abilityCds[1]! > 0 ? 0 : 1;
  const pending = Math.min(1, state.pendingSends.reduce((n, s) => n + s.enemies, 0) / 20);
  const baseLv = Math.min(1, state.baseLevel / 5);
  const canUp = canUpgradeBase(state.baseLevel) ? 1 : 0;
  const waveActive = state.spawning || enemies.length > 0 ? 1 : 0;
  const towardEnemy = nearest
    ? Math.sign(nearest.x - h.x)
    : Math.sign(map.spawner.x - h.x);
  const aimThreat = nearest ? Math.min(1, (resolveHero(h.heroId).attackRange + 20) / Math.max(20, dist(h, nearest))) : 0;

  _in[0] = hx;
  _in[1] = hy;
  _in[2] = hp;
  _in[3] = base;
  _in[4] = gold;
  _in[5] = income;
  _in[6] = wave;
  _in[7] = enemyCount;
  _in[8] = Math.min(1.5, nearD);
  _in[9] = sentNear || 0;
  _in[10] = nearShop;
  _in[11] = shopOpen;
  _in[12] = cd0;
  _in[13] = cd1;
  _in[14] = pending;
  _in[15] = baseLv;
  _in[16] = canUp;
  _in[17] = waveActive;
  _in[18] = towardEnemy;
  _in[19] = aimThreat;
  _in[20] = h.alive ? 1 : 0;
  _in[21] = Math.min(1, (h.x - midX) / (MAP_W * 0.5));
  _in[22] = state.level / 15;
  _in[23] = Math.min(1, state.sendsThisRun / 30);
  return _in;
}

export type NeuralLaneAi = {
  genome: Genome;
  hesitation: number;
  label: string;
  thinkCd: number;
  mood: MacroMood;
};

export function createNeuralLaneAi(
  genome: Genome,
  hesitation = 0,
  label = "Neural",
): NeuralLaneAi {
  return { genome, hesitation, label, thinkCd: 0, mood: "CLEAR" };
}

/** Scripted baseline used as training sparring partner. */
export function scriptedIntent(state: GameState): CombatIntent {
  const intent = emptyIntent();
  const target = nearestEnemy(state);
  if (!state.hero.alive) return intent;
  if (target) {
    const n = normalize(target.x - state.hero.x, target.y - state.hero.y);
    intent.aimX = n.x;
    intent.aimY = n.y;
    steerToEngage(state, target, intent);
    intent.attackHeld = true;
    if (state.hero.abilityCds[0]! <= 0 && Math.random() < 0.025) intent.mobility = true;
    if (state.hero.abilityCds[1]! <= 0 && Math.random() < 0.02) intent.ultimate = true;
  } else if (state.nearShop && state.gold > 40) {
    intent.toggleShop = !state.shopOpen && Math.random() < 0.05;
    if (state.shopOpen && Math.random() < 0.08) intent.shopSlot = 0;
  } else {
    intent.moveX = 0.15;
  }
  if (canUpgradeBase(state.baseLevel) && state.gold > 50 && Math.random() < 0.01) {
    intent.upgradeBase = true;
  }
  if (state.gold > 35 && Math.random() < 0.012) {
    const packs = availableSendPacks(state).filter((p) => sendPackCost(state, p.id) <= state.gold);
    const pack = packs[Math.floor(Math.random() * packs.length)];
    if (pack) intent.sendDigit = pack.digit;
  }
  // Auto-pick drafts
  if (state.utilityDraft?.length) intent.chooseUtility = state.utilityDraft[0]!;
  else if (state.relicDraft?.length) intent.chooseRelic = state.relicDraft[0]!;
  else if (state.levelDraft?.length) intent.chooseLevel = state.levelDraft[0]!;
  else if (state.curseDraft?.length) intent.chooseCurse = state.curseDraft[0]!;
  else if (state.chestDraft?.length) intent.chooseChest = 0;
  else if (state.baseBranchDraft?.length) intent.chooseBaseBranch = state.baseBranchDraft[0]!;
  applyHeroKitAi(state, intent);
  return intent;
}

/**
 * Close distance / strafe around cover when the target is out of range or LOS.
 * Prevents heroes sitting helpless while a creep peeks a wall corner.
 */
function steerToEngage(
  state: GameState,
  target: { x: number; y: number },
  intent: CombatIntent,
  opts?: { aggress?: boolean; holdBand?: boolean },
): void {
  const h = state.hero;
  const map = state.map;
  const range = resolveHero(h.heroId).attackRange;
  const d = dist(h, target);
  const los = hasLineOfSight(map, h.x, h.y, target.x, target.y, 4);
  const inRange = d <= range * 0.9;
  const n = normalize(target.x - h.x, target.y - h.y);

  if (!los || !inRange) {
    // Need a better angle: close X and match/clear Y around the blocker
    intent.moveX = n.x === 0 ? 0.35 : n.x;
    intent.moveY = n.y;
    if (Math.abs(target.y - h.y) < 28) {
      // Same lane height as a corner-sitter — pick the open flank
      const mid = (map.laneTop + map.laneBottom) / 2;
      intent.moveY = h.y <= mid ? 1 : -1;
    }
    // Probe a short lateral step that restores LOS
    const probes = [1, -1, 0.55, -0.55];
    for (const s of probes) {
      const px = h.x + n.x * 36;
      const py = h.y + s * 48;
      if (
        py > map.laneTop + h.radius &&
        py < map.laneBottom - h.radius &&
        hasLineOfSight(map, px, py, target.x, target.y, 4)
      ) {
        intent.moveX = normalize(px - h.x, py - h.y).x;
        intent.moveY = normalize(px - h.x, py - h.y).y;
        break;
      }
    }
    return;
  }

  if (opts?.aggress) {
    intent.moveX = n.x;
    intent.moveY = n.y * 0.6;
    return;
  }

  if (opts?.holdBand !== false) {
    if (d > range * 0.72) {
      intent.moveX = n.x * 0.55;
      intent.moveY = n.y * 0.4;
    } else if (d < range * 0.38) {
      intent.moveX = -n.x;
      intent.moveY = -n.y;
    }
  }
}

export function thinkNeural(
  state: GameState,
  ai: NeuralLaneAi,
  dt: number,
): CombatIntent {
  ai.thinkCd -= dt;
  if (ai.hesitation > 0 && Math.random() < ai.hesitation * 0.02) {
    return emptyIntent();
  }
  if (ai.thinkCd <= 0) {
    const feats = extractFeatures(state);
    const out = forward(ai.genome.weights, feats, _out);
    ai.mood = argmaxMood(out);
    ai.thinkCd = 0.1;
  }

  const intent = emptyIntent();
  if (!state.hero.alive) {
    if (state.utilityDraft?.length) intent.chooseUtility = state.utilityDraft[0]!;
    else if (state.relicDraft?.length) intent.chooseRelic = state.relicDraft[0]!;
    else if (state.levelDraft?.length) intent.chooseLevel = state.levelDraft[0]!;
    else if (state.curseDraft?.length) intent.chooseCurse = state.curseDraft[0]!;
    else if (state.chestDraft?.length) intent.chooseChest = 0;
    else if (state.baseBranchDraft?.length) intent.chooseBaseBranch = state.baseBranchDraft[0]!;
    return intent;
  }

  // Auto-resolve drafts always (training + play)
  if (state.utilityDraft?.length) {
    intent.chooseUtility = state.utilityDraft[0]!;
    return intent;
  }
  if (state.relicDraft?.length) {
    intent.chooseRelic = state.relicDraft[0]!;
    return intent;
  }
  if (state.levelDraft?.length) {
    intent.chooseLevel = state.levelDraft[0]!;
    return intent;
  }
  if (state.curseDraft?.length) {
    intent.chooseCurse = state.curseDraft[0]!;
    return intent;
  }
  if (state.chestDraft?.length) {
    intent.chooseChest = 0;
    return intent;
  }
  if (state.baseBranchDraft?.length) {
    intent.chooseBaseBranch = state.baseBranchDraft[0]!;
    return intent;
  }

  const target = nearestEnemy(state);
  const map = state.map;
  const mood = ai.mood;

  if (target) {
    const n = normalize(target.x - state.hero.x, target.y - state.hero.y);
    intent.aimX = n.x;
    intent.aimY = n.y;
  } else {
    intent.aimX = 1;
    intent.aimY = 0;
  }

  switch (mood) {
    case "CLEAR":
    case "AGGRESS": {
      if (target) {
        steerToEngage(state, target, intent, { aggress: mood === "AGGRESS" });
        intent.attackHeld = true;
      } else {
        intent.moveX = 0.25;
      }
      break;
    }
    case "SEND": {
      intent.attackHeld = !!target;
      if (target) {
        steerToEngage(state, target, intent, { holdBand: true });
        intent.moveX *= 0.7;
        intent.moveY *= 0.7;
      }
      const packs = availableSendPacks(state).filter((p) => sendPackCost(state, p.id) <= state.gold);
      const pack = packs[packs.length - 1];
      if (pack && Math.random() < 0.35) intent.sendDigit = pack.digit;
      break;
    }
    case "SHOP": {
      const shops = mapShops(map);
      if (shops.length === 0) {
        intent.moveX = 0;
        intent.moveY = 0;
        break;
      }
      let shop = shops[0]!;
      let best = Infinity;
      for (const s of shops) {
        const d = dist(state.hero, s);
        if (d < best) {
          best = d;
          shop = s;
        }
      }
      const n = normalize(shop.x - state.hero.x, shop.y - state.hero.y);
      intent.moveX = n.x;
      intent.moveY = n.y;
      if (state.nearShop && !state.shopOpen) intent.toggleShop = true;
      if (state.shopOpen && state.shopOffer[0] && Math.random() < 0.2) intent.shopSlot = 0;
      if (target && dist(state.hero, target) < 90) intent.attackHeld = true;
      break;
    }
    case "RETREAT": {
      const n = normalize(map.base.x - state.hero.x, map.base.y - state.hero.y);
      intent.moveX = n.x;
      intent.moveY = n.y;
      if (target && dist(state.hero, target) < 70) {
        intent.attackHeld = true;
        intent.aimX = normalize(target.x - state.hero.x, target.y - state.hero.y).x;
        intent.aimY = normalize(target.x - state.hero.x, target.y - state.hero.y).y;
      }
      if (state.hero.abilityCds[0]! <= 0) intent.mobility = true;
      break;
    }
    case "HOLD": {
      const holdX = map.base.x + 200;
      const n = normalize(holdX - state.hero.x, map.base.y - state.hero.y);
      intent.moveX = n.x * 0.5;
      intent.moveY = n.y * 0.5;
      if (target) {
        intent.attackHeld = true;
        // Don't ignore a corner-sitter while "holding"
        const range = resolveHero(state.hero.heroId).attackRange;
        if (
          dist(state.hero, target) > range * 0.9 ||
          !hasLineOfSight(map, state.hero.x, state.hero.y, target.x, target.y, 4)
        ) {
          steerToEngage(state, target, intent);
        }
      }
      break;
    }
    case "UPGRADE": {
      if (canUpgradeBase(state.baseLevel)) intent.upgradeBase = true;
      if (target) {
        intent.attackHeld = true;
        steerToEngage(state, target, intent);
        intent.moveX *= 0.55;
        intent.moveY *= 0.55;
      } else {
        intent.moveX = 0.1;
      }
      break;
    }
    case "CAST": {
      if (target) {
        const n = normalize(target.x - state.hero.x, target.y - state.hero.y);
        intent.aimX = n.x;
        intent.aimY = n.y;
        steerToEngage(state, target, intent, { aggress: true });
        intent.attackHeld = true;
      }
      if (state.hero.abilityCds[1]! <= 0) intent.ultimate = true;
      else if (state.hero.abilityCds[0]! <= 0) intent.mobility = true;
      break;
    }
  }

  // Low HP override nudge
  if (state.hero.hp / state.hero.maxHp < 0.28 && mood !== "RETREAT") {
    const n = normalize(map.base.x - state.hero.x, map.base.y - state.hero.y);
    intent.moveX = n.x;
    intent.moveY = n.y;
  }

  applyHeroKitAi(state, intent);
  return intent;
}

/**
 * Hero-specific combat instincts so kits aren't just "hold LMB and waddle".
 */
function applyHeroKitAi(state: GameState, intent: CombatIntent): void {
  const id = state.hero.heroId;
  const target = nearestEnemy(state);
  const map = state.map;
  const h = state.hero;

  if (id === "gyro") {
    const mode = h.bladeMode ?? "wrapped";
    // Don't wander while blades are out
    if (mode === "flying" || mode === "sling" || mode === "rewinding") {
      intent.moveX = 0;
      intent.moveY = 0;
      intent.attackHeld = false;
      return;
    }
    // Hold spin when creeps are near — don't let them walk past to base
    if (target) {
      const d = dist(h, target);
      intent.attackHeld = d < 140;
      // Stay between creep and base
      if (target.x < h.x - 10) {
        intent.moveX = Math.min(intent.moveX, -0.2);
      } else if (target.x > h.x + 40) {
        intent.moveX = Math.max(intent.moveX, 0.55);
      }
      // Hook toward walls for reposition / toward far threats
      if (h.abilityCds[0]! <= 0 && Math.random() < 0.04) {
        const towardWall = target.x > h.x ? 1 : -1;
        intent.aimX = towardWall;
        intent.aimY = (target.y - h.y) * 0.3;
        intent.mobilityHeld = true;
        h.bladeHookCharge = 0.55 + Math.random() * 0.35;
        intent.mobility = true;
      }
    } else {
      // Patrol mid-lane, keep spinning lightly
      intent.moveX = h.x < map.base.x + 280 ? 0.4 : -0.15;
      intent.attackHeld = false;
    }
    if (h.abilityCds[1]! <= 0 && target && dist(h, target) < 90 && Math.random() < 0.03) {
      intent.ultimate = true;
    }
    return;
  }

  if (id === "curses") {
    // Drop hex zones on packs; ult when wave is active
    if (target) {
      intent.attackHeld = true;
      if (h.abilityCds[0]! <= 0 && dist(h, target) < 120 && Math.random() < 0.05) {
        intent.mobility = true;
      }
      if (h.abilityCds[1]! <= 0 && (state.spawning || state.enemies.length > 3) && Math.random() < 0.04) {
        intent.ultimate = true;
      }
    }
    return;
  }

  if (id === "warp") {
    const tp = state.teleporters;
    // Place pads: A near base, B mid/forward
    if (h.abilityCds[0]! <= 0) {
      if (!tp.a) {
        // Walk toward a pad spot then place
        const spotX = map.base.x + 160;
        intent.moveX = Math.sign(spotX - h.x) || 0.2;
        if (Math.abs(h.x - spotX) < 40 && Math.random() < 0.15) intent.mobility = true;
      } else if (!tp.b) {
        const spotX = MAP_W * 0.45;
        intent.moveX = Math.sign(spotX - h.x) || 0.3;
        if (Math.abs(h.x - spotX) < 50 && Math.random() < 0.12) intent.mobility = true;
      } else if (target && dist(h, target) > 160 && Math.random() < 0.03) {
        // Refresh a pad occasionally
        intent.mobility = true;
      }
    }
    if (target) {
      intent.attackHeld = true;
      // Hop pads when threatened or to chase
      if (tp.linked && h.hp / h.maxHp < 0.45 && Math.random() < 0.02) {
        const n = normalize(map.base.x - h.x, map.base.y - h.y);
        intent.moveX = n.x;
        intent.moveY = n.y;
      }
    }
    if (h.abilityCds[1]! <= 0 && tp.linked && target && Math.random() < 0.035) {
      intent.ultimate = true;
    }
  }

  if (id === "gunner") {
    if (target) {
      intent.attackHeld = true;
      intent.mobilityHeld = true;
      intent.mobility = true;
      // Occasionally cycle weapons
      if (Math.random() < 0.008) intent.ultimate = true;
      // Don't walk while sniper-aiming
      if (h.gunnerAiming) {
        intent.moveX = 0;
        intent.moveY = 0;
      }
    }
    return;
  }

  if (id === "sapper") {
    if (target) {
      intent.attackHeld = true;
      if (h.abilityCds[0]! <= 0 && dist(h, target) < 140 && Math.random() < 0.06) {
        intent.mobility = true;
      }
      if (h.abilityCds[1]! <= 0 && (state.mines?.length ?? 0) >= 2 && Math.random() < 0.04) {
        intent.ultimate = true;
      }
    }
    return;
  }

  if (id === "vector") {
    if (target) {
      intent.attackHeld = true;
      // Keep moving to build momentum
      intent.moveX = Math.sign(target.x - h.x) || 0.3;
      intent.moveY = Math.sign(target.y - h.y) * 0.4;
      if (h.abilityCds[0]! <= 0 && (h.momentum ?? 0) > 40 && Math.random() < 0.05) {
        intent.mobility = true;
      }
      if (h.abilityCds[1]! <= 0 && (h.momentum ?? 0) > 70 && Math.random() < 0.04) {
        intent.ultimate = true;
      }
    }
  }

  if (id === "cloud") {
    if (target) {
      intent.attackHeld = true;
      intent.moveX = Math.sign(target.x - h.x) || 0.25;
      intent.moveY = Math.sign(target.y - h.y) * 0.55;
      if (h.abilityCds[0]! <= 0 && Math.random() < 0.07) intent.mobility = true;
      if (h.abilityCds[1]! <= 0 && (state.spawning || state.enemies.length > 2) && Math.random() < 0.035) {
        intent.ultimate = true;
      }
    }
  }
}
