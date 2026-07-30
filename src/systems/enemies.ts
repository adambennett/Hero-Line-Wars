import type { MapDef } from "../data/maps";
import { circleHitsObstacle, pointBlocked } from "../data/maps";
import { ENEMY_DEFS, type EnemyKind } from "../data/enemies";
import { ENEMY_STUCK_SEC, MAP_W, WAVE_SCALE } from "../data/constants";
import { clamp, dist, normalize } from "../game/math";
import type { EnemyUnit, GameState, HeroRuntime, TurretUnit } from "../game/state";
import { addFx, applyPlayerDamage, pushProjectile } from "./combat";
import { baseDamageTakenMul } from "./relics";
import { damageTurret, livingTurrets } from "./turrets";
import { playSfx } from "./audio";

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

/** Slide around obstacles using angled probes + stuck teleport. */
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
  const n = normalize(tx - e.x, ty - e.y);
  const step = speed * dt;

  let moved = tryMove(map, e, e.x + n.x * step, e.y + n.y * step);

  if (!moved) {
    // Probe alternate angles (slide around)
    const baseAng = Math.atan2(n.y, n.x);
    const offsets = [0.55, -0.55, 1.1, -1.1, 1.6, -1.6, Math.PI * 0.5, -Math.PI * 0.5];
    for (const off of offsets) {
      const a = baseAng + off;
      const mx = e.x + Math.cos(a) * step;
      const my = e.y + Math.sin(a) * step;
      if (tryMove(map, e, mx, my)) {
        moved = true;
        e.preferAngle = a;
        break;
      }
    }
  }

  // Keep preferred slide angle briefly
  if (!moved && e.preferAngle !== undefined) {
    const a = e.preferAngle;
    moved = tryMove(map, e, e.x + Math.cos(a) * step, e.y + Math.sin(a) * step);
  }

  const traveled = Math.hypot(e.x - prevX, e.y - prevY);
  if (traveled < step * 0.12) {
    e.stuckTimer = (e.stuckTimer ?? 0) + dt;
  } else {
    e.stuckTimer = 0;
  }

  if ((e.stuckTimer ?? 0) >= ENEMY_STUCK_SEC) {
    unstuckTeleport(map, e, tx, ty);
    e.stuckTimer = 0;
    e.preferAngle = undefined;
  }
}

function unstuckTeleport(map: MapDef, e: EnemyUnit, tx: number, ty: number): void {
  const r = e.radius + 2;
  const toward = normalize(tx - e.x, ty - e.y);
  // Try nudging past obstacle toward target
  const distances = [40, 70, 110, 160];
  for (const d of distances) {
    const nx = clamp(e.x + toward.x * d, r, MAP_W - r);
    const ny = clamp(e.y + toward.y * d, map.laneTop + r, map.laneBottom - r);
    if (!pointBlocked(map, nx, ny, r)) {
      e.x = nx;
      e.y = ny;
      return;
    }
  }
  // Lateral hop
  for (const side of [1, -1]) {
    const nx = clamp(e.x, r, MAP_W - r);
    const ny = clamp(e.y + side * 55, map.laneTop + r, map.laneBottom - r);
    if (!pointBlocked(map, nx, ny, r)) {
      e.x = nx;
      e.y = ny;
      return;
    }
  }
  // Last resort: snap toward open lane center near current x
  e.y = clamp((map.laneTop + map.laneBottom) / 2, map.laneTop + r, map.laneBottom - r);
  e.x = clamp(e.x - 50, r, MAP_W - r);
  if (pointBlocked(map, e.x, e.y, r)) {
    // Walk left until clear (toward base)
    for (let i = 0; i < 20; i++) {
      e.x = clamp(e.x - 30, r, MAP_W - r);
      if (!pointBlocked(map, e.x, e.y, r)) break;
    }
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
  if (kind === "elite") tierMul = WAVE_SCALE.eliteHpMul;
  if (kind === "boss") tierMul = WAVE_SCALE.bossHpMul;
  const hpScale = (opts?.hpScale ?? 1) * waveScale * tierMul;
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
    speed: def.speed * (1 + (state.wave - 1) * 0.028),
    contactDamage: def.contactDamage * (1 + (state.wave - 1) * 0.04),
    baseDamage: def.baseDamage,
    goldReward: def.goldReward,
    ranged: def.ranged ?? false,
    attackRange: def.attackRange ?? 0,
    attackCooldown: def.attackCooldown ?? 1,
    attackCd: Math.random() * 0.6,
    attackDamage: (def.attackDamage ?? 0) * (1 + (state.wave - 1) * 0.05),
    projectileSpeed: def.projectileSpeed ?? 0,
    slamRadius: def.slamRadius,
    slamDamage: def.slamDamage ? def.slamDamage * (1 + (state.wave - 1) * 0.06) : undefined,
    slamCooldown: def.slamCooldown,
    slamCd: def.slamCooldown ? def.slamCooldown * 0.6 : 0,
    telegraph: 0,
    turretDamage: def.turretDamage ?? 12,
    slowTimer: 0,
    slowMul: 1,
    stuckTimer: 0,
  };
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
    const speedMul = (e.slowMul ?? 1) < 1 ? (e.slowMul ?? 1) : 1;

    if (e.telegraph > 0) {
      e.telegraph -= dt;
      if (e.telegraph <= 0) {
        const rad = e.slamRadius ?? 70;
        const dmg = e.slamDamage ?? 20;
        addFx(state, e.x, e.y, rad, "#ff4040aa", 0.35);
        state.shake = Math.max(state.shake, e.kind === "boss" ? 0.55 : 0.32);
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
    moveWithPathing(map, e, target.x, target.y, e.speed * speedMul, dt);

    const focusHero = target.hero ?? nearestLivingHero(state, e);
    if (e.ranged && focusHero) {
      e.attackCd = Math.max(0, e.attackCd - dt);
      if (e.attackCd <= 0 && dist(e, focusHero) <= (e.attackRange || 150)) {
        const dir = normalize(focusHero.x - e.x, focusHero.y - e.y);
        const spd = e.projectileSpeed || 280;
        pushProjectile(state, {
          x: e.x,
          y: e.y,
          vx: dir.x * spd,
          vy: dir.y * spd,
          damage: e.attackDamage,
          radius: 4,
          kind: "enemy",
          color: "#88b0ff",
          hostile: true,
        });
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
      const contactMul = focusHero.barrierTimer > 0 ? 0.35 : 1;
      damageHero(state, focusHero, e.contactDamage * contactMul * dt);
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
      e.alive = false;
      state.damageFlash = Math.max(state.damageFlash, 0.2);
      state.toast = "Base hit!";
      state.toastTimer = 0.9;
    }
  }

  state.enemies = state.enemies.filter((e) => e.alive);
}
