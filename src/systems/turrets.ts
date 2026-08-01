import { TURRET_DEFS, type TurretKind } from "../data/turrets";
import { dist, normalize } from "../game/math";
import type { GameState, TurretUnit } from "../game/state";
import { addFx, damageEnemy, pushProjectile } from "./combat";
import { hasRelic } from "./relics";

export function livingTurrets(state: GameState): TurretUnit[] {
  return state.turrets.filter((t) => t.alive);
}

export function effectiveMaxTurrets(state: GameState): number {
  return state.maxTurrets + (hasRelic(state, "architects_favor") ? 1 : 0);
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

export function updateTurrets(state: GameState, dt: number): void {
  const dmgMul =
    (hasRelic(state, "architects_favor") ? 1.25 : 1) *
    (state.baseBranchMods?.artifactDamageMul ?? 1) *
    (state.utilityTurretBoost > 0 ? 1.4 : 1);
  const cdMul =
    (hasRelic(state, "turret_overclock") ? 0.7 : 1) * (state.baseBranchMods?.artifactFireMul ?? 1);
  for (const t of state.turrets) {
    if (!t.alive) continue;
    t.fireCd = Math.max(0, t.fireCd - dt);
    if (t.fireCd > 0) continue;

    const def = TURRET_DEFS[t.kind];
    const target = nearestEnemyInRange(state, t, def.range);
    if (!target) continue;

    const damage = def.damage * dmgMul;
    if (def.aoeRadius > 0) {
      addFx(state, t.x, t.y, def.aoeRadius, def.projectileColor + "55", 0.25);
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (dist(t, e) <= def.aoeRadius + e.radius) {
          damageEnemy(state, e, damage);
          if (def.slowMul < 1) {
            e.slowTimer = Math.max(e.slowTimer ?? 0, def.slowDuration);
            e.slowMul = Math.min(e.slowMul ?? 1, def.slowMul);
          }
        }
      }
    } else {
      const n = normalize(target.x - t.x, target.y - t.y);
      pushProjectile(state, {
        x: t.x,
        y: t.y,
        vx: n.x * 420,
        vy: n.y * 420,
        damage,
        radius: 3.5,
        kind: "bolt",
        color: def.projectileColor,
        fromBasic: false,
      });
    }
    t.fireCd = def.fireCooldown * cdMul;
  }
  state.turrets = state.turrets.filter((t) => t.alive);
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
