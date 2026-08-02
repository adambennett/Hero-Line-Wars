/** Gunner arsenal — ultimate weapons fired via the mobility (RMB) slot. */

export type GunnerWeaponId =
  | "rockets"
  | "bolt_sniper"
  | "auto_sniper"
  | "shotgun"
  | "br"
  | "ar"
  | "lmg"
  | "laser";

export type GunnerFireMode =
  /** Tap / hold: fire while held when CD ready (auto weapons). */
  | "auto"
  /** Hold to aim; fire on release (or tap-fire). */
  | "aim_release"
  /** Hold to charge; auto-fires at full charge. */
  | "charge";

export type GunnerWeaponDef = {
  id: GunnerWeaponId;
  name: string;
  blurb: string;
  /** Clip size; 1 = single-shot (reload = cooldown). */
  clip: number;
  /** Seconds to refill clip when emptied. */
  reload: number;
  /** Inter-shot cooldown while ammo remains (0 for snipers that only reload). */
  fireCd: number;
  /** Damage multiplier vs Gunner's basic attack damage. */
  damageMul: number;
  projectileSpeed: number;
  /** AoE blast radius on hit (0 = none). */
  aoeRadius: number;
  pierce: number;
  pelletCount: number;
  spread: number;
  fireMode: GunnerFireMode;
  /** LMG: movement speed multiplier while this weapon is equipped. */
  moveMul?: number;
  /** Laser: seconds of hold before discharge. */
  chargeTime?: number;
  /** Laser: fraction of max HP dealt to self on fire. */
  selfDamageFrac?: number;
  /** Laser beam length. */
  beamRange?: number;
  color: string;
};

export const GUNNER_WEAPONS: Record<GunnerWeaponId, GunnerWeaponDef> = {
  rockets: {
    id: "rockets",
    name: "Rockets",
    blurb: "High damage AoE rocket — slow projectile, long reload.",
    clip: 1,
    reload: 5.5,
    fireCd: 0,
    damageMul: 4.2,
    projectileSpeed: 280,
    aoeRadius: 72,
    pierce: 0,
    pelletCount: 1,
    spread: 0,
    fireMode: "auto",
    color: "#ff7040",
  },
  bolt_sniper: {
    id: "bolt_sniper",
    name: "Bolt Sniper",
    blurb: "Hold to aim (freezes solo). Single high-damage piercing shot.",
    clip: 1,
    reload: 3.0,
    fireCd: 0,
    damageMul: 5.5,
    projectileSpeed: 1100,
    aoeRadius: 0,
    pierce: 6,
    pelletCount: 1,
    spread: 0,
    fireMode: "aim_release",
    color: "#90e0ff",
  },
  auto_sniper: {
    id: "auto_sniper",
    name: "Auto Sniper",
    blurb: "4-round clip sniper with hold-to-aim. Lower damage, faster reload.",
    clip: 4,
    reload: 2.4,
    fireCd: 0.35,
    damageMul: 2.4,
    projectileSpeed: 1000,
    aoeRadius: 0,
    pierce: 3,
    pelletCount: 1,
    spread: 0.01,
    fireMode: "aim_release",
    color: "#70c8ff",
  },
  shotgun: {
    id: "shotgun",
    name: "Shotgun",
    blurb: "2-shot clip scatter blast — low per pellet, high total.",
    clip: 2,
    reload: 1.8,
    fireCd: 0.45,
    damageMul: 0.85,
    projectileSpeed: 520,
    aoeRadius: 0,
    pierce: 0,
    pelletCount: 8,
    spread: 0.22,
    fireMode: "auto",
    color: "#ff9860",
  },
  br: {
    id: "br",
    name: "Battle Rifle",
    blurb: "3-round bursts, 21-round clip, light spread.",
    clip: 21,
    reload: 2.4,
    fireCd: 0.48,
    damageMul: 1.35,
    projectileSpeed: 720,
    aoeRadius: 0,
    pierce: 0,
    pelletCount: 3,
    spread: 0.06,
    fireMode: "auto",
    color: "#c8d8ff",
  },
  ar: {
    id: "ar",
    name: "Assault Rifle",
    blurb: "30-round clip, steady fire, stronger than the machine gun.",
    clip: 30,
    reload: 2.2,
    fireCd: 0.11,
    damageMul: 1.15,
    projectileSpeed: 700,
    aoeRadius: 0,
    pierce: 0,
    pelletCount: 1,
    spread: 0.04,
    fireMode: "auto",
    color: "#a8c0e0",
  },
  lmg: {
    id: "lmg",
    name: "LMG",
    blurb: "100-round belt. Slows you. Inaccurate, spins up. Very long reload.",
    clip: 100,
    reload: 10.0,
    fireCd: 0.08,
    damageMul: 1.55,
    projectileSpeed: 640,
    aoeRadius: 0,
    pierce: 0,
    pelletCount: 1,
    spread: 0.28,
    fireMode: "auto",
    moveMul: 0.55,
    color: "#e0b060",
  },
  laser: {
    id: "laser",
    name: "Laser",
    blurb: "Charge then pierce through walls. Extreme damage — hurts you too.",
    clip: 1,
    reload: 7.0,
    fireCd: 0,
    damageMul: 7.5,
    projectileSpeed: 0,
    aoeRadius: 0,
    pierce: 99,
    pelletCount: 1,
    spread: 0,
    fireMode: "charge",
    chargeTime: 1.15,
    selfDamageFrac: 0.08,
    beamRange: 900,
    color: "#ff4060",
  },
};

export const GUNNER_WEAPON_ORDER: GunnerWeaponId[] = [
  "rockets",
  "bolt_sniper",
  "auto_sniper",
  "shotgun",
  "br",
  "ar",
  "lmg",
  "laser",
];

export function gunnerWeaponAt(index: number): GunnerWeaponDef {
  const id = GUNNER_WEAPON_ORDER[((index % GUNNER_WEAPON_ORDER.length) + GUNNER_WEAPON_ORDER.length) % GUNNER_WEAPON_ORDER.length]!;
  return GUNNER_WEAPONS[id];
}
