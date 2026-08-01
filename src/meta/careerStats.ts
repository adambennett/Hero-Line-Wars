/**
 * Lifetime career statistics — aggregated at end of each run.
 */

export type CareerStats = {
  /** Seconds of active run time. */
  playTimeSec: number;
  runs: number;
  wins: number;
  losses: number;
  endlessRuns: number;
  endlessBestWave: number;
  flawlessWins: number;

  damageDealt: number;
  damageTaken: number;
  baseDamageTaken: number;
  healingDone: number;
  kills: number;
  bossesKilled: number;
  elitesKilled: number;
  deaths: number;

  abilitiesCast: number;
  basicsFired: number;
  sends: number;
  shopBuys: number;
  chestsOpened: number;
  artifactsPlaced: number;
  levelDrafts: number;
  relicsCollected: number;
  baseUpgrades: number;

  goldFromKills: number;
  goldFromIncome: number;
  goldSpent: number;
  peakGold: number;
  peakIncome: number;

  wavesCleared: number;
  bestWave: number;
  highestHeroLevel: number;
  highestBaseLevel: number;
  highestAscensionPlayed: number;

  /** Runs started per hero id. */
  heroRuns: Record<string, number>;
  /** Wins per hero id. */
  heroWins: Record<string, number>;
  /** Runs per map id. */
  mapRuns: Record<string, number>;
  /** Best wave reached per map. */
  mapBestWave: Record<string, number>;
};

export type RunStatDelta = {
  won: boolean;
  endless: boolean;
  wave: number;
  deaths: number;
  ascension: number;
  heroId: string;
  mapId: string;
  heroLevel: number;
  baseLevel: number;
  damageDealt: number;
  damageTaken: number;
  baseDamageTaken: number;
  healingDone: number;
  kills: number;
  bossesKilled: number;
  elitesKilled: number;
  abilitiesCast: number;
  basicsFired: number;
  sends: number;
  shopBuys: number;
  chestsOpened: number;
  artifactsPlaced: number;
  levelDrafts: number;
  relicsCollected: number;
  baseUpgrades: number;
  goldFromKills: number;
  goldFromIncome: number;
  goldSpent: number;
  peakGold: number;
  peakIncome: number;
  playTimeSec: number;
};

export const EMPTY_CAREER: CareerStats = {
  playTimeSec: 0,
  runs: 0,
  wins: 0,
  losses: 0,
  endlessRuns: 0,
  endlessBestWave: 0,
  flawlessWins: 0,
  damageDealt: 0,
  damageTaken: 0,
  baseDamageTaken: 0,
  healingDone: 0,
  kills: 0,
  bossesKilled: 0,
  elitesKilled: 0,
  deaths: 0,
  abilitiesCast: 0,
  basicsFired: 0,
  sends: 0,
  shopBuys: 0,
  chestsOpened: 0,
  artifactsPlaced: 0,
  levelDrafts: 0,
  relicsCollected: 0,
  baseUpgrades: 0,
  goldFromKills: 0,
  goldFromIncome: 0,
  goldSpent: 0,
  peakGold: 0,
  peakIncome: 0,
  wavesCleared: 0,
  bestWave: 0,
  highestHeroLevel: 0,
  highestBaseLevel: 0,
  highestAscensionPlayed: 0,
  heroRuns: {},
  heroWins: {},
  mapRuns: {},
  mapBestWave: {},
};

export function normalizeCareer(raw: Partial<CareerStats> | undefined): CareerStats {
  const c = { ...EMPTY_CAREER, ...(raw ?? {}) };
  c.heroRuns = { ...(raw?.heroRuns ?? {}) };
  c.heroWins = { ...(raw?.heroWins ?? {}) };
  c.mapRuns = { ...(raw?.mapRuns ?? {}) };
  c.mapBestWave = { ...(raw?.mapBestWave ?? {}) };
  return c;
}

export function applyRunToCareer(career: CareerStats, d: RunStatDelta): CareerStats {
  const c = normalizeCareer(career);
  c.runs += 1;
  c.playTimeSec += Math.max(0, d.playTimeSec);
  c.wavesCleared += Math.max(0, d.wave);
  c.bestWave = Math.max(c.bestWave, d.wave);
  c.highestHeroLevel = Math.max(c.highestHeroLevel, d.heroLevel);
  c.highestBaseLevel = Math.max(c.highestBaseLevel, d.baseLevel);
  c.highestAscensionPlayed = Math.max(c.highestAscensionPlayed, d.ascension);

  if (d.endless) {
    c.endlessRuns += 1;
    c.endlessBestWave = Math.max(c.endlessBestWave, d.wave);
  }
  if (d.won) {
    c.wins += 1;
    if (d.deaths === 0) c.flawlessWins += 1;
    c.heroWins[d.heroId] = (c.heroWins[d.heroId] ?? 0) + 1;
  } else {
    c.losses += 1;
  }

  c.damageDealt += d.damageDealt;
  c.damageTaken += d.damageTaken;
  c.baseDamageTaken += d.baseDamageTaken;
  c.healingDone += d.healingDone;
  c.kills += d.kills;
  c.bossesKilled += d.bossesKilled;
  c.elitesKilled += d.elitesKilled;
  c.deaths += d.deaths;
  c.abilitiesCast += d.abilitiesCast;
  c.basicsFired += d.basicsFired;
  c.sends += d.sends;
  c.shopBuys += d.shopBuys;
  c.chestsOpened += d.chestsOpened;
  c.artifactsPlaced += d.artifactsPlaced;
  c.levelDrafts += d.levelDrafts;
  c.relicsCollected += d.relicsCollected;
  c.baseUpgrades += d.baseUpgrades;
  c.goldFromKills += d.goldFromKills;
  c.goldFromIncome += d.goldFromIncome;
  c.goldSpent += d.goldSpent;
  c.peakGold = Math.max(c.peakGold, d.peakGold);
  c.peakIncome = Math.max(c.peakIncome, d.peakIncome);

  c.heroRuns[d.heroId] = (c.heroRuns[d.heroId] ?? 0) + 1;
  c.mapRuns[d.mapId] = (c.mapRuns[d.mapId] ?? 0) + 1;
  c.mapBestWave[d.mapId] = Math.max(c.mapBestWave[d.mapId] ?? 0, d.wave);
  return c;
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
}

export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(2)}k`;
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

export function winRate(c: CareerStats): number {
  if (c.runs <= 0) return 0;
  return (c.wins / c.runs) * 100;
}

export function topEntries(
  record: Record<string, number>,
  limit = 5,
): { id: string; value: number }[] {
  return Object.entries(record)
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}
