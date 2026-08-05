/**
 * Mid-run / end-of-run challenges. Completing one unlocks a Barracks purchase
 * (content is not free-granted).
 */

import type { MetaUpgradeId } from "./upgrades";
import { getRank, loadMetaStore, saveMetaStore, type MetaStore } from "./store";

export type ChallengeId =
  | "austere_merchant"
  | "pacifist_purse"
  | "iron_lungs"
  | "boss_butcher"
  | "ascension_climber"
  | "chest_hunter"
  | "send_tycoon"
  | "base_architect"
  | "relic_hoarder"
  | "flawless_hold"
  | "speed_cleaver"
  | "artifact_engineer"
  | "wave_marathoner"
  | "elite_slayer"
  | "gold_miser"
  | "draft_master"
  | "lane_tourist"
  | "curse_initiate"
  | "dual_commander"
  | "legend_seeker"
  | "no_shop_win"
  | "high_ascent"
  | "chest_glutton"
  | "send_abstinence"
  | "deathless_boss"
  | "polarity_prodigy"
  | "time_keeper"
  | "swarm_lord"
  | "momentum_master"
  | "crest_siege";

export type ChallengeDef = {
  id: ChallengeId;
  name: string;
  blurb: string;
  /** Barracks unlock that becomes purchasable after completion. */
  unlocks: MetaUpgradeId;
  /** Flat Crests granted on first completion. */
  crestReward?: number;
  /** How progress is evaluated. */
  kind:
    | "win_no_sends"
    | "win_no_shop"
    | "win_deaths_le"
    | "win_ascension_ge"
    | "reach_wave"
    | "open_chests"
    | "buy_sends"
    | "base_level"
    | "own_relics"
    | "kill_bosses"
    | "kill_elites"
    | "place_artifacts"
    | "win_with_hero"
    | "win_team_size"
    | "finish_gold_le"
    | "level_drafts"
    | "visit_maps";
  threshold: number;
  /** Optional hero requirement for win_with_hero. */
  heroId?: string;
};

export const CHALLENGES: ChallengeDef[] = [
  {
    id: "austere_merchant",
    name: "Austere Merchant",
    blurb: "Win a run without buying any shop items.",
    unlocks: "unlock_challenge_items_a",
    kind: "win_no_shop",
    threshold: 1,
  },
  {
    id: "pacifist_purse",
    name: "Pacifist Purse",
    blurb: "Win without buying any sends.",
    unlocks: "unlock_challenge_items_b",
    kind: "win_no_sends",
    threshold: 1,
  },
  {
    id: "send_abstinence",
    name: "Send Abstinence",
    blurb: "Win on Ascension 3+ without buying sends.",
    unlocks: "unlock_challenge_relics_a",
    kind: "win_no_sends",
    threshold: 1,
  },
  {
    id: "iron_lungs",
    name: "Iron Lungs",
    blurb: "Win with 2 or fewer deaths.",
    unlocks: "unlock_challenge_relics_b",
    kind: "win_deaths_le",
    threshold: 2,
  },
  {
    id: "flawless_hold",
    name: "Flawless Hold",
    blurb: "Win without dying once.",
    unlocks: "unlock_challenge_relics_c",
    kind: "win_deaths_le",
    threshold: 0,
  },
  {
    id: "deathless_boss",
    name: "Deathless Boss",
    blurb: "Kill 3 bosses in a single run with ≤1 death.",
    unlocks: "unlock_challenge_maps_a",
    kind: "kill_bosses",
    threshold: 3,
  },
  {
    id: "boss_butcher",
    name: "Boss Butcher",
    blurb: "Defeat 5 bosses across a run (win or lose).",
    unlocks: "unlock_challenge_items_c",
    kind: "kill_bosses",
    threshold: 5,
  },
  {
    id: "elite_slayer",
    name: "Elite Slayer",
    blurb: "Kill 12 elites in one run.",
    unlocks: "unlock_challenge_relics_d",
    kind: "kill_elites",
    threshold: 12,
  },
  {
    id: "ascension_climber",
    name: "Ascension Climber",
    blurb: "Win on Ascension 4 or higher.",
    unlocks: "unlock_challenge_maps_b",
    kind: "win_ascension_ge",
    threshold: 4,
  },
  {
    id: "high_ascent",
    name: "High Ascent",
    blurb: "Win on Ascension 8 or higher.",
    unlocks: "unlock_challenge_items_h",
    kind: "win_ascension_ge",
    threshold: 8,
  },
  {
    id: "wave_marathoner",
    name: "Wave Marathoner",
    blurb: "Reach wave 20 in a single run.",
    unlocks: "unlock_challenge_items_d",
    kind: "reach_wave",
    threshold: 20,
  },
  {
    id: "chest_hunter",
    name: "Chest Hunter",
    blurb: "Open 8 chests in one run.",
    unlocks: "unlock_challenge_relics_e",
    kind: "open_chests",
    threshold: 8,
  },
  {
    id: "chest_glutton",
    name: "Chest Glutton",
    blurb: "Open 15 chests in one run.",
    unlocks: "unlock_challenge_maps_c",
    kind: "open_chests",
    threshold: 15,
  },
  {
    id: "send_tycoon",
    name: "Send Tycoon",
    blurb: "Buy 25 sends in one run.",
    unlocks: "unlock_challenge_sends_a",
    kind: "buy_sends",
    threshold: 25,
  },
  {
    id: "base_architect",
    name: "Base Architect",
    blurb: "Reach base level 8 in one run.",
    unlocks: "unlock_challenge_items_e",
    kind: "base_level",
    threshold: 8,
  },
  {
    id: "relic_hoarder",
    name: "Relic Hoarder",
    blurb: "Own 6 relics at once.",
    unlocks: "unlock_challenge_relics_f",
    kind: "own_relics",
    threshold: 6,
  },
  {
    id: "artifact_engineer",
    name: "Artifact Engineer",
    blurb: "Place 4 artifacts in one run.",
    unlocks: "unlock_challenge_sends_b",
    kind: "place_artifacts",
    threshold: 4,
  },
  {
    id: "gold_miser",
    name: "Gold Miser",
    blurb: "Win while holding ≤40 gold at the end.",
    unlocks: "unlock_challenge_items_f",
    kind: "finish_gold_le",
    threshold: 40,
  },
  {
    id: "draft_master",
    name: "Draft Master",
    blurb: "Complete 10 level-up drafts in one run.",
    unlocks: "unlock_challenge_relics_g",
    kind: "level_drafts",
    threshold: 10,
  },
  {
    id: "lane_tourist",
    name: "Lane Tourist",
    blurb: "Reach wave 12 on 3 different maps (tracked lifetime).",
    unlocks: "unlock_challenge_maps_d",
    kind: "visit_maps",
    threshold: 3,
  },
  {
    id: "no_shop_win",
    name: "Bare Hands",
    blurb: "Win without shopping on Ascension 2+.",
    unlocks: "unlock_challenge_relics_h",
    kind: "win_no_shop",
    threshold: 1,
  },
  {
    id: "dual_commander",
    name: "Dual Commander",
    blurb: "Win a 2v2 or 3v3 solo team run.",
    unlocks: "unlock_challenge_sends_c",
    kind: "win_team_size",
    threshold: 2,
  },
  {
    id: "curse_initiate",
    name: "Curse Initiate",
    blurb: "Win any run after unlocking Ascension 5.",
    unlocks: "unlock_curses",
    kind: "win_ascension_ge",
    threshold: 0,
  },
  {
    id: "legend_seeker",
    name: "Legend Seeker",
    blurb: "Reach wave 15 on Ascension 6+.",
    unlocks: "unlock_challenge_items_g",
    kind: "reach_wave",
    threshold: 15,
  },
  {
    id: "speed_cleaver",
    name: "Speed Cleaver",
    blurb: "Kill 8 elites in one run with ≤3 deaths.",
    unlocks: "unlock_challenge_relics_i",
    kind: "kill_elites",
    threshold: 8,
  },
  {
    id: "polarity_prodigy",
    name: "Polarity Prodigy",
    blurb: "Reach wave 16 in a single run.",
    unlocks: "unlock_lodestone",
    kind: "reach_wave",
    threshold: 16,
  },
  {
    id: "time_keeper",
    name: "Time Keeper",
    blurb: "Win with 1 or fewer deaths on Ascension 3+.",
    unlocks: "unlock_chrona",
    kind: "win_deaths_le",
    threshold: 1,
  },
  {
    id: "swarm_lord",
    name: "Swarm Lord",
    blurb: "Place 5 artifacts in one run.",
    unlocks: "unlock_hive",
    kind: "place_artifacts",
    threshold: 5,
  },
  {
    id: "momentum_master",
    name: "Momentum Master",
    blurb: "Reach wave 14 in a single run.",
    unlocks: "unlock_vector",
    kind: "reach_wave",
    threshold: 14,
  },
  {
    id: "crest_siege",
    name: "Crest Siege",
    blurb: "Reach wave 18 on Ascension 3+ with ≤4 deaths.",
    unlocks: "unlock_challenge_crests_a",
    crestReward: 85,
    kind: "reach_wave",
    threshold: 18,
  },
];

export type RunChallengeStats = {
  won: boolean;
  wave: number;
  deaths: number;
  ascension: number;
  sends: number;
  shopBuys: number;
  chestsOpened: number;
  bossesKilled: number;
  elitesKilled: number;
  artifactsPlaced: number;
  relicsOwned: number;
  baseLevel: number;
  gold: number;
  levelDrafts: number;
  mapId: string;
  teamSize: number;
  heroId: string;
};

export function isChallengeComplete(id: ChallengeId, store: MetaStore = loadMetaStore()): boolean {
  return Boolean(store.challengesCompleted?.[id]);
}

export function isBarracksUnlockAvailable(
  id: MetaUpgradeId,
  store: MetaStore = loadMetaStore(),
): boolean {
  const def = CHALLENGES.find((c) => c.unlocks === id);
  if (!def) return true;
  return isChallengeComplete(def.id, store) || getRank(store, id) >= 1;
}

function markComplete(store: MetaStore, id: ChallengeId): boolean {
  if (!store.challengesCompleted) store.challengesCompleted = {};
  if (store.challengesCompleted[id]) return false;
  store.challengesCompleted[id] = true;
  return true;
}

/** Evaluate challenges against end-of-run (and lifetime) stats. Returns newly completed ids. */
export function evaluateChallenges(stats: RunChallengeStats): ChallengeId[] {
  const store = loadMetaStore();
  if (!store.challengesCompleted) store.challengesCompleted = {};
  if (!store.mapsReachedWave12) store.mapsReachedWave12 = {};
  const newly: ChallengeId[] = [];

  if (stats.wave >= 12) {
    store.mapsReachedWave12[stats.mapId] = true;
  }
  const mapsVisited = Object.keys(store.mapsReachedWave12).length;

  for (const c of CHALLENGES) {
    if (store.challengesCompleted[c.id]) continue;
    let ok = false;
    switch (c.kind) {
      case "win_no_sends":
        ok =
          stats.won &&
          stats.sends === 0 &&
          (c.id !== "send_abstinence" || stats.ascension >= 3);
        break;
      case "win_no_shop":
        ok =
          stats.won &&
          stats.shopBuys === 0 &&
          (c.id !== "no_shop_win" || stats.ascension >= 2);
        break;
      case "win_deaths_le":
        ok = stats.won && stats.deaths <= c.threshold;
        if (c.id === "time_keeper") ok = stats.won && stats.deaths <= 1 && stats.ascension >= 3;
        break;
      case "win_ascension_ge":
        ok = stats.won && stats.ascension >= c.threshold;
        if (c.id === "curse_initiate") ok = stats.won && store.ascensionUnlocked >= 5;
        break;
      case "reach_wave":
        ok = stats.wave >= c.threshold;
        if (c.id === "legend_seeker") ok = stats.wave >= 15 && stats.ascension >= 6;
        if (c.id === "crest_siege")
          ok = stats.wave >= 18 && stats.ascension >= 3 && stats.deaths <= 4;
        break;
      case "open_chests":
        ok = stats.chestsOpened >= c.threshold;
        break;
      case "buy_sends":
        ok = stats.sends >= c.threshold;
        break;
      case "base_level":
        ok = stats.baseLevel >= c.threshold;
        break;
      case "own_relics":
        ok = stats.relicsOwned >= c.threshold;
        break;
      case "kill_bosses":
        ok = stats.bossesKilled >= c.threshold;
        if (c.id === "deathless_boss") ok = stats.bossesKilled >= 3 && stats.deaths <= 1;
        break;
      case "kill_elites":
        ok = stats.elitesKilled >= c.threshold;
        if (c.id === "speed_cleaver") ok = stats.elitesKilled >= 8 && stats.deaths <= 3;
        break;
      case "place_artifacts":
        ok = stats.artifactsPlaced >= c.threshold;
        break;
      case "finish_gold_le":
        ok = stats.won && stats.gold <= c.threshold;
        break;
      case "level_drafts":
        ok = stats.levelDrafts >= c.threshold;
        break;
      case "visit_maps":
        ok = mapsVisited >= c.threshold;
        break;
      case "win_team_size":
        ok = stats.won && stats.teamSize >= c.threshold;
        break;
      case "win_with_hero":
        ok = stats.won && stats.heroId === c.heroId;
        break;
      default:
        break;
    }
    if (ok && markComplete(store, c.id)) {
      if (c.crestReward && c.crestReward > 0) {
        store.crests += c.crestReward;
        store.lifetimeCrests = (store.lifetimeCrests ?? 0) + c.crestReward;
      }
      newly.push(c.id);
    }
  }

  if (newly.length) saveMetaStore(store);
  else saveMetaStore(store); // persist map visit progress
  return newly;
}

export function challengeProgressHint(c: ChallengeDef, store: MetaStore = loadMetaStore()): string {
  if (isChallengeComplete(c.id, store)) return "Complete — buy reward in Barracks";
  if (c.kind === "visit_maps") {
    const n = Object.keys(store.mapsReachedWave12 ?? {}).length;
    return `Maps at wave 12+: ${n}/${c.threshold}`;
  }
  return "Incomplete";
}
