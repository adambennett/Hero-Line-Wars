/**
 * Respawn precision minigame — Gears-style active-reload bar while dead.
 * Success shaves respawn time and hardens the next window (faster scroll or
 * smaller zone, chosen at random). Disabled once the timer is ≤1s.
 */

export type RespawnMinigame = {
  cursor: number;
  dir: 1 | -1;
  zoneStart: number;
  zoneEnd: number;
  /** Cursor travel speed (full bar lengths per second). */
  speed: number;
  /** Brief flash after a hit/miss (seconds). */
  feedback: number;
  /** Last press result for UI tint. */
  lastHit: boolean | null;
};

const MIN_ZONE = 0.07;
const MIN_SPEED = 0.9;
const MAX_SPEED = 2.8;

export function createRespawnMinigame(): RespawnMinigame {
  const width = 0.2;
  const start = 0.35 + Math.random() * 0.25;
  return {
    cursor: Math.random(),
    dir: Math.random() < 0.5 ? 1 : -1,
    zoneStart: start,
    zoneEnd: Math.min(0.98, start + width),
    speed: 1.15,
    feedback: 0,
    lastHit: null,
  };
}

export function tickRespawnMinigame(g: RespawnMinigame, dt: number): void {
  g.feedback = Math.max(0, g.feedback - dt);
  g.cursor += g.dir * g.speed * dt;
  if (g.cursor >= 1) {
    g.cursor = 1;
    g.dir = -1;
  } else if (g.cursor <= 0) {
    g.cursor = 0;
    g.dir = 1;
  }
}

/** Returns seconds shaved from the respawn timer, or 0 on miss / locked out. */
export function pressRespawnMinigame(
  g: RespawnMinigame,
  respawnTimer: number,
): number {
  if (respawnTimer <= 1) return 0;
  const hit = g.cursor >= g.zoneStart && g.cursor <= g.zoneEnd;
  g.feedback = 0.35;
  g.lastHit = hit;
  if (!hit) {
    // Mild miss: nudge zone elsewhere, no timer reward.
    const width = Math.max(MIN_ZONE, g.zoneEnd - g.zoneStart);
    g.zoneStart = Math.random() * (1 - width);
    g.zoneEnd = g.zoneStart + width;
    return 0;
  }

  const width = Math.max(MIN_ZONE, g.zoneEnd - g.zoneStart);
  if (Math.random() < 0.5) {
    g.speed = Math.min(MAX_SPEED, g.speed * 1.12);
  } else {
    const next = Math.max(MIN_ZONE, width * 0.88);
    g.zoneStart = Math.random() * (1 - next);
    g.zoneEnd = g.zoneStart + next;
  }
  // Re-roll zone position even on speed-up path so it doesn't stay fixed.
  if (g.zoneEnd - g.zoneStart === width) {
    g.zoneStart = Math.random() * (1 - width);
    g.zoneEnd = g.zoneStart + width;
  }
  g.speed = Math.max(MIN_SPEED, g.speed);
  // Shave ~0.35–0.55s, never below 1s floor (caller clamps).
  return 0.35 + Math.random() * 0.2;
}
