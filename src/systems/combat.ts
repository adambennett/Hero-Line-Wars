import { HEROES, type AttackStyle, type HeroId } from "../data/heroes";
import type { RelicId } from "../data/relics";
import type { HighGroundZone } from "../data/maps";
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

  if (opts?.lifesteal || (opts?.fromBasic && hasRelic(state, "hungry_blade"))) {
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + dmg * 0.18);
  }
  if (opts?.slow || (opts?.fromBasic && (state.hero.heroId === "frost" || hasRelic(state, "frost_sigil")))) {
    applySlow(e, state.hero.heroId === "frost" ? 0.6 : 0.75, state.hero.heroId === "frost" ? 1.5 : 1.2);
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

function aimAngle(state: GameState, target: EnemyUnit | null): number {
  if (target) return Math.atan2(target.y - state.hero.y, target.x - state.hero.x);
  return 0;
}

const CHAOS_STYLES: AttackStyle[] = ["bolt", "shotgun", "cleave", "heavy"];

function fireStyle(
  state: GameState,
  style: AttackStyle,
  target: EnemyUnit,
  dmg: number,
  angle: number,
  bounce: number,
): void {
  const heroDef = HEROES[state.hero.heroId as HeroId];
  switch (style) {
    case "bolt":
    case "frostbolt": {
      const n = normalize(target.x - state.hero.x, target.y - state.hero.y);
      pushProjectile(state, {
        x: state.hero.x,
        y: state.hero.y,
        vx: n.x * (heroDef.projectileSpeed || 500),
        vy: n.y * (heroDef.projectileSpeed || 500),
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
      const facing = normalize(target.x - state.hero.x, target.y - state.hero.y);
      addFx(state, state.hero.x + facing.x * 28, state.hero.y + facing.y * 28, 42, "#ffe08a88", 0.2);
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (dist(state.hero, e) > heroDef.attackRange + e.radius) continue;
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
      const n = normalize(target.x - state.hero.x, target.y - state.hero.y);
      pushProjectile(state, {
        x: state.hero.x,
        y: state.hero.y,
        vx: n.x * (heroDef.projectileSpeed || 420),
        vy: n.y * (heroDef.projectileSpeed || 420),
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
      const n = normalize(target.x - state.hero.x, target.y - state.hero.y);
      const len = heroDef.attackRange;
      addFx(
        state,
        state.hero.x + n.x * (len * 0.45),
        state.hero.y + n.y * (len * 0.45),
        18,
        "#5ef0a888",
        0.1,
      );
      state.beam = {
        x1: state.hero.x,
        y1: state.hero.y,
        x2: state.hero.x + n.x * len,
        y2: state.hero.y + n.y * len,
        life: 0.08,
      };
      for (const e of state.enemies) {
        if (!e.alive) continue;
        const dx = n.x * len;
        const dy = n.y * len;
        const t = Math.max(
          0,
          Math.min(1, ((e.x - state.hero.x) * dx + (e.y - state.hero.y) * dy) / (len * len)),
        );
        const px = state.hero.x + dx * t;
        const py = state.hero.y + dy * t;
        if (dist({ x: px, y: py }, e) <= e.radius + 10) {
          damageEnemy(state, e, dmg * 0.55, { fromBasic: true });
        }
      }
      break;
    }
    case "chaos":
      break;
  }
}

/** Fire the hero's unique basic attack toward the nearest in-range enemy. */
export function tryBasicAttack(state: GameState): boolean {
  const heroDef = HEROES[state.hero.heroId as HeroId];
  const target = nearestEnemy(state);
  if (!target || dist(state.hero, target) > heroDef.attackRange) return false;

  const dmg = attackDamage(state);
  const angle = aimAngle(state, target);
  const bounce = hasRelic(state, "chain_spark") ? 1 : 0;

  let style = heroDef.attackStyle;
  if (style === "chaos") {
    const idx = state.hero.chaosIndex ?? 0;
    style = CHAOS_STYLES[idx % CHAOS_STYLES.length]!;
    state.hero.chaosIndex = idx + 1;
  }

  fireStyle(state, style, target, dmg, angle, bounce);
  state.hero.attackCd = attackCooldown(state);
  return true;
}

export function bounceProjectile(state: GameState, p: Projectile, hitId: number): boolean {
  if ((p.bouncesLeft ?? 0) <= 0) return false;
  const next = nearestEnemy(state, p, hitId);
  if (!next) return false;
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
