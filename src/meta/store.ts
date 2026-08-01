/**
 * Persist War Crests, Barracks ranks, Ascension unlock, run stats, challenges.
 */

import { MAX_ASCENSION } from "./ascension";
import { META_UPGRADES, nextCost, type MetaUpgradeId } from "./upgrades";
import type { MetaRanks } from "./modifiers";
import type { HeroId } from "../data/heroes";
import type { ChallengeId } from "./challenges";
import { areCheatsEnabled, loadCheatOptions } from "./cheats";
import {
  applyRunToCareer,
  EMPTY_CAREER,
  normalizeCareer,
  type CareerStats,
  type RunStatDelta,
} from "./careerStats";

const STORE_KEY = "hlw-meta-v1";

export type MetaStore = {
  crests: number;
  ranks: MetaRanks;
  /** Highest Ascension the player may select (0..MAX). */
  ascensionUnlocked: number;
  /** Highest Ascension cleared with a win. */
  highestAscensionCleared: number;
  totalWins: number;
  totalRuns: number;
  bestWave: number;
  lifetimeCrests: number;
  /** Completed challenge ids. */
  challengesCompleted?: Partial<Record<ChallengeId, boolean>>;
  /** Maps where player reached wave 12+. */
  mapsReachedWave12?: Record<string, boolean>;
  /** Detailed lifetime career stats. */
  career?: CareerStats;
};

const DEFAULT: MetaStore = {
  crests: 20,
  ranks: {},
  ascensionUnlocked: 0,
  highestAscensionCleared: -1,
  totalWins: 0,
  totalRuns: 0,
  bestWave: 0,
  lifetimeCrests: 0,
  challengesCompleted: {},
  mapsReachedWave12: {},
  career: structuredClone(EMPTY_CAREER),
};

export function loadMetaStore(): MetaStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return structuredClone(DEFAULT);
    const parsed = JSON.parse(raw) as Partial<MetaStore>;
    const career = normalizeCareer(parsed.career);
    // Backfill career from legacy counters if empty
    if (career.runs === 0 && (parsed.totalRuns ?? 0) > 0) {
      career.runs = parsed.totalRuns ?? 0;
      career.wins = parsed.totalWins ?? 0;
      career.losses = Math.max(0, career.runs - career.wins);
      career.bestWave = parsed.bestWave ?? 0;
    }
    return {
      ...DEFAULT,
      ...parsed,
      ranks: { ...DEFAULT.ranks, ...(parsed.ranks ?? {}) },
      ascensionUnlocked: Math.max(0, Math.min(MAX_ASCENSION, parsed.ascensionUnlocked ?? 0)),
      highestAscensionCleared: parsed.highestAscensionCleared ?? -1,
      challengesCompleted: { ...(parsed.challengesCompleted ?? {}) },
      mapsReachedWave12: { ...(parsed.mapsReachedWave12 ?? {}) },
      career,
    };
  } catch {
    return structuredClone(DEFAULT);
  }
}

export function saveMetaStore(store: MetaStore): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function getRank(store: MetaStore, id: MetaUpgradeId): number {
  return store.ranks[id] ?? 0;
}

const HERO_UNLOCK: Partial<Record<HeroId, MetaUpgradeId>> = {
  coil: "unlock_coil",
  thorn: "unlock_thorn",
  wizard: "unlock_chaos",
  ember: "unlock_ember",
  void: "unlock_void",
  titan: "unlock_titan",
  mirage: "unlock_mirage",
  medic: "unlock_medic",
  tempest: "unlock_tempest",
  curses: "unlock_curses",
  warp: "unlock_warp",
  gyro: "unlock_gyro",
  lodestone: "unlock_lodestone",
  chrona: "unlock_chrona",
  hive: "unlock_hive",
  gunner: "unlock_gunner",
  sapper: "unlock_sapper",
  vector: "unlock_vector",
};

export function isHeroUnlocked(heroId: HeroId, store: MetaStore = loadMetaStore()): boolean {
  if (areCheatsEnabled() && loadCheatOptions().unlockAll) return true;
  const key = HERO_UNLOCK[heroId];
  if (!key) return true;
  return getRank(store, key) >= 1;
}

/** Challenge-locked content packs purchased in Barracks. */
export function isContentPackUnlocked(
  pack: MetaUpgradeId,
  store: MetaStore = loadMetaStore(),
): boolean {
  if (areCheatsEnabled() && loadCheatOptions().unlockAll) return true;
  return getRank(store, pack) >= 1;
}

export function purchaseUpgrade(id: MetaUpgradeId): { ok: boolean; message: string; store: MetaStore } {
  const store = loadMetaStore();
  const def = META_UPGRADES.find((u) => u.id === id);
  if (!def) return { ok: false, message: "Unknown upgrade", store };

  // Challenge-gated unlocks require the challenge first
  if (def.requiresChallenge) {
    const done = store.challengesCompleted?.[def.requiresChallenge as import("./challenges").ChallengeId];
    if (!done && getRank(store, id) < 1) {
      return { ok: false, message: "Complete the linked challenge first", store };
    }
  }

  const cur = getRank(store, id);
  const cost = nextCost(id, cur);
  if (cost == null) return { ok: false, message: "Max rank", store };
  if (store.crests < cost) return { ok: false, message: `Need ${cost} crests`, store };
  store.crests -= cost;
  store.ranks[id] = cur + 1;
  saveMetaStore(store);
  return { ok: true, message: `${def.name} → rank ${cur + 1}`, store };
}

export type RunPayoutInput = {
  won: boolean;
  wave: number;
  sends: number;
  ascension: number;
  deaths: number;
  unlimited: boolean;
  crestGainMul?: number;
  /** When present, merges into lifetime career stats. */
  careerDelta?: RunStatDelta;
};

export type RunPayout = {
  crests: number;
  unlockedAscension: number | null;
  breakdown: string[];
};

/** Crests earned from a finished solo (or solo-vs-AI) run. */
export function computeRunPayout(input: RunPayoutInput): RunPayout {
  const breakdown: string[] = [];
  let crests = input.won ? 22 : 7;
  breakdown.push(input.won ? `Victory +22` : `Defeat +7`);

  const waveBonus = Math.floor(input.wave * 1.4);
  if (waveBonus > 0) {
    crests += waveBonus;
    breakdown.push(`Waves +${waveBonus}`);
  }

  const sendBonus = Math.floor(input.sends * 0.35);
  if (sendBonus > 0) {
    crests += sendBonus;
    breakdown.push(`Sends +${sendBonus}`);
  }

  if (input.deaths === 0 && input.won) {
    crests += 6;
    breakdown.push(`Flawless +6`);
  }

  if (input.unlimited && input.won) {
    crests += 8;
    breakdown.push(`Unlimited clear +8`);
  }

  const ascMul = 1 + input.ascension * 0.22;
  if (input.ascension > 0) {
    const before = crests;
    crests = Math.round(crests * ascMul);
    breakdown.push(`A${input.ascension} ×${ascMul.toFixed(2)} (+${crests - before})`);
  }

  const forgeMul = input.crestGainMul ?? 1;
  if (forgeMul > 1.001) {
    const before = crests;
    crests = Math.round(crests * forgeMul);
    breakdown.push(`Crest Forge ×${forgeMul.toFixed(2)} (+${crests - before})`);
  }

  return { crests, unlockedAscension: null, breakdown };
}

export function applyRunPayout(input: RunPayoutInput): RunPayout & { store: MetaStore } {
  const store = loadMetaStore();
  const payout = computeRunPayout(input);
  store.crests += payout.crests;
  store.lifetimeCrests += payout.crests;
  store.totalRuns += 1;
  store.bestWave = Math.max(store.bestWave, input.wave);
  if (input.won) {
    store.totalWins += 1;
    if (input.ascension > store.highestAscensionCleared) {
      store.highestAscensionCleared = input.ascension;
    }
    if (input.ascension >= store.ascensionUnlocked && store.ascensionUnlocked < MAX_ASCENSION) {
      store.ascensionUnlocked = Math.min(MAX_ASCENSION, input.ascension + 1);
      payout.unlockedAscension = store.ascensionUnlocked;
      payout.breakdown.push(`Unlocked Ascension ${store.ascensionUnlocked}`);
    }
  }
  if (input.careerDelta) {
    store.career = applyRunToCareer(normalizeCareer(store.career), input.careerDelta);
    // Keep legacy fields in sync with career
    store.totalRuns = store.career.runs;
    store.totalWins = store.career.wins;
    store.bestWave = Math.max(store.bestWave, store.career.bestWave);
  }
  saveMetaStore(store);
  return { ...payout, store };
}

export function getCareerStats(store: MetaStore = loadMetaStore()): CareerStats {
  return normalizeCareer(store.career);
}
