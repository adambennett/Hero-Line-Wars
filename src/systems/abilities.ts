import { HEROES, type AbilityKind, type AbilitySlot, type HeroId } from "../data/heroes";
import { MAP_W } from "../data/constants";
import { circleHitsObstacle } from "../data/maps";
import { clamp, dist, normalize, type Vec2 } from "../game/math";
import type { GameState } from "../game/state";
import {
  addFx,
  attackDamage,
  damageEnemiesInRadius,
  enemyInAttackRange,
  nearestEnemy,
  pushProjectile,
  applySlow,
} from "./combat";
import { mobilityCdMul } from "./relics";
import { playSfx } from "./audio";

function dashHero(state: GameState, move: Vec2, distDash: number, color: string): void {
  let dx = move.x;
  let dy = move.y;
  if (Math.hypot(dx, dy) < 0.1) {
    const t = nearestEnemy(state);
    if (t) {
      const n = normalize(t.x - state.hero.x, t.y - state.hero.y);
      dx = n.x;
      dy = n.y;
    } else {
      dx = 1;
      dy = 0;
    }
  } else {
    const n = normalize(dx, dy);
    dx = n.x;
    dy = n.y;
  }
  const map = state.map;
  const r = state.hero.radius;
  const nx = clamp(state.hero.x + dx * distDash, r, MAP_W - r);
  const ny = clamp(state.hero.y + dy * distDash, map.laneTop + r, map.laneBottom - r);
  if (!map.obstacles.some((o) => circleHitsObstacle(nx, ny, r, o))) {
    state.hero.x = nx;
    state.hero.y = ny;
  } else if (!map.obstacles.some((o) => circleHitsObstacle(nx, state.hero.y, r, o))) {
    state.hero.x = nx;
  } else if (!map.obstacles.some((o) => circleHitsObstacle(state.hero.x, ny, r, o))) {
    state.hero.y = ny;
  }
  addFx(state, state.hero.x, state.hero.y, 28, color);
}

function castDash(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 110, "#7ef0ff");
  return true;
}

function castSlide(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 140, "#ff8866");
  return true;
}

function castBulwark(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 85, "#ffe08a");
  state.hero.barrierTimer = 2.2;
  return true;
}

function castAnchor(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 70, "#c8b8ff");
  state.hero.barrierTimer = 1.6;
  return true;
}

function castPhase(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 150, "#5ef0a8");
  return true;
}

function castGlide(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 120, "#a8e0ff");
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist(state.hero, e) <= 70 + e.radius) applySlow(e, 0.55, 1.4);
  }
  return true;
}

function castFrostNova(state: GameState): boolean {
  damageEnemiesInRadius(state, state.hero.x, state.hero.y, 95, attackDamage(state) * 1.6);
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist(state.hero, e) <= 95 + e.radius) applySlow(e, 0.4, 2.2);
  }
  addFx(state, state.hero.x, state.hero.y, 95, "#7ec8ff88", 0.45);
  return true;
}

function castBlinkRng(state: GameState, move: Vec2): boolean {
  const distDash = 70 + Math.random() * 90;
  dashHero(state, move, distDash, "#e070d0");
  if (Math.random() < 0.25) {
    // Refund handled by caller via negative CD
    state.hero.abilityCds[0] = -0.01;
  }
  return true;
}

function castChaosBurst(state: GameState): boolean {
  const roll = Math.random();
  if (roll < 0.34) {
    return castVolley(state);
  }
  if (roll < 0.67) {
    damageEnemiesInRadius(state, state.hero.x, state.hero.y, 100, attackDamage(state) * 2);
    addFx(state, state.hero.x, state.hero.y, 100, "#e070d088", 0.4);
    return true;
  }
  return castPiercer(state);
}

function castVolley(state: GameState): boolean {
  const target = nearestEnemy(state);
  let angle = 0;
  if (target) angle = Math.atan2(target.y - state.hero.y, target.x - state.hero.x);
  const dmg = attackDamage(state) * 0.75;
  const spread = 0.35;
  for (let i = -2; i <= 2; i++) {
    const a = angle + i * spread;
    pushProjectile(state, {
      x: state.hero.x,
      y: state.hero.y,
      vx: Math.cos(a) * 540,
      vy: Math.sin(a) * 540,
      damage: dmg,
      radius: 3.5,
      kind: "bolt",
      color: "#9ad4ff",
    });
  }
  addFx(state, state.hero.x, state.hero.y, 26, "#9ad4ff");
  return true;
}

function castWhirlwind(state: GameState): boolean {
  state.hero.whirlwindTimer = 1.4;
  addFx(state, state.hero.x, state.hero.y, 70, "#ffb06088");
  return true;
}

function castBuckshot(state: GameState): boolean {
  const target = nearestEnemy(state);
  let angle = 0;
  if (target) angle = Math.atan2(target.y - state.hero.y, target.x - state.hero.x);
  const dmg = attackDamage(state) * 1.1;
  for (let i = -4; i <= 4; i++) {
    const a = angle + i * 0.18;
    pushProjectile(state, {
      x: state.hero.x,
      y: state.hero.y,
      vx: Math.cos(a) * 520,
      vy: Math.sin(a) * 520,
      damage: dmg,
      radius: 3.5,
      kind: "pellet",
      color: "#ff6644",
      life: 0.28,
    });
  }
  addFx(state, state.hero.x, state.hero.y, 40, "#ff664488");
  return true;
}

function castPiercer(state: GameState): boolean {
  const target = nearestEnemy(state);
  let angle = 0;
  if (target) angle = Math.atan2(target.y - state.hero.y, target.x - state.hero.x);
  pushProjectile(state, {
    x: state.hero.x,
    y: state.hero.y,
    vx: Math.cos(angle) * 600,
    vy: Math.sin(angle) * 600,
    damage: attackDamage(state) * 2.4,
    radius: 9,
    kind: "heavy",
    color: "#e8d8ff",
    pierceLeft: 6,
  });
  addFx(state, state.hero.x, state.hero.y, 30, "#c8b8ff");
  return true;
}

function castBeamstorm(state: GameState): boolean {
  damageEnemiesInRadius(state, state.hero.x, state.hero.y, 110, attackDamage(state) * 2.2);
  addFx(state, state.hero.x, state.hero.y, 110, "#5ef0a866", 0.5);
  return true;
}

function castZip(state: GameState, move: Vec2): boolean {
  const aim = normalize(state.aimWorldX - state.hero.x, state.aimWorldY - state.hero.y);
  const dir =
    Math.hypot(aim.x, aim.y) > 0.1
      ? aim
      : Math.hypot(move.x, move.y) > 0.1
        ? normalize(move.x, move.y)
        : { x: 1, y: 0 };
  dashHero(state, dir, 130, "#ffd24a");
  state.hero.zipSpeedTimer = 1.2;
  return true;
}

function castStormCage(state: GameState): boolean {
  state.hero.stormCageTimer = 2.2;
  addFx(state, state.hero.x, state.hero.y, 95, "#ffd24a66", 0.45);
  damageEnemiesInRadius(state, state.hero.x, state.hero.y, 95, attackDamage(state) * 1.4);
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist(state.hero, e) <= 95 + e.radius) applySlow(e, 0.5, 1.8);
  }
  return true;
}

function castBurrow(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 125, "#6bcf5a");
  state.hero.barrierTimer = Math.max(state.hero.barrierTimer, 1.5);
  return true;
}

function castBloom(state: GameState): boolean {
  const dmg = attackDamage(state) * 2.1;
  damageEnemiesInRadius(state, state.hero.x, state.hero.y, 100, dmg);
  state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + state.hero.maxHp * 0.22);
  addFx(state, state.hero.x, state.hero.y, 100, "#6bcf5a88", 0.5);
  return true;
}

const CASTERS: Record<AbilityKind, (state: GameState, move: Vec2) => boolean> = {
  dash: (s, m) => castDash(s, m),
  slide: (s, m) => castSlide(s, m),
  bulwark: (s, m) => castBulwark(s, m),
  anchor: (s, m) => castAnchor(s, m),
  phase: (s, m) => castPhase(s, m),
  glide: (s, m) => castGlide(s, m),
  blinkrng: (s, m) => castBlinkRng(s, m),
  volley: (s) => castVolley(s),
  whirlwind: (s) => castWhirlwind(s),
  buckshot: (s) => castBuckshot(s),
  piercer: (s) => castPiercer(s),
  beamstorm: (s) => castBeamstorm(s),
  frostnova: (s) => castFrostNova(s),
  chaosburst: (s) => castChaosBurst(s),
  zip: (s, m) => castZip(s, m),
  stormcage: (s) => castStormCage(s),
  burrow: (s, m) => castBurrow(s, m),
  bloom: (s) => castBloom(s),
};

export function tryCastAbility(state: GameState, slot: AbilitySlot, move: Vec2): void {
  const hero = HEROES[state.hero.heroId as HeroId];
  const index = hero.abilities.findIndex((a) => a.slot === slot);
  if (index < 0) return;
  const ability = hero.abilities[index]!;
  if (state.hero.abilityCds[index]! > 0) return;

  // Engage heroes need a foe in range for ultimates (mobility always ok).
  if (slot === "ultimate" && hero.aimMode === "engage" && !enemyInAttackRange(state)) {
    return;
  }

  const ok = CASTERS[ability.id](state, move);
  if (ok) {
    let cd = ability.cooldown;
    if (slot === "mobility") cd *= mobilityCdMul(state);
    // blinkrng may have set CD negative to refund
    if ((state.hero.abilityCds[index] ?? 0) < 0) {
      state.hero.abilityCds[index] = 0;
      state.toast = `${ability.name} (proc!)`;
    } else {
      state.hero.abilityCds[index] = cd;
      state.toast = ability.name;
    }
    state.toastTimer = 0.9;
    playSfx("cast");
  }
}

export function tickAbilityEffects(state: GameState, dt: number): void {
  if (state.hero.barrierTimer > 0) {
    state.hero.barrierTimer = Math.max(0, state.hero.barrierTimer - dt);
  }
  if (state.hero.whirlwindTimer > 0) {
    state.hero.whirlwindTimer = Math.max(0, state.hero.whirlwindTimer - dt);
    const dmg = attackDamage(state) * 0.55 * dt;
    damageEnemiesInRadius(state, state.hero.x, state.hero.y, 72, dmg);
  }
  if ((state.hero.marksmanTimer ?? 0) > 0) {
    state.hero.marksmanTimer = Math.max(0, (state.hero.marksmanTimer ?? 0) - dt);
  }
  if ((state.hero.overchargeTimer ?? 0) > 0) {
    state.hero.overchargeTimer = Math.max(0, (state.hero.overchargeTimer ?? 0) - dt);
  }
  if ((state.hero.zipSpeedTimer ?? 0) > 0) {
    state.hero.zipSpeedTimer = Math.max(0, (state.hero.zipSpeedTimer ?? 0) - dt);
  }
  if ((state.hero.stormCageTimer ?? 0) > 0) {
    state.hero.stormCageTimer = Math.max(0, (state.hero.stormCageTimer ?? 0) - dt);
    const dmg = attackDamage(state) * 0.7 * dt;
    damageEnemiesInRadius(state, state.hero.x, state.hero.y, 95, dmg);
    if (Math.floor(state.hero.stormCageTimer * 8) !== Math.floor((state.hero.stormCageTimer + dt) * 8)) {
      addFx(state, state.hero.x, state.hero.y, 95, "#ffd24a33", 0.12);
    }
  }
}

export { inHighGround, nearestEnemy, attackDamage } from "./combat";
