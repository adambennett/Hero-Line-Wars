import { describe, expect, it } from "vitest";
import { isNameTaken, uniqueImportName } from "../src/meta/uniqueNames";
import { getGameType } from "../src/meta/gameTypes";
import { gameTypeOptionDeltas, outlastBaselineOptions } from "../src/ui/gameTypeSummary";

describe("uniqueImportName", () => {
  it("returns base when free", () => {
    expect(uniqueImportName("Outlast", ["Race"])).toBe("Outlast");
  });

  it("appends (Custom) then numbered suffixes", () => {
    const taken = ["Outlast", "Outlast (Custom)", "Outlast (Custom) (1)"];
    expect(uniqueImportName("Outlast", taken)).toBe("Outlast (Custom) (2)");
  });

  it("isNameTaken is case-sensitive", () => {
    expect(isNameTaken("Race", ["Race"])).toBe(true);
    expect(isNameTaken("race", ["Race"])).toBe(false);
  });
});

describe("gameTypeOptionDeltas", () => {
  it("returns empty for Outlast (baseline)", () => {
    expect(gameTypeOptionDeltas(outlastBaselineOptions())).toEqual([]);
    expect(gameTypeOptionDeltas(getGameType("outlast").options)).toEqual([]);
  });

  it("formats Race deltas vs Outlast as Name: value", () => {
    const lines = gameTypeOptionDeltas(getGameType("race").options);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => l.includes(": "))).toBe(true);
    expect(lines.some((l) => /^Waves to win:/.test(l))).toBe(true);
  });

  it("lists corpse / size / infinite rerolls for giant explosive-like opts", () => {
    const o = {
      ...outlastBaselineOptions(),
      corpseExplosion: true,
      infiniteRerolls: true,
      playerSizeMul: 5,
      enemySizeMul: 5,
      wavesToWin: 10,
    };
    const lines = gameTypeOptionDeltas(o);
    expect(lines.some((l) => l === "Corpse Explosion: ON")).toBe(true);
    expect(lines.some((l) => l === "Infinite rerolls: ON")).toBe(true);
    expect(lines.some((l) => l === "Player Size: 5x")).toBe(true);
    expect(lines.some((l) => l === "Enemy Size: 5x")).toBe(true);
  });
});
