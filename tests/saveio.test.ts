import { beforeEach, describe, expect, it } from "vitest";
import { applySaveImport, buildSaveExport, validateSaveImport } from "../src/meta/saveio";
import { loadMetaStore, saveMetaStore } from "../src/meta/store";
import { MAX_ASCENSION } from "../src/meta/ascension";
import { META_UPGRADES } from "../src/meta/upgrades";

const UPGRADE = META_UPGRADES[0]!;

describe("save export / import", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a real profile", () => {
    const store = loadMetaStore();
    store.crests = 137;
    store.totalRuns = 9;
    store.totalWins = 4;
    store.bestWave = 21;
    store.ranks = { [UPGRADE.id]: 1 };
    saveMetaStore(store);

    const exported = buildSaveExport();
    localStorage.clear();
    const res = applySaveImport(JSON.parse(JSON.stringify(exported)));
    expect(res.ok).toBe(true);

    const back = loadMetaStore();
    expect(back.crests).toBe(137);
    expect(back.totalRuns).toBe(9);
    expect(back.totalWins).toBe(4);
    expect(back.bestWave).toBe(21);
    expect(back.ranks[UPGRADE.id]).toBe(1);
  });

  it("rejects malformed payloads", () => {
    expect(validateSaveImport(null).ok).toBe(false);
    expect(validateSaveImport("{}").ok).toBe(false);
    expect(validateSaveImport([]).ok).toBe(false);
    expect(validateSaveImport({ version: 2, meta: { crests: 1 } }).ok).toBe(false);
    expect(validateSaveImport({ version: 1 }).ok).toBe(false);
    expect(validateSaveImport({ version: 1, meta: { crests: "lots" } }).ok).toBe(false);
    expect(validateSaveImport({ version: 1, meta: [] }).ok).toBe(false);
  });

  it("clamps hostile numbers instead of trashing progress", () => {
    const v = validateSaveImport({
      version: 1,
      meta: {
        crests: -50,
        totalRuns: Number.NaN,
        bestWave: Number.POSITIVE_INFINITY,
        ascensionUnlocked: 9999,
        highestAscensionCleared: -80,
      },
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.data.meta.crests).toBe(0);
    expect(v.data.meta.totalRuns).toBe(0);
    expect(v.data.meta.bestWave).toBe(0);
    expect(v.data.meta.ascensionUnlocked).toBe(MAX_ASCENSION);
    expect(v.data.meta.highestAscensionCleared).toBe(-1);
  });

  it("drops unknown ranks and caps known ones at their real ceiling", () => {
    const v = validateSaveImport({
      version: 1,
      meta: { crests: 10, ranks: { [UPGRADE.id]: 9999, totally_fake: 5 } },
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.data.meta.ranks[UPGRADE.id]).toBe(UPGRADE.maxRank);
    expect((v.data.meta.ranks as Record<string, number>).totally_fake).toBeUndefined();
  });

  it("keeps only true flags in boolean maps and ignores junk containers", () => {
    const v = validateSaveImport({
      version: 1,
      meta: {
        crests: 1,
        challengesCompleted: { a: true, b: "yes", c: 0 },
        mapsReachedWave12: "not-an-object",
      },
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.data.meta.challengesCompleted).toEqual({ a: true });
    expect(v.data.meta.mapsReachedWave12).toEqual({});
  });

  it("accepts a legacy export that only carries version + crests", () => {
    const res = applySaveImport({ version: 1, meta: { crests: 42 } } as never);
    expect(res.ok).toBe(true);
    expect(loadMetaStore().crests).toBe(42);
  });

  it("ignores a settings block that is not an object", () => {
    const v = validateSaveImport({ version: 1, meta: { crests: 5 }, settings: "dark-mode" });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.data.settings).toBeUndefined();
  });
});
