import { describe, expect, it } from "vitest";
import { createState } from "../src/game/state";
import { __testBuildChestDraft, applyChestReward, chestWaveScale } from "../src/systems/chests";

describe("chest rewards", () => {
  it("scales payouts with wave", () => {
    expect(chestWaveScale(1)).toBe(1);
    expect(chestWaveScale(20)).toBeCloseTo(1 + 19 * 0.12);
  });

  it("offers two unique reward kinds", () => {
    const state = createState("ranger");
    state.wave = 12;
    for (let i = 0; i < 30; i++) {
      const options = __testBuildChestDraft(state, "common");
      expect(options).toHaveLength(2);
      const kinds = options.map((o) => o.kind);
      expect(new Set(kinds).size).toBe(2);
    }
  });

  it("scales gold with wave", () => {
    const early = createState("ranger");
    early.wave = 2;
    const late = createState("ranger");
    late.wave = 20;
    const eGold = __testBuildChestDraft(early, "common").filter((o) => o.kind === "gold")[0];
    const lGold = __testBuildChestDraft(late, "common").filter((o) => o.kind === "gold")[0];
    if (eGold?.kind === "gold" && lGold?.kind === "gold") {
      expect(lGold.amount).toBeGreaterThan(eGold.amount);
    }
  });

  it("applies non-gold rewards", () => {
    const state = createState("ranger");
    state.hero.hp = 20;
    applyChestReward(state, { kind: "heal", amount: 15, label: "Heal", blurb: "x" });
    expect(state.hero.hp).toBe(35);
    applyChestReward(state, { kind: "reroll", amount: 2, label: "Reroll", blurb: "x" });
    expect(state.rerollTokens).toBe(2);
  });
});
