/**
 * Serializable custom map / hero definitions for Workshop + MP sync.
 */

import type {
  AbilityDef,
  AimMode,
  AttackStyle,
  HeroPassive,
} from "../data/heroes";
import type {
  HighGroundZone,
  Obstacle,
  PointPad,
  ShopPad,
  TurretSlot,
} from "../data/maps";
import type { MapShapeId } from "../game/playBounds";

export const CUSTOM_MAP_PREFIX = "cm_";
export const CUSTOM_HERO_PREFIX = "ch_";

export const CUSTOM_MAP_FORMAT = "hlw-custom-map/v1";
export const CUSTOM_HERO_FORMAT = "hlw-custom-hero/v1";

export type RectZone = { x: number; y: number; w: number; h: number; label?: string };

export type WindZone = RectZone & { vx: number; vy: number };

export type SpikePoint = { x: number; y: number; radius: number; damage?: number };

export type BouncePadZone = RectZone & { impulseX: number; impulseY: number };

export type MapPortalPad = {
  x: number;
  y: number;
  radius: number;
  exitX: number;
  exitY: number;
};

export type RelayBeaconPad = { x: number; y: number; radius: number; damageBonus?: number };

export type CustomMapSpecials = {
  shiftingObstacles?: boolean;
  shrinkingLane?: boolean;
  movingHazards?: boolean;
  eclipseFog?: boolean;
  dualSpawners?: boolean;
  /** Higher chance for chests to spawn. */
  chestMagnet?: boolean;
  /** Periodic horizontal rifts yank units toward lane mid-X during waves. */
  riftSurges?: boolean;
  /** Spawns delayed explosive orbs in the lane during waves. */
  volatileOrbs?: boolean;
  /** Periodic ember rain AoE during waves (not on any built-in yet). */
  emberRain?: boolean;
  /** Free gold crates drop during waves. */
  supplyDrops?: boolean;
  /** Periodic chrono pulse: freeze creeps briefly, haste heroes. */
  chronoPulse?: boolean;
};

/** Full authored custom map (geometry + specials + effect zones). */
export type CustomMapDef = {
  id: string;
  name: string;
  blurb: string;
  /** Playable outline; omitted on legacy maps ⇒ rectangle. */
  shape?: MapShapeId;
  laneTop: number;
  laneBottom: number;
  laneLeft?: number;
  laneRight?: number;
  base: PointPad & { maxHp: number };
  /** Shop pads — 0 or more allowed. */
  shops: ShopPad[];
  /** Exactly one respawn pad for lane heroes. */
  respawn: PointPad;
  spawner: PointPad;
  spawnerAlt?: PointPad;
  highGrounds: HighGroundZone[];
  obstacles: Obstacle[];
  turretSlots: TurretSlot[];
  specials: CustomMapSpecials;
  healSprings?: RectZone[];
  slowMires?: RectZone[];
  hastePads?: RectZone[];
  goldVents?: RectZone[];
  windCurrents?: WindZone[];
  spikePulses?: SpikePoint[];
  bouncePads?: BouncePadZone[];
  mapPortals?: MapPortalPad[];
  relayBeacons?: RelayBeaconPad[];
};

export type CustomHeroDef = {
  id: string;
  name: string;
  blurb: string;
  color: string;
  glowColor: string;
  radius: number;
  speed: number;
  maxHp: number;
  attackRange: number;
  attackDamage: number;
  attackCooldown: number;
  projectileSpeed: number;
  attackStyle: AttackStyle;
  aimMode: AimMode;
  attackHint: string;
  passive: HeroPassive;
  abilities: [AbilityDef, AbilityDef];
};

export type CustomMapBundle = {
  format: typeof CUSTOM_MAP_FORMAT;
  map: CustomMapDef;
};

export type CustomHeroBundle = {
  format: typeof CUSTOM_HERO_FORMAT;
  hero: CustomHeroDef;
};

export function isCustomMapId(id: string): boolean {
  return id.startsWith(CUSTOM_MAP_PREFIX);
}

export function isCustomHeroId(id: string): boolean {
  return id.startsWith(CUSTOM_HERO_PREFIX);
}

export function newCustomMapId(): string {
  return `${CUSTOM_MAP_PREFIX}${cryptoRandom()}`;
}

export function newCustomHeroId(): string {
  return `${CUSTOM_HERO_PREFIX}${cryptoRandom()}`;
}

function cryptoRandom(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
