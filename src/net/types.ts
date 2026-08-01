import type { HeroId } from "../data/heroes";
import type { MapId } from "../data/maps";
import type { RelicId } from "../data/relics";
import type { ShopItemId } from "../data/shop";
import type { LevelPassiveId } from "../data/xp";
import type { CustomHeroDef, CustomMapDef } from "../custom/types";

export type MatchMode = "1v1" | "2v2" | "3v3" | "2p-pve" | "3p-pve";
export type MatchPrivacy = "private" | "public";

export type MpTeam = 0 | 1;

export type LobbySeat = {
  slot: number;
  team: MpTeam;
  name: string;
  heroId: HeroId;
  ready: boolean;
  here: boolean;
};

export type LobbyState = {
  mode: MatchMode;
  slots: LobbySeat[];
  code?: string;
  mapChoice: MapId | string | "random";
  maxTurrets: number;
  startingGold: number;
  wavesToWin: number;
  friendlyFire: boolean;
  /** −1 = Run Start, 0 = Never. */
  utilityDraftLevel?: number;
  /** 0 = unlimited. */
  livesPerWave?: number;
  /** 0 = unlimited. */
  livesPerRun?: number;
  privacy: "private" | "public";
  ascension?: number;
  chestOpenMul?: number;
  chestDespawnSec?: number;
  chestSpawnChance?: number;
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
  doubleElites?: boolean;
  suddenDeathBaseHp?: number;
};

/** Host-synced creative / run extras carried on lobby + start. */
export type MpRunExtras = {
  utilityDraftLevel?: number;
  ascension?: number;
  livesPerWave?: number;
  livesPerRun?: number;
  chestOpenMul?: number;
  chestDespawnSec?: number;
  chestSpawnChance?: number;
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
  doubleElites?: boolean;
  suddenDeathBaseHp?: number;
};

export type NetMode = "host" | "client" | null;

export type CombatIntent = {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  attackHeld: boolean;
  mobility: boolean;
  ultimate: boolean;
  utility: boolean;
  toggleShop: boolean;
  upgradeBase: boolean;
  sendDigit: number | null;
  shopSlot: number | null;
  chooseRelic: RelicId | null;
  skipRelic: boolean;
  chooseLevel: LevelPassiveId | null;
  chooseUtility: import("../data/utilities").UtilityId | null;
  chooseCurse: import("../data/curses").CurseId | null;
  chooseChest: number | null;
  viewOpponent: boolean | null;
  /** Gyro: hold mobility to charge hook (AI / net). */
  mobilityHeld?: boolean;
};

export type NetMsg =
  | { k: "hello"; nm: string; heroId: HeroId }
  | { k: "welcome"; slot: number; team: MpTeam; lobby: LobbyState }
  | { k: "lobby"; lobby: LobbyState }
  | { k: "team"; t: MpTeam }
  | { k: "hero"; heroId: HeroId }
  | { k: "ready"; nm: string; heroId: HeroId }
  | { k: "unready" }
  /** Client → host: custom defs for the hero/map this peer is using. */
  | { k: "customs"; heroes?: CustomHeroDef[]; maps?: CustomMapDef[] }
  | {
      k: "opts";
      mapChoice: MapId | string | "random";
      maxTurrets: number;
      startingGold: number;
      wavesToWin: number;
      friendlyFire: boolean;
      utilityDraftLevel?: number;
      extras?: MpRunExtras;
    }
  | {
      k: "start";
      mid: string;
      lobby: LobbyState;
      mapId: MapId | string;
      maxTurrets: number;
      startingGold: number;
      wavesToWin: number;
      friendlyFire: boolean;
      utilityDraftLevel?: number;
      seed: number;
      /** Custom defs referenced by mapId / seat heroIds — register before match build. */
      customMaps?: CustomMapDef[];
      customHeroes?: CustomHeroDef[];
    }
  | { k: "intent"; seat: number; intent: CombatIntent; seq: number }
  | { k: "state"; snap: MatchSnap; seq: number }
  | { k: "full" }
  | { k: "ping"; t: number }
  | { k: "pong"; t: number };

export type HeroSnap = {
  slot: number | null;
  heroId: HeroId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  attackCd: number;
  abilityCds: number[];
  barrierTimer: number;
  whirlwindTimer: number;
};

export type EnemySnap = {
  id: number;
  kind: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  alive: boolean;
  sent?: boolean;
};

export type LaneSnap = {
  status: string;
  wave: number;
  waveTier: string;
  waveTimer: number;
  spawning: boolean;
  baseHp: number;
  baseMaxHp: number;
  baseLevel: number;
  gold: number;
  incomePerSec: number;
  level: number;
  xp: number;
  toast: string;
  toastTimer: number;
  damageFlash: number;
  vignette: number;
  hitFlash: number;
  shake: number;
  shopOpen: boolean;
  nearShop: boolean;
  shopOffer: ShopItemId[];
  shopOwned: Partial<Record<ShopItemId, number>>;
  shopFrozen: boolean;
  shopRefreshesLeft: number;
  relics: RelicId[];
  relicDraft: RelicId[] | null;
  levelDraft: LevelPassiveId[] | null;
  draftKind: string | null;
  pausedForDraft: boolean;
  respawnTimer: number;
  livesPerWave: number;
  livesPerRun: number;
  waveLivesLeft: number;
  runLivesLeft: number;
  waveRespawnBlocked: boolean;
  heroes: HeroSnap[];
  enemies: EnemySnap[];
  turrets: {
    id: number;
    kind: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    alive: boolean;
    slotIndex: number;
  }[];
  projectiles: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color?: string;
    hostile?: boolean;
  }[];
  fx: { x: number; y: number; radius: number; color: string; life: number; maxLife: number }[];
  beam: { x1: number; y1: number; x2: number; y2: number; life: number } | null;
  pendingSends: { enemies: number; hpScale: number }[];
  mapId: MapId | string;
};

export type MatchSnap = {
  mode: MatchMode;
  myTeam: MpTeam;
  viewTeam: MpTeam;
  lanes: [LaneSnap, LaneSnap];
  ended: boolean;
  winnerTeam: MpTeam | null;
};

export function modeCap(mode: MatchMode): number {
  if (mode === "3v3") return 6;
  if (mode === "2v2") return 4;
  if (mode === "3p-pve") return 3;
  if (mode === "2p-pve") return 2;
  return 2;
}

export function teamNeed(mode: MatchMode): number {
  if (mode === "3v3") return 3;
  if (mode === "2v2") return 2;
  if (mode === "3p-pve" || mode === "2p-pve") return modeCap(mode);
  return 1;
}

export function isPveMode(mode: MatchMode): boolean {
  return mode === "2p-pve" || mode === "3p-pve";
}

export function emptyIntent(): CombatIntent {
  return {
    moveX: 0,
    moveY: 0,
    aimX: 1,
    aimY: 0,
    attackHeld: false,
    mobility: false,
    ultimate: false,
    utility: false,
    toggleShop: false,
    upgradeBase: false,
    sendDigit: null,
    shopSlot: null,
    chooseRelic: null,
    skipRelic: false,
    chooseLevel: null,
    chooseUtility: null,
    chooseCurse: null,
    chooseChest: null,
    viewOpponent: null,
    mobilityHeld: false,
  };
}
