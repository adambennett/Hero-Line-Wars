import { type AttackStyle } from "../data/heroes";
import type { RelicId } from "../data/relics";
import type { HighGroundZone } from "../data/maps";
import {
  circleHitsObstacle,
  findClearSpot,
  hasLineOfSight,
  rayObstacleHitT,
  resolveMovePlayable,
} from "../data/maps";
import { dist, normalize, type Vec2 } from "../game/math";
import { gameplayCheats } from "../meta/cheats";
import type { EnemyUnit, GameState, HexZone, Projectile } from "../game/state";
import {
  hasRelic,
  killGoldRelicMul,
  relicDamageMul,
} from "./relics";
import { isBossKind, isEliteKind } from "../data/enemies";
import { grantKillXp } from "./xp";
import { playSfx } from "./audio";
import { heroHasPassive, heroUsesGyroKit, heroUsesVectorKit, resolveHero } from "../custom/registry";
import { perksForState } from "./heroPerks";

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

/** Light poison DoT stacks — never grants lifesteal/heal. */
export function applyPoison(
  e: EnemyUnit,
  dpsPerStack: number,
  duration: number,
  stacks = 1,
  maxStacks = 5,
): void {
  if (!e.alive || dpsPerStack <= 0 || stacks <= 0) return;
  const next = Math.min(maxStacks, (e.poisonStacks ?? 0) + stacks);
  e.poisonStacks = next;
  e.dotTimer = Math.max(e.dotTimer ?? 0, duration);
  e.dotDps = Math.max(e.dotDps ?? 0, dpsPerStack * next);
}

export function spawnPoisonCloud(
  state: GameState,
  x: number,
  y: number,
  opts: {
    radius: number;
    life: number;
    poisonDps: number;
    poisonStacks?: number;
    poisonDuration?: number;
  },
): void {
  const zone: HexZone = {
    x,
    y,
    radius: opts.radius,
    life: opts.life,
    dps: 0,
    kind: "poison",
    poisonDps: opts.poisonDps,
    poisonStacks: opts.poisonStacks ?? 1,
    poisonDuration: opts.poisonDuration ?? 2.6,
    poisonTick: 0,
  };
  state.hexZones.push(zone);
  addFx(state, x, y, opts.radius, "#5ec87855", 0.35);
}

/** Shared SP / MP hex + poison cloud tick. */
export function tickHexZones(state: GameState, dt: number): void {
  for (const z of state.hexZones) {
    z.life -= dt;
    if (z.kind === "poison") {
      z.poisonTick = (z.poisonTick ?? 0) - dt;
      const ready = (z.poisonTick ?? 0) <= 0;
      if (ready) z.poisonTick = 0.4;
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (dist(e, z) > z.radius + e.radius) continue;
        if (ready) {
          applyPoison(
            e,
            z.poisonDps ?? Math.max(1, z.dps),
            z.poisonDuration ?? 2.6,
            z.poisonStacks ?? 1,
          );
        }
      }
    } else {
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (dist(e, z) <= z.radius + e.radius) {
          damageEnemy(state, e, z.dps * dt);
        }
      }
    }
  }
  state.hexZones = state.hexZones.filter((z) => z.life > 0);
}

/** Cloud LMB: aim/move dash that phases contact and applies poison. */
export function castPoisonDashBasic(state: GameState): boolean {
  const aim = normalize(state.aimWorldX - state.hero.x, state.aimWorldY - state.hero.y);
  let dx = aim.x;
  let dy = aim.y;
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
  }
  const distDash = 105;
  const map = state.map;
  const r = state.hero.radius;
  const steps = Math.max(4, Math.ceil(distDash / 12));
  const hit = new Set<number>();
  const poisonDps = attackDamage(state) * 0.28;
  let x = state.hero.x;
  let y = state.hero.y;
  for (let i = 1; i <= steps; i++) {
    const tx = state.hero.x + dx * ((distDash * i) / steps);
    const ty = state.hero.y + dy * ((distDash * i) / steps);
    const resolved = resolveMovePlayable(map, x, y, tx, ty, r);
    const nx = resolved.x;
    const ny = resolved.y;
    const blocked = map.obstacles.some((o) => circleHitsObstacle(nx, ny, r, o));
    if (blocked) break;
    x = nx;
    y = ny;
    for (const e of state.enemies) {
      if (!e.alive || hit.has(e.id)) continue;
      if (dist({ x, y }, e) <= 38 + e.radius) {
        hit.add(e.id);
        // Light contact hit — no lifesteal flag (poison never heals).
        damageEnemy(state, e, attackDamage(state) * 0.4);
        applyPoison(e, poisonDps, 2.8, 1);
      }
    }
  }
  const clear = findClearSpot(map, x, y, r);
  state.hero.x = clear.x;
  state.hero.y = clear.y;
  state.hero.phaseTimer = Math.max(state.hero.phaseTimer ?? 0, 0.28);
  addFx(state, state.hero.x, state.hero.y, 30, "#5ec878aa");
  playSfx("cast");
  return true;
}

export function attackDamage(state: GameState): number {
  const hero = resolveHero(state.hero.heroId);
  const perks = perksForState(state);
  let base = hero.attackDamage + state.hero.damageBonus + (state.baseBranchMods?.damageFlat ?? 0);
  if (hasRelic(state, "blood_price")) base *= 1.35;
  if (hasRelic(state, "overcharge")) base *= 0.85;
  if (hasRelic(state, "glass_cannon")) base *= 1.15;
  if (hasRelic(state, "legend_crown")) base *= 1.15;
  const zone = highGroundAt(state, state.hero);
  const hg = zone
    ? 1 + (hasRelic(state, "high_ground_oath") ? zone.oathDamageBonus : zone.damageBonus)
    : 1;
  let dmg = base * hg * relicDamageMul(state) * perks.damageMul;
  if (heroUsesVectorKit(state.hero.heroId)) {
    const mom = state.hero.momentum ?? 0;
    const cap = 100 + perks.momentumCapBonus;
    dmg *= 1 + 0.6 * Math.min(1, mom / Math.max(1, cap));
  }

  // Close Quarters passive
  if (heroHasPassive(state.hero.heroId, "close_quarters")) {
    const near = state.enemies.some(
      (e) => e.alive && dist(state.hero, e) <= 90 + e.radius,
    );
    if (near) dmg *= 1.3;
  }

  if ((state.hero.overchargeTimer ?? 0) > 0) dmg *= 1.2;
  if (state.utilityDamageBoost > 0) dmg *= 1.25;
  if ((state.hero.relayDmgTimer ?? 0) > 0) dmg *= 1 + (state.hero.relayDmgBonus ?? 0.15);
  if (state.glassCannon) dmg *= 1.5;

  const stacks = state.hero.bloodEngineStacks ?? 0;
  if (stacks > 0 && (state.shopOwned.blood_engine ?? 0) > 0) {
    dmg *= 1 + stacks * 0.02;
  }
  if (
    (state.shopOwned.eclipse_crown ?? 0) > 0 &&
    state.hero.hp / Math.max(1, state.hero.maxHp) < 0.5
  ) {
    dmg *= 1.25;
  }

  if (state.hero.luck > 0 && Math.random() < state.hero.luck) {
    dmg *= 1.75;
  }
  return dmg;
}

export function attackCooldown(state: GameState): number {
  const hero = resolveHero(state.hero.heroId);
  const perks = perksForState(state);
  let cd =
    hero.attackCooldown *
    state.hero.attackSpeedMul *
    (state.baseBranchMods?.attackSpeedMul ?? 1) *
    perks.attackCdMul;
  if (hasRelic(state, "overcharge")) cd *= 0.7;
  if ((state.hero.marksmanTimer ?? 0) > 0) cd *= 0.75;
  if (heroUsesVectorKit(state.hero.heroId)) {
    const mom = state.hero.momentum ?? 0;
    const cap = 100 + perks.momentumCapBonus;
    cd *= 1 - 0.3 * Math.min(1, mom / Math.max(1, cap));
  }
  return cd;
}

/** Friendly (player) projectile AoE on impact / expire / wall. */
export function explodeFriendlyAoe(state: GameState, p: Projectile): void {
  const aoe = p.aoeRadius ?? 0;
  if (aoe <= 0) {
    p.alive = false;
    return;
  }
  addFx(state, p.x, p.y, aoe, p.color ? `${p.color}88` : "#ff804088", 0.35);
  state.shake = Math.max(state.shake, 0.16);
  damageEnemiesInRadius(state, p.x, p.y, aoe, p.damage);
  p.alive = false;
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
  state.kills += 1;
  if (isBossKind(e.kind)) state.bossesKilled += 1;
  if (isEliteKind(e.kind)) state.elitesKilled += 1;
  let gold = e.goldReward * killGoldRelicMul(state);
  gold += state.hero.killGoldBonus + (state.baseBranchMods?.killGoldFlat ?? 0);
  if (state.utilityBountyKills > 0) {
    gold += 8;
    state.utilityBountyKills -= 1;
  }
  if (state.goldRush) gold *= 2;
  state.gold += gold;
  state.goldFromKills += gold;
  state.peakGold = Math.max(state.peakGold, state.gold);
  grantKillXp(state, e);
  if (hasRelic(state, "blood_tithe")) {
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 4);
  }
  if (heroHasPassive(state.hero.heroId, "marksman")) {
    state.hero.marksmanTimer = 2.5;
  }
  if (heroHasPassive(state.hero.heroId, "overcharge")) {
    state.hero.overchargeTimer = 2;
  }
  if (heroHasPassive(state.hero.heroId, "riftmark") && state.hero.abilityCds[0] != null) {
    state.hero.abilityCds[0] = Math.max(0, state.hero.abilityCds[0]! * 0.85);
  }
  if (heroHasPassive(state.hero.heroId, "nest_memory")) {
    state.hero.hiveDrones = Math.min(5, (state.hero.hiveDrones ?? 0) + 1);
  }
  if (
    heroHasPassive(state.hero.heroId, "venom_cache") &&
    ((e.poisonStacks ?? 0) > 0 || (e.dotTimer ?? 0) > 0)
  ) {
    const perks = perksForState(state);
    const rad = 26 * perks.abilityAreaMul * (0.85 + 0.15 * perks.passiveMul);
    spawnPoisonCloud(state, e.x, e.y, {
      radius: rad,
      life: 1.6 * perks.passiveMul,
      poisonDps: attackDamage(state) * 0.18 * perks.passiveMul,
      poisonStacks: 1,
      poisonDuration: 2.2,
    });
  }
  if ((state.shopOwned.blood_engine ?? 0) > 0) {
    state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 8);
    state.hero.bloodEngineStacks = Math.min(10, (state.hero.bloodEngineStacks ?? 0) + 1);
  }
  if ((state.shopOwned.nest_core ?? 0) > 0) {
    state.hero.nestCoreKills = (state.hero.nestCoreKills ?? 0) + 1;
    if ((state.hero.nestCoreKills ?? 0) >= 8) {
      state.hero.nestCoreKills = 0;
      state.pendingSends.push({ enemies: 1, hpScale: 1 });
      state.toast = "Nest Core — queued 1 into next wave";
      state.toastTimer = 1.2;
    }
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
  const pid = resolveHero(state.hero.heroId).passive.id;
  if (opts?.fromBasic && pid === "siege_focus") {
    if (e.kind === "brute" || isEliteKind(e.kind) || isBossKind(e.kind)) dmg *= 1.4;
  }
  if (hasRelic(state, "line_tyrant") && (isEliteKind(e.kind) || isBossKind(e.kind))) {
    dmg *= 1.3;
  }
  if (opts?.fromBasic && state.hero.mirageEmpowered) {
    dmg *= 1.4;
    state.hero.mirageEmpowered = false;
  }
  if (gameplayCheats(state)?.oneShot) dmg = Math.max(dmg, e.hp);

  e.hp -= dmg;
  state.damageDealt += dmg;
  if (opts?.fromBasic || dmg >= 3) playSfx("hit");

  if (
    opts?.lifesteal ||
    (opts?.fromBasic && hasRelic(state, "hungry_blade")) ||
    (opts?.fromBasic && pid === "sap") ||
    hasRelic(state, "vampiric_edge")
  ) {
    let steal = 0;
    if (hasRelic(state, "vampiric_edge")) steal = Math.max(steal, 0.1);
    if (opts?.fromBasic && hasRelic(state, "hungry_blade")) steal = Math.max(steal, 0.18);
    if (opts?.fromBasic && pid === "sap") steal = Math.max(steal, 0.12);
    if (opts?.lifesteal) steal = Math.max(steal, 0.18);
    if (steal > 0) {
      const heal = dmg * steal;
      const before = state.hero.hp;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + heal);
      state.healingDone += Math.max(0, state.hero.hp - before);
    }
  }
  const heroDef = resolveHero(state.hero.heroId);
  if (
    opts?.slow ||
    (opts?.fromBasic &&
      (pid === "sap" ||
        pid === "gale" ||
        heroDef.attackStyle === "frostbolt" ||
        hasRelic(state, "frost_sigil")))
  ) {
    const mul =
      pid === "sap" ? 0.35 : heroDef.attackStyle === "frostbolt" ? 0.6 : pid === "gale" ? 0.8 : 0.75;
    const dur = pid === "sap" ? 0.85 : heroDef.attackStyle === "frostbolt" ? 1.5 : 1.0;
    applySlow(e, mul, dur);
  }
  const splashRelic =
    opts?.fromBasic && (hasRelic(state, "splinter_tip") || hasRelic(state, "shockwave_core"));
  const emberSplash = opts?.fromBasic && pid === "scorch";
  if ((opts?.splash || splashRelic || emberSplash) && e.alive) {
    const splash =
      dmg *
      (emberSplash ? 0.2 : hasRelic(state, "shockwave_core") ? 0.55 : 0.4);
    for (const other of state.enemies) {
      if (!other.alive || other.id === e.id) continue;
      if (dist(e, other) <= 55 + other.radius) {
        other.hp -= splash;
        state.damageDealt += splash;
        if (other.hp <= 0) killEnemy(state, other);
      }
    }
  }
  if (opts?.fromBasic && pid === "refraction" && e.alive) {
    const other = nearestEnemy(state, e, e.id);
    if (other && dist(e, other) <= 80) {
      const splashR = dmg * 0.25;
      other.hp -= splashR;
      state.damageDealt += splashR;
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
  const heroDef = resolveHero(state.hero.heroId);
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
    case "hex": {
      pushProjectile(state, {
        x: state.hero.x,
        y: state.hero.y,
        vx: facing.x * (heroDef.projectileSpeed || 420),
        vy: facing.y * (heroDef.projectileSpeed || 420),
        damage: dmg,
        radius: 4.5,
        kind: "bolt",
        color: "#c080ff",
        bouncesLeft: bounce,
        fromBasic: true,
        appliesSlow: true,
        hexDot: true,
      });
      break;
    }
    case "wind": {
      pushProjectile(state, {
        x: state.hero.x,
        y: state.hero.y,
        vx: facing.x * (heroDef.projectileSpeed || 620),
        vy: facing.y * (heroDef.projectileSpeed || 620),
        damage: dmg,
        radius: 3.5,
        kind: "bolt",
        color: "#a8d8ff",
        pierceLeft: 3,
        bouncesLeft: bounce,
        fromBasic: true,
        appliesSlow: true,
      });
      break;
    }
    case "syringe": {
      pushProjectile(state, {
        x: state.hero.x,
        y: state.hero.y,
        vx: facing.x * (heroDef.projectileSpeed || 420),
        vy: facing.y * (heroDef.projectileSpeed || 420),
        damage: dmg,
        radius: 3.5,
        kind: "bolt",
        color: "#90f0b0",
        bouncesLeft: bounce,
        fromBasic: true,
        healOnHit: 5,
        life: 0.55,
      });
      break;
    }
    case "emberbolt": {
      pushProjectile(state, {
        x: state.hero.x,
        y: state.hero.y,
        vx: facing.x * (heroDef.projectileSpeed || 520),
        vy: facing.y * (heroDef.projectileSpeed || 520),
        damage: dmg,
        radius: 5,
        kind: "bolt",
        color: "#ff8040",
        bouncesLeft: bounce,
        fromBasic: true,
        burnDot: true,
      });
      break;
    }
    case "needle": {
      pushProjectile(state, {
        x: state.hero.x,
        y: state.hero.y,
        vx: facing.x * (heroDef.projectileSpeed || 680),
        vy: facing.y * (heroDef.projectileSpeed || 680),
        damage: dmg,
        radius: 3,
        kind: "heavy",
        color: "#9a70ff",
        pierceLeft: 4,
        bouncesLeft: bounce,
        fromBasic: true,
      });
      break;
    }
    case "echo": {
      const spread = 0.12;
      for (const s of [-1, 1]) {
        const a = angle + s * spread;
        pushProjectile(state, {
          x: state.hero.x,
          y: state.hero.y,
          vx: Math.cos(a) * (heroDef.projectileSpeed || 540),
          vy: Math.sin(a) * (heroDef.projectileSpeed || 540),
          damage: dmg * 0.72,
          radius: 3.5,
          kind: "bolt",
          color: "#50d0d8",
          bouncesLeft: bounce,
          fromBasic: true,
        });
      }
      break;
    }
    case "warpbolt": {
      pushProjectile(state, {
        x: state.hero.x,
        y: state.hero.y,
        vx: facing.x * (heroDef.projectileSpeed || 500),
        vy: facing.y * (heroDef.projectileSpeed || 500),
        damage: dmg,
        radius: 3.5,
        kind: "bolt",
        color: "#48c8e8",
        bouncesLeft: bounce,
        fromBasic: true,
      });
      // Pads act as mini-turrets — each fires a random-direction bolt
      const tp = state.teleporters;
      const padBolt = (px: number, py: number) => {
        const a = Math.random() * Math.PI * 2;
        pushProjectile(state, {
          x: px,
          y: py,
          vx: Math.cos(a) * 420,
          vy: Math.sin(a) * 420,
          damage: dmg * 0.7,
          radius: 3,
          kind: "bolt",
          color: "#78e0f8",
          fromBasic: true,
          life: 0.7,
        });
      };
      if (tp.a) padBolt(tp.a.x, tp.a.y);
      if (tp.b) padBolt(tp.b.x, tp.b.y);
      break;
    }
    case "spin":
      // Gyro spin damage is handled in tickHeroKits while attack is held.
      break;
    case "magnet": {
      pushProjectile(state, {
        x: state.hero.x,
        y: state.hero.y,
        vx: facing.x * (heroDef.projectileSpeed || 480),
        vy: facing.y * (heroDef.projectileSpeed || 480),
        damage: dmg,
        radius: 4.5,
        kind: "bolt",
        color: "#8aa0ff",
        bouncesLeft: bounce,
        fromBasic: true,
        magnetPull: 28,
      });
      break;
    }
    case "chrono": {
      // Slower bolt, delayed feel, higher damage on connect.
      const spd = (heroDef.projectileSpeed || 400) * 0.55;
      pushProjectile(state, {
        x: state.hero.x,
        y: state.hero.y,
        vx: facing.x * spd,
        vy: facing.y * spd,
        damage: dmg * 1.45,
        radius: 5,
        kind: "bolt",
        color: "#d0a0ff",
        bouncesLeft: bounce,
        fromBasic: true,
        life: 0.85,
      });
      break;
    }
    case "drone": {
      const target = nearestEnemy(state);
      let ax = facing.x;
      let ay = facing.y;
      if (target) {
        const n = normalize(target.x - state.hero.x, target.y - state.hero.y);
        ax = n.x;
        ay = n.y;
      }
      pushProjectile(state, {
        x: state.hero.x,
        y: state.hero.y,
        vx: ax * (heroDef.projectileSpeed || 380),
        vy: ay * (heroDef.projectileSpeed || 380),
        damage: dmg,
        radius: 4,
        kind: "bolt",
        color: "#e8c060",
        fromBasic: true,
        seek: true,
        life: 1.1,
      });
      break;
    }
    case "machinegun": {
      const a = angle + (Math.random() * 2 - 1) * 0.05;
      pushProjectile(state, {
        x: state.hero.x,
        y: state.hero.y,
        vx: Math.cos(a) * (heroDef.projectileSpeed || 760),
        vy: Math.sin(a) * (heroDef.projectileSpeed || 760),
        damage: dmg,
        radius: 2.8,
        kind: "bolt",
        color: "#c8d090",
        fromBasic: true,
        life: 0.28,
      });
      break;
    }
    case "grenade": {
      const perks = perksForState(state);
      const aimDist = Math.min(
        heroDef.attackRange * 1.15,
        Math.hypot(state.aimWorldX - state.hero.x, state.aimWorldY - state.hero.y) || 80,
      );
      const spd = heroDef.projectileSpeed || 340;
      const life = Math.max(0.25, aimDist / spd);
      pushProjectile(state, {
        x: state.hero.x,
        y: state.hero.y,
        vx: facing.x * spd,
        vy: facing.y * spd,
        damage: dmg * 1.15 * perks.mineDamageMul,
        radius: 6,
        kind: "heavy",
        color: "#e09050",
        fromBasic: true,
        aoeRadius: 52 * perks.abilityAreaMul,
        life,
      });
      break;
    }
    case "kinetic": {
      const perks = perksForState(state);
      const mom = state.hero.momentum ?? 0;
      const cap = 100 + perks.momentumCapBonus;
      const ratio = Math.min(1, mom / Math.max(1, cap));
      const pierce = ratio >= 0.85 ? 3 : ratio >= 0.5 ? 1 : 0;
      pushProjectile(state, {
        x: state.hero.x,
        y: state.hero.y,
        vx: facing.x * (heroDef.projectileSpeed || 560) * (1 + ratio * 0.35),
        vy: facing.y * (heroDef.projectileSpeed || 560) * (1 + ratio * 0.35),
        damage: dmg,
        radius: 4,
        kind: "bolt",
        color: "#ff9a50",
        fromBasic: true,
        pierceLeft: pierce,
        life: 0.75,
      });
      break;
    }
    case "poisondash":
      // Handled in tryBasicAttack via castPoisonDashBasic.
      break;
    case "chaos":
      break;
  }
}

/** Gently steer seeking projectiles toward the nearest living enemy. */
export function steerSeekingProjectile(state: GameState, p: Projectile, dt: number): void {
  if (!p.seek || !p.alive) return;
  const t = nearestEnemy(state, p);
  if (!t) return;
  const spd = Math.hypot(p.vx, p.vy) || 380;
  const n = normalize(t.x - p.x, t.y - p.y);
  const mix = Math.min(1, 5.5 * dt);
  let vx = p.vx * (1 - mix) + n.x * spd * mix;
  let vy = p.vy * (1 - mix) + n.y * spd * mix;
  const s = Math.hypot(vx, vy) || 1;
  p.vx = (vx / s) * spd;
  p.vy = (vy / s) * spd;
}

export function applyMagnetPull(state: GameState, e: EnemyUnit, pull: number): void {
  if (pull <= 0) return;
  const n = normalize(state.hero.x - e.x, state.hero.y - e.y);
  e.x += n.x * pull;
  e.y += n.y * pull;
}

export function enemyInAttackRange(state: GameState): boolean {
  const heroDef = resolveHero(state.hero.heroId);
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
  const heroDef = resolveHero(state.hero.heroId);
  if (heroDef.attackStyle === "spin") return false;
  // Cloud Wall Dart locks basics during wind-up / ricochet
  if ((state.hero.cloudDartWindup ?? 0) > 0 || state.hero.cloudDartActive) return false;
  // Gyro kit can't attack while blades are detached
  if (
    heroUsesGyroKit(state.hero.heroId) &&
    (state.hero.bladeMode ?? "wrapped") !== "wrapped"
  ) {
    return false;
  }
  if (heroDef.attackStyle === "poisondash") {
    if (!castPoisonDashBasic(state)) return false;
    state.hero.attackCd = attackCooldown(state);
    state.basicsFired += 1;
    return true;
  }
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

  let style: AttackStyle = heroDef.attackStyle;
  if (style === "chaos") {
    const idx = state.hero.chaosIndex ?? 0;
    style = CHAOS_STYLES[idx % CHAOS_STYLES.length]!;
    state.hero.chaosIndex = idx + 1;
  }

  fireStyle(state, style, facing, angle, dmg, bounce);
  state.hero.attackCd = attackCooldown(state);
  state.basicsFired += 1;
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
  if (gameplayCheats(state)?.godMode) return;
  let dmg = amount;
  if (state.glassCannon) dmg *= 1.5;
  if (hasRelic(state, "blood_price")) dmg *= 1.25;
  if (heroHasPassive(state.hero.heroId, "bedrock") && state.hero.barrierTimer > 0) dmg *= 0.85;
  if ((state.wardBeaconTimer ?? 0) > 0) dmg *= 0.88;
  state.hero.hp -= dmg;
  state.damageTaken += dmg;
  if (heroHasPassive(state.hero.heroId, "rewind_ward")) {
    state.hero.chronaBank = (state.hero.chronaBank ?? 0) + dmg;
    state.hero.chronaCleanTimer = 2;
  }
  state.damageFlash = Math.max(state.damageFlash, 0.28);
  state.vignette = Math.max(state.vignette, 0.45);
  state.hitFlash = Math.max(state.hitFlash, 0.18);
  state.shake = Math.max(state.shake, 0.22);
  if (state.toastTimer < 0.4) {
    state.toast = "Under attack!";
    state.toastTimer = 0.55;
  }
}

export function applyHeroSlow(hero: { slowMul?: number; slowTimer?: number }, mul: number, duration: number): void {
  hero.slowMul = Math.min(hero.slowMul ?? 1, mul);
  hero.slowTimer = Math.max(hero.slowTimer ?? 0, duration);
}

/** Hostile projectile impact / fuse / wall — direct hit + optional AoE. */
export function resolveHostileProjectile(
  state: GameState,
  p: Projectile,
  heroes: { alive: boolean; x: number; y: number; radius: number; slowMul?: number; slowTimer?: number }[],
  applyToHero: (hero: (typeof heroes)[number], damage: number) => void,
): void {
  const aoe = p.aoeRadius ?? 0;
  if (aoe > 0) {
    addFx(state, p.x, p.y, aoe, p.color ? `${p.color}88` : "#ff804088", 0.35);
    state.shake = Math.max(state.shake, 0.18);
    for (const h of heroes) {
      if (!h.alive) continue;
      if (dist(p, h) <= aoe + h.radius) {
        applyToHero(h, p.damage);
        if (p.heroSlowMul != null) applyHeroSlow(h, p.heroSlowMul, p.heroSlowDuration ?? 1.5);
      }
    }
  } else {
    for (const h of heroes) {
      if (!h.alive) continue;
      if (dist(p, h) <= h.radius + p.radius) {
        applyToHero(h, p.damage);
        if (p.heroSlowMul != null) applyHeroSlow(h, p.heroSlowMul, p.heroSlowDuration ?? 1.5);
        break;
      }
    }
  }
  p.alive = false;
}

export type RelicCheck = RelicId;
