/**
 * Shared hero picker ordering, pagination, Random option.
 * Built-ins first, then customs; page size = stock roster size.
 */

import { HERO_LIST, type HeroId } from "../data/heroes";
import { listCustomHeroes, resolveHero } from "../custom/registry";
import { isCustomHeroId } from "../custom/types";
import { isHeroUnlocked } from "../meta/store";

/** One page ≈ full built-in roster (customs overflow to page 2+). */
export const HERO_PAGE_SIZE = HERO_LIST.length;

export const RANDOM_HERO_ID = "random" as const;
export type HeroPickId = HeroId | typeof RANDOM_HERO_ID | string;

export type HeroSelectEntry = {
  id: HeroPickId;
  name: string;
  blurb: string;
  color: string;
  unlocked: boolean;
  custom: boolean;
  random: boolean;
};

function escapeAttr(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Stock + custom, stock first. Optional Random card at the front. */
export function listHeroSelectEntries(opts?: {
  includeRandom?: boolean;
  /** When set, only include heroes matching the filter text. */
  filter?: string;
}): HeroSelectEntry[] {
  const includeRandom = opts?.includeRandom !== false;
  const q = (opts?.filter ?? "").trim().toLowerCase();
  const match = (name: string, blurb: string) =>
    !q || name.toLowerCase().includes(q) || blurb.toLowerCase().includes(q);

  const out: HeroSelectEntry[] = [];
  if (includeRandom && match("Random", "Pick a random unlocked hero at match start")) {
    out.push({
      id: RANDOM_HERO_ID,
      name: "Random",
      blurb: "Unlocked hero at match start",
      color: "#9ab0c8",
      unlocked: true,
      custom: false,
      random: true,
    });
  }

  for (const h of HERO_LIST) {
    if (!match(h.name, h.blurb + " " + h.passive.blurb)) continue;
    out.push({
      id: h.id,
      name: h.name,
      blurb: h.blurb,
      color: h.color,
      unlocked: isHeroUnlocked(h.id),
      custom: false,
      random: false,
    });
  }

  for (const h of listCustomHeroes()) {
    if (!match(h.name, h.blurb)) continue;
    out.push({
      id: h.id,
      name: h.name,
      blurb: h.blurb,
      color: h.color,
      unlocked: true,
      custom: true,
      random: false,
    });
  }

  return out;
}

export function heroSelectPageCount(total: number, pageSize = HERO_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
}

/** Slice entries for 0-based page index. */
export function sliceHeroPage<T>(
  entries: readonly T[],
  page: number,
  pageSize = HERO_PAGE_SIZE,
): T[] {
  const n = heroSelectPageCount(entries.length, pageSize);
  const p = Math.min(Math.max(0, page), n - 1);
  const start = p * pageSize;
  return entries.slice(start, start + pageSize);
}

/**
 * Resolve Random / locked picks at match start.
 * Random: random unlocked stock + any custom; avoids duplicates when `avoid` provided.
 */
export function resolveHeroPick(
  pick: HeroPickId,
  seed = (Math.random() * 1e9) | 0,
  avoid: Iterable<string> = [],
): HeroId | string {
  if (pick !== RANDOM_HERO_ID) {
    if (isCustomHeroId(pick)) return pick;
    if (HERO_LIST.some((h) => h.id === pick)) return pick as HeroId;
    return HERO_LIST[0]!.id;
  }

  const blocked = new Set(avoid);
  const unlocked: Array<HeroId | string> = [
    ...HERO_LIST.filter((h) => isHeroUnlocked(h.id) && !blocked.has(h.id)).map((h) => h.id),
    ...listCustomHeroes().filter((h) => !blocked.has(h.id)).map((h) => h.id),
  ];
  const pool = unlocked.length
    ? unlocked
    : HERO_LIST.filter((h) => !blocked.has(h.id)).map((h) => h.id);
  const list = pool.length ? pool : [HERO_LIST[0]!.id];
  return list[Math.abs(seed) % list.length]!;
}

/** Compact hero card HTML fragment. */
export function heroCardHtml(
  entry: HeroSelectEntry,
  selectedId: string,
  opts?: { dataAttr?: string; action?: string },
): string {
  const dataAttr = opts?.dataAttr ?? "data-hero-id";
  const action = opts?.action ? ` data-action="${opts.action}"` : "";
  const selected = entry.id === selectedId;
  const locked = !entry.unlocked && !entry.random;
  const tip = locked
    ? ' data-tip="Unlock in Barracks"'
    : entry.random
      ? ' data-tip="A random unlocked hero when the match starts"'
      : "";
  const lockedClass = locked ? "locked" : "";
  const blurb = locked ? "Locked" : entry.custom ? `Custom · ${entry.blurb}` : entry.blurb;
  return `
    <button type="button" class="hero-card compact shine-btn ${selected ? "selected" : ""} ${lockedClass}" ${dataAttr}="${escapeAttr(String(entry.id))}"${action} ${locked ? "disabled" : ""}${tip}>
      <span class="hero-swatch" style="--hero:${escapeAttr(entry.color)}"></span>
      <strong class="btn-label">${escapeAttr(entry.name)}</strong>
      <span>${escapeAttr(blurb)}</span>
    </button>
  `;
}

export function heroPagerHtml(
  page: number,
  totalPages: number,
  opts?: { prefix?: string; actionPrev?: string; actionNext?: string },
): string {
  if (totalPages <= 1) return "";
  const prefix = opts?.prefix ?? "hero";
  const prev = opts?.actionPrev ?? `${prefix}-page-prev`;
  const next = opts?.actionNext ?? `${prefix}-page-next`;
  return `
    <div class="hero-pager" role="navigation" aria-label="Hero pages">
      <button type="button" class="menu-btn small ghost" data-action="${prev}" ${page <= 0 ? "disabled" : ""}>←</button>
      <span class="hero-pager-meta">${page + 1} / ${totalPages}</span>
      <button type="button" class="menu-btn small ghost" data-action="${next}" ${page >= totalPages - 1 ? "disabled" : ""}>→</button>
    </div>
  `;
}

export function heroDetailForPick(id: HeroPickId): {
  name: string;
  color: string;
  blurb: string;
  locked: boolean;
  custom: boolean;
  random: boolean;
  passive?: string;
  attack?: string;
  mobility?: string;
  ultimate?: string;
} {
  if (id === RANDOM_HERO_ID) {
    return {
      name: "???",
      color: "#9ab0c8",
      blurb: "???",
      locked: false,
      custom: false,
      random: true,
      passive: "???",
      attack: "???",
      mobility: "???",
      ultimate: "???",
    };
  }
  const h = resolveHero(id);
  const custom = isCustomHeroId(id);
  const unlocked = custom || isHeroUnlocked(h.id as HeroId);
  if (!unlocked) {
    return {
      name: h.name,
      color: h.color,
      blurb: "Commission this hero in the Barracks to unlock.",
      locked: true,
      custom,
      random: false,
    };
  }
  const [mobility, ultimate] = h.abilities;
  return {
    name: h.name,
    color: h.color,
    blurb: h.blurb,
    locked: false,
    custom,
    random: false,
    passive: `${h.passive.name} — ${h.passive.blurb}`,
    attack: h.attackHint,
    mobility: `${mobility.name} — ${mobility.hint}`,
    ultimate: `${ultimate.name} — ${ultimate.hint}`,
  };
}
