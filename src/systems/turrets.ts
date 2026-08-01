import { TURRET_DEFS, type TurretKind } from "../data/turrets";
import { isBossKind, isEliteKind } from "../data/enemies";
import { dist, normalize } from "../game/math";
import type { EnemyUnit, GameState, TurretUnit } from "../game/state";
import { addFx, damageEnemy, pushProjectile } from "./combat";
import { hasRelic } from "./relics";

export function livingTurrets(state: GameState): TurretUnit[] {
  return state.turrets.filter((t) => t.alive);
}

export function effectiveMaxTurrets(state: GameState): number {
  return (
    state.maxTurrets +
    (hasRelic(state, "architects_favor") ? 1 : 0)
  );
}

export function placeTurret(state: GameState, kind: TurretKind): string | null {
  const alive = livingTurrets(state).length;
  const cap = effectiveMaxTurrets(state);
  if (alive >= cap) return `Turret cap reached (${cap})`;

  const def = TURRET_DEFS[kind];
  const slot = nextTurretSlot(state);
  if (!slot) return "No free turret slots";

  const hpBonus = hasRelic(state, "architects_favor") ? 20 : 0;
  const turret: TurretUnit = {
    id: state.nextId++,
    kind,
    x: slot.x,
    y: slot.y,
    hp: def.maxHp + hpBonus,
    maxHp: def.maxHp + hpBonus,
    radius: def.radius,
    alive: true,
    fireCd: 0.4,
    slotIndex: slot.index,
  };
  state.turrets.push(turret);
  addFx(state, turret.x, turret.y, 28, def.stroke + "88", 0.4);
  return null;
}

function nextTurretSlot(state: GameState): { x: number; y: number; index: number } | null {
  const slots = state.map.turretSlots;
  const used = new Set(livingTurrets(state).map((t) => t.slotIndex));
  const free: { x: number; y: number; index: number }[] = [];
  for (let i = 0; i < slots.length; i++) {
    if (used.has(i)) continue;
    const s = slots[i]!;
    free.push({ x: s.x, y: s.y, index: i });
  }
  if (free.length > 0) {
    return free[Math.floor(Math.random() * free.length)]!;
  }
  // Overflow: place near base with a slight offset
  if (slots.length === 0) return null;
  const base = state.map.base;
  const n = livingTurrets(state).length;
  return {
    x: base.x + 70 + (n % 3) * 28 + (Math.random() * 20 - 10),
    y: base.y - 40 + Math.floor(n / 3) * 40 + (Math.random() * 16 - 8),
    index: 100 + n,
  };
}

function fireBolt(
  state: GameState,
  t: TurretUnit,
  target: { x: number; y: number },
  damage: number,
  color: string,
  opts?: { pierce?: number; speed?: number; goldOnHit?: boolean },
): void {
  const n = normalize(target.x - t.x, target.y - t.y);
  const spd = opts?.speed ?? 420;
  pushProjectile(state, {
    x: t.x,
    y: t.y,
    vx: n.x * spd,
    vy: n.y * spd,
    damage,
    radius: 3.5,
    kind: opts?.pierce ? "heavy" : "bolt",
    color,
    fromBasic: false,
    pierceLeft: opts?.pierce,
  });
  if (opts?.goldOnHit) {
    state.gold += 1;
  }
}

function applyAoePulse(
  state: GameState,
  t: TurretUnit,
  damage: number,
  aoe: number,
  color: string,
  slowMul: number,
  slowDur: number,
  opts?: { poison?: boolean },
): void {
  addFx(state, t.x, t.y, aoe, color + "55", 0.25);
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist(t, e) > aoe + e.radius) continue;
    damageEnemy(state, e, damage);
    if (slowMul < 1) {
      e.slowTimer = Math.max(e.slowTimer ?? 0, slowDur);
      e.slowMul = Math.min(e.slowMul ?? 1, slowMul);
    }
    if (opts?.poison) {
      e.burnTimer = Math.max(e.burnTimer ?? 0, 2.2);
      e.burnDps = Math.max(e.burnDps ?? 0, damage * 0.55);
    }
  }
}

export function updateTurrets(state: GameState, dt: number): void {
  const forgeMul = (state.shopOwned.forge_heart ?? 0) > 0 ? 1.2 : 1;
  const dmgMul =
    (hasRelic(state, "architects_favor") ? 1.25 : 1) *
    (state.baseBranchMods?.artifactDamageMul ?? 1) *
    (state.utilityTurretBoost > 0 ? 1.4 : 1) *
    forgeMul;
  const cdMul =
    (hasRelic(state, "turret_overclock") ? 0.7 : 1) * (state.baseBranchMods?.artifactFireMul ?? 1);

  for (const t of state.turrets) {
    if (!t.alive) continue;
    t.fireCd = Math.max(0, t.fireCd - dt);
    if (t.fireCd > 0) continue;

    const def = TURRET_DEFS[t.kind];
    const damage = def.damage * dmgMul;
    const target = nearestEnemyInRange(state, t, def.range);

    switch (def.behavior) {
      case "bolt": {
        if (!target) continue;
        fireBolt(state, t, target, damage, def.projectileColor);
        break;
      }
      case "aoe":
      case "slow": {
        if (def.aoeRadius <= 0) continue;
        const any = state.enemies.some((e) => e.alive && dist(t, e) <= def.range + e.radius);
        if (!any) continue;
        applyAoePulse(state, t, damage, def.aoeRadius, def.projectileColor, def.slowMul, def.slowDuration);
        break;
      }
      case "chain": {
        if (!target) continue;
        damageEnemy(state, target, damage);
        addFx(state, target.x, target.y, 22, def.projectileColor + "88", 0.2);
        let from = target;
        const hit = new Set<number>([target.id]);
        for (let i = 0; i < 2; i++) {
          let best = null as (typeof state.enemies)[0] | null;
          let bestD = 90;
          for (const e of state.enemies) {
            if (!e.alive || hit.has(e.id)) continue;
            const d = dist(from, e);
            if (d < bestD) {
              bestD = d;
              best = e;
            }
          }
          if (!best) break;
          hit.add(best.id);
          damageEnemy(state, best, damage * (0.7 - i * 0.15));
          addFx(state, best.x, best.y, 18, def.projectileColor + "66", 0.15);
          from = best;
        }
        break;
      }
      case "gold": {
        if (!target) continue;
        damageEnemy(state, target, damage);
        state.gold += 1;
        addFx(state, target.x, target.y, 16, def.projectileColor + "aa", 0.2);
        break;
      }
      case "heal_base": {
        if (!target) continue;
        fireBolt(state, t, target, damage, def.projectileColor);
        state.baseHp = Math.min(state.map.base.maxHp, state.baseHp + 2);
        break;
      }
      case "poison": {
        const any = state.enemies.some((e) => e.alive && dist(t, e) <= def.range + e.radius);
        if (!any) continue;
        applyAoePulse(
          state,
          t,
          damage,
          def.aoeRadius || 100,
          def.projectileColor,
          def.slowMul,
          def.slowDuration,
          { poison: true },
        );
        break;
      }
      case "pull": {
        const any = state.enemies.some((e) => e.alive && dist(t, e) <= def.range + e.radius);
        if (!any) continue;
        const aoe = def.aoeRadius || 115;
        for (const e of state.enemies) {
          if (!e.alive) continue;
          if (dist(t, e) > aoe + e.radius) continue;
          const n = normalize(t.x - e.x, t.y - e.y);
          e.x += n.x * 22;
          e.y += n.y * 22;
        }
        applyAoePulse(state, t, damage, aoe, def.projectileColor, def.slowMul, def.slowDuration);
        break;
      }
      case "rail": {
        if (!target) continue;
        fireBolt(state, t, target, damage, def.projectileColor, { pierce: 6, speed: 780 });
        break;
      }
      case "multishot": {
        if (!target) continue;
        const base = Math.atan2(target.y - t.y, target.x - t.x);
        for (let i = -2; i <= 2; i++) {
          const a = base + i * 0.16;
          pushProjectile(state, {
            x: t.x,
            y: t.y,
            vx: Math.cos(a) * 460,
            vy: Math.sin(a) * 460,
            damage: damage * 0.55,
            radius: 3,
            kind: "pellet",
            color: def.projectileColor,
            life: 0.4,
            fromBasic: false,
          });
        }
        break;
      }
      case "execute": {
        if (!target) continue;
        const low = target.hp / Math.max(1, target.maxHp) < 0.3;
        const dmg = damage * (low ? 1.8 : 1);
        fireBolt(state, t, target, dmg, def.projectileColor);
        break;
      }
      case "mine": {
        // Drop a short-lived hazard toward nearest foe / down-lane
        const aim = target
          ? normalize(target.x - t.x, target.y - t.y)
          : { x: 1, y: 0 };
        const mx = t.x + aim.x * 55;
        const my = t.y + aim.y * 55;
        state.hexZones.push({
          x: mx,
          y: my,
          radius: def.aoeRadius || 55,
          life: 2.8,
          dps: damage * 0.85,
        });
        addFx(state, mx, my, 28, def.projectileColor + "88", 0.3);
        break;
      }
      case "storm": {
        const inRange = state.enemies.filter((e) => e.alive && dist(t, e) <= def.range + e.radius);
        if (inRange.length === 0) continue;
        const pick = inRange[Math.floor(Math.random() * inRange.length)]!;
        const aoe = def.aoeRadius || 40;
        addFx(state, pick.x, pick.y, aoe, def.projectileColor + "88", 0.3);
        for (const e of state.enemies) {
          if (!e.alive) continue;
          if (dist(pick, e) <= aoe + e.radius) damageEnemy(state, e, damage);
        }
        break;
      }
      case "ward": {
        const any = state.enemies.some((e) => e.alive && dist(t, e) <= def.range + e.radius);
        if (!any) continue;
        applyAoePulse(
          state,
          t,
          damage,
          def.aoeRadius || 125,
          def.projectileColor,
          def.slowMul,
          def.slowDuration,
        );
        state.wardBeaconTimer = Math.max(state.wardBeaconTimer, 1.6);
        break;
      }
      case "sovereign": {
        const crown = pickCrownTarget(state, t, def.range);
        if (!crown) continue;
        // Crown strike — heavy hit + splash + chill
        damageEnemy(state, crown, damage);
        addFx(state, crown.x, crown.y, 42, def.stroke + "cc", 0.45);
        addFx(state, t.x, t.y, 36, def.projectileColor + "88", 0.35);
        const splash = def.aoeRadius || 85;
        for (const e of state.enemies) {
          if (!e.alive || e.id === crown.id) continue;
          if (dist(crown, e) > splash + e.radius) continue;
          damageEnemy(state, e, damage * 0.45);
          if (def.slowMul < 1) {
            e.slowTimer = Math.max(e.slowTimer ?? 0, def.slowDuration);
            e.slowMul = Math.min(e.slowMul ?? 1, def.slowMul);
          }
        }
        crown.slowTimer = Math.max(crown.slowTimer ?? 0, def.slowDuration);
        crown.slowMul = Math.min(crown.slowMul ?? 1, def.slowMul);
        // Command the battery — every other artifact fires next tick
        let commanded = 0;
        for (const other of state.turrets) {
          if (!other.alive || other.id === t.id) continue;
          other.fireCd = 0;
          commanded++;
        }
        if (commanded > 0) {
          state.toast = "Sovereign Nexus commands the line!";
          state.toastTimer = 1.1;
        }
        break;
      }
      default: {
        if (!target) continue;
        fireBolt(state, t, target, damage, def.projectileColor);
        break;
      }
    }

    t.fireCd = def.fireCooldown * cdMul;
  }
  state.turrets = state.turrets.filter((t) => t.alive);
}

function pickCrownTarget(
  state: GameState,
  from: { x: number; y: number },
  range: number,
): EnemyUnit | null {
  const inRange = state.enemies.filter((e) => e.alive && dist(from, e) <= range + e.radius);
  if (inRange.length === 0) return null;
  const bosses = inRange.filter((e) => isBossKind(e.kind));
  const elites = inRange.filter((e) => isEliteKind(e.kind));
  const pool = bosses.length > 0 ? bosses : elites.length > 0 ? elites : inRange;
  let best = pool[0]!;
  for (const e of pool) {
    if (e.maxHp > best.maxHp || (e.maxHp === best.maxHp && e.hp > best.hp)) best = e;
  }
  return best;
}

function nearestEnemyInRange(
  state: GameState,
  from: { x: number; y: number },
  range: number,
) {
  let best = null as (typeof state.enemies)[0] | null;
  let bestD = range;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const d = dist(from, e);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

export function damageTurret(state: GameState, t: TurretUnit, amount: number): void {
  if (!t.alive || amount <= 0) return;
  t.hp -= amount;
  if (t.hp <= 0) {
    t.alive = false;
    t.hp = 0;
    state.toast = "Turret destroyed!";
    state.toastTimer = 1.2;
    addFx(state, t.x, t.y, 36, "#ff606088", 0.4);
  }
}
