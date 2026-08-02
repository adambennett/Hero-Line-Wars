import { describe, expect, it } from "vitest";
import type { MapDef } from "../src/data/maps";
import {
  flowCostAt,
  flowFieldFor,
  flowReachable,
  sampleFlow,
} from "../src/systems/flowField";

/** Minimal maze lane: two staggered walls force an S-path to the base. */
function mazeMap(): MapDef {
  return {
    id: "test_maze",
    name: "Test Maze",
    laneTop: 100,
    laneBottom: 600,
    base: { x: 140, y: 350, radius: 46, maxHp: 100 },
    spawner: { x: 1460, y: 350, radius: 30 },
    shop: { x: 220, y: 430, radius: 36, interactRange: 56 },
    obstacles: [
      // Wall A: blocks everything except a gap at the bottom.
      { x: 900, y: 100, w: 40, h: 380 },
      // Wall B: blocks everything except a gap at the top.
      { x: 500, y: 220, w: 40, h: 380 },
    ],
    highGrounds: [],
    turretSlots: [],
  } as unknown as MapDef;
}

describe("enemy flow-field pathfinding", () => {
  it("routes a walker from spawner to base through the maze", () => {
    const map = mazeMap();
    let x = 1400;
    let y = 350;
    const field = flowFieldFor(map, map.base.x, map.base.y);
    expect(flowReachable(field, x, y)).toBe(true);

    const startCost = flowCostAt(field, x, y);
    expect(Number.isFinite(startCost)).toBe(true);

    let reached = false;
    for (let i = 0; i < 4000; i++) {
      const dir = sampleFlow(field, x, y);
      expect(dir).not.toBeNull();
      x += dir!.x * 6;
      y += dir!.y * 6;
      if (Math.hypot(x - map.base.x, y - map.base.y) < 90) {
        reached = true;
        break;
      }
    }
    expect(reached).toBe(true);
    // Ended up below/above walls — i.e. actually threaded the gaps.
    expect(flowCostAt(field, x, y)).toBeLessThan(startCost);
  });

  it("marks fully sealed pockets as unreachable (boxed-in fallback)", () => {
    const map = mazeMap();
    // Seal the lane completely with one full-height wall.
    map.obstacles = [{ x: 800, y: 90, w: 60, h: 520 }];
    const field = flowFieldFor(map, map.base.x, map.base.y);
    expect(flowReachable(field, 1400, 350)).toBe(false);
    expect(flowReachable(field, 300, 350)).toBe(true);
  });

  it("caches per layout and recomputes when obstacles shift", () => {
    const map = mazeMap();
    const a = flowFieldFor(map, map.base.x, map.base.y);
    const b = flowFieldFor(map, map.base.x, map.base.y);
    expect(b).toBe(a); // cached — same layout, same goal

    map.obstacles[0]!.y += 64; // shifting-obstacle special moved a wall
    const c = flowFieldFor(map, map.base.x, map.base.y);
    expect(c).not.toBe(a); // signature change invalidates the cache
  });

  it("supports hero-position goals with cheap cell-keyed caching", () => {
    const map = mazeMap();
    const heroA = flowFieldFor(map, 700, 150);
    const heroA2 = flowFieldFor(map, 702, 152); // same cell — reuse
    expect(heroA2).toBe(heroA);
    const heroB = flowFieldFor(map, 700, 500);
    expect(heroB).not.toBe(heroA);
  });
});
