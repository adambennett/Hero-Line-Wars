import { beforeEach, describe, expect, it } from "vitest";
import {
  canFreezeForAim,
  canPauseForDraft,
  canPauseSimulation,
  cheatsAllowedForPlayers,
  humanPlayerCount,
  isMultiHumanGame,
  laneHumanSlots,
} from "../src/game/pause";
import { createState } from "../src/game/state";

function lane(humans: number) {
  const s = createState("ranger");
  s.humanPlayers = humans;
  return s;
}

describe("pause policy", () => {
  beforeEach(() => localStorage.clear());

  it("allows pausing in plain singleplayer", () => {
    const s = createState("ranger");
    expect(humanPlayerCount(s)).toBe(1);
    expect(canPauseSimulation(s)).toBe(true);
    expect(canPauseForDraft(s)).toBe(true);
    expect(canFreezeForAim(s)).toBe(true);
    expect(isMultiHumanGame(s)).toBe(false);
  });

  it("blocks every pause path with two humans", () => {
    const s = lane(2);
    expect(canPauseSimulation(s)).toBe(false);
    expect(canPauseForDraft(s)).toBe(false);
    expect(canFreezeForAim(s)).toBe(false);
    expect(cheatsAllowedForPlayers(s)).toBe(false);
    expect(isMultiHumanGame(s)).toBe(true);
  });

  it("uses the highest lane count for a match", () => {
    const match = { lanes: [lane(1), lane(3)] as [ReturnType<typeof lane>, ReturnType<typeof lane>] };
    expect(humanPlayerCount(match)).toBe(3);
    expect(canPauseSimulation(match)).toBe(false);
  });

  it("counts controller seats but ignores AI slots", () => {
    const s = createState("ranger");
    s.hero.controllerSlot = 0;
    s.allies = [
      { ...s.hero, controllerSlot: -11 },
      { ...s.hero, controllerSlot: 1 },
    ];
    expect(laneHumanSlots(s).sort()).toEqual([0, 1]);
  });

  it("treats a solo-vs-AI lane (declared 1 human) as pausable", () => {
    const s = createState("ranger");
    s.mpLane = true;
    s.hero.controllerSlot = 0;
    s.allies = [{ ...s.hero, controllerSlot: -11 }];
    s.humanPlayers = 1;
    expect(canPauseSimulation(s)).toBe(true);
  });

  it("never reports fewer than one human", () => {
    expect(humanPlayerCount(null)).toBe(1);
    const s = createState("ranger");
    s.humanPlayers = 0;
    expect(humanPlayerCount(s)).toBe(1);
  });
});
