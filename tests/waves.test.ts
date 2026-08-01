import { describe, expect, it } from "vitest";
import { createState } from "../src/game/state";
import { planWaveSpawns } from "../src/systems/waves";
import { isBossKind, isEliteKind, waveTier } from "../src/data/enemies";

/** First wave numbers of each scheduled tier, so the test never guesses. */
function firstWaveOfTier(tier: "elite" | "boss"): number {
  for (let w = 1; w <= 200; w++) if (waveTier(w) === tier) return w;
  throw new Error(`no ${tier} wave in the first 200`);
}

const ELITE_WAVE = firstWaveOfTier("elite");
const BOSS_WAVE = firstWaveOfTier("boss");

describe("creative wave options", () => {
  it("spawns one elite on a scheduled elite wave by default", () => {
    const s = createState("ranger");
    const plan = planWaveSpawns(s, ELITE_WAVE);
    expect(plan.tier).toBe("elite");
    expect(plan.specials).toHaveLength(1);
    expect(isEliteKind(plan.specials[0]!)).toBe(true);
    expect(plan.banner).toBe("ELITE WAVE");
  });

  it("disableElites removes the elite and restores the full enemy budget", () => {
    const on = createState("ranger");
    const off = createState("ranger", { disableElites: true });
    const planOn = planWaveSpawns(on, ELITE_WAVE);
    const planOff = planWaveSpawns(off, ELITE_WAVE);
    expect(planOff.specials).toHaveLength(0);
    expect(planOff.banner).toBeNull();
    expect(planOff.tier).toBe("elite");
    expect(planOff.count).toBeGreaterThan(planOn.count);
  });

  it("disableBosses removes the boss", () => {
    const off = createState("ranger", { disableBosses: true });
    const plan = planWaveSpawns(off, BOSS_WAVE);
    expect(plan.tier).toBe("boss");
    expect(plan.specials).toHaveLength(0);
  });

  it("doubleElites spawns a second elite", () => {
    const s = createState("ranger", { doubleElites: true });
    const plan = planWaveSpawns(s, ELITE_WAVE);
    expect(plan.specials).toHaveLength(2);
    expect(plan.specials.every((k) => isEliteKind(k))).toBe(true);
  });

  it("doubleElites adds an escort elite to a boss wave", () => {
    const s = createState("ranger", { doubleElites: true });
    const plan = planWaveSpawns(s, BOSS_WAVE);
    expect(plan.specials).toHaveLength(2);
    expect(isBossKind(plan.specials[0]!)).toBe(true);
    expect(isEliteKind(plan.specials[1]!)).toBe(true);
  });

  it("disableElites + doubleElites still gives a lone boss", () => {
    const s = createState("ranger", { doubleElites: true, disableElites: true });
    const plan = planWaveSpawns(s, BOSS_WAVE);
    expect(plan.specials).toHaveLength(1);
    expect(isBossKind(plan.specials[0]!)).toBe(true);
  });
});
