import {
  BASE_INCOME_GOLD_PER_SEC,
  MAP_H,
  MAP_W,
  RESPAWN,
  STARTING_GOLD,
  WAVE_BREAK_SEC,
  WAVE_SCALE,
  WIN_WAVES,
} from "../data/constants";
import {
  pickEnemyKind,
  type EnemyIntent,
  type EnemyKind,
  type WaveTier,
} from "../data/enemies";
import { type HeroId } from "../data/heroes";
import {
  reshuffleObstacles,
  blockedByObstacle,
  blockedByNewObstacle,
  overlappedObstacles,
  resolveMapChoice,
  mapRespawn,
  nearAnyShop,
  pointInPlayable,
  resolveMovePlayable,
  type MapDef,
  type MapId,
} from "../data/maps";
import { shrinkPlayBounds } from "./playBounds";
import { laneFogState } from "./fog";
import {
  resolveHero,
  resolveMap,
  heroUsesGyroKit,
  heroUsesWarpKit,
  heroUsesGunnerKit,
  heroUsesVectorKit,
} from "../custom/registry";
import { gunnerWeaponAt } from "../data/gunnerWeapons";
import {
  gunnerMoveSpeedMul,
  gunnerShouldFreezeSim,
  tickGunnerWeapons,
} from "../systems/gunner";
import { tickMines, tickVectorMomentum } from "../systems/abilities";
import { createOpponent, onPlayerWaveStart, updateOpponent, type OpponentState } from "../systems/opponent";
import {
  createRespawnMinigame,
  pressRespawnMinigame,
  tickRespawnMinigame,
} from "../systems/respawnMinigame";
import {
  applyCreativeWaveStart,
  applyWallBounce,
  creativeFromRunOptions,
  maybeRandomizeMap,
  shouldOfferRelicForWave,
  slipSlideDelta,
} from "../systems/creativeRuntime";
import { tickDefenseRegen } from "../systems/defense";
import { draftRelicChoices, type RelicId } from "../data/relics";
import { rollShopOffer, type ShopItemId } from "../data/shop";
import { shopRerollCost } from "../data/shopReroll";
import { DEFAULT_MAX_TURRETS, type TurretKind } from "../data/turrets";
import type { LevelPassiveId } from "../data/xp";
import { DEFAULT_UTILITY_DRAFT_LEVEL, type UtilityId } from "../data/utilities";
import { dist, normalize } from "./math";
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
  explodeFriendlyAoe,
  inHighGround,
  resolveHostileProjectile,
  steerSeekingProjectile,
  applyMagnetPull,
  tryBasicAttack,
  tickHexZones,
} from "../systems/combat";
import { createEnemy, updateEnemies } from "../systems/enemies";
import { applySecondWind, applyWaveRider, pickRelic, tryPhoenixRevive } from "../systems/relics";
import { beginWaveShop, tickShopRotation } from "../systems/shop";
import { buySendPack, consumePendingSends, availableSendPacks } from "../systems/send";
import { tryUpgradeBase } from "../systems/baseUpgrade";
import { chooseLevelPassive, openLevelDraft, skipLevelDraft } from "../systems/xp";
import { applyUtilityChoice, tickUtilityEffects, tryCastUtility } from "../systems/utility";
import { updateTurrets } from "../systems/turrets";
import { tryPlacePendingArtifact } from "../systems/turrets";
import { tickChests, tickMapSpecials } from "../systems/chests";
import { playSfx } from "../systems/audio";
import { defaultModifiers, type RunModifiers } from "../meta/modifiers";
import { emptyContentFilters, pickEnabledEnemyKind } from "../meta/contentFilters";
import { emptyBranchMods } from "../data/baseBranches";
import { gameplayCheats, areCheatsEnabled, loadCheatOptions } from "../meta/cheats";
import { loadSettings } from "../ui/settings";
import { canPauseSimulation } from "./pause";
import { openOrQueueDraft, syncDraftFlags } from "../systems/drafts";
import {
  beginWaveFromPlan,
  planWaveSpawns,
  prepareLaneGeometryForWave,
  spawnWaveSpecials,
} from "../systems/waves";

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
  /** Current armor / shield pools (0 if none). */
  armor?: number;
  maxArmor?: number;
  shield?: number;
  maxShield?: number;
  shieldQuiet?: number;
  /** Pure knockback melee (little/no HP damage). */
  knockbackForce?: number;
  /** Ranged projectiles that also knock back. */
  projectileKnockback?: number;
  /** Poison / burn DoT from hex / ember basics. */
  dotTimer?: number;
  dotDps?: number;
  /** Stack count for poison DoT (Cloud / hex). */
  poisonStacks?: number;
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
  /** Hostile knockback impulse on hero hit. */
  knockback?: number;
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

/** Floating damage / heal numbers. */
export type DamageFloater = {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  /** Scale multiplier (crits / big hits). */
  scale: number;
  vy: number;
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
  color?: string;
  width?: number;
};

export type MineUnit = {
  id: number;
  x: number;
  y: number;
  radius: number;
  /** Seconds until armed (0 = live). */
  armTimer: number;
  damage: number;
  ownerSlot?: number | null;
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
  | { kind: "relic"; relicId: RelicId; label: string; blurb: string }
  | { kind: "xp"; amount: number; label: string; blurb: string }
  | { kind: "heal"; amount: number; label: string; blurb: string }
  | { kind: "reroll"; amount: number; label: string; blurb: string }
  | { kind: "base_repair"; amount: number; label: string; blurb: string }
  | { kind: "stock_discount"; amount: number; label: string; blurb: string };

export type BladeMode = "wrapped" | "flying" | "sling" | "rewinding" | "reforming";

export type HexZone = {
  x: number;
  y: number;
  radius: number;
  life: number;
  dps: number;
  /** Poison clouds apply DoT stacks; classic hex zones deal direct dps. */
  kind?: "hex" | "poison";
  poisonStacks?: number;
  poisonDps?: number;
  poisonDuration?: number;
  /** Cadence timer for poison re-apply while standing in the cloud. */
  poisonTick?: number;
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
  /** Armor pool (mitigates + chips; does not regen). */
  armor?: number;
  maxArmor?: number;
  /** Energy shield pool (absorbs first; regenerates after quiet time). */
  shield?: number;
  maxShield?: number;
  shieldQuiet?: number;
  /** Multiplayer: which lobby seat controls this hero (null = AI / unowned). */
  controllerSlot?: number | null;
  /** Gunner arsenal runtime. */
  gunnerWeaponIndex?: number;
  gunnerAmmo?: number;
  gunnerReload?: number;
  gunnerWeaponCd?: number;
  gunnerAiming?: boolean;
  gunnerAimTime?: number;
  gunnerSpin?: number;
  gunnerCharge?: number;
  gunnerSwapCd?: number;
  gunnerSelfDamageFlash?: number;
  /** Cloud: Wall Dart wind-up (immobilized) then axis-aligned ricochet. */
  cloudDartWindup?: number;
  cloudDartActive?: boolean;
  /** `v` = top↔bottom (default), `h` = left↔right when aim is beside Cloud. */
  cloudDartAxis?: "h" | "v";
  /** Sign along the active axis (−1 / +1). */
  cloudDartDir?: number;
  cloudDartHits?: number;
  /** Cloud: Gas Spew remaining duration + drop cadence. */
  cloudSpewTimer?: number;
  cloudSpewDrop?: number;
  /** Vector momentum 0–cap. */
  momentum?: number;
  /** Last frame position for momentum distance. */
  momentumPrevX?: number;
  momentumPrevY?: number;
  /** Map bounce-pad cooldown. */
  bounceCd?: number;
  /** Map portal cooldown. */
  portalCd?: number;
  /** Relay beacon temporary damage buff. */
  relayDmgTimer?: number;
  relayDmgBonus?: number;
  /** Brief immunity between knockback pulses. */
  knockbackCd?: number;
};

export type RunOptions = {
  mapId: MapId | string | "random";
  /**
   * Max artifacts. `-1` = use the map's turret slot count.
   * Values above the map's slot count are clamped at match start.
   */
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
  /**
   * Explicit AI allies (player lane) and enemies (rival lane). When set, overrides
   * the symmetric `teamSize` filler list for dual-lane solo matches.
   */
  aiAllies?: {
    heroId: import("../net/types").LobbyAiHeroPick;
    ai: import("../net/types").LobbyAiKind;
  }[];
  aiEnemies?: {
    heroId: import("../net/types").LobbyAiHeroPick;
    ai: import("../net/types").LobbyAiKind;
  }[];
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
  /** Skip level-up bonus drafts when game type filters out all bonuses. */
  disableBonuses?: boolean;
  /** Skip base-branch drafts when filters empty the pool. */
  disableBaseUpgrades?: boolean;
  /** Disabled content ids from the active Game Type. */
  contentFilters?: import("../meta/contentFilters").GameTypeContentFilters;
  allyAiAggression?: number;
  fogAlways?: boolean;
  /** 0–100; 100 = fully black outside vision when fog is active. */
  fogThicknessPct?: number;
  /** Clear radius around the hero while fogged (px). */
  fogVisionRadius?: number;
  doubleElites?: boolean;
  suddenDeathBaseHp?: number;
  sharedFriendlyFire?: boolean;
  /** Heroes deal and take +50% damage. */
  glassCannon?: boolean;
  /** Kill gold ×2. */
  goldRush?: boolean;
  /** Chest spawn chance ×3. */
  wildChests?: boolean;
  /** Start with a tighter playable bounds. */
  crampedLane?: boolean;
  /** Player-lane base cannot be destroyed. */
  playerBaseInvincible?: boolean;
  /** Enemy-lane / abstract opponent base cannot be destroyed. */
  enemyBaseInvincible?: boolean;
  /** Seconds between waves after both sides clear (default WAVE_BREAK_SEC). */
  waveBreakSec?: number;
  /** Large move-speed change while your lane has no living enemies (percent). */
  laneClearSpeedPct?: number;
  /** Precision respawn minigame while dead (default on). */
  respawnMinigame?: boolean;
  /**
   * Where send packs go: own next wave vs enemy lane.
   * Default: own while endless, else enemy.
   */
  sendLocation?: "own" | "enemy";
  /** Free cursor place vs map-slot locked Artifacts. */
  artifactPlacement?: "free" | "locked";
  /** Apply Barracks combat meta upgrades this run. */
  allowBarracks?: boolean;
  /** Creative v0.0.6 extras — see `meta/creativeOptions`. */
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
  /** Humans in the whole game (both lanes). Drives pause + cheat policy. */
  humanPlayers?: number;
  /**
   * True only when this run was started from Campaign combat (not from SP while
   * a campaign checkpoint exists in the background).
   */
  campaignCombat?: boolean;
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
  /** Dedicated 4th shop slot price (wave-scaled; rises per purchase). */
  shopRerollCost: number;
  /** Reroll token purchases this wave (resets on beginWaveShop). */
  shopRerollBuysWave: number;
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
  /** When true, dead players can play the precision respawn bar. */
  respawnMinigameEnabled: boolean;
  respawnMinigame: import("../systems/respawnMinigame").RespawnMinigame | null;
  /** This lane's base cannot drop to 0. */
  baseInvincible: boolean;
  /** Abstract / rival bases cannot be destroyed (classic opponent + dual-lane). */
  enemyBaseInvincible: boolean;
  /** Configured intermission length (before waveBreakMul). */
  waveBreakSec: number;
  /** % move speed delta while lane has zero living enemies (0 = none). */
  laneClearSpeedPct: number;
  /** free = click place; locked = map slots only. */
  artifactPlacement: "free" | "locked";
  unlimitedArtifacts: boolean;
  pendingArtifact: import("../data/turrets").TurretKind | null;
  pendingArtifactDebounce: number;
  /** After buy, seconds before place click counts. */
  artifactPlaceDebounceSec: number;
  shopStockRerollBuys: number;
  shopStockRerollDiscount: number;
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
  /** Resolved fog shroud opacity 0–1 (from stacking helper). */
  fogOpacity: number;
  /** Resolved vision circle radius in px. */
  fogVisionRadiusResolved: number;
  /** Map eclipse pulse currently on (stacks with curse / run fog). */
  mapEclipseActive: boolean;
  mapActiveSpawner: 0 | 1;
  /** Volatile orb map hazards. */
  mapOrbs: MapOrb[];
  /** Free gold crates from supply-drops special. */
  mapSupplyCrates: {
    id: number;
    x: number;
    y: number;
    radius: number;
    life: number;
    gold: number;
  }[];
  /** Ward Beacon: remaining DR window for heroes (seconds). */
  wardBeaconTimer: number;
  /** Mouse aim in world space (updated each frame from Input). */
  aimWorldX: number;
  aimWorldY: number;
  /** Solo AI opponent lane summary + flip-view viz. */
  opponent: OpponentState;
  /** When true, canvas shows opponent lane instead of player lane. */
  viewOpponentLane: boolean;
  /**
   * Dual-lane spectate: draw the real enemy lane with the rival purple palette
   * (not the abstract solo `opponent.viz` world).
   */
  spectateRivalTint?: boolean;
  /**
   * Client-side MP: true while this lane only receives HUD summaries (its
   * entity arrays are stale). Cleared whenever a full LaneSnap is applied.
   */
  snapIsSummary?: boolean;
  /** Extra human/AI heroes sharing this lane (multiplayer). */
  allies: HeroRuntime[];
  /** Multiplayer lane flag — skip solo opponent AI sim. */
  mpLane?: boolean;
  /** PvE enemy lane driven by simple AI intents. */
  aiControlled?: boolean;
  teamSize: 1 | 2 | 3;
  /** Solo endless survival (no rival lane). */
  endless: boolean;
  /** Resolved send destination at match start. */
  sendLocation: "own" | "enemy";
  /** Floating combat numbers (client-filtered by settings when drawing). */
  damageFloaters: DamageFloater[];
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
  /** Sapper proximity mines on this lane. */
  mines: MineUnit[];
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
  disableBonuses: boolean;
  disableBaseUpgrades: boolean;
  contentFilters: import("../meta/contentFilters").GameTypeContentFilters;
  fogAlways: boolean;
  fogThicknessPct: number;
  fogVisionRadius: number;
  doubleElites: boolean;
  glassCannon: boolean;
  goldRush: boolean;
  wildChests: boolean;
  crampedLane: boolean;
  relicDrop: import("../meta/creativeOptions").RelicDropMode;
  enemyProjectileDmgMul: number;
  enemyCollisionDmgMul: number;
  playerDmgLmbMul: number;
  playerDmgRmbMul: number;
  playerDmgMmbMul: number;
  wallBounciness: number;
  playerSpeedMul: number;
  playerSizeMul: number;
  enemySizeMul: number;
  critLottery: import("../meta/creativeOptions").CritLotteryMode;
  enemyMutation: import("../meta/creativeOptions").EnemyMutationMode;
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
  /** While casting, abilities multiply via this slot (mobility/ultimate). */
  abilityDamageSlot?: "basic" | "mobility" | "ultimate" | null;
  /**
   * Rewards earned while another draft of the same kind is still open.
   * Per-player (mirrored into `PlayerBag`) so nothing is replaced or discarded.
   */
  draftQueue: import("../systems/drafts").PendingDraft[];
  /**
   * Humans participating in this GAME (both lanes), not just this lane.
   * Drives the pause + cheat policy — see `game/pause.ts`. Always >= 1.
   */
  humanPlayers: number;
  /**
   * Client-only: set while this lane is only being received as a HUD summary
   * (nobody here is watching it). Cleared as soon as full snapshots resume.
   */
  summaryEnemyCount?: number | null;
  summaryIncoming?: number | null;
  /**
   * Per-controller economy (MP shared lane). When set, gold/shop/relics/drafts/sends
   * live in bags; lane fields mirror `activeBagKey` for HUD/systems.
   */
  playerBags?: Record<string, import("../net/playerBag").PlayerBag>;
  activeBagKey?: string | null;
};

export function createState(
  heroId: HeroId = "ranger",
  opts?: Partial<RunOptions>,
): GameState {
  const mapId = resolveMapChoice(opts?.mapId ?? "random", opts?.contentFilters?.maps);
  const map = structuredClone(resolveMap(mapId));
  if (opts?.crampedLane) {
    shrinkPlayBounds(map, 48, 90);
    map.baseLaneTop = map.laneTop;
    map.baseLaneBottom = map.laneBottom;
    map.baseLaneLeft = map.laneLeft;
    map.baseLaneRight = map.laneRight;
  }
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
  const mapSlotCount = map.turretSlots.length;
  const rawTurrets = opts?.maxTurrets ?? DEFAULT_MAX_TURRETS;
  const unlimitedArtifacts = rawTurrets === -2;
  const resolvedTurrets = unlimitedArtifacts
    ? 99
    : rawTurrets < 0
      ? mapSlotCount
      : Math.max(0, Math.floor(rawTurrets));
  const maxTurrets =
    (unlimitedArtifacts
      ? resolvedTurrets
      : Math.min(resolvedTurrets, Math.max(0, mapSlotCount))) +
    (mods.applyPlayerMeta ? mods.maxTurretsBonus : 0);
  const artifactPlacement =
    opts?.artifactPlacement === "locked" || opts?.artifactPlacement === "free"
      ? opts.artifactPlacement
      : "free";
  // Creative run option overlays
  if (opts?.enemyHpMul) mods.enemyHpMul *= opts.enemyHpMul;
  if (opts?.enemySpeedMul) mods.enemySpeedMul *= opts.enemySpeedMul;
  if (opts?.enemyDensityMul) mods.enemyCountMul *= opts.enemyDensityMul;
  if (opts?.incomeMul) mods.incomeMul *= opts.incomeMul;
  // 0× respawn = always instant; still honor higher multipliers.
  if (opts?.respawnMul != null && opts.respawnMul !== 1) mods.respawnMul *= opts.respawnMul;
  const creative = creativeFromRunOptions(opts);
  if (opts?.sharedFriendlyFire) {
    /* flag used by combat — mirrored via friendlyFire below if needed */
  }
  let baseHp = baseMax;
  if (opts?.suddenDeathBaseHp) {
    baseHp = Math.max(20, Math.round(opts.suddenDeathBaseHp));
    map.base.maxHp = baseHp;
  }
  const startBase = Math.max(0, opts?.startingBaseLevel ?? 0);
  const waveBreakSec = Math.max(0, opts?.waveBreakSec ?? WAVE_BREAK_SEC);
  const sendLocation: "own" | "enemy" =
    opts?.sendLocation === "own" || opts?.sendLocation === "enemy"
      ? opts.sendLocation
      : endless
        ? "own"
        : "enemy";
  // Human count is known up-front for MP (matchFactory passes it) — a cheating
  // host must not seed a multi-human match with cheat gold / rerolls.
  const humanPlayers = Math.max(1, Math.floor(opts?.humanPlayers ?? 1));
  const cheats = humanPlayers <= 1 && areCheatsEnabled() ? loadCheatOptions() : null;
  const startArmor = def.passive.id === "platebound" ? 42 : 0;
  const startShield = def.passive.id === "aegis_lattice" ? 28 : 0;
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
      radius: Math.max(4, def.radius * creative.playerSizeMul),
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
      gunnerWeaponIndex: heroId === "gunner" ? 0 : undefined,
      armor: startArmor,
      maxArmor: startArmor,
      shield: startShield,
      maxShield: startShield,
      shieldQuiet: 0,
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
      momentumPrevX: undefined,
      momentumPrevY: undefined,
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
    waveTimer: waveBreakSec * mods.waveBreakMul * 0.4,
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
    shopOffer: rollShopOffer([], opts?.contentFilters),
    shopRefreshesLeft: 0,
    shopRefreshTimer: 0,
    shopFrozen: false,
    shopRerollCost: shopRerollCost(1, 0),
    shopRerollBuysWave: 0,
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
    respawnMinigameEnabled: opts?.respawnMinigame !== false,
    respawnMinigame: null,
    baseInvincible: !!opts?.playerBaseInvincible,
    enemyBaseInvincible: !!opts?.enemyBaseInvincible,
    waveBreakSec,
    laneClearSpeedPct:
      typeof opts?.laneClearSpeedPct === "number" && Number.isFinite(opts.laneClearSpeedPct)
        ? opts.laneClearSpeedPct
        : 0,
    artifactPlacement,
    unlimitedArtifacts,
    pendingArtifact: null,
    pendingArtifactDebounce: 0,
    artifactPlaceDebounceSec: 0.35,
    shopStockRerollBuys: 0,
    shopStockRerollDiscount: 0,
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
    fogOpacity: 0,
    fogVisionRadiusResolved: opts?.fogVisionRadius ?? 120,
    mapEclipseActive: false,
    mapSupplyCrates: [],
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
    sendLocation,
    damageFloaters: [],
    chestOpenMul: opts?.chestOpenMul ?? 1,
    chestDespawnSec: opts?.chestDespawnSec ?? 28,
    chestSpawnChance: opts?.disableChests
      ? 0
      : (opts?.chestSpawnChance ?? 0.08) * (mods.chestSpawnMul ?? 1),
    rerollTokens: cheats?.infiniteRerolls || creative.infiniteRerolls ? 99 : 0,
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
    mines: [],
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
    disableBonuses: !!opts?.disableBonuses,
    disableBaseUpgrades: !!opts?.disableBaseUpgrades,
    contentFilters: opts?.contentFilters ?? emptyContentFilters(),
    fogAlways: !!opts?.fogAlways,
    fogThicknessPct: Math.max(0, Math.min(100, opts?.fogThicknessPct ?? 55)),
    fogVisionRadius: Math.max(40, opts?.fogVisionRadius ?? 120),
    doubleElites: !!opts?.doubleElites,
    glassCannon: !!opts?.glassCannon,
    goldRush: !!opts?.goldRush,
    wildChests: !!opts?.wildChests,
    crampedLane: !!opts?.crampedLane,
    ...creative,
    abilityDamageSlot: null,
    draftQueue: [],
    humanPlayers,
    playerBags: undefined,
    activeBagKey: null,
  };
}

function spawnEnemy(state: GameState, opts?: { hpScale?: number; sent?: boolean }): void {
  const preferred = pickEnemyKind(state.wave, opts?.sent ?? false);
  const kind = pickEnabledEnemyKind(state.contentFilters, preferred);
  state.enemies.push(createEnemy(state, kind, opts));
}

function startWave(state: GameState): void {
  prepareLaneGeometryForWave(state, [state.hero, ...state.allies]);
  state.wave += 1;
  const plan = planWaveSpawns(state);
  beginWaveFromPlan(state, plan);
  state.sentQueue = consumePendingSends(state);
  state.spawnCd = state.wave <= 2 ? 0.35 : 0;
  beginWaveShop(state);
  onPlayerWaveStart(state);

  // Warden Platebound — top off armor each wave
  if (state.hero.heroId === "warden" && state.hero.alive) {
    state.hero.maxArmor = Math.max(state.hero.maxArmor ?? 0, 42);
    state.hero.armor = state.hero.maxArmor;
  }
  // Prism Aegis Lattice — refresh shield at wave start if quiet
  if (state.hero.heroId === "prism" && state.hero.alive) {
    state.hero.maxShield = Math.max(state.hero.maxShield ?? 0, 28);
    if ((state.hero.shieldQuiet ?? 99) >= 3.2) {
      state.hero.shield = state.hero.maxShield;
    }
  }

  spawnWaveSpecials(state, plan);
  applyWaveRider(state);
  resetWaveLives(state);
  applyCreativeWaveStart(state);
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
  // A client that is not watching this lane only receives a HUD summary, so the
  // summary count wins whenever it is present (see `net/sync.ts`).
  if (state.summaryEnemyCount != null) return state.summaryEnemyCount;
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
  if (
    !state.enemies.some((e) => e.alive) &&
    !state.spawning &&
    state.laneClearSpeedPct !== 0
  ) {
    // 100% ≈ 2×; −100% freezes while lane is clear.
    spd *= Math.max(0, 1 + state.laneClearSpeedPct / 100);
  }
  // Gyro kit: slow more as spin ramps (cap ~55% slow); lock move while blades detached
  if (heroUsesGyroKit(state.hero.heroId)) {
    const spin = state.hero.bladeSpin ?? 0;
    const mode = state.hero.bladeMode ?? "wrapped";
    if (mode === "wrapped" && spin > 0) spd *= 1 - Math.min(0.55, spin * 0.55);
    if (mode === "rewinding" || mode === "flying" || mode === "sling") return 0;
  }
  if (heroUsesGunnerKit(state.hero.heroId)) {
    spd *= gunnerMoveSpeedMul(state);
  }
  // Timed mobility overrides player steer a bit
  if ((state.hero.slideTimer ?? 0) > 0 || (state.hero.chargeTimer ?? 0) > 0) spd *= 0.15;
  // Cloud Wall Dart: locked during wind-up and ricochet
  if ((state.hero.cloudDartWindup ?? 0) > 0 || state.hero.cloudDartActive) return 0;
  if ((state.hero.slowTimer ?? 0) > 0) spd *= state.hero.slowMul ?? 1;
  spd *= state.playerSpeedMul ?? 1;
  return spd;
}

function respawnDelay(state: GameState): number {
  if (state.modifiers.respawnMul === 0) return 0;
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
    state.respawnMinigame =
      state.respawnMinigameEnabled && Number.isFinite(delay) && delay > 1
        ? createRespawnMinigame()
        : null;
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
  state.hero.radius = Math.max(4, def.radius * state.playerSizeMul);
  state.respawnMinigame = null;
  // Platebound / Aegis Lattice refresh defensive pools on respawn.
  if (def.passive.id === "platebound") {
    state.hero.maxArmor = Math.max(state.hero.maxArmor ?? 0, 42);
    state.hero.armor = state.hero.maxArmor;
  }
  if (def.passive.id === "aegis_lattice") {
    state.hero.maxShield = Math.max(state.hero.maxShield ?? 0, 28);
    state.hero.shield = state.hero.maxShield;
    state.hero.shieldQuiet = 0;
  }
  state.toast = "Respawned!";
  state.toastTimer = 1.4;
}

function moveHero(state: GameState, nx: number, ny: number): void {
  const r = state.hero.radius;
  const map = state.map;
  const prevX = state.hero.x;
  const prevY = state.hero.y;
  // Soft unstick: walls we already overlap (giant heroes, spawn pads) don't block until we're clear.
  const stuck = overlappedObstacles(map, prevX, prevY, r);
  // Slide along shaped playable bounds instead of snapping (hex teleport bug).
  const resolved = resolveMovePlayable(map, state.hero.x, state.hero.y, nx, ny, r);
  let x = resolved.x;
  let y = resolved.y;
  if (!blockedByNewObstacle(map, x, y, r, stuck)) {
    state.hero.x = x;
    state.hero.y = y;
  } else if (
    pointInPlayable(map, x, state.hero.y, r) &&
    !blockedByNewObstacle(map, x, state.hero.y, r, stuck)
  ) {
    state.hero.x = x;
  } else if (
    pointInPlayable(map, state.hero.x, y, r) &&
    !blockedByNewObstacle(map, state.hero.x, y, r, stuck)
  ) {
    state.hero.y = y;
  }
  const wall = applyWallBounce(state, state.hero, prevX, prevY, stuck);
  if (wall === "death") {
    state.hero.hp = 0;
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
            if (h === state.hero) applyPlayerDamage(state, dmg, { fromProjectile: true });
          });
        } else if (!p.hostile && (p.aoeRadius ?? 0) > 0) {
          explodeFriendlyAoe(state, p);
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
          if (h === state.hero) applyPlayerDamage(state, dmg, { fromProjectile: true });
        });
      } else if (!p.hostile && (p.aoeRadius ?? 0) > 0) {
        explodeFriendlyAoe(state, p);
      } else {
        p.alive = false;
      }
      continue;
    }

    if (p.hostile) {
      if (state.hero.alive && dist(p, state.hero) <= state.hero.radius + p.radius) {
        resolveHostileProjectile(state, p, [state.hero], (h, dmg) => {
          if (h === state.hero) applyPlayerDamage(state, dmg, { fromProjectile: true });
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
        if ((p.aoeRadius ?? 0) > 0 && !p.hostile) {
          explodeFriendlyAoe(state, p);
          break;
        }
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

const MAP_H_PAD = MAP_H + 40;

function afterWaveClear(state: GameState, input: Input): boolean {
  maybeRandomizeMap(state);
  if (
    !state.disableRelics &&
    shouldOfferRelicForWave(state.relicDrop ?? "elites_bosses", state.waveTier)
  ) {
    const choices = draftRelicChoices(state.relics, state.relicDraftSize ?? 3);
    if (choices.length > 0) {
      openOrQueueDraft(state, { kind: "relic", choices });
      state.waveTimer = state.waveBreakSec * state.modifiers.waveBreakMul;
      if (state.pendingLevelUps > 0) {
        openLevelDraft(state);
      }
      input.endFrame();
      return true;
    }
  }
  if (state.pendingLevelUps > 0) {
    openLevelDraft(state);
    state.waveTimer = state.waveBreakSec * state.modifiers.waveBreakMul;
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
  state.waveTimer = state.waveBreakSec * state.modifiers.waveBreakMul;
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

  const mayPause = canPauseSimulation(state);

  if (state.paused && mayPause) {
    input.endFrame();
    return;
  }

  if (
    mayPause &&
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

  // Gunner sniper aim-freeze (solo / single-human only)
  if (mayPause && gunnerShouldFreezeSim(state)) {
    state.elapsed += dt;
    if (state.hero.alive) {
      tickGunnerWeapons(state, {
        fireHeld: input.isActionHeld("mobility"),
        cycle: input.consumeAction("ultimate"),
        dt,
      });
    }
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
  if (state.pacifistPays) income *= 3;
  const gained = income * dt;
  state.gold += gained;
  state.goldFromIncome += gained;
  state.peakGold = Math.max(state.peakGold, state.gold);
  state.peakIncome = Math.max(state.peakIncome, income);
  if (gameplayCheats(state)?.infiniteGold) {
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
  {
    const fog = laneFogState({
      fogAlways: state.fogAlways,
      fogThicknessPct: state.fogThicknessPct,
      fogVisionRadius: state.fogVisionRadius,
      curseFogTimer: state.curseFogTimer,
      mapEclipseActive: state.mapEclipseActive,
    });
    state.mapFogActive = fog.active;
    state.fogOpacity = fog.opacity;
    state.fogVisionRadiusResolved = fog.visionRadius;
  }

  tickHexZones(state, dt);

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
      if (state.respawnMinigame && state.respawnTimer > 1) {
        tickRespawnMinigame(state.respawnMinigame, dt);
        // Space / utility press attempts the precision window.
        if (input.consumeAction("utility") || input.consumePress("Space")) {
          const shaved = pressRespawnMinigame(state.respawnMinigame, state.respawnTimer);
          if (shaved > 0) {
            state.respawnTimer = Math.max(1, state.respawnTimer - shaved);
            state.toast = `Precision! −${shaved.toFixed(1)}s`;
            state.toastTimer = 0.7;
          } else if (state.respawnMinigame.lastHit === false) {
            state.toast = "Missed the window";
            state.toastTimer = 0.45;
          }
        }
      } else {
        state.respawnMinigame = null;
      }
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
  if (state.hero.alive) {
    const defPool = {
      armor: state.hero.armor ?? 0,
      maxArmor: state.hero.maxArmor ?? 0,
      shield: state.hero.shield ?? 0,
      maxShield: state.hero.maxShield ?? 0,
      shieldQuiet: state.hero.shieldQuiet ?? 0,
    };
    tickDefenseRegen(defPool, dt);
    state.hero.shield = defPool.shield;
    state.hero.shieldQuiet = defPool.shieldQuiet;
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

  if (state.pendingArtifactDebounce > 0) {
    state.pendingArtifactDebounce = Math.max(0, state.pendingArtifactDebounce - dt);
  }

  if (state.hero.alive) {
    const axis = input.moveAxis();
    const dir = normalize(axis.x, axis.y);
    const speed = heroMoveSpeed(state);
    const delta = slipSlideDelta(state.hero, dir.x, dir.y, speed, dt, !!state.slipNSlide);
    moveHero(state, state.hero.x + delta.x, state.hero.y + delta.y);

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
    } else if (heroUsesGunnerKit(state.hero.heroId)) {
      tickGunnerWeapons(state, {
        fireHeld: input.isActionHeld("mobility"),
        cycle: input.consumeAction("ultimate"),
        dt,
      });
      input.consumeAction("mobility");
    } else if (input.consumeAction("mobility")) {
      tryCastAbility(state, "mobility", axis);
    }
    if (!heroUsesGunnerKit(state.hero.heroId) && input.consumeAction("ultimate")) {
      tryCastAbility(state, "ultimate", axis);
    }
    if (input.consumeAction("utility")) tryCastUtility(state);

    tickAbilityEffects(state, dt);
    tickUtilityEffects(state, dt);
    // Pending free Artifact: first attack press after debounce places at cursor.
    if (
      state.pendingArtifact &&
      state.pendingArtifactDebounce <= 0 &&
      input.consumeAction("attack")
    ) {
      tryPlacePendingArtifact(state, state.aimWorldX, state.aimWorldY);
    }
    tickHeroKits(state, dt, input.isActionHeld("attack"));
    if (heroUsesVectorKit(state.hero.heroId)) tickVectorMomentum(state, dt);

    const canBasic =
      !heroUsesGyroKit(state.hero.heroId) ||
      (state.hero.bladeMode ?? "wrapped") === "wrapped";
    if (
      !state.pendingArtifact &&
      canBasic &&
      input.isActionHeld("attack") &&
      state.hero.attackCd <= 0
    ) {
      tryBasicAttack(state);
    }
  }

  updateProjectiles(state, dt);
  updateEnemies(state, dt);
  updateTurrets(state, dt);
  if (!state.endless && !state.mpLane) updateOpponent(state, dt);
  tickChests(state, dt);
  tickMapSpecials(state, dt, state.spawning || state.enemies.some((e) => e.alive));
  tickMines(state, dt);

  for (const f of state.fx) f.life -= dt;
  state.fx = state.fx.filter((f) => f.life > 0);
  for (const f of state.damageFloaters) {
    f.life -= dt;
    f.y += f.vy * dt;
    f.vy *= 0.92;
  }
  state.damageFloaters = state.damageFloaters.filter((f) => f.life > 0);

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
  } else if (!state.pausedForDraft || !mayPause) {
    state.waveTimer -= dt;
    if (state.waveTimer <= 0) startWave(state);
  }

  if (state.baseHp <= 0) {
    if (state.baseInvincible) {
      state.baseHp = Math.max(1, state.baseHp);
    } else {
      state.baseHp = 0;
      state.status = "lost";
    }
  }

  if (state.hero.alive && state.hero.hp <= 0) {
    killHero(state);
  }

  input.endFrame();
}

/**
 * Common tail for every draft resolution: promote anything waiting in the queue,
 * recompute the draft flags, and only wrap up the wave once the player has no
 * reward left to take.
 */
function afterDraftResolved(state: GameState): void {
  if (state.pendingLevelUps > 0 && !state.levelDraft) openLevelDraft(state);
  syncDraftFlags(state);
  if (state.draftKind !== null) return;
  applySecondWind(state);
  if (waveVictoryReached(state)) state.status = "won";
}

export function chooseRelic(state: GameState, id: RelicId): void {
  if (!state.relicDraft?.includes(id)) return;
  pickRelic(state, id);
  state.pendingRelicDraft = false;
  playSfx("levelup");
  afterDraftResolved(state);
}

export function skipRelic(state: GameState): void {
  if (!state.relicDraft) return;
  state.relicDraft = null;
  state.pendingRelicDraft = false;
  afterDraftResolved(state);
  state.toast = "Relic skipped";
  state.toastTimer = 1.4;
}

export function skipLevelUp(state: GameState): void {
  skipLevelDraft(state);
  afterDraftResolved(state);
}

export function chooseLevelUp(state: GameState, id: LevelPassiveId): void {
  chooseLevelPassive(state, id);
  playSfx("levelup");
  afterDraftResolved(state);
}

export function chooseUtility(state: GameState, id: UtilityId): void {
  if (!state.utilityDraft?.includes(id)) return;
  applyUtilityChoice(state, id);
  afterDraftResolved(state);
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
