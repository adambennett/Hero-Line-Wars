/** Lane layouts — same world size, different geometry. */

import { MAP_H, MAP_W } from "./constants";
import { isMapUnlocked } from "../meta/contentLocks";

export type MapId =
  | "classic"
  | "split_ridge"
  | "narrow_pass"
  | "open_flank"
  | "twin_gates"
  | "serpentine"
  | "fortress"
  | "crossfire"
  | "island_hop"
  | "shifting_grounds"
  | "broken_causeway"
  | "mirror_trench"
  | "bastion_run"
  | "crushing_corridor"
  | "eclipse_gauntlet"
  | "hex_warrens"
  | "ascendant_spine"
  | "treasure_vein"
  | "tourist_loop"
  | "rift_cataract"
  | "orb_foundry";

export type Rect = { x: number; y: number; w: number; h: number };

export type PointPad = {
  x: number;
  y: number;
  radius: number;
};

export type ShopPad = PointPad & { interactRange: number };

export type HighGroundZone = Rect & {
  damageBonus: number;
  oathDamageBonus: number;
};

export type Obstacle = Rect & {
  label?: string;
};

export type TurretSlot = {
  x: number;
  y: number;
};

export type EffectRect = Rect & { label?: string };
export type WindCurrentZone = EffectRect & { vx: number; vy: number };
export type SpikePulsePoint = { x: number; y: number; radius: number; damage?: number };

export type MapDef = {
  id: MapId | string;
  name: string;
  blurb: string;
  laneTop: number;
  laneBottom: number;
  /** Original authored lane bounds (for shrinking reset). */
  baseLaneTop?: number;
  baseLaneBottom?: number;
  base: PointPad & { maxHp: number };
  /** Shop pads (0 or more). Standing on any opens the shop. */
  shops: ShopPad[];
  /** Hero respawn pad — exactly one; all lane heroes respawn here. */
  respawn: PointPad;
  spawner: PointPad;
  /** Optional second spawner for dual-spawn maps. */
  spawnerAlt?: PointPad;
  highGrounds: HighGroundZone[];
  obstacles: Obstacle[];
  /** Preferred auto-turret placement points near the base. */
  turretSlots: TurretSlot[];
  /** Between waves, obstacles are reshuffled within the lane. */
  shiftingObstacles?: boolean;
  /** During waves, lane edges slowly close in. */
  shrinkingLane?: boolean;
  /** Moving damage hazard drifts mid-lane. */
  movingHazards?: boolean;
  /** Periodic fog that dims the lane. */
  eclipseFog?: boolean;
  /** Alternate between two spawn Y bands. */
  dualSpawners?: boolean;
  /** Boost chest spawn rolls. */
  chestMagnet?: boolean;
  /** Periodic pull toward lane mid-X during waves. */
  riftSurges?: boolean;
  /** Spawn delayed explosive orbs during waves. */
  volatileOrbs?: boolean;
  /** Standing heals heroes. */
  healSprings?: EffectRect[];
  /** Slows units inside. */
  slowMires?: EffectRect[];
  /** Brief move-speed buff pads. */
  hastePads?: EffectRect[];
  /** Gold/sec while standing. */
  goldVents?: EffectRect[];
  /** Push vector zones. */
  windCurrents?: WindCurrentZone[];
  /** Periodic point AoE damage. */
  spikePulses?: SpikePulsePoint[];
};

/** Scale Y coords authored against the old 560-tall map. */
const LEGACY_H = 560;
const sy = (y: number) => (y / LEGACY_H) * MAP_H;
const sh = (h: number) => (h / LEGACY_H) * MAP_H;

const HG = (x: number, y: number, w: number, h: number): HighGroundZone => ({
  x,
  y: sy(y),
  w,
  h: sh(h),
  damageBonus: 0.35,
  oathDamageBonus: 0.65,
});

const MID_Y = MAP_H / 2;

/** Authoring shape — `shop` is migrated to `shops`; `respawn` defaults near base. */
type MapAuthoring = Omit<MapDef, "shops" | "respawn"> & {
  shop?: ShopPad;
  shops?: ShopPad[];
  respawn?: PointPad;
};

function finalizeMap(m: MapAuthoring): MapDef {
  const shops = m.shops ?? (m.shop ? [m.shop] : []);
  const { shop: _legacyShop, ...rest } = m;
  return {
    ...rest,
    shops,
    respawn: m.respawn ?? { x: m.base.x + 120, y: m.base.y, radius: 28 },
  };
}

/** Runtime shop pads (empty when map has none). */
export function mapShops(map: MapDef): ShopPad[] {
  return map.shops ?? [];
}

/** Runtime respawn point (falls back near base if somehow missing). */
export function mapRespawn(map: MapDef): PointPad {
  return map.respawn ?? { x: map.base.x + 120, y: map.base.y, radius: 28 };
}

/** True when a unit is within interact range of any shop pad. */
export function nearAnyShop(
  map: MapDef,
  unit: { x: number; y: number },
  alive = true,
): boolean {
  if (!alive) return false;
  for (const shop of mapShops(map)) {
    const dx = unit.x - shop.x;
    const dy = unit.y - shop.y;
    if (dx * dx + dy * dy <= shop.interactRange * shop.interactRange) return true;
  }
  return false;
}

export const MAPS: Record<MapId, MapDef> = {
  classic: finalizeMap({
    id: "classic",
    name: "Classic Lane",
    blurb: "Wide mid-lane with a central high-ground shelf and flanking rocks.",
    laneTop: sy(90),
    laneBottom: MAP_H - sy(90),
    base: { x: 52, y: MID_Y, radius: 46, maxHp: 120 },
    shop: { x: 148, y: MID_Y + sy(100), radius: 38, interactRange: 58 },
    spawner: { x: MAP_W - 52, y: MID_Y, radius: 30 },
    highGrounds: [HG(560, 180, 280, 180)],
    obstacles: [
      { x: 340, y: sy(115), w: 48, h: sh(70), label: "rock" },
      { x: 340, y: sy(360), w: 48, h: sh(70), label: "rock" },
      { x: 980, y: sy(130), w: 42, h: sh(55) },
      { x: 980, y: sy(370), w: 42, h: sh(55) },
    ],
    turretSlots: [
      { x: 120, y: sy(190) },
      { x: 120, y: sy(370) },
      { x: 200, y: MID_Y },
      { x: 90, y: MID_Y },
    ],
  }),
  split_ridge: finalizeMap({
    id: "split_ridge",
    name: "Split Ridge",
    blurb: "Twin high grounds and a mid rock wall — fight for both shelves.",
    laneTop: sy(70),
    laneBottom: MAP_H - sy(70),
    base: { x: 56, y: MID_Y, radius: 44, maxHp: 120 },
    shop: { x: 140, y: MAP_H - sy(120), radius: 36, interactRange: 56 },
    spawner: { x: MAP_W - 52, y: MID_Y, radius: 30 },
    highGrounds: [HG(400, 95, 200, 130), HG(400, 320, 200, 130)],
    obstacles: [
      { x: 720, y: sy(210), w: 90, h: sh(130), label: "ridge" },
      { x: 1040, y: sy(110), w: 44, h: sh(60) },
      { x: 1040, y: sy(380), w: 44, h: sh(60) },
      { x: 250, y: MID_Y - sh(35), w: 36, h: sh(70) },
    ],
    turretSlots: [
      { x: 130, y: sy(160) },
      { x: 130, y: sy(400) },
      { x: 210, y: MID_Y },
      { x: 90, y: MID_Y },
    ],
  }),
  narrow_pass: finalizeMap({
    id: "narrow_pass",
    name: "Narrow Pass",
    blurb: "Tight corridor with cover pillars — less room to kite, more choke fights.",
    laneTop: sy(140),
    laneBottom: MAP_H - sy(140),
    base: { x: 58, y: MID_Y, radius: 42, maxHp: 130 },
    shop: { x: 160, y: sy(175), radius: 34, interactRange: 52 },
    spawner: { x: MAP_W - 52, y: MID_Y, radius: 28 },
    highGrounds: [HG(820, 185, 170, 160)],
    obstacles: [
      { x: 300, y: sy(160), w: 34, h: sh(85) },
      { x: 300, y: sy(300), w: 34, h: sh(85) },
      { x: 560, y: sy(200), w: 40, h: sh(130) },
      { x: 1100, y: sy(160), w: 34, h: sh(85) },
      { x: 1100, y: sy(300), w: 34, h: sh(85) },
      { x: 1320, y: MID_Y - sh(40), w: 36, h: sh(80) },
    ],
    turretSlots: [
      { x: 115, y: sy(210) },
      { x: 115, y: sy(340) },
      { x: 190, y: MID_Y },
    ],
  }),
  open_flank: finalizeMap({
    id: "open_flank",
    name: "Open Flank",
    blurb: "Extra-wide lane with side alcoves — more space, more angles.",
    laneTop: sy(50),
    laneBottom: MAP_H - sy(50),
    base: { x: 62, y: MID_Y, radius: 48, maxHp: 115 },
    shop: { x: 170, y: sy(110), radius: 38, interactRange: 58 },
    spawner: { x: MAP_W - 56, y: MID_Y, radius: 32 },
    highGrounds: [HG(620, 65, 220, 110), HG(900, 370, 220, 110)],
    obstacles: [
      { x: 360, y: sy(65), w: 60, h: sh(48) },
      { x: 360, y: MAP_H - sy(115), w: 60, h: sh(48) },
      { x: 1180, y: MID_Y - sh(40), w: 70, h: sh(80), label: "ruin" },
      { x: 740, y: MID_Y - sh(30), w: 40, h: sh(60) },
    ],
    turretSlots: [
      { x: 140, y: sy(200) },
      { x: 140, y: sy(360) },
      { x: 220, y: MID_Y },
      { x: 95, y: MID_Y },
      { x: 200, y: sy(160) },
    ],
  }),
  twin_gates: finalizeMap({
    id: "twin_gates",
    name: "Twin Gates",
    blurb: "Paired gatehouses split the lane into upper and lower approaches.",
    laneTop: sy(80),
    laneBottom: MAP_H - sy(80),
    base: { x: 54, y: MID_Y, radius: 45, maxHp: 125 },
    shop: { x: 155, y: sy(130), radius: 36, interactRange: 56 },
    spawner: { x: MAP_W - 54, y: MID_Y, radius: 30 },
    highGrounds: [HG(480, 100, 160, 120), HG(480, 320, 160, 120)],
    obstacles: [
      { x: 380, y: MID_Y - sh(55), w: 50, h: sh(110), label: "gate" },
      { x: 700, y: sy(100), w: 44, h: sh(70) },
      { x: 700, y: sy(380), w: 44, h: sh(70) },
      { x: 1050, y: MID_Y - sh(50), w: 55, h: sh(100), label: "gate" },
      { x: 1280, y: sy(120), w: 40, h: sh(55) },
      { x: 1280, y: sy(370), w: 40, h: sh(55) },
    ],
    turretSlots: [
      { x: 125, y: sy(175) },
      { x: 125, y: sy(385) },
      { x: 205, y: MID_Y },
      { x: 95, y: MID_Y },
    ],
  }),
  serpentine: finalizeMap({
    id: "serpentine",
    name: "Serpentine",
    blurb: "Staggered cover forces a zigzag path down the line.",
    laneTop: sy(95),
    laneBottom: MAP_H - sy(95),
    base: { x: 55, y: MID_Y, radius: 44, maxHp: 120 },
    shop: { x: 150, y: MAP_H - sy(130), radius: 36, interactRange: 55 },
    spawner: { x: MAP_W - 52, y: MID_Y, radius: 30 },
    highGrounds: [HG(900, 200, 200, 140)],
    obstacles: [
      { x: 280, y: sy(110), w: 70, h: sh(55) },
      { x: 420, y: sy(340), w: 70, h: sh(55) },
      { x: 580, y: sy(140), w: 55, h: sh(80) },
      { x: 760, y: sy(320), w: 55, h: sh(80) },
      { x: 1120, y: sy(120), w: 48, h: sh(60) },
      { x: 1120, y: sy(360), w: 48, h: sh(60) },
      { x: 1350, y: MID_Y - sh(35), w: 42, h: sh(70) },
    ],
    turretSlots: [
      { x: 118, y: sy(200) },
      { x: 118, y: sy(360) },
      { x: 200, y: MID_Y },
    ],
  }),
  fortress: finalizeMap({
    id: "fortress",
    name: "Fortress Approach",
    blurb: "Heavy cover near base — hold the walls, then push into open ground.",
    laneTop: sy(75),
    laneBottom: MAP_H - sy(75),
    base: { x: 58, y: MID_Y, radius: 48, maxHp: 140 },
    shop: { x: 165, y: MID_Y + sy(95), radius: 38, interactRange: 58 },
    spawner: { x: MAP_W - 50, y: MID_Y, radius: 30 },
    highGrounds: [HG(220, 160, 180, 220)],
    obstacles: [
      { x: 240, y: sy(100), w: 36, h: sh(90), label: "wall" },
      { x: 240, y: sy(350), w: 36, h: sh(90), label: "wall" },
      { x: 340, y: MID_Y - sh(40), w: 50, h: sh(80) },
      { x: 860, y: sy(150), w: 60, h: sh(50) },
      { x: 860, y: sy(360), w: 60, h: sh(50) },
      { x: 1200, y: MID_Y - sh(45), w: 80, h: sh(90), label: "barricade" },
    ],
    turretSlots: [
      { x: 130, y: sy(170) },
      { x: 130, y: sy(390) },
      { x: 210, y: MID_Y },
      { x: 100, y: MID_Y },
      { x: 185, y: sy(220) },
    ],
  }),
  crossfire: finalizeMap({
    id: "crossfire",
    name: "Crossfire",
    blurb: "Side high grounds overlook a cluttered mid — angles everywhere.",
    laneTop: sy(60),
    laneBottom: MAP_H - sy(60),
    base: { x: 56, y: MID_Y, radius: 44, maxHp: 118 },
    shop: { x: 145, y: sy(100), radius: 36, interactRange: 55 },
    spawner: { x: MAP_W - 52, y: MID_Y, radius: 30 },
    highGrounds: [HG(350, 70, 180, 100), HG(350, 380, 180, 100), HG(1000, 200, 160, 140)],
    obstacles: [
      { x: 520, y: MID_Y - sh(70), w: 38, h: sh(140) },
      { x: 680, y: sy(130), w: 50, h: sh(50) },
      { x: 680, y: sy(370), w: 50, h: sh(50) },
      { x: 850, y: MID_Y - sh(30), w: 44, h: sh(60) },
      { x: 1220, y: sy(140), w: 40, h: sh(70) },
      { x: 1220, y: sy(340), w: 40, h: sh(70) },
    ],
    turretSlots: [
      { x: 120, y: sy(185) },
      { x: 120, y: sy(375) },
      { x: 200, y: MID_Y },
      { x: 95, y: MID_Y },
    ],
  }),
  island_hop: finalizeMap({
    id: "island_hop",
    name: "Island Hop",
    blurb: "Scattered cover islands — lots of open ground between safe pockets.",
    laneTop: sy(85),
    laneBottom: MAP_H - sy(85),
    base: { x: 54, y: MID_Y, radius: 45, maxHp: 122 },
    shop: { x: 152, y: MID_Y - sy(100), radius: 36, interactRange: 56 },
    spawner: { x: MAP_W - 54, y: MID_Y, radius: 30 },
    highGrounds: [HG(450, 220, 140, 120), HG(950, 180, 140, 140)],
    obstacles: [
      { x: 300, y: MID_Y - sh(28), w: 55, h: sh(56), label: "isle" },
      { x: 520, y: sy(120), w: 48, h: sh(48), label: "isle" },
      { x: 520, y: sy(380), w: 48, h: sh(48), label: "isle" },
      { x: 750, y: MID_Y - sh(32), w: 60, h: sh(64), label: "isle" },
      { x: 1100, y: sy(140), w: 50, h: sh(50), label: "isle" },
      { x: 1100, y: sy(360), w: 50, h: sh(50), label: "isle" },
      { x: 1320, y: MID_Y - sh(30), w: 48, h: sh(60), label: "isle" },
    ],
    turretSlots: [
      { x: 125, y: sy(195) },
      { x: 125, y: sy(365) },
      { x: 205, y: MID_Y },
    ],
  }),
  shifting_grounds: finalizeMap({
    id: "shifting_grounds",
    name: "Shifting Grounds",
    blurb: "Special — cover and rubble reposition randomly between every wave.",
    laneTop: sy(90),
    laneBottom: MAP_H - sy(90),
    base: { x: 55, y: MID_Y, radius: 45, maxHp: 120 },
    shop: { x: 150, y: MID_Y + sy(95), radius: 36, interactRange: 56 },
    spawner: { x: MAP_W - 52, y: MID_Y, radius: 30 },
    highGrounds: [HG(700, 200, 220, 160)],
    obstacles: [
      { x: 320, y: sy(130), w: 46, h: sh(60), label: "rubble" },
      { x: 320, y: sy(350), w: 46, h: sh(60), label: "rubble" },
      { x: 560, y: MID_Y - sh(40), w: 50, h: sh(80), label: "rubble" },
      { x: 900, y: sy(140), w: 42, h: sh(55), label: "rubble" },
      { x: 900, y: sy(360), w: 42, h: sh(55), label: "rubble" },
      { x: 1180, y: MID_Y - sh(35), w: 55, h: sh(70), label: "rubble" },
    ],
    turretSlots: [
      { x: 120, y: sy(190) },
      { x: 120, y: sy(370) },
      { x: 200, y: MID_Y },
      { x: 95, y: MID_Y },
    ],
    shiftingObstacles: true,
  }),
  broken_causeway: finalizeMap({
    id: "broken_causeway",
    name: "Broken Causeway",
    blurb: "Collapsed bridge spans — fight across staggered gaps of cover.",
    laneTop: sy(100),
    laneBottom: MAP_H - sy(100),
    base: { x: 54, y: MID_Y, radius: 45, maxHp: 120 },
    shop: { x: 148, y: MID_Y - sy(90), radius: 36, interactRange: 55 },
    spawner: { x: MAP_W - 52, y: MID_Y, radius: 30 },
    highGrounds: [HG(600, 160, 160, 100), HG(1000, 280, 160, 100)],
    obstacles: [
      { x: 300, y: sy(130), w: 90, h: sh(40), label: "span" },
      { x: 300, y: sy(380), w: 90, h: sh(40), label: "span" },
      { x: 520, y: MID_Y - sh(50), w: 36, h: sh(100) },
      { x: 780, y: sy(120), w: 50, h: sh(50) },
      { x: 780, y: sy(370), w: 50, h: sh(50) },
      { x: 1150, y: MID_Y - sh(40), w: 70, h: sh(80), label: "ruin" },
      { x: 1350, y: sy(150), w: 40, h: sh(55) },
      { x: 1350, y: sy(340), w: 40, h: sh(55) },
    ],
    turretSlots: [
      { x: 120, y: sy(200) },
      { x: 120, y: sy(360) },
      { x: 200, y: MID_Y },
      { x: 95, y: MID_Y },
    ],
  }),
  mirror_trench: finalizeMap({
    id: "mirror_trench",
    name: "Mirror Trench",
    blurb: "Symmetric trenches — twin high grounds and a razor mid channel.",
    laneTop: sy(80),
    laneBottom: MAP_H - sy(80),
    base: { x: 56, y: MID_Y, radius: 44, maxHp: 122 },
    shop: { x: 155, y: MID_Y + sy(100), radius: 36, interactRange: 56 },
    spawner: { x: MAP_W - 54, y: MID_Y, radius: 30 },
    highGrounds: [HG(420, 90, 180, 110), HG(420, 340, 180, 110)],
    obstacles: [
      { x: 340, y: MID_Y - sh(20), w: 200, h: sh(40), label: "trench" },
      { x: 700, y: sy(110), w: 40, h: sh(70) },
      { x: 700, y: sy(360), w: 40, h: sh(70) },
      { x: 980, y: MID_Y - sh(55), w: 44, h: sh(110) },
      { x: 1250, y: sy(130), w: 48, h: sh(50) },
      { x: 1250, y: sy(360), w: 48, h: sh(50) },
    ],
    turretSlots: [
      { x: 125, y: sy(180) },
      { x: 125, y: sy(380) },
      { x: 205, y: MID_Y },
    ],
  }),
  bastion_run: finalizeMap({
    id: "bastion_run",
    name: "Bastion Run",
    blurb: "Stacked fortifications near base, then a long open push.",
    laneTop: sy(70),
    laneBottom: MAP_H - sy(70),
    base: { x: 58, y: MID_Y, radius: 48, maxHp: 135 },
    shop: { x: 168, y: sy(120), radius: 38, interactRange: 58 },
    spawner: { x: MAP_W - 50, y: MID_Y, radius: 30 },
    highGrounds: [HG(180, 150, 200, 240)],
    obstacles: [
      { x: 220, y: sy(95), w: 40, h: sh(100), label: "bastion" },
      { x: 220, y: sy(340), w: 40, h: sh(100), label: "bastion" },
      { x: 320, y: MID_Y - sh(45), w: 55, h: sh(90) },
      { x: 480, y: sy(130), w: 36, h: sh(60) },
      { x: 480, y: sy(350), w: 36, h: sh(60) },
      { x: 900, y: MID_Y - sh(30), w: 50, h: sh(60) },
      { x: 1200, y: sy(160), w: 44, h: sh(50) },
      { x: 1200, y: sy(360), w: 44, h: sh(50) },
    ],
    turretSlots: [
      { x: 130, y: sy(170) },
      { x: 130, y: sy(390) },
      { x: 210, y: MID_Y },
      { x: 100, y: MID_Y },
      { x: 185, y: sy(230) },
    ],
  }),
  crushing_corridor: finalizeMap({
    id: "crushing_corridor",
    name: "Crushing Corridor",
    blurb: "Special — the lane slowly squeezes shut during each wave.",
    laneTop: sy(60),
    laneBottom: MAP_H - sy(60),
    baseLaneTop: sy(60),
    baseLaneBottom: MAP_H - sy(60),
    base: { x: 55, y: MID_Y, radius: 45, maxHp: 125 },
    shop: { x: 150, y: MID_Y + sy(90), radius: 36, interactRange: 55 },
    spawner: { x: MAP_W - 52, y: MID_Y, radius: 30 },
    highGrounds: [HG(750, 200, 200, 140)],
    obstacles: [
      { x: 380, y: sy(100), w: 40, h: sh(70) },
      { x: 380, y: sy(370), w: 40, h: sh(70) },
      { x: 700, y: MID_Y - sh(35), w: 50, h: sh(70) },
      { x: 1100, y: sy(130), w: 42, h: sh(55) },
      { x: 1100, y: sy(360), w: 42, h: sh(55) },
    ],
    turretSlots: [
      { x: 120, y: sy(190) },
      { x: 120, y: sy(370) },
      { x: 200, y: MID_Y },
    ],
    shrinkingLane: true,
  }),
  eclipse_gauntlet: finalizeMap({
    id: "eclipse_gauntlet",
    name: "Eclipse Gauntlet",
    blurb: "Special — drifting hazards and timed darkness choke the mid.",
    laneTop: sy(85),
    laneBottom: MAP_H - sy(85),
    base: { x: 54, y: MID_Y, radius: 45, maxHp: 118 },
    shop: { x: 148, y: MID_Y - sy(95), radius: 36, interactRange: 55 },
    spawner: { x: MAP_W - 52, y: MID_Y - sy(40), radius: 28 },
    spawnerAlt: { x: MAP_W - 52, y: MID_Y + sy(40), radius: 28 },
    highGrounds: [HG(500, 180, 180, 160)],
    obstacles: [
      { x: 320, y: sy(140), w: 44, h: sh(55) },
      { x: 320, y: sy(360), w: 44, h: sh(55) },
      { x: 620, y: MID_Y - sh(40), w: 48, h: sh(80) },
      { x: 950, y: sy(150), w: 40, h: sh(50) },
      { x: 950, y: sy(360), w: 40, h: sh(50) },
      { x: 1280, y: MID_Y - sh(35), w: 50, h: sh(70) },
    ],
    turretSlots: [
      { x: 120, y: sy(195) },
      { x: 120, y: sy(365) },
      { x: 200, y: MID_Y },
      { x: 95, y: MID_Y },
    ],
    movingHazards: true,
    eclipseFog: true,
    dualSpawners: true,
  }),
  hex_warrens: finalizeMap({
    id: "hex_warrens",
    name: "Hex Warrens",
    blurb: "Challenge map — twisted cover and a tight killbox mid.",
    laneTop: sy(100),
    laneBottom: MAP_H - sy(100),
    base: { x: 50, y: MID_Y, radius: 44, maxHp: 110 },
    shop: { x: 140, y: MID_Y + sy(90), radius: 34, interactRange: 52 },
    spawner: { x: MAP_W - 50, y: MID_Y, radius: 26 },
    highGrounds: [HG(420, 200, 140, 120), HG(900, 170, 120, 180)],
    obstacles: [
      { x: 300, y: sy(120), w: 36, h: sh(90) },
      { x: 300, y: sy(340), w: 36, h: sh(90) },
      { x: 560, y: MID_Y - sh(50), w: 70, h: sh(100) },
      { x: 820, y: sy(140), w: 40, h: sh(60) },
      { x: 820, y: sy(350), w: 40, h: sh(60) },
      { x: 1150, y: MID_Y - sh(40), w: 48, h: sh(80) },
    ],
    turretSlots: [
      { x: 110, y: sy(200) },
      { x: 110, y: sy(360) },
      { x: 190, y: MID_Y },
    ],
  }),
  ascendant_spine: finalizeMap({
    id: "ascendant_spine",
    name: "Ascendant Spine",
    blurb: "Challenge map — long spine high-grounds and sparse cover.",
    laneTop: sy(80),
    laneBottom: MAP_H - sy(80),
    base: { x: 55, y: MID_Y, radius: 46, maxHp: 125 },
    shop: { x: 155, y: MID_Y - sy(100), radius: 36, interactRange: 55 },
    spawner: { x: MAP_W - 55, y: MID_Y, radius: 28 },
    highGrounds: [HG(280, 160, 900, 200)],
    obstacles: [
      { x: 400, y: sy(100), w: 30, h: sh(50) },
      { x: 400, y: sy(400), w: 30, h: sh(50) },
      { x: 750, y: sy(110), w: 30, h: sh(50) },
      { x: 750, y: sy(390), w: 30, h: sh(50) },
      { x: 1100, y: MID_Y - sh(30), w: 40, h: sh(60) },
    ],
    turretSlots: [
      { x: 115, y: sy(190) },
      { x: 115, y: sy(370) },
      { x: 200, y: MID_Y },
      { x: 95, y: MID_Y },
    ],
  }),
  treasure_vein: finalizeMap({
    id: "treasure_vein",
    name: "Treasure Vein",
    blurb: "Challenge map — open flanks favor chest hunting and skirmishes.",
    laneTop: sy(70),
    laneBottom: MAP_H - sy(70),
    base: { x: 52, y: MID_Y, radius: 45, maxHp: 115 },
    shop: { x: 150, y: MID_Y + sy(110), radius: 38, interactRange: 58 },
    spawner: { x: MAP_W - 52, y: MID_Y, radius: 28 },
    highGrounds: [HG(600, 140, 160, 240)],
    obstacles: [
      { x: 350, y: MID_Y - sh(25), w: 50, h: sh(50) },
      { x: 700, y: sy(120), w: 40, h: sh(40) },
      { x: 700, y: sy(400), w: 40, h: sh(40) },
      { x: 1050, y: MID_Y - sh(35), w: 55, h: sh(70) },
    ],
    turretSlots: [
      { x: 120, y: sy(185) },
      { x: 120, y: sy(375) },
      { x: 205, y: MID_Y },
    ],
  }),
  tourist_loop: finalizeMap({
    id: "tourist_loop",
    name: "Tourist Loop",
    blurb: "Challenge map — shifting rocks and dual spawners for veterans.",
    laneTop: sy(95),
    laneBottom: MAP_H - sy(95),
    base: { x: 54, y: MID_Y, radius: 45, maxHp: 120 },
    shop: { x: 148, y: MID_Y - sy(90), radius: 36, interactRange: 55 },
    spawner: { x: MAP_W - 52, y: MID_Y - sy(50), radius: 26 },
    spawnerAlt: { x: MAP_W - 52, y: MID_Y + sy(50), radius: 26 },
    highGrounds: [HG(480, 190, 200, 140)],
    obstacles: [
      { x: 320, y: sy(150), w: 42, h: sh(55) },
      { x: 320, y: sy(350), w: 42, h: sh(55) },
      { x: 640, y: MID_Y - sh(45), w: 50, h: sh(90) },
      { x: 980, y: sy(160), w: 38, h: sh(50) },
      { x: 980, y: sy(350), w: 38, h: sh(50) },
    ],
    turretSlots: [
      { x: 118, y: sy(195) },
      { x: 118, y: sy(365) },
      { x: 198, y: MID_Y },
    ],
    shiftingObstacles: true,
    dualSpawners: true,
  }),
  rift_cataract: finalizeMap({
    id: "rift_cataract",
    name: "Rift Cataract",
    blurb: "Special — horizontal rifts yank everything toward mid-lane midpoints.",
    laneTop: sy(90),
    laneBottom: MAP_H - sy(90),
    base: { x: 54, y: MID_Y, radius: 45, maxHp: 118 },
    shop: { x: 150, y: MID_Y + sy(95), radius: 36, interactRange: 55 },
    spawner: { x: MAP_W - 52, y: MID_Y, radius: 28 },
    highGrounds: [HG(520, 170, 200, 180)],
    obstacles: [
      { x: 300, y: sy(130), w: 40, h: sh(60) },
      { x: 300, y: sy(360), w: 40, h: sh(60) },
      { x: 680, y: MID_Y - sh(40), w: 55, h: sh(80) },
      { x: 1050, y: sy(140), w: 42, h: sh(55) },
      { x: 1050, y: sy(360), w: 42, h: sh(55) },
    ],
    turretSlots: [
      { x: 118, y: sy(190) },
      { x: 118, y: sy(370) },
      { x: 200, y: MID_Y },
    ],
    riftSurges: true,
  }),
  orb_foundry: finalizeMap({
    id: "orb_foundry",
    name: "Orb Foundry",
    blurb: "Special — volatile orbs cook mid-lane and detonate after a delay.",
    laneTop: sy(85),
    laneBottom: MAP_H - sy(85),
    base: { x: 52, y: MID_Y, radius: 46, maxHp: 120 },
    shop: { x: 145, y: MID_Y - sy(100), radius: 36, interactRange: 55 },
    spawner: { x: MAP_W - 52, y: MID_Y, radius: 28 },
    highGrounds: [HG(400, 190, 160, 140), HG(900, 190, 160, 140)],
    obstacles: [
      { x: 340, y: sy(145), w: 44, h: sh(50) },
      { x: 340, y: sy(360), w: 44, h: sh(50) },
      { x: 720, y: MID_Y - sh(35), w: 48, h: sh(70) },
      { x: 1180, y: sy(160), w: 40, h: sh(55) },
      { x: 1180, y: sy(350), w: 40, h: sh(55) },
    ],
    turretSlots: [
      { x: 120, y: sy(195) },
      { x: 120, y: sy(365) },
      { x: 205, y: MID_Y },
      { x: 95, y: MID_Y },
    ],
    volatileOrbs: true,
  }),
};

export const MAP_LIST: MapDef[] = Object.values(MAPS);

export function getMap(id: MapId | string): MapDef {
  const builtin = MAPS[id as MapId];
  if (builtin) return builtin;
  // Custom maps are resolved via custom/registry.resolveMap — fallback classic.
  return MAPS.classic;
}

export function pickRandomMap(): MapId {
  const list = MAP_LIST.filter((m) => isMapUnlocked(m.id as MapId));
  const pool = list.length ? list : MAP_LIST;
  return pool[Math.floor(Math.random() * pool.length)]!.id as MapId;
}

export function resolveMapChoice(choice: MapId | string | "random"): MapId | string {
  return choice === "random" ? pickRandomMap() : choice;
}

/** Axis-aligned obstacle hit test (circle vs rect). */
export function circleHitsObstacle(
  x: number,
  y: number,
  radius: number,
  obs: Obstacle,
): boolean {
  const nearestX = Math.max(obs.x, Math.min(x, obs.x + obs.w));
  const nearestY = Math.max(obs.y, Math.min(y, obs.y + obs.h));
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

export function pointBlocked(map: MapDef, x: number, y: number, radius: number): boolean {
  if (x < radius || x > MAP_W - radius) return true;
  if (y < map.laneTop + radius || y > map.laneBottom - radius) return true;
  return map.obstacles.some((o) => circleHitsObstacle(x, y, radius, o));
}

/** True if a circle overlaps any map obstacle. */
export function blockedByObstacle(
  map: MapDef,
  x: number,
  y: number,
  radius: number,
): boolean {
  return map.obstacles.some((o) => circleHitsObstacle(x, y, radius, o));
}

/**
 * Segment vs AABB — returns distance t in [0,1] to first hit, or null if clear.
 * Uses a small radius for thick rays (projectiles / beams).
 */
export function rayObstacleHitT(
  map: MapDef,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radius = 2,
): number | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  // Sample along the ray; dense enough for game-scale obstacles
  const steps = Math.max(4, Math.ceil(len / 6));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + dx * t;
    const y = y1 + dy * t;
    if (map.obstacles.some((o) => circleHitsObstacle(x, y, radius, o))) return t;
  }
  return null;
}

/** Clear line of sight between two points (not blocked by obstacles). */
export function hasLineOfSight(
  map: MapDef,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radius = 2,
): boolean {
  return rayObstacleHitT(map, x1, y1, x2, y2, radius) == null;
}

/** First obstacle intersecting the thick segment, or null if clear. */
export function firstBlockingObstacle(
  map: MapDef,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radius: number,
): Obstacle | null {
  const t = rayObstacleHitT(map, x1, y1, x2, y2, radius);
  if (t == null) return null;
  const x = x1 + (x2 - x1) * t;
  const y = y1 + (y2 - y1) * t;
  for (const o of map.obstacles) {
    if (circleHitsObstacle(x, y, radius, o)) return o;
  }
  return null;
}

/** Reposition obstacles randomly within the lane (for shifting maps). */
export function reshuffleObstacles(
  map: MapDef,
  reserved: { x: number; y: number; radius: number }[] = [],
): void {
  if (!map.shiftingObstacles || map.obstacles.length === 0) return;
  const pad = 24;
  const minX = map.base.x + map.base.radius + 80;
  const maxX = map.spawner.x - map.spawner.radius - 80;
  const minY = map.laneTop + pad;
  const maxY = map.laneBottom - pad;

  const hitsReserved = (o: Obstacle): boolean =>
    reserved.some((r) => circleHitsObstacle(r.x, r.y, r.radius + 6, o));

  for (const o of map.obstacles) {
    const spanX = Math.max(10, maxX - minX - o.w);
    const spanY = Math.max(10, maxY - minY - o.h);
    let placed = false;
    for (let attempt = 0; attempt < 24; attempt++) {
      o.x = minX + Math.random() * spanX;
      o.y = minY + Math.random() * spanY;
      // Keep clear of shop pads
      if (mapShops(map).some((shop) => circleHitsObstacle(shop.x, shop.y, shop.radius + 10, o))) continue;
      if (hitsReserved(o)) continue;
      placed = true;
      break;
    }
    if (!placed) {
      o.x = minX + Math.random() * spanX;
      o.y = minY + Math.random() * spanY;
    }
  }

  // Light de-overlap pass
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < map.obstacles.length; i++) {
      const a = map.obstacles[i]!;
      for (let j = i + 1; j < map.obstacles.length; j++) {
        const b = map.obstacles[j]!;
        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (overlapX > 0 && overlapY > 0) {
          for (let attempt = 0; attempt < 12; attempt++) {
            b.x = minX + Math.random() * Math.max(10, maxX - minX - b.w);
            b.y = minY + Math.random() * Math.max(10, maxY - minY - b.h);
            if (!hitsReserved(b)) break;
          }
        }
      }
    }
  }
}

/** Push a circle out of obstacles / lane bounds to the nearest clear spot. */
export function findClearSpot(
  map: MapDef,
  x: number,
  y: number,
  radius: number,
): { x: number; y: number } {
  if (!pointBlocked(map, x, y, radius)) return { x, y };

  // Prefer ejecting to the nearest rect edge of any overlapping obstacle
  for (const o of map.obstacles) {
    if (!circleHitsObstacle(x, y, radius, o)) continue;
    const candidates = [
      { x: o.x - radius - 2, y },
      { x: o.x + o.w + radius + 2, y },
      { x, y: o.y - radius - 2 },
      { x, y: o.y + o.h + radius + 2 },
    ];
    candidates.sort(
      (a, b) => (a.x - x) ** 2 + (a.y - y) ** 2 - ((b.x - x) ** 2 + (b.y - y) ** 2),
    );
    for (const c of candidates) {
      if (!pointBlocked(map, c.x, c.y, radius)) return c;
    }
  }

  // Spiral search outward
  for (let r = 12; r <= 220; r += 10) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) {
      const nx = x + Math.cos(a) * r;
      const ny = y + Math.sin(a) * r;
      if (!pointBlocked(map, nx, ny, radius)) return { x: nx, y: ny };
    }
  }

  // Last resort: near base
  return {
    x: Math.min(MAP_W - radius, map.base.x + map.base.radius + 80),
    y: map.base.y,
  };
}
