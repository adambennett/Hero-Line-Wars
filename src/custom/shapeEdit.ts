/**
 * Map-editor helpers for playable shape changes (confirm counts + apply).
 */

import type { CustomMapDef, RectZone } from "./types";
import {
  applyPlayBoundsToMap,
  defaultPlayBoundsForShape,
  pointInPlayable,
  resolveMapShape,
  shapeEssentialAnchors,
  type MapShapeId,
} from "../game/playBounds";

/** Count placeables that may be moved/removed when the shape changes. */
export function countShapeAffectedObjects(m: CustomMapDef): number {
  return (
    m.obstacles.length +
    m.highGrounds.length +
    m.turretSlots.length +
    (m.shops?.length ?? 0) +
    (m.healSprings?.length ?? 0) +
    (m.slowMires?.length ?? 0) +
    (m.hastePads?.length ?? 0) +
    (m.goldVents?.length ?? 0) +
    (m.windCurrents?.length ?? 0) +
    (m.spikePulses?.length ?? 0) +
    (m.bouncePads?.length ?? 0) +
    (m.mapPortals?.length ?? 0) +
    (m.relayBeacons?.length ?? 0) +
    (m.spawnerAlt ? 1 : 0)
  );
}

function rectFits(m: CustomMapDef, r: RectZone, min = 16): boolean {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  if (!pointInPlayable(m, cx, cy, 0)) return false;
  return r.w >= min && r.h >= min;
}

function filterRects(m: CustomMapDef, list: RectZone[] | undefined): RectZone[] {
  return (list ?? []).filter((r) => rectFits(m, r));
}

/**
 * Apply a new shape: reset playable AABB to the shape default, re-anchor
 * required pads, clamp safe objects, drop ones with no valid position.
 */
export function applyShapeChange(m: CustomMapDef, shape: MapShapeId): number {
  const before = countShapeAffectedObjects(m);
  m.shape = shape;
  applyPlayBoundsToMap(m, defaultPlayBoundsForShape(shape));
  const anchors = shapeEssentialAnchors(m);
  m.base.x = anchors.base.x;
  m.base.y = anchors.base.y;
  m.spawner.x = anchors.spawner.x;
  m.spawner.y = anchors.spawner.y;
  m.respawn.x = anchors.respawn.x;
  m.respawn.y = anchors.respawn.y;
  if (m.shops?.length) {
    m.shops[0]!.x = anchors.shop.x;
    m.shops[0]!.y = anchors.shop.y;
    m.shops = m.shops.filter((s, i) => i === 0 || pointInPlayable(m, s.x, s.y, s.radius || 28));
  }
  if (m.spawnerAlt) {
    if (!pointInPlayable(m, m.spawnerAlt.x, m.spawnerAlt.y, m.spawnerAlt.radius || 28)) {
      m.spawnerAlt = undefined;
      m.specials.dualSpawners = false;
    }
  }
  m.obstacles = filterRects(m, m.obstacles);
  m.highGrounds = filterRects(m, m.highGrounds) as CustomMapDef["highGrounds"];
  m.turretSlots = m.turretSlots.filter((t) => pointInPlayable(m, t.x, t.y, 8));
  m.healSprings = filterRects(m, m.healSprings);
  m.slowMires = filterRects(m, m.slowMires);
  m.hastePads = filterRects(m, m.hastePads);
  m.goldVents = filterRects(m, m.goldVents);
  m.windCurrents = filterRects(m, m.windCurrents) as CustomMapDef["windCurrents"];
  m.bouncePads = filterRects(m, m.bouncePads) as CustomMapDef["bouncePads"];
  m.spikePulses = (m.spikePulses ?? []).filter((s) =>
    pointInPlayable(m, s.x, s.y, s.radius || 12),
  );
  m.mapPortals = (m.mapPortals ?? []).filter(
    (p) =>
      pointInPlayable(m, p.x, p.y, p.radius || 12) &&
      pointInPlayable(m, p.exitX, p.exitY, 8),
  );
  m.relayBeacons = (m.relayBeacons ?? []).filter((p) =>
    pointInPlayable(m, p.x, p.y, p.radius || 12),
  );
  const after = countShapeAffectedObjects(m);
  return Math.max(0, before - after);
}

export function resetLaneBoundsToShapeDefault(m: CustomMapDef): void {
  const shape = resolveMapShape(m);
  applyPlayBoundsToMap(m, defaultPlayBoundsForShape(shape));
}
