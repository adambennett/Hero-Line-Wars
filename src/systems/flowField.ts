/**
 * Coarse-grid flow fields for enemy macro navigation.
 *
 * All creeps in a lane share one goal (usually the base), so a flow field is
 * the cheapest general answer: one Dijkstra sweep over a ~50x22 grid per
 * obstacle layout, then every enemy reads its direction with an O(1) lookup.
 *
 * Fields are cached per map instance (per lane) and invalidated by a cheap
 * signature covering obstacles + playable bounds, so shifting-obstacle
 * specials and shrinking lanes recompute automatically. Hero-target fields
 * (goal follows the hero) reuse the same cache keyed by goal cell and only
 * recompute when the goal crosses a cell boundary.
 */
import { MAP_H, MAP_W } from "../data/constants";
import type { MapDef } from "../data/maps";
import { circleHitsObstacle } from "../data/maps";
import { pointInPlayable } from "../game/playBounds";

export const FLOW_CELL = 32;
export const FLOW_W = Math.ceil(MAP_W / FLOW_CELL);
export const FLOW_H = Math.ceil(MAP_H / FLOW_CELL);
const CELLS = FLOW_W * FLOW_H;
const INF = Number.POSITIVE_INFINITY;
/** Clearance radius when marking cells blocked — larger than a typical creep
 *  so flow paths stay off obstacle corners instead of aiming into them. */
const BLOCK_RADIUS = 12;

export type FlowField = {
  /** Unit direction per cell (0,0 at goal / blocked / unreachable). */
  dirX: Float32Array;
  dirY: Float32Array;
  /** Integration cost from goal; INF = unreachable. */
  cost: Float64Array;
  blocked: Uint8Array;
  goalCell: number;
};

type LaneCache = {
  sig: string;
  fields: Map<number, FlowField>;
};

const laneCaches = new WeakMap<MapDef, LaneCache>();
/** Max distinct goal cells cached per layout (base + a few hero positions). */
const MAX_FIELDS = 8;

function cellIndex(cx: number, cy: number): number {
  return cy * FLOW_W + cx;
}

export function cellOf(x: number, y: number): { cx: number; cy: number } {
  const cx = Math.max(0, Math.min(FLOW_W - 1, Math.floor(x / FLOW_CELL)));
  const cy = Math.max(0, Math.min(FLOW_H - 1, Math.floor(y / FLOW_CELL)));
  return { cx, cy };
}

function cellCenter(cx: number, cy: number): { x: number; y: number } {
  return { x: (cx + 0.5) * FLOW_CELL, y: (cy + 0.5) * FLOW_CELL };
}

function mapSignature(map: MapDef): string {
  let s = `${map.laneTop}|${map.laneBottom}|${map.laneLeft ?? ""}|${map.laneRight ?? ""}|${map.shape ?? ""}`;
  for (const o of map.obstacles) s += `;${o.x},${o.y},${o.w},${o.h}`;
  return s;
}

function computeBlocked(map: MapDef): Uint8Array {
  const blocked = new Uint8Array(CELLS);
  for (let cy = 0; cy < FLOW_H; cy++) {
    for (let cx = 0; cx < FLOW_W; cx++) {
      const { x, y } = cellCenter(cx, cy);
      let b = !pointInPlayable(map, x, y, BLOCK_RADIUS);
      if (!b) {
        for (const o of map.obstacles) {
          if (circleHitsObstacle(x, y, BLOCK_RADIUS, o)) {
            b = true;
            break;
          }
        }
      }
      if (b) blocked[cellIndex(cx, cy)] = 1;
    }
  }
  return blocked;
}

/** Nearest open cell to (cx, cy) — spiral scan, used when the goal cell is blocked. */
function nearestOpenCell(blocked: Uint8Array, cx: number, cy: number): number {
  if (!blocked[cellIndex(cx, cy)]) return cellIndex(cx, cy);
  for (let ring = 1; ring < Math.max(FLOW_W, FLOW_H); ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= FLOW_W || ny >= FLOW_H) continue;
        if (!blocked[cellIndex(nx, ny)]) return cellIndex(nx, ny);
      }
    }
  }
  return cellIndex(cx, cy);
}

const NEIGHBORS: { dx: number; dy: number; cost: number }[] = [
  { dx: 1, dy: 0, cost: 1 },
  { dx: -1, dy: 0, cost: 1 },
  { dx: 0, dy: 1, cost: 1 },
  { dx: 0, dy: -1, cost: 1 },
  { dx: 1, dy: 1, cost: Math.SQRT2 },
  { dx: 1, dy: -1, cost: Math.SQRT2 },
  { dx: -1, dy: 1, cost: Math.SQRT2 },
  { dx: -1, dy: -1, cost: Math.SQRT2 },
];

function computeField(map: MapDef, goalX: number, goalY: number): FlowField {
  const blocked = computeBlocked(map);
  const goal = cellOf(goalX, goalY);
  const goalCell = nearestOpenCell(blocked, goal.cx, goal.cy);

  const cost = new Float64Array(CELLS).fill(INF);
  cost[goalCell] = 0;

  // Dijkstra over the grid (array-heap is plenty for ~1100 cells).
  const heap: number[] = [goalCell];
  const heapCost: number[] = [0];
  while (heap.length > 0) {
    // Extract min
    let mi = 0;
    for (let i = 1; i < heap.length; i++) {
      if (heapCost[i]! < heapCost[mi]!) mi = i;
    }
    const cur = heap[mi]!;
    const curCost = heapCost[mi]!;
    heap[mi] = heap[heap.length - 1]!;
    heapCost[mi] = heapCost[heapCost.length - 1]!;
    heap.pop();
    heapCost.pop();
    if (curCost > cost[cur]!) continue;

    const cx = cur % FLOW_W;
    const cy = Math.floor(cur / FLOW_W);
    for (const n of NEIGHBORS) {
      const nx = cx + n.dx;
      const ny = cy + n.dy;
      if (nx < 0 || ny < 0 || nx >= FLOW_W || ny >= FLOW_H) continue;
      const ni = cellIndex(nx, ny);
      if (blocked[ni]) continue;
      // No corner cutting: diagonals need both orthogonal cells open.
      if (n.dx !== 0 && n.dy !== 0) {
        if (blocked[cellIndex(cx + n.dx, cy)] || blocked[cellIndex(cx, cy + n.dy)]) continue;
      }
      const nc = curCost + n.cost;
      if (nc < cost[ni]!) {
        cost[ni] = nc;
        heap.push(ni);
        heapCost.push(nc);
      }
    }
  }

  // Direction per cell: toward the cheapest reachable neighbor.
  const dirX = new Float32Array(CELLS);
  const dirY = new Float32Array(CELLS);
  for (let cy = 0; cy < FLOW_H; cy++) {
    for (let cx = 0; cx < FLOW_W; cx++) {
      const i = cellIndex(cx, cy);
      if (blocked[i] || !Number.isFinite(cost[i]!) || i === goalCell) continue;
      let bestCost = cost[i]!;
      let bx = 0;
      let by = 0;
      for (const n of NEIGHBORS) {
        const nx = cx + n.dx;
        const ny = cy + n.dy;
        if (nx < 0 || ny < 0 || nx >= FLOW_W || ny >= FLOW_H) continue;
        const ni = cellIndex(nx, ny);
        if (blocked[ni]) continue;
        if (n.dx !== 0 && n.dy !== 0) {
          if (blocked[cellIndex(cx + n.dx, cy)] || blocked[cellIndex(cx, cy + n.dy)]) continue;
        }
        if (cost[ni]! < bestCost) {
          bestCost = cost[ni]!;
          bx = n.dx;
          by = n.dy;
        }
      }
      const len = Math.hypot(bx, by);
      if (len > 0) {
        dirX[i] = bx / len;
        dirY[i] = by / len;
      }
    }
  }

  return { dirX, dirY, cost, blocked, goalCell };
}

/** Shared, cached flow field for this lane's map toward (goalX, goalY). */
export function flowFieldFor(map: MapDef, goalX: number, goalY: number): FlowField {
  const sig = mapSignature(map);
  let entry = laneCaches.get(map);
  if (!entry || entry.sig !== sig) {
    entry = { sig, fields: new Map() };
    laneCaches.set(map, entry);
  }
  const goal = cellOf(goalX, goalY);
  const key = cellIndex(goal.cx, goal.cy);
  let field = entry.fields.get(key);
  if (!field) {
    field = computeField(map, goalX, goalY);
    if (entry.fields.size >= MAX_FIELDS) {
      const first = entry.fields.keys().next().value;
      if (first !== undefined) entry.fields.delete(first);
    }
    entry.fields.set(key, field);
  }
  return field;
}

/** Bilinear-smoothed flow direction at a world point; null when unreachable/blocked. */
export function sampleFlow(field: FlowField, x: number, y: number): { x: number; y: number } | null {
  const fx = x / FLOW_CELL - 0.5;
  const fy = y / FLOW_CELL - 0.5;
  const x0 = Math.max(0, Math.min(FLOW_W - 1, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(FLOW_H - 1, Math.floor(fy)));
  const x1 = Math.min(FLOW_W - 1, x0 + 1);
  const y1 = Math.min(FLOW_H - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, fx - x0));
  const ty = Math.max(0, Math.min(1, fy - y0));

  let dx = 0;
  let dy = 0;
  let wsum = 0;
  const acc = (cx: number, cy: number, w: number): void => {
    if (w <= 0) return;
    const i = cellIndex(cx, cy);
    if (field.blocked[i] || !Number.isFinite(field.cost[i]!)) return;
    dx += field.dirX[i]! * w;
    dy += field.dirY[i]! * w;
    wsum += w;
  };
  acc(x0, y0, (1 - tx) * (1 - ty));
  acc(x1, y0, tx * (1 - ty));
  acc(x0, y1, (1 - tx) * ty);
  acc(x1, y1, tx * ty);
  if (wsum <= 0) return null;

  const len = Math.hypot(dx, dy);
  if (len < 1e-4) {
    // At/near the goal cell — no direction needed.
    return { x: 0, y: 0 };
  }
  return { x: dx / len, y: dy / len };
}

/** True if the world point sits in (or adjacent to) a cell that can reach the goal. */
export function flowReachable(field: FlowField, x: number, y: number): boolean {
  const { cx, cy } = cellOf(x, y);
  for (let dy2 = -1; dy2 <= 1; dy2++) {
    for (let dx2 = -1; dx2 <= 1; dx2++) {
      const nx = cx + dx2;
      const ny = cy + dy2;
      if (nx < 0 || ny < 0 || nx >= FLOW_W || ny >= FLOW_H) continue;
      const i = cellIndex(nx, ny);
      if (!field.blocked[i] && Number.isFinite(field.cost[i]!)) return true;
    }
  }
  return false;
}

/** Integration cost at a world point (min over the 3x3 neighborhood); INF if unreachable. */
export function flowCostAt(field: FlowField, x: number, y: number): number {
  const { cx, cy } = cellOf(x, y);
  let best = INF;
  for (let dy2 = -1; dy2 <= 1; dy2++) {
    for (let dx2 = -1; dx2 <= 1; dx2++) {
      const nx = cx + dx2;
      const ny = cy + dy2;
      if (nx < 0 || ny < 0 || nx >= FLOW_W || ny >= FLOW_H) continue;
      const i = cellIndex(nx, ny);
      if (!field.blocked[i] && field.cost[i]! < best) best = field.cost[i]!;
    }
  }
  return best;
}
