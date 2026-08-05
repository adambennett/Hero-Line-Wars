/** Named run configurations shared by Singleplayer, Multiplayer, and Campaign. */

import type { RunOptions } from "../game/state";
import { MAP_LIST } from "../data/maps";
import { RUN_OPTION_DEFAULTS } from "../ui/runOptionsMeta";
import {
  clampUnitSize,
  type CritLotteryMode,
  type EnemyMutationMode,
  type RelicDropMode,
} from "./creativeOptions";
import {
  deriveDisableFlags,
  emptyContentFilters,
  sanitizeContentFilters,
  type GameTypeContentFilters,
} from "./contentFilters";

export type SendLocation = "own" | "enemy";
export type ArtifactPlacementMode = "free" | "locked";

/** All option fields a Game Type owns (map/ascension/AI stay per-lobby). */
export type GameTypeOptions = {
  maxTurrets: number;
  startingGold: number;
  wavesToWin: number;
  livesPerWave: number;
  livesPerRun: number;
  utilityDraftLevel: number;
  friendlyFire: boolean;
  /** No rival lane — solo survival. */
  endless: boolean;
  /** Where bought send packs go. */
  sendLocation: SendLocation;
  chestOpenMul: number;
  chestDespawnSec: number;
  chestSpawnChance: number;
  enemyDensityMul: number;
  enemyHpMul: number;
  enemySpeedMul: number;
  incomeMul: number;
  respawnMul: number;
  startingBaseLevel: number;
  levelDraftSize: number;
  relicDraftSize: number;
  allyAi: number;
  suddenDeathBaseHp: number;
  fogThicknessPct: number;
  fogVisionRadius: number;
  waveBreakSec: number;
  disableArtifacts: boolean;
  disableChests: boolean;
  disableElites: boolean;
  disableBosses: boolean;
  disableShop: boolean;
  disableSends: boolean;
  disableRelics: boolean;
  fogAlways: boolean;
  doubleElites: boolean;
  glassCannon: boolean;
  goldRush: boolean;
  wildChests: boolean;
  crampedLane: boolean;
  playerBaseInvincible: boolean;
  enemyBaseInvincible: boolean;
  /** Lane-clear move % (−100..3000). */
  laneClearSpeedPct: number;
  respawnMinigame: boolean;
  artifactPlacement: ArtifactPlacementMode;
  allowBarracks: boolean;
  /** Creative extras (v0.0.6). */
  relicDrop: RelicDropMode;
  enemyProjectileDmgMul: number;
  enemyCollisionDmgMul: number;
  playerDmgLmbMul: number;
  playerDmgRmbMul: number;
  playerDmgMmbMul: number;
  wallBounciness: number;
  playerSpeedMul: number;
  playerSizeMul: number;
  enemySizeMul: number;
  critLottery: CritLotteryMode;
  enemyMutation: EnemyMutationMode;
  randomizeUtilityWave: boolean;
  doubleAllProjectiles: boolean;
  immuneToProjectiles: boolean;
  randomizeHeroWave: boolean;
  randomizeMapWave: boolean;
  artifactDamageDoubled: boolean;
  artifactsFree: boolean;
  itemsFree: boolean;
  infiniteRerolls: boolean;
  thornsAura: boolean;
  bloodTax: boolean;
  echoBarrage: boolean;
  pacifistPays: boolean;
  berserkerEdge: boolean;
  slipNSlide: boolean;
  vampiricCreeps: boolean;
  corpseExplosion: boolean;
  bounceHouse: boolean;
  /**
   * Content disabled lists per category. Empty categories = full pool.
   * Some built-ins (e.g. Grandma's House) author map locks via filters.
   */
  contentFilters: GameTypeContentFilters;
};

const CREATIVE_BOOL_KEYS = [
  "randomizeUtilityWave",
  "doubleAllProjectiles",
  "immuneToProjectiles",
  "randomizeHeroWave",
  "randomizeMapWave",
  "artifactDamageDoubled",
  "artifactsFree",
  "itemsFree",
  "infiniteRerolls",
  "thornsAura",
  "bloodTax",
  "echoBarrage",
  "pacifistPays",
  "berserkerEdge",
  "slipNSlide",
  "vampiricCreeps",
  "corpseExplosion",
  "bounceHouse",
] as const;

const CREATIVE_NUM_KEYS = [
  "enemyProjectileDmgMul",
  "enemyCollisionDmgMul",
  "playerDmgLmbMul",
  "playerDmgRmbMul",
  "playerDmgMmbMul",
  "wallBounciness",
  "playerSpeedMul",
  "playerSizeMul",
  "enemySizeMul",
] as const;

const SIZE_MUL_KEYS = new Set<(typeof CREATIVE_NUM_KEYS)[number]>([
  "playerSizeMul",
  "enemySizeMul",
]);

export type GameTypeDef = {
  id: string;
  name: string;
  /** Short player-facing blurb (lists / summaries). */
  description: string;
  /** Built-in types cannot be deleted. */
  builtin: boolean;
  options: GameTypeOptions;
};

const STORAGE_KEY = "hlw-game-types-v1";
/** v2: SP/MP factory default is Outlast (v1 often stuck on Race/Standard). */
const SELECTED_KEY = "hlw-game-type-selected-v2";

export const GAME_TYPE_BUNDLE_FORMAT = "hlw-game-type-v1";

const DESCRIPTIONS = {
  race: "Classic race to the wave goal or base kill.",
  outlast: "Same as Race, but waves never end. Survive until a base falls.",
  survival: "Ten lives, invincible bases, unlimited waves.",
} as const;

export function defaultGameTypeOptions(): GameTypeOptions {
  const d = RUN_OPTION_DEFAULTS;
  return {
    maxTurrets: d.maxTurrets,
    startingGold: d.startingGold,
    wavesToWin: d.wavesToWin,
    livesPerWave: d.livesPerWave,
    livesPerRun: d.livesPerRun,
    utilityDraftLevel: d.utilityDraftLevel,
    friendlyFire: d.friendlyFire,
    endless: d.endless,
    sendLocation: "enemy",
    chestOpenMul: d.chestOpenMul,
    chestDespawnSec: d.chestDespawnSec,
    chestSpawnChance: d.chestSpawnChance,
    enemyDensityMul: d.enemyDensityMul,
    enemyHpMul: d.enemyHpMul,
    enemySpeedMul: d.enemySpeedMul,
    incomeMul: d.incomeMul,
    respawnMul: d.respawnMul,
    startingBaseLevel: d.startingBaseLevel,
    levelDraftSize: d.levelDraftSize,
    relicDraftSize: d.relicDraftSize,
    allyAi: d.allyAi,
    suddenDeathBaseHp: d.suddenDeathBaseHp,
    fogThicknessPct: d.fogThicknessPct,
    fogVisionRadius: d.fogVisionRadius,
    waveBreakSec: d.waveBreakSec,
    disableArtifacts: d.disableArtifacts,
    disableChests: d.disableChests,
    disableElites: d.disableElites,
    disableBosses: d.disableBosses,
    disableShop: d.disableShop,
    disableSends: d.disableSends,
    disableRelics: d.disableRelics,
    fogAlways: d.fogAlways,
    doubleElites: d.doubleElites,
    glassCannon: d.glassCannon,
    goldRush: d.goldRush,
    wildChests: d.wildChests,
    crampedLane: d.crampedLane,
    playerBaseInvincible: d.playerBaseInvincible,
    enemyBaseInvincible: d.enemyBaseInvincible,
    laneClearSpeedPct: d.laneClearSpeedPct,
    respawnMinigame: d.respawnMinigame,
    artifactPlacement: d.artifactPlacement,
    allowBarracks: d.allowBarracks,
    relicDrop: d.relicDrop,
    enemyProjectileDmgMul: d.enemyProjectileDmgMul,
    enemyCollisionDmgMul: d.enemyCollisionDmgMul,
    playerDmgLmbMul: d.playerDmgLmbMul,
    playerDmgRmbMul: d.playerDmgRmbMul,
    playerDmgMmbMul: d.playerDmgMmbMul,
    wallBounciness: d.wallBounciness,
    playerSpeedMul: d.playerSpeedMul,
    playerSizeMul: d.playerSizeMul,
    enemySizeMul: d.enemySizeMul,
    critLottery: d.critLottery,
    enemyMutation: d.enemyMutation,
    randomizeUtilityWave: d.randomizeUtilityWave,
    doubleAllProjectiles: d.doubleAllProjectiles,
    immuneToProjectiles: d.immuneToProjectiles,
    randomizeHeroWave: d.randomizeHeroWave,
    randomizeMapWave: d.randomizeMapWave,
    artifactDamageDoubled: d.artifactDamageDoubled,
    artifactsFree: d.artifactsFree,
    itemsFree: d.itemsFree,
    infiniteRerolls: d.infiniteRerolls,
    thornsAura: d.thornsAura,
    bloodTax: d.bloodTax,
    echoBarrage: d.echoBarrage,
    pacifistPays: d.pacifistPays,
    berserkerEdge: d.berserkerEdge,
    slipNSlide: d.slipNSlide,
    vampiricCreeps: d.vampiricCreeps,
    corpseExplosion: d.corpseExplosion,
    bounceHouse: d.bounceHouse,
    contentFilters: emptyContentFilters(),
  };
}

export const CORE_BUILTIN_GAME_TYPES: GameTypeDef[] = [
  {
    id: "outlast",
    name: "Outlast",
    description: DESCRIPTIONS.outlast,
    builtin: true,
    options: {
      ...defaultGameTypeOptions(),
      wavesToWin: 0,
      maxTurrets: -1,
      laneClearSpeedPct: 0,
      artifactPlacement: "free",
      allowBarracks: false,
    },
  },
  {
    id: "race",
    name: "Race",
    description: DESCRIPTIONS.race,
    builtin: true,
    options: {
      ...defaultGameTypeOptions(),
      maxTurrets: -1,
      laneClearSpeedPct: 0,
      artifactPlacement: "free",
      allowBarracks: false,
    },
  },
  {
    id: "survival",
    name: "Survival",
    description: DESCRIPTIONS.survival,
    builtin: true,
    options: {
      ...defaultGameTypeOptions(),
      livesPerRun: 10,
      wavesToWin: 0,
      endless: false,
      sendLocation: "enemy",
      playerBaseInvincible: true,
      enemyBaseInvincible: true,
      maxTurrets: -1,
      laneClearSpeedPct: 0,
      artifactPlacement: "free",
      allowBarracks: false,
    },
  },
];

/** Filled after clampOptions — full built-in list. */
export let BUILTIN_GAME_TYPES: GameTypeDef[] = CORE_BUILTIN_GAME_TYPES;

function clampOptions(raw: Partial<GameTypeOptions> | undefined): GameTypeOptions {
  const base = defaultGameTypeOptions();
  if (!raw || typeof raw !== "object") return base;
  const num = (v: unknown, fb: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fb;
  const bool = (v: unknown, fb: boolean) => (typeof v === "boolean" ? v : fb);
  const send: SendLocation =
    raw.sendLocation === "own" || raw.sendLocation === "enemy" ? raw.sendLocation : base.sendLocation;
  const place: ArtifactPlacementMode =
    raw.artifactPlacement === "locked" || raw.artifactPlacement === "free"
      ? raw.artifactPlacement
      : base.artifactPlacement;
  // Migrate old boolean laneClearBoost → pct
  let lanePct = num(raw.laneClearSpeedPct, Number.NaN);
  if (!Number.isFinite(lanePct)) {
    const legacy = (raw as { laneClearBoost?: boolean }).laneClearBoost;
    lanePct = legacy ? 85 : base.laneClearSpeedPct;
  }
  return {
    maxTurrets: num(raw.maxTurrets, base.maxTurrets),
    startingGold: num(raw.startingGold, base.startingGold),
    wavesToWin: num(raw.wavesToWin, base.wavesToWin),
    livesPerWave: num(raw.livesPerWave, base.livesPerWave),
    livesPerRun: num(raw.livesPerRun, base.livesPerRun),
    utilityDraftLevel: num(raw.utilityDraftLevel, base.utilityDraftLevel),
    friendlyFire: bool(raw.friendlyFire, base.friendlyFire),
    endless: bool(raw.endless, base.endless),
    sendLocation: send,
    chestOpenMul: num(raw.chestOpenMul, base.chestOpenMul),
    chestDespawnSec: num(raw.chestDespawnSec, base.chestDespawnSec),
    chestSpawnChance: num(raw.chestSpawnChance, base.chestSpawnChance),
    enemyDensityMul: num(raw.enemyDensityMul, base.enemyDensityMul),
    enemyHpMul: num(raw.enemyHpMul, base.enemyHpMul),
    enemySpeedMul: num(raw.enemySpeedMul, base.enemySpeedMul),
    incomeMul: num(raw.incomeMul, base.incomeMul),
    respawnMul: num(raw.respawnMul, base.respawnMul),
    startingBaseLevel: num(raw.startingBaseLevel, base.startingBaseLevel),
    levelDraftSize: num(raw.levelDraftSize, base.levelDraftSize),
    relicDraftSize: num(raw.relicDraftSize, base.relicDraftSize),
    allyAi: num(raw.allyAi, base.allyAi),
    suddenDeathBaseHp: num(raw.suddenDeathBaseHp, base.suddenDeathBaseHp),
    fogThicknessPct: num(raw.fogThicknessPct, base.fogThicknessPct),
    fogVisionRadius: num(raw.fogVisionRadius, base.fogVisionRadius),
    waveBreakSec: num(raw.waveBreakSec, base.waveBreakSec),
    disableArtifacts: bool(raw.disableArtifacts, base.disableArtifacts),
    disableChests: bool(raw.disableChests, base.disableChests),
    disableElites: bool(raw.disableElites, base.disableElites),
    disableBosses: bool(raw.disableBosses, base.disableBosses),
    disableShop: bool(raw.disableShop, base.disableShop),
    disableSends: bool(raw.disableSends, base.disableSends),
    disableRelics: bool(raw.disableRelics, base.disableRelics),
    fogAlways: bool(raw.fogAlways, base.fogAlways),
    doubleElites: bool(raw.doubleElites, base.doubleElites),
    glassCannon: bool(raw.glassCannon, base.glassCannon),
    goldRush: bool(raw.goldRush, base.goldRush),
    wildChests: bool(raw.wildChests, base.wildChests),
    crampedLane: bool(raw.crampedLane, base.crampedLane),
    playerBaseInvincible: bool(raw.playerBaseInvincible, base.playerBaseInvincible),
    enemyBaseInvincible: bool(raw.enemyBaseInvincible, base.enemyBaseInvincible),
    laneClearSpeedPct: lanePct,
    respawnMinigame: bool(raw.respawnMinigame, base.respawnMinigame),
    artifactPlacement: place,
    allowBarracks: bool(raw.allowBarracks, base.allowBarracks),
    relicDrop: clampRelicDrop(raw.relicDrop, base.relicDrop),
    critLottery: clampCrit(raw.critLottery, base.critLottery),
    enemyMutation: clampMutation(raw.enemyMutation, base.enemyMutation),
    ...Object.fromEntries(
      CREATIVE_NUM_KEYS.map((k) => [
        k,
        SIZE_MUL_KEYS.has(k) ? clampUnitSize(num(raw[k], base[k]), base[k]) : num(raw[k], base[k]),
      ]),
    ),
    ...Object.fromEntries(
      CREATIVE_BOOL_KEYS.map((k) => [k, bool(raw[k], base[k])]),
    ),
    contentFilters: sanitizeContentFilters(
      (raw as { contentFilters?: unknown }).contentFilters ?? base.contentFilters,
    ),
  } as GameTypeOptions;
}

function clampRelicDrop(v: unknown, fb: RelicDropMode): RelicDropMode {
  const ok: RelicDropMode[] = [
    "elites_bosses",
    "bosses_only",
    "elites_only",
    "every_wave",
    "never",
  ];
  return typeof v === "string" && (ok as string[]).includes(v) ? (v as RelicDropMode) : fb;
}

function clampCrit(v: unknown, fb: CritLotteryMode): CritLotteryMode {
  const ok: CritLotteryMode[] = ["off", "ten", "twentyfive", "fifty", "always"];
  return typeof v === "string" && (ok as string[]).includes(v) ? (v as CritLotteryMode) : fb;
}

function clampMutation(v: unknown, fb: EnemyMutationMode): EnemyMutationMode {
  const ok: EnemyMutationMode[] = ["none", "speedy", "tanky", "glass", "mixed"];
  return typeof v === "string" && (ok as string[]).includes(v) ? (v as EnemyMutationMode) : fb;
}

/** Disable every map except `keepId` (content filters store *disabled* ids). */
function filtersOnlyMap(keepId: string): GameTypeContentFilters {
  return {
    ...emptyContentFilters(),
    maps: MAP_LIST.map((m) => String(m.id)).filter((id) => id !== keepId),
  };
}

function builtinType(
  id: string,
  name: string,
  description: string,
  options: Partial<GameTypeOptions>,
): GameTypeDef {
  return {
    id,
    name,
    description,
    builtin: true,
    options: clampOptions(options),
  };
}

/**
 * Named presets after Outlast / Race / Survival.
 * Order: Endless → Brutal → Fiesta Outlast → Fiesta Race → Fiesta Survival →
 * Giant Explosive Race → Grandma's House.
 * (Grandma's House is also excluded from Random map rolls — see maps.pickRandomMap.)
 */
const EXTRA_BUILTIN_GAME_TYPES: GameTypeDef[] = [
  builtinType(
    "endless",
    "Endless",
    "PvE endless survival. Sends go to your own lane. Survive as long as you can.",
    {
      maxTurrets: -1,
      wavesToWin: 0,
      sendLocation: "own",
      laneClearSpeedPct: 0,
      artifactPlacement: "free",
      allowBarracks: false,
    },
  ),
  builtinType(
    "brutal",
    "Brutal",
    "All difficulty settings are ramped up considerably. 5 lives per run until you lose, with only 1 life per wave. Survive 25 waves to win. Friendly fire enabled.",
    {
      maxTurrets: -1,
      startingGold: 0,
      wavesToWin: 25,
      livesPerWave: 1,
      livesPerRun: 5,
      utilityDraftLevel: 10,
      friendlyFire: true,
      enemyDensityMul: 2,
      enemyHpMul: 2,
      enemySpeedMul: 1.5,
      incomeMul: 0.75,
      respawnMul: 1.25,
      levelDraftSize: 2,
      relicDraftSize: 2,
      allyAi: 0.7,
      suddenDeathBaseHp: 60,
      fogThicknessPct: 100,
      fogVisionRadius: 160,
      waveBreakSec: 15,
      doubleElites: true,
      enemyBaseInvincible: true,
      laneClearSpeedPct: 200,
      artifactPlacement: "free",
      relicDrop: "bosses_only",
      enemyProjectileDmgMul: 1.5,
      enemyCollisionDmgMul: 3,
      playerDmgLmbMul: 0.5,
      playerSpeedMul: 0.75,
      playerSizeMul: 1.5,
      enemySizeMul: 0.75,
      allowBarracks: false,
    },
  ),
  builtinType(
    "fiesta_outlast",
    "Fiesta Outlast",
    "Many randomization settings are enabled. Otherwise, it's the standard Outlast mode.",
    {
      maxTurrets: -1,
      wavesToWin: 0,
      chestDespawnSec: 20,
      chestSpawnChance: 0.12,
      relicDraftSize: 2,
      waveBreakSec: 5,
      laneClearSpeedPct: 0,
      artifactPlacement: "free",
      relicDrop: "every_wave",
      randomizeUtilityWave: true,
      randomizeHeroWave: true,
      randomizeMapWave: true,
      allowBarracks: false,
    },
  ),
  builtinType(
    "fiesta_race",
    "Fiesta Race",
    "Many randomization settings are enabled. Otherwise, it's a standard Race mode to 15 waves.",
    {
      maxTurrets: -2,
      startingGold: 45,
      wavesToWin: 15,
      chestDespawnSec: 20,
      chestSpawnChance: 0.12,
      relicDraftSize: 2,
      waveBreakSec: 5,
      laneClearSpeedPct: 200,
      artifactPlacement: "free",
      relicDrop: "every_wave",
      randomizeUtilityWave: true,
      randomizeHeroWave: true,
      randomizeMapWave: true,
      allowBarracks: false,
    },
  ),
  builtinType(
    "fiesta_survival",
    "Fiesta Survival",
    "Many randomization settings are enabled. Otherwise, it's the standard Survival mode.",
    {
      maxTurrets: -1,
      wavesToWin: 0,
      livesPerRun: 10,
      chestDespawnSec: 20,
      chestSpawnChance: 0.12,
      relicDraftSize: 2,
      waveBreakSec: 5,
      playerBaseInvincible: true,
      enemyBaseInvincible: true,
      laneClearSpeedPct: 0,
      artifactPlacement: "free",
      relicDrop: "every_wave",
      randomizeUtilityWave: true,
      randomizeHeroWave: true,
      randomizeMapWave: true,
      allowBarracks: false,
    },
  ),
  builtinType(
    "giant_explosive_race",
    "Giant Explosive Race",
    "Race mode but with CHONK, infinite shop rerolls, and corpse explosions",
    {
      maxTurrets: -1,
      wavesToWin: 10,
      utilityDraftLevel: 10,
      playerSizeMul: 5,
      enemySizeMul: 5,
      infiniteRerolls: true,
      corpseExplosion: true,
      laneClearSpeedPct: 0,
      artifactPlacement: "free",
      allowBarracks: false,
    },
  ),
  builtinType(
    "grandmas_house",
    "Grandma's House",
    "Duke it out in a box of death. Survive 20 waves to win.",
    {
      maxTurrets: -2,
      startingGold: 1000,
      wavesToWin: 10,
      endless: true,
      sendLocation: "own",
      chestOpenMul: 1.5,
      chestDespawnSec: 12,
      chestSpawnChance: 0.12,
      enemyDensityMul: 5,
      enemySpeedMul: 10,
      incomeMul: 2,
      respawnMul: 0,
      waveBreakSec: 0,
      fogThicknessPct: 25,
      fogVisionRadius: 60,
      disableElites: true,
      disableBosses: true,
      goldRush: true,
      laneClearSpeedPct: 0,
      respawnMinigame: false,
      artifactPlacement: "free",
      relicDrop: "every_wave",
      enemyProjectileDmgMul: -1,
      enemyCollisionDmgMul: -1,
      playerDmgLmbMul: -1,
      playerDmgRmbMul: -1,
      playerDmgMmbMul: -1,
      wallBounciness: 50,
      playerSpeedMul: 10,
      playerSizeMul: 0.5,
      enemySizeMul: 0.5,
      critLottery: "twentyfive",
      doubleAllProjectiles: true,
      randomizeHeroWave: true,
      artifactDamageDoubled: true,
      infiniteRerolls: true,
      thornsAura: true,
      echoBarrage: true,
      berserkerEdge: true,
      slipNSlide: true,
      corpseExplosion: true,
      bounceHouse: true,
      allowBarracks: false,
      contentFilters: filtersOnlyMap("grandma_house"),
    },
  ),
];

BUILTIN_GAME_TYPES = [...CORE_BUILTIN_GAME_TYPES, ...EXTRA_BUILTIN_GAME_TYPES];

function sanitizeDescription(raw: unknown, name: string): string {
  if (typeof raw === "string" && raw.trim()) return raw.trim().slice(0, 160);
  return `${name} custom rules.`;
}

function sanitizeCustom(list: unknown): GameTypeDef[] {
  if (!Array.isArray(list)) return [];
  const out: GameTypeDef[] = [];
  const used = new Set(BUILTIN_GAME_TYPES.map((t) => t.id));
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== "string" || !r.id || used.has(r.id)) continue;
    if (typeof r.name !== "string" || !r.name.trim()) continue;
    used.add(r.id);
    const name = r.name.trim().slice(0, 40);
    out.push({
      id: r.id.slice(0, 48),
      name,
      description: sanitizeDescription(r.description, name),
      builtin: false,
      options: clampOptions(r.options as Partial<GameTypeOptions>),
    });
  }
  return out;
}

export function loadCustomGameTypes(): GameTypeDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return sanitizeCustom(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveCustomGameTypes(list: GameTypeDef[]): void {
  const customs = list.filter((t) => !t.builtin).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    options: t.options,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customs));
}

/** Built-ins first, then user types (newest custom last). */
export function listGameTypes(): GameTypeDef[] {
  return [...BUILTIN_GAME_TYPES, ...loadCustomGameTypes()];
}

/** All custom types except the given id. */
export function loadCustomListSans(exceptId: string): GameTypeDef[] {
  return loadCustomGameTypes().filter((t) => t.id !== exceptId);
}

/** Normalize legacy ids (standard → race). */
export function normalizeGameTypeId(id: string | null | undefined): string {
  if (!id) return "outlast";
  if (id === "standard") return "race";
  return id;
}

export function getGameType(id: string | null | undefined): GameTypeDef {
  const all = listGameTypes();
  const nid = normalizeGameTypeId(id);
  return all.find((t) => t.id === nid) ?? all[0]!;
}

export function loadSelectedGameTypeId(): string {
  try {
    const id = localStorage.getItem(SELECTED_KEY);
    const nid = normalizeGameTypeId(id);
    if (listGameTypes().some((t) => t.id === nid)) return nid;
  } catch {
    /* ignore */
  }
  return "outlast";
}

export function saveSelectedGameTypeId(id: string): void {
  localStorage.setItem(SELECTED_KEY, normalizeGameTypeId(id));
}

export function newGameTypeId(): string {
  return `gt_${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultGameTypeDescription(name: string): string {
  return `${name.trim() || "Custom"} rules — edit this blurb in the Game Type Editor.`;
}

/** Map a Game Type into run launch options. */
export function gameTypeToRunOptions(opts: GameTypeOptions): Partial<RunOptions> {
  const endless = !!opts.endless;
  const derived = deriveDisableFlags(opts.contentFilters);
  return {
    maxTurrets: derived.disableArtifacts ? 0 : opts.maxTurrets,
    startingGold: opts.startingGold,
    wavesToWin: endless ? 0 : opts.wavesToWin,
    livesPerWave: opts.livesPerWave,
    livesPerRun: opts.livesPerRun,
    friendlyFire: endless ? false : opts.friendlyFire,
    utilityDraftLevel: opts.utilityDraftLevel,
    endless,
    sendLocation: opts.sendLocation,
    chestOpenMul: opts.chestOpenMul,
    chestDespawnSec: opts.chestDespawnSec,
    chestSpawnChance: opts.chestSpawnChance,
    enemyDensityMul: opts.enemyDensityMul,
    enemyHpMul: opts.enemyHpMul,
    enemySpeedMul: opts.enemySpeedMul,
    incomeMul: opts.incomeMul,
    respawnMul: opts.respawnMul,
    startingBaseLevel: opts.startingBaseLevel,
    levelDraftSize: derived.disableBonuses ? 0 : opts.levelDraftSize,
    relicDraftSize: derived.disableRelics ? 0 : opts.relicDraftSize,
    allyAiAggression: opts.allyAi,
    suddenDeathBaseHp: opts.suddenDeathBaseHp > 0 ? opts.suddenDeathBaseHp : undefined,
    fogThicknessPct: opts.fogThicknessPct,
    fogVisionRadius: opts.fogVisionRadius,
    waveBreakSec: opts.waveBreakSec,
    disableArtifacts: opts.disableArtifacts || derived.disableArtifacts,
    disableChests: opts.disableChests,
    disableElites: opts.disableElites,
    disableBosses: opts.disableBosses || derived.disableBosses,
    disableShop: opts.disableShop,
    disableSends: opts.disableSends || derived.disableSends,
    disableRelics: opts.disableRelics || derived.disableRelics,
    disableBonuses: derived.disableBonuses,
    disableBaseUpgrades: derived.disableBaseUpgrades,
    fogAlways: opts.fogAlways,
    doubleElites: opts.doubleElites,
    glassCannon: opts.glassCannon,
    goldRush: opts.goldRush,
    wildChests: opts.wildChests,
    crampedLane: opts.crampedLane,
    playerBaseInvincible: opts.playerBaseInvincible,
    enemyBaseInvincible: opts.enemyBaseInvincible,
    laneClearSpeedPct: opts.laneClearSpeedPct,
    respawnMinigame: opts.respawnMinigame,
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
    contentFilters: opts.contentFilters ?? emptyContentFilters(),
  };
}

function creativeSlice(opts: GameTypeOptions) {
  return {
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
}

/** Fields for MultplayerUi / Lobby extras (parity with SP). */
export function gameTypeToMpExtras(opts: GameTypeOptions) {
  const derived = deriveDisableFlags(opts.contentFilters);
  return {
    utilityDraftLevel: opts.utilityDraftLevel,
    livesPerWave: opts.livesPerWave,
    livesPerRun: opts.livesPerRun,
    chestOpenMul: opts.chestOpenMul,
    chestDespawnSec: opts.chestDespawnSec,
    chestSpawnChance: opts.chestSpawnChance,
    enemyDensityMul: opts.enemyDensityMul,
    enemyHpMul: opts.enemyHpMul,
    enemySpeedMul: opts.enemySpeedMul,
    incomeMul: opts.incomeMul,
    respawnMul: opts.respawnMul,
    startingBaseLevel: opts.startingBaseLevel,
    levelDraftSize: derived.disableBonuses ? 0 : opts.levelDraftSize,
    relicDraftSize: derived.disableRelics ? 0 : opts.relicDraftSize,
    disableArtifacts: opts.disableArtifacts || derived.disableArtifacts,
    disableChests: opts.disableChests,
    disableElites: opts.disableElites,
    disableBosses: opts.disableBosses || derived.disableBosses,
    disableShop: opts.disableShop,
    disableSends: opts.disableSends || derived.disableSends,
    disableRelics: opts.disableRelics || derived.disableRelics,
    disableBonuses: derived.disableBonuses,
    disableBaseUpgrades: derived.disableBaseUpgrades,
    fogAlways: opts.fogAlways,
    fogThicknessPct: opts.fogThicknessPct,
    fogVisionRadius: opts.fogVisionRadius,
    doubleElites: opts.doubleElites,
    suddenDeathBaseHp: opts.suddenDeathBaseHp,
    glassCannon: opts.glassCannon,
    goldRush: opts.goldRush,
    wildChests: opts.wildChests,
    crampedLane: opts.crampedLane,
    playerBaseInvincible: opts.playerBaseInvincible,
    enemyBaseInvincible: opts.enemyBaseInvincible,
    waveBreakSec: opts.waveBreakSec,
    laneClearSpeedPct: opts.laneClearSpeedPct,
    respawnMinigame: opts.respawnMinigame,
    sendLocation: opts.sendLocation,
    artifactPlacement: opts.artifactPlacement,
    allowBarracks: opts.allowBarracks,
    ...creativeSlice(opts),
    contentFilters: opts.contentFilters ?? emptyContentFilters(),
  };
}

export function gameTypeSelectHtml(
  selectedId: string,
  field = "game-type",
  disabled = false,
): string {
  const nid = normalizeGameTypeId(selectedId);
  const opts = listGameTypes()
    .map((t) => {
      return `<option value="${escapeAttr(t.id)}" ${t.id === nid ? "selected" : ""}>${escapeAttr(t.name)}${t.builtin ? "" : " ★"}</option>`;
    })
    .join("");
  return `<label class="run-field" data-tip="${escapeAttr("Named run rules. Description shown in lists.")}">
      <span>Game type</span>
      <select data-field="${field}" id="${field}" ${disabled ? "disabled" : ""} data-tip="${escapeAttr(getGameType(nid).description)}">${opts}</select>
    </label>`;
}

function escapeAttr(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function exportGameTypeJson(def: GameTypeDef): void {
  const payload = {
    format: GAME_TYPE_BUNDLE_FORMAT,
    gameType: {
      id: def.id,
      name: def.name,
      description: def.description,
      options: def.options,
    },
  };
  const safe = def.name.replace(/[^\w\-]+/g, "_").slice(0, 40) || "gametype";
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hlw-gametype-${safe}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importGameTypeJson(raw: unknown): GameTypeDef | string {
  if (!raw || typeof raw !== "object") return "Invalid JSON";
  const root = raw as Record<string, unknown>;
  const body =
    root.format === GAME_TYPE_BUNDLE_FORMAT && root.gameType && typeof root.gameType === "object"
      ? (root.gameType as Record<string, unknown>)
      : root;
  if (typeof body.name !== "string" || !body.name.trim()) return "Missing name";
  const name = body.name.trim().slice(0, 40);
  let id =
    typeof body.id === "string" && body.id && !BUILTIN_GAME_TYPES.some((b) => b.id === body.id)
      ? body.id.slice(0, 48)
      : newGameTypeId();
  if (listGameTypes().some((t) => t.id === id && !t.builtin)) {
    id = newGameTypeId();
  }
  return {
    id,
    name,
    description: sanitizeDescription(body.description, name),
    builtin: false,
    options: clampOptions(body.options as Partial<GameTypeOptions>),
  };
}

