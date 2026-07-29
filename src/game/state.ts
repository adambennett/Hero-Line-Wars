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
import { HEROES, type HeroId } from "../data/heroes";
import { getMap, resolveMapChoice, circleHitsObstacle, type MapDef, type MapId } from "../data/maps";
import { draftRelicChoices, type RelicId } from "../data/relics";
import { SEND_PACKS } from "../data/send";
import { rollShopOffer, type ShopItemId } from "../data/shop";
import { DEFAULT_MAX_TURRETS, type TurretKind } from "../data/turrets";
import type { LevelPassiveId } from "../data/xp";
import { clamp, dist, normalize } from "./math";
import type { Input } from "../systems/input";
import { tickAbilityEffects, tryCastAbility } from "../systems/abilities";
import {
  applyPlayerDamage,
  applySlow,
  bounceProjectile,
  damageEnemy,
  inHighGround,
  tryBasicAttack,
} from "../systems/combat";
import { createEnemy, updateEnemies } from "../systems/enemies";
import { applySecondWind, pickRelic } from "../systems/relics";
import { beginWaveShop, buyShopItem, tickShopRotation } from "../systems/shop";
import { buySendPack, consumePendingSends } from "../systems/send";
import { tryUpgradeBase } from "../systems/baseUpgrade";
import { chooseLevelPassive, openLevelDraft } from "../systems/xp";
import { updateTurrets } from "../systems/turrets";
import { playSfx } from "../systems/audio";

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
  preferAngle?: number;
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
export type DraftKind = "relic" | "level" | null;

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
};

export type RunOptions = {
  mapId: MapId | "random";
  maxTurrets: number;
};

export type GameState = {
  status: GameStatus;
  map: MapDef;
  mapId: MapId;
  maxTurrets: number;
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
};

export function createState(
  heroId: HeroId = "ranger",
  opts?: Partial<RunOptions>,
): GameState {
  const mapId = resolveMapChoice(opts?.mapId ?? "random");
  const map = getMap(mapId);
  const def = HEROES[heroId];
  return {
    status: "playing",
    map,
    mapId,
    maxTurrets: opts?.maxTurrets ?? DEFAULT_MAX_TURRETS,
    hero: {
      id: 0,
      heroId,
      x: map.base.x + 120,
      y: map.base.y,
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
    },
    enemies: [],
    turrets: [],
    projectiles: [],
    fx: [],
    beam: null,
    baseHp: map.base.maxHp,
    baseLevel: 0,
    gold: STARTING_GOLD,
    incomePerSec: BASE_INCOME_GOLD_PER_SEC,
    wave: 0,
    waveTier: "normal",
    waveTimer: 2,
    spawning: false,
    toSpawn: 0,
    sentQueue: [],
    spawnCd: 0,
    nextId: 1,
    elapsed: 0,
    shopOpen: false,
    nearShop: false,
    shopOwned: {},
    shopOffer: rollShopOffer(),
    shopRefreshesLeft: 0,
    shopRefreshTimer: 0,
    shopFrozen: false,
    pendingSends: [],
    sendsThisRun: 0,
    toast: `${map.name}`,
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
  };
}

function spawnEnemy(state: GameState, opts?: { hpScale?: number; sent?: boolean }): void {
  const kind = pickEnemyKind(state.wave, opts?.sent ?? false);
  state.enemies.push(createEnemy(state, kind, opts));
}

function startWave(state: GameState): void {
  state.wave += 1;
  state.waveTier = waveTier(state.wave);
  state.spawning = true;
  const count = Math.round(
    ENEMIES_PER_WAVE_BASE + (state.wave - 1) * WAVE_SCALE.enemiesPerWave,
  );
  state.toSpawn = count;
  if (state.waveTier === "elite") state.toSpawn = Math.max(3, Math.floor(state.toSpawn * 0.75));
  if (state.waveTier === "boss") state.toSpawn = Math.max(2, Math.floor(state.toSpawn * 0.55));
  state.sentQueue = consumePendingSends(state);
  state.spawnCd = state.wave <= 2 ? 0.35 : 0;
  beginWaveShop(state);

  // Warden Bastion
  if (state.hero.heroId === "warden" && state.hero.alive) {
    state.hero.barrierTimer = Math.max(state.hero.barrierTimer, 1.8);
  }

  if (state.waveTier === "elite") {
    state.enemies.push(createEnemy(state, "elite", { hpScale: 1 }));
    state.toast = "ELITE WAVE";
    state.toastTimer = 2.2;
  } else if (state.waveTier === "boss") {
    state.enemies.push(createEnemy(state, "boss", { hpScale: 1 }));
    state.toast = "BOSS WAVE";
    state.toastTimer = 2.4;
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

export function heroMoveSpeed(state: GameState): number {
  return HEROES[state.hero.heroId].speed + state.hero.speedBonus;
}

function respawnDelay(state: GameState): number {
  const t =
    RESPAWN.baseSec + state.wave * RESPAWN.waveFactor + state.deathCount * RESPAWN.deathFactor;
  return Math.min(RESPAWN.maxSec, t);
}

function killHero(state: GameState): void {
  if (!state.hero.alive) return;
  state.hero.alive = false;
  state.hero.hp = 0;
  state.deathCount += 1;
  state.respawnTimer = respawnDelay(state);
  state.shopOpen = false;
  state.toast = `Downed — respawn ${state.respawnTimer.toFixed(1)}s`;
  state.toastTimer = 2;
  state.damageFlash = 0.4;
  state.vignette = 0.7;
  state.shake = 0.3;
}

function respawnHero(state: GameState): void {
  const def = HEROES[state.hero.heroId];
  state.hero.alive = true;
  state.hero.hp = state.hero.maxHp;
  state.hero.x = state.map.base.x + 120;
  state.hero.y = state.map.base.y;
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
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life !== undefined) {
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
    }
    if (p.x < -20 || p.x > MAP_W + 20 || p.y < -20 || p.y > MAP_H_PAD) {
      p.alive = false;
      continue;
    }

    if (p.hostile) {
      if (state.hero.alive && dist(p, state.hero) <= state.hero.radius + p.radius) {
        applyPlayerDamage(state, p.damage);
        p.alive = false;
      }
      continue;
    }

    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (dist(p, e) <= e.radius + p.radius) {
        damageEnemy(state, e, p.damage, {
          fromBasic: p.fromBasic,
          slow: p.appliesSlow,
        });
        if (p.appliesSlow) applySlow(e, 0.6, 1.5);
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
    const choices = draftRelicChoices(state.relics, 3);
    if (choices.length > 0) {
      state.relicDraft = choices;
      state.pausedForDraft = true;
      state.pendingRelicDraft = true;
      state.draftKind = "relic";
      state.waveTimer = WAVE_BREAK_SEC;
      if (state.pendingLevelUps > 0) {
        openLevelDraft(state);
      }
      input.endFrame();
      return true;
    }
  }
  if (state.pendingLevelUps > 0) {
    openLevelDraft(state);
    state.waveTimer = WAVE_BREAK_SEC;
    input.endFrame();
    return true;
  }
  applySecondWind(state);
  state.waveTimer = WAVE_BREAK_SEC;
  if (state.wave >= WIN_WAVES) {
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

  if (state.pausedForDraft && (state.relicDraft || state.levelDraft)) {
    state.elapsed += dt;
    input.endFrame();
    return;
  }

  state.elapsed += dt;
  state.gold += state.incomePerSec * dt;

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
    state.respawnTimer -= dt;
    if (state.respawnTimer <= 0) respawnHero(state);
  }

  const shop = state.map.shop;
  state.nearShop = state.hero.alive && dist(state.hero, shop) <= shop.interactRange;
  if (!state.nearShop && state.shopOpen) state.shopOpen = false;

  if (state.hero.alive && input.consumePress("KeyF") && state.nearShop) {
    state.shopOpen = !state.shopOpen;
  }

  if (input.consumePress("KeyU")) {
    tryUpgradeBase(state);
  }

  for (const pack of SEND_PACKS) {
    if (pack.minBaseLevel > state.baseLevel) continue;
    if (pack.digit >= 4 && state.shopOpen) continue;
    if (input.consumePress(`Digit${pack.digit}`)) {
      buySendPack(state, pack.id);
    }
  }

  if (state.shopOpen && state.hero.alive) {
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

    if (input.consumeAction("mobility")) tryCastAbility(state, "mobility", axis);
    if (input.consumeAction("ultimate")) tryCastAbility(state, "ultimate", axis);

    tickAbilityEffects(state, dt);

    if (input.isActionHeld("attack") && state.hero.attackCd <= 0) {
      tryBasicAttack(state);
    }
  }

  updateProjectiles(state, dt);
  updateEnemies(state, dt);
  updateTurrets(state, dt);

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
  if (state.wave >= WIN_WAVES && !state.pausedForDraft) {
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
  if (state.wave >= WIN_WAVES) state.status = "won";
}

export function chooseLevelUp(state: GameState, id: LevelPassiveId): void {
  chooseLevelPassive(state, id);
  playSfx("levelup");
  if (!state.pausedForDraft) {
    applySecondWind(state);
    if (state.wave >= WIN_WAVES) state.status = "won";
  }
}

export function heroOnHighGround(state: GameState): boolean {
  return inHighGround(state, state.hero);
}

export function pendingSendCount(state: GameState): number {
  return state.pendingSends.reduce((n, s) => n + s.enemies, 0);
}
