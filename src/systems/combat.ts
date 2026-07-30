import { HEROES, type AttackStyle, type HeroId } from "../data/heroes";
import type { RelicId } from "../data/relics";
import type { HighGroundZone } from "../data/maps";
import { hasLineOfSight, rayObstacleHitT } from "../data/maps";
import { dist, normalize, type Vec2 } from "../game/math";
import type { EnemyUnit, GameState, Projectile } from "../game/state";
import { hasRelic } from "./relics";
import { grantKillXp } from "./xp";
import { playSfx } from "./audio";

export function highGroundAt(state: GameState, p: Vec2): HighGroundZone | null {
  for (const z of state.map.highGrounds) {
    if (p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) return z;
  }
  return null;
}

export function inHighGround(state: GameState, p: Vec2): boolean {
  return highGroundAt(state, p) !== null;
}

export function nearestEnemy(state: GameState, from?: Vec2, excludeId?: number): EnemyUnit | null {
  const origin = from ?? state.hero;
  let best: EnemyUnit | null = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (excludeId !== undefined && e.id === excludeId) continue;
    const d = dist(origin, e);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

export function applySlow(e: EnemyUnit, mul: number, duration: number): void {
  e.slowMul = Math.min(e.slowMul ?? 1, mul);
  e.slowTimer = Math.max(e.slowTimer ?? 0, duration);
}

export function attackDamage(state: GameState): number {
  const hero = HEROES[state.hero.heroId];
  let base = hero.attackDamage + state.hero.damageBonus;
  if (hasRelic(state, "blood_price")) base *= 1.35;
  if (hasRelic(state, "overcharge")) base *= 0.85;
  if (hasRelic(state, "glass_cannon")) base *= 1.15;
  if (hasRelic(state, "legend_crown")) base *= 1.15;
  const zone = highGroundAt(state, state.hero);
  const hg = zone
    ? 1 + (hasRelic(state, "high_ground_oath") ? zone.oathDamageBonus : zone.damageBonus)
    : 1;
  let dmg = base * hg;

  // Scatter Close Quarters
  if (state.hero.heroId === "scatter") {
    const near = state.enemies.some(
      (e) => e.alive && dist(state.hero, e) <= 90 + e.radius,
    );
    if (near) dmg *= 1.3;
  }

  if ((state.hero.overchargeTimer ?? 0) > 0) dmg *= 1.2;

  if (state.hero.luck > 0 && Math.random() < state.hero.luck) {
    dmg *= 1.75;
  }
  return dmg;
}

export function attackCooldown(state: GameState): number {
  const hero = HEROES[state.hero.heroId];
  let cd = hero.attackCooldown * state.hero.attackSpeedMul;
  if (hasRelic(state, "overcharge")) cd *= 0.7;
  if ((state.hero.marksmanTimer ?? 0) > 0) cd *= 0.75;
  return cd;
}

export function pushProjectile(
  state: GameState,
  partial: Omit<Projectile, "alive"> & { alive?: boolean },
): void {
  state.projectiles.push({ alive: true, ...partial });
}

export function addFx(
  state: GameState,
  x: number,
  y: number,
  radius: number,
  color: string,
  life = 0.35,
): void {
  state.fx.push({ x, y, radius, color, life, maxLife: life });
}

export function killEnemy(state: GameState, e: EnemyUnit): void {
  if (!e.alive) return;
  e.alive = false;
  let gold = e.goldReward;
  if (hasRelic(state, "gold_fever")) gold *= 1.6;
  gold += state.hero.killGoldBonus;
  state.gold += gold;
  grantKillXp(state, e);
  // Ranger Marksman
  if (state.hero.heroId === "ranger") {
    state.hero.marksmanTimer = 2.5;
  }
  // Coil Overcharge
  if (state.hero.heroId === "coil") {
    state.hero.overchargeTimer = 2;
  }
}

export function damageEnemy(
  state: GameState,
  e: EnemyUnit,
  damage: number,
  opts?: { lifesteal?: boolean; splash?: boolean; fromBasic?: boolean; slow?: boolean },
): void {
  if (!e.alive || damage <= 0) return;

  let dmg = damage;
  if (opts?.fromBasic && state.hero.heroId === "arbalest") {
    if (e.kind === "brute" || e.kind === "elite" || e.kind === "boss") dmg *= 1.4;
  }

  e.hp -= dmg;
  if (opts?.fromBasic || dmg >= 3) playSfx("hit");

  if (
    opts?.lifesteal ||
    (opts?.fromBasic && hasRelic(state, "hungry_blade")) ||
    (opts?.fromBasic && state.hero.heroId === "thorn")
  ) {
    const steal = state.hero.heroId === "thorn" && opts?.fromBasic ? 0.12 : 0.18;
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + dmg * steal);
  }
  if (
    opts?.slow ||
    (opts?.fromBasic &&
      (state.hero.heroId === "frost" || state.hero.heroId === "thorn" || hasRelic(state, "frost_sigil")))
  ) {
    const mul = state.hero.heroId === "thorn" ? 0.35 : state.hero.heroId === "frost" ? 0.6 : 0.75;
    const dur = state.hero.heroId === "thorn" ? 0.85 : state.hero.heroId === "frost" ? 1.5 : 1.2;
    applySlow(e, mul, dur);
  }
  if ((opts?.splash || (opts?.fromBasic && hasRelic(state, "splinter_tip"))) && e.alive) {
    const splash = dmg * 0.4;
    for (const other of state.enemies) {
      if (!other.alive || other.id === e.id) continue;
      if (dist(e, other) <= 55 + other.radius) {
        other.hp -= splash;
        if (other.hp <= 0) killEnemy(state, other);
      }
    }
  }
  // Prism Refraction
  if (opts?.fromBasic && state.hero.heroId === "prism" && e.alive) {
    const other = nearestEnemy(state, e, e.id);
    if (other && dist(e, other) <= 80) {
      other.hp -= dmg * 0.25;
      if (other.hp <= 0) killEnemy(state, other);
    }
  }
  if (e.hp <= 0) killEnemy(state, e);
}

export function damageEnemiesInRadius(
  state: GameState,
  x: number,
  y: number,
  radius: number,
  damage: number,
  opts?: { fromBasic?: boolean },
): number {
  let hits = 0;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist({ x, y }, e) <= radius + e.radius) {
      damageEnemy(state, e, damage, { fromBasic: opts?.fromBasic, lifesteal: opts?.fromBasic });
      hits += 1;
    }
  }
  return hits;
}

function aimDirFromMouse(state: GameState): Vec2 {
  const dx = state.aimWorldX - state.hero.x;
  const dy = state.aimWorldY - state.hero.y;
  const n = normalize(dx, dy);
  if (n.x === 0 && n.y === 0) return { x: 1, y: 0 };
  return n;
}

const CHAOS_STYLES: AttackStyle[] = ["bolt", "shotgun", "cleave", "heavy"];

function fireStyle(
  state: GameState,
  style: AttackStyle,
  facing: Vec2,
  angle: number,
  dmg: number,
  bounce: number,
): void {
  const heroDef = HEROES[state.hero.heroId as HeroId];
  switch (style) {
    case "bolt":
    case "frostbolt": {
      pushProjectile(state, {
        x: state.hero.x,
        y: state.hero.y,
        vx: facing.x * (heroDef.projectileSpeed || 500),
        vy: facing.y * (heroDef.projectileSpeed || 500),
        damage: dmg,
        radius: style === "frostbolt" ? 5 : 4,
        kind: "bolt",
        color: style === "frostbolt" ? "#a8e0ff" : "#ffcc55",
        bouncesLeft: bounce,
        fromBasic: true,
        appliesSlow: style === "frostbolt",
      });
      break;
    }
    case "cleave": {
      addFx(state, state.hero.x + facing.x * 28, state.hero.y + facing.y * 28, 42, "#ffe08a88", 0.2);
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (dist(state.hero, e) > heroDef.attackRange + e.radius) continue;
        if (!hasLineOfSight(state.map, state.hero.x, state.hero.y, e.x, e.y)) continue;
        const toE = normalize(e.x - state.hero.x, e.y - state.hero.y);
        const dot = facing.x * toE.x + facing.y * toE.y;
        if (dot > 0.25) damageEnemy(state, e, dmg, { fromBasic: true });
      }
      break;
    }
    case "shotgun": {
      const spread = 0.28;
      for (let i = -2; i <= 2; i++) {
        const a = angle + i * spread;
        pushProjectile(state, {
          x: state.hero.x,
          y: state.hero.y,
          vx: Math.cos(a) * (heroDef.projectileSpeed || 480),
          vy: Math.sin(a) * (heroDef.projectileSpeed || 480),
          damage: dmg,
          radius: 3,
          kind: "pellet",
          color: "#ff8866",
          life: 0.35,
          bouncesLeft: 0,
          fromBasic: true,
        });
      }
      break;
    }
    case "heavy": {
      pushProjectile(state, {
        x: state.hero.x,
        y: state.hero.y,
        vx: facing.x * (heroDef.projectileSpeed || 420),
        vy: facing.y * (heroDef.projectileSpeed || 420),
        damage: dmg,
        radius: 7,
        kind: "heavy",
        color: "#c8b8ff",
        pierceLeft: 2,
        bouncesLeft: bounce,
        fromBasic: true,
      });
      break;
    }
    case "beam": {
      let len = heroDef.attackRange;
      const endX = state.hero.x + facing.x * len;
      const endY = state.hero.y + facing.y * len;
      const hitT = rayObstacleHitT(state.map, state.hero.x, state.hero.y, endX, endY, 6);
      if (hitT != null) len *= Math.max(0.05, hitT);
      addFx(
        state,
        state.hero.x + facing.x * (len * 0.45),
        state.hero.y + facing.y * (len * 0.45),
        18,
        "#5ef0a888",
        0.1,
      );
      state.beam = {
        x1: state.hero.x,
        y1: state.hero.y,
        x2: state.hero.x + facing.x * len,
        y2: state.hero.y + facing.y * len,
        life: 0.08,
      };
      for (const e of state.enemies) {
        if (!e.alive) continue;
        const dx = facing.x * len;
        const dy = facing.y * len;
        const t = Math.max(
          0,
          Math.min(1, ((e.x - state.hero.x) * dx + (e.y - state.hero.y) * dy) / (len * len || 1)),
        );
        const px = state.hero.x + dx * t;
        const py = state.hero.y + dy * t;
        if (dist({ x: px, y: py }, e) <= e.radius + 10) {
          // Extra beam tick multiplier kept low after Prism base-damage nerf.
          damageEnemy(state, e, dmg * 0.45, { fromBasic: true });
        }
      }
      break;
    }
    case "chain": {
      pushProjectile(state, {
        x: state.hero.x,
        y: state.hero.y,
        vx: facing.x * (heroDef.projectileSpeed || 620),
        vy: facing.y * (heroDef.projectileSpeed || 620),
        damage: dmg,
        radius: 4.5,
        kind: "bolt",
        color: "#ffd24a",
        bouncesLeft: Math.max(2, bounce + 2),
        fromBasic: true,
      });
      break;
    }
    case "vine": {
      pushProjectile(state, {
        x: state.hero.x,
        y: state.hero.y,
        vx: facing.x * (heroDef.projectileSpeed || 480),
        vy: facing.y * (heroDef.projectileSpeed || 480),
        damage: dmg,
        radius: 5,
        kind: "bolt",
        color: "#6bcf5a",
        bouncesLeft: bounce,
        fromBasic: true,
        appliesSlow: true,
      });
      break;
    }
    case "chaos":
      break;
  }
}

export function enemyInAttackRange(state: GameState): boolean {
  const heroDef = HEROES[state.hero.heroId as HeroId];
  const range = heroDef.attackRange;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist(state.hero, e) <= range + e.radius) return true;
  }
  return false;
}

/**
 * Fire basic attack.
 * - auto (Prism): beam auto-aims nearest foe in range
 * - free: fire along mouse aim with no engage gate
 * - engage: must have an enemy inside attackRange
 */
export function tryBasicAttack(state: GameState): boolean {
  const heroDef = HEROES[state.hero.heroId as HeroId];

  let facing: Vec2;
  if (heroDef.aimMode === "auto") {
    const target = nearestEnemy(state);
    if (!target || dist(state.hero, target) > heroDef.attackRange) return false;
    facing = normalize(target.x - state.hero.x, target.y - state.hero.y);
  } else {
    if (heroDef.aimMode === "engage" && !enemyInAttackRange(state)) return false;
    facing = aimDirFromMouse(state);
  }

  const angle = Math.atan2(facing.y, facing.x);
  const dmg = attackDamage(state);
  const bounce = hasRelic(state, "chain_spark") ? 1 : 0;

  let style = heroDef.attackStyle;
  if (style === "chaos") {
    const idx = state.hero.chaosIndex ?? 0;
    style = CHAOS_STYLES[idx % CHAOS_STYLES.length]!;
    state.hero.chaosIndex = idx + 1;
  }

  fireStyle(state, style, facing, angle, dmg, bounce);
  state.hero.attackCd = attackCooldown(state);
  return true;
}

export function bounceProjectile(state: GameState, p: Projectile, hitId: number): boolean {
  if ((p.bouncesLeft ?? 0) <= 0) return false;
  const next = nearestEnemy(state, p, hitId);
  if (!next) return false;
  if (!hasLineOfSight(state.map, p.x, p.y, next.x, next.y, p.radius)) return false;
  p.bouncesLeft = (p.bouncesLeft ?? 0) - 1;
  p.damage *= 0.6;
  const n = normalize(next.x - p.x, next.y - p.y);
  const spd = Math.hypot(p.vx, p.vy) || 400;
  p.vx = n.x * spd;
  p.vy = n.y * spd;
  return true;
}

export function applyPlayerDamage(state: GameState, amount: number): void {
  if (amount <= 0 || !state.hero.alive) return;
  let dmg = amount;
  if (hasRelic(state, "blood_price")) dmg *= 1.25;
  state.hero.hp -= dmg;
  state.damageFlash = Math.max(state.damageFlash, 0.28);
  state.vignette = Math.max(state.vignette, 0.45);
  state.hitFlash = Math.max(state.hitFlash, 0.18);
  state.shake = Math.max(state.shake, 0.22);
  if (state.toastTimer < 0.4) {
    state.toast = "Under attack!";
    state.toastTimer = 0.55;
  }
}

export type RelicCheck = RelicId;
