import { SEND_PACKS } from "../data/send";
import { normalize } from "../game/math";
import {
  chooseLevelUp,
  chooseRelic,
  heroMoveSpeed,
  skipRelic,
  waveVictoryReached,
  type GameState,
  type HeroRuntime,
} from "../game/state";
import { tryCastAbility, tickAbilityEffects } from "../systems/abilities";
import { tryBasicAttack } from "../systems/combat";
import { tryUpgradeBase } from "../systems/baseUpgrade";
import { buyShopItem } from "../systems/shop";
import { buySendPack } from "../systems/send";
import { updateEnemies } from "../systems/enemies";
import { updateTurrets } from "../systems/turrets";
import { tickShopRotation, beginWaveShop } from "../systems/shop";
import { consumePendingSends } from "../systems/send";
import { createEnemy } from "../systems/enemies";
import { pickEnemyKind, waveTier } from "../data/enemies";
import {
  ENEMIES_PER_WAVE_BASE,
  MAP_W,
  RESPAWN,
  WAVE_BREAK_SEC,
  WAVE_SCALE,
} from "../data/constants";
import { circleHitsObstacle, findClearSpot, reshuffleObstacles, blockedByObstacle } from "../data/maps";
import { clamp, dist } from "../game/math";
import { HEROES } from "../data/heroes";
import { draftRelicChoices } from "../data/relics";
import { applySecondWind } from "../systems/relics";
import { openLevelDraft } from "../systems/xp";
import { bounceProjectile, applyPlayerDamage, applySlow, damageEnemy, resolveHostileProjectile } from "../systems/combat";
import { setLaneSfxEnabled } from "../systems/audio";
import type { CombatIntent } from "./types";
import { emptyIntent } from "./types";
import type { MpMatch } from "./matchFactory";
import { allLaneHeroes, heroForSlot } from "./matchFactory";
import { scriptedIntent, thinkNeural, type NeuralLaneAi } from "../ai/runtime";

function moveHeroObj(state: GameState, hero: HeroRuntime, nx: number, ny: number): void {
  const r = hero.radius;
  const map = state.map;
  const x = clamp(nx, r, MAP_W - r);
  const y = clamp(ny, map.laneTop + r, map.laneBottom - r);
  if (!map.obstacles.some((o) => circleHitsObstacle(x, y, r, o))) {
    hero.x = x;
    hero.y = y;
    return;
  }
  if (!map.obstacles.some((o) => circleHitsObstacle(x, hero.y, r, o))) {
    hero.x = x;
    return;
  }
  if (!map.obstacles.some((o) => circleHitsObstacle(hero.x, y, r, o))) {
    hero.y = y;
  }
}

function withHero(state: GameState, hero: HeroRuntime, fn: () => void): void {
  const prev = state.hero;
  state.hero = hero;
  try {
    fn();
  } finally {
    // If fn replaced state.hero identity unexpectedly, keep mutations on `hero`.
    if (state.hero !== hero && state.hero === prev) {
      /* no-op */
    }
    // Restore primary pointer: if we were processing an ally, put primary back.
    if (prev !== hero) state.hero = prev;
  }
}

function applyHeroCombat(state: GameState, hero: HeroRuntime, intent: CombatIntent, dt: number): void {
  if (!hero.alive) return;

  withHero(state, hero, () => {
    state.aimWorldX = hero.x + intent.aimX * 200;
    state.aimWorldY = hero.y + intent.aimY * 200;

    const dir = normalize(intent.moveX, intent.moveY);
    const speed = heroMoveSpeed(state);
    moveHeroObj(state, hero, hero.x + dir.x * speed * dt, hero.y + dir.y * speed * dt);

    hero.attackCd = Math.max(0, hero.attackCd - dt);
    for (let i = 0; i < hero.abilityCds.length; i++) {
      hero.abilityCds[i] = Math.max(0, hero.abilityCds[i]! - dt);
    }

    if (intent.mobility) tryCastAbility(state, "mobility", { x: intent.moveX, y: intent.moveY });
    if (intent.ultimate) tryCastAbility(state, "ultimate", { x: intent.moveX, y: intent.moveY });
    tickAbilityEffects(state, dt);

    if (intent.attackHeld && hero.attackCd <= 0) {
      tryBasicAttack(state);
    }
  });
}

function applyLaneUiIntent(state: GameState, intent: CombatIntent): void {
  if (intent.upgradeBase) tryUpgradeBase(state);
  if (intent.toggleShop && state.nearShop) state.shopOpen = !state.shopOpen;
  if (intent.sendDigit != null) {
    const pack = SEND_PACKS.find((p) => p.digit === intent.sendDigit);
    if (pack) buySendPack(state, pack.id);
  }
  if (intent.shopSlot != null && state.shopOpen) {
    const id = state.shopOffer[intent.shopSlot];
    if (id) buyShopItem(state, id);
  }
  if (intent.chooseRelic) chooseRelic(state, intent.chooseRelic);
  if (intent.skipRelic) skipRelic(state);
  if (intent.chooseLevel) chooseLevelUp(state, intent.chooseLevel);
}

function spawnEnemy(state: GameState, opts?: { hpScale?: number; sent?: boolean }): void {
  const kind = pickEnemyKind(state.wave, opts?.sent ?? false);
  state.enemies.push(createEnemy(state, kind, opts));
}

function startWave(state: GameState): void {
  if (state.map.shiftingObstacles) {
    const heroes = allLaneHeroes(state);
    const reserved = [
      ...heroes,
      ...state.turrets.filter((t) => t.alive),
    ].map((u) => ({ x: u.x, y: u.y, radius: u.radius }));
    reshuffleObstacles(state.map, reserved);
    for (const h of heroes) {
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

  for (const h of allLaneHeroes(state)) {
    if (h.heroId === "warden" && h.alive) {
      h.barrierTimer = Math.max(h.barrierTimer, 1.8);
    }
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

function respawnDelay(state: GameState): number {
  const t =
    RESPAWN.baseSec + state.wave * RESPAWN.waveFactor + state.deathCount * RESPAWN.deathFactor;
  return Math.min(RESPAWN.maxSec, t) * state.modifiers.respawnMul;
}

function killHeroObj(state: GameState, hero: HeroRuntime): void {
  if (!hero.alive) return;
  hero.alive = false;
  hero.hp = 0;
  state.deathCount += 1;
  if (hero === state.hero || hero.controllerSlot === state.hero.controllerSlot) {
    state.respawnTimer = respawnDelay(state);
  } else {
    hero.attackCd = respawnDelay(state); // reuse as respawn timer for allies
  }
  state.toast = "Ally downed!";
  state.toastTimer = 1.4;
}

function respawnHeroObj(state: GameState, hero: HeroRuntime): void {
  const def = HEROES[hero.heroId];
  hero.alive = true;
  hero.hp = hero.maxHp;
  hero.x = state.map.base.x + 120;
  hero.y = state.map.base.y;
  hero.attackCd = 0.4;
  hero.barrierTimer = 0;
  hero.whirlwindTimer = 0;
  hero.radius = def.radius;
}

function updateProjectilesMp(state: GameState, dt: number): void {
  const heroes = allLaneHeroes(state);
  for (const p of state.projectiles) {
    if (!p.alive) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life !== undefined) {
      p.life -= dt;
      if (p.life <= 0) {
        if (p.hostile && (p.aoeRadius ?? 0) > 0) {
          resolveHostileProjectile(state, p, heroes, (h, dmg) => {
            withHero(state, h as HeroRuntime, () => applyPlayerDamage(state, dmg));
          });
        } else {
          p.alive = false;
        }
        continue;
      }
    }
    if (p.x < -20 || p.x > MAP_W + 20 || p.y < -20 || p.y > 600) {
      p.alive = false;
      continue;
    }

    if (blockedByObstacle(state.map, p.x, p.y, p.radius)) {
      if (p.hostile && (p.aoeRadius ?? 0) > 0) {
        resolveHostileProjectile(state, p, heroes, (h, dmg) => {
          withHero(state, h as HeroRuntime, () => applyPlayerDamage(state, dmg));
        });
      } else {
        p.alive = false;
      }
      continue;
    }

    if (p.hostile) {
      for (const h of heroes) {
        if (!h.alive) continue;
        if (dist(p, h) <= h.radius + p.radius) {
          resolveHostileProjectile(state, p, heroes, (hh, dmg) => {
            withHero(state, hh as HeroRuntime, () => applyPlayerDamage(state, dmg));
          });
          break;
        }
      }
      continue;
    }

    if (state.friendlyFire) {
      for (const h of heroes) {
        if (!h.alive || h === state.hero) continue;
        if (dist(p, h) <= h.radius + p.radius) {
          withHero(state, h, () => applyPlayerDamage(state, p.damage));
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

function afterWaveClearMp(state: GameState): void {
  if (state.waveTier === "elite" || state.waveTier === "boss") {
    const choices = draftRelicChoices(state.relics, 3);
    if (choices.length > 0) {
      state.relicDraft = choices;
      state.pausedForDraft = true;
      state.pendingRelicDraft = true;
      state.draftKind = "relic";
      state.waveTimer = WAVE_BREAK_SEC * state.modifiers.waveBreakMul;
      if (state.pendingLevelUps > 0) openLevelDraft(state);
      return;
    }
  }
  if (state.pendingLevelUps > 0) {
    openLevelDraft(state);
    state.waveTimer = WAVE_BREAK_SEC * state.modifiers.waveBreakMul;
    return;
  }
  applySecondWind(state);
  state.waveTimer = WAVE_BREAK_SEC * state.modifiers.waveBreakMul;
  if (waveVictoryReached(state)) {
    state.status = "won";
  }
}

function resolveAiIntent(state: GameState, neural: NeuralLaneAi | null | undefined, dt: number): CombatIntent {
  if (neural) return thinkNeural(state, neural, dt);
  return scriptedIntent(state);
}

function updateLaneMp(
  state: GameState,
  intents: Map<number, CombatIntent>,
  dt: number,
  outboundSends: GameState["pendingSends"],
  neural?: NeuralLaneAi | null,
  /** Unlimited dual-lane: hold next wave until both lanes are ready. */
  holdNextWave = false,
): void {
  if (state.status !== "playing") return;
  if (state.pausedForDraft && (state.relicDraft || state.levelDraft)) {
    state.elapsed += dt;
    if (state.aiControlled) {
      applyLaneUiIntent(state, resolveAiIntent(state, neural, dt));
    } else {
      for (const intent of intents.values()) applyLaneUiIntent(state, intent);
    }
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

  for (const h of allLaneHeroes(state)) {
    if (!h.alive) {
      if (h === state.hero) {
        state.respawnTimer -= dt;
        if (state.respawnTimer <= 0) respawnHeroObj(state, h);
      } else {
        h.attackCd -= dt;
        if (h.attackCd <= 0) respawnHeroObj(state, h);
      }
    } else if ((h.slowTimer ?? 0) > 0) {
      h.slowTimer = (h.slowTimer ?? 0) - dt;
      if ((h.slowTimer ?? 0) <= 0) {
        h.slowTimer = 0;
        h.slowMul = 1;
      }
    }
  }

  const shop = state.map.shop;
  state.nearShop =
    state.hero.alive && dist(state.hero, shop) <= shop.interactRange;

  const beforeSends = state.pendingSends.length;

  if (state.aiControlled) {
    const ai = resolveAiIntent(state, neural, dt);
    applyLaneUiIntent(state, ai);
    applyHeroCombat(state, state.hero, ai, dt);
  } else {
    for (const h of allLaneHeroes(state)) {
      const slot = h.controllerSlot;
      if (slot == null || slot < 0) continue;
      const intent = intents.get(slot) ?? emptyIntent();
      applyLaneUiIntent(state, intent);
      applyHeroCombat(state, h, intent, dt);
    }
  }

  // Capture newly purchased sends for cross-lane exchange
  if (state.pendingSends.length > beforeSends) {
    const neu = state.pendingSends.splice(beforeSends);
    outboundSends.push(...neu);
  }

  updateProjectilesMp(state, dt);
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
      afterWaveClearMp(state);
    }
  } else if (!state.pausedForDraft) {
    state.waveTimer -= dt;
    if (state.waveTimer <= 0) {
      if (holdNextWave) {
        state.waveTimer = 0;
      } else {
        startWave(state);
      }
    }
  }

  if (state.baseHp <= 0) {
    state.baseHp = 0;
    state.status = "lost";
  }

  for (const h of allLaneHeroes(state)) {
    if (h.alive && h.hp <= 0) killHeroObj(state, h);
  }
}

/** Lane is between waves and ready to roll the next one (timer expired). */
function laneReadyToStartWave(state: GameState): boolean {
  if (state.status !== "playing") return false;
  if (state.pausedForDraft) return false;
  if (state.spawning || state.enemies.length > 0) return false;
  return state.waveTimer <= 0;
}

/** Host: step both lanes, exchange sends, resolve win/loss. */
export function stepMpMatch(
  match: MpMatch,
  intents: Map<number, CombatIntent>,
  dt: number,
): void {
  if (match.ended) return;

  const out0: GameState["pendingSends"] = [];
  const out1: GameState["pendingSends"] = [];
  // Unlimited: keep both lanes on the same wave cadence so one can't soft-lock forever alone
  const syncWaves = match.lanes[0].wavesToWin <= 0 || match.lanes[1].wavesToWin <= 0;

  setLaneSfxEnabled(match.viewTeam === 0);
  updateLaneMp(match.lanes[0], intents, dt, out0, match.laneAi[0], syncWaves);
  setLaneSfxEnabled(match.viewTeam === 1);
  updateLaneMp(match.lanes[1], intents, dt, out1, match.laneAi[1], syncWaves);
  setLaneSfxEnabled(true);

  // Player sends from lane0 hit lane1 and vice versa
  match.lanes[1].pendingSends.push(...out0);
  match.lanes[0].pendingSends.push(...out1);

  if (syncWaves && laneReadyToStartWave(match.lanes[0]) && laneReadyToStartWave(match.lanes[1])) {
    // Keep wave indices aligned if somehow drifted
    const w = Math.max(match.lanes[0].wave, match.lanes[1].wave);
    match.lanes[0].wave = w;
    match.lanes[1].wave = w;
    startWave(match.lanes[0]);
    startWave(match.lanes[1]);
  }

  if (match.lanes[0].status === "lost" || match.lanes[1].status === "won") {
    match.ended = true;
    match.winnerTeam = 1;
  } else if (match.lanes[1].status === "lost" || match.lanes[0].status === "won") {
    match.ended = true;
    match.winnerTeam = 0;
  }
}

export function gatherLocalIntent(
  input: {
    moveAxis: () => { x: number; y: number };
    isActionHeld: (a: "attack" | "mobility" | "ultimate") => boolean;
    consumeAction: (a: "attack" | "mobility" | "ultimate") => boolean;
    consumePress: (code: string) => boolean;
  },
  aimWorld: { x: number; y: number },
  hero: HeroRuntime | null,
): CombatIntent {
  const move = input.moveAxis();
  let aimX = 1;
  let aimY = 0;
  if (hero) {
    const dx = aimWorld.x - hero.x;
    const dy = aimWorld.y - hero.y;
    const n = normalize(dx, dy);
    if (n.x !== 0 || n.y !== 0) {
      aimX = n.x;
      aimY = n.y;
    }
  }

  let sendDigit: number | null = null;
  for (let d = 1; d <= 6; d++) {
    if (input.consumePress(`Digit${d}`)) sendDigit = d;
  }

  let shopSlot: number | null = null;
  // Digit4-6 also used for shop when open — handled via sendDigit conflict; Game can set shopSlot

  return {
    moveX: move.x,
    moveY: move.y,
    aimX,
    aimY,
    attackHeld: input.isActionHeld("attack"),
    mobility: input.consumeAction("mobility"),
    ultimate: input.consumeAction("ultimate"),
    toggleShop: input.consumePress("KeyF"),
    upgradeBase: input.consumePress("KeyU"),
    sendDigit,
    shopSlot,
    chooseRelic: null,
    skipRelic: false,
    chooseLevel: null,
    viewOpponent: null,
  };
}

export { heroForSlot };
