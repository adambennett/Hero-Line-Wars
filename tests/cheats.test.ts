import { beforeEach, describe, expect, it } from "vitest";
import {
  gameplayCheats,
  gameplayCheatsAllowed,
  invalidateCheatCache,
  loadCheatOptions,
  saveCheatOptions,
} from "../src/meta/cheats";
import { createState } from "../src/game/state";

function enableCheatFlag(): void {
  localStorage.setItem("hlw-cheats-enabled-v1", "1");
}

describe("cheat gating by human count", () => {
  beforeEach(() => {
    localStorage.clear();
    invalidateCheatCache();
  });

  it("returns null when cheats are off", () => {
    const s = createState("ranger");
    expect(gameplayCheats(s)).toBeNull();
  });

  it("applies gameplay cheats for a single human", () => {
    enableCheatFlag();
    saveCheatOptions({ ...loadCheatOptions(), godMode: true });
    const s = createState("ranger");
    expect(gameplayCheatsAllowed(s)).toBe(true);
    expect(gameplayCheats(s)?.godMode).toBe(true);
  });

  it("disables gameplay cheats once a second human joins", () => {
    enableCheatFlag();
    saveCheatOptions({ ...loadCheatOptions(), godMode: true, infiniteGold: true });
    const s = createState("ranger");
    s.humanPlayers = 2;
    expect(gameplayCheatsAllowed(s)).toBe(false);
    expect(gameplayCheats(s)).toBeNull();
  });

  it("does not seed cheat gold into a multi-human run", () => {
    enableCheatFlag();
    saveCheatOptions({ ...loadCheatOptions(), infiniteGold: true, infiniteRerolls: true });
    const solo = createState("ranger", { humanPlayers: 1 });
    const versus = createState("ranger", { humanPlayers: 2 });
    expect(solo.gold).toBe(99999);
    expect(solo.rerollTokens).toBe(99);
    expect(versus.gold).toBeLessThan(99999);
    expect(versus.rerollTokens).toBe(0);
  });
});
