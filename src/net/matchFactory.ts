import { HEROES, HERO_LIST, type HeroId } from "../data/heroes";
import { resolveMapChoice, type MapId } from "../data/maps";
import { createState, type GameState, type HeroRuntime } from "../game/state";
import { isPveMode, type LobbyState, type MatchMode, type MpTeam } from "./types";

export type MpMatch = {
  mode: MatchMode;
  mapId: MapId;
  maxTurrets: number;
  seed: number;
  /** Team 0 / Team 1 lanes. PvE: team 1 is AI-controlled. */
  lanes: [GameState, GameState];
  mySlot: number;
  myTeam: MpTeam;
  viewTeam: MpTeam;
  ended: boolean;
  winnerTeam: MpTeam | null;
};

function makeHeroRuntime(
  heroId: HeroId,
  x: number,
  y: number,
  id: number,
  slot: number | null,
): HeroRuntime {
  const def = HEROES[heroId];
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
  };
}

function populateLane(
  state: GameState,
  seats: { slot: number; heroId: HeroId }[],
  nextIdStart: number,
): void {
  if (seats.length === 0) return;
  const primary = seats[0]!;
  state.hero = makeHeroRuntime(
    primary.heroId,
    state.map.base.x + 120,
    state.map.base.y,
    0,
    primary.slot,
  );
  state.allies = [];
  let nid = nextIdStart;
  for (let i = 1; i < seats.length; i++) {
    const s = seats[i]!;
    const offset = (i - (seats.length - 1) / 2) * 36;
    state.allies.push(
      makeHeroRuntime(s.heroId, state.map.base.x + 120, state.map.base.y + offset, nid++, s.slot),
    );
  }
  state.nextId = Math.max(state.nextId, nid);
}

export function buildMpMatch(
  lobby: LobbyState,
  mapId: MapId,
  maxTurrets: number,
  seed: number,
  mySlot: number,
  runOpts?: { startingGold?: number; wavesToWin?: number; friendlyFire?: boolean },
): MpMatch {
  const resolved = resolveMapChoice(mapId);
  const team0 = lobby.slots.filter((s) => s.team === 0).sort((a, b) => a.slot - b.slot);
  const team1Human = lobby.slots.filter((s) => s.team === 1).sort((a, b) => a.slot - b.slot);

  const sharedOpts = {
    mapId: resolved,
    maxTurrets,
    startingGold: runOpts?.startingGold ?? lobby.startingGold,
    wavesToWin: runOpts?.wavesToWin ?? lobby.wavesToWin,
    friendlyFire: runOpts?.friendlyFire ?? lobby.friendlyFire,
  };

  const lane0 = createState(team0[0]?.heroId ?? "ranger", sharedOpts);
  lane0.mpLane = true;
  populateLane(
    lane0,
    team0.map((s) => ({ slot: s.slot, heroId: s.heroId })),
    10,
  );

  let lane1: GameState;
  if (isPveMode(lobby.mode)) {
    const aiHero = HERO_LIST[Math.floor(seed % HERO_LIST.length)]!.id;
    lane1 = createState(aiHero, sharedOpts);
    lane1.mpLane = true;
    lane1.aiControlled = true;
    populateLane(lane1, [{ slot: -1, heroId: aiHero }], 20);
  } else {
    lane1 = createState(team1Human[0]?.heroId ?? "warden", sharedOpts);
    lane1.mpLane = true;
    populateLane(
      lane1,
      team1Human.map((s) => ({ slot: s.slot, heroId: s.heroId })),
      20,
    );
  }

  // Cross-link: disable abstract solo opponent; use real other lane via HUD
  lane0.viewOpponentLane = false;
  lane1.viewOpponentLane = false;

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
  };
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
