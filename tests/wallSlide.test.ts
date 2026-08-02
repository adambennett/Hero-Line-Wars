import { describe, expect, it } from "vitest";
import {
  clampToPlayable,
  closestPlayableBoundaryPoint,
  pointInPlayable,
  resolveMovePlayable,
} from "../src/game/playBounds";

const HEX = {
  shape: "hexagon" as const,
  laneTop: 100,
  laneBottom: 600,
  laneLeft: 120,
  laneRight: 1480,
};
const R = 16; // hero radius
const CX = 800;
const CY = 350;

describe("shaped-bounds wall sliding (hex teleport fix)", () => {
  it("walks up to the wall and stops — never snaps toward center", () => {
    let x = CX;
    let y = CY;
    let maxX = x;
    for (let i = 0; i < 400; i++) {
      const p = resolveMovePlayable(HEX, x, y, x + 4, y, R);
      expect(pointInPlayable(HEX, p.x, p.y, R)).toBe(true);
      // Monotonic: pushing right must never bounce the unit backwards.
      expect(p.x).toBeGreaterThanOrEqual(x - 1e-6);
      x = p.x;
      y = p.y;
      maxX = Math.max(maxX, x);
    }
    // Reached the vicinity of the right vertex, well past the center.
    expect(maxX).toBeGreaterThan(1300);
  });

  it("slides along a diagonal hex edge instead of stopping dead", () => {
    let x = CX;
    let y = CY;
    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < 400; i++) {
      const p = resolveMovePlayable(HEX, x, y, x + 3, y - 3, R);
      expect(pointInPlayable(HEX, p.x, p.y, R)).toBe(true);
      // No teleports: each step moves at most ~the requested distance.
      expect(Math.hypot(p.x - x, p.y - y)).toBeLessThanOrEqual(6);
      x = p.x;
      y = p.y;
      positions.push({ x, y });
    }
    // After hitting the upper-right edge the unit keeps making progress
    // (sliding) instead of freezing at first contact.
    const last = positions[positions.length - 1]!;
    const mid = positions[200]!;
    const tail = Math.hypot(last.x - mid.x, last.y - mid.y);
    expect(tail).toBeGreaterThan(20);
  });

  it("clamps outside points onto the wall, not the lane center", () => {
    const c = clampToPlayable(HEX, 1550, 120, R);
    expect(pointInPlayable(HEX, c.x, c.y, R)).toBe(true);
    // Result hugs the boundary near where we went out, far from center.
    expect(Math.hypot(c.x - CX, c.y - CY)).toBeGreaterThan(250);
    const edge = closestPlayableBoundaryPoint(HEX, c.x, c.y, R);
    expect(Math.hypot(c.x - edge.x, c.y - edge.y)).toBeLessThan(40);
  });

  it("keeps ellipse (oval) bounds slide-friendly too", () => {
    const OVAL = { ...HEX, shape: "oval" as const };
    let x = CX;
    let y = CY;
    for (let i = 0; i < 300; i++) {
      const p = resolveMovePlayable(OVAL, x, y, x + 2, y - 4, R);
      expect(pointInPlayable(OVAL, p.x, p.y, R)).toBe(true);
      expect(Math.hypot(p.x - x, p.y - y)).toBeLessThanOrEqual(6);
      x = p.x;
      y = p.y;
    }
    // Slid around the arc — meaningful travel from the start point.
    expect(Math.hypot(x - CX, y - CY)).toBeGreaterThan(150);
  });
});
