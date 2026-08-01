/** Shop Artifacts — placeable auto-turrets with distinct behaviors. */

export type TurretKind =
  | "ballista"
  | "brazier"
  | "hex_totem"
  | "frost_spire"
  | "chain_coil"
  | "gold_siphon"
  | "bastion_lamp"
  | "venom_censer"
  | "grav_anchor"
  | "rail_lance"
  | "splinter_nest"
  | "execute_glyph"
  | "mine_layer"
  | "storm_rod"
  | "ward_beacon"
  | "sovereign_nexus";

export type TurretBehavior =
  | "bolt"
  | "aoe"
  | "slow"
  | "chain"
  | "gold"
  | "heal_base"
  | "poison"
  | "pull"
  | "rail"
  | "multishot"
  | "execute"
  | "mine"
  | "storm"
  | "ward"
  | "sovereign";

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
  behavior: TurretBehavior;
  /** Short map label (2–3 letters). */
  label: string;
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
    behavior: "bolt",
    label: "BAL",
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
    behavior: "aoe",
    label: "AOE",
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
    behavior: "slow",
    label: "HEX",
  },
  frost_spire: {
    kind: "frost_spire",
    shopId: "frost_spire",
    name: "Frost Spire",
    cost: 135,
    effect: "Artifact: heavy chill pulses that nearly stop foes",
    maxHp: 72,
    radius: 13,
    range: 145,
    fireCooldown: 1.25,
    damage: 7,
    aoeRadius: 110,
    slowMul: 0.35,
    slowDuration: 1.6,
    color: "#3a6a90",
    stroke: "#a8e0ff",
    projectileColor: "#7ec8ff",
    behavior: "slow",
    label: "FRS",
  },
  chain_coil: {
    kind: "chain_coil",
    shopId: "chain_coil",
    name: "Chain Coil",
    cost: 145,
    effect: "Artifact: bolt jumps to 2 extra enemies",
    maxHp: 78,
    radius: 14,
    range: 200,
    fireCooldown: 1.0,
    damage: 11,
    aoeRadius: 0,
    slowMul: 1,
    slowDuration: 0,
    color: "#8a7a28",
    stroke: "#ffe08a",
    projectileColor: "#ffd24a",
    behavior: "chain",
    label: "CHN",
  },
  gold_siphon: {
    kind: "gold_siphon",
    shopId: "gold_siphon",
    name: "Gold Siphon",
    cost: 125,
    effect: "Artifact: weak bolts; +1 gold per hit",
    maxHp: 65,
    radius: 12,
    range: 180,
    fireCooldown: 0.7,
    damage: 5,
    aoeRadius: 0,
    slowMul: 1,
    slowDuration: 0,
    color: "#8a7020",
    stroke: "#f0d060",
    projectileColor: "#ffe080",
    behavior: "gold",
    label: "GLD",
  },
  bastion_lamp: {
    kind: "bastion_lamp",
    shopId: "bastion_lamp",
    name: "Bastion Lamp",
    cost: 130,
    effect: "Artifact: light damage; repairs base 2 HP per shot",
    maxHp: 85,
    radius: 14,
    range: 160,
    fireCooldown: 1.2,
    damage: 6,
    aoeRadius: 0,
    slowMul: 1,
    slowDuration: 0,
    color: "#4a6a58",
    stroke: "#90d0a8",
    projectileColor: "#70c890",
    behavior: "heal_base",
    label: "BST",
  },
  venom_censer: {
    kind: "venom_censer",
    shopId: "venom_censer",
    name: "Venom Censer",
    cost: 140,
    effect: "Artifact: poison cloud DoT pulse",
    maxHp: 68,
    radius: 14,
    range: 125,
    fireCooldown: 1.5,
    damage: 4,
    aoeRadius: 100,
    slowMul: 0.85,
    slowDuration: 1.0,
    color: "#3a6840",
    stroke: "#80e090",
    projectileColor: "#60c070",
    behavior: "poison",
    label: "VEN",
  },
  grav_anchor: {
    kind: "grav_anchor",
    shopId: "grav_anchor",
    name: "Grav Anchor",
    cost: 150,
    effect: "Artifact: pulls enemies inward then pulses damage",
    maxHp: 80,
    radius: 15,
    range: 140,
    fireCooldown: 1.6,
    damage: 9,
    aoeRadius: 115,
    slowMul: 0.7,
    slowDuration: 0.8,
    color: "#4a5080",
    stroke: "#a0a8ff",
    projectileColor: "#7880e8",
    behavior: "pull",
    label: "GRV",
  },
  rail_lance: {
    kind: "rail_lance",
    shopId: "rail_lance",
    name: "Rail Lance",
    cost: 160,
    effect: "Artifact: long-range piercing rail shot",
    maxHp: 70,
    radius: 12,
    range: 320,
    fireCooldown: 2.0,
    damage: 28,
    aoeRadius: 0,
    slowMul: 1,
    slowDuration: 0,
    color: "#708090",
    stroke: "#d0e8ff",
    projectileColor: "#ffffff",
    behavior: "rail",
    label: "RAL",
  },
  splinter_nest: {
    kind: "splinter_nest",
    shopId: "splinter_nest",
    name: "Splinter Nest",
    cost: 135,
    effect: "Artifact: fires a fan of pellets at nearest foe",
    maxHp: 74,
    radius: 13,
    range: 170,
    fireCooldown: 1.15,
    damage: 5,
    aoeRadius: 0,
    slowMul: 1,
    slowDuration: 0,
    color: "#7a5040",
    stroke: "#e0a080",
    projectileColor: "#ffb090",
    behavior: "multishot",
    label: "SPL",
  },
  execute_glyph: {
    kind: "execute_glyph",
    shopId: "execute_glyph",
    name: "Execute Glyph",
    cost: 155,
    effect: "Artifact: +80% damage vs enemies below 30% HP",
    maxHp: 72,
    radius: 13,
    range: 190,
    fireCooldown: 0.95,
    damage: 12,
    aoeRadius: 0,
    slowMul: 1,
    slowDuration: 0,
    color: "#6a2840",
    stroke: "#ff7090",
    projectileColor: "#ff4060",
    behavior: "execute",
    label: "EXE",
  },
  mine_layer: {
    kind: "mine_layer",
    shopId: "mine_layer",
    name: "Mine Layer",
    cost: 145,
    effect: "Artifact: drops proximity mines toward the lane",
    maxHp: 76,
    radius: 14,
    range: 200,
    fireCooldown: 2.2,
    damage: 22,
    aoeRadius: 55,
    slowMul: 1,
    slowDuration: 0,
    color: "#5a5038",
    stroke: "#c8b070",
    projectileColor: "#e0c060",
    behavior: "mine",
    label: "MNE",
  },
  storm_rod: {
    kind: "storm_rod",
    shopId: "storm_rod",
    name: "Storm Rod",
    cost: 150,
    effect: "Artifact: random lightning strikes within range",
    maxHp: 70,
    radius: 13,
    range: 175,
    fireCooldown: 1.3,
    damage: 16,
    aoeRadius: 40,
    slowMul: 1,
    slowDuration: 0,
    color: "#405878",
    stroke: "#90c8ff",
    projectileColor: "#60a8ff",
    behavior: "storm",
    label: "STM",
  },
  ward_beacon: {
    kind: "ward_beacon",
    shopId: "ward_beacon",
    name: "Ward Beacon",
    cost: 140,
    effect: "Artifact: slows foes; heroes nearby take 12% less damage",
    maxHp: 88,
    radius: 15,
    range: 130,
    fireCooldown: 1.35,
    damage: 5,
    aoeRadius: 125,
    slowMul: 0.65,
    slowDuration: 1.0,
    color: "#486878",
    stroke: "#a0e0d0",
    projectileColor: "#70d0c0",
    behavior: "ward",
    label: "WRD",
  },
  sovereign_nexus: {
    kind: "sovereign_nexus",
    shopId: "sovereign_nexus",
    name: "Sovereign Nexus",
    cost: 240,
    effect:
      "Legendary Artifact: crowns a tough foe for massive damage + splash, then commands every other artifact to fire at once",
    maxHp: 120,
    radius: 17,
    range: 250,
    fireCooldown: 4.0,
    damage: 48,
    aoeRadius: 85,
    slowMul: 0.45,
    slowDuration: 1.4,
    color: "#6a5420",
    stroke: "#ffe08a",
    projectileColor: "#fff0b0",
    behavior: "sovereign",
    label: "SOV",
  },
};

export const TURRET_LIST: TurretDef[] = Object.values(TURRET_DEFS);

export const DEFAULT_MAX_TURRETS = 3;

export function isTurretKind(id: string): id is TurretKind {
  return id in TURRET_DEFS;
}
