/**
 * Cheat sandbox profile — never mutates the real Barracks save while cheats are on.
 */

import { cheatsAllowedForPlayers, type PauseTarget } from "../game/pause";
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
  /** When cheats on: apply Barracks combat upgrades in Campaign fights. */
  barracksInCampaign: boolean;
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
  barracksInCampaign: false,
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

/**
 * Cheat flags are read from hot paths (per hit, per frame), so the parsed
 * options are cached and invalidated whenever they are written.
 */
let cheatCache: CheatOptions | null = null;

export function loadCheatOptions(): CheatOptions {
  if (cheatCache) return { ...cheatCache };
  let opts: CheatOptions;
  try {
    const raw = localStorage.getItem(CHEAT_OPTS);
    opts = raw
      ? { ...DEFAULT_CHEATS, ...(JSON.parse(raw) as Partial<CheatOptions>) }
      : { ...DEFAULT_CHEATS };
  } catch {
    opts = { ...DEFAULT_CHEATS };
  }
  cheatCache = opts;
  return { ...opts };
}

export function saveCheatOptions(opts: CheatOptions): void {
  cheatCache = { ...DEFAULT_CHEATS, ...opts };
  localStorage.setItem(CHEAT_OPTS, JSON.stringify(cheatCache));
}

/**
 * Gameplay-altering cheats (everything except "Unlock everything") are only
 * legal when a single human is playing — online or local. Mirrors the pause
 * policy in `game/pause.ts` so a cheating host can never affect other players.
 */
export function gameplayCheatsAllowed(target: PauseTarget): boolean {
  if (!areCheatsEnabled()) return false;
  return cheatsAllowedForPlayers(target);
}

/**
 * The single entry point every gameplay cheat check must use.
 * Returns null when cheats are off OR more than one human is participating.
 */
export function gameplayCheats(target: PauseTarget): CheatOptions | null {
  if (!gameplayCheatsAllowed(target)) return null;
  if (cheatCache) return cheatCache;
  return loadCheatOptions();
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

/** Drop the cached options (call after an external write, e.g. save import). */
export function invalidateCheatCache(): void {
  cheatCache = null;
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
