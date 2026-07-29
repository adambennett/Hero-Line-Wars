/** Lane layouts — same world size, different geometry. */

import { MAP_H, MAP_W } from "./constants";

export type MapId = "classic" | "split_ridge" | "narrow_pass" | "open_flank";

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

export type MapDef = {
  id: MapId;
  name: string;
  blurb: string;
  laneTop: number;
  laneBottom: number;
  base: PointPad & { maxHp: number };
  shop: ShopPad;
  spawner: PointPad;
  highGrounds: HighGroundZone[];
  obstacles: Obstacle[];
  /** Preferred auto-turret placement points near the base. */
  turretSlots: TurretSlot[];
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

export const MAPS: Record<MapId, MapDef> = {
  classic: {
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
  },
  split_ridge: {
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
  },
  narrow_pass: {
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
  },
  open_flank: {
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
  },
};

export const MAP_LIST: MapDef[] = Object.values(MAPS);

export function getMap(id: MapId): MapDef {
  return MAPS[id];
}

export function pickRandomMap(): MapId {
  const list = MAP_LIST;
  return list[Math.floor(Math.random() * list.length)]!.id;
}

export function resolveMapChoice(choice: MapId | "random"): MapId {
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
