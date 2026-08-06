/** Download / parse custom map & hero JSON bundles. */

import {
  CUSTOM_HERO_FORMAT,
  CUSTOM_MAP_FORMAT,
  newCustomHeroId,
  newCustomMapId,
  type CustomHeroBundle,
  type CustomHeroDef,
  type CustomMapBundle,
  type CustomMapDef,
} from "./types";
import { importCustomHero, importCustomMap } from "./registry";
import { abilityTemplate, passiveTemplate } from "./catalog";

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCustomMap(map: CustomMapDef): void {
  const bundle: CustomMapBundle = { format: CUSTOM_MAP_FORMAT, map };
  const safe = map.name.replace(/[^\w\-]+/g, "_").slice(0, 40) || "map";
  downloadJson(`hlw-map-${safe}.json`, bundle);
}

export function exportCustomHero(hero: CustomHeroDef): void {
  const bundle: CustomHeroBundle = { format: CUSTOM_HERO_FORMAT, hero };
  const safe = hero.name.replace(/[^\w\-]+/g, "_").slice(0, 40) || "hero";
  downloadJson(`hlw-hero-${safe}.json`, bundle);
}

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

export function parseCustomMapBundle(raw: unknown): CustomMapDef | string {
  const root = asObj(raw);
  if (!root) return "Invalid JSON";
  const mapObj = root.format === CUSTOM_MAP_FORMAT ? asObj(root.map) : root;
  if (!mapObj) return "Missing map data";
  if (typeof mapObj.name !== "string" || typeof mapObj.base !== "object") {
    return "Map is missing required fields (name, base)";
  }
  const id =
    typeof mapObj.id === "string" && mapObj.id.startsWith("cm_")
      ? mapObj.id
      : newCustomMapId();
  return {
    ...(mapObj as unknown as CustomMapDef),
    id,
    specials: (mapObj.specials as CustomMapDef["specials"]) ?? {},
    shops: normalizeShops(mapObj),
    respawn: normalizeRespawn(mapObj),
  };
}

function normalizeShops(mapObj: Record<string, unknown>): CustomMapDef["shops"] {
  if (Array.isArray(mapObj.shops)) return mapObj.shops as CustomMapDef["shops"];
  if (mapObj.shop && typeof mapObj.shop === "object") {
    return [mapObj.shop as CustomMapDef["shops"][number]];
  }
  return [];
}

function normalizeRespawn(mapObj: Record<string, unknown>): CustomMapDef["respawn"] {
  if (mapObj.respawn && typeof mapObj.respawn === "object") {
    return mapObj.respawn as CustomMapDef["respawn"];
  }
  const base = mapObj.base as { x?: number; y?: number } | undefined;
  return {
    x: (base?.x ?? 52) + 120,
    y: base?.y ?? 280,
    radius: 28,
  };
}

export function parseCustomHeroBundle(raw: unknown): CustomHeroDef | string {
  const root = asObj(raw);
  if (!root) return "Invalid JSON";
  const heroObj = root.format === CUSTOM_HERO_FORMAT ? asObj(root.hero) : root;
  if (!heroObj) return "Missing hero data";
  if (typeof heroObj.name !== "string" || !Array.isArray(heroObj.abilities)) {
    return "Hero is missing required fields (name, abilities)";
  }
  const abilities = heroObj.abilities as CustomHeroDef["abilities"];
  if (abilities.length < 2) return "Hero needs mobility + ultimate abilities";
  for (const a of abilities.slice(0, 2)) {
    if (!abilityTemplate(a.id)) return `Unknown ability: ${a.id}`;
  }
  const passive = heroObj.passive as CustomHeroDef["passive"];
  if (!passive?.id || !passiveTemplate(passive.id)) {
    return `Unknown passive: ${passive?.id ?? "?"}`;
  }
  const id =
    typeof heroObj.id === "string" && heroObj.id.startsWith("ch_")
      ? heroObj.id
      : newCustomHeroId();
  return { ...(heroObj as unknown as CustomHeroDef), id };
}

export async function importCustomMapFromFile(file: File): Promise<string> {
  try {
    const text = await file.text();
    const parsed = parseCustomMapBundle(JSON.parse(text));
    if (typeof parsed === "string") return parsed;
    // Always assign a fresh id on import so duplicates don't collide
    parsed.id = newCustomMapId();
    const saved = importCustomMap(parsed);
    if (!saved) return "Import failed";
    return "";
  } catch (e) {
    return e instanceof Error ? e.message : "Import failed";
  }
}

export async function importCustomHeroFromFile(file: File): Promise<string> {
  try {
    const text = await file.text();
    const parsed = parseCustomHeroBundle(JSON.parse(text));
    if (typeof parsed === "string") return parsed;
    parsed.id = newCustomHeroId();
    const saved = importCustomHero(parsed);
    if (!saved) return "Import failed";
    return "";
  } catch (e) {
    return e instanceof Error ? e.message : "Import failed";
  }
}
