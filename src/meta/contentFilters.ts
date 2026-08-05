/**
 * Per–game-type content allow/deny lists.
 * Empty (or missing) category arrays mean "everything enabled" for that category.
 */

import { HERO_LIST, type HeroId } from "../data/heroes";
import { LEVEL_PASSIVE_LIST, type LevelPassiveId } from "../data/xp";
import { SHOP_ITEMS, type ShopItemId } from "../data/shop";
import { RELIC_LIST, type RelicId } from "../data/relics";
import { ENEMY_DEFS, ENEMY_KINDS, isBossKind, type EnemyKind } from "../data/enemies";
import { SEND_PACKS, type SendPackId } from "../data/send";
import { MAP_LIST, type MapId } from "../data/maps";
import { BASE_BRANCHES, type BaseBranchId } from "../data/baseBranches";

export const CONTENT_FILTER_KEYS = [
  "heroes",
  "bonuses",
  "items",
  "artifacts",
  "relics",
  "enemies",
  "sends",
  "maps",
  "baseUpgrades",
] as const;

export type ContentFilterKey = (typeof CONTENT_FILTER_KEYS)[number];

/** Ids listed here are disabled for the run. Empty array = allow-all. */
export type GameTypeContentFilters = {
  heroes: string[];
  bonuses: string[];
  items: string[];
  artifacts: string[];
  relics: string[];
  enemies: string[];
  sends: string[];
  maps: string[];
  baseUpgrades: string[];
};

export function emptyContentFilters(): GameTypeContentFilters {
  return {
    heroes: [],
    bonuses: [],
    items: [],
    artifacts: [],
    relics: [],
    enemies: [],
    sends: [],
    maps: [],
    baseUpgrades: [],
  };
}

export function isAllContentEnabled(f: GameTypeContentFilters | null | undefined): boolean {
  if (!f) return true;
  return CONTENT_FILTER_KEYS.every((k) => !f[k]?.length);
}

export function isIdEnabled(
  f: GameTypeContentFilters | null | undefined,
  key: ContentFilterKey,
  id: string,
): boolean {
  const dis = f?.[key];
  if (!dis?.length) return true;
  return !dis.includes(id);
}

export function sanitizeContentFilters(raw: unknown): GameTypeContentFilters {
  const base = emptyContentFilters();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  for (const key of CONTENT_FILTER_KEYS) {
    const v = r[key];
    if (!Array.isArray(v)) continue;
    const out: string[] = [];
    for (const id of v) {
      if (typeof id === "string" && id.trim()) out.push(id.trim().slice(0, 64));
      if (out.length >= 256) break;
    }
    base[key] = out;
  }
  return base;
}

/** Require ≥1 hero and ≥1 enemy kind remain available. */
export function validateContentFilters(f: GameTypeContentFilters): string | null {
  const heroesLeft = HERO_LIST.filter((h) => isIdEnabled(f, "heroes", h.id));
  if (heroesLeft.length < 1) return "Keep at least one hero enabled.";

  const enemiesLeft = ENEMY_KINDS.filter((k) => isIdEnabled(f, "enemies", k));
  if (enemiesLeft.length < 1) return "Keep at least one enemy type enabled.";

  return null;
}

export function enabledHeroIds(f?: GameTypeContentFilters | null): HeroId[] {
  return HERO_LIST.filter((h) => isIdEnabled(f, "heroes", h.id)).map((h) => h.id);
}

export function enabledBonusIds(f?: GameTypeContentFilters | null): LevelPassiveId[] {
  return LEVEL_PASSIVE_LIST.filter((b) => isIdEnabled(f, "bonuses", b.id)).map((b) => b.id);
}

export function enabledGearIds(f?: GameTypeContentFilters | null): ShopItemId[] {
  return SHOP_ITEMS.filter(
    (i) => i.category === "gear" && isIdEnabled(f, "items", i.id),
  ).map((i) => i.id);
}

export function enabledArtifactIds(f?: GameTypeContentFilters | null): ShopItemId[] {
  return SHOP_ITEMS.filter(
    (i) => i.category === "artifact" && isIdEnabled(f, "artifacts", i.id),
  ).map((i) => i.id);
}

export function enabledRelicIds(f?: GameTypeContentFilters | null): RelicId[] {
  return RELIC_LIST.filter((r) => isIdEnabled(f, "relics", r.id)).map((r) => r.id);
}

export function enabledEnemyKinds(f?: GameTypeContentFilters | null): EnemyKind[] {
  return ENEMY_KINDS.filter((k) => isIdEnabled(f, "enemies", k));
}

export function enabledSendIds(f?: GameTypeContentFilters | null): SendPackId[] {
  return SEND_PACKS.filter((p) => isIdEnabled(f, "sends", p.id)).map((p) => p.id);
}

export function enabledMapIds(f?: GameTypeContentFilters | null): MapId[] {
  return MAP_LIST.filter((m) => isIdEnabled(f, "maps", m.id)).map((m) => m.id as MapId);
}

export function enabledBaseUpgradeIds(f?: GameTypeContentFilters | null): BaseBranchId[] {
  return (Object.keys(BASE_BRANCHES) as BaseBranchId[]).filter((id) =>
    isIdEnabled(f, "baseUpgrades", id),
  );
}

/** Derive run-level disable flags from empty enable pools. */
export function deriveDisableFlags(f?: GameTypeContentFilters | null): {
  disableSends: boolean;
  disableRelics: boolean;
  disableArtifacts: boolean;
  disableBonuses: boolean;
  disableBaseUpgrades: boolean;
  disableBosses: boolean;
  noEligibleMaps: boolean;
} {
  if (!f || isAllContentEnabled(f)) {
    return {
      disableSends: false,
      disableRelics: false,
      disableArtifacts: false,
      disableBonuses: false,
      disableBaseUpgrades: false,
      disableBosses: false,
      noEligibleMaps: false,
    };
  }
  const sends = enabledSendIds(f);
  const relics = enabledRelicIds(f);
  const arts = enabledArtifactIds(f);
  const bonuses = enabledBonusIds(f);
  const baseU = enabledBaseUpgradeIds(f);
  const enemies = enabledEnemyKinds(f);
  const anyBoss = enemies.some((k) => isBossKind(k));
  const maps = enabledMapIds(f);

  return {
    disableSends: f.sends.length > 0 && sends.length === 0,
    disableRelics: f.relics.length > 0 && relics.length === 0,
    disableArtifacts: f.artifacts.length > 0 && arts.length === 0,
    disableBonuses: f.bonuses.length > 0 && bonuses.length === 0,
    disableBaseUpgrades: f.baseUpgrades.length > 0 && baseU.length === 0,
    disableBosses: f.enemies.length > 0 && !anyBoss,
    noEligibleMaps: f.maps.length > 0 && maps.length === 0,
  };
}

export function contentFilterCatalog(): {
  key: ContentFilterKey;
  label: string;
  ids: { id: string; name: string }[];
}[] {
  return [
    {
      key: "heroes",
      label: "Heroes",
      ids: HERO_LIST.map((h) => ({ id: h.id, name: h.name })),
    },
    {
      key: "bonuses",
      label: "Level bonuses",
      ids: LEVEL_PASSIVE_LIST.map((b) => ({ id: b.id, name: b.name })),
    },
    {
      key: "items",
      label: "Shop gear",
      ids: SHOP_ITEMS.filter((i) => i.category === "gear").map((i) => ({
        id: i.id,
        name: i.name,
      })),
    },
    {
      key: "artifacts",
      label: "Artifacts",
      ids: SHOP_ITEMS.filter((i) => i.category === "artifact").map((i) => ({
        id: i.id,
        name: i.name,
      })),
    },
    {
      key: "relics",
      label: "Relics",
      ids: RELIC_LIST.map((r) => ({ id: r.id, name: r.name })),
    },
    {
      key: "enemies",
      label: "Enemies",
      ids: ENEMY_KINDS.map((k) => ({ id: k, name: ENEMY_DEFS[k]?.name ?? k })),
    },
    {
      key: "sends",
      label: "Sends",
      ids: SEND_PACKS.map((p) => ({ id: p.id, name: p.name })),
    },
    {
      key: "maps",
      label: "Maps",
      ids: MAP_LIST.map((m) => ({ id: m.id, name: m.name })),
    },
    {
      key: "baseUpgrades",
      label: "Base upgrades",
      ids: (Object.keys(BASE_BRANCHES) as BaseBranchId[]).map((id) => ({
        id,
        name: BASE_BRANCHES[id].name,
      })),
    },
  ];
}

/** Pick enemy kind respecting disabled list; fall back to any enabled. */
export function pickEnabledEnemyKind(
  f: GameTypeContentFilters | null | undefined,
  preferred: EnemyKind,
): EnemyKind {
  if (isIdEnabled(f, "enemies", preferred)) return preferred;
  const pool = enabledEnemyKinds(f);
  if (!pool.length) return preferred;
  return pool[Math.floor(Math.random() * pool.length)]!;
}
