/**
 * Hero Line Wars netplay — PeerJS lobby codes + host-authoritative simulation.
 * Pattern adapted from Crosscheck Circuit.
 */
import Peer from "peerjs";
import type { DataConnection, Peer as PeerType } from "peerjs";
import { HERO_LIST, type HeroId } from "../data/heroes";
import type { MapId } from "../data/maps";
import {
  assignTeam,
  lobbyBalanced,
  lobbyFreeSlot,
  lobbyFull,
  lobbyReadyCount,
  lobbySeat,
  newLobby,
  setMode,
} from "./lobby";
import type { CombatIntent, LobbyState, MatchMode, MatchPrivacy, NetMode, NetMsg } from "./types";
import { isPveMode, modeCap } from "./types";
import { collectCustomsForMatch, getCustomHero, getCustomMap } from "../custom/registry";
import { isCustomHeroId, isCustomMapId, type CustomHeroDef, type CustomMapDef } from "../custom/types";

export const CODE_ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const PEER_PREFIX = "hlw-v1-";

export type PeerLink = { conn: DataConnection; slot: number };

export type SessionHooks = {
  onStatus: (html: string) => void;
  onLobby: (lobby: LobbyState, mySlot: number, mode: NetMode) => void;
  onStart: (msg: Extract<NetMsg, { k: "start" }>, mySlot: number) => void;
  onDisconnected: (who: string) => void;
};

export type MatchNetHandlers = {
  onState: (snap: Extract<NetMsg, { k: "state" }>) => void;
  onIntent: (seat: number, intent: CombatIntent, seq: number) => void;
};

type Session = {
  mode: NetMode;
  open: boolean;
  peer: PeerType | null;
  code: string | null;
  mySlot: number;
  myName: string;
  myHero: HeroId;
  lobby: LobbyState | null;
  peers: PeerLink[];
  hooks: SessionHooks | null;
  matchHandlers: MatchNetHandlers | null;
  /** Host stash of peer-shared custom defs for match start. */
  peerCustoms: { maps: Map<string, CustomMapDef>; heroes: Map<string, CustomHeroDef> };
};

const S: Session = {
  mode: null,
  open: false,
  peer: null,
  code: null,
  mySlot: 0,
  myName: "Player",
  myHero: HERO_LIST[0]!.id,
  lobby: null,
  peers: [],
  hooks: null,
  matchHandlers: null,
  peerCustoms: { maps: new Map(), heroes: new Map() },
};

export function getSession() {
  return S;
}

export function mkCode(len = 6): string {
  let c = "";
  for (let i = 0; i < len; i++) c += CODE_ALPHA[Math.floor(Math.random() * CODE_ALPHA.length)];
  return c;
}

function status(html: string): void {
  S.hooks?.onStatus(html);
}

function emitLobby(): void {
  if (S.lobby) S.hooks?.onLobby(S.lobby, S.mySlot, S.mode);
}

function send(conn: DataConnection | null | undefined, msg: NetMsg): void {
  if (!conn || !conn.open) return;
  try {
    conn.send(msg);
  } catch {
    /* ignore */
  }
}

export function netBroadcast(msg: NetMsg): void {
  for (const p of S.peers) send(p.conn, msg);
}

export function netSendToHost(msg: NetMsg): void {
  if (S.mode !== "client") return;
  send(S.peers[0]?.conn, msg);
}

export function disconnectNet(): void {
  try {
    S.peer?.destroy();
  } catch {
    /* */
  }
  for (const p of S.peers) {
    try {
      p.conn.close();
    } catch {
      /* */
    }
  }
  S.mode = null;
  S.open = false;
  S.peer = null;
  S.code = null;
  S.lobby = null;
  S.peers = [];
  S.mySlot = 0;
  S.peerCustoms.maps.clear();
  S.peerCustoms.heroes.clear();
}

function ingestPeerCustoms(maps?: CustomMapDef[], heroes?: CustomHeroDef[]): void {
  for (const m of maps ?? []) {
    if (m?.id) S.peerCustoms.maps.set(m.id, structuredClone(m));
  }
  for (const h of heroes ?? []) {
    if (h?.id) S.peerCustoms.heroes.set(h.id, structuredClone(h));
  }
}

/** Push local custom defs for current hero (+ optional map) to host / host stash. */
export function pushLocalCustoms(mapChoice?: string | "random"): void {
  const heroes: CustomHeroDef[] = [];
  const maps: CustomMapDef[] = [];
  if (isCustomHeroId(S.myHero)) {
    const h = getCustomHero(S.myHero);
    if (h) heroes.push(h);
  }
  if (mapChoice && mapChoice !== "random" && isCustomMapId(mapChoice)) {
    const m = getCustomMap(mapChoice);
    if (m) maps.push(m);
  }
  if (!heroes.length && !maps.length) return;
  if (S.mode === "host") ingestPeerCustoms(maps, heroes);
  else netSendToHost({ k: "customs", heroes, maps });
}

export function bindHooks(hooks: SessionHooks): void {
  S.hooks = hooks;
}

export function bindMatchHandlers(h: MatchNetHandlers | null): void {
  S.matchHandlers = h;
}

function broadcastLobby(): void {
  if (S.mode !== "host" || !S.lobby) return;
  netBroadcast({ k: "lobby", lobby: S.lobby });
  emitLobby();
}

function onMsg(raw: unknown, fromSlot?: number): void {
  const m = (typeof raw === "string" ? JSON.parse(raw) : raw) as NetMsg;

  if (m.k === "full") {
    status('<b style="color:#e85d04">Lobby is full.</b>');
    return;
  }
  if (m.k === "welcome") {
    S.mySlot = m.slot;
    S.lobby = m.lobby;
    S.open = true;
    status(`<b style="color:#3d9a6a">Connected</b> — seat ${m.slot + 1}.`);
    emitLobby();
    netSendToHost({ k: "hello", nm: S.myName, heroId: S.myHero });
    return;
  }
  if (m.k === "lobby") {
    S.lobby = m.lobby;
    emitLobby();
    return;
  }
  if (m.k === "start") {
    S.hooks?.onStart(m, S.mySlot);
    return;
  }
  if (m.k === "state") {
    S.matchHandlers?.onState(m);
    return;
  }
  if (m.k === "intent" && S.mode === "host") {
    S.matchHandlers?.onIntent(m.seat, m.intent, m.seq);
    return;
  }

  if (S.mode !== "host" || fromSlot == null || !S.lobby) return;

  if (m.k === "hello") {
    const seat = lobbySeat(S.lobby, fromSlot);
    if (seat) {
      if (m.nm) seat.name = m.nm;
      if (m.heroId) seat.heroId = m.heroId;
    }
    broadcastLobby();
    return;
  }
  if (m.k === "team") {
    if (isPveMode(S.lobby.mode)) return;
    const seat = lobbySeat(S.lobby, fromSlot);
    if (seat) {
      seat.team = m.t;
      seat.ready = false;
    }
    broadcastLobby();
    return;
  }
  if (m.k === "hero") {
    const seat = lobbySeat(S.lobby, fromSlot);
    if (seat) {
      seat.heroId = m.heroId;
      seat.ready = false;
    }
    broadcastLobby();
    return;
  }
  if (m.k === "ready") {
    const seat = lobbySeat(S.lobby, fromSlot);
    if (seat) {
      if (m.nm) seat.name = m.nm;
      if (m.heroId) seat.heroId = m.heroId;
      seat.ready = true;
    }
    broadcastLobby();
    return;
  }
  if (m.k === "unready") {
    const seat = lobbySeat(S.lobby, fromSlot);
    if (seat) seat.ready = false;
    broadcastLobby();
    return;
  }
  if (m.k === "customs") {
    ingestPeerCustoms(m.maps, m.heroes);
  }
}

function wireHostConn(conn: DataConnection): void {
  if (!S.lobby) S.lobby = newLobby("1v1", S.myName, S.myHero);
  const slot = lobbyFreeSlot(S.lobby);
  if (slot < 0) {
    conn.on("open", () => {
      send(conn, { k: "full" });
      setTimeout(() => conn.close(), 400);
    });
    return;
  }
  const team = assignTeam(S.lobby);
  const peer: PeerLink = { conn, slot };
  S.peers.push(peer);
  S.lobby.slots.push({
    slot,
    team,
    name: `Player ${slot + 1}`,
    heroId: HERO_LIST[slot % HERO_LIST.length]!.id,
    ready: false,
    here: true,
  });
  conn.on("data", (data) => onMsg(data, slot));
  conn.on("open", () => {
    S.open = true;
    send(conn, { k: "welcome", slot, team, lobby: S.lobby! });
    broadcastLobby();
    status(
      `<b style="color:#3d9a6a">Player ${slot + 1} joined.</b> ${S.lobby!.slots.length} / ${modeCap(S.lobby!.mode)}`,
    );
  });
  conn.on("close", () => {
    S.peers = S.peers.filter((p) => p !== peer);
    if (S.lobby) S.lobby.slots = S.lobby.slots.filter((s) => s.slot !== slot);
    S.hooks?.onDisconnected(`Player ${slot + 1}`);
    broadcastLobby();
  });
}

function wireClientConn(conn: DataConnection): void {
  S.peers = [{ conn, slot: -1 }];
  S.mode = "client";
  conn.on("data", (data) => onMsg(data));
  conn.on("open", () => {
    S.open = true;
  });
  conn.on("close", () => {
    S.open = false;
    S.hooks?.onDisconnected("Host");
    status('<b style="color:#e85d04">Host disconnected.</b>');
  });
  conn.on("error", () => status("Connection error."));
}

export async function quickHost(
  mode: MatchMode,
  name: string,
  heroId: HeroId,
  privacy: MatchPrivacy,
  mapChoice: MapId | string | "random",
  maxTurrets: number,
  preferredCode?: string,
  startingGold?: number,
  wavesToWin?: number,
  friendlyFire?: boolean,
): Promise<string | null> {
  disconnectNet();
  S.mode = "host";
  S.myName = name || "Host";
  S.myHero = heroId;
  S.mySlot = 0;
  S.peers = [];
  S.lobby = newLobby(mode, S.myName, heroId);
  S.lobby.privacy = privacy;
  S.lobby.mapChoice = mapChoice;
  S.lobby.maxTurrets = maxTurrets;
  if (startingGold != null) S.lobby.startingGold = startingGold;
  if (wavesToWin != null) S.lobby.wavesToWin = wavesToWin;
  if (friendlyFire != null) S.lobby.friendlyFire = friendlyFire;
  status("Contacting the relay…");

  return new Promise((resolve) => {
    let tries = 0;
    const attempt = () => {
      let code: string;
      if (preferredCode) {
        code = preferredCode;
      } else if (privacy === "public") {
        code = `PUB${mode.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 4)}${tries}`;
      } else {
        code = mkCode(6);
      }
      const peer = new Peer(PEER_PREFIX + code.toLowerCase(), { debug: 0 });
      S.peer = peer;
      peer.on("open", () => {
        S.code = code;
        if (S.lobby) S.lobby.code = code;
        status(
          privacy === "public"
            ? `Public lobby open (${code}). Others can Find Match on this mode.`
            : "Lobby open — share this code with friends.",
        );
        emitLobby();
        resolve(code);
      });
      peer.on("connection", (conn) => wireHostConn(conn));
      peer.on("error", (err: { type?: string }) => {
        if (err?.type === "unavailable-id" && tries++ < 20) {
          try {
            peer.destroy();
          } catch {
            /* */
          }
          attempt();
          return;
        }
        status(`<b style="color:#e85d04">Relay error: ${err?.type ?? err}</b>`);
        resolve(null);
      });
    };
    attempt();
  });
}

export async function quickJoin(code: string, name: string, heroId: HeroId): Promise<void> {
  const c = code.trim().toUpperCase();
  if (c.length < 4) {
    status("Enter the lobby code first.");
    return;
  }
  disconnectNet();
  S.mode = "client";
  S.myName = name || "Guest";
  S.myHero = heroId;
  status("Contacting the relay…");
  const peer = new Peer({ debug: 0 });
  S.peer = peer;
  peer.on("open", () => {
    status(`Connecting to lobby ${c}…`);
    const conn = peer.connect(PEER_PREFIX + c.toLowerCase(), {
      reliable: true,
      serialization: "json",
    });
    wireClientConn(conn);
    conn.on("open", () => {
      status('<b style="color:#3d9a6a">Connected — waiting for the host.</b>');
    });
  });
  peer.on("error", (err: { type?: string }) => {
    const t = err?.type;
    if (t === "peer-unavailable") {
      status(`<b style="color:#e85d04">No lobby with code ${c}.</b>`);
    } else {
      status(`<b style="color:#e85d04">Relay error: ${t ?? err}</b>`);
    }
  });
}

/** Try public rooms for a mode (sequential PUB{MODE}{n} peer ids). */
export async function findPublicMatch(mode: MatchMode, name: string, heroId: HeroId): Promise<void> {
  const base = `PUB${mode.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 4)}`;
  status(`Searching public ${mode} lobbies…`);
  for (let i = 0; i < 20; i++) {
    const code = `${base}${i}`;
    const ok = await tryJoinOnce(code, name, heroId);
    if (ok) return;
  }
  status('<b style="color:#e85d04">No public lobby found.</b> Host one, or use a private code.');
}

function tryJoinOnce(code: string, name: string, heroId: HeroId): Promise<boolean> {
  return new Promise((resolve) => {
    disconnectNet();
    S.mode = "client";
    S.myName = name;
    S.myHero = heroId;
    const peer = new Peer({ debug: 0 });
    S.peer = peer;
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const to = setTimeout(() => {
      try {
        peer.destroy();
      } catch {
        /* */
      }
      done(false);
    }, 1800);
    peer.on("open", () => {
      const conn = peer.connect(PEER_PREFIX + code.toLowerCase(), {
        reliable: true,
        serialization: "json",
      });
      conn.on("open", () => {
        clearTimeout(to);
        wireClientConn(conn);
        S.code = code;
        status(`<b style="color:#3d9a6a">Found public lobby ${code}.</b>`);
        done(true);
      });
      conn.on("error", () => {
        clearTimeout(to);
        try {
          peer.destroy();
        } catch {
          /* */
        }
        done(false);
      });
    });
    peer.on("error", () => {
      clearTimeout(to);
      done(false);
    });
  });
}

export function hostSetMode(mode: MatchMode): void {
  if (S.mode !== "host" || !S.lobby) return;
  setMode(S.lobby, mode);
  broadcastLobby();
}

export function hostSetOpts(
  mapChoice: MapId | string | "random",
  maxTurrets: number,
  startingGold: number,
  wavesToWin: number,
  friendlyFire: boolean,
  utilityDraftLevel = 10,
): void {
  if (S.mode !== "host" || !S.lobby) return;
  S.lobby.mapChoice = mapChoice;
  S.lobby.maxTurrets = maxTurrets;
  S.lobby.startingGold = startingGold;
  S.lobby.wavesToWin = wavesToWin;
  S.lobby.friendlyFire = friendlyFire;
  S.lobby.utilityDraftLevel = utilityDraftLevel;
  netBroadcast({
    k: "opts",
    mapChoice,
    maxTurrets,
    startingGold,
    wavesToWin,
    friendlyFire,
    utilityDraftLevel,
  });
  broadcastLobby();
}

export function hostStartMatch(
  mapId: MapId | string,
  maxTurrets: number,
  startingGold: number,
  wavesToWin: number,
  friendlyFire: boolean,
  utilityDraftLevel = 10,
): Extract<NetMsg, { k: "start" }> | null {
  if (!canStartMatch() || !S.lobby) return null;
  const mid = `m${Date.now().toString(36)}`;
  pushLocalCustoms(mapId);
  const customs = collectCustomsForMatch({
    mapId,
    heroIds: S.lobby.slots.filter((s) => s.here).map((s) => s.heroId),
  });
  // Merge peer-shared defs (join clients' libraries)
  for (const m of S.peerCustoms.maps.values()) {
    if (!customs.maps.some((x) => x.id === m.id)) customs.maps.push(structuredClone(m));
  }
  for (const h of S.peerCustoms.heroes.values()) {
    if (!customs.heroes.some((x) => x.id === h.id)) customs.heroes.push(structuredClone(h));
  }
  const msg: Extract<NetMsg, { k: "start" }> = {
    k: "start",
    mid,
    lobby: structuredClone(S.lobby),
    mapId,
    maxTurrets,
    startingGold,
    wavesToWin,
    friendlyFire,
    utilityDraftLevel,
    seed: (Math.random() * 1e9) | 0,
    customMaps: customs.maps,
    customHeroes: customs.heroes,
  };
  netBroadcast(msg);
  return msg;
}

export function localSwitchTeam(): void {
  if (!S.lobby || isPveMode(S.lobby.mode)) return;
  const seat = lobbySeat(S.lobby, S.mySlot);
  if (!seat) return;
  seat.team = (1 - seat.team) as 0 | 1;
  seat.ready = false;
  if (S.mode === "host") broadcastLobby();
  else netSendToHost({ k: "team", t: seat.team });
  emitLobby();
}

export function localPickHero(heroId: HeroId): void {
  S.myHero = heroId;
  if (!S.lobby) return;
  const seat = lobbySeat(S.lobby, S.mySlot);
  if (!seat) return;
  seat.heroId = heroId;
  seat.ready = false;
  pushLocalCustoms(S.lobby.mapChoice);
  if (S.mode === "host") broadcastLobby();
  else netSendToHost({ k: "hero", heroId });
  emitLobby();
}

export function localReady(): void {
  if (!S.lobby) return;
  const seat = lobbySeat(S.lobby, S.mySlot);
  if (!seat) return;
  seat.ready = true;
  seat.heroId = S.myHero;
  pushLocalCustoms(S.lobby.mapChoice);
  if (S.mode === "client") netSendToHost({ k: "ready", nm: S.myName, heroId: S.myHero });
  else broadcastLobby();
  emitLobby();
}

export function localUnready(): void {
  if (!S.lobby) return;
  const seat = lobbySeat(S.lobby, S.mySlot);
  if (!seat) return;
  seat.ready = false;
  if (S.mode === "client") netSendToHost({ k: "unready" });
  else broadcastLobby();
  emitLobby();
}

export function canStartMatch(): boolean {
  if (S.mode !== "host" || !S.lobby) return false;
  if (!lobbyFull(S.lobby)) return false;
  if (!lobbyBalanced(S.lobby)) return false;
  return lobbyReadyCount(S.lobby) >= modeCap(S.lobby.mode);
}

export { broadcastLobby };
