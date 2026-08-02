import { describe, expect, it } from "vitest";
import { createState } from "../src/game/state";
import { tryCastAbility } from "../src/systems/abilities";
import { resolveHero } from "../src/custom/registry";

const ULT = 1; // sapper abilities: [plantmine (mobility), detonate (ultimate)]

describe("Sapper detonate", () => {
  it("is a no-op with zero mines — no explosion, no cooldown", () => {
    const state = createState("sapper");
    expect(state.mines).toHaveLength(0);
    const castsBefore = state.abilitiesCast;
    tryCastAbility(state, "ultimate", { x: 0, y: 0 });
    expect(state.hero.abilityCds[ULT]).toBe(0);
    expect(state.abilitiesCast).toBe(castsBefore);
    expect(state.fx.length).toBe(0);
  });

  it("is a no-op while mines are still arming (keeps them planted)", () => {
    const state = createState("sapper");
    state.mines.push({
      id: state.nextId++,
      x: 500,
      y: 350,
      radius: 16,
      armTimer: 0.8,
      damage: 30,
    });
    tryCastAbility(state, "ultimate", { x: 0, y: 0 });
    expect(state.hero.abilityCds[ULT]).toBe(0);
    expect(state.mines).toHaveLength(1);
  });

  it("detonates armed mines, consumes cooldown, and keeps arming ones", () => {
    const state = createState("sapper");
    state.mines.push(
      { id: state.nextId++, x: 500, y: 350, radius: 16, armTimer: 0, damage: 30 },
      { id: state.nextId++, x: 560, y: 350, radius: 16, armTimer: 1.1, damage: 30 },
    );
    tryCastAbility(state, "ultimate", { x: 0, y: 0 });
    expect(state.hero.abilityCds[ULT]).toBeGreaterThan(0);
    expect(state.mines).toHaveLength(1);
    expect(state.mines[0]!.armTimer).toBeGreaterThan(0);
  });

  it("primary grenade attack rate was slowed", () => {
    const sapper = resolveHero("sapper");
    expect(sapper.attackCooldown).toBeGreaterThanOrEqual(0.6);
  });
});
