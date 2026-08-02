import { normalize } from "../game/math";
import {
  applyDeathLives,
  chooseCurse,
  chooseLevelUp,
  chooseRelic,
  chooseUtility,
  heroMoveSpeed,
  laneOutOfRunLives,
  resetWaveLives,
  skipRelic,
  waveVictoryReached,
  type GameState,
  type HeroRuntime,
} from "../game/state";
import {
  clearTeleporters,
  fireChargedBladeHook,
  tryCastAbility,
  tickAbilityEffects,
  tickHeroKits,
  tickMines,
  tickVectorMomentum,
} from "../systems/abilities";
import {
  tryBasicAttack,
  explodeFriendlyAoe,
  applyPlayerDamage,
  applySlow,
  bounceProjectile,
  damageEnemy,
  resolveHostileProjectile,
  steerSeekingProjectile,
  applyMagnetPull,
  tickHexZones,
} from "../systems/combat";
import { tickGunnerWeapons } from "../systems/gunner";
import { tryCastUtility, tickUtilityEffects } from "../systems/utility";
import { chooseBaseBranch, tryUpgradeBase } from "../systems/baseUpgrade";
import { buyShopItem, tickShopRotation, beginWaveShop } from "../systems/shop";
import { buySendPack, availableSendPacks, consumePendingSends } from "../systems/send";
import { updateEnemies, createEnemy } from "../systems/enemies";
import { updateTurrets } from "../systems/turrets";
import { chooseChestReward, tickChests, tickMapSpecials } from "../systems/chests";
import { applyWaveRider, tryPhoenixRevive } from "../systems/relics";
import { pickEnemyKind } from "../data/enemies";
import { MAP_W, WAVE_BREAK_SEC, WAVE_SCALE } from "../data/constants";
import {
  circleHitsObstacle,
  blockedByObstacle,
  mapRespawn,
  nearAnyShop,
  pointInPlayable,
  resolveMovePlayable,
} from "../data/maps";
import { laneFogState } from "../game/fog";
import {
  beginWaveFromPlan,
  planWaveSpawns,
  prepareLaneGeometryForWave,
  spawnWaveSpecials,
} from "../systems/waves";
import { canPauseSimulation } from "../game/pause";
import { openOrQueueDraft } from "../systems/drafts";
import { dist } from "../game/math";
import {
  heroUsesGyroKit,
  heroUsesWarpKit,
  heroUsesGunnerKit,
  heroUsesVectorKit,
  resolveHero,
} from "../custom/registry";
import { rerollLevelDraft, rerollRelicDraft, openLevelDraft } from "../systems/xp";
import { humanBagPausedForDraft, withPlayerBag } from "./playerBag";
import { draftRelicChoices } from "../data/relics";
import { applySecondWind } from "../systems/relics";
import { setLaneSfxEnabled } from "../systems/audio";

function applyOutgoingCurseTo(from: GameState, to: GameState): void {
  const c = from.outgoingCurse;
  if (!c) return;
  to.curseShopBlock = Math.max(to.curseShopBlock, c.shopBlock);
  to.curseSendBlock = Math.max(to.curseSendBlock, c.sendBlock);
  to.curseUpgradeBlock = Math.max(to.curseUpgradeBlock, c.upgradeBlock);
  to.curseIncomeTaxTimer = Math.max(to.curseIncomeTaxTimer, c.incomeTaxDuration);
  to.curseIncomeTaxMul = c.incomeTaxMul;
  to.curseFogTimer = Math.max(to.curseFogTimer, c.fogDuration);
  to.curseShopRefreshSlowTimer = Math.max(to.curseShopRefreshSlowTimer, c.shopRefreshDuration);
  to.curseShopRefreshSlowMul = c.shopRefreshSlow;
  from.outgoingCurse = null;
  to.toast = "Hex Storm hits your lane!";
  to.toastTimer = 2;
}
import type { CombatIntent } from "./types";
import { emptyIntent } from "./types";
import type { MpMatch } from "./matchFactory";
import {
  allLaneHeroes,
  heroForSlot,
  isAiControllerSlot,
  neuralForHero,
} from "./matchFactory";
import { scriptedIntent, thinkNeural, type NeuralLaneAi } from "../ai/runtime";

function moveHeroObj(state: GameState, hero: HeroRuntime, nx: number, ny: number): void {
  const r = hero.radius;
  const map = state.map;
  // Slide along shaped playable bounds instead of snapping (parity with SP moveHero).
  const resolved = resolveMovePlayable(map, hero.x, hero.y, nx, ny, r);
  const x = resolved.x;
  const y = resolved.y;
  if (!map.obstacles.some((o) => circleHitsObstacle(x, y, r, o))) {
    hero.x = x;
    hero.y = y;
    return;
  }
  if (
    pointInPlayable(map, x, hero.y, r) &&
    !map.obstacles.some((o) => circleHitsObstacle(x, hero.y, r, o))
  ) {
    hero.x = x;
    return;
  }
  if (
    pointInPlayable(map, hero.x, y, r) &&
    !map.obstacles.some((o) => circleHitsObstacle(hero.x, y, r, o))
  ) {
    hero.y = y;
  }
}

function withHero<T>(state: GameState, hero: HeroRuntime, fn: () => T): T {
  const prev = state.hero;
  state.hero = hero;
  try {
    return fn();
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

    const axis = { x: intent.moveX, y: intent.moveY };
    if (heroUsesGyroKit(hero.heroId)) {
      const mode = hero.bladeMode ?? "wrapped";
      const canCharge =
        (mode === "wrapped" || mode === "reforming") &&
        (hero.bladeReformTimer ?? 0) <= 0 &&
        hero.abilityCds[0]! <= 0;
      const held = !!intent.mobilityHeld || intent.mobility;
      if (canCharge && held) {
        hero.bladeHookCharging = true;
        hero.bladeHookCharge = Math.min(1, (hero.bladeHookCharge ?? 0) + dt / 0.9);
        if ((hero.bladeHookCharge ?? 0) >= 1 || intent.mobility) {
          fireChargedBladeHook(state, axis);
        }
      } else if (hero.bladeHookCharging) {
        fireChargedBladeHook(state, axis);
      } else {
        hero.bladeHookCharge = 0;
      }
    } else if (heroUsesGunnerKit(hero.heroId)) {
      tickGunnerWeapons(state, {
        fireHeld: !!intent.mobilityHeld || intent.mobility,
        cycle: intent.ultimate,
        dt,
      });
    } else if (intent.mobility) {
      tryCastAbility(state, "mobility", axis);
    }
    if (!heroUsesGunnerKit(hero.heroId) && intent.ultimate) {
      tryCastAbility(state, "ultimate", axis);
    }
    if (intent.utility) tryCastUtility(state);
    tickAbilityEffects(state, dt);
    tickUtilityEffects(state, dt);
    tickHeroKits(state, dt, intent.attackHeld);
    if (heroUsesVectorKit(hero.heroId)) tickVectorMomentum(state, dt);

    const canBasic =
      !heroUsesGyroKit(hero.heroId) || (hero.bladeMode ?? "wrapped") === "wrapped";
    if (canBasic && intent.attackHeld && hero.attackCd <= 0) {
      tryBasicAttack(state);
    }
  });
}

function applyLaneUiIntent(state: GameState, intent: CombatIntent): void {
  if (intent.upgradeBase && state.curseUpgradeBlock <= 0) tryUpgradeBase(state);
  if (intent.toggleShop && state.curseShopBlock <= 0 && !state.disableShop) {
    if (state.shopOpen) state.shopOpen = false;
    else if (state.nearShop) state.shopOpen = true;
  }
  if (intent.sendDigit != null && state.curseSendBlock <= 0 && !state.disableSends) {
    if (!(state.shopOpen && intent.sendDigit >= 4)) {
      const pack = availableSendPacks(state).find((p) => p.digit === intent.sendDigit);
      if (pack) buySendPack(state, pack.id);
    }
  }
  if (intent.shopSlot != null && state.shopOpen && state.curseShopBlock <= 0 && !state.disableShop) {
    const id = state.shopOffer[intent.shopSlot];
    if (id) buyShopItem(state, id);
  }
  if (intent.chooseRelic) chooseRelic(state, intent.chooseRelic);
  if (intent.skipRelic) skipRelic(state);
  if (intent.chooseLevel) chooseLevelUp(state, intent.chooseLevel);
  if (intent.chooseUtility) chooseUtility(state, intent.chooseUtility);
  if (intent.chooseCurse) chooseCurse(state, intent.chooseCurse);
  if (intent.chooseChest != null) chooseChestReward(state, intent.chooseChest);
  if (intent.chooseBaseBranch) chooseBaseBranch(state, intent.chooseBaseBranch);
  if (intent.rerollLevel) rerollLevelDraft(state);
  if (intent.rerollRelic) rerollRelicDraft(state);
}

function spawnEnemy(state: GameState, opts?: { hpScale?: number; sent?: boolean }): void {
  const kind = pickEnemyKind(state.wave, opts?.sent ?? false);
  state.enemies.push(createEnemy(state, kind, opts));
}

function startWave(state: GameState): void {
  prepareLaneGeometryForWave(state, allLaneHeroes(state));
  state.wave += 1;
  const plan = planWaveSpawns(state);
  beginWaveFromPlan(state, plan);
  state.sentQueue = consumePendingSends(state);
  state.spawnCd = state.wave <= 2 ? 0.35 : 0;
  if (state.playerBags) {
    for (const key of Object.keys(state.playerBags)) {
      withPlayerBag(state, Number(key), () => beginWaveShop(state));
    }
  } else {
    beginWaveShop(state);
  }

  for (const h of allLaneHeroes(state)) {
    if (h.heroId === "warden" && h.alive) {
      h.barrierTimer = Math.max(h.barrierTimer, 1.8);
    }
  }

  spawnWaveSpecials(state, plan);
  applyWaveRider(state);
  resetWaveLives(state);
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

function killHeroObj(state: GameState, hero: HeroRuntime): void {
  if (!hero.alive) return;
  // Phoenix Down is a per-player relic, so the revive must run inside the
  // dying hero's bag (parity with SP `killHero`).
  const slot = hero.controllerSlot;
  const revived = withHero(state, hero, () =>
    state.playerBags && slot != null && slot >= 0
      ? withPlayerBag(state, slot, () => tryPhoenixRevive(state))
      : tryPhoenixRevive(state),
  );
  if (revived) return;
  hero.alive = false;
  hero.hp = 0;
  state.deathCount += 1;
  if (heroUsesWarpKit(hero.heroId) && hero === state.hero) clearTeleporters(state);
  if (heroUsesGyroKit(hero.heroId)) {
    hero.bladeMode = "wrapped";
    hero.bladeSpin = 0;
    hero.bladeReformTimer = 0;
    hero.bladeHookCharging = false;
    hero.bladeHookCharge = 0;
    hero.bladeSpawnGrace = 0.35;
  }
  applyDeathLives(state, hero);
  if (laneOutOfRunLives(state)) {
    state.status = "lost";
  }
}

function respawnHeroObj(state: GameState, hero: HeroRuntime): void {
  const def = resolveHero(hero.heroId);
  const pad = mapRespawn(state.map);
  hero.alive = true;
  hero.hp = hero.maxHp;
  hero.x = pad.x;
  hero.y = pad.y;
  hero.attackCd = 0.4;
  hero.barrierTimer = 0;
  hero.whirlwindTimer = 0;
  hero.radius = def.radius;
}

function updateProjectilesMp(state: GameState, dt: number): void {
  const heroes = allLaneHeroes(state);
  for (const p of state.projectiles) {
    if (!p.alive) continue;
    steerSeekingProjectile(state, p, dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life !== undefined) {
      p.life -= dt;
      if (p.life <= 0) {
        if (p.hostile && (p.aoeRadius ?? 0) > 0) {
          resolveHostileProjectile(state, p, heroes, (h, dmg) => {
            withHero(state, h as HeroRuntime, () => applyPlayerDamage(state, dmg));
          });
        } else if (!p.hostile && (p.aoeRadius ?? 0) > 0) {
          explodeFriendlyAoe(state, p);
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
      } else if (!p.hostile && (p.aoeRadius ?? 0) > 0) {
        explodeFriendlyAoe(state, p);
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

function openRelicDraftOnBag(state: GameState): boolean {
  if (state.disableRelics) return false;
  const choices = draftRelicChoices(state.relics, state.relicDraftSize || 3);
  if (choices.length === 0) return false;
  openOrQueueDraft(state, { kind: "relic", choices });
  return true;
}

function afterWaveClearMp(state: GameState): void {
  const bags = state.playerBags;
  const openForActive = () => {
    if (state.waveTier === "elite" || state.waveTier === "boss") {
      if (openRelicDraftOnBag(state)) {
        state.waveTimer = WAVE_BREAK_SEC * state.modifiers.waveBreakMul;
        if (state.pendingLevelUps > 0) openLevelDraft(state);
        return true;
      }
    }
    if (state.pendingLevelUps > 0) {
      openLevelDraft(state);
      state.waveTimer = WAVE_BREAK_SEC * state.modifiers.waveBreakMul;
      return true;
    }
    applySecondWind(state);
    return false;
  };

  if (bags) {
    for (const key of Object.keys(bags)) {
      withPlayerBag(state, Number(key), () => {
        openForActive();
      });
    }
  } else {
    openForActive();
  }

  state.waveTimer = WAVE_BREAK_SEC * state.modifiers.waveBreakMul;
  if (waveVictoryReached(state)) {
    state.status = "won";
  }
}

function resolveAiIntent(state: GameState, neural: NeuralLaneAi | null | undefined, dt: number): CombatIntent {
  if (neural) return thinkNeural(state, neural, dt);
  return scriptedIntent(state);
}

function aiIntentForHero(
  state: GameState,
  hero: HeroRuntime,
  neural: NeuralLaneAi | null | undefined,
  dt: number,
): CombatIntent {
  let intent = emptyIntent();
  const think = () => {
    withHero(state, hero, () => {
      intent = resolveAiIntent(state, neural, dt);
    });
  };
  // Must focus this controller's bag so draft auto-picks see their level/relic
  // choices — otherwise AI allies open drafts that freeze the lane forever.
  const slot = hero.controllerSlot;
  if (slot != null && state.playerBags) {
    withPlayerBag(state, slot, think);
  } else {
    think();
  }
  return intent;
}

function tickIncomeForBags(state: GameState, dt: number): void {
  const tax =
    state.curseIncomeTaxTimer > 0 ? state.curseIncomeTaxMul : 1;
  const bags = state.playerBags;
  if (!bags) {
    let incomeMp = state.incomePerSec;
    if (state.utilityIncomeBoost > 0) incomeMp += state.utilityIncomeAmount;
    incomeMp += state.baseBranchMods.incomeFlat;
    incomeMp *= tax;
    const gainedMp = incomeMp * dt;
    state.gold += gainedMp;
    state.goldFromIncome += gainedMp;
    state.peakGold = Math.max(state.peakGold, state.gold);
    state.peakIncome = Math.max(state.peakIncome, incomeMp);
    return;
  }
  for (const key of Object.keys(bags)) {
    withPlayerBag(state, Number(key), () => {
      let incomeMp = state.incomePerSec;
      if (state.utilityIncomeBoost > 0) incomeMp += state.utilityIncomeAmount;
      incomeMp += state.baseBranchMods.incomeFlat;
      incomeMp *= tax;
      const gainedMp = incomeMp * dt;
      state.gold += gainedMp;
      state.goldFromIncome += gainedMp;
      state.peakGold = Math.max(state.peakGold, state.gold);
      state.peakIncome = Math.max(state.peakIncome, incomeMp);
    });
  }
}

function applyHeroUiAndCombat(
  state: GameState,
  hero: HeroRuntime,
  intent: CombatIntent,
  dt: number,
  outboundSends: GameState["pendingSends"],
): void {
  const slot = hero.controllerSlot;
  const run = () => {
    // Shop proximity for THIS hero — not the lane primary
    const nearNow = nearAnyShop(state.map, hero, hero.alive);
    if (state.shopOpen && !nearNow) state.shopOpen = false;
    state.nearShop = nearNow;
    state.wasNearShop = nearNow;

    const beforeSends = state.pendingSends.length;
    applyLaneUiIntent(state, intent);
    if (state.pendingSends.length > beforeSends) {
      const neu = state.pendingSends.splice(beforeSends);
      outboundSends.push(...neu);
    }
    applyHeroCombat(state, hero, intent, dt);
  };

  if (slot != null && state.playerBags) {
    withPlayerBag(state, slot, run);
  } else {
    run();
  }
}

function updateLaneMp(
  state: GameState,
  intents: Map<number, CombatIntent>,
  dt: number,
  outboundSends: GameState["pendingSends"],
  neuralFor: (hero: HeroRuntime) => NeuralLaneAi | null,
  /** Unlimited dual-lane: hold next wave until both lanes are ready. */
  holdNextWave = false,
): void {
  if (state.status !== "playing") return;

  // With more than one human, nothing may freeze the lane — drafts stay open
  // on top of a running match (see `game/pause.ts`).
  const draftsMayPause = canPauseSimulation(state);

  // Only human drafts freeze the lane. AI bags keep resolving in the background
  // so ally/enemy filler seats can't soft-lock waves (red-screen freeze).
  if (draftsMayPause && humanBagPausedForDraft(state)) {
    state.elapsed += dt;
    // Keep feedback overlays decaying while the human picks a draft.
    state.damageFlash = Math.max(0, state.damageFlash - dt);
    state.vignette = Math.max(0, state.vignette - dt);
    state.hitFlash = Math.max(0, state.hitFlash - dt);
    state.shake = Math.max(0, state.shake - dt);
    for (const h of allLaneHeroes(state)) {
      const slot = h.controllerSlot;
      let intent: CombatIntent;
      if (state.aiControlled || isAiControllerSlot(slot)) {
        intent = aiIntentForHero(state, h, neuralFor(h), dt);
      } else if (slot != null) {
        intent = intents.get(slot) ?? emptyIntent();
      } else {
        continue;
      }
      applyHeroUiAndCombat(state, h, intent, dt, outboundSends);
    }
    return;
  }

  // Solo sniper aim-freeze: pause lane combat while the human Gunner aims
  if (draftsMayPause) {
    const aimingGunner = allLaneHeroes(state).find(
      (h) =>
        h.alive &&
        heroUsesGunnerKit(h.heroId) &&
        h.gunnerAiming &&
        h.controllerSlot != null &&
        h.controllerSlot >= 0,
    );
    if (aimingGunner) {
      state.elapsed += dt;
      withHero(state, aimingGunner, () => {
        const intent = intents.get(aimingGunner.controllerSlot!) ?? emptyIntent();
        state.aimWorldX = aimingGunner.x + intent.aimX * 200;
        state.aimWorldY = aimingGunner.y + intent.aimY * 200;
        tickGunnerWeapons(state, {
          fireHeld: !!intent.mobilityHeld || intent.mobility,
          cycle: intent.ultimate,
          dt,
        });
      });
      return;
    }
  }

  state.elapsed += dt;
  tickIncomeForBags(state, dt);

  // Soft curses on this lane (parity with SP update)
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

  for (const h of allLaneHeroes(state)) {
    if (!h.alive) {
      if (h === state.hero) {
        if (Number.isFinite(state.respawnTimer)) {
          state.respawnTimer -= dt;
          if (state.respawnTimer <= 0) respawnHeroObj(state, h);
        }
      } else if (Number.isFinite(h.attackCd)) {
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

  for (const h of allLaneHeroes(state)) {
    const slot = h.controllerSlot;
    let intent: CombatIntent;
    if (state.aiControlled || isAiControllerSlot(slot)) {
      intent = aiIntentForHero(state, h, neuralFor(h), dt);
    } else if (slot != null) {
      intent = intents.get(slot) ?? emptyIntent();
    } else {
      continue;
    }
    applyHeroUiAndCombat(state, h, intent, dt, outboundSends);
  }

  updateProjectilesMp(state, dt);
  updateEnemies(state, dt);
  updateTurrets(state, dt);
  tickChests(state, dt);
  tickMapSpecials(state, dt, state.spawning || state.enemies.some((e) => e.alive));
  tickMines(state, dt);

  for (const f of state.fx) f.life -= dt;
  state.fx = state.fx.filter((f) => f.life > 0);

  const waveActive = state.spawning || state.enemies.length > 0;
  // Shop rotation per bag
  if (state.playerBags) {
    for (const key of Object.keys(state.playerBags)) {
      withPlayerBag(state, Number(key), () => {
        tickShopRotation(state, dt, waveActive && !state.pausedForDraft);
      });
    }
  } else {
    tickShopRotation(state, dt, waveActive && !state.pausedForDraft);
  }

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
  } else if (!draftsMayPause || !humanBagPausedForDraft(state)) {
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
  // AI drafts must not block wave cadence — only a human draft holds the lane.
  if (humanBagPausedForDraft(state)) return false;
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
  updateLaneMp(match.lanes[0], intents, dt, out0, (h) => neuralForHero(match, 0, h), syncWaves);
  setLaneSfxEnabled(match.viewTeam === 1);
  updateLaneMp(match.lanes[1], intents, dt, out1, (h) => neuralForHero(match, 1, h), syncWaves);
  setLaneSfxEnabled(true);

  // Player sends from lane0 hit lane1 and vice versa
  match.lanes[1].pendingSends.push(...out0);
  match.lanes[0].pendingSends.push(...out1);

  // Transfer Hex soft-locks between lanes
  applyOutgoingCurseTo(match.lanes[0], match.lanes[1]);
  applyOutgoingCurseTo(match.lanes[1], match.lanes[0]);

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
    isActionHeld: (a: "attack" | "mobility" | "ultimate" | "utility") => boolean;
    consumeAction: (a: "attack" | "mobility" | "ultimate" | "utility") => boolean;
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

  const mobilityHeld = input.isActionHeld("mobility");
  return {
    moveX: move.x,
    moveY: move.y,
    aimX,
    aimY,
    attackHeld: input.isActionHeld("attack"),
    mobility: hero && heroUsesGyroKit(hero.heroId) ? false : input.consumeAction("mobility"),
    mobilityHeld,
    ultimate: input.consumeAction("ultimate"),
    utility: input.consumeAction("utility"),
    toggleShop: input.consumePress("KeyF"),
    upgradeBase: input.consumePress("KeyU"),
    sendDigit,
    shopSlot,
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
  };
}

export { heroForSlot };
