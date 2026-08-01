import type { MapDef, Obstacle } from "../data/maps";
import {
  circleHitsObstacle,
  firstBlockingObstacle,
  hasLineOfSight,
  pointBlocked,
} from "../data/maps";
import { ENEMY_DEFS, isBossKind, isEliteKind, type EnemyDef, type EnemyKind } from "../data/enemies";
import {
  ENEMY_CAMP_BREAK_SEC,
  ENEMY_STUCK_DESPAWN_SEC,
  ENEMY_STUCK_ESCALATE,
  ENEMY_STUCK_SEC,
  MAP_W,
  WAVE_SCALE,
} from "../data/constants";
import { clamp, dist, normalize } from "../game/math";
import type { EnemyUnit, GameState, HeroRuntime, TurretUnit } from "../game/state";
import { addFx, applyPlayerDamage, killEnemy, pushProjectile } from "./combat";
import { baseDamageTakenMul } from "./relics";
import { damageTurret, livingTurrets } from "./turrets";
import { playSfx } from "./audio";
import { heroHasPassive } from "../custom/registry";

function livingHeroes(state: GameState): HeroRuntime[] {
  const list = [state.hero, ...(state.allies ?? [])];
  return list.filter((h) => h.alive);
}

function nearestLivingHero(state: GameState, from: { x: number; y: number }): HeroRuntime | null {
  let best: HeroRuntime | null = null;
  let bestD = Infinity;
  for (const h of livingHeroes(state)) {
    const d = dist(from, h);
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

function damageHero(state: GameState, hero: HeroRuntime, amount: number): void {
  const prev = state.hero;
  state.hero = hero;
  applyPlayerDamage(state, amount);
  if (prev !== hero) state.hero = prev;
}

function resolveTarget(
  state: GameState,
  e: EnemyUnit,
): { x: number; y: number; kind: "base" | "hero" | "turret"; turret?: TurretUnit; hero?: HeroRuntime } {
  const base = state.map.base;
  const turrets = livingTurrets(state);

  if (e.intent === "ignore_turrets") {
    return { x: base.x, y: base.y, kind: "base" };
  }

  if (e.intent === "turret") {
    const nearest = nearestTurret(e, turrets);
    if (nearest) return { x: nearest.x, y: nearest.y, kind: "turret", turret: nearest };
    return { x: base.x, y: base.y, kind: "base" };
  }

  if (e.intent === "base") {
    return { x: base.x, y: base.y, kind: "base" };
  }

  if (e.intent === "hero") {
    const h = nearestLivingHero(state, e);
    if (h) return { x: h.x, y: h.y, kind: "hero", hero: h };
    return { x: base.x, y: base.y, kind: "base" };
  }

  type Cand = {
    x: number;
    y: number;
    kind: "base" | "hero" | "turret";
    d: number;
    turret?: TurretUnit;
    hero?: HeroRuntime;
  };
  const cands: Cand[] = [{ x: base.x, y: base.y, kind: "base", d: dist(e, base) }];
  for (const h of livingHeroes(state)) {
    cands.push({ x: h.x, y: h.y, kind: "hero", d: dist(e, h), hero: h });
  }
  for (const t of turrets) {
    cands.push({ x: t.x, y: t.y, kind: "turret", d: dist(e, t), turret: t });
  }
  cands.sort((a, b) => a.d - b.d);
  const best = cands[0]!;
  return { x: best.x, y: best.y, kind: best.kind, turret: best.turret, hero: best.hero };
}

function nearestTurret(from: { x: number; y: number }, turrets: TurretUnit[]): TurretUnit | null {
  let best: TurretUnit | null = null;
  let bestD = Infinity;
  for (const t of turrets) {
    const d = dist(from, t);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

function tryMove(map: MapDef, e: EnemyUnit, nx: number, ny: number): boolean {
  const r = e.radius;
  const x = clamp(nx, r, MAP_W - r);
  const y = clamp(ny, map.laneTop + r, map.laneBottom - r);
  const blocked = map.obstacles.some((o) => circleHitsObstacle(x, y, r, o));
  if (!blocked) {
    e.x = x;
    e.y = y;
    return true;
  }
  const xOnly = clamp(nx, r, MAP_W - r);
  if (!map.obstacles.some((o) => circleHitsObstacle(xOnly, e.y, r, o))) {
    e.x = xOnly;
    return true;
  }
  const yOnly = clamp(ny, map.laneTop + r, map.laneBottom - r);
  if (!map.obstacles.some((o) => circleHitsObstacle(e.x, yOnly, r, o))) {
    e.y = yOnly;
    return true;
  }
  return false;
}

function clampLanePoint(map: MapDef, x: number, y: number, r: number): { x: number; y: number } {
  return {
    x: clamp(x, r, MAP_W - r),
    y: clamp(y, map.laneTop + r, map.laneBottom - r),
  };
}

/** Clear corner waypoints around an AABB so units route instead of ramming. */
function bypassWaypoints(
  map: MapDef,
  e: EnemyUnit,
  obs: Obstacle,
  tx: number,
): { top: { x: number; y: number }; bot: { x: number; y: number } } {
  const pad = e.radius + 18;
  const goingLeft = tx <= e.x;
  // Approach the near face, then clear past the far face toward the goal.
  const nearX = goingLeft ? obs.x + obs.w + pad : obs.x - pad;
  const farX = goingLeft ? obs.x - pad : obs.x + obs.w + pad;
  // Prefer the far side once we're already beside the rock vertically.
  const beside =
    e.y <= obs.y - e.radius * 0.35 || e.y >= obs.y + obs.h + e.radius * 0.35;
  const aimX = beside ? farX : nearX;
  return {
    top: clampLanePoint(map, aimX, obs.y - pad, e.radius),
    bot: clampLanePoint(map, aimX, obs.y + obs.h + pad, e.radius),
  };
}

function pickBypassPoint(
  map: MapDef,
  e: EnemyUnit,
  obs: Obstacle,
  tx: number,
  ty: number,
): { x: number; y: number } {
  const { top, bot } = bypassWaypoints(map, e, obs, tx);
  const score = (p: { x: number; y: number }, side: -1 | 1): number => {
    let s = 0;
    if (hasLineOfSight(map, e.x, e.y, p.x, p.y, e.radius)) s += 120;
    else s -= 40;
    if (hasLineOfSight(map, p.x, p.y, tx, ty, e.radius)) s += 80;
    s -= dist(p, { x: tx, y: ty }) * 0.15;
    if (e.pathSide === side) s += 55;
    if ((side === -1 && ty < e.y) || (side === 1 && ty > e.y)) s += 12;
    if (pointBlocked(map, p.x, p.y, e.radius)) s -= 200;
    return s;
  };
  const topScore = score(top, -1);
  const botScore = score(bot, 1);
  if (topScore >= botScore) {
    e.pathSide = -1;
    return top;
  }
  e.pathSide = 1;
  return bot;
}

/**
 * Obstacle-aware steering: go direct when LOS is clear, otherwise route around
 * the first blocking rock via sticky top/bottom bypass waypoints.
 */
function moveWithPathing(
  map: MapDef,
  e: EnemyUnit,
  tx: number,
  ty: number,
  speed: number,
  dt: number,
): void {
  const prevX = e.x;
  const prevY = e.y;
  const step = speed * dt;
  const clear = hasLineOfSight(map, e.x, e.y, tx, ty, e.radius);

  let aimX = tx;
  let aimY = ty;
  if (clear) {
    e.pathSide = undefined;
    e.preferAngle = undefined;
  } else {
    const blocker = firstBlockingObstacle(map, e.x, e.y, tx, ty, e.radius);
    if (blocker) {
      const wp = pickBypassPoint(map, e, blocker, tx, ty);
      aimX = wp.x;
      aimY = wp.y;
    }
  }

  const n = normalize(aimX - e.x, aimY - e.y);
  let moved = tryMove(map, e, e.x + n.x * step, e.y + n.y * step);

  // Local slide if the immediate step clips a corner
  if (!moved) {
    const baseAng = Math.atan2(n.y, n.x);
    const prefer = e.pathSide === -1 ? -1 : e.pathSide === 1 ? 1 : 0;
    const offsets =
      prefer === 0
        ? [0.4, -0.4, 0.85, -0.85, 1.35, -1.35, Math.PI * 0.5, -Math.PI * 0.5]
        : prefer < 0
          ? [-0.45, -0.9, -1.4, 0.45, 0.9, Math.PI * 0.5, -Math.PI * 0.5]
          : [0.45, 0.9, 1.4, -0.45, -0.9, -Math.PI * 0.5, Math.PI * 0.5];
    for (const off of offsets) {
      const a = baseAng + off;
      if (tryMove(map, e, e.x + Math.cos(a) * step, e.y + Math.sin(a) * step)) {
        moved = true;
        e.preferAngle = a;
        break;
      }
    }
  }

  if (!moved && e.preferAngle !== undefined) {
    const a = e.preferAngle;
    moved = tryMove(map, e, e.x + Math.cos(a) * step, e.y + Math.sin(a) * step);
  }

  const traveled = Math.hypot(e.x - prevX, e.y - prevY);
  const towardX = Math.sign(tx - prevX) || Math.sign(tx - e.x);
  const progressX = towardX * (e.x - prevX);
  // Stuck if blocked, or scraping a wall with almost no forward progress
  const scraping =
    traveled < step * 0.55 && progressX < step * 0.12 && !clear;
  if ((!moved && traveled < Math.max(0.8, step * 0.15)) || scraping) {
    e.stuckTimer = (e.stuckTimer ?? 0) + dt;
    e.stuckTotal = (e.stuckTotal ?? 0) + dt;
  } else {
    e.stuckTimer = 0;
    if (moved && traveled > step * 0.4) {
      e.stuckCount = 0;
      e.stuckTotal = Math.max(0, (e.stuckTotal ?? 0) - dt * 1.5);
    }
  }

  if ((e.stuckTimer ?? 0) >= ENEMY_STUCK_SEC) {
    unstuckToBypass(map, e, tx, ty);
    e.stuckTimer = 0;
    e.preferAngle = undefined;
  }
}

/** Last-resort hop onto a computed bypass point (not a blind base leap). */
function unstuckToBypass(map: MapDef, e: EnemyUnit, tx: number, ty: number): void {
  e.stuckCount = (e.stuckCount ?? 0) + 1;
  const escalate = (e.stuckCount ?? 0) >= ENEMY_STUCK_ESCALATE;
  const r = e.radius + 2;

  const tryPos = (nx: number, ny: number): boolean => {
    const p = clampLanePoint(map, nx, ny, r);
    if (pointBlocked(map, p.x, p.y, r)) return false;
    e.x = p.x;
    e.y = p.y;
    return true;
  };

  const blocker = firstBlockingObstacle(map, e.x, e.y, tx, ty, e.radius);
  if (blocker) {
    const { top, bot } = bypassWaypoints(map, e, blocker, tx);
    const order = e.pathSide === 1 ? [bot, top] : [top, bot];
    for (const p of order) {
      if (tryPos(p.x, p.y)) return;
    }
    const pad = escalate ? 36 : 22;
    if (tryPos(blocker.x + blocker.w * 0.5, blocker.y - pad)) return;
    if (tryPos(blocker.x + blocker.w * 0.5, blocker.y + blocker.h + pad)) return;
  }

  const toward = normalize(tx - e.x, ty - e.y);
  const perpX = -toward.y;
  const perpY = toward.x;
  for (const d of escalate ? [28, 48, 72, 96] : [18, 32, 48, 64]) {
    if (tryPos(e.x + perpX * d, e.y + perpY * d)) return;
    if (tryPos(e.x - perpX * d, e.y - perpY * d)) return;
  }
}

export function createEnemy(
  state: GameState,
  kind: EnemyKind,
  opts?: { hpScale?: number; sent?: boolean },
): EnemyUnit {
  const def = ENEMY_DEFS[kind];
  const map = state.map;
  const spread = (map.laneBottom - map.laneTop) * 0.35;
  let y = clamp(
    map.spawner.y + (Math.random() * 2 - 1) * spread,
    map.laneTop + 20,
    map.laneBottom - 20,
  );
  if (map.dualSpawners && map.spawnerAlt) {
    const band = state.mapActiveSpawner === 0 ? map.spawner : map.spawnerAlt;
    y = clamp(band.y + (Math.random() * 2 - 1) * 30, map.laneTop + 20, map.laneBottom - 20);
  }
  // Spawn slightly left of spawner, clear of obstacles
  let x = map.spawner.x - 24;
  const r = def.radius;
  for (let i = 0; i < 12; i++) {
    if (!pointBlocked(map, x, y, r)) break;
    y = clamp(y + ((i % 2 === 0 ? 1 : -1) * (20 + i * 8)), map.laneTop + r + 4, map.laneBottom - r - 4);
    x = map.spawner.x - 24 - i * 8;
  }

  const waveScale = 1 + (state.wave - 1) * WAVE_SCALE.hpPerWave;
  let tierMul = 1;
  if (isEliteKind(kind)) tierMul = WAVE_SCALE.eliteHpMul * state.modifiers.eliteBossHpExtra;
  if (isBossKind(kind)) tierMul = WAVE_SCALE.bossHpMul * state.modifiers.eliteBossHpExtra;
  const hpScale =
    (opts?.hpScale ?? 1) * waveScale * tierMul * state.modifiers.enemyHpMul;
  return {
    id: state.nextId++,
    x,
    y,
    hp: def.maxHp * hpScale,
    maxHp: def.maxHp * hpScale,
    radius: def.radius,
    alive: true,
    sent: opts?.sent ?? false,
    kind,
    intent: def.intent,
    speed: def.speed * (1 + (state.wave - 1) * 0.028) * state.modifiers.enemySpeedMul,
    contactDamage: def.contactDamage * (1 + (state.wave - 1) * 0.04) * state.modifiers.enemyDamageMul,
    baseDamage: def.baseDamage * state.modifiers.enemyDamageMul,
    goldReward: Math.max(1, Math.round(def.goldReward * state.modifiers.goldRewardMul)),
    ranged: def.ranged ?? false,
    attackRange: def.attackRange ?? 0,
    attackCooldown: def.attackCooldown ?? 1,
    attackCd: Math.random() * 0.6,
    attackDamage:
      (def.attackDamage ?? 0) * (1 + (state.wave - 1) * 0.05) * state.modifiers.enemyDamageMul,
    projectileSpeed: def.projectileSpeed ?? 0,
    slamRadius: def.slamRadius,
    slamDamage: def.slamDamage
      ? def.slamDamage * (1 + (state.wave - 1) * 0.06) * state.modifiers.enemyDamageMul
      : undefined,
    slamCooldown: def.slamCooldown,
    slamCd: def.slamCooldown ? def.slamCooldown * 0.6 : 0,
    telegraph: 0,
    turretDamage: def.turretDamage ?? 12,
    slowTimer: 0,
    slowMul: 1,
    stuckTimer: 0,
    stuckTotal: 0,
    stuckCount: 0,
    dashTimer: 0,
    dashCd: def.dashCooldown ? Math.random() * def.dashCooldown : 0,
  };
}

function fireEnemyShot(
  state: GameState,
  e: EnemyUnit,
  focus: { x: number; y: number },
  def: EnemyDef,
): void {
  const baseAng = Math.atan2(focus.y - e.y, focus.x - e.x);
  const count = Math.max(1, def.projectileCount ?? 1);
  const spread = def.projectileSpread ?? 0;
  const spd = e.projectileSpeed || def.projectileSpeed || 280;

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
    const ang = baseAng + t * spread;
    pushProjectile(state, {
      x: e.x,
      y: e.y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      damage: e.attackDamage * (count > 1 ? 0.85 : 1),
      radius: def.projectileRadius ?? 4,
      kind: "enemy",
      color: def.projectileColor ?? "#88b0ff",
      hostile: true,
      aoeRadius: def.projectileAoe,
      life: def.projectileLife,
      heroSlowMul: def.heroSlowMul,
      heroSlowDuration: def.heroSlowDuration,
    });
  }
}

export function updateEnemies(state: GameState, dt: number): void {
  const map = state.map;
  const base = map.base;

  for (const e of state.enemies) {
    if (!e.alive) continue;

    if ((e.slowTimer ?? 0) > 0) {
      e.slowTimer = (e.slowTimer ?? 0) - dt;
      if ((e.slowTimer ?? 0) <= 0) {
        e.slowTimer = 0;
        e.slowMul = 1;
      }
    }
    // Hex poison / Ember burn DoTs
    if ((e.dotTimer ?? 0) > 0) {
      e.dotTimer = (e.dotTimer ?? 0) - dt;
      const dps = e.dotDps ?? 0;
      if (dps > 0) {
        e.hp -= dps * dt;
        if (e.hp <= 0) killEnemy(state, e);
      }
      if ((e.dotTimer ?? 0) <= 0) {
        e.dotTimer = 0;
        e.dotDps = 0;
      }
    }
    if ((e.burnTimer ?? 0) > 0) {
      e.burnTimer = (e.burnTimer ?? 0) - dt;
      const dps = e.burnDps ?? 0;
      if (dps > 0 && e.alive) {
        e.hp -= dps * dt;
        if (e.hp <= 0) killEnemy(state, e);
      }
      if ((e.burnTimer ?? 0) <= 0) {
        e.burnTimer = 0;
        e.burnDps = 0;
      }
    }
    if (!e.alive) continue;
    const speedMul = (e.slowMul ?? 1) < 1 ? (e.slowMul ?? 1) : 1;

    if (e.telegraph > 0) {
      e.telegraph -= dt;
      if (e.telegraph <= 0) {
        const rad = e.slamRadius ?? 70;
        const dmg = e.slamDamage ?? 20;
        addFx(state, e.x, e.y, rad, "#ff4040aa", 0.35);
        state.shake = Math.max(state.shake, isBossKind(e.kind) ? 0.55 : 0.32);
        playSfx("boss_slam");
        for (const h of livingHeroes(state)) {
          if (dist(e, h) <= rad + h.radius) damageHero(state, h, dmg);
        }
        for (const t of livingTurrets(state)) {
          if (dist(e, t) <= rad + t.radius) {
            damageTurret(state, t, dmg * 0.7);
          }
        }
      }
      continue;
    }

    const target = resolveTarget(state, e);
    const def = ENEMY_DEFS[e.kind];
    const focusHero = target.hero ?? nearestLivingHero(state, e);

    // Charger dash
    e.dashCd = Math.max(0, (e.dashCd ?? 0) - dt);
    if ((e.dashTimer ?? 0) > 0) {
      e.dashTimer = (e.dashTimer ?? 0) - dt;
      if (focusHero) {
        const d = normalize(focusHero.x - e.x, focusHero.y - e.y);
        const dashSpd = (def.dashSpeed ?? e.speed * 2.5) * speedMul;
        tryMove(map, e, e.x + d.x * dashSpd * dt, e.y + d.y * dashSpd * dt);
      }
    } else {
      if (
        def.dashSpeed &&
        focusHero &&
        (e.dashCd ?? 0) <= 0 &&
        dist(e, focusHero) <= (def.dashRange ?? 140)
      ) {
        e.dashTimer = def.dashDuration ?? 0.35;
        e.dashCd = def.dashCooldown ?? 2.8;
        addFx(state, e.x, e.y, 28, "#ff606066", 0.25);
      }
      // Hold to shoot only with clear LOS — otherwise keep routing around cover.
      // After camping too long, force a push so corner peeks don't soft-lock the lane.
      const holdToShoot =
        e.ranged &&
        focusHero &&
        dist(e, focusHero) <= (e.attackRange || 150) * 0.9 &&
        hasLineOfSight(map, e.x, e.y, focusHero.x, focusHero.y, 3);
      if (holdToShoot) {
        e.campTimer = (e.campTimer ?? 0) + dt;
        if ((e.campTimer ?? 0) >= ENEMY_CAMP_BREAK_SEC) {
          // Push toward base (not just the hero) to clear the corner
          moveWithPathing(map, e, base.x, base.y, e.speed * speedMul * 0.85, dt);
        } else {
          e.stuckTimer = 0;
        }
      } else {
        e.campTimer = 0;
        moveWithPathing(map, e, target.x, target.y, e.speed * speedMul, dt);
      }
    }

    if (e.ranged && focusHero) {
      e.attackCd = Math.max(0, e.attackCd - dt);
      if (
        e.attackCd <= 0 &&
        dist(e, focusHero) <= (e.attackRange || 150) &&
        hasLineOfSight(map, e.x, e.y, focusHero.x, focusHero.y, 3)
      ) {
        fireEnemyShot(state, e, focusHero, def);
        e.attackCd = e.attackCooldown;
      }
    }

    if (e.slamCooldown && focusHero) {
      e.slamCd = Math.max(0, (e.slamCd ?? 0) - dt);
      if ((e.slamCd ?? 0) <= 0 && dist(e, focusHero) <= (e.slamRadius ?? 70) * 0.85) {
        e.telegraph = 0.55;
        e.slamCd = e.slamCooldown;
        addFx(state, e.x, e.y, (e.slamRadius ?? 70) * 0.9, "#ff808044", 0.55);
      }
    }

    if (focusHero && dist(e, focusHero) <= e.radius + focusHero.radius) {
      // Gyro Blade Guard: immune to contact while blades wrapped (not reforming)
      const gyroImmune =
        heroHasPassive(focusHero.heroId, "bladeguard") &&
        (focusHero.bladeMode ?? "wrapped") === "wrapped" &&
        (focusHero.bladeReformTimer ?? 0) <= 0;
      if (!gyroImmune) {
        const contactMul = focusHero.barrierTimer > 0 ? 0.35 : 1;
        damageHero(state, focusHero, e.contactDamage * contactMul * dt);
      }
    }

    if (target.kind === "turret" && target.turret?.alive) {
      if (dist(e, target.turret) <= e.radius + target.turret.radius) {
        damageTurret(state, target.turret, (e.turretDamage ?? 12) * dt);
      }
    } else {
      for (const t of livingTurrets(state)) {
        if (dist(e, t) <= e.radius + t.radius) {
          damageTurret(state, t, (e.turretDamage ?? 12) * dt * 0.5);
        }
      }
    }

    if (dist(e, base) <= base.radius) {
      const dmg = e.baseDamage * baseDamageTakenMul(state);
      state.baseHp -= dmg;
      state.baseDamageTaken += dmg;
      e.alive = false;
      state.damageFlash = Math.max(state.damageFlash, 0.2);
      state.toast = "Base hit!";
      state.toastTimer = 0.9;
    }

    // Soft-lock breaker: despawn if stuck forever behind geometry
    if (e.alive && (e.stuckTotal ?? 0) >= ENEMY_STUCK_DESPAWN_SEC) {
      e.alive = false;
      addFx(state, e.x, e.y, 22, "#8899aa88", 0.35);
      if (!state.aiControlled) {
        state.toast = "Creep lost in the rubble…";
        state.toastTimer = 1.2;
      }
    }
  }

  state.enemies = state.enemies.filter((e) => e.alive);
}
