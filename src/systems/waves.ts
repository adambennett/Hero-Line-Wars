/**
 * Shared wave composition — used by BOTH lane simulations
 * (`update()` in `game/state.ts` and `updateLaneMp()` in `net/mpSim.ts`).
 *
 * Creative run options (`disableElites`, `disableBosses`, `doubleElites`) are
 * applied here so the two wave starters can never drift apart again.
 */
import { ENEMIES_PER_WAVE_BASE, WAVE_SCALE } from "../data/constants";
import {
  pickBossKind,
  pickEliteKind,
  waveTier,
  type EnemyKind,
  type WaveTier,
} from "../data/enemies";
import { findClearSpot, reshuffleObstacles } from "../data/maps";
import type { GameState, HeroRuntime } from "../game/state";
import { createEnemy } from "./enemies";

export type WaveSpawnPlan = {
  /** Scheduled tier — still drives relic drafts and wave pacing. */
  tier: WaveTier;
  /** Regular enemies queued for the trickle spawner. */
  count: number;
  /** Elite / boss units spawned up front (empty when disabled by run options). */
  specials: EnemyKind[];
  /** Banner toast, or null when no special actually spawns. */
  banner: string | null;
};

/**
 * Decide what a wave contains.
 *
 * `disableElites` / `disableBosses` suppress the special unit AND the enemy
 * count reduction that pays for it, so a "no elites" run gets a full normal
 * wave instead of a thin one. The scheduled tier is preserved so relic draft
 * cadence is unchanged.
 */
export function planWaveSpawns(state: GameState, wave: number = state.wave): WaveSpawnPlan {
  const tier = waveTier(wave);
  const elitesOn = !state.disableElites;
  const bossesOn = !state.disableBosses;
  const specials: EnemyKind[] = [];

  if (tier === "elite" && elitesOn) {
    specials.push(pickEliteKind());
    if (state.doubleElites) specials.push(pickEliteKind());
  } else if (tier === "boss" && bossesOn) {
    specials.push(pickBossKind());
    if (state.doubleElites && elitesOn) specials.push(pickEliteKind());
  }

  let count = Math.round(
    (ENEMIES_PER_WAVE_BASE + (wave - 1) * WAVE_SCALE.enemiesPerWave) *
      state.modifiers.enemyCountMul,
  );
  if (specials.length > 0) {
    if (tier === "elite") count = Math.max(3, Math.floor(count * 0.75));
    else if (tier === "boss") count = Math.max(2, Math.floor(count * 0.55));
  }

  return {
    tier,
    count: Math.max(0, count),
    specials,
    banner: specials.length === 0 ? null : tier === "boss" ? "BOSS WAVE" : "ELITE WAVE",
  };
}

/** Apply the trickle-spawn part of a plan (tier + regular enemy budget). */
export function beginWaveFromPlan(state: GameState, plan: WaveSpawnPlan): void {
  state.waveTier = plan.tier;
  state.spawning = true;
  state.toSpawn = plan.count;
}

/** Spawn the elite / boss units of a plan and raise its banner. */
export function spawnWaveSpecials(state: GameState, plan: WaveSpawnPlan): void {
  for (const kind of plan.specials) {
    state.enemies.push(createEnemy(state, kind, { hpScale: 1 }));
  }
  if (!plan.banner) return;
  state.toast = plan.banner;
  state.toastTimer = plan.tier === "boss" ? 2.4 : 2.2;
}

/** Shifting / shrinking map geometry reset shared by both wave starters. */
export function prepareLaneGeometryForWave(state: GameState, heroes: HeroRuntime[]): void {
  const map = state.map;
  if (map.shrinkingLane && map.baseLaneTop != null && map.baseLaneBottom != null) {
    map.laneTop = map.baseLaneTop;
    map.laneBottom = map.baseLaneBottom;
    if (map.baseLaneLeft != null) map.laneLeft = map.baseLaneLeft;
    if (map.baseLaneRight != null) map.laneRight = map.baseLaneRight;
  }
  if (!map.shiftingObstacles) return;

  const reserved = [...heroes, ...state.turrets.filter((t) => t.alive)].map((u) => ({
    x: u.x,
    y: u.y,
    radius: u.radius,
  }));
  reshuffleObstacles(map, reserved);
  for (const h of heroes) {
    const clear = findClearSpot(map, h.x, h.y, h.radius);
    h.x = clear.x;
    h.y = clear.y;
  }
  for (const t of state.turrets) {
    if (!t.alive) continue;
    const clear = findClearSpot(map, t.x, t.y, t.radius);
    t.x = clear.x;
    t.y = clear.y;
  }
  state.toast = "Ground shifts…";
  state.toastTimer = 1.4;
}
