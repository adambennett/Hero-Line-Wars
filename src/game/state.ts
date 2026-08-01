import {
  BASE_INCOME_GOLD_PER_SEC,
  MAP_W,
  RESPAWN,
  STARTING_GOLD,
  WAVE_BREAK_SEC,
  WAVE_SCALE,
  WIN_WAVES,
  ENEMIES_PER_WAVE_BASE,
} from "../data/constants";
import {
  pickEnemyKind,
  waveTier,
  type EnemyIntent,
  type EnemyKind,
  type WaveTier,
} from "../data/enemies";
import { type HeroId } from "../data/heroes";
import {
  circleHitsObstacle,
  reshuffleObstacles,
  findClearSpot,
  blockedByObstacle,
  resolveMapChoice,
  mapRespawn,
  nearAnyShop,
  type MapDef,
  type MapId,
} from "../data/maps";
import { resolveHero, resolveMap, heroUsesGyroKit, heroUsesWarpKit } from "../custom/registry";
import { createOpponent, onPlayerWaveStart, updateOpponent, type OpponentState } from "../systems/opponent";
import { draftRelicChoices, type RelicId } from "../data/relics";
import { rollShopOffer, type ShopItemId } from "../data/shop";
import { DEFAULT_MAX_TURRETS, type TurretKind } from "../data/turrets";
import type { LevelPassiveId } from "../data/xp";
import { DEFAULT_UTILITY_DRAFT_LEVEL, type UtilityId } from "../data/utilities";
import { clamp, dist, normalize } from "./math";
import type { Input } from "../systems/input";
import {
  applyCurseChoice,
  clearTeleporters,
  fireChargedBladeHook,
  tickAbilityEffects,
  tickHeroKits,
  tryCastAbility,
} from "../systems/abilities";
import type { CurseId } from "../data/curses";
import {
  applyPlayerDamage,
  applySlow,
  bounceProjectile,
  damageEnemy,
  inHighGround,
  resolveHostileProjectile,
  steerSeekingProjectile,
  applyMagnetPull,
  tryBasicAttack,
} from "../systems/combat";
import { createEnemy, updateEnemies } from "../systems/enemies";
import { applySecondWind, applyWaveRider, pickRelic, tryPhoenixRevive } from "../systems/relics";
import { beginWaveShop, buyShopItem, tickShopRotation } from "../systems/shop";
import { buySendPack, consumePendingSends, availableSendPacks } from "../systems/send";
import { tryUpgradeBase } from "../systems/baseUpgrade";
import { chooseLevelPassive, openLevelDraft } from "../systems/xp";
import { applyUtilityChoice, tickUtilityEffects, tryCastUtility } from "../systems/utility";
import { updateTurrets } from "../systems/turrets";
import { tickChests, tickMapSpecials } from "../systems/chests";
import { playSfx } from "../systems/audio";
import { pickEliteKind, pickBossKind } from "../data/enemies";
import { defaultModifiers, type RunModifiers } from "../meta/modifiers";
import { emptyBranchMods } from "../data/baseBranches";
import { areCheatsEnabled, loadCheatOptions } from "../meta/cheats";
import { loadSettings } from "../ui/settings";

export type Unit = {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  alive: boolean;
  sent?: boolean;
};

export type ChestRarity = "common" | "uncommon" | "rare" | "mythic";

export type ChestUnit = {
  id: number;
  x: number;
  y: number;
  radius: number;
  rarity: ChestRarity;
  /** Seconds standing required to open. */
  openDuration: number;
  /** Progress while player stands on it. */
  openProgress: number;
  /** Lifetime remaining before despawn. */
  life: number;
};

export type EnemyUnit = Unit & {
  kind: EnemyKind;
  intent: EnemyIntent;
  speed: number;
  contactDamage: number;
  baseDamage: number;
  goldReward: number;
  ranged: boolean;
  attackRange: number;
  attackCooldown: number;
  attackCd: number;
  attackDamage: number;
  projectileSpeed: number;
  slamRadius?: number;
  slamDamage?: number;
  slamCooldown?: number;
  slamCd?: number;
  telegraph: number;
  turretDamage?: number;
  slowTimer?: number;
  slowMul?: number;
  stuckTimer?: number;
  /** Cumulative time spent stuck this life (despawn watchdog). */
  stuckTotal?: number;
  /** Consecutive failed local unstuck nudges. */
  stuckCount?: number;
  preferAngle?: number;
  /** Sticky flank when routing around cover: -1 = above, +1 = below. */
  pathSide?: -1 | 1;
  /** Time spent holding a ranged shot without advancing. */
  campTimer?: number;
  dashTimer?: number;
  dashCd?: number;
  /** Poison / burn DoT from hex / ember basics. */
  dotTimer?: number;
  dotDps?: number;
  burnTimer?: number;
  burnDps?: number;
};

export type TurretUnit = {
  id: number;
  kind: TurretKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  alive: boolean;
  fireCd: number;
  slotIndex: number;
};

export type ProjectileKind = "bolt" | "pellet" | "heavy" | "enemy";

export type Projectile = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  alive: boolean;
  radius: number;
  kind?: ProjectileKind;
  color?: string;
  bouncesLeft?: number;
  pierceLeft?: number;
  life?: number;
  hostile?: boolean;
  fromBasic?: boolean;
  appliesSlow?: boolean;
  /** Hostile AoE blast radius on hit / expire / wall. */
  aoeRadius?: number;
  /** Slow applied to hero when this hostile projectile connects. */
  heroSlowMul?: number;
  heroSlowDuration?: number;
  /** Curses basic: apply poison DoT on hit. */
  hexDot?: boolean;
  /** Ember basic: apply burn DoT on hit. */
  burnDot?: boolean;
  /** Medic syringe: heal hero on hit. */
  healOnHit?: number;
  /** Lodestone magnet bolt: pull enemy toward hero on hit. */
  magnetPull?: number;
  /** Hive drone: gently seek nearest enemy each frame. */
  seek?: boolean;
};

export type MapOrb = {
  x: number;
  y: number;
  radius: number;
  /** Seconds until detonation. */
  fuse: number;
  damage: number;
};

export type FxRing = {
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
};

export type PendingSend = {
  enemies: number;
  hpScale: number;
};

export type BeamFx = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
};

export type GameStatus = "playing" | "won" | "lost";
export type DraftKind = "relic" | "level" | "base" | "utility" | "curse" | "chest" | null;

export type TeleporterPad = {
  x: number;
  y: number;
};

export type TeleporterState = {
  a: TeleporterPad | null;
  b: TeleporterPad | null;
  linked: boolean;
  /** After first link, alternate which pad the next mobility replaces. */
  nextReplace: "a" | "b";
  /** Per-pad shockwave cooldown after leaving that pad. */
  shockCdA?: number;
  shockCdB?: number;
};

export type ChestRewardOption =
  | { kind: "gold"; amount: number; label: string; blurb: string }
  | { kind: "item"; itemId: ShopItemId; label: string; blurb: string }
  | { kind: "relic"; relicId: RelicId; label: string; blurb: string };

export type BladeMode = "wrapped" | "flying" | "sling" | "rewinding" | "reforming";

export type HexZone = {
  x: number;
  y: number;
  radius: number;
  life: number;
  dps: number;
};

export type OutgoingCurse = {
  shopBlock: number;
  sendBlock: number;
  upgradeBlock: number;
  incomeTaxMul: number;
  incomeTaxDuration: number;
  fogDuration: number;
  shopRefreshSlow: number;
  shopRefreshDuration: number;
};

export type HeroRuntime = Unit & {
  heroId: HeroId;
  attackCd: number;
  abilityCds: number[];
  speedBonus: number;
  damageBonus: number;
  attackSpeedMul: number;
  killGoldBonus: number;
  barrierTimer: number;
  whirlwindTimer: number;
  /** Crit chance 0–1 from level luck passives. */
  luck: number;
  marksmanTimer?: number;
  chaosIndex?: number;
  overchargeTimer?: number;
  zipSpeedTimer?: number;
  stormCageTimer?: number;
  /** Mirage Afterimage: next basic empowered. */
  mirageEmpowered?: boolean;
  /** Temporary movement slow from hexer bolts etc. */
  slowMul?: number;
  slowTimer?: number;
  /** Warp Gatewalker speed after pad hop. */
  gatewalkTimer?: number;
  /** Gyro: spin charge 0–1 while holding attack. */
  bladeSpin?: number;
  bladeAngle?: number;
  bladeMode?: BladeMode;
  bladeTipX?: number;
  bladeTipY?: number;
  bladeHookX?: number;
  bladeHookY?: number;
  /** Gyro vulnerable window after Blade Storm. */
  bladeReformTimer?: number;
  /** Ignore attack-hold spin for a moment after spawn (menu LMB leak). */
  bladeSpawnGrace?: number;
  /** Blade Hook hold-to-charge 0–1. */
  bladeHookCharge?: number;
  bladeHookCharging?: boolean;
  bladeFlyDirX?: number;
  bladeFlyDirY?: number;
  bladeFlyRange?: number;
  bladeFlyDist?: number;
  /** Timed mobility states. */
  slideTimer?: number;
  slideVx?: number;
  slideVy?: number;
  chargeTimer?: number;
  chargeVx?: number;
  chargeVy?: number;
  phaseTimer?: number;
  burrowTimer?: number;
  /** Chrona Stasis Field duration. */
  stasisTimer?: number;
  /** Hive Nest Memory orbiting drones (0–5). */
  hiveDrones?: number;
  /** Chrona Rewind Ward: banked damage awaiting clean heal. */
  chronaBank?: number;
  /** Chrona: seconds of clean (no hits) before bank heals. */
  chronaCleanTimer?: number;
  /** Blood Engine kill stacks (0–10). */
  bloodEngineStacks?: number;
  /** Nest Core kill counter toward free send. */
  nestCoreKills?: number;
  /** Multiplayer: which lobby seat controls this hero (null = AI / unowned). */
  controllerSlot?: number | null;
};

export type RunOptions = {
  mapId: MapId | string | "random";
  maxTurrets: number;
  /** Starting gold for the run. */
  startingGold: number;
  /** Waves required to win. `0` = unlimited (base destruction only). */
  wavesToWin: number;
  /**
   * Hero lives per wave. `0` = unlimited (current default).
   * Finite choices typically 1, 2, 3, 5, 10.
   */
  livesPerWave?: number;
  /**
   * Hero lives for the whole run. `0` = unlimited (current default).
   * Finite choices typically 1, 2, 3, 5. Takes priority over wave lives.
   */
  livesPerRun?: number;
  /** Team modes: player projectiles can hurt allies. */
  friendlyFire: boolean;
  /** Ascension difficulty 0..15. */
  ascension: number;
  /** Precomposed modifiers; if omitted, defaults (no meta) are used. */
  modifiers?: RunModifiers;
  /** SP team size: 1 = classic abstract/opponent, 2/3 = dual-lane with AI allies. */
  teamSize?: 1 | 2 | 3;
  /** Solo survival: no enemy lane; sends queue into your own next wave. */
  endless?: boolean;
  /** Chest stand-to-open duration multiplier (1 = default). */
  chestOpenMul?: number;
  /** Seconds before an unopened chest despawns. */
  chestDespawnSec?: number;
  /** Chance per spawn tick to roll a chest while enemies are present (0–1). */
  chestSpawnChance?: number;
  /** Creative / SP options */
  enemyDensityMul?: number;
  enemyHpMul?: number;
  enemySpeedMul?: number;
  incomeMul?: number;
  respawnMul?: number;
  startingBaseLevel?: number;
  levelDraftSize?: number;
  relicDraftSize?: number;
  /** Level when global utility draft appears; −1 = Run Start, 0 = Never. */
  utilityDraftLevel?: number;
  disableArtifacts?: boolean;
  disableChests?: boolean;
  disableElites?: boolean;
  disableBosses?: boolean;
  disableShop?: boolean;
  disableSends?: boolean;
  disableRelics?: boolean;
  allyAiAggression?: number;
  fogAlways?: boolean;
  doubleElites?: boolean;
  suddenDeathBaseHp?: number;
  sharedFriendlyFire?: boolean;
};

export type GameState = {
  status: GameStatus;
  map: MapDef;
  mapId: MapId | string;
  maxTurrets: number;
  startingGold: number;
  /** 0 = unlimited. */
  wavesToWin: number;
  /** Config: 0 = unlimited wave lives. */
  livesPerWave: number;
  /** Config: 0 = unlimited run lives. */
  livesPerRun: number;
  /** Remaining lives this wave (ignored when livesPerWave === 0). */
  waveLivesLeft: number;
  /** Remaining lives this run (ignored when livesPerRun === 0). */
  runLivesLeft: number;
  /** True when wave lives exhausted — no respawn until next wave. */
  waveRespawnBlocked: boolean;
  friendlyFire: boolean;
  ascension: number;
  modifiers: RunModifiers;
  hero: HeroRuntime;
  enemies: EnemyUnit[];
  turrets: TurretUnit[];
  projectiles: Projectile[];
  fx: FxRing[];
  beam: BeamFx | null;
  baseHp: number;
  baseLevel: number;
  gold: number;
  incomePerSec: number;
  wave: number;
  waveTier: WaveTier;
  waveTimer: number;
  spawning: boolean;
  toSpawn: number;
  sentQueue: PendingSend[];
  spawnCd: number;
  nextId: number;
  elapsed: number;
  shopOpen: boolean;
  nearShop: boolean;
  /** Prior-frame nearShop for auto-open edge trigger. */
  wasNearShop: boolean;
  shopOwned: Partial<Record<ShopItemId, number>>;
  shopOffer: ShopItemId[];
  shopRefreshesLeft: number;
  shopRefreshTimer: number;
  /** Frost passive: freeze shop refresh timer. */
  shopFrozen: boolean;
  pendingSends: PendingSend[];
  sendsThisRun: number;
  toast: string;
  toastTimer: number;
  enemyGoldReward: number;
  relics: RelicId[];
  relicDraft: RelicId[] | null;
  level: number;
  xp: number;
  pendingLevelUps: number;
  levelDraft: LevelPassiveId[] | null;
  levelPassives: LevelPassiveId[];
  draftKind: DraftKind;
  pausedForDraft: boolean;
  /** Manual pause (Esc / Pause button). */
  paused: boolean;
  deathCount: number;
  respawnTimer: number;
  damageFlash: number;
  vignette: number;
  hitFlash: number;
  shake: number;
  pendingRelicDraft: boolean;
  /** Phoenix Down revive charges. */
  phoenixCharges?: number;
  /** Lane chests (stand-to-open). */
  chests: ChestUnit[];
  chestSpawnCd: number;
  /** Special map runtime. */
  mapSpecialTimer: number;
  mapHazardX: number;
  mapFogActive: boolean;
  mapActiveSpawner: 0 | 1;
  /** Volatile orb map hazards. */
  mapOrbs: MapOrb[];
  /** Ward Beacon: remaining DR window for heroes (seconds). */
  wardBeaconTimer: number;
  /** Mouse aim in world space (updated each frame from Input). */
  aimWorldX: number;
  aimWorldY: number;
  /** Solo AI opponent lane summary + flip-view viz. */
  opponent: OpponentState;
  /** When true, canvas shows opponent lane instead of player lane. */
  viewOpponentLane: boolean;
  /** Extra human/AI heroes sharing this lane (multiplayer). */
  allies: HeroRuntime[];
  /** Multiplayer lane flag — skip solo opponent AI sim. */
  mpLane?: boolean;
  /** PvE enemy lane driven by simple AI intents. */
  aiControlled?: boolean;
  teamSize: 1 | 2 | 3;
  /** Solo endless survival (no rival lane). */
  endless: boolean;
  chestOpenMul: number;
  chestDespawnSec: number;
  chestSpawnChance: number;
  /** Reroll tokens for level/relic drafts. */
  rerollTokens: number;
  /** Challenge / run tracking. */
  shopBuys: number;
  chestsOpened: number;
  bossesKilled: number;
  elitesKilled: number;
  artifactsPlaced: number;
  levelDraftsTaken: number;
  /** Session combat / economy counters for career stats. */
  damageDealt: number;
  damageTaken: number;
  baseDamageTaken: number;
  healingDone: number;
  kills: number;
  abilitiesCast: number;
  basicsFired: number;
  goldFromKills: number;
  goldFromIncome: number;
  goldSpent: number;
  peakGold: number;
  peakIncome: number;
  baseUpgrades: number;
  /** Soft curses applied TO this lane (from enemy Curses hero / dual-lane). */
  curseShopBlock: number;
  curseSendBlock: number;
  curseUpgradeBlock: number;
  curseIncomeTaxTimer: number;
  curseIncomeTaxMul: number;
  curseFogTimer: number;
  curseShopRefreshSlowTimer: number;
  curseShopRefreshSlowMul: number;
  /** Payload waiting to be applied to the other lane (MP) or opponent. */
  outgoingCurse: OutgoingCurse | null;
  /** Hex Storm: choose 1 of 3 curses (pauses local lane). */
  curseDraft: CurseId[] | null;
  /** Chest open: pick 1 of 2 rewards (pauses local lane in SP). */
  chestDraft: ChestRewardOption[] | null;
  hexZones: HexZone[];
  /** Warp hero teleporter pads (team-usable). */
  teleporters: TeleporterState;
  /** Brief lockout after a pad hop to prevent bounce loops. */
  teleportLock: number;
  /** Global utility (Spacebar slot). */
  utilityId: UtilityId | null;
  utilityCd: number;
  utilityDraft: UtilityId[] | null;
  utilityDraftOffered: boolean;
  utilityDraftLevel: number;
  utilityIncomeBoost: number;
  utilityIncomeAmount: number;
  utilityTurretBoost: number;
  utilitySendDiscount: boolean;
  utilitySprintTimer: number;
  utilityDamageBoost: number;
  utilityBountyKills: number;
  /** Branching base upgrades. */
  baseBranches: import("../data/baseBranches").BaseBranchId[];
  baseBranchDraft: import("../data/baseBranches").BaseBranchId[] | null;
  baseBranchMods: import("../data/baseBranches").BaseBranchMods;
  /** Pending linear upgrade that should open a branch draft. */
  pendingBaseBranch: boolean;
  /** Creative run option mirrors. */
  levelDraftSize: number;
  relicDraftSize: number;
  disableArtifacts: boolean;
  disableChests: boolean;
  disableElites: boolean;
  disableBosses: boolean;
  disableShop: boolean;
  disableSends: boolean;
  disableRelics: boolean;
  fogAlways: boolean;
  doubleElites: boolean;
};

export function createState(
  heroId: HeroId = "ranger",
  opts?: Partial<RunOptions>,
): GameState {
  const mapId = resolveMapChoice(opts?.mapId ?? "random");
  const map = structuredClone(resolveMap(mapId));
  if (map.shiftingObstacles) reshuffleObstacles(map);
  const def = resolveHero(heroId);
  const mods = opts?.modifiers ?? defaultModifiers();
  const startingGold = Math.max(
    0,
    (opts?.startingGold ?? STARTING_GOLD) + mods.startingGoldDelta,
  );
  const endless = !!opts?.endless;
  const wavesToWin = endless ? 0 : (opts?.wavesToWin ?? WIN_WAVES);
  const livesPerWave = Math.max(0, opts?.livesPerWave ?? 0);
  const livesPerRun = Math.max(0, opts?.livesPerRun ?? 0);
  const friendlyFire = opts?.friendlyFire ?? false;
  const baseMax = Math.round(map.base.maxHp * mods.baseHpMul);
  map.base.maxHp = baseMax;
  const maxTurrets =
    (opts?.maxTurrets ?? DEFAULT_MAX_TURRETS) + (mods.applyPlayerMeta ? mods.maxTurretsBonus : 0);
  // Creative run option overlays
  if (opts?.enemyHpMul) mods.enemyHpMul *= opts.enemyHpMul;
  if (opts?.enemySpeedMul) mods.enemySpeedMul *= opts.enemySpeedMul;
  if (opts?.enemyDensityMul) mods.enemyCountMul *= opts.enemyDensityMul;
  if (opts?.incomeMul) mods.incomeMul *= opts.incomeMul;
  if (opts?.respawnMul) mods.respawnMul *= opts.respawnMul;
  if (opts?.sharedFriendlyFire) {
    /* flag used by combat — mirrored via friendlyFire below if needed */
  }
  let baseHp = baseMax;
  if (opts?.suddenDeathBaseHp) {
    baseHp = Math.max(20, Math.round(opts.suddenDeathBaseHp));
    map.base.maxHp = baseHp;
  }
  const startBase = Math.max(0, opts?.startingBaseLevel ?? 0);
  const cheats = areCheatsEnabled() ? loadCheatOptions() : null;
  return {
    status: "playing",
    map,
    mapId,
    maxTurrets: opts?.disableArtifacts ? 0 : maxTurrets,
    startingGold,
    wavesToWin,
    livesPerWave,
    livesPerRun,
    waveLivesLeft: livesPerWave > 0 ? livesPerWave : 0,
    runLivesLeft: livesPerRun > 0 ? livesPerRun : 0,
    waveRespawnBlocked: false,
    friendlyFire: friendlyFire || !!opts?.sharedFriendlyFire,
    ascension: mods.ascension,
    modifiers: mods,
    hero: {
      id: 0,
      heroId,
      x: mapRespawn(map).x,
      y: mapRespawn(map).y,
      hp: def.maxHp + (mods.applyPlayerMeta ? mods.startingHpFlat : 0),
      maxHp: def.maxHp + (mods.applyPlayerMeta ? mods.startingHpFlat : 0),
      radius: def.radius,
      alive: true,
      attackCd: 0,
      abilityCds: def.abilities.map(() => 0),
      speedBonus: 0,
      damageBonus: mods.applyPlayerMeta ? mods.startingDamageFlat : 0,
      attackSpeedMul: mods.applyPlayerMeta ? mods.attackSpeedMetaMul : 1,
      killGoldBonus: 0,
      barrierTimer: 0,
      whirlwindTimer: 0,
      luck: 0,
      marksmanTimer: 0,
      chaosIndex: 0,
      bladeSpin: 0,
      bladeAngle: 0,
      bladeMode: "wrapped",
      bladeReformTimer: 0,
      bladeSpawnGrace: 0.45,
      bladeHookCharge: 0,
      bladeHookCharging: false,
      slideTimer: 0,
      chargeTimer: 0,
      phaseTimer: 0,
      burrowTimer: 0,
      stasisTimer: 0,
      hiveDrones: heroId === "hive" ? 0 : undefined,
      chronaBank: 0,
      chronaCleanTimer: 0,
      bloodEngineStacks: 0,
      nestCoreKills: 0,
    },
    enemies: [],
    turrets: [],
    projectiles: [],
    fx: [],
    beam: null,
    baseHp,
    baseLevel: startBase,
    gold: cheats?.infiniteGold ? 99999 : startingGold,
    incomePerSec: (BASE_INCOME_GOLD_PER_SEC + mods.incomeFlat) * mods.incomeMul,
    wave: 0,
    waveTier: "normal",
    waveTimer: 2 * mods.waveBreakMul,
    spawning: false,
    toSpawn: 0,
    sentQueue: [],
    spawnCd: 0,
    nextId: 1,
    elapsed: 0,
    shopOpen: false,
    nearShop: false,
    wasNearShop: false,
    shopOwned: {},
    shopOffer: rollShopOffer(),
    shopRefreshesLeft: 0,
    shopRefreshTimer: 0,
    shopFrozen: false,
    pendingSends: [],
    sendsThisRun: 0,
    toast: mods.ascension > 0 ? `${map.name} · A${mods.ascension}` : `${map.name}`,
    toastTimer: 2.4,
    enemyGoldReward: 5,
    relics: [],
    relicDraft: null,
    level: 1,
    xp: 0,
    pendingLevelUps: 0,
    levelDraft: null,
    levelPassives: [],
    draftKind: null,
    pausedForDraft: false,
    paused: false,
    deathCount: 0,
    respawnTimer: 0,
    damageFlash: 0,
    vignette: 0,
    hitFlash: 0,
    shake: 0,
    pendingRelicDraft: false,
    phoenixCharges: 0,
    chests: [],
    chestSpawnCd: 8,
    mapSpecialTimer: 0,
    mapHazardX: MAP_W * 0.55,
    mapFogActive: !!opts?.fogAlways,
    mapActiveSpawner: 0,
    mapOrbs: [],
    wardBeaconTimer: 0,
    aimWorldX: map.base.x + 200,
    aimWorldY: map.base.y,
    opponent: createOpponent(heroId, baseHp, map.base.y),
    viewOpponentLane: false,
    allies: [],
    teamSize: opts?.teamSize ?? 1,
    endless,
    chestOpenMul: opts?.chestOpenMul ?? 1,
    chestDespawnSec: opts?.chestDespawnSec ?? 28,
    chestSpawnChance: opts?.disableChests
      ? 0
      : (opts?.chestSpawnChance ?? 0.08) * (mods.chestSpawnMul ?? 1),
    rerollTokens: cheats?.infiniteRerolls ? 99 : 0,
    shopBuys: 0,
    chestsOpened: 0,
    bossesKilled: 0,
    elitesKilled: 0,
    artifactsPlaced: 0,
    levelDraftsTaken: 0,
    damageDealt: 0,
    damageTaken: 0,
    baseDamageTaken: 0,
    healingDone: 0,
    kills: 0,
    abilitiesCast: 0,
    basicsFired: 0,
    goldFromKills: 0,
    goldFromIncome: 0,
    goldSpent: 0,
    peakGold: startingGold,
    peakIncome: (BASE_INCOME_GOLD_PER_SEC + mods.incomeFlat) * mods.incomeMul,
    baseUpgrades: 0,
    curseShopBlock: 0,
    curseSendBlock: 0,
    curseUpgradeBlock: 0,
    curseIncomeTaxTimer: 0,
    curseIncomeTaxMul: 1,
    curseFogTimer: 0,
    curseShopRefreshSlowTimer: 0,
    curseShopRefreshSlowMul: 1,
    outgoingCurse: null,
    curseDraft: null,
    chestDraft: null,
    hexZones: [],
    teleporters: { a: null, b: null, linked: false, nextReplace: "a", shockCdA: 0, shockCdB: 0 },
    teleportLock: 0,
    utilityId: null,
    utilityCd: 0,
    utilityDraft: null,
    utilityDraftOffered: false,
    utilityDraftLevel: opts?.utilityDraftLevel ?? DEFAULT_UTILITY_DRAFT_LEVEL,
    utilityIncomeBoost: 0,
    utilityIncomeAmount: 0,
    utilityTurretBoost: 0,
    utilitySendDiscount: false,
    utilitySprintTimer: 0,
    utilityDamageBoost: 0,
    utilityBountyKills: 0,
    baseBranches: [],
    baseBranchDraft: null,
    baseBranchMods: emptyBranchMods(),
    pendingBaseBranch: false,
    levelDraftSize: opts?.levelDraftSize ?? 3,
    relicDraftSize: opts?.relicDraftSize ?? 3,
    disableArtifacts: !!opts?.disableArtifacts,
    disableChests: !!opts?.disableChests,
    disableElites: !!opts?.disableElites,
    disableBosses: !!opts?.disableBosses,
    disableShop: !!opts?.disableShop,
    disableSends: !!opts?.disableSends,
    disableRelics: !!opts?.disableRelics,
    fogAlways: !!opts?.fogAlways,
    doubleElites: !!opts?.doubleElites,
  };
}

function spawnEnemy(state: GameState, opts?: { hpScale?: number; sent?: boolean }): void {
  const kind = pickEnemyKind(state.wave, opts?.sent ?? false);
  state.enemies.push(createEnemy(state, kind, opts));
}

function startWave(state: GameState): void {
  if (state.map.shrinkingLane && state.map.baseLaneTop != null && state.map.baseLaneBottom != null) {
    state.map.laneTop = state.map.baseLaneTop;
    state.map.laneBottom = state.map.baseLaneBottom;
  }
  if (state.map.shiftingObstacles) {
    const reserved = [
      state.hero,
      ...state.allies,
      ...state.turrets.filter((t) => t.alive),
    ].map((u) => ({ x: u.x, y: u.y, radius: u.radius }));
    reshuffleObstacles(state.map, reserved);
    // Eject anyone still inside rubble after the shift
    for (const h of [state.hero, ...state.allies]) {
      if (!h.alive && h !== state.hero) continue;
      const clear = findClearSpot(state.map, h.x, h.y, h.radius);
      h.x = clear.x;
      h.y = clear.y;
    }
    for (const t of state.turrets) {
      if (!t.alive) continue;
      const clear = findClearSpot(state.map, t.x, t.y, t.radius);
      t.x = clear.x;
      t.y = clear.y;
    }
    state.toast = "Ground shifts…";
    state.toastTimer = 1.4;
  }
  state.wave += 1;
  state.waveTier = waveTier(state.wave);
  state.spawning = true;
  const count = Math.round(
    (ENEMIES_PER_WAVE_BASE + (state.wave - 1) * WAVE_SCALE.enemiesPerWave) *
      state.modifiers.enemyCountMul,
  );
  state.toSpawn = count;
  if (state.waveTier === "elite") state.toSpawn = Math.max(3, Math.floor(state.toSpawn * 0.75));
  if (state.waveTier === "boss") state.toSpawn = Math.max(2, Math.floor(state.toSpawn * 0.55));
  state.sentQueue = consumePendingSends(state);
  state.spawnCd = state.wave <= 2 ? 0.35 : 0;
  beginWaveShop(state);
  onPlayerWaveStart(state);

  // Warden Bastion
  if (state.hero.heroId === "warden" && state.hero.alive) {
    state.hero.barrierTimer = Math.max(state.hero.barrierTimer, 1.8);
  }

  if (state.waveTier === "elite") {
    state.enemies.push(createEnemy(state, pickEliteKind(), { hpScale: 1 }));
    state.toast = "ELITE WAVE";
    state.toastTimer = 2.2;
  } else if (state.waveTier === "boss") {
    state.enemies.push(createEnemy(state, pickBossKind(), { hpScale: 1 }));
    state.toast = "BOSS WAVE";
    state.toastTimer = 2.4;
  }
  applyWaveRider(state);
  resetWaveLives(state);
}

export function resetWaveLives(state: GameState): void {
  if (state.livesPerWave <= 0) {
    state.waveRespawnBlocked = false;
    return;
  }
  state.waveLivesLeft = state.livesPerWave;
  if (!state.waveRespawnBlocked) return;
  state.waveRespawnBlocked = false;
  const canRespawn = state.livesPerRun <= 0 || state.runLivesLeft > 0;
  if (!canRespawn) return;
  if (!state.hero.alive && !Number.isFinite(state.respawnTimer)) {
    state.respawnTimer = respawnDelay(state);
  }
  for (const ally of state.allies) {
    if (!ally.alive && !Number.isFinite(ally.attackCd)) {
      ally.attackCd = respawnDelay(state);
    }
  }
}

function popNextSpawn(state: GameState): { hpScale: number; sent: boolean } | null {
  if (state.toSpawn > 0) {
    state.toSpawn -= 1;
    return { hpScale: 1, sent: false };
  }
  while (state.sentQueue.length > 0) {
    const head = state.sentQueue[0]!;
    if (head.enemies <= 0) {
      state.sentQueue.shift();
      continue;
    }
    head.enemies -= 1;
    const hpScale = head.hpScale;
    if (head.enemies <= 0) state.sentQueue.shift();
    return { hpScale, sent: true };
  }
  return null;
}

function remainingSpawns(state: GameState): number {
  const sentLeft = state.sentQueue.reduce((n, s) => n + s.enemies, 0);
  return state.toSpawn + sentLeft;
}

/** Alive on the lane + still waiting to spawn this wave (incl. received sends). */
export function laneEnemiesRemaining(state: GameState): number {
  const alive = state.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
  return alive + remainingSpawns(state);
}

export function waveVictoryReached(state: GameState): boolean {
  if (state.wavesToWin <= 0) return false;
  return state.wave >= state.wavesToWin;
}

export function heroMoveSpeed(state: GameState): number {
  let spd = resolveHero(state.hero.heroId).speed + state.hero.speedBonus;
  if ((state.hero.zipSpeedTimer ?? 0) > 0) spd += 40;
  if ((state.hero.gatewalkTimer ?? 0) > 0) spd *= 1.3;
  if (state.utilitySprintTimer > 0) spd += 70;
  // Gyro kit: slow more as spin ramps (cap ~55% slow); lock move while blades detached
  if (heroUsesGyroKit(state.hero.heroId)) {
    const spin = state.hero.bladeSpin ?? 0;
    const mode = state.hero.bladeMode ?? "wrapped";
    if (mode === "wrapped" && spin > 0) spd *= 1 - Math.min(0.55, spin * 0.55);
    if (mode === "rewinding" || mode === "flying" || mode === "sling") return 0;
  }
  // Timed mobility overrides player steer a bit
  if ((state.hero.slideTimer ?? 0) > 0 || (state.hero.chargeTimer ?? 0) > 0) spd *= 0.15;
  if ((state.hero.slowTimer ?? 0) > 0) spd *= state.hero.slowMul ?? 1;
  return spd;
}

function respawnDelay(state: GameState): number {
  const t =
    RESPAWN.baseSec + state.wave * RESPAWN.waveFactor + state.deathCount * RESPAWN.deathFactor;
  return Math.min(RESPAWN.maxSec, t) * state.modifiers.respawnMul;
}

function killHero(state: GameState): void {
  if (!state.hero.alive) return;
  if (tryPhoenixRevive(state)) return;
  state.hero.alive = false;
  state.hero.hp = 0;
  state.deathCount += 1;
  state.shopOpen = false;
  if (heroUsesWarpKit(state.hero.heroId)) clearTeleporters(state);
  // Reset gyro blades on death
  if (heroUsesGyroKit(state.hero.heroId)) {
    state.hero.bladeMode = "wrapped";
    state.hero.bladeSpin = 0;
    state.hero.bladeReformTimer = 0;
    state.hero.bladeHookCharging = false;
    state.hero.bladeHookCharge = 0;
  }
  applyDeathLives(state, state.hero);
  state.damageFlash = Math.min(0.45, Math.max(state.damageFlash, 0.4));
  state.vignette = Math.min(0.75, Math.max(state.vignette, 0.7));
  state.shake = Math.min(0.35, Math.max(state.shake, 0.3));
  if (laneOutOfRunLives(state)) {
    state.status = "lost";
  }
}

/** Shared lives / respawn rules for primary hero (and MP allies via mpSim). */
export function applyDeathLives(state: GameState, hero: HeroRuntime): void {
  const delay = respawnDelay(state);
  if (state.livesPerRun > 0) {
    state.runLivesLeft = Math.max(0, state.runLivesLeft - 1);
    if (state.runLivesLeft <= 0) {
      blockHeroRespawn(state, hero);
      cancelPendingRespawns(state);
      state.toast = "Out of lives";
      state.toastTimer = 2;
      return;
    }
  } else if (state.livesPerWave > 0) {
    state.waveLivesLeft = Math.max(0, state.waveLivesLeft - 1);
    if (state.waveLivesLeft <= 0) {
      state.waveRespawnBlocked = true;
      blockHeroRespawn(state, hero);
      state.toast = "No respawn until next wave";
      state.toastTimer = 2;
      return;
    }
  }
  if (hero === state.hero || hero.controllerSlot === state.hero.controllerSlot) {
    state.respawnTimer = delay;
  } else {
    hero.attackCd = delay;
  }
  state.toast =
    hero === state.hero
      ? `Downed — respawn ${delay.toFixed(1)}s`
      : "Ally downed!";
  state.toastTimer = 2;
}

function blockHeroRespawn(state: GameState, hero: HeroRuntime): void {
  if (hero === state.hero || hero.controllerSlot === state.hero.controllerSlot) {
    state.respawnTimer = Number.POSITIVE_INFINITY;
  } else {
    hero.attackCd = Number.POSITIVE_INFINITY;
  }
}

function cancelPendingRespawns(state: GameState): void {
  if (!state.hero.alive) state.respawnTimer = Number.POSITIVE_INFINITY;
  for (const ally of state.allies) {
    if (!ally.alive) ally.attackCd = Number.POSITIVE_INFINITY;
  }
}

export function laneOutOfRunLives(state: GameState): boolean {
  if (state.livesPerRun <= 0) return false;
  if (state.runLivesLeft > 0) return false;
  if (state.hero.alive) return false;
  return state.allies.every((a) => !a.alive);
}

function respawnHero(state: GameState): void {
  const def = resolveHero(state.hero.heroId);
  const pad = mapRespawn(state.map);
  state.hero.alive = true;
  state.hero.hp = state.hero.maxHp;
  state.hero.x = pad.x;
  state.hero.y = pad.y;
  state.hero.attackCd = 0.4;
  state.hero.barrierTimer = 0;
  state.hero.whirlwindTimer = 0;
  state.hero.radius = def.radius;
  state.toast = "Respawned!";
  state.toastTimer = 1.4;
}

function moveHero(state: GameState, nx: number, ny: number): void {
  const r = state.hero.radius;
  const map = state.map;
  const x = clamp(nx, r, MAP_W - r);
  const y = clamp(ny, map.laneTop + r, map.laneBottom - r);
  if (!map.obstacles.some((o) => circleHitsObstacle(x, y, r, o))) {
    state.hero.x = x;
    state.hero.y = y;
    return;
  }
  if (!map.obstacles.some((o) => circleHitsObstacle(x, state.hero.y, r, o))) {
    state.hero.x = x;
    return;
  }
  if (!map.obstacles.some((o) => circleHitsObstacle(state.hero.x, y, r, o))) {
    state.hero.y = y;
  }
}

function updateProjectiles(state: GameState, dt: number): void {
  for (const p of state.projectiles) {
    if (!p.alive) continue;
    steerSeekingProjectile(state, p, dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life !== undefined) {
      p.life -= dt;
      if (p.life <= 0) {
        if (p.hostile && (p.aoeRadius ?? 0) > 0) {
          resolveHostileProjectile(state, p, [state.hero], (h, dmg) => {
            if (h === state.hero) applyPlayerDamage(state, dmg);
          });
        } else {
          p.alive = false;
        }
        continue;
      }
    }
    if (p.x < -20 || p.x > MAP_W + 20 || p.y < -20 || p.y > MAP_H_PAD) {
      p.alive = false;
      continue;
    }

    // Walls block all shots (player and enemy).
    if (blockedByObstacle(state.map, p.x, p.y, p.radius)) {
      if (p.hostile && (p.aoeRadius ?? 0) > 0) {
        resolveHostileProjectile(state, p, [state.hero], (h, dmg) => {
          if (h === state.hero) applyPlayerDamage(state, dmg);
        });
      } else {
        p.alive = false;
      }
      continue;
    }

    if (p.hostile) {
      if (state.hero.alive && dist(p, state.hero) <= state.hero.radius + p.radius) {
        resolveHostileProjectile(state, p, [state.hero], (h, dmg) => {
          if (h === state.hero) applyPlayerDamage(state, dmg);
        });
      }
      continue;
    }

    if (state.friendlyFire) {
      for (const ally of state.allies) {
        if (!ally.alive) continue;
        if (dist(p, ally) <= ally.radius + p.radius) {
          const prev = state.hero;
          state.hero = ally;
          applyPlayerDamage(state, p.damage);
          state.hero = prev;
          p.alive = false;
          break;
        }
      }
      if (!p.alive) continue;
    }

    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (dist(p, e) <= e.radius + p.radius) {
        damageEnemy(state, e, p.damage, {
          fromBasic: p.fromBasic,
          slow: p.appliesSlow,
        });
        if (p.magnetPull) applyMagnetPull(state, e, p.magnetPull);
        if (p.appliesSlow) applySlow(e, 0.6, 1.5);
        if (p.hexDot) {
          e.dotTimer = Math.max(e.dotTimer ?? 0, 2.4);
          e.dotDps = Math.max(e.dotDps ?? 0, p.damage * 0.55);
        }
        if (p.burnDot) {
          e.burnTimer = Math.max(e.burnTimer ?? 0, 1.8);
          e.burnDps = Math.max(e.burnDps ?? 0, p.damage * 0.4);
        }
        if (p.healOnHit && p.fromBasic) {
          state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + (p.healOnHit ?? 0));
        }
        if ((p.pierceLeft ?? 0) > 0) {
          p.pierceLeft = (p.pierceLeft ?? 0) - 1;
          continue;
        }
        if (bounceProjectile(state, p, e.id)) continue;
        p.alive = false;
        break;
      }
    }
  }
  state.projectiles = state.projectiles.filter((p) => p.alive);
}

const MAP_H_PAD = 600;

function afterWaveClear(state: GameState, input: Input): boolean {
  if (state.waveTier === "elite" || state.waveTier === "boss") {
    const choices = draftRelicChoices(state.relics, state.relicDraftSize ?? 3);
    if (choices.length > 0) {
      state.relicDraft = choices;
      state.pausedForDraft = true;
      state.pendingRelicDraft = true;
      state.draftKind = "relic";
      state.waveTimer = WAVE_BREAK_SEC * state.modifiers.waveBreakMul;
      if (state.pendingLevelUps > 0) {
        openLevelDraft(state);
      }
      input.endFrame();
      return true;
    }
  }
  if (state.pendingLevelUps > 0) {
    openLevelDraft(state);
    state.waveTimer = WAVE_BREAK_SEC * state.modifiers.waveBreakMul;
    input.endFrame();
    return true;
  }
  applySecondWind(state);
  if (state.hero.heroId === "medic") {
    const missing = state.hero.maxHp - state.hero.hp;
    if (missing > 0) {
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + missing * 0.25);
    }
  }
  state.waveTimer = WAVE_BREAK_SEC * state.modifiers.waveBreakMul;
  if (waveVictoryReached(state)) {
    state.status = "won";
    input.endFrame();
    return true;
  }
  return false;
}

export function update(state: GameState, input: Input, dt: number): void {
  if (state.status !== "playing") {
    input.endFrame();
    return;
  }

  if (state.paused) {
    input.endFrame();
    return;
  }

  if (
    state.pausedForDraft &&
    (state.relicDraft ||
      state.levelDraft ||
      state.baseBranchDraft ||
      state.utilityDraft ||
      state.curseDraft ||
      state.chestDraft)
  ) {
    state.elapsed += dt;
    input.endFrame();
    return;
  }

  state.elapsed += dt;
  let income = state.incomePerSec;
  if (state.curseIncomeTaxTimer > 0) {
    income *= state.curseIncomeTaxMul;
  }
  income += state.baseBranchMods.incomeFlat;
  if (state.utilityIncomeBoost > 0) income += state.utilityIncomeAmount;
  const gained = income * dt;
  state.gold += gained;
  state.goldFromIncome += gained;
  state.peakGold = Math.max(state.peakGold, state.gold);
  state.peakIncome = Math.max(state.peakIncome, income);
  if (areCheatsEnabled() && loadCheatOptions().infiniteGold) {
    state.gold = Math.max(state.gold, 99999);
  }

  // Tick soft curses on this lane
  const tick = (v: number) => Math.max(0, v - dt);
  state.curseShopBlock = tick(state.curseShopBlock);
  state.curseSendBlock = tick(state.curseSendBlock);
  state.curseUpgradeBlock = tick(state.curseUpgradeBlock);
  state.curseIncomeTaxTimer = tick(state.curseIncomeTaxTimer);
  state.curseFogTimer = tick(state.curseFogTimer);
  state.curseShopRefreshSlowTimer = tick(state.curseShopRefreshSlowTimer);
  if (state.fogAlways || state.curseFogTimer > 0) state.mapFogActive = true;

  // Hex DoT zones
  for (const z of state.hexZones) {
    z.life -= dt;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (dist(e, z) <= z.radius + e.radius) {
        damageEnemy(state, e, z.dps * dt);
      }
    }
  }
  state.hexZones = state.hexZones.filter((z) => z.life > 0);

  if (state.toastTimer > 0) {
    state.toastTimer = Math.max(0, state.toastTimer - dt);
    if (state.toastTimer <= 0) state.toast = "";
  }

  state.damageFlash = Math.max(0, state.damageFlash - dt);
  state.vignette = Math.max(0, state.vignette - dt);
  state.hitFlash = Math.max(0, state.hitFlash - dt);
  state.shake = Math.max(0, state.shake - dt);
  if (state.beam) {
    state.beam.life -= dt;
    if (state.beam.life <= 0) state.beam = null;
  }

  if (!state.hero.alive) {
    if (Number.isFinite(state.respawnTimer)) {
      state.respawnTimer -= dt;
      if (state.respawnTimer <= 0) respawnHero(state);
    }
  } else if ((state.hero.slowTimer ?? 0) > 0) {
    state.hero.slowTimer = (state.hero.slowTimer ?? 0) - dt;
    if ((state.hero.slowTimer ?? 0) <= 0) {
      state.hero.slowTimer = 0;
      state.hero.slowMul = 1;
    }
  }

  const nearNow = nearAnyShop(state.map, state.hero, state.hero.alive);
  // Auto-close when leaving interact range (also covers death via nearShop=false).
  if (state.shopOpen && !nearNow) {
    state.shopOpen = false;
  }
  // Edge-trigger auto-open (settings); shop keybind still toggles.
  if (
    nearNow &&
    !state.wasNearShop &&
    !state.shopOpen &&
    !state.disableShop &&
    state.curseShopBlock <= 0 &&
    loadSettings().autoOpenShop
  ) {
    state.shopOpen = true;
  }
  state.nearShop = nearNow;
  state.wasNearShop = nearNow;

  if (
    state.hero.alive &&
    input.consumeAction("shop") &&
    !state.disableShop &&
    state.curseShopBlock <= 0
  ) {
    if (state.shopOpen) {
      state.shopOpen = false;
    } else if (state.nearShop) {
      state.shopOpen = true;
    }
  }

  if (input.consumeAction("upgradeBase") && state.curseUpgradeBlock <= 0) {
    tryUpgradeBase(state);
  }

  if (!state.disableSends && state.curseSendBlock <= 0) {
    for (const pack of availableSendPacks(state)) {
      if (pack.digit >= 4 && state.shopOpen) continue;
      const sendAction = `send${pack.digit}` as
        | "send1"
        | "send2"
        | "send3"
        | "send4"
        | "send5"
        | "send6";
      if (pack.digit <= 6 && input.consumeAction(sendAction)) {
        buySendPack(state, pack.id);
      } else if (input.consumePress(`Digit${pack.digit}`)) {
        buySendPack(state, pack.id);
      }
    }
  }

  if (state.shopOpen && state.hero.alive && state.curseShopBlock <= 0 && !state.disableShop) {
    (["Digit4", "Digit5", "Digit6"] as const).forEach((code, i) => {
      const id = state.shopOffer[i];
      if (input.consumePress(code) && id) buyShopItem(state, id);
    });
  }

  if (state.hero.alive) {
    const axis = input.moveAxis();
    const dir = normalize(axis.x, axis.y);
    const speed = heroMoveSpeed(state);
    moveHero(state, state.hero.x + dir.x * speed * dt, state.hero.y + dir.y * speed * dt);

    state.hero.attackCd = Math.max(0, state.hero.attackCd - dt);
    for (let i = 0; i < state.hero.abilityCds.length; i++) {
      state.hero.abilityCds[i] = Math.max(0, state.hero.abilityCds[i]! - dt);
    }

    // Gyro Blade Hook: hold to charge range, release / cap to fire
    if (heroUsesGyroKit(state.hero.heroId)) {
      const mode = state.hero.bladeMode ?? "wrapped";
      const canCharge =
        (mode === "wrapped" || mode === "reforming") &&
        (state.hero.bladeReformTimer ?? 0) <= 0 &&
        state.hero.abilityCds[0]! <= 0;
      const held = input.isActionHeld("mobility");
      if (canCharge && held) {
        state.hero.bladeHookCharging = true;
        state.hero.bladeHookCharge = Math.min(1, (state.hero.bladeHookCharge ?? 0) + dt / 0.9);
        if ((state.hero.bladeHookCharge ?? 0) >= 1) {
          fireChargedBladeHook(state, axis);
        }
      } else if (state.hero.bladeHookCharging) {
        fireChargedBladeHook(state, axis);
      } else {
        state.hero.bladeHookCharge = 0;
        // Consume stray press so it doesn't linger
        input.consumeAction("mobility");
      }
    } else if (input.consumeAction("mobility")) {
      tryCastAbility(state, "mobility", axis);
    }
    if (input.consumeAction("ultimate")) tryCastAbility(state, "ultimate", axis);
    if (input.consumeAction("utility")) tryCastUtility(state);

    tickAbilityEffects(state, dt);
    tickUtilityEffects(state, dt);
    tickHeroKits(state, dt, input.isActionHeld("attack"));

    const canBasic =
      !heroUsesGyroKit(state.hero.heroId) ||
      (state.hero.bladeMode ?? "wrapped") === "wrapped";
    if (canBasic && input.isActionHeld("attack") && state.hero.attackCd <= 0) {
      tryBasicAttack(state);
    }
  }

  updateProjectiles(state, dt);
  updateEnemies(state, dt);
  updateTurrets(state, dt);
  if (!state.endless && !state.mpLane) updateOpponent(state, dt);
  tickChests(state, dt);
  tickMapSpecials(state, dt, state.spawning || state.enemies.some((e) => e.alive));

  for (const f of state.fx) f.life -= dt;
  state.fx = state.fx.filter((f) => f.life > 0);

  const waveActive = state.spawning || state.enemies.length > 0;
  tickShopRotation(state, dt, waveActive && !state.pausedForDraft);

  if (state.spawning) {
    state.spawnCd -= dt;
    if (remainingSpawns(state) > 0 && state.spawnCd <= 0) {
      const next = popNextSpawn(state);
      if (next) spawnEnemy(state, next);
      const interval = Math.max(
        WAVE_SCALE.spawnIntervalMin,
        WAVE_SCALE.spawnIntervalBase - state.wave * WAVE_SCALE.spawnIntervalWaveFactor,
      );
      state.spawnCd = state.wave === 1 ? Math.max(interval, 0.85) : interval;
    }
    if (remainingSpawns(state) <= 0 && state.enemies.length === 0) {
      state.spawning = false;
      if (afterWaveClear(state, input)) return;
    }
  } else if (!state.pausedForDraft) {
    state.waveTimer -= dt;
    if (state.waveTimer <= 0) startWave(state);
  }

  if (state.baseHp <= 0) {
    state.baseHp = 0;
    state.status = "lost";
  }

  if (state.hero.alive && state.hero.hp <= 0) {
    killHero(state);
  }

  input.endFrame();
}

export function chooseRelic(state: GameState, id: RelicId): void {
  if (!state.relicDraft?.includes(id)) return;
  pickRelic(state, id);
  state.pendingRelicDraft = false;
  playSfx("levelup");
  if (state.pendingLevelUps > 0 && !state.levelDraft) {
    openLevelDraft(state);
    return;
  }
  if (!state.pausedForDraft) {
    applySecondWind(state);
  }
  if (waveVictoryReached(state) && !state.pausedForDraft) {
    state.status = "won";
  }
}

export function skipRelic(state: GameState): void {
  if (!state.relicDraft) return;
  state.relicDraft = null;
  state.pendingRelicDraft = false;
  if (state.pendingLevelUps > 0 && !state.levelDraft) {
    openLevelDraft(state);
    return;
  }
  state.draftKind = null;
  state.pausedForDraft = false;
  applySecondWind(state);
  state.toast = "Relic skipped";
  state.toastTimer = 1.4;
  if (waveVictoryReached(state)) state.status = "won";
}

export function chooseLevelUp(state: GameState, id: LevelPassiveId): void {
  chooseLevelPassive(state, id);
  playSfx("levelup");
  if (!state.pausedForDraft) {
    applySecondWind(state);
    if (waveVictoryReached(state)) state.status = "won";
  }
}

export function chooseUtility(state: GameState, id: UtilityId): void {
  if (!state.utilityDraft?.includes(id)) return;
  applyUtilityChoice(state, id);
  if (state.pendingLevelUps > 0 && !state.levelDraft) {
    openLevelDraft(state);
  } else if (state.levelDraft) {
    state.draftKind = "level";
    state.pausedForDraft = true;
  } else if (state.relicDraft) {
    state.draftKind = "relic";
    state.pausedForDraft = true;
  } else {
    state.draftKind = null;
    state.pausedForDraft = false;
    applySecondWind(state);
    if (waveVictoryReached(state)) state.status = "won";
  }
}

export function chooseCurse(state: GameState, id: CurseId): void {
  applyCurseChoice(state, id);
}

export function heroOnHighGround(state: GameState): boolean {
  return inHighGround(state, state.hero);
}

export function pendingSendCount(state: GameState): number {
  return state.pendingSends.reduce((n, s) => n + s.enemies, 0);
}
