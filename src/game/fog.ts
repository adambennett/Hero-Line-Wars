/**
 * Shared fog-of-war stacking for SP, mpSim, and render.
 *
 * Stacking rule (most restrictive / strongest wins):
 * - Active if any source is active
 * - Opacity = max of active sources (0..1)
 * - Vision radius = min of active sources (px)
 */

export type FogSource = {
  active: boolean;
  /** 0..1 — how black the shroud is outside the vision circle. */
  opacity: number;
  /** Clear radius around the viewing hero (px). */
  visionRadius: number;
};

export type ResolvedFog = {
  active: boolean;
  opacity: number;
  visionRadius: number;
};

export const DEFAULT_FOG_OPACITY = 0.55;
export const DEFAULT_FOG_VISION = 120;

/** Map eclipse pulses — slightly thicker, tighter vision. */
export const ECLIPSE_FOG: FogSource = {
  active: true,
  opacity: 0.62,
  visionRadius: 100,
};

/** Temporary curse fog. */
export const CURSE_FOG: FogSource = {
  active: true,
  opacity: 0.72,
  visionRadius: 90,
};

export function fogFromRunOptions(opts: {
  fogAlways?: boolean;
  /** 0–100; 100 = fully black outside vision. */
  fogThicknessPct?: number;
  fogVisionRadius?: number;
}): FogSource {
  const thickness = clamp01((opts.fogThicknessPct ?? 55) / 100);
  return {
    active: !!opts.fogAlways,
    opacity: thickness,
    visionRadius: Math.max(40, opts.fogVisionRadius ?? DEFAULT_FOG_VISION),
  };
}

export function resolveFog(sources: FogSource[]): ResolvedFog {
  let active = false;
  let opacity = 0;
  let visionRadius = Number.POSITIVE_INFINITY;
  for (const s of sources) {
    if (!s.active) continue;
    active = true;
    opacity = Math.max(opacity, clamp01(s.opacity));
    visionRadius = Math.min(visionRadius, Math.max(20, s.visionRadius));
  }
  if (!active) {
    return { active: false, opacity: 0, visionRadius: DEFAULT_FOG_VISION };
  }
  if (!Number.isFinite(visionRadius)) visionRadius = DEFAULT_FOG_VISION;
  return { active: true, opacity, visionRadius };
}

/**
 * Build the active fog stack for a live lane.
 * Callers pass map eclipse / curse / run-always flags; stacking is centralized here.
 */
export function laneFogState(input: {
  fogAlways: boolean;
  fogThicknessPct: number;
  fogVisionRadius: number;
  curseFogTimer: number;
  mapEclipseActive: boolean;
}): ResolvedFog {
  return resolveFog([
    fogFromRunOptions({
      fogAlways: input.fogAlways,
      fogThicknessPct: input.fogThicknessPct,
      fogVisionRadius: input.fogVisionRadius,
    }),
    {
      active: input.curseFogTimer > 0,
      opacity: CURSE_FOG.opacity,
      visionRadius: CURSE_FOG.visionRadius,
    },
    {
      active: input.mapEclipseActive,
      opacity: ECLIPSE_FOG.opacity,
      visionRadius: ECLIPSE_FOG.visionRadius,
    },
  ]);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
