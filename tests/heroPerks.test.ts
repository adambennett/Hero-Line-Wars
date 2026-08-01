import { describe, expect, it } from "vitest";
import { createState } from "../src/game/state";
import { draftLevelPassives, LEVEL_PASSIVES } from "../src/data/xp";
import { HERO_LIST } from "../src/data/heroes";
import { HERO_PERK_DEFS, heroPerksFor } from "../src/data/heroPerks";
import { applyLevelPassive } from "../src/systems/xp";
import {
  aggregateHeroPerks,
  perkEligibleForHero,
} from "../src/systems/heroPerks";
import { attackDamage } from "../src/systems/combat";

describe("Hero-specific level bonuses", () => {
  it("defines 3 perks per hero and 6 for Gunner", () => {
    for (const h of HERO_LIST) {
      const perks = heroPerksFor(h.id);
      const expected = h.id === "gunner" ? 6 : 3;
      expect(perks.length, h.id).toBe(expected);
    }
    expect(HERO_PERK_DEFS.length).toBe(
      HERO_LIST.reduce((n, h) => n + (h.id === "gunner" ? 6 : 3), 0),
    );
  });

  it("only offers matching hero perks in drafts", () => {
    const picks = draftLevelPassives(12, "ranger");
    for (const id of picks) {
      const def = LEVEL_PASSIVES[id];
      if (def.heroId) expect(def.heroId).toBe("ranger");
    }
  });

  it("rejects applying another hero's perk", () => {
    const state = createState("ranger");
    expect(perkEligibleForHero("warden_iron_bastion", "ranger")).toBe(false);
    applyLevelPassive(state, "warden_iron_bastion");
    expect(state.levelPassives).not.toContain("warden_iron_bastion");
  });

  it("applies matching perk and boosts damage aggregate", () => {
    const state = createState("ranger");
    const before = attackDamage(state);
    applyLevelPassive(state, "ranger_skyfall");
    expect(state.levelPassives).toContain("ranger_skyfall");
    const agg = aggregateHeroPerks(state.levelPassives, "ranger");
    expect(agg.abilityDamageMul).toBeGreaterThan(1);
    // Skyfall is ability damage — base attack may be unchanged; hunters cadence would change attack
    applyLevelPassive(state, "ranger_hunters_cadence");
    const after = attackDamage(state);
    expect(after).toBeGreaterThanOrEqual(before);
    const agg2 = aggregateHeroPerks(state.levelPassives, "ranger");
    expect(agg2.attackCdMul).toBeLessThan(1);
  });

  it("Gunner weapon perk boosts only that family", () => {
    const state = createState("gunner");
    applyLevelPassive(state, "gunner_rocket_rack");
    const agg = aggregateHeroPerks(state.levelPassives, "gunner");
    expect(agg.guns.rockets?.damageMul).toBeGreaterThan(1);
    expect(agg.guns.laser?.damageMul ?? 1).toBe(1);
  });
});
