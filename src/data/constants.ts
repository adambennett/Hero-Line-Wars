/** World size (shared across maps) and run-wide tuning. */

export const MAP_W = 1600;
/** Taller playfield so widescreen fills more vertical space. */
export const MAP_H = 700;

/** @deprecated Prefer map.laneTop / map.laneBottom from state.map */
export const LANE_TOP = 100;
/** @deprecated Prefer map.laneBottom */
export const LANE_BOTTOM = MAP_H - 100;

/** Legacy single high-ground — maps now own zones; kept for fallback reads. */
export const HIGH_GROUND = {
  x: 560,
  y: 180,
  w: 280,
  h: 180,
  damageBonus: 0.35,
  oathDamageBonus: 0.65,
};

/** Legacy pads — prefer state.map.base / shop / spawner. */
export const BASE = {
  x: 48,
  y: MAP_H / 2,
  radius: 46,
  maxHp: 120,
};

export const SHOP = {
  x: 140,
  y: MAP_H / 2 + 90,
  radius: 38,
  interactRange: 58,
};

export const SPAWNER = {
  x: MAP_W - 48,
  y: MAP_H / 2,
  radius: 30,
};

/** Legacy single-archetype fallback (prefer data/enemies.ts). */
export const ENEMY = {
  radius: 12,
  speed: 70,
  maxHp: 36,
  contactDamage: 8,
  goldReward: 5,
  baseDamage: 10,
};

export const BASE_INCOME_GOLD_PER_SEC = 2;
export const WAVE_BREAK_SEC = 5;
/** Baseline creeps per wave before wave-index scaling (see startWave). */
export const ENEMIES_PER_WAVE_BASE = 4;
export const WIN_WAVES = 10;
export const STARTING_GOLD = 45;

/** Respawn: baseSec + wave * waveFactor + deaths * deathFactor */
export const RESPAWN = {
  baseSec: 2.5,
  waveFactor: 0.45,
  deathFactor: 1.1,
  maxSec: 14,
};

export const DAMAGE_FEEDBACK = {
  flashSec: 0.28,
  vignetteSec: 0.45,
  hitFlashSec: 0.18,
  shakeSec: 0.22,
  shakeAmp: 7,
};

/** Seconds of near-zero / blocked movement before a bypass hop. */
export const ENEMY_STUCK_SEC = 1.15;
/** After this many failed nudges, allow a slightly larger hop (still local). */
export const ENEMY_STUCK_ESCALATE = 3;
/** Cumulative blocked time before despawn (soft-lock breaker). */
export const ENEMY_STUCK_DESPAWN_SEC = 16;
/** Ranged units stop camping and push after this many seconds of hold-fire. */
export const ENEMY_CAMP_BREAK_SEC = 2.4;

/** Wave HP / count scaling knobs. */
export const WAVE_SCALE = {
  /** Extra creeps per wave index after the first. */
  enemiesPerWave: 2.2,
  /** Multiplier on baseline HP: 1 + (wave-1) * hpPerWave. */
  hpPerWave: 0.16,
  eliteHpMul: 1.35,
  bossHpMul: 1.55,
  /** Spawn cadence (seconds) — higher = more staggered. */
  spawnIntervalBase: 0.72,
  spawnIntervalMin: 0.32,
  spawnIntervalWaveFactor: 0.03,
};
