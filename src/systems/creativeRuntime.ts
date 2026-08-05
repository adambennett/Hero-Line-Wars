/**
 * Runtime helpers for creative run options (damage scales, wave chaos, wall bounce).
 */

import { draftUtilities } from "../data/utilities";
import {
  circleHitsObstacle,
  mapRespawn,
  pickRandomMap,
  type MapDef,
  type Obstacle,
} from "../data/maps";
import { HERO_LIST, type HeroId } from "../data/heroes";
import {
  CREATIVE_OPTION_DEFAULTS,
  clampUnitSize,
  critChance,
  isInstantMul,
  MUL_INSTANT,
  scaleDamage,
  type CritLotteryMode,
  type EnemyMutationMode,
  type RelicDropMode,
} from "../meta/creativeOptions";
import { clamp, normalize } from "../game/math";
import type { GameState, HeroRuntime, RunOptions } from "../game/state";
import { resolveHero, resolveMap } from "../custom/registry";

export type CreativeRuntime = typeof CREATIVE_OPTION_DEFAULTS;

export function creativeFromRunOptions(opts?: Partial<RunOptions>): CreativeRuntime {
  const d = CREATIVE_OPTION_DEFAULTS;
  if (!opts) return { ...d };
  return {
    relicDrop: opts.relicDrop ?? d.relicDrop,
    enemyProjectileDmgMul: opts.enemyProjectileDmgMul ?? d.enemyProjectileDmgMul,
    enemyCollisionDmgMul: opts.enemyCollisionDmgMul ?? d.enemyCollisionDmgMul,
    playerDmgLmbMul: opts.playerDmgLmbMul ?? d.playerDmgLmbMul,
    playerDmgRmbMul: opts.playerDmgRmbMul ?? d.playerDmgRmbMul,
    playerDmgMmbMul: opts.playerDmgMmbMul ?? d.playerDmgMmbMul,
    wallBounciness: opts.wallBounciness ?? d.wallBounciness,
    playerSpeedMul: opts.playerSpeedMul ?? d.playerSpeedMul,
    playerSizeMul: clampUnitSize(opts.playerSizeMul ?? d.playerSizeMul, d.playerSizeMul),
    enemySizeMul: clampUnitSize(opts.enemySizeMul ?? d.enemySizeMul, d.enemySizeMul),
    critLottery: opts.critLottery ?? d.critLottery,
    enemyMutation: opts.enemyMutation ?? d.enemyMutation,
    randomizeUtilityWave: !!opts.randomizeUtilityWave,
    doubleAllProjectiles: !!opts.doubleAllProjectiles,
    immuneToProjectiles: !!opts.immuneToProjectiles,
    randomizeHeroWave: !!opts.randomizeHeroWave,
    randomizeMapWave: !!opts.randomizeMapWave,
    artifactDamageDoubled: !!opts.artifactDamageDoubled,
    artifactsFree: !!opts.artifactsFree,
    itemsFree: !!opts.itemsFree,
    infiniteRerolls: !!opts.infiniteRerolls,
    thornsAura: !!opts.thornsAura,
    bloodTax: !!opts.bloodTax,
    echoBarrage: !!opts.echoBarrage,
    pacifistPays: !!opts.pacifistPays,
    berserkerEdge: !!opts.berserkerEdge,
    slipNSlide: !!opts.slipNSlide,
    vampiricCreeps: !!opts.vampiricCreeps,
    corpseExplosion: !!opts.corpseExplosion,
    bounceHouse: !!opts.bounceHouse,
  };
}

export function shouldOfferRelicForWave(
  mode: RelicDropMode,
  waveTier: GameState["waveTier"],
): boolean {
  if (mode === "never") return false;
  if (mode === "every_wave") return true;
  const boss = waveTier === "boss";
  const elite = waveTier === "elite";
  if (mode === "bosses_only") return boss;
  if (mode === "elites_only") return elite;
  return elite || boss;
}

export function scalePlayerAbilityDamage(
  state: GameState,
  base: number,
  slot: "basic" | "mobility" | "ultimate",
): number {
  let mul = 1;
  if (slot === "basic") mul = state.playerDmgLmbMul;
  else if (slot === "mobility") mul = state.playerDmgRmbMul;
  else mul = state.playerDmgMmbMul;
  let dmg = scaleDamage(base, mul);
  if (state.berserkerEdge && state.hero.alive && state.hero.maxHp > 0 && state.hero.hp / state.hero.maxHp < 0.35) {
    dmg *= 2;
  }
  if (slot === "basic") {
    const chance = critChance(state.critLottery);
    if (chance > 0 && Math.random() < chance) dmg *= 2;
  }
  return dmg;
}

export function scaleEnemyProjectileDamage(state: GameState, base: number): number {
  return scaleDamage(base, state.enemyProjectileDmgMul);
}

export function scaleEnemyCollisionDamage(state: GameState, base: number): number {
  return scaleDamage(base, state.enemyCollisionDmgMul);
}

/**
 * Wall bounciness vs obstacles: Instant Death or bounce.
 * `ignore` holds obstacles the unit was already wedged inside — those neither bounce nor kill.
 */
export function applyWallBounce(
  state: GameState,
  unit: { x: number; y: number; radius: number; vx?: number; vy?: number },
  prevX: number,
  prevY: number,
  ignore: readonly Obstacle[] = [],
): "ok" | "bounce" | "death" {
  const b = state.wallBounciness;
  if (b === 0) return "ok";
  if (isInstantMul(b)) {
    if (
      state.map.obstacles.some(
        (o) => !ignore.includes(o) && circleHitsObstacle(unit.x, unit.y, unit.radius, o),
      )
    ) {
      return "death";
    }
    return "ok";
  }
  for (const o of state.map.obstacles) {
    if (ignore.includes(o)) continue;
    if (!circleHitsObstacle(unit.x, unit.y, unit.radius, o)) continue;
    const cx = clamp(unit.x, o.x, o.x + o.w);
    const cy = clamp(unit.y, o.y, o.y + o.h);
    let nx = unit.x - cx;
    let ny = unit.y - cy;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const pad = unit.radius + 1;
    unit.x = cx + nx * pad;
    unit.y = cy + ny * pad;
    const dx = unit.x - prevX;
    const dy = unit.y - prevY;
    const incoming = dx * nx + dy * ny;
    if (incoming < 0) {
      const rx = dx - 2 * incoming * nx;
      const ry = dy - 2 * incoming * ny;
      unit.x = prevX + rx * b;
      unit.y = prevY + ry * b;
      if (unit.vx !== undefined) {
        const iv = (unit.vx ?? 0) * nx + (unit.vy ?? 0) * ny;
        if (iv < 0) {
          unit.vx = (unit.vx ?? 0) - 2 * iv * nx * b;
          unit.vy = (unit.vy ?? 0) - 2 * iv * ny * b;
        }
      }
    }
    return "bounce";
  }
  return "ok";
}

export function applyEnemyMutation(
  state: GameState,
  e: {
    maxHp: number;
    hp: number;
    speed: number;
    radius: number;
    contactDamage: number;
  },
): void {
  let mode: EnemyMutationMode = state.enemyMutation;
  if (mode === "none") return;
  if (mode === "mixed") {
    const picks: EnemyMutationMode[] = ["speedy", "tanky", "glass"];
    mode = picks[Math.floor(Math.random() * picks.length)]!;
  }
  if (mode === "speedy") {
    e.speed *= 1.55;
    e.maxHp *= 0.85;
    e.hp = Math.min(e.hp, e.maxHp);
  } else if (mode === "tanky") {
    e.maxHp *= 1.65;
    e.hp = e.maxHp;
    e.speed *= 0.75;
  } else if (mode === "glass") {
    e.maxHp *= 0.45;
    e.hp = Math.min(e.hp, e.maxHp);
    e.contactDamage *= 1.4;
    e.speed *= 1.2;
  }
}

/** Enemy size multiplier — applies on spawn regardless of mutation mode. */
export function applyEnemySize(state: GameState, e: { radius: number }): void {
  e.radius = Math.max(4, e.radius * state.enemySizeMul);
}

export function applyCreativeWaveStart(state: GameState): void {
  if (state.infiniteRerolls) {
    state.rerollTokens = Math.max(state.rerollTokens, 99);
  }

  if (state.randomizeUtilityWave) {
    const picks = draftUtilities(6);
    if (picks.length) {
      state.utilityId = picks[Math.floor(Math.random() * picks.length)]!;
      state.utilityCd = 0;
      state.utilityDraftOffered = true;
      state.toast = "Utility scrambled!";
      state.toastTimer = 1.6;
    }
  }

  if (state.randomizeHeroWave) {
    randomizeHeroKeepingProgress(state);
  }

  applyPlayerSize(state);
}

export function applyPlayerSize(state: GameState): void {
  const base = resolveHero(state.hero.heroId).radius;
  state.hero.radius = Math.max(4, base * state.playerSizeMul);
}

export function randomizeHeroKeepingProgress(state: GameState): void {
  const disabled = new Set(state.contentFilters?.heroes ?? []);
  const pool = HERO_LIST.map((h) => h.id).filter((id) => !disabled.has(id));
  if (!pool.length) return;
  const next = pool[Math.floor(Math.random() * pool.length)]! as HeroId;
  if (next === state.hero.heroId) return;
  const def = resolveHero(next);
  const hpRatio = state.hero.maxHp > 0 ? state.hero.hp / state.hero.maxHp : 1;
  state.hero.heroId = next;
  state.hero.maxHp = Math.max(def.maxHp, state.hero.maxHp);
  state.hero.hp = Math.max(1, state.hero.maxHp * hpRatio);
  state.hero.abilityCds = def.abilities.map(() => 0);
  state.hero.radius = Math.max(4, def.radius * state.playerSizeMul);
  state.hero.gunnerWeaponIndex = next === "gunner" ? 0 : undefined;
  state.hero.momentum = next === "vector" ? 0 : undefined;
  state.hero.hiveDrones = next === "hive" ? 0 : undefined;
  state.toast = `Hero scramble → ${def.name}`;
  state.toastTimer = 1.8;
}

/** End-of-wave map shuffle (before next wave starts). */
export function maybeRandomizeMap(state: GameState): void {
  if (!state.randomizeMapWave) return;
  const resolved = pickRandomMap(state.contentFilters?.maps);
  const map: MapDef = structuredClone(resolveMap(resolved));
  const ratio = state.map.base.maxHp > 0 ? state.baseHp / state.map.base.maxHp : 1;
  map.base.maxHp = Math.max(map.base.maxHp, state.map.base.maxHp);
  state.map = map;
  state.mapId = resolved;
  state.baseHp = Math.max(1, Math.round(map.base.maxHp * ratio));
  const pad = mapRespawn(map);
  if (state.hero.alive) {
    state.hero.x = pad.x;
    state.hero.y = pad.y;
  }
  for (const a of state.allies) {
    if (a.alive) {
      a.x = pad.x;
      a.y = pad.y;
    }
  }
  state.turrets = [];
  state.pendingArtifact = null;
  state.toast = `Map scramble → ${map.name}`;
  state.toastTimer = 2;
}

export function slipSlideDelta(
  hero: HeroRuntime,
  dirX: number,
  dirY: number,
  speed: number,
  dt: number,
  enabled: boolean,
): { x: number; y: number } {
  if (!enabled) {
    return { x: dirX * speed * dt, y: dirY * speed * dt };
  }
  type Slip = HeroRuntime & { slipVx?: number; slipVy?: number };
  const h = hero as Slip;
  const mvx = h.slipVx ?? 0;
  const mvy = h.slipVy ?? 0;
  const ax = dirX * speed * 3.2;
  const ay = dirY * speed * 3.2;
  let vx = mvx * Math.pow(0.92, dt * 60) + ax * dt;
  let vy = mvy * Math.pow(0.92, dt * 60) + ay * dt;
  const cap = speed * 1.8;
  const sp = Math.hypot(vx, vy);
  if (sp > cap) {
    const n = normalize(vx, vy);
    vx = n.x * cap;
    vy = n.y * cap;
  }
  h.slipVx = vx;
  h.slipVy = vy;
  return { x: vx * dt, y: vy * dt };
}

export { isInstantMul, MUL_INSTANT, scaleDamage, critChance };
export type { CritLotteryMode, EnemyMutationMode, RelicDropMode };
