/**
 * Incoming-intent hardening.
 *
 * Intents arrive from remote peers and are fed straight into the authoritative
 * lane simulation, so every field is clamped to its legal domain here before the
 * host ever looks at it. Unknown ids, NaN/Infinity vectors, huge numbers, and
 * junk payloads all degrade to the neutral value instead of throwing.
 */
import { BASE_BRANCHES } from "../data/baseBranches";
import { CURSES } from "../data/curses";
import { RELICS } from "../data/relics";
import { UTILITIES } from "../data/utilities";
import { LEVEL_PASSIVES } from "../data/xp";
import { emptyIntent, type CombatIntent } from "./types";

/** Chest drafts are pick-1-of-N; N is small, this is just an upper bound. */
const MAX_CHEST_INDEX = 7;
const MAX_SHOP_SLOT = 5;

function num(v: unknown, min: number, max: number, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function bool(v: unknown): boolean {
  return v === true;
}

function intIn(v: unknown, min: number, max: number): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i < min || i > max) return null;
  return i;
}

function keyOf<T extends object>(table: T, v: unknown): keyof T | null {
  if (typeof v !== "string") return null;
  return Object.prototype.hasOwnProperty.call(table, v) ? (v as keyof T) : null;
}

/** Normalize a possibly-garbage aim vector to a unit vector (default +X). */
function aim(x: unknown, y: unknown): { x: number; y: number } {
  const ax = num(x, -1e6, 1e6, 1);
  const ay = num(y, -1e6, 1e6, 0);
  const len = Math.hypot(ax, ay);
  if (len < 1e-6) return { x: 1, y: 0 };
  return { x: ax / len, y: ay / len };
}

/**
 * Clamp an untrusted intent. Always returns a fresh, fully-populated intent —
 * never the caller's object — so the sim can rely on every field existing.
 */
export function sanitizeIntent(raw: unknown): CombatIntent {
  const out = emptyIntent();
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;

  out.moveX = num(r.moveX, -1, 1);
  out.moveY = num(r.moveY, -1, 1);
  const a = aim(r.aimX, r.aimY);
  out.aimX = a.x;
  out.aimY = a.y;

  out.attackHeld = bool(r.attackHeld);
  out.mobility = bool(r.mobility);
  out.mobilityHeld = bool(r.mobilityHeld);
  out.ultimate = bool(r.ultimate);
  out.utility = bool(r.utility);
  out.toggleShop = bool(r.toggleShop);
  out.upgradeBase = bool(r.upgradeBase);
  out.skipRelic = bool(r.skipRelic);
  out.skipLevel = bool(r.skipLevel);
  out.rerollLevel = bool(r.rerollLevel);
  out.rerollRelic = bool(r.rerollRelic);

  out.sendDigit = intIn(r.sendDigit, 1, 5);
  out.shopSlot = intIn(r.shopSlot, 0, MAX_SHOP_SLOT);
  out.chooseChest = intIn(r.chooseChest, 0, MAX_CHEST_INDEX);

  out.chooseRelic = keyOf(RELICS, r.chooseRelic) as CombatIntent["chooseRelic"];
  out.chooseLevel = keyOf(LEVEL_PASSIVES, r.chooseLevel) as CombatIntent["chooseLevel"];
  out.chooseUtility = keyOf(UTILITIES, r.chooseUtility) as CombatIntent["chooseUtility"];
  out.chooseCurse = keyOf(CURSES, r.chooseCurse) as CombatIntent["chooseCurse"];
  out.chooseBaseBranch = keyOf(
    BASE_BRANCHES,
    r.chooseBaseBranch,
  ) as CombatIntent["chooseBaseBranch"];

  out.viewOpponent = typeof r.viewOpponent === "boolean" ? r.viewOpponent : null;
  return out;
}

/**
 * Per-seat flood guard. Clients send one intent per frame; anything far above
 * that is dropped rather than queued so a spamming peer cannot stall the host.
 */
export class IntentRateLimiter {
  private readonly seen = new Map<number, { windowStart: number; count: number }>();
  private readonly maxPerWindow: number;
  private readonly windowMs: number;

  constructor(maxPerWindow = 240, windowMs = 1000) {
    this.maxPerWindow = maxPerWindow;
    this.windowMs = windowMs;
  }

  /** True when this seat may be processed now. */
  allow(seat: number, now = Date.now()): boolean {
    const rec = this.seen.get(seat);
    if (!rec || now - rec.windowStart >= this.windowMs) {
      this.seen.set(seat, { windowStart: now, count: 1 });
      return true;
    }
    rec.count += 1;
    return rec.count <= this.maxPerWindow;
  }

  reset(): void {
    this.seen.clear();
  }
}
