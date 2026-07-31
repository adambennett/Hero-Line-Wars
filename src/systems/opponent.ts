/** Lightweight solo-vs-AI opponent lane simulation. */

import { BASE_INCOME_GOLD_PER_SEC, ENEMIES_PER_WAVE_BASE, STARTING_GOLD, WAVE_SCALE } from "../data/constants";
import { HEROES, HERO_LIST, type HeroId } from "../data/heroes";
import { SEND_PACKS, type SendPackId } from "../data/send";
import type { GameState, PendingSend } from "../game/state";

export type FightStatus = "winning" | "even" | "struggling" | "critical" | "idle";

export type OpponentState = {
  heroId: HeroId;
  name: string;
  color: string;
  heroHp: number;
  heroMaxHp: number;
  baseHp: number;
  baseMaxHp: number;
  level: number;
  gold: number;
  incomePerSec: number;
  baseLevel: number;
  /** Units the player has queued into the opponent's next wave. */
  incomingFromPlayer: number;
  /** Units the AI has queued into the player's next wave (already in pendingSends). */
  sendingToPlayer: number;
  lastSendLabel: string | null;
  sendFlash: number;
  /** Abstract fight pressure 0–1 (higher = worse for opponent). */
  pressure: number;
  enemiesAlive: number;
  enemiesMax: number;
  fightStatus: FightStatus;
  /** Simplified lane viz when flipped. */
  vizHeroX: number;
  vizHeroY: number;
  vizEnemies: { x: number; y: number; r: number; color: string; sent: boolean }[];
  thinkCd: number;
};

function pickOpponentHero(playerId: HeroId): HeroId {
  const pool = HERO_LIST.filter((h) => h.id !== playerId);
  return pool[Math.floor(Math.random() * pool.length)]!.id;
}

export function createOpponent(playerHeroId: HeroId, mapBaseMaxHp: number, midY: number): OpponentState {
  const heroId = pickOpponentHero(playerHeroId);
  const def = HEROES[heroId];
  return {
    heroId,
    name: def.name,
    color: def.color,
    heroHp: def.maxHp,
    heroMaxHp: def.maxHp,
    baseHp: mapBaseMaxHp,
    baseMaxHp: mapBaseMaxHp,
    level: 1,
    gold: STARTING_GOLD,
    incomePerSec: BASE_INCOME_GOLD_PER_SEC,
    baseLevel: 0,
    incomingFromPlayer: 0,
    sendingToPlayer: 0,
    lastSendLabel: null,
    sendFlash: 0,
    pressure: 0,
    enemiesAlive: 0,
    enemiesMax: 0,
    fightStatus: "idle",
    vizHeroX: 180,
    vizHeroY: midY,
    vizEnemies: [],
    thinkCd: 2.5 + Math.random() * 2,
  };
}

function fightStatusFrom(pressure: number, baseRatio: number, waveActive: boolean): FightStatus {
  if (!waveActive) return "idle";
  if (baseRatio < 0.25 || pressure > 0.85) return "critical";
  if (pressure > 0.62) return "struggling";
  if (pressure < 0.38 && baseRatio > 0.55) return "winning";
  return "even";
}

export function queueSendToOpponent(state: GameState, pending: PendingSend, packName: string): void {
  state.opponent.incomingFromPlayer += pending.enemies;
  state.opponent.pressure = Math.min(1, state.opponent.pressure + pending.enemies * 0.04 * pending.hpScale);
  // Track last player send for UI (opponent receiving)
  void packName;
}

function tryAiSend(state: GameState): void {
  const opp = state.opponent;
  const unlocked = SEND_PACKS.filter((p) => p.minBaseLevel <= opp.baseLevel);
  if (unlocked.length === 0) return;

  // Prefer cheaper packs early; occasionally splash.
  const affordable = unlocked.filter((p) => p.cost <= opp.gold);
  if (affordable.length === 0) return;

  const pack =
    Math.random() < 0.65
      ? affordable[0]!
      : affordable[Math.floor(Math.random() * affordable.length)]!;

  const cost = pack.cost;
  if (opp.gold < cost) return;

  opp.gold -= cost;
  opp.incomePerSec += pack.incomeBonus;
  opp.sendingToPlayer += pack.enemies;
  opp.lastSendLabel = pack.name;
  opp.sendFlash = 2.4;

  const pending: PendingSend = {
    enemies: pack.enemies,
    hpScale: pack.hpScale * (1 + opp.baseLevel * 0.05),
  };
  state.pendingSends.push(pending);
  state.toast = `Enemy sent ${pack.name}!`;
  state.toastTimer = 1.5;
}

export function updateOpponent(state: GameState, dt: number): void {
  const opp = state.opponent;
  opp.gold += opp.incomePerSec * dt;
  opp.sendFlash = Math.max(0, opp.sendFlash - dt);
  opp.thinkCd -= dt;

  const waveActive = state.spawning || state.enemies.length > 0;
  const wave = Math.max(1, state.wave);

  // Mirror wave cadence abstractly
  if (waveActive) {
    const expected =
      Math.round(ENEMIES_PER_WAVE_BASE + (wave - 1) * WAVE_SCALE.enemiesPerWave) +
      opp.incomingFromPlayer;
    opp.enemiesMax = Math.max(opp.enemiesMax, expected);
    // Decay alive count as "AI clears" over the wave
    const clearRate = 0.55 + opp.level * 0.04 - opp.pressure * 0.25;
    opp.enemiesAlive = Math.max(0, opp.enemiesAlive - clearRate * dt);

    // Chip opponent hero / base from pressure + incoming
    const chip = (0.8 + opp.pressure * 2.2 + opp.incomingFromPlayer * 0.15) * dt;
    if (opp.heroHp > 0) {
      opp.heroHp = Math.max(0, opp.heroHp - chip * 0.55);
      if (opp.heroHp <= 0) {
        opp.heroHp = 0;
        // Soft respawn
        opp.heroHp = opp.heroMaxHp * 0.55;
        opp.pressure = Math.min(1, opp.pressure + 0.08);
      }
    }
    if (Math.random() < 0.015 * dt * (1 + opp.pressure)) {
      opp.baseHp = Math.max(0, opp.baseHp - (1 + opp.pressure * 2));
    }

    // Level slowly during waves
    if (Math.random() < 0.08 * dt) {
      opp.level += 1;
      opp.heroMaxHp += 4;
      opp.heroHp = Math.min(opp.heroMaxHp, opp.heroHp + 6);
    }
  } else {
    opp.enemiesAlive = 0;
    opp.enemiesMax = 0;
    // Keep incomingFromPlayer — player sends wait for the next enemy-lane wave.
    // Keep sendingToPlayer in sync with pending packs still on the player state.
    opp.pressure = Math.max(0, opp.pressure * 0.92);
    // Heal a bit between waves
    opp.heroHp = Math.min(opp.heroMaxHp, opp.heroHp + 8 * dt);
    if (opp.baseLevel < state.baseLevel && Math.random() < 0.2 * dt) {
      opp.baseLevel += 1;
    }
  }

  // Seed enemiesAlive at wave start
  if (state.spawning && opp.enemiesAlive <= 0 && opp.enemiesMax > 0) {
    // already set
  }

  const baseRatio = opp.baseHp / Math.max(1, opp.baseMaxHp);
  opp.fightStatus = fightStatusFrom(opp.pressure, baseRatio, waveActive);

  // AI send decisions between waves or mid-wave when flush
  if (opp.thinkCd <= 0) {
    const agg = state.modifiers.opponentAggressionMul;
    opp.thinkCd = (3.5 + Math.random() * 4) / agg;
    const shouldSend =
      opp.gold > 40 &&
      (Math.random() < 0.45 * agg ||
        (!waveActive && Math.random() < 0.7) ||
        opp.sendingToPlayer === 0);
    if (shouldSend) tryAiSend(state);
  }

  // Viz for flipped lane — show live creeps + queued player sends waiting
  const map = state.map;
  const mid = (map.laneTop + map.laneBottom) / 2;
  opp.vizHeroY = mid + Math.sin(state.elapsed * 1.3) * 18;
  opp.vizHeroX = 160 + Math.sin(state.elapsed * 0.7) * 40;

  const queued = opp.incomingFromPlayer;
  const live = Math.ceil(opp.enemiesAlive);
  const count = Math.min(14, Math.max(live + (queued > 0 && !waveActive ? Math.min(8, queued) : 0), waveActive ? 1 : queued > 0 ? 1 : 0));
  const colors = ["#c45c5c", "#d08040", "#a34bd4", "#6a90c8"];
  opp.vizEnemies = [];
  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0.5 : i / (count - 1);
    const isSent = waveActive ? i < Math.min(queued, count) : i < count;
    opp.vizEnemies.push({
      x: 500 + t * 900 + Math.sin(state.elapsed * 2 + i) * 20,
      y: mid + Math.sin(state.elapsed * 1.5 + i * 1.7) * ((map.laneBottom - map.laneTop) * 0.28),
      r: 10 + (i % 3) * 3,
      color: isSent ? "#a34bd4" : colors[i % colors.length]!,
      sent: isSent,
    });
  }
}

export function onPlayerWaveStart(state: GameState): void {
  const opp = state.opponent;
  const wave = state.wave;
  const baseCount = Math.round(
    (ENEMIES_PER_WAVE_BASE + (wave - 1) * WAVE_SCALE.enemiesPerWave) * state.modifiers.enemyCountMul,
  );
  const incoming = opp.incomingFromPlayer;
  opp.enemiesMax = baseCount + incoming;
  opp.enemiesAlive = opp.enemiesMax;
  opp.pressure = Math.min(1, 0.2 + incoming * 0.06 + (wave - 1) * 0.03);
  // Consume tracked incoming — they are "in" the opponent's wave now
  opp.incomingFromPlayer = 0;
}

/** Alive creeps + queued player sends still waiting for the enemy lane. */
export function opponentEnemiesRemaining(opp: OpponentState): number {
  return Math.max(0, Math.ceil(opp.enemiesAlive) + opp.incomingFromPlayer);
}

export function opponentStatusLabel(status: FightStatus): string {
  switch (status) {
    case "winning":
      return "Winning lane";
    case "even":
      return "Even fight";
    case "struggling":
      return "Under pressure";
    case "critical":
      return "Near collapse";
    default:
      return "Between waves";
  }
}

export type { SendPackId };
