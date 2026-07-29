/** Shop Artifacts — placeable auto-turrets. */

export type TurretKind = "ballista" | "brazier" | "hex_totem";

export type TurretDef = {
  kind: TurretKind;
  /** Shop item id alias (same string). */
  shopId: TurretKind;
  name: string;
  cost: number;
  effect: string;
  maxHp: number;
  radius: number;
  range: number;
  /** Seconds between shots / pulses. */
  fireCooldown: number;
  damage: number;
  /** AoE pulse radius (0 = single-target projectile). */
  aoeRadius: number;
  /** Slow multiplier applied for a short time (1 = none). */
  slowMul: number;
  slowDuration: number;
  color: string;
  stroke: string;
  projectileColor: string;
};

export const TURRET_DEFS: Record<TurretKind, TurretDef> = {
  ballista: {
    kind: "ballista",
    shopId: "ballista",
    name: "Ballista Emplacement",
    cost: 120,
    effect: "Artifact: auto bolt turret (single-target DPS)",
    maxHp: 90,
    radius: 14,
    range: 220,
    fireCooldown: 0.85,
    damage: 14,
    aoeRadius: 0,
    slowMul: 1,
    slowDuration: 0,
    color: "#6a7a90",
    stroke: "#c8d4e8",
    projectileColor: "#dde8ff",
  },
  brazier: {
    kind: "brazier",
    shopId: "brazier",
    name: "Flame Brazier",
    cost: 140,
    effect: "Artifact: AoE burn pulse turret",
    maxHp: 75,
    radius: 15,
    range: 130,
    fireCooldown: 1.4,
    damage: 11,
    aoeRadius: 95,
    slowMul: 1,
    slowDuration: 0,
    color: "#a04828",
    stroke: "#ffb070",
    projectileColor: "#ff8040",
  },
  hex_totem: {
    kind: "hex_totem",
    shopId: "hex_totem",
    name: "Hex Totem",
    cost: 130,
    effect: "Artifact: slows nearby enemies + light damage",
    maxHp: 70,
    radius: 13,
    range: 150,
    fireCooldown: 1.1,
    damage: 6,
    aoeRadius: 120,
    slowMul: 0.55,
    slowDuration: 1.2,
    color: "#5a3a78",
    stroke: "#c8a0ff",
    projectileColor: "#b080ff",
  },
};

export const TURRET_LIST: TurretDef[] = Object.values(TURRET_DEFS);

export const DEFAULT_MAX_TURRETS = 3;
