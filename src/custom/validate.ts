/**
 * Sanitize / clamp custom map & hero payloads from peers or imports.
 */
import { abilityTemplate, passiveTemplate } from "./catalog";
import {
  CUSTOM_HERO_PREFIX,
  CUSTOM_MAP_PREFIX,
  type CustomHeroDef,
  type CustomMapDef,
  isCustomHeroId,
  isCustomMapId,
} from "./types";
import { MAP_H, MAP_W } from "../data/constants";
import type { AbilityKind } from "../data/heroes";

const MAX_NAME = 48;
const MAX_BLURB = 280;
const MAX_OBSTACLES = 80;
const MAX_TURRET_SLOTS = 24;
const MAX_HIGH_GROUNDS = 24;
const MAX_SHOPS = 8;
const MAX_ZONE_LIST = 32;
const MAX_SPIKES = 40;

function fin(n: unknown, fallback: number): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function clampStr(s: unknown, max: number, fallback: string): string {
  if (typeof s !== "string") return fallback;
  return s.slice(0, max) || fallback;
}

function clampPoint(
  p: { x?: number; y?: number; radius?: number; maxHp?: number } | null | undefined,
  defaults: { x: number; y: number; radius: number; maxHp?: number },
): { x: number; y: number; radius: number; maxHp?: number } {
  const x = clamp(fin(p?.x, defaults.x), 0, MAP_W);
  const y = clamp(fin(p?.y, defaults.y), 0, MAP_H);
  const radius = clamp(fin(p?.radius, defaults.radius), 4, 120);
  if (defaults.maxHp != null) {
    return { x, y, radius, maxHp: clamp(fin(p?.maxHp, defaults.maxHp), 50, 50000) };
  }
  return { x, y, radius };
}

function clampRect(
  z: { x?: number; y?: number; w?: number; h?: number; label?: string },
): { x: number; y: number; w: number; h: number; label?: string } {
  return {
    x: clamp(fin(z.x, 0), -50, MAP_W + 50),
    y: clamp(fin(z.y, 0), -50, MAP_H + 50),
    w: clamp(fin(z.w, 40), 8, MAP_W),
    h: clamp(fin(z.h, 40), 8, MAP_H),
    label: typeof z.label === "string" ? z.label.slice(0, 32) : undefined,
  };
}

/** Returns sanitized map or null if unusable. */
export function sanitizeCustomMap(raw: unknown): CustomMapDef | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Partial<CustomMapDef>;
  let id = typeof m.id === "string" ? m.id : "";
  if (!isCustomMapId(id)) {
    if (id) id = CUSTOM_MAP_PREFIX + id.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24);
    else return null;
  }
  if (!isCustomMapId(id)) return null;

  const laneTop = clamp(fin(m.laneTop, 80), 20, MAP_H - 80);
  const laneBottom = clamp(fin(m.laneBottom, MAP_H - 80), laneTop + 40, MAP_H - 20);
  const base = clampPoint(m.base, { x: 52, y: (laneTop + laneBottom) / 2, radius: 36, maxHp: 400 }) as {
    x: number;
    y: number;
    radius: number;
    maxHp: number;
  };
  const shops = (Array.isArray(m.shops) ? m.shops : [])
    .slice(0, MAX_SHOPS)
    .map((s) => {
      const p = clampPoint(s, { x: base.x + 100, y: base.y, radius: 28 });
      return {
        ...p,
        interactRange: clamp(fin((s as { interactRange?: number }).interactRange, 56), 20, 120),
      };
    });
  const respawn = clampPoint(m.respawn, { x: base.x + 120, y: base.y, radius: 28 });
  const spawner = clampPoint(m.spawner, { x: MAP_W - 60, y: (laneTop + laneBottom) / 2, radius: 20 });

  const obstacles = (Array.isArray(m.obstacles) ? m.obstacles : []).slice(0, MAX_OBSTACLES).map((o) => ({
    x: clamp(fin(o.x, 200), -20, MAP_W + 20),
    y: clamp(fin(o.y, 200), -20, MAP_H + 20),
    w: clamp(fin(o.w, 40), 8, 400),
    h: clamp(fin(o.h, 40), 8, 400),
  }));
  const turretSlots = (Array.isArray(m.turretSlots) ? m.turretSlots : [])
    .slice(0, MAX_TURRET_SLOTS)
    .map((t) => ({
      x: clamp(fin(t.x, 100), 0, MAP_W),
      y: clamp(fin(t.y, 200), 0, MAP_H),
    }));
  const highGrounds = (Array.isArray(m.highGrounds) ? m.highGrounds : [])
    .slice(0, MAX_HIGH_GROUNDS)
    .map((h) => ({
      x: clamp(fin(h.x, 0), -50, MAP_W + 50),
      y: clamp(fin(h.y, 0), -50, MAP_H + 50),
      w: clamp(fin(h.w, 40), 8, MAP_W),
      h: clamp(fin(h.h, 40), 8, MAP_H),
      damageBonus: clamp(fin(h.damageBonus, 0.35), 0, 2),
      oathDamageBonus: clamp(fin(h.oathDamageBonus, 0), 0, 2),
    }));

  const specials = m.specials && typeof m.specials === "object" ? { ...m.specials } : {};

  return {
    id,
    name: clampStr(m.name, MAX_NAME, "Custom Map"),
    blurb: clampStr(m.blurb, MAX_BLURB, ""),
    laneTop,
    laneBottom,
    base,
    shops,
    respawn,
    spawner,
    spawnerAlt: m.spawnerAlt
      ? clampPoint(m.spawnerAlt, { x: spawner.x, y: spawner.y + 40, radius: 20 })
      : undefined,
    highGrounds,
    obstacles,
    turretSlots,
    specials,
    healSprings: (m.healSprings ?? []).slice(0, MAX_ZONE_LIST).map(clampRect),
    slowMires: (m.slowMires ?? []).slice(0, MAX_ZONE_LIST).map(clampRect),
    hastePads: (m.hastePads ?? []).slice(0, MAX_ZONE_LIST).map(clampRect),
    goldVents: (m.goldVents ?? []).slice(0, MAX_ZONE_LIST).map(clampRect),
    windCurrents: (m.windCurrents ?? []).slice(0, MAX_ZONE_LIST).map((w) => ({
      ...clampRect(w),
      vx: clamp(fin(w.vx, 0), -200, 200),
      vy: clamp(fin(w.vy, 0), -200, 200),
    })),
    spikePulses: (m.spikePulses ?? []).slice(0, MAX_SPIKES).map((s) => ({
      x: clamp(fin(s.x, 200), 0, MAP_W),
      y: clamp(fin(s.y, 200), 0, MAP_H),
      radius: clamp(fin(s.radius, 24), 8, 80),
      damage: clamp(fin(s.damage, 8), 1, 80),
    })),
  };
}

/** Returns sanitized hero or null if unusable. */
export function sanitizeCustomHero(raw: unknown): CustomHeroDef | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Partial<CustomHeroDef>;
  let id = typeof h.id === "string" ? h.id : "";
  if (!isCustomHeroId(id)) {
    if (id) id = CUSTOM_HERO_PREFIX + id.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24);
    else return null;
  }
  if (!isCustomHeroId(id)) return null;

  const abilitiesRaw = Array.isArray(h.abilities) ? h.abilities.slice(0, 2) : [];
  if (abilitiesRaw.length < 2) return null;
  const abilities = abilitiesRaw.map((a, i) => {
    const kind = a?.id as AbilityKind;
    if (!abilityTemplate(kind)) return null;
    return {
      id: kind,
      slot: (i === 0 ? "mobility" : "ultimate") as "mobility" | "ultimate",
      name: clampStr(a.name, 32, kind),
      cooldown: clamp(fin(a.cooldown, 8), 0.5, 60),
      hint: clampStr(a.hint, 120, ""),
    };
  });
  if (!abilities[0] || !abilities[1]) return null;

  const passiveId = h.passive?.id;
  if (!passiveId || !passiveTemplate(passiveId)) return null;

  const styles = [
    "bolt",
    "cleave",
    "shotgun",
    "heavy",
    "beam",
    "frostbolt",
    "chaos",
    "chain",
    "vine",
    "hex",
    "spin",
    "wind",
    "syringe",
    "emberbolt",
  ] as const;
  const aims = ["free", "engage", "auto"] as const;
  const attackStyle = styles.includes(h.attackStyle as (typeof styles)[number])
    ? (h.attackStyle as (typeof styles)[number])
    : "bolt";
  const aimMode = aims.includes(h.aimMode as (typeof aims)[number])
    ? (h.aimMode as (typeof aims)[number])
    : "free";

  return {
    id,
    name: clampStr(h.name, MAX_NAME, "Custom Hero"),
    blurb: clampStr(h.blurb, MAX_BLURB, ""),
    color: typeof h.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(h.color) ? h.color : "#8ab4f8",
    glowColor:
      typeof h.glowColor === "string" && /^#[0-9a-fA-F]{3,8}$/.test(h.glowColor)
        ? h.glowColor
        : "#cfe2ff",
    radius: clamp(fin(h.radius, 16), 10, 28),
    speed: clamp(fin(h.speed, 220), 80, 420),
    maxHp: clamp(fin(h.maxHp, 100), 40, 400),
    attackRange: clamp(fin(h.attackRange, 140), 40, 320),
    attackDamage: clamp(fin(h.attackDamage, 12), 2, 80),
    attackCooldown: clamp(fin(h.attackCooldown, 0.45), 0.12, 2.5),
    projectileSpeed: clamp(fin(h.projectileSpeed, 420), 80, 900),
    attackStyle,
    aimMode,
    attackHint: clampStr(h.attackHint, 120, ""),
    passive: {
      id: passiveId,
      name: clampStr(h.passive?.name, 32, passiveId),
      blurb: clampStr(h.passive?.blurb, MAX_BLURB, ""),
    },
    abilities: [abilities[0], abilities[1]],
  };
}
