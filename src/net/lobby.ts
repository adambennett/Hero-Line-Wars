import { HERO_LIST, type HeroId } from "../data/heroes";
import { STARTING_GOLD, WIN_WAVES } from "../data/constants";
import { DEFAULT_MAX_TURRETS } from "../data/turrets";
import type {
  LobbyAiHeroPick,
  LobbyAiKind,
  LobbyAiSeat,
  LobbySeat,
  LobbyState,
  MatchMode,
  MpTeam,
} from "./types";
import { isPveMode, modeCap, teamNeed } from "./types";

export const MAX_TEAM_COMBATANTS = 3;

export function newLobby(mode: MatchMode, hostName: string, heroId: HeroId = HERO_LIST[0]!.id): LobbyState {
  return {
    mode,
    slots: [
      {
        slot: 0,
        team: 0,
        name: hostName || "Host",
        heroId,
        ready: false,
        here: true,
      },
    ],
    aiSeats: [],
    mapChoice: "random",
    maxTurrets: DEFAULT_MAX_TURRETS,
    startingGold: STARTING_GOLD,
    wavesToWin: WIN_WAVES,
    friendlyFire: false,
    utilityDraftLevel: 10,
    livesPerWave: 0,
    livesPerRun: 0,
    privacy: "private",
    ascension: 0,
    chestOpenMul: 1,
    chestDespawnSec: 28,
    chestSpawnChance: 0.08,
    enemyDensityMul: 1,
    enemyHpMul: 1,
    enemySpeedMul: 1,
    incomeMul: 1,
    respawnMul: 1,
    startingBaseLevel: 0,
    levelDraftSize: 3,
    relicDraftSize: 3,
    disableArtifacts: false,
    disableChests: false,
    disableElites: false,
    disableBosses: false,
    disableShop: false,
    disableSends: false,
    disableRelics: false,
    fogAlways: false,
    fogThicknessPct: 55,
    fogVisionRadius: 120,
    doubleElites: false,
    suddenDeathBaseHp: 0,
    glassCannon: false,
    goldRush: false,
    wildChests: false,
    crampedLane: false,
  };
}

export function lobbySeat(lobby: LobbyState, slot: number): LobbySeat | undefined {
  return lobby.slots.find((s) => s.slot === slot);
}

export function lobbyFreeSlot(lobby: LobbyState): number {
  const cap = modeCap(lobby.mode);
  for (let i = 1; i < cap; i++) {
    if (!lobbySeat(lobby, i)) return i;
  }
  return -1;
}

export function lobbyTeamCount(lobby: LobbyState, team: MpTeam): number {
  return lobby.slots.filter((s) => s.team === team).length;
}

/** Humans + host-placed AI on a team (cap 3). */
export function lobbyCombatantCount(lobby: LobbyState, team: MpTeam): number {
  const ais = (lobby.aiSeats ?? []).filter((a) => a.team === team).length;
  return lobbyTeamCount(lobby, team) + ais;
}

export function lobbyAiOnTeam(lobby: LobbyState, team: MpTeam): LobbyAiSeat[] {
  return (lobby.aiSeats ?? []).filter((a) => a.team === team);
}

export function lobbyTeamRoom(lobby: LobbyState, team: MpTeam): number {
  return Math.max(0, MAX_TEAM_COMBATANTS - lobbyCombatantCount(lobby, team));
}

/** Trim AI seats so no team exceeds 3 combatants (humans keep priority). */
export function clampLobbyAiSeats(lobby: LobbyState): void {
  const seats = lobby.aiSeats ?? [];
  const kept: LobbyAiSeat[] = [];
  const roomLeft: [number, number] = [
    MAX_TEAM_COMBATANTS - lobbyTeamCount(lobby, 0),
    MAX_TEAM_COMBATANTS - lobbyTeamCount(lobby, 1),
  ];
  for (const a of seats) {
    if (isPveMode(lobby.mode) && a.team === 1) {
      // PvE foe fillers still count against team 1's 3-hero lane cap.
    }
    if (roomLeft[a.team]! > 0) {
      kept.push(a);
      roomLeft[a.team]!--;
    }
  }
  lobby.aiSeats = kept;
}

export function lobbyBalanced(lobby: LobbyState): boolean {
  if (isPveMode(lobby.mode)) {
    return lobby.slots.length >= modeCap(lobby.mode) && lobby.slots.every((s) => s.team === 0);
  }
  const need = teamNeed(lobby.mode);
  return lobbyTeamCount(lobby, 0) === need && lobbyTeamCount(lobby, 1) === need;
}

/**
 * Start-ready combatant shape: each fighting side has 1–3 bodies.
 * AI seats count; human seats need not fill the mode cap.
 */
export function lobbyCombatReady(lobby: LobbyState): boolean {
  if (lobby.slots.length < 1) return false;
  if (lobby.slots.some((s) => !s.ready)) return false;
  if (isPveMode(lobby.mode)) {
    if (!lobby.slots.every((s) => s.team === 0)) return false;
    return lobbyCombatantCount(lobby, 0) >= 1 && lobbyCombatantCount(lobby, 0) <= MAX_TEAM_COMBATANTS;
  }
  const a = lobbyCombatantCount(lobby, 0);
  const b = lobbyCombatantCount(lobby, 1);
  return a >= 1 && b >= 1 && a <= MAX_TEAM_COMBATANTS && b <= MAX_TEAM_COMBATANTS;
}

export function lobbyFull(lobby: LobbyState): boolean {
  return lobby.slots.length >= modeCap(lobby.mode);
}

export function newAiSeat(
  team: MpTeam,
  ai: LobbyAiKind = { kind: "classic" },
  heroId: LobbyAiHeroPick = "random",
): LobbyAiSeat {
  return {
    id: `ai_${Math.random().toString(36).slice(2, 10)}`,
    team,
    ai,
    heroId,
  };
}

/** Resolve an AI hero pick at match start (`random` rolls, avoiding duplicates when possible). */
export function resolveAiHeroPick(
  pick: LobbyAiHeroPick,
  seed: number,
  avoid: Iterable<HeroId> = [],
): HeroId {
  if (pick !== "random") return pick;
  const blocked = new Set(avoid);
  const pool = HERO_LIST.filter((h) => !blocked.has(h.id));
  const list = pool.length ? pool : HERO_LIST;
  return list[Math.abs(seed) % list.length]!.id;
}

export function lobbyReadyCount(lobby: LobbyState): number {
  return lobby.slots.filter((s) => s.ready).length;
}

export function assignTeam(lobby: LobbyState): MpTeam {
  if (isPveMode(lobby.mode)) return 0;
  const need = teamNeed(lobby.mode);
  const home = lobbyTeamCount(lobby, 0);
  const away = lobbyTeamCount(lobby, 1);
  if (home < need && home <= away) return 0;
  if (away < need) return 1;
  return home <= away ? 0 : 1;
}

export function setMode(lobby: LobbyState, mode: MatchMode): void {
  lobby.mode = mode;
  const cap = modeCap(mode);
  lobby.slots = lobby.slots.filter((s) => s.slot < cap);
  for (const s of lobby.slots) {
    s.ready = false;
    if (isPveMode(mode)) s.team = 0;
  }
  if (!isPveMode(mode)) {
    const need = teamNeed(mode);
    let h = 0;
    let a = 0;
    for (const s of lobby.slots) {
      if (s.team === 0) {
        if (h >= need) s.team = 1;
        else h++;
      } else {
        if (a >= need) s.team = 0;
        else a++;
      }
    }
  } else {
    // PvE: AI allies stay on team 0; foe AI seats stay on team 1.
    for (const a of lobby.aiSeats ?? []) {
      if (a.team !== 0 && a.team !== 1) a.team = 0;
    }
  }
  clampLobbyAiSeats(lobby);
}
