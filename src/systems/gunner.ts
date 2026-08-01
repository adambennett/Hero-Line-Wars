/**
 * Gunner arsenal FSM — clips, reload, aim-freeze, spin-up, laser self-damage.
 *
 * Weapon switch: Ultimate (MMB) cycles the equipped gun.
 * Fire: Mobility hold (RMB) fires / aims / charges the equipped gun.
 * LMB remains the rapid-fire machine gun basic.
 */
import { heroUsesGunnerKit } from "../custom/registry";
import {
  GUNNER_WEAPON_ORDER,
  gunnerWeaponAt,
  type GunnerWeaponDef,
  type GunnerWeaponId,
} from "../data/gunnerWeapons";
import { canFreezeForAim } from "../game/pause";
import { clamp, normalize } from "../game/math";
import type { GameState, HeroRuntime } from "../game/state";
import {
  addFx,
  applyPlayerDamage,
  attackDamage,
  damageEnemy,
  pushProjectile,
} from "./combat";
import { playSfx } from "./audio";
import { gunnerWeaponMods } from "./heroPerks";

export type GunnerTickInput = {
  /** RMB / mobility held — fire / aim / charge. */
  fireHeld: boolean;
  /** Ultimate pressed this frame — cycle weapon. */
  cycle: boolean;
  /** Aim world point (already set on state for local hero). */
  dt: number;
};

function ensureGunner(h: HeroRuntime): void {
  if (h.gunnerWeaponIndex == null) h.gunnerWeaponIndex = 0;
  if (h.gunnerAmmo == null) {
    h.gunnerAmmo = gunnerWeaponAt(h.gunnerWeaponIndex).clip;
  }
  if (h.gunnerReload == null) h.gunnerReload = 0;
  if (h.gunnerWeaponCd == null) h.gunnerWeaponCd = 0;
  if (h.gunnerAiming == null) h.gunnerAiming = false;
  if (h.gunnerAimTime == null) h.gunnerAimTime = 0;
  if (h.gunnerSpin == null) h.gunnerSpin = 0;
  if (h.gunnerCharge == null) h.gunnerCharge = 0;
  if (h.gunnerSwapCd == null) h.gunnerSwapCd = 0;
  if (h.gunnerSelfDamageFlash == null) h.gunnerSelfDamageFlash = 0;
}

export function currentGunnerWeapon(h: HeroRuntime): GunnerWeaponDef {
  ensureGunner(h);
  return gunnerWeaponAt(h.gunnerWeaponIndex ?? 0);
}

export function gunnerIsAiming(h: HeroRuntime): boolean {
  return !!h.gunnerAiming && heroUsesGunnerKit(h.heroId);
}

/** Immobile while sniper-aiming in ANY mode. */
export function gunnerMoveLocked(h: HeroRuntime): boolean {
  if (!heroUsesGunnerKit(h.heroId)) return false;
  ensureGunner(h);
  const w = currentGunnerWeapon(h);
  if (w.fireMode === "aim_release" && h.gunnerAiming) return true;
  if (w.fireMode === "charge" && (h.gunnerCharge ?? 0) > 0.05) return true;
  return false;
}

export function gunnerMoveSpeedMul(state: GameState, h: HeroRuntime = state.hero): number {
  if (!heroUsesGunnerKit(h.heroId)) return 1;
  ensureGunner(h);
  if (gunnerMoveLocked(h)) return 0;
  const w = currentGunnerWeapon(h);
  let mul = w.moveMul ?? 1;
  if (w.id === "lmg" && (h.gunnerSpin ?? 0) > 0) {
    mul *= 1 - Math.min(0.25, (h.gunnerSpin ?? 0) * 0.25);
  }
  return mul;
}

/** Solo / single-human: freeze the sim while sniper-aiming. */
export function gunnerShouldFreezeSim(state: GameState): boolean {
  if (!canFreezeForAim(state)) return false;
  if (!heroUsesGunnerKit(state.hero.heroId) || !state.hero.alive) return false;
  return gunnerIsAiming(state.hero);
}

function aimDir(state: GameState): { x: number; y: number } {
  const n = normalize(state.aimWorldX - state.hero.x, state.aimWorldY - state.hero.y);
  if (n.x === 0 && n.y === 0) return { x: 1, y: 0 };
  return n;
}

function steadyBonus(aimTime: number): number {
  // Up to +35% damage after 1.2s of steady aim (solo freeze or multi-human).
  return 1 + Math.min(0.35, (aimTime / 1.2) * 0.35);
}

function consumeAmmo(state: GameState, h: HeroRuntime, w: GunnerWeaponDef): void {
  h.gunnerAmmo = Math.max(0, (h.gunnerAmmo ?? 0) - 1);
  if ((h.gunnerAmmo ?? 0) <= 0) {
    const mods = gunnerWeaponMods(state, w.id);
    h.gunnerReload = w.reload * mods.reloadMul;
  }
}

function fireWeapon(state: GameState, w: GunnerWeaponDef): void {
  const h = state.hero;
  const facing = aimDir(state);
  const angle = Math.atan2(facing.y, facing.x);
  const mods = gunnerWeaponMods(state, w.id);
  const aimTime = h.gunnerAiming || w.fireMode === "aim_release" ? (h.gunnerAimTime ?? 0) : 0;
  const dmg =
    attackDamage(state) * w.damageMul * mods.damageMul * steadyBonus(aimTime);

  if (w.id === "laser") {
    fireLaser(state, w, facing, dmg);
  } else if (w.id === "br") {
    // 3-round burst as one fire action
    for (let i = 0; i < 3; i++) {
      const a = angle + (Math.random() * 2 - 1) * w.spread;
      pushProjectile(state, {
        x: h.x,
        y: h.y,
        vx: Math.cos(a) * w.projectileSpeed,
        vy: Math.sin(a) * w.projectileSpeed,
        damage: dmg,
        radius: 3.5,
        kind: "bolt",
        color: w.color,
        pierceLeft: w.pierce,
        life: 0.9,
      });
    }
    addFx(state, h.x + facing.x * 20, h.y + facing.y * 20, 18, `${w.color}88`, 0.15);
  } else {
    const pellets = Math.max(1, w.pelletCount);
    for (let i = 0; i < pellets; i++) {
      let a = angle;
      if (pellets > 1) {
        const t = pellets === 1 ? 0 : (i / (pellets - 1) - 0.5) * 2;
        a += t * w.spread * (pellets > 1 ? 1 : 0);
        if (w.id === "lmg" || w.id === "ar" || w.id === "shotgun") {
          a += (Math.random() * 2 - 1) * w.spread * (w.id === "lmg" ? 1 : 0.35);
        }
      } else if (w.spread > 0) {
        a += (Math.random() * 2 - 1) * w.spread;
      }
      pushProjectile(state, {
        x: h.x,
        y: h.y,
        vx: Math.cos(a) * w.projectileSpeed,
        vy: Math.sin(a) * w.projectileSpeed,
        damage: dmg,
        radius: w.aoeRadius > 0 ? 6 : w.id.includes("sniper") ? 4 : 3.2,
        kind: w.aoeRadius > 0 ? "heavy" : "bolt",
        color: w.color,
        pierceLeft: w.pierce,
        aoeRadius: w.aoeRadius > 0 ? w.aoeRadius : undefined,
        life: w.aoeRadius > 0 ? 1.4 : 0.85,
      });
    }
    addFx(state, h.x + facing.x * 22, h.y + facing.y * 22, 16, `${w.color}88`, 0.12);
  }

  const cdMul = mods.cdMul;
  h.gunnerWeaponCd = (w.fireCd || 0) * cdMul;
  // Clip bonus from perks applies on reload fill; consume one "shot" (BR consumes 1 ammo for burst)
  consumeAmmo(state, h, w);
  playSfx("cast");
  state.abilitiesCast += 1;
}

function fireLaser(
  state: GameState,
  w: GunnerWeaponDef,
  facing: { x: number; y: number },
  dmg: number,
): void {
  const h = state.hero;
  const range = w.beamRange ?? 900;
  const endX = h.x + facing.x * range;
  const endY = h.y + facing.y * range;
  // Wall-penetrating — ignore obstacles for hit tests
  state.beam = {
    x1: h.x,
    y1: h.y,
    x2: endX,
    y2: endY,
    life: 0.28,
    color: w.color,
    width: 7,
  };
  addFx(state, h.x + facing.x * (range * 0.4), h.y + facing.y * (range * 0.4), 40, "#ff406088", 0.35);
  state.shake = Math.max(state.shake, 0.35);

  for (const e of state.enemies) {
    if (!e.alive) continue;
    const dx = facing.x * range;
    const dy = facing.y * range;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((e.x - h.x) * dx + (e.y - h.y) * dy) / len2));
    const px = h.x + dx * t;
    const py = h.y + dy * t;
    if (Math.hypot(px - e.x, py - e.y) <= e.radius + 14) {
      damageEnemy(state, e, dmg);
    }
  }

  // Self-damage — clear VFX so the player knows why HP dropped
  const lensCool = state.levelPassives.includes("gunner_lens_cooling" as never);
  const selfFrac = (w.selfDamageFrac ?? 0.08) * (lensCool ? 0.75 : 1);
  const selfDmg = Math.max(4, h.maxHp * selfFrac);
  applyPlayerDamage(state, selfDmg);
  h.gunnerSelfDamageFlash = 0.55;
  addFx(state, h.x, h.y, 48, "#ff2040aa", 0.45);
  addFx(state, h.x - 10, h.y - 18, 22, "#ff8080", 0.35);
  state.toast = "Laser feedback!";
  state.toastTimer = 1.1;
  state.damageFlash = Math.max(state.damageFlash, 0.4);
}

function cycleWeapon(state: GameState): void {
  const h = state.hero;
  ensureGunner(h);
  if ((h.gunnerSwapCd ?? 0) > 0) return;
  h.gunnerWeaponIndex = ((h.gunnerWeaponIndex ?? 0) + 1) % GUNNER_WEAPON_ORDER.length;
  const w = currentGunnerWeapon(h);
  const mods = gunnerWeaponMods(state, w.id);
  h.gunnerAmmo = w.clip + mods.clipBonus;
  h.gunnerReload = 0;
  h.gunnerWeaponCd = 0.15;
  h.gunnerAiming = false;
  h.gunnerAimTime = 0;
  h.gunnerSpin = 0;
  h.gunnerCharge = 0;
  h.gunnerSwapCd = 0.35;
  state.toast = w.name;
  state.toastTimer = 1.0;
  playSfx("cast");
}

/**
 * Full Gunner weapon tick. Call inside withHero / primary hero context.
 * Returns true if this frame should freeze the rest of the sim (solo sniper aim).
 */
export function tickGunnerWeapons(state: GameState, input: GunnerTickInput): boolean {
  if (!heroUsesGunnerKit(state.hero.heroId) || !state.hero.alive) return false;
  const h = state.hero;
  ensureGunner(h);
  const dt = input.dt;

  h.gunnerSwapCd = Math.max(0, (h.gunnerSwapCd ?? 0) - dt);
  h.gunnerWeaponCd = Math.max(0, (h.gunnerWeaponCd ?? 0) - dt);
  h.gunnerSelfDamageFlash = Math.max(0, (h.gunnerSelfDamageFlash ?? 0) - dt);

  if (input.cycle) cycleWeapon(state);

  const w = currentGunnerWeapon(h);

  // Reload
  if ((h.gunnerReload ?? 0) > 0) {
    h.gunnerReload = Math.max(0, (h.gunnerReload ?? 0) - dt);
    if ((h.gunnerReload ?? 0) <= 0) {
      const mods = gunnerWeaponMods(state, w.id);
      h.gunnerAmmo = w.clip + mods.clipBonus;
    }
    h.gunnerAiming = false;
    h.gunnerAimTime = 0;
    h.gunnerSpin = 0;
    h.gunnerCharge = 0;
    return false;
  }

  if ((h.gunnerAmmo ?? 0) <= 0) {
    const mods = gunnerWeaponMods(state, w.id);
    h.gunnerReload = w.reload * mods.reloadMul;
    return false;
  }

  if (w.fireMode === "aim_release") {
    if (input.fireHeld) {
      h.gunnerAiming = true;
      h.gunnerAimTime = (h.gunnerAimTime ?? 0) + dt;
      // Freeze only when policy allows; multi-human still aims + locks move.
      return canFreezeForAim(state);
    }
    if (h.gunnerAiming) {
      // Release — fire if CD ready
      h.gunnerAiming = false;
      if ((h.gunnerWeaponCd ?? 0) <= 0) {
        fireWeapon(state, w);
      }
      h.gunnerAimTime = 0;
    }
    return false;
  }

  if (w.fireMode === "charge") {
    if (input.fireHeld) {
      const chargeTime = w.chargeTime ?? 1.15;
      h.gunnerCharge = Math.min(1, (h.gunnerCharge ?? 0) + dt / chargeTime);
      if ((h.gunnerCharge ?? 0) >= 1 && (h.gunnerWeaponCd ?? 0) <= 0) {
        fireWeapon(state, w);
        h.gunnerCharge = 0;
      }
    } else {
      h.gunnerCharge = 0;
    }
    return false;
  }

  // Auto fire (rockets, shotgun, BR, AR, LMG)
  if (input.fireHeld) {
    if (w.id === "lmg") {
      h.gunnerSpin = Math.min(1, (h.gunnerSpin ?? 0) + dt / 1.1);
      // Spin-up: fire rate scales from 35% to 100%
      const spin = h.gunnerSpin ?? 0;
      const spinCd = (w.fireCd || 0.08) * (1.8 - spin * 0.8);
      if ((h.gunnerWeaponCd ?? 0) <= 0) {
        // Temporarily override fire cd via direct fire
        const mods = gunnerWeaponMods(state, w.id);
        const facing = aimDir(state);
        const angle = Math.atan2(facing.y, facing.x) + (Math.random() * 2 - 1) * w.spread;
        const dmg = attackDamage(state) * w.damageMul * mods.damageMul;
        pushProjectile(state, {
          x: h.x,
          y: h.y,
          vx: Math.cos(angle) * w.projectileSpeed,
          vy: Math.sin(angle) * w.projectileSpeed,
          damage: dmg,
          radius: 3.2,
          kind: "bolt",
          color: w.color,
          life: 0.7,
        });
        h.gunnerWeaponCd = spinCd * mods.cdMul;
        consumeAmmo(state, h, w);
        playSfx("hit");
        state.abilitiesCast += 1;
      }
    } else if ((h.gunnerWeaponCd ?? 0) <= 0) {
      fireWeapon(state, w);
    }
  } else if (w.id === "lmg") {
    h.gunnerSpin = Math.max(0, (h.gunnerSpin ?? 0) - dt * 1.4);
  }

  return false;
}

/** Aim-freeze frame: only gunner weapon tick + aim update. */
export function tickGunnerAimFreezeOnly(
  state: GameState,
  input: GunnerTickInput & { aimWorldX: number; aimWorldY: number },
): void {
  state.aimWorldX = input.aimWorldX;
  state.aimWorldY = input.aimWorldY;
  tickGunnerWeapons(state, input);
}

export function gunnerWeaponLabel(h: HeroRuntime): string {
  if (!heroUsesGunnerKit(h.heroId)) return "";
  const w = currentGunnerWeapon(h);
  const ammo = h.gunnerAmmo ?? w.clip;
  if ((h.gunnerReload ?? 0) > 0) return `${w.name} · REL ${(h.gunnerReload ?? 0).toFixed(1)}`;
  return `${w.name} · ${ammo}/${w.clip}`;
}

export function isGunnerWeaponId(id: string): id is GunnerWeaponId {
  return (GUNNER_WEAPON_ORDER as string[]).includes(id);
}

/** Basic machine-gun profile helpers for combat. */
export function gunnerBasicDamageMul(state: GameState): number {
  if (!heroUsesGunnerKit(state.hero.heroId)) return 1;
  // Machine gun is intentionally low per-hit; perk passiveMul can boost.
  return 1;
}

export function initGunnerHero(h: HeroRuntime): void {
  if (!heroUsesGunnerKit(h.heroId)) return;
  h.gunnerWeaponIndex = 0;
  h.gunnerAmmo = gunnerWeaponAt(0).clip;
  h.gunnerReload = 0;
  h.gunnerWeaponCd = 0;
  h.gunnerAiming = false;
  h.gunnerAimTime = 0;
  h.gunnerSpin = 0;
  h.gunnerCharge = 0;
  h.gunnerSwapCd = 0;
  h.gunnerSelfDamageFlash = 0;
}

/** Exposed for tests. */
export function __testFireWeapon(state: GameState, weaponId: GunnerWeaponId): void {
  const idx = GUNNER_WEAPON_ORDER.indexOf(weaponId);
  state.hero.gunnerWeaponIndex = idx;
  state.hero.gunnerAmmo = gunnerWeaponAt(idx).clip;
  state.hero.gunnerReload = 0;
  state.hero.gunnerWeaponCd = 0;
  fireWeapon(state, gunnerWeaponAt(idx));
}

export function __testSteadyBonus(aimTime: number): number {
  return steadyBonus(aimTime);
}

export function clampGunnerIndex(i: number): number {
  return clamp(Math.floor(i), 0, GUNNER_WEAPON_ORDER.length - 1);
}
