/** Build career delta from a finished run's GameState. */

import type { GameState } from "../game/state";
import type { RunStatDelta } from "./careerStats";

export function careerDeltaFromState(state: GameState, won: boolean): RunStatDelta {
  return {
    won,
    endless: state.endless,
    wave: state.wave,
    deaths: state.deathCount,
    ascension: state.ascension,
    heroId: state.hero.heroId,
    mapId: String(state.mapId),
    heroLevel: state.level,
    baseLevel: state.baseLevel,
    damageDealt: state.damageDealt,
    damageTaken: state.damageTaken,
    baseDamageTaken: state.baseDamageTaken,
    healingDone: state.healingDone,
    kills: state.kills,
    bossesKilled: state.bossesKilled,
    elitesKilled: state.elitesKilled,
    abilitiesCast: state.abilitiesCast,
    basicsFired: state.basicsFired,
    sends: state.sendsThisRun,
    shopBuys: state.shopBuys,
    chestsOpened: state.chestsOpened,
    artifactsPlaced: state.artifactsPlaced,
    levelDrafts: state.levelDraftsTaken,
    relicsCollected: state.relics.length,
    baseUpgrades: state.baseUpgrades,
    goldFromKills: state.goldFromKills,
    goldFromIncome: state.goldFromIncome,
    goldSpent: state.goldSpent,
    peakGold: state.peakGold,
    peakIncome: state.peakIncome,
    playTimeSec: state.elapsed,
  };
}
