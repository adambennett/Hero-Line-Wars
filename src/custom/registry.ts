/**
 * Runtime + localStorage registry for custom maps and heroes.
 */

import { HEROES, HERO_LIST, type HeroDef, type HeroId } from "../data/heroes";
import { MAPS, MAP_LIST, type MapDef, type MapId } from "../data/maps";
import { MAP_H, MAP_W } from "../data/constants";
import {
  type CustomHeroDef,
  type CustomMapDef,
  isCustomHeroId,
  isCustomMapId,
} from "./types";
import { sanitizeCustomHero, sanitizeCustomMap } from "./validate";

const MAP_STORE_KEY = "hlw-custom-maps-v1";
const HERO_STORE_KEY = "hlw-custom-heroes-v1";

/** Session overlays from MP start (not persisted unless also in library). */
const sessionMaps = new Map<string, CustomMapDef>();
const sessionHeroes = new Map<string, CustomHeroDef>();

let libraryMaps: CustomMapDef[] = [];
let libraryHeroes: CustomHeroDef[] = [];
let loaded = false;

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  libraryMaps = readList<CustomMapDef>(MAP_STORE_KEY).map(migrateCustomMap);
  libraryHeroes = readList<CustomHeroDef>(HERO_STORE_KEY);
}

/** Upgrade older custom map saves (single `shop`, missing `respawn` / shape). */
function migrateCustomMap(raw: CustomMapDef): CustomMapDef {
  const legacy = raw as CustomMapDef & { shop?: CustomMapDef["shops"][number] };
  const shops =
    Array.isArray(legacy.shops) && legacy.shops.length
      ? legacy.shops
      : legacy.shop
        ? [legacy.shop]
        : Array.isArray(legacy.shops)
          ? legacy.shops
          : [];
  const respawn =
    legacy.respawn ??
    ({ x: legacy.base.x + 120, y: legacy.base.y, radius: 28 } as CustomMapDef["respawn"]);
  const { shop: _drop, ...rest } = legacy;
  return {
    ...rest,
    shape: rest.shape ?? "rectangle",
    laneLeft: rest.laneLeft ?? 0,
    laneRight: rest.laneRight ?? MAP_W,
    shops,
    respawn,
    bouncePads: rest.bouncePads ?? [],
    mapPortals: rest.mapPortals ?? [],
    relayBeacons: rest.relayBeacons ?? [],
  };
}

function readList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeMaps(): void {
  localStorage.setItem(MAP_STORE_KEY, JSON.stringify(libraryMaps));
}

function writeHeroes(): void {
  localStorage.setItem(HERO_STORE_KEY, JSON.stringify(libraryHeroes));
}

export function listCustomMaps(): CustomMapDef[] {
  ensureLoaded();
  return libraryMaps.map((m) => structuredClone(m));
}

export function listCustomHeroes(): CustomHeroDef[] {
  ensureLoaded();
  return libraryHeroes.map((h) => structuredClone(h));
}

export function getCustomMap(id: string): CustomMapDef | null {
  ensureLoaded();
  return (
    sessionMaps.get(id) ??
    libraryMaps.find((m) => m.id === id) ??
    null
  );
}

export function getCustomHero(id: string): CustomHeroDef | null {
  ensureLoaded();
  return (
    sessionHeroes.get(id) ??
    libraryHeroes.find((h) => h.id === id) ??
    null
  );
}

export function saveCustomMap(def: CustomMapDef): void {
  ensureLoaded();
  const clean = sanitizeCustomMap(def);
  if (!clean) return;
  const i = libraryMaps.findIndex((m) => m.id === clean.id);
  if (i >= 0) libraryMaps[i] = clean;
  else libraryMaps.push(clean);
  writeMaps();
}

export function saveCustomHero(def: CustomHeroDef): void {
  ensureLoaded();
  const clean = sanitizeCustomHero(def);
  if (!clean) return;
  const i = libraryHeroes.findIndex((h) => h.id === clean.id);
  if (i >= 0) libraryHeroes[i] = clean;
  else libraryHeroes.push(clean);
  writeHeroes();
}

export function deleteCustomMap(id: string): void {
  ensureLoaded();
  libraryMaps = libraryMaps.filter((m) => m.id !== id);
  writeMaps();
}

export function deleteCustomHero(id: string): void {
  ensureLoaded();
  libraryHeroes = libraryHeroes.filter((h) => h.id !== id);
  writeHeroes();
}

/** Register defs for the current match (from MP start payload). */
export function registerSessionCustoms(opts: {
  maps?: CustomMapDef[];
  heroes?: CustomHeroDef[];
}): void {
  for (const m of opts.maps ?? []) {
    const clean = sanitizeCustomMap(m);
    if (clean) sessionMaps.set(clean.id, clean);
  }
  for (const h of opts.heroes ?? []) {
    const clean = sanitizeCustomHero(h);
    if (clean) sessionHeroes.set(clean.id, clean);
  }
}

export function clearSessionCustoms(): void {
  sessionMaps.clear();
  sessionHeroes.clear();
}

/** Convert custom map → runtime MapDef (includes zone fields). */
export function customMapToMapDef(c: CustomMapDef): MapDef {
  const s = c.specials ?? {};
  const laneLeft = c.laneLeft ?? 0;
  const laneRight = c.laneRight ?? MAP_W;
  return {
    id: c.id as MapId,
    name: c.name,
    blurb: c.blurb,
    shape: c.shape ?? "rectangle",
    laneTop: c.laneTop,
    laneBottom: c.laneBottom,
    laneLeft,
    laneRight,
    baseLaneTop: c.laneTop,
    baseLaneBottom: c.laneBottom,
    baseLaneLeft: laneLeft,
    baseLaneRight: laneRight,
    base: structuredClone(c.base),
    shops: structuredClone(c.shops ?? []),
    respawn: structuredClone(
      c.respawn ?? { x: c.base.x + 120, y: c.base.y, radius: 28 },
    ),
    spawner: structuredClone(c.spawner),
    spawnerAlt: c.spawnerAlt ? structuredClone(c.spawnerAlt) : undefined,
    highGrounds: structuredClone(c.highGrounds ?? []),
    obstacles: structuredClone(c.obstacles ?? []),
    turretSlots: structuredClone(c.turretSlots ?? []),
    shiftingObstacles: !!s.shiftingObstacles,
    shrinkingLane: !!s.shrinkingLane,
    movingHazards: !!s.movingHazards,
    eclipseFog: !!s.eclipseFog,
    dualSpawners: !!s.dualSpawners,
    chestMagnet: !!s.chestMagnet,
    riftSurges: !!s.riftSurges,
    volatileOrbs: !!s.volatileOrbs,
    emberRain: !!s.emberRain,
    supplyDrops: !!s.supplyDrops,
    chronoPulse: !!s.chronoPulse,
    healSprings: structuredClone(c.healSprings ?? []),
    slowMires: structuredClone(c.slowMires ?? []),
    hastePads: structuredClone(c.hastePads ?? []),
    goldVents: structuredClone(c.goldVents ?? []),
    windCurrents: structuredClone(c.windCurrents ?? []),
    spikePulses: structuredClone(c.spikePulses ?? []),
    bouncePads: structuredClone(c.bouncePads ?? []),
    mapPortals: structuredClone(c.mapPortals ?? []),
    relayBeacons: structuredClone(c.relayBeacons ?? []),
  };
}

export function customHeroToHeroDef(c: CustomHeroDef): HeroDef {
  return {
    id: c.id as HeroId,
    name: c.name,
    blurb: c.blurb,
    color: c.color,
    glowColor: c.glowColor,
    radius: c.radius,
    speed: c.speed,
    maxHp: c.maxHp,
    attackRange: c.attackRange,
    attackDamage: c.attackDamage,
    attackCooldown: c.attackCooldown,
    projectileSpeed: c.projectileSpeed,
    attackStyle: c.attackStyle,
    aimMode: c.aimMode,
    attackHint: c.attackHint,
    passive: structuredClone(c.passive),
    abilities: [structuredClone(c.abilities[0]), structuredClone(c.abilities[1])],
  };
}

export function resolveHero(id: string): HeroDef {
  if (isCustomHeroId(id)) {
    const c = getCustomHero(id);
    if (c) return customHeroToHeroDef(c);
  }
  const builtin = HEROES[id as HeroId];
  if (builtin) return builtin;
  return HERO_LIST[0]!;
}

export function resolveMap(id: string): MapDef {
  if (isCustomMapId(id)) {
    const c = getCustomMap(id);
    if (c) return customMapToMapDef(c);
  }
  const builtin = MAPS[id as MapId];
  if (builtin) return builtin;
  return MAP_LIST[0]!;
}

export function heroHasPassive(heroId: string, passiveId: string): boolean {
  return resolveHero(heroId).passive.id === passiveId;
}

export function heroHasAbility(heroId: string, abilityId: string): boolean {
  return resolveHero(heroId).abilities.some((a) => a.id === abilityId);
}

export function heroUsesGyroKit(heroId: string): boolean {
  const h = resolveHero(heroId);
  return (
    h.attackStyle === "spin" ||
    h.abilities.some((a) => a.id === "bladehook" || a.id === "bladestorm")
  );
}

export function heroUsesWarpKit(heroId: string): boolean {
  const h = resolveHero(heroId);
  return (
    h.attackStyle === "warpbolt" ||
    h.abilities.some((a) => a.id === "padlink" || a.id === "echonova")
  );
}

export function heroUsesGunnerKit(heroId: string): boolean {
  const h = resolveHero(heroId);
  return (
    h.attackStyle === "machinegun" ||
    h.abilities.some((a) => a.id === "gunfire" || a.id === "gunswap")
  );
}

export function heroUsesSapperKit(heroId: string): boolean {
  const h = resolveHero(heroId);
  return (
    h.attackStyle === "grenade" ||
    h.abilities.some((a) => a.id === "plantmine" || a.id === "detonate")
  );
}

export function heroUsesVectorKit(heroId: string): boolean {
  const h = resolveHero(heroId);
  return (
    h.attackStyle === "kinetic" ||
    h.abilities.some((a) => a.id === "momentumdash" || a.id === "kineticburst")
  );
}

export function defaultCustomMap(partial?: Partial<CustomMapDef>): CustomMapDef {
  const midY = MAP_H / 2;
  const base = partial?.base ?? { x: 52, y: midY, radius: 46, maxHp: 120 };
  return {
    id: partial?.id ?? "",
    name: partial?.name ?? "My Custom Map",
    blurb: partial?.blurb ?? "A player-authored lane.",
    shape: partial?.shape ?? "rectangle",
    laneTop: partial?.laneTop ?? 100,
    laneBottom: partial?.laneBottom ?? MAP_H - 100,
    laneLeft: partial?.laneLeft ?? 0,
    laneRight: partial?.laneRight ?? MAP_W,
    base,
    shops: partial?.shops ?? [{ x: 148, y: midY + 100, radius: 38, interactRange: 58 }],
    respawn: partial?.respawn ?? { x: base.x + 120, y: base.y, radius: 28 },
    spawner: partial?.spawner ?? { x: MAP_W - 52, y: midY, radius: 30 },
    spawnerAlt: partial?.spawnerAlt,
    highGrounds: partial?.highGrounds ?? [
      { x: 560, y: 180, w: 280, h: 180, damageBonus: 0.35, oathDamageBonus: 0.65 },
    ],
    obstacles: partial?.obstacles ?? [
      { x: 340, y: 140, w: 48, h: 70, label: "rock" },
      { x: 340, y: 420, w: 48, h: 70, label: "rock" },
    ],
    turretSlots: partial?.turretSlots ?? [
      { x: 120, y: 220 },
      { x: 120, y: 480 },
      { x: 200, y: midY },
    ],
    specials: partial?.specials ?? {},
    healSprings: partial?.healSprings ?? [],
    slowMires: partial?.slowMires ?? [],
    hastePads: partial?.hastePads ?? [],
    goldVents: partial?.goldVents ?? [],
    windCurrents: partial?.windCurrents ?? [],
    spikePulses: partial?.spikePulses ?? [],
    bouncePads: partial?.bouncePads ?? [],
    mapPortals: partial?.mapPortals ?? [],
    relayBeacons: partial?.relayBeacons ?? [],
  };
}

export function defaultCustomHero(partial?: Partial<CustomHeroDef>): CustomHeroDef {
  const base = HERO_LIST[0]!;
  return {
    id: partial?.id ?? "",
    name: partial?.name ?? "Custom Hero",
    blurb: partial?.blurb ?? "A player-authored kit remix.",
    color: partial?.color ?? base.color,
    glowColor: partial?.glowColor ?? base.glowColor,
    radius: partial?.radius ?? base.radius,
    speed: partial?.speed ?? base.speed,
    maxHp: partial?.maxHp ?? base.maxHp,
    attackRange: partial?.attackRange ?? base.attackRange,
    attackDamage: partial?.attackDamage ?? base.attackDamage,
    attackCooldown: partial?.attackCooldown ?? base.attackCooldown,
    projectileSpeed: partial?.projectileSpeed ?? base.projectileSpeed,
    attackStyle: partial?.attackStyle ?? base.attackStyle,
    aimMode: partial?.aimMode ?? base.aimMode,
    attackHint: partial?.attackHint ?? base.attackHint,
    passive: partial?.passive ?? { ...base.passive },
    abilities: partial?.abilities ?? [
      { ...base.abilities[0] },
      { ...base.abilities[1] },
    ],
  };
}

/** Collect customs referenced by ids for MP start. */
export function collectCustomsForMatch(opts: {
  mapId: string;
  heroIds: string[];
}): { maps: CustomMapDef[]; heroes: CustomHeroDef[] } {
  ensureLoaded();
  const maps: CustomMapDef[] = [];
  const heroes: CustomHeroDef[] = [];
  if (isCustomMapId(opts.mapId)) {
    const m = getCustomMap(opts.mapId);
    if (m) maps.push(structuredClone(m));
  }
  for (const id of opts.heroIds) {
    if (!isCustomHeroId(id)) continue;
    const h = getCustomHero(id);
    if (h && !heroes.some((x) => x.id === h.id)) heroes.push(structuredClone(h));
  }
  return { maps, heroes };
}
