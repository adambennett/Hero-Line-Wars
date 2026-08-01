/**
 * Playable lane shapes — AABB + inscribed geometry for collision / render / editor.
 * Missing `shape` (legacy maps) ⇒ rectangle spanning full width between laneTop/Bottom.
 */

import { MAP_H, MAP_W } from "../data/constants";

export const MAP_SHAPES = [
  "rectangle",
  "circle",
  "triangle",
  "square",
  "pentagon",
  "hexagon",
  "octagon",
  "diamond",
  "oval",
  "trapezoid",
] as const;

export type MapShapeId = (typeof MAP_SHAPES)[number];

export type PlayBoundsRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type PlayBoundSource = {
  shape?: string | null;
  laneTop: number;
  laneBottom: number;
  /** Optional X extents; default 0 … MAP_W for rectangles. */
  laneLeft?: number;
  laneRight?: number;
};

export function isMapShapeId(v: unknown): v is MapShapeId {
  return typeof v === "string" && (MAP_SHAPES as readonly string[]).includes(v);
}

export function resolveMapShape(map: PlayBoundSource): MapShapeId {
  return isMapShapeId(map.shape) ? map.shape : "rectangle";
}

/** Axis-aligned bounding box of the playable shape. */
export function playBounds(map: PlayBoundSource): PlayBoundsRect {
  const shape = resolveMapShape(map);
  let left = typeof map.laneLeft === "number" && Number.isFinite(map.laneLeft) ? map.laneLeft : 0;
  let right =
    typeof map.laneRight === "number" && Number.isFinite(map.laneRight) ? map.laneRight : MAP_W;
  let top = map.laneTop;
  let bottom = map.laneBottom;
  if (right < left) {
    const t = left;
    left = right;
    right = t;
  }
  if (bottom < top) {
    const t = top;
    top = bottom;
    bottom = t;
  }
  if (shape === "square" || shape === "circle") {
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    const side = Math.min(right - left, bottom - top);
    const half = side / 2;
    return { left: cx - half, top: cy - half, right: cx + half, bottom: cy + half };
  }
  return { left, top, right, bottom };
}

export function playBoundsSize(b: PlayBoundsRect): { w: number; h: number; cx: number; cy: number } {
  return {
    w: Math.max(1, b.right - b.left),
    h: Math.max(1, b.bottom - b.top),
    cx: (b.left + b.right) / 2,
    cy: (b.top + b.bottom) / 2,
  };
}

/** Default “max area” playable AABB for a shape (editor reset). */
export function defaultPlayBoundsForShape(shape: MapShapeId): PlayBoundsRect {
  const marginY = 100;
  const marginX = shape === "rectangle" ? 0 : 120;
  return {
    left: marginX,
    top: marginY,
    right: MAP_W - marginX,
    bottom: MAP_H - marginY,
  };
}

export function applyPlayBoundsToMap(map: PlayBoundSource, b: PlayBoundsRect): void {
  map.laneTop = b.top;
  map.laneBottom = b.bottom;
  map.laneLeft = b.left;
  map.laneRight = b.right;
}

/** Regular / authored polygon vertices in world space (empty for ellipse shapes). */
export function shapePolygon(map: PlayBoundSource): { x: number; y: number }[] {
  const shape = resolveMapShape(map);
  const b = playBounds(map);
  const { w, h, cx, cy } = playBoundsSize(b);
  const rx = w / 2;
  const ry = h / 2;
  if (shape === "circle" || shape === "oval") return [];
  if (shape === "rectangle" || shape === "square") {
    return [
      { x: b.left, y: b.top },
      { x: b.right, y: b.top },
      { x: b.right, y: b.bottom },
      { x: b.left, y: b.bottom },
    ];
  }
  if (shape === "diamond") {
    return [
      { x: cx, y: b.top },
      { x: b.right, y: cy },
      { x: cx, y: b.bottom },
      { x: b.left, y: cy },
    ];
  }
  if (shape === "triangle") {
    return [
      { x: cx, y: b.top },
      { x: b.right, y: b.bottom },
      { x: b.left, y: b.bottom },
    ];
  }
  if (shape === "trapezoid") {
    const inset = rx * 0.28;
    return [
      { x: b.left + inset, y: b.top },
      { x: b.right - inset, y: b.top },
      { x: b.right, y: b.bottom },
      { x: b.left, y: b.bottom },
    ];
  }
  const n =
    shape === "pentagon" ? 5 : shape === "hexagon" ? 6 : shape === "octagon" ? 8 : 4;
  const verts: { x: number; y: number }[] = [];
  // Point-up orientation (flat-top hexes feel wrong for a lane).
  const rot = -Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 2 * Math.PI) / n;
    verts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return verts;
}

function pointInPolygon(x: number, y: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x;
    const yi = poly[i]!.y;
    const xj = poly[j]!.x;
    const yj = poly[j]!.y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * True if a point (optionally with radius margin) lies inside the playable shape.
 * Margin shrinks the test shape roughly by `margin` via ellipse / polygon inset approx.
 */
export function pointInPlayable(map: PlayBoundSource, x: number, y: number, margin = 0): boolean {
  const shape = resolveMapShape(map);
  const b = playBounds(map);
  const m = Math.max(0, margin);
  const left = b.left + m;
  const right = b.right - m;
  const top = b.top + m;
  const bottom = b.bottom - m;
  if (right - left < 2 || bottom - top < 2) return false;
  const insetMap: PlayBoundSource = {
    shape,
    laneTop: top,
    laneBottom: bottom,
    laneLeft: left,
    laneRight: right,
  };
  if (shape === "rectangle" || shape === "square") {
    return x >= left && x <= right && y >= top && y <= bottom;
  }
  const { w, h, cx, cy } = playBoundsSize(playBounds(insetMap));
  const rx = w / 2;
  const ry = h / 2;
  if (shape === "circle" || shape === "oval") {
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    return nx * nx + ny * ny <= 1;
  }
  return pointInPolygon(x, y, shapePolygon(insetMap));
}

/** Clamp a unit center into the playable area (respecting radius). */
export function clampToPlayable(
  map: PlayBoundSource,
  x: number,
  y: number,
  radius = 0,
): { x: number; y: number } {
  const r = Math.max(0, radius);
  const b = playBounds(map);
  let cx = Math.max(b.left + r, Math.min(b.right - r, x));
  let cy = Math.max(b.top + r, Math.min(b.bottom - r, y));
  if (pointInPlayable(map, cx, cy, r)) return { x: cx, y: cy };
  const midX = (b.left + b.right) / 2;
  const midY = (b.top + b.bottom) / 2;
  for (let i = 0; i < 28; i++) {
    cx += (midX - cx) * 0.4;
    cy += (midY - cy) * 0.4;
    if (pointInPlayable(map, cx, cy, r)) return { x: cx, y: cy };
  }
  return { x: midX, y: midY };
}

/** Shape-specific anchors for required pads after a shape change / reset. */
export function shapeEssentialAnchors(map: PlayBoundSource): {
  base: { x: number; y: number };
  spawner: { x: number; y: number };
  respawn: { x: number; y: number };
  shop: { x: number; y: number };
} {
  const b = playBounds(map);
  const midY = (b.top + b.bottom) / 2;
  const w = b.right - b.left;
  const inset = Math.min(90, Math.max(48, w * 0.1));
  const base = clampToPlayable(map, b.left + inset, midY, 40);
  const spawner = clampToPlayable(map, b.right - inset, midY, 28);
  const respawn = clampToPlayable(map, base.x + 110, midY, 28);
  const shop = clampToPlayable(map, base.x + 90, midY + Math.min(70, (b.bottom - b.top) * 0.18), 36);
  return { base, spawner, respawn, shop };
}

export function strokePlayablePath(
  ctx: CanvasRenderingContext2D,
  map: PlayBoundSource,
): void {
  const shape = resolveMapShape(map);
  const b = playBounds(map);
  const { w, h, cx, cy } = playBoundsSize(b);
  ctx.beginPath();
  if (shape === "circle" || shape === "oval") {
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    return;
  }
  const poly = shapePolygon(map);
  if (!poly.length) {
    ctx.rect(b.left, b.top, w, h);
    return;
  }
  ctx.moveTo(poly[0]!.x, poly[0]!.y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i]!.x, poly[i]!.y);
  ctx.closePath();
}

export function fillPlayablePath(ctx: CanvasRenderingContext2D, map: PlayBoundSource): void {
  strokePlayablePath(ctx, map);
  ctx.fill();
}

/** Shrink AABB toward center (shrinking-lane special). */
export function shrinkPlayBounds(map: PlayBoundSource, amount: number, minHalf = 70): void {
  const b = playBounds(map);
  const { cx, cy } = playBoundsSize(b);
  const halfW = Math.max(minHalf, (b.right - b.left) / 2 - amount);
  const halfH = Math.max(minHalf, (b.bottom - b.top) / 2 - amount);
  applyPlayBoundsToMap(map, {
    left: cx - halfW,
    right: cx + halfW,
    top: cy - halfH,
    bottom: cy + halfH,
  });
}

export function shapeLabel(shape: MapShapeId): string {
  switch (shape) {
    case "rectangle":
      return "Rectangle";
    case "circle":
      return "Circle";
    case "triangle":
      return "Triangle";
    case "square":
      return "Square";
    case "pentagon":
      return "Pentagon";
    case "hexagon":
      return "Hexagon";
    case "octagon":
      return "Octagon";
    case "diamond":
      return "Diamond";
    case "oval":
      return "Oval";
    case "trapezoid":
      return "Trapezoid";
  }
}
