import { neuralFromResolved, resolveLobbyAi } from "../ai/lobbyAi";
import type { NeuralLaneAi } from "../ai/runtime";
import { loadAiStore } from "../ai/store";
import { HERO_LIST, type HeroId } from "../data/heroes";
import { resolveMapChoice, type MapId, mapRespawn } from "../data/maps";
import { resolveHero } from "../custom/registry";
import { createState, type GameState, type HeroRuntime } from "../game/state";
import { applyPlayerSize } from "../systems/creativeRuntime";
import { gunnerWeaponAt } from "../data/gunnerWeapons";
import { composeRunModifiers } from "../meta/modifiers";
import { loadMetaStore } from "../meta/store";
import {
  isPveMode,
  type LobbyAiHeroPick,
  type LobbyAiKind,
  type LobbyAiSeat,
  type LobbyState,
  type MatchMode,
  type MpTeam,
} from "./types";
import { captureBagFromState, createPlayerBag, ensureLaneBags } from "./playerBag";
import { MAX_TEAM_COMBATANTS, resolveAiHeroPick } from "./lobby";
import { resolveHeroPick } from "../ui/heroSelect";

/** Resolve seat hero picks (Random → unlocked hero) at match create. */
function resolveSeatHero(
  pick: HeroId | string | "random",
  seed: number,
  used: Set<HeroId | string>,
): HeroId | string {
  const id = resolveHeroPick(pick as HeroId | "random", seed, used);
  used.add(id);
  return id;
}

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
  /**
   * Per-controller-slot AI. Negative slots are AI heroes. Missing ⇒ fall back to
   * laneAi when the lane/hero is AI-driven; explicit `null` ⇒ classic scripted.
   */
  slotAi?: Map<number, NeuralLaneAi | null>;
  /** Offline solo vs real AI lane (no PeerJS). */
  soloOffline?: boolean;
  /** Display name for opponent panel. */
  opponentLabel?: string;
};

/** One AI combatant for solo / lobby fill. */
export type SoloAiMember = {
  heroId: LobbyAiHeroPick;
  ai: LobbyAiKind;
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
  applyPlayerSize(state);
}

function takeAiFillers(
  aiSeats: LobbyAiSeat[],
  team: MpTeam,
  humanCount: number,
  slotAi: Map<number, NeuralLaneAi | null>,
  slotCounter: { n: number },
  seed: number,
  avoid: Set<HeroId>,
  aggressionMul = 1,
): { slot: number; heroId: HeroId }[] {
  const store = loadAiStore();
  const room = Math.max(0, MAX_TEAM_COMBATANTS - humanCount);
  const take = aiSeats.filter((a) => a.team === team).slice(0, room);
  return take.map((a, i) => {
    const slot = slotCounter.n--;
    const resolved = resolveLobbyAi(a.ai, store);
    // Always record the seat so classic stays classic even when laneAi is set.
    slotAi.set(slot, neuralFromResolved(resolved, aggressionMul));
    const heroId = resolveAiHeroPick(a.heroId, seed + slot * 31 + i * 17, avoid);
    avoid.add(heroId);
    return { slot, heroId };
  });
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
  const resolved = resolveMapChoice(mapId, lobby.contentFilters?.maps);
  const team0 = lobby.slots.filter((s) => s.team === 0).sort((a, b) => a.slot - b.slot);
  const team1Human = lobby.slots.filter((s) => s.team === 1).sort((a, b) => a.slot - b.slot);
  const aiSeats = lobby.aiSeats ?? [];
  const slotAi = new Map<number, NeuralLaneAi | null>();
  const slotCounter = { n: -100 };

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
    playerBaseInvincible: lobby.playerBaseInvincible,
    enemyBaseInvincible: lobby.enemyBaseInvincible,
    waveBreakSec: lobby.waveBreakSec,
    laneClearSpeedPct: lobby.laneClearSpeedPct,
    respawnMinigame: lobby.respawnMinigame,
    sendLocation: lobby.sendLocation,
    artifactPlacement: lobby.artifactPlacement,
    allowBarracks: lobby.allowBarracks,
    relicDrop: lobby.relicDrop,
    enemyProjectileDmgMul: lobby.enemyProjectileDmgMul,
    enemyCollisionDmgMul: lobby.enemyCollisionDmgMul,
    playerDmgLmbMul: lobby.playerDmgLmbMul,
    playerDmgRmbMul: lobby.playerDmgRmbMul,
    playerDmgMmbMul: lobby.playerDmgMmbMul,
    wallBounciness: lobby.wallBounciness,
    playerSpeedMul: lobby.playerSpeedMul,
    playerSizeMul: lobby.playerSizeMul,
    enemySizeMul: lobby.enemySizeMul,
    critLottery: lobby.critLottery,
    enemyMutation: lobby.enemyMutation,
    randomizeUtilityWave: lobby.randomizeUtilityWave,
    doubleAllProjectiles: lobby.doubleAllProjectiles,
    immuneToProjectiles: lobby.immuneToProjectiles,
    randomizeHeroWave: lobby.randomizeHeroWave,
    randomizeMapWave: lobby.randomizeMapWave,
    artifactDamageDoubled: lobby.artifactDamageDoubled,
    artifactsFree: lobby.artifactsFree,
    itemsFree: lobby.itemsFree,
    infiniteRerolls: lobby.infiniteRerolls,
    thornsAura: lobby.thornsAura,
    bloodTax: lobby.bloodTax,
    echoBarrage: lobby.echoBarrage,
    pacifistPays: lobby.pacifistPays,
    berserkerEdge: lobby.berserkerEdge,
    slipNSlide: lobby.slipNSlide,
    vampiricCreeps: lobby.vampiricCreeps,
    corpseExplosion: lobby.corpseExplosion,
    bounceHouse: lobby.bounceHouse,
  };

  const usedHeroes = new Set<HeroId>();
  // Pre-seed avoid set without resolving random yet
  for (const s of lobby.slots) {
    if (s.heroId !== "random") usedHeroes.add(s.heroId as HeroId);
  }
  const usedForPick = usedHeroes as Set<HeroId | string>;
  const t0Ai = takeAiFillers(aiSeats, 0, team0.length, slotAi, slotCounter, seed, usedHeroes);
  const lane0Seats = [
    ...team0.map((s, i) => ({
      slot: s.slot,
      heroId: resolveSeatHero(s.heroId, seed + s.slot * 17 + i, usedForPick) as HeroId,
    })),
    ...t0Ai,
  ];
  const metaRanks = lobby.allowBarracks ? loadMetaStore().ranks : {};
  const applyMeta = !!lobby.allowBarracks;
  const lane0 = createState(lane0Seats[0]?.heroId ?? "ranger", {
    ...sharedOpts,
    playerBaseInvincible: lobby.playerBaseInvincible,
    modifiers: composeRunModifiers(ascension, metaRanks, applyMeta),
  });
  lane0.mpLane = true;
  lane0.baseInvincible = !!lobby.playerBaseInvincible;
  populateLane(lane0, lane0Seats.length ? lane0Seats : [{ slot: 0, heroId: "ranger" }], 10);

  let lane1: GameState;
  if (lobby.endless) {
    // No rival lane: ghost peer; home-lane AI fillers stay on lane0.
    lane1 = createState(lane0Seats[0]?.heroId ?? "ranger", {
      ...sharedOpts,
      endless: true,
      playerBaseInvincible: true,
      modifiers: composeRunModifiers(ascension, {}, false),
    });
    lane1.mpLane = true;
    lane1.aiControlled = true;
    lane1.baseInvincible = true;
    lane1.hero.alive = false;
    lane1.hero.hp = 0;
    lane0.endless = true;
  } else if (isPveMode(lobby.mode)) {
    const t1Ai = takeAiFillers(aiSeats, 1, 0, slotAi, slotCounter, seed + 101, usedHeroes);
    const foeSeats =
      t1Ai.length > 0
        ? t1Ai
        : [
            {
              slot: -1,
              heroId: HERO_LIST[Math.floor(seed % HERO_LIST.length)]!.id,
            },
          ];
    lane1 = createState(foeSeats[0]!.heroId, {
      ...sharedOpts,
      playerBaseInvincible: lobby.enemyBaseInvincible,
      modifiers: composeRunModifiers(ascension, {}, false),
    });
    lane1.mpLane = true;
    lane1.aiControlled = true;
    lane1.baseInvincible = !!lobby.enemyBaseInvincible;
    populateLane(lane1, foeSeats, 20);
  } else {
    const t1Ai = takeAiFillers(
      aiSeats,
      1,
      team1Human.length,
      slotAi,
      slotCounter,
      seed + 202,
      usedHeroes,
    );
    const lane1Seats = [
      ...team1Human.map((s, i) => ({
        slot: s.slot,
        heroId: resolveSeatHero(s.heroId, seed + 300 + s.slot * 19 + i, usedForPick) as HeroId,
      })),
      ...t1Ai,
    ];
    lane1 = createState(lane1Seats[0]?.heroId ?? "warden", {
      ...sharedOpts,
      playerBaseInvincible: lobby.enemyBaseInvincible,
      modifiers: composeRunModifiers(ascension, metaRanks, applyMeta),
    });
    lane1.mpLane = true;
    lane1.baseInvincible = !!lobby.enemyBaseInvincible;
    if (team1Human.length === 0) lane1.aiControlled = true;
    populateLane(
      lane1,
      lane1Seats.length ? lane1Seats : [{ slot: -1, heroId: "warden" }],
      20,
    );
  }

  lane0.viewOpponentLane = false;
  lane1.viewOpponentLane = false;
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
    slotAi: slotAi.size ? slotAi : undefined,
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
  /** Symmetric team size preset (used when allies/enemies omitted). */
  teamSize?: 1 | 2 | 3;
  /** Explicit AI allies on the player lane (0–2; player fills the first seat). */
  allies?: SoloAiMember[];
  /** Explicit AI enemies on the rival lane (0–3). Empty = no foe heroes (abstract or no-rival). */
  enemies?: SoloAiMember[];
  /** Solo no-rival survival: ghost peer lane, no enemy AI. */
  noRivalLane?: boolean;
  /** No rival lane flag on the player state (sends/own-lane UX). */
  endless?: boolean;
  allyAiAggression?: number;
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
  disableBonuses?: boolean;
  disableBaseUpgrades?: boolean;
  contentFilters?: import("../meta/contentFilters").GameTypeContentFilters;
  fogAlways?: boolean;
  fogThicknessPct?: number;
  fogVisionRadius?: number;
  doubleElites?: boolean;
  suddenDeathBaseHp?: number;
  glassCannon?: boolean;
  goldRush?: boolean;
  wildChests?: boolean;
  crampedLane?: boolean;
  playerBaseInvincible?: boolean;
  enemyBaseInvincible?: boolean;
  waveBreakSec?: number;
  laneClearSpeedPct?: number;
  respawnMinigame?: boolean;
  sendLocation?: "own" | "enemy";
  artifactPlacement?: "free" | "locked";
  allowBarracks?: boolean;
  relicDrop?: import("../meta/creativeOptions").RelicDropMode;
  enemyProjectileDmgMul?: number;
  enemyCollisionDmgMul?: number;
  playerDmgLmbMul?: number;
  playerDmgRmbMul?: number;
  playerDmgMmbMul?: number;
  wallBounciness?: number;
  playerSpeedMul?: number;
  playerSizeMul?: number;
  enemySizeMul?: number;
  critLottery?: import("../meta/creativeOptions").CritLotteryMode;
  enemyMutation?: import("../meta/creativeOptions").EnemyMutationMode;
  randomizeUtilityWave?: boolean;
  doubleAllProjectiles?: boolean;
  immuneToProjectiles?: boolean;
  randomizeHeroWave?: boolean;
  randomizeMapWave?: boolean;
  artifactDamageDoubled?: boolean;
  artifactsFree?: boolean;
  itemsFree?: boolean;
  infiniteRerolls?: boolean;
  thornsAura?: boolean;
  bloodTax?: boolean;
  echoBarrage?: boolean;
  pacifistPays?: boolean;
  berserkerEdge?: boolean;
  slipNSlide?: boolean;
  vampiricCreeps?: boolean;
  corpseExplosion?: boolean;
  bounceHouse?: boolean;
}): MpMatch {
  const resolved = resolveMapChoice(opts.mapId, opts.contentFilters?.maps);
  const teamSize = opts.teamSize ?? 1;
  const store = loadAiStore();
  const slotAi = new Map<number, NeuralLaneAi | null>();
  const agg = opts.allyAiAggression ?? 1;

  let allies: SoloAiMember[] =
    opts.allies ??
    Array.from({ length: Math.max(0, teamSize - 1) }, () => ({
      heroId: "random" as const,
      ai: { kind: "classic" as const },
    }));
  allies = allies.slice(0, MAX_TEAM_COMBATANTS - 1);

  const noRival = !!opts.noRivalLane || !!opts.endless;
  let enemies: SoloAiMember[];
  if (noRival) {
    enemies = [];
  } else if (opts.enemies?.length) {
    enemies = opts.enemies.slice(0, MAX_TEAM_COMBATANTS);
  } else {
    const primaryHero = opts.aiHeroId ?? ("random" as const);
    enemies = [{ heroId: primaryHero, ai: { kind: "classic" } }];
    for (let i = 1; i < teamSize; i++) {
      enemies.push({ heroId: "random", ai: { kind: "classic" } });
    }
  }

  const usedHeroes = new Set<HeroId>([opts.playerHeroId]);
  const resolveMemberHero = (pick: LobbyAiHeroPick, salt: number) => {
    const id = resolveAiHeroPick(pick, opts.seed + salt, usedHeroes);
    usedHeroes.add(id);
    return id;
  };

  const sharedBase = {
    mapId: resolved,
    maxTurrets: opts.maxTurrets,
    startingGold: opts.startingGold,
    wavesToWin: opts.wavesToWin,
    friendlyFire: opts.friendlyFire,
    teamSize: Math.min(MAX_TEAM_COMBATANTS, 1 + allies.length) as 1 | 2 | 3,
    endless: noRival,
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
    disableBonuses: opts.disableBonuses,
    disableBaseUpgrades: opts.disableBaseUpgrades,
    contentFilters: opts.contentFilters,
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
    waveBreakSec: opts.waveBreakSec,
    laneClearSpeedPct: opts.laneClearSpeedPct,
    respawnMinigame: opts.respawnMinigame,
    sendLocation: opts.sendLocation,
    artifactPlacement: opts.artifactPlacement,
    allowBarracks: opts.allowBarracks,
    relicDrop: opts.relicDrop,
    enemyProjectileDmgMul: opts.enemyProjectileDmgMul,
    enemyCollisionDmgMul: opts.enemyCollisionDmgMul,
    playerDmgLmbMul: opts.playerDmgLmbMul,
    playerDmgRmbMul: opts.playerDmgRmbMul,
    playerDmgMmbMul: opts.playerDmgMmbMul,
    wallBounciness: opts.wallBounciness,
    playerSpeedMul: opts.playerSpeedMul,
    playerSizeMul: opts.playerSizeMul,
    enemySizeMul: opts.enemySizeMul,
    critLottery: opts.critLottery,
    enemyMutation: opts.enemyMutation,
    randomizeUtilityWave: opts.randomizeUtilityWave,
    doubleAllProjectiles: opts.doubleAllProjectiles,
    immuneToProjectiles: opts.immuneToProjectiles,
    randomizeHeroWave: opts.randomizeHeroWave,
    randomizeMapWave: opts.randomizeMapWave,
    artifactDamageDoubled: opts.artifactDamageDoubled,
    artifactsFree: opts.artifactsFree,
    itemsFree: opts.itemsFree,
    infiniteRerolls: opts.infiniteRerolls,
    thornsAura: opts.thornsAura,
    bloodTax: opts.bloodTax,
    echoBarrage: opts.echoBarrage,
    pacifistPays: opts.pacifistPays,
    berserkerEdge: opts.berserkerEdge,
    slipNSlide: opts.slipNSlide,
    vampiricCreeps: opts.vampiricCreeps,
    corpseExplosion: opts.corpseExplosion,
    bounceHouse: opts.bounceHouse,
  };

  /** When callers pass explicit allies/enemies, pin per-seat brains in slotAi. */
  const pinSeats = !!(opts.allies || opts.enemies);

  const lane0 = createState(opts.playerHeroId, {
    ...sharedBase,
    playerBaseInvincible: opts.playerBaseInvincible,
    modifiers: opts.playerModifiers,
    ascension: opts.playerModifiers?.ascension ?? 0,
  });
  lane0.mpLane = true;
  lane0.baseInvincible = !!opts.playerBaseInvincible;
  const playerSeats = [{ slot: 0, heroId: opts.playerHeroId }];
  let allySlot = -10;
  let allySalt = 11;
  for (const a of allies) {
    const slot = allySlot--;
    const heroId = resolveMemberHero(a.heroId, allySalt++);
    if (pinSeats) {
      const resolvedAi = resolveLobbyAi(a.ai, store);
      slotAi.set(slot, neuralFromResolved(resolvedAi, agg));
    }
    playerSeats.push({ slot, heroId });
  }
  populateLane(lane0, playerSeats, 10);

  let lane1: GameState;
  if (enemies.length === 0) {
    // Ghost peer for dual-sim machinery when there is no rival lane / no foe heroes.
    lane1 = createState(opts.playerHeroId, {
      ...sharedBase,
      playerBaseInvincible: true,
      modifiers: opts.enemyModifiers,
      ascension: opts.enemyModifiers?.ascension ?? opts.playerModifiers?.ascension ?? 0,
    });
    lane1.mpLane = true;
    lane1.aiControlled = true;
    lane1.baseInvincible = true;
    lane1.hero.alive = false;
    lane1.hero.hp = 0;
  } else {
    const resolvedEnemies = enemies.map((e, i) => ({
      ...e,
      heroId: resolveMemberHero(e.heroId, 40 + i * 13),
    }));
    const foePrimary = resolvedEnemies[0]!;
    lane1 = createState(foePrimary.heroId, {
      ...sharedBase,
      endless: false,
      playerBaseInvincible: opts.enemyBaseInvincible,
      modifiers: opts.enemyModifiers,
      ascension: opts.enemyModifiers?.ascension ?? opts.playerModifiers?.ascension ?? 0,
    });
    lane1.mpLane = true;
    lane1.aiControlled = true;
    lane1.baseInvincible = !!opts.enemyBaseInvincible;
    const enemySeats: { slot: number; heroId: HeroId }[] = [];
    for (let i = 0; i < resolvedEnemies.length; i++) {
      const e = resolvedEnemies[i]!;
      const useSlot = -1 - i;
      if (pinSeats) {
        const resolvedAi = resolveLobbyAi(e.ai, store);
        // Legacy: opts.neural overrides the primary enemy brain when provided.
        if (i === 0 && opts.neural) {
          slotAi.set(useSlot, opts.neural);
        } else {
          slotAi.set(useSlot, neuralFromResolved(resolvedAi));
        }
      }
      enemySeats.push({ slot: useSlot, heroId: e.heroId });
    }
    populateLane(lane1, enemySeats, 20);
  }

  lane0.viewOpponentLane = false;
  lane1.viewOpponentLane = false;
  setMatchHumanPlayers([lane0, lane1], 1);

  const labelParts = enemies.map((e) => {
    if (e.ai.kind === "classic") return "Classic";
    return `${e.ai.school} · ${e.ai.tier}`;
  });
  const aCount = 1 + allies.length;
  const bCount = Math.max(1, enemies.length);

  return {
    mode: aCount >= 3 || bCount >= 3 ? "3v3" : aCount === 2 || bCount === 2 ? "2v2" : "1v1",
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
    slotAi: slotAi.size ? slotAi : undefined,
    soloOffline: true,
    opponentLabel:
      enemies.length === 0
        ? noRival
          ? "No rival"
          : "Abstract"
        : (opts.opponentLabel ?? (labelParts.length === 1 ? labelParts[0]! : `${bCount} AI`)),
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

/** Resolve the neural (or classic-null) brain for one AI hero. */
export function neuralForHero(
  match: MpMatch,
  team: MpTeam,
  hero: HeroRuntime,
): NeuralLaneAi | null {
  const slot = hero.controllerSlot;
  if (slot != null && match.slotAi?.has(slot)) {
    return match.slotAi.get(slot) ?? null;
  }
  return match.laneAi[team] ?? null;
}
