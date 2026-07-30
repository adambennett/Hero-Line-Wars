import { HERO_LIST, type HeroId } from "../data/heroes";
import { STARTING_GOLD, WIN_WAVES } from "../data/constants";
import { DEFAULT_MAX_TURRETS } from "../data/turrets";
import type { LobbySeat, LobbyState, MatchMode, MpTeam } from "./types";
import { isPveMode, modeCap, teamNeed } from "./types";

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
    mapChoice: "random",
    maxTurrets: DEFAULT_MAX_TURRETS,
    startingGold: STARTING_GOLD,
    wavesToWin: WIN_WAVES,
    friendlyFire: false,
    privacy: "private",
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

export function lobbyBalanced(lobby: LobbyState): boolean {
  if (isPveMode(lobby.mode)) {
    return lobby.slots.length >= modeCap(lobby.mode) && lobby.slots.every((s) => s.team === 0);
  }
  const need = teamNeed(lobby.mode);
  return lobbyTeamCount(lobby, 0) === need && lobbyTeamCount(lobby, 1) === need;
}

export function lobbyFull(lobby: LobbyState): boolean {
  return lobby.slots.length >= modeCap(lobby.mode);
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
  }
}
