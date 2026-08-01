import { describe, expect, it } from "vitest";
import { sanitizeCustomHero, sanitizeCustomMap } from "../src/custom/validate";
import { MOBILITY_ABILITIES, PASSIVE_CATALOG, ULTIMATE_ABILITIES } from "../src/custom/catalog";
import { MAP_H, MAP_W } from "../src/data/constants";

describe("custom map sanitizer", () => {
  it("survives non-array zone lists instead of throwing", () => {
    const map = sanitizeCustomMap({
      id: "evil",
      name: "Evil",
      healSprings: "not-an-array",
      slowMires: 42,
      highGrounds: { x: 1 },
      obstacles: null,
      shops: true,
      turretSlots: "nope",
      windCurrents: 0,
      spikePulses: false,
    });
    expect(map).not.toBeNull();
    expect(map!.healSprings).toEqual([]);
    expect(map!.slowMires).toEqual([]);
    expect(map!.highGrounds).toEqual([]);
    expect(map!.obstacles).toEqual([]);
    expect(map!.shops).toEqual([]);
    expect(map!.turretSlots).toEqual([]);
    expect(map!.spikePulses).toEqual([]);
  });

  it("drops non-object entries inside an otherwise valid list", () => {
    const map = sanitizeCustomMap({
      id: "mixed",
      name: "Mixed",
      obstacles: ["x", null, 7, { x: 400, y: 200, w: 60, h: 80 }],
    });
    expect(map!.obstacles).toHaveLength(1);
  });

  it("clamps absurd numbers and caps list length", () => {
    const map = sanitizeCustomMap({
      id: "big",
      name: "Big",
      laneTop: -1e12,
      laneBottom: Number.NaN,
      obstacles: Array.from({ length: 5000 }, () => ({ x: 1e9, y: -1e9, w: 1e9, h: "5" })),
    });
    expect(map).not.toBeNull();
    expect(map!.laneTop).toBeGreaterThanOrEqual(20);
    expect(map!.laneBottom).toBeLessThanOrEqual(MAP_H - 20);
    expect(map!.laneBottom).toBeGreaterThan(map!.laneTop);
    expect(map!.obstacles.length).toBeLessThanOrEqual(80);
    for (const o of map!.obstacles) {
      expect(o.x).toBeLessThanOrEqual(MAP_W + 20);
      expect(o.w).toBeGreaterThan(0);
      expect(Number.isFinite(o.h)).toBe(true);
    }
  });

  it("clamps specials to real booleans and drops unknown keys", () => {
    const map = sanitizeCustomMap({
      id: "spec",
      name: "Spec",
      specials: { shiftingObstacles: "yes", eclipseFog: true, bogus: true, chestMagnet: 1 },
    });
    expect(map!.specials).toEqual({ eclipseFog: true });
  });

  it("rejects payloads that are not usable map objects", () => {
    expect(sanitizeCustomMap(null)).toBeNull();
    expect(sanitizeCustomMap("map")).toBeNull();
    expect(sanitizeCustomMap({ name: "no id" })).toBeNull();
  });

  it("still loads a normal map unchanged in shape", () => {
    const map = sanitizeCustomMap({
      id: "cm_ok",
      name: "Okay Lane",
      laneTop: 100,
      laneBottom: 500,
      obstacles: [{ x: 400, y: 200, w: 60, h: 80 }],
      healSprings: [{ x: 300, y: 300, w: 60, h: 60 }],
      specials: { eclipseFog: true },
    });
    expect(map).not.toBeNull();
    expect(map!.id).toBe("cm_ok");
    expect(map!.name).toBe("Okay Lane");
    expect(map!.obstacles).toHaveLength(1);
    expect(map!.healSprings).toHaveLength(1);
  });
});

describe("custom hero sanitizer", () => {
  const mobility = MOBILITY_ABILITIES[0]!.id;
  const ultimate = ULTIMATE_ABILITIES[0]!.id;
  const passive = PASSIVE_CATALOG[0]!.id;

  it("rejects heroes whose ability list is not an array", () => {
    expect(sanitizeCustomHero({ id: "x", name: "X", abilities: "nope" })).toBeNull();
  });

  it("rejects heroes with fewer than two abilities", () => {
    expect(sanitizeCustomHero({ id: "x", name: "X", abilities: [{ id: mobility }] })).toBeNull();
  });

  it("accepts and clamps a well-formed hero", () => {
    const hero = sanitizeCustomHero({
      id: "custom_a",
      name: "Custom A",
      maxHp: 99999,
      speed: -5,
      color: "javascript:alert(1)",
      passive: { id: passive },
      abilities: [
        { id: mobility, name: "Dash", cooldown: 5 },
        { id: ultimate, name: "Nova", cooldown: 1e9 },
      ],
    });
    expect(hero).not.toBeNull();
    expect(hero!.abilities).toHaveLength(2);
    expect(hero!.maxHp).toBeLessThanOrEqual(400);
    expect(hero!.speed).toBeGreaterThanOrEqual(80);
    expect(hero!.color).toBe("#8ab4f8");
    expect(hero!.abilities[1].cooldown).toBeLessThanOrEqual(60);
  });
});
