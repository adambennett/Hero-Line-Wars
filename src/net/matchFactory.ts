import type { NeuralLaneAi } from "../ai/runtime";
import { HERO_LIST, type HeroId } from "../data/heroes";
import { resolveMapChoice, type MapId, mapRespawn } from "../data/maps";
import { resolveHero } from "../custom/registry";
import { createState, type GameState, type HeroRuntime } from "../game/state";
import { gunnerWeaponAt } from "../data/gunnerWeapons";
import { composeRunModifiers } from "../meta/modifiers";
import { isPveMode, type LobbyState, type MatchMode, type MpTeam } from "./types";
import { captureBagFromState, createPlayerBag, ensureLaneBags } from "./playerBag";

export type MpMatch = {
  mode: MatchMode;
  mapId: MapId | string;
  maxTurrets: number;
  seed: number;
  /** Team 0 / Team 1 lanes. PvE: team 1 is AI-controlled. */
  lanes: [GameState, GameState];
  mySlot: number;
  myTeam: MpTeam;
  viewTeam: MpTeam;
  ended: boolean;
  winnerTeam: MpTeam | null;
  /** Optional neural controllers per lane (null = scripted if aiControlled). */
  laneAi: [NeuralLaneAi | null, NeuralLaneAi | null];
  /** Offline solo vs real AI lane (no PeerJS). */
  soloOffline?: boolean;
  /** Display name for opponent panel. */
  opponentLabel?: string;
};

function makeHeroRuntime(
  heroId: HeroId,
  x: number,
  y: number,
  id: number,
  slot: number | null,
): HeroRuntime {
  const def = resolveHero(heroId);
  return {
    id,
    heroId,
    x,
    y,
    hp: def.maxHp,
    maxHp: def.maxHp,
    radius: def.radius,
    alive: true,
    attackCd: 0,
    abilityCds: def.abilities.map(() => 0),
    speedBonus: 0,
    damageBonus: 0,
    attackSpeedMul: 1,
    killGoldBonus: 0,
    barrierTimer: 0,
    whirlwindTimer: 0,
    luck: 0,
    marksmanTimer: 0,
    chaosIndex: 0,
    controllerSlot: slot,
    hiveDrones: heroId === "hive" ? 0 : undefined,
    gunnerWeaponIndex: heroId === "gunner" ? 0 : undefined,
    gunnerAmmo: heroId === "gunner" ? gunnerWeaponAt(0).clip : undefined,
    gunnerReload: 0,
    gunnerWeaponCd: 0,
    gunnerAiming: false,
    gunnerAimTime: 0,
    gunnerSpin: 0,
    gunnerCharge: 0,
    gunnerSwapCd: 0,
    gunnerSelfDamageFlash: 0,
    momentum: heroId === "vector" ? 0 : undefined,
  };
}

function populateLane(
  state: GameState,
  seats: { slot: number; heroId: HeroId }[],
  nextIdStart: number,
): void {
  if (seats.length === 0) return;
  const primary = seats[0]!;
  const pad = mapRespawn(state.map);
  state.hero = makeHeroRuntime(primary.heroId, pad.x, pad.y, 0, primary.slot);
  state.allies = [];
  let nid = nextIdStart;
  for (let i = 1; i < seats.length; i++) {
    const s = seats[i]!;
    const offset = (i - (seats.length - 1) / 2) * 36;
    state.allies.push(makeHeroRuntime(s.heroId, pad.x, pad.y + offset, nid++, s.slot));
  }
  state.nextId = Math.max(state.nextId, nid);

  // Independent economy per controller on shared physical lane
  state.playerBags = {};
  const heroes = [state.hero, ...state.allies];
  ensureLaneBags(state, heroes);
  for (const h of heroes) {
    const slot = h.controllerSlot;
    if (slot == null) continue;
    const key = String(slot);
    if (h === state.hero) {
      state.playerBags[key] = captureBagFromState(state);
    } else {
      state.playerBags[key] = createPlayerBag(state);
    }
  }
  state.activeBagKey = String(primary.slot);
}

export function buildMpMatch(
  lobby: LobbyState,
  mapId: MapId | string,
  maxTurrets: number,
  seed: number,
  mySlot: number,
  runOpts?: {
    startingGold?: number;
    wavesToWin?: number;
    friendlyFire?: boolean;
    utilityDraftLevel?: number;
  },
): MpMatch {
  const resolved = resolveMapChoice(mapId);
  const team0 = lobby.slots.filter((s) => s.team === 0).sort((a, b) => a.slot - b.slot);
  const team1Human = lobby.slots.filter((s) => s.team === 1).sort((a, b) => a.slot - b.slot);

  const ascension = lobby.ascension ?? 0;
  const humanPlayers = Math.max(1, lobby.slots.length);
  const sharedOpts = {
    humanPlayers,
    mapId: resolved,
    maxTurrets,
    startingGold: runOpts?.startingGold ?? lobby.startingGold,
    wavesToWin: runOpts?.wavesToWin ?? lobby.wavesToWin,
    friendlyFire: runOpts?.friendlyFire ?? lobby.friendlyFire,
    utilityDraftLevel:
      runOpts?.utilityDraftLevel ?? lobby.utilityDraftLevel ?? 10,
    ascension,
    livesPerWave: lobby.livesPerWave ?? 0,
    livesPerRun: lobby.livesPerRun ?? 0,
    chestOpenMul: lobby.chestOpenMul,
    chestDespawnSec: lobby.chestDespawnSec,
    chestSpawnChance: lobby.chestSpawnChance,
    enemyDensityMul: lobby.enemyDensityMul,
    enemyHpMul: lobby.enemyHpMul,
    enemySpeedMul: lobby.enemySpeedMul,
    incomeMul: lobby.incomeMul,
    respawnMul: lobby.respawnMul,
    startingBaseLevel: lobby.startingBaseLevel,
    levelDraftSize: lobby.levelDraftSize,
    relicDraftSize: lobby.relicDraftSize,
    disableArtifacts: lobby.disableArtifacts,
    disableChests: lobby.disableChests,
    disableElites: lobby.disableElites,
    disableBosses: lobby.disableBosses,
    disableShop: lobby.disableShop,
    disableSends: lobby.disableSends,
    disableRelics: lobby.disableRelics,
    fogAlways: lobby.fogAlways,
    fogThicknessPct: lobby.fogThicknessPct,
    fogVisionRadius: lobby.fogVisionRadius,
    doubleElites: lobby.doubleElites,
    suddenDeathBaseHp: lobby.suddenDeathBaseHp && lobby.suddenDeathBaseHp > 0
      ? lobby.suddenDeathBaseHp
      : undefined,
    glassCannon: lobby.glassCannon,
    goldRush: lobby.goldRush,
    wildChests: lobby.wildChests,
    crampedLane: lobby.crampedLane,
  };

  const lane0 = createState(team0[0]?.heroId ?? "ranger", {
    ...sharedOpts,
    modifiers: composeRunModifiers(ascension, {}, true),
  });
  lane0.mpLane = true;
  populateLane(
    lane0,
    team0.map((s) => ({ slot: s.slot, heroId: s.heroId })),
    10,
  );

  let lane1: GameState;
  if (isPveMode(lobby.mode)) {
    const aiHero = HERO_LIST[Math.floor(seed % HERO_LIST.length)]!.id;
    lane1 = createState(aiHero, {
      ...sharedOpts,
      modifiers: composeRunModifiers(ascension, {}, false),
    });
    lane1.mpLane = true;
    lane1.aiControlled = true;
    populateLane(lane1, [{ slot: -1, heroId: aiHero }], 20);
  } else {
    lane1 = createState(team1Human[0]?.heroId ?? "warden", {
      ...sharedOpts,
      modifiers: composeRunModifiers(ascension, {}, true),
    });
    lane1.mpLane = true;
    populateLane(
      lane1,
      team1Human.map((s) => ({ slot: s.slot, heroId: s.heroId })),
      20,
    );
  }

  lane0.viewOpponentLane = false;
  lane1.viewOpponentLane = false;
  // Every lobby seat is a human; AI lanes/allies never take a seat.
  setMatchHumanPlayers([lane0, lane1], humanPlayers);

  const mySeat = lobby.slots.find((s) => s.slot === mySlot);
  const myTeam = (mySeat?.team ?? 0) as MpTeam;

  return {
    mode: lobby.mode,
    mapId: resolved,
    maxTurrets,
    seed,
    lanes: [lane0, lane1],
    mySlot,
    myTeam,
    viewTeam: myTeam,
    ended: false,
    winnerTeam: null,
    laneAi: [null, null],
  };
}

/** Offline dual-lane: human on team 0, AI on team 1 (classic scripted or neural). */
export function buildSoloVsAiMatch(opts: {
  playerHeroId: HeroId;
  aiHeroId?: HeroId;
  mapId: MapId | string | "random";
  maxTurrets: number;
  seed: number;
  startingGold: number;
  wavesToWin: number;
  friendlyFire: boolean;
  neural?: NeuralLaneAi | null;
  opponentLabel?: string;
  playerModifiers?: import("../meta/modifiers").RunModifiers;
  enemyModifiers?: import("../meta/modifiers").RunModifiers;
  teamSize?: 1 | 2 | 3;
  chestOpenMul?: number;
  chestDespawnSec?: number;
  chestSpawnChance?: number;
  utilityDraftLevel?: number;
  livesPerWave?: number;
  livesPerRun?: number;
  enemyDensityMul?: number;
  enemyHpMul?: number;
  enemySpeedMul?: number;
  incomeMul?: number;
  respawnMul?: number;
  startingBaseLevel?: number;
  levelDraftSize?: number;
  relicDraftSize?: number;
  disableArtifacts?: boolean;
  disableChests?: boolean;
  disableElites?: boolean;
  disableBosses?: boolean;
  disableShop?: boolean;
  disableSends?: boolean;
  disableRelics?: boolean;
  fogAlways?: boolean;
  fogThicknessPct?: number;
  fogVisionRadius?: number;
  doubleElites?: boolean;
  suddenDeathBaseHp?: number;
  glassCannon?: boolean;
  goldRush?: boolean;
  wildChests?: boolean;
  crampedLane?: boolean;
}): MpMatch {
  const resolved = resolveMapChoice(opts.mapId);
  const teamSize = opts.teamSize ?? 1;
  const pool = HERO_LIST.filter((h) => h.id !== opts.playerHeroId);
  const pickAi = (i: number) =>
    (pool.length ? pool : HERO_LIST)[(opts.seed + i * 17) % (pool.length || HERO_LIST.length)]!.id;
  const aiHero = opts.aiHeroId ?? pickAi(0);

  const sharedBase = {
    mapId: resolved,
    maxTurrets: opts.maxTurrets,
    startingGold: opts.startingGold,
    wavesToWin: opts.wavesToWin,
    friendlyFire: opts.friendlyFire,
    teamSize,
    chestOpenMul: opts.chestOpenMul,
    chestDespawnSec: opts.chestDespawnSec,
    chestSpawnChance: opts.chestSpawnChance,
    utilityDraftLevel: opts.utilityDraftLevel ?? 10,
    livesPerWave: opts.livesPerWave ?? 0,
    livesPerRun: opts.livesPerRun ?? 0,
    enemyDensityMul: opts.enemyDensityMul,
    enemyHpMul: opts.enemyHpMul,
    enemySpeedMul: opts.enemySpeedMul,
    incomeMul: opts.incomeMul,
    respawnMul: opts.respawnMul,
    startingBaseLevel: opts.startingBaseLevel,
    levelDraftSize: opts.levelDraftSize,
    relicDraftSize: opts.relicDraftSize,
    disableArtifacts: opts.disableArtifacts,
    disableChests: opts.disableChests,
    disableElites: opts.disableElites,
    disableBosses: opts.disableBosses,
    disableShop: opts.disableShop,
    disableSends: opts.disableSends,
    disableRelics: opts.disableRelics,
    fogAlways: opts.fogAlways,
    fogThicknessPct: opts.fogThicknessPct,
    fogVisionRadius: opts.fogVisionRadius,
    doubleElites: opts.doubleElites,
    suddenDeathBaseHp: opts.suddenDeathBaseHp && opts.suddenDeathBaseHp > 0
      ? opts.suddenDeathBaseHp
      : undefined,
    glassCannon: opts.glassCannon,
    goldRush: opts.goldRush,
    wildChests: opts.wildChests,
    crampedLane: opts.crampedLane,
  };

  const lane0 = createState(opts.playerHeroId, {
    ...sharedBase,
    modifiers: opts.playerModifiers,
    ascension: opts.playerModifiers?.ascension ?? 0,
  });
  lane0.mpLane = true;
  const playerSeats = [{ slot: 0, heroId: opts.playerHeroId }];
  for (let i = 1; i < teamSize; i++) {
    // Negative slots = AI allies (scripted intents in mpSim)
    playerSeats.push({ slot: -10 - i, heroId: pickAi(i + 3) });
  }
  populateLane(lane0, playerSeats, 10);

  const lane1 = createState(aiHero, {
    ...sharedBase,
    modifiers: opts.enemyModifiers,
    ascension: opts.enemyModifiers?.ascension ?? opts.playerModifiers?.ascension ?? 0,
  });
  lane1.mpLane = true;
  lane1.aiControlled = true;
  const enemySeats = [{ slot: -1, heroId: aiHero }];
  for (let i = 1; i < teamSize; i++) {
    enemySeats.push({ slot: -20 - i, heroId: pickAi(i + 7) });
  }
  populateLane(lane1, enemySeats, 20);

  lane0.viewOpponentLane = false;
  lane1.viewOpponentLane = false;
  // Offline solo run — pausing and cheats stay legal even though it uses mpSim.
  setMatchHumanPlayers([lane0, lane1], 1);

  return {
    mode: teamSize >= 3 ? "3v3" : teamSize === 2 ? "2v2" : "1v1",
    mapId: resolved,
    maxTurrets: opts.maxTurrets,
    seed: opts.seed,
    lanes: [lane0, lane1],
    mySlot: 0,
    myTeam: 0,
    viewTeam: 0,
    ended: false,
    winnerTeam: null,
    laneAi: [null, opts.neural ?? null],
    soloOffline: true,
    opponentLabel: opts.opponentLabel,
  };
}

/**
 * Stamp the human head-count onto both lanes. `game/pause.ts` reads it, so this
 * is what decides whether the match may pause and whether cheats apply.
 */
export function setMatchHumanPlayers(lanes: GameState[], humans: number): void {
  const n = Math.max(1, Math.floor(humans));
  for (const lane of lanes) lane.humanPlayers = n;
}

export function laneForSlot(match: MpMatch, slot: number): { team: MpTeam; state: GameState } | null {
  for (const team of [0, 1] as const) {
    const state = match.lanes[team];
    if (state.hero.controllerSlot === slot) return { team, state };
    if (state.allies.some((h) => h.controllerSlot === slot)) return { team, state };
  }
  return null;
}

export function heroForSlot(state: GameState, slot: number): HeroRuntime | null {
  if (state.hero.controllerSlot === slot) return state.hero;
  return state.allies.find((h) => h.controllerSlot === slot) ?? null;
}

export function allLaneHeroes(state: GameState): HeroRuntime[] {
  return [state.hero, ...state.allies];
}

/** True when this controller is AI-driven (negative / null slot). */
export function isAiControllerSlot(slot: number | null | undefined): boolean {
  if (slot == null) return true;
  return slot < 0;
}
