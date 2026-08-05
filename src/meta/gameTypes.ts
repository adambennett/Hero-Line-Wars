/** Named run configurations shared by Singleplayer, Multiplayer, and Campaign. */

import type { RunOptions } from "../game/state";
import { RUN_OPTION_DEFAULTS } from "../ui/runOptionsMeta";
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
  /**
   * Content disabled lists per category. Empty categories = full pool.
   * Built-ins always use empty filters (everything enabled).
   */
  contentFilters: GameTypeContentFilters;
};

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
  survival: "Ten lives, invincible bases, unlimited waves. Sends go to the enemy lane.",
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
    contentFilters: emptyContentFilters(),
  };
}

export const BUILTIN_GAME_TYPES: GameTypeDef[] = [
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
    contentFilters: sanitizeContentFilters(
      (raw as { contentFilters?: unknown }).contentFilters ?? base.contentFilters,
    ),
  };
}

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
  const found = all.find((t) => t.id === nid) ?? all[0]!;
  if (found.builtin) {
    return {
      ...found,
      options: { ...found.options, contentFilters: emptyContentFilters() },
    };
  }
  return found;
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
    contentFilters: opts.contentFilters ?? emptyContentFilters(),
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

