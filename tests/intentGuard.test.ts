import { describe, expect, it } from "vitest";
import { IntentRateLimiter, sanitizeIntent } from "../src/net/intentGuard";
import { RELICS } from "../src/data/relics";

describe("intent sanitizer", () => {
  it("returns a neutral intent for junk payloads", () => {
    for (const junk of [null, undefined, 7, "move", [1, 2]]) {
      const i = sanitizeIntent(junk);
      expect(i.moveX).toBe(0);
      expect(i.moveY).toBe(0);
      expect(i.attackHeld).toBe(false);
      expect(i.chooseRelic).toBeNull();
    }
  });

  it("clamps move vectors and rejects NaN / Infinity", () => {
    const i = sanitizeIntent({ moveX: 1e9, moveY: -1e9 });
    expect(i.moveX).toBe(1);
    expect(i.moveY).toBe(-1);
    const j = sanitizeIntent({ moveX: Number.NaN, moveY: Number.POSITIVE_INFINITY });
    expect(j.moveX).toBe(0);
    expect(j.moveY).toBe(0);
  });

  it("normalizes aim to a unit vector with a sane default", () => {
    const i = sanitizeIntent({ aimX: 30, aimY: 40 });
    expect(Math.hypot(i.aimX, i.aimY)).toBeCloseTo(1, 6);
    const zero = sanitizeIntent({ aimX: 0, aimY: 0 });
    expect(zero.aimX).toBe(1);
    expect(zero.aimY).toBe(0);
    const bad = sanitizeIntent({ aimX: Number.NaN, aimY: "left" });
    expect(Math.hypot(bad.aimX, bad.aimY)).toBeCloseTo(1, 6);
  });

  it("only accepts real booleans for action flags", () => {
    const i = sanitizeIntent({ attackHeld: "true", ultimate: 1, mobility: {} });
    expect(i.attackHeld).toBe(false);
    expect(i.ultimate).toBe(false);
    expect(i.mobility).toBe(false);
  });

  it("bounds discrete selections", () => {
    expect(sanitizeIntent({ sendDigit: 3 }).sendDigit).toBe(3);
    expect(sanitizeIntent({ sendDigit: 99 }).sendDigit).toBeNull();
    expect(sanitizeIntent({ sendDigit: 0 }).sendDigit).toBeNull();
    expect(sanitizeIntent({ shopSlot: 2 }).shopSlot).toBe(2);
    expect(sanitizeIntent({ shopSlot: -4 }).shopSlot).toBeNull();
    expect(sanitizeIntent({ chooseChest: 1000 }).chooseChest).toBeNull();
  });

  it("only accepts ids that exist in the data registries", () => {
    const realRelic = Object.keys(RELICS)[0]!;
    expect(sanitizeIntent({ chooseRelic: realRelic }).chooseRelic).toBe(realRelic);
    expect(sanitizeIntent({ chooseRelic: "__proto__" }).chooseRelic).toBeNull();
    expect(sanitizeIntent({ chooseRelic: "toString" }).chooseRelic).toBeNull();
    expect(sanitizeIntent({ chooseLevel: "not_a_passive" }).chooseLevel).toBeNull();
  });

  it("never hands back the caller's object", () => {
    const raw = { moveX: 1 };
    expect(sanitizeIntent(raw)).not.toBe(raw);
  });
});

describe("intent rate limiter", () => {
  it("allows a normal frame cadence and drops floods", () => {
    const rl = new IntentRateLimiter(5, 1000);
    const t = 1_000_000;
    for (let i = 0; i < 5; i++) expect(rl.allow(1, t)).toBe(true);
    expect(rl.allow(1, t)).toBe(false);
    // New window resets the budget.
    expect(rl.allow(1, t + 1001)).toBe(true);
  });

  it("tracks seats independently", () => {
    const rl = new IntentRateLimiter(1, 1000);
    const t = 1_000_000;
    expect(rl.allow(0, t)).toBe(true);
    expect(rl.allow(1, t)).toBe(true);
    expect(rl.allow(0, t)).toBe(false);
  });
});
