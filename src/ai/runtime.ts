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
import { HEROES } from "../data/heroes";
import { SEND_PACKS } from "../data/send";
import { hasLineOfSight } from "../data/maps";
import { dist, normalize } from "../game/math";
import type { GameState } from "../game/state";
import { nearestEnemy } from "../systems/combat";
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
  const aimThreat = nearest ? Math.min(1, (HEROES[h.heroId].attackRange + 20) / Math.max(20, dist(h, nearest))) : 0;

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
    const pack = SEND_PACKS.find((p) => p.minBaseLevel <= state.baseLevel && p.cost <= state.gold);
    if (pack) intent.sendDigit = pack.digit;
  }
  // Auto-pick drafts
  if (state.relicDraft?.length) intent.chooseRelic = state.relicDraft[0]!;
  else if (state.levelDraft?.length) intent.chooseLevel = state.levelDraft[0]!;
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
  const range = HEROES[h.heroId].attackRange;
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
    if (state.relicDraft?.length) intent.chooseRelic = state.relicDraft[0]!;
    else if (state.levelDraft?.length) intent.chooseLevel = state.levelDraft[0]!;
    return intent;
  }

  // Auto-resolve drafts always (training + play)
  if (state.relicDraft?.length) {
    intent.chooseRelic = state.relicDraft[0]!;
    return intent;
  }
  if (state.levelDraft?.length) {
    intent.chooseLevel = state.levelDraft[0]!;
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
      const pack = SEND_PACKS.filter((p) => p.minBaseLevel <= state.baseLevel && p.cost <= state.gold).pop();
      if (pack && Math.random() < 0.35) intent.sendDigit = pack.digit;
      break;
    }
    case "SHOP": {
      const shop = map.shop;
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
        const range = HEROES[state.hero.heroId].attackRange;
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

  return intent;
}
