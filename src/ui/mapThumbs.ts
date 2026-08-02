/**
 * Shape-aware map thumbnails, shared by the Compendium map cards and the
 * SP/MP map-picker previews. Draws the map's actual playable outline
 * (hexagon, oval, diamond, …) from playBounds instead of assuming a
 * rectangle, and clips terrain to that outline.
 */

import { MAP_H, MAP_W } from "../data/constants";
import { mapRespawn, mapShops, type MapDef } from "../data/maps";
import { strokePlayablePath } from "../game/playBounds";
import { resolveMap } from "../custom/registry";

const COLORS = {
  space: "#0a0f1a",
  playable: "#152038",
  highGround: "#3d5a8866",
  obstacle: "#1c2838",
  outline: "#2c4a6c",
  base: "#2f6fd0",
  spawner: "#5a2430",
  shop: "#2a4a38",
  respawn: "#5ef0c8",
} as const;

/** Paint one map into a canvas at the given pixel size. */
export function paintMapThumb(
  canvas: HTMLCanvasElement,
  map: MapDef,
  w = 280,
  h = 72,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = w;
  canvas.height = h;
  const sx = w / MAP_W;
  const sy = h / MAP_H;

  ctx.fillStyle = COLORS.space;
  ctx.fillRect(0, 0, w, h);

  // Playable shape fill + clip for terrain, all in world coords under scale.
  // The path is captured in device space, so we can restore the transform and
  // still stroke a crisp 1px outline afterwards.
  ctx.save();
  ctx.scale(sx, sy);
  strokePlayablePath(ctx, map);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = COLORS.playable;
  ctx.fill();
  ctx.clip();
  ctx.scale(sx, sy);
  ctx.fillStyle = COLORS.highGround;
  for (const hg of map.highGrounds ?? []) ctx.fillRect(hg.x, hg.y, hg.w, hg.h);
  ctx.fillStyle = COLORS.obstacle;
  for (const o of map.obstacles ?? []) ctx.fillRect(o.x, o.y, o.w, o.h);
  ctx.restore();

  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = 1;
  ctx.stroke();

  const dot = (x: number, y: number, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x * sx, y * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  dot(map.base.x, map.base.y, 5, COLORS.base);
  dot(map.spawner.x, map.spawner.y, 5, COLORS.spawner);
  if (map.spawnerAlt) dot(map.spawnerAlt.x, map.spawnerAlt.y, 4, COLORS.spawner);
  for (const shop of mapShops(map)) dot(shop.x, shop.y, 4, COLORS.shop);
  const rp = mapRespawn(map);
  dot(rp.x, rp.y, 3, COLORS.respawn);
}

/**
 * Paint every `canvas[data-map]` under `root` — works for built-in and
 * custom map ids (resolveMap normalizes both to a MapDef).
 */
export function paintMapThumbCanvases(root: ParentNode): void {
  root.querySelectorAll<HTMLCanvasElement>("canvas[data-map]").forEach((canvas) => {
    const id = canvas.dataset.map;
    if (!id) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(120, Math.round(rect.width) || 280);
    const h = Math.max(40, Math.round(rect.height) || 72);
    paintMapThumb(canvas, resolveMap(id), w, h);
  });
}
