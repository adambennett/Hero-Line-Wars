import { describe, expect, it } from "vitest";
import { sanitizeCustomMap } from "../src/custom/validate";
import { fogFromRunOptions, laneFogState, resolveFog } from "../src/game/fog";
import {
  clampToPlayable,
  pointInPlayable,
  resolveMapShape,
} from "../src/game/playBounds";
import { MAP_H, MAP_W } from "../src/data/constants";

describe("map shape sanitize / defaults", () => {
  it("treats missing shape as rectangle (backward compatible)", () => {
    const map = sanitizeCustomMap({
      id: "cm_legacy",
      name: "Legacy",
      laneTop: 100,
      laneBottom: 500,
    });
    expect(map).not.toBeNull();
    expect(map!.shape).toBe("rectangle");
    expect(map!.laneLeft).toBe(0);
    expect(map!.laneRight).toBe(MAP_W);
  });

  it("keeps a valid shape id and clamps lane extents", () => {
    const map = sanitizeCustomMap({
      id: "cm_hex",
      name: "Hex",
      shape: "hexagon",
      laneTop: 40,
      laneBottom: MAP_H - 40,
      laneLeft: 100,
      laneRight: MAP_W - 100,
    });
    expect(map!.shape).toBe("hexagon");
    expect(resolveMapShape(map!)).toBe("hexagon");
    expect(map!.laneLeft).toBeGreaterThanOrEqual(0);
    expect(map!.laneRight).toBeLessThanOrEqual(MAP_W);
  });

  it("falls back unknown shape strings to rectangle", () => {
    const map = sanitizeCustomMap({
      id: "cm_bogus",
      name: "Bogus",
      shape: "starfruit",
    });
    expect(map!.shape).toBe("rectangle");
  });

  it("clamps points into a circular playable area", () => {
    const circle = {
      shape: "circle" as const,
      laneTop: 150,
      laneBottom: 550,
      laneLeft: 400,
      laneRight: 1200,
    };
    expect(pointInPlayable(circle, 800, 350, 0)).toBe(true);
    expect(pointInPlayable(circle, 50, 50, 0)).toBe(false);
    const c = clampToPlayable(circle, 50, 50, 10);
    expect(pointInPlayable(circle, c.x, c.y, 10)).toBe(true);
  });
});

describe("fog stacking helper", () => {
  it("uses max opacity and min vision among active sources", () => {
    const fog = resolveFog([
      { active: true, opacity: 0.4, visionRadius: 160 },
      { active: true, opacity: 0.9, visionRadius: 80 },
      { active: false, opacity: 1, visionRadius: 20 },
    ]);
    expect(fog.active).toBe(true);
    expect(fog.opacity).toBeCloseTo(0.9);
    expect(fog.visionRadius).toBe(80);
  });

  it("100% thickness is fully black outside vision", () => {
    const src = fogFromRunOptions({ fogAlways: true, fogThicknessPct: 100, fogVisionRadius: 90 });
    expect(src.opacity).toBe(1);
    expect(src.visionRadius).toBe(90);
  });

  it("combines run fog, curse fog, and eclipse predictably", () => {
    const fog = laneFogState({
      fogAlways: true,
      fogThicknessPct: 55,
      fogVisionRadius: 160,
      curseFogTimer: 2,
      mapEclipseActive: true,
    });
    // Strongest opacity (curse 0.72) and tightest vision (curse 90)
    expect(fog.active).toBe(true);
    expect(fog.opacity).toBeGreaterThanOrEqual(0.72);
    expect(fog.visionRadius).toBe(90);
  });
});

describe("custom-map non-array safety (new tool lists)", () => {
  it("survives non-array bounce/portal/relay lists", () => {
    const map = sanitizeCustomMap({
      id: "cm_tools",
      name: "Tools",
      bouncePads: "nope",
      mapPortals: 3,
      relayBeacons: false,
      specials: { emberRain: true, supplyDrops: "yes", chronoPulse: true },
    });
    expect(map).not.toBeNull();
    expect(map!.bouncePads).toEqual([]);
    expect(map!.mapPortals).toEqual([]);
    expect(map!.relayBeacons).toEqual([]);
    expect(map!.specials).toEqual({ emberRain: true, chronoPulse: true });
  });
});
