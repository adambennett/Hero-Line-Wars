/**
 * Cheat sandbox profile — never mutates the real Barracks save while cheats are on.
 */

import { loadMetaStore, saveMetaStore, type MetaStore } from "./store";

const CHEAT_FLAG = "hlw-cheats-enabled-v1";
const REAL_CACHE = "hlw-meta-real-cache-v1";
const CHEAT_PROFILE = "hlw-meta-cheat-v1";
const CHEAT_OPTS = "hlw-cheat-options-v1";

export type CheatOptions = {
  unlockAll: boolean;
  infiniteGold: boolean;
  godMode: boolean;
  skipWaves: boolean;
  forceChest: boolean;
  infiniteRerolls: boolean;
  oneShot: boolean;
  freeShop: boolean;
  revealFog: boolean;
};

const DEFAULT_CHEATS: CheatOptions = {
  unlockAll: false,
  infiniteGold: false,
  godMode: false,
  skipWaves: false,
  forceChest: false,
  infiniteRerolls: false,
  oneShot: false,
  freeShop: false,
  revealFog: false,
};

function emptyCheatMeta(): MetaStore {
  return {
    crests: 9999,
    ranks: {},
    ascensionUnlocked: 15,
    highestAscensionCleared: 15,
    totalWins: 0,
    totalRuns: 0,
    bestWave: 0,
    lifetimeCrests: 0,
    challengesCompleted: {},
    mapsReachedWave12: {},
    career: undefined,
  };
}

export function areCheatsEnabled(): boolean {
  return localStorage.getItem(CHEAT_FLAG) === "1";
}

export function loadCheatOptions(): CheatOptions {
  try {
    const raw = localStorage.getItem(CHEAT_OPTS);
    if (!raw) return { ...DEFAULT_CHEATS };
    return { ...DEFAULT_CHEATS, ...(JSON.parse(raw) as Partial<CheatOptions>) };
  } catch {
    return { ...DEFAULT_CHEATS };
  }
}

export function saveCheatOptions(opts: CheatOptions): void {
  localStorage.setItem(CHEAT_OPTS, JSON.stringify(opts));
}

/** Enable cheats: cache real profile, swap in sandbox cheat profile. */
export function enableCheats(): void {
  if (areCheatsEnabled()) return;
  const real = loadMetaStore();
  localStorage.setItem(REAL_CACHE, JSON.stringify(real));
  let cheat: MetaStore;
  try {
    const raw = localStorage.getItem(CHEAT_PROFILE);
    cheat = raw ? (JSON.parse(raw) as MetaStore) : emptyCheatMeta();
  } catch {
    cheat = emptyCheatMeta();
  }
  // Unlock-all option applied lazily via getters; seed crests high
  if (cheat.crests < 500) cheat.crests = 9999;
  saveMetaStore(cheat);
  localStorage.setItem(CHEAT_FLAG, "1");
}

/** Disable cheats: persist sandbox, restore cached real profile. */
export function disableCheats(): void {
  if (!areCheatsEnabled()) return;
  const cheat = loadMetaStore();
  localStorage.setItem(CHEAT_PROFILE, JSON.stringify(cheat));
  try {
    const raw = localStorage.getItem(REAL_CACHE);
    if (raw) {
      saveMetaStore(JSON.parse(raw) as MetaStore);
    }
  } catch {
    /* keep current if cache corrupt — better than wipe */
  }
  localStorage.removeItem(CHEAT_FLAG);
}

export function setCheatsEnabled(on: boolean): void {
  if (on) enableCheats();
  else disableCheats();
}

export function updateCheatOption<K extends keyof CheatOptions>(key: K, value: CheatOptions[K]): void {
  const opts = loadCheatOptions();
  opts[key] = value;
  saveCheatOptions(opts);
}
