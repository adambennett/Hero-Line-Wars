import type { HeroId } from "../data/heroes";
import type { MapId } from "../data/maps";
import type { RelicId } from "../data/relics";
import type { ShopItemId } from "../data/shop";
import type { LevelPassiveId } from "../data/xp";
import type { CustomHeroDef, CustomMapDef } from "../custom/types";

export type MatchMode = "1v1" | "2v2" | "3v3" | "2p-pve" | "3p-pve";
export type MatchPrivacy = "private" | "public";

export type MpTeam = 0 | 1;

/** Per-AI difficulty — classic scripted, or a trained school checkpoint tier. */
export type LobbyAiKind =
  | { kind: "classic" }
  | { kind: "neural"; school: string; tier: "rookie" | "steady" | "sharp" | "brutal" };

/** Concrete hero, or roll at match start. */
export type LobbyAiHeroPick = HeroId | "random";

/** Host-placed AI filler. Team size = humans on that team + AI seats (max 3). */
export type LobbyAiSeat = {
  id: string;
  team: MpTeam;
  ai: LobbyAiKind;
  heroId: LobbyAiHeroPick;
};

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
  /** Optional AI fillers on either team (beyond human seats from the mode). */
  aiSeats?: LobbyAiSeat[];
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
  artifactPlacement?: "free" | "locked";
  allowBarracks?: boolean;
  respawnMinigame?: boolean;
  sendLocation?: "own" | "enemy";
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
  artifactPlacement?: "free" | "locked";
  allowBarracks?: boolean;
  respawnMinigame?: boolean;
  sendLocation?: "own" | "enemy";
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
  chooseBaseBranch: import("../data/baseBranches").BaseBranchId | null;
  rerollLevel: boolean;
  rerollRelic: boolean;
  viewOpponent: boolean | null;
  /** Gyro / Gunner: hold mobility to charge hook or fire arsenal. */
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
  /** Client tells the host which lane it is watching (full snapshots follow). */
  | { k: "view"; t: MpTeam }
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
  radius?: number;
  /** Gyro kit VFX state — clients cannot derive it. */
  bladeMode?: string;
  bladeSpin?: number;
  bladeAngle?: number;
  bladeTipX?: number;
  bladeTipY?: number;
  bladeHookCharging?: boolean;
  bladeHookCharge?: number;
  /** Gunner arsenal VFX / HUD. */
  gunnerWeaponIndex?: number;
  gunnerAmmo?: number;
  gunnerReload?: number;
  gunnerAiming?: boolean;
  gunnerAimTime?: number;
  gunnerSpin?: number;
  gunnerCharge?: number;
  gunnerSelfDamageFlash?: number;
  /** Vector momentum meter. */
  momentum?: number;
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
  damageFloaters?: {
    x: number;
    y: number;
    text: string;
    color: string;
    life: number;
    maxLife: number;
    scale: number;
    vy: number;
  }[];
  beam: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    life: number;
    color?: string;
    width?: number;
  } | null;
  pendingSends: { enemies: number; hpScale: number }[];
  mapId: MapId | string;
  utilityDraft: import("../data/utilities").UtilityId[] | null;
  curseDraft: import("../data/curses").CurseId[] | null;
  /** Display payload only — the host keeps the authoritative reward per index. */
  chestDraft: { label: string; blurb: string; kind?: string; amount?: number }[] | null;
  baseBranchDraft: import("../data/baseBranches").BaseBranchId[] | null;
  utilityId: import("../data/utilities").UtilityId | null;
  levelPassives: LevelPassiveId[];
  rerollTokens: number;
  /** Per-controller economy when teammates share a lane. */
  playerBags?: Record<string, import("./playerBag").PlayerBag>;
  curseShopBlock: number;
  curseSendBlock: number;
  curseUpgradeBlock: number;
  curseIncomeTaxTimer: number;
  curseIncomeTaxMul: number;
  curseFogTimer: number;
  /* --- world state (added v0.9: clients could not render these) --- */
  curseShopRefreshSlowTimer?: number;
  curseShopRefreshSlowMul?: number;
  shopRefreshTimer?: number;
  chests?: {
    id: number;
    x: number;
    y: number;
    radius: number;
    rarity: string;
    openProgress: number;
    openDuration: number;
    life: number;
  }[];
  hexZones?: { x: number; y: number; radius: number; life: number; kind?: "hex" | "poison" }[];
  mapOrbs?: { x: number; y: number; radius: number; fuse: number }[];
  teleporters?: {
    a: { x: number; y: number } | null;
    b: { x: number; y: number } | null;
    linked: boolean;
  };
  mines?: { id: number; x: number; y: number; radius: number; armTimer: number }[];
  mapFogActive?: boolean;
  fogOpacity?: number;
  fogVisionRadiusResolved?: number;
  mapEclipseActive?: boolean;
  mapHazardX?: number;
  mapSupplyCrates?: {
    id: number;
    x: number;
    y: number;
    radius: number;
    life: number;
    gold: number;
  }[];
  /** Only sent for maps whose geometry moves (shifting obstacles / shrinking lane). */
  laneGeometry?: {
    laneTop: number;
    laneBottom: number;
    laneLeft?: number;
    laneRight?: number;
    obstacles: { x: number; y: number; w: number; h: number }[];
  };
  /** Humans in the match — drives the client's pause / cheat policy. */
  humanPlayers?: number;
  /** Rewards queued behind the open draft (kinds only; host keeps payloads). */
  draftQueueKinds?: string[];
};

/**
 * HUD-only view of a lane the player is NOT looking at. Cheap enough to send
 * every frame; upgraded to a full `LaneSnap` the moment the player looks over.
 */
export type LaneSummary = {
  summary: true;
  status: string;
  wave: number;
  waveTier: string;
  waveTimer: number;
  spawning: boolean;
  baseHp: number;
  baseMaxHp: number;
  baseLevel: number;
  enemyCount: number;
  sentIncoming: number;
  players: {
    slot: number | null;
    heroId: HeroId;
    alive: boolean;
    hp: number;
    maxHp: number;
    level: number;
  }[];
};

export type LanePayload = LaneSnap | LaneSummary;

export function isLaneSummary(p: LanePayload): p is LaneSummary {
  return (p as LaneSummary).summary === true;
}

export type MatchSnap = {
  mode: MatchMode;
  myTeam: MpTeam;
  viewTeam: MpTeam;
  lanes: [LanePayload, LanePayload];
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
    chooseBaseBranch: null,
    rerollLevel: false,
    rerollRelic: false,
    viewOpponent: null,
    mobilityHeld: false,
  };
}
