/**
 * Export / import local progress as JSON.
 */

import { loadMetaStore, saveMetaStore, type MetaStore } from "./store";
import { loadSettings, saveSettings, type ClientSettings } from "../ui/settings";
import { areCheatsEnabled, invalidateCheatCache } from "./cheats";
import { MAX_ASCENSION } from "./ascension";
import { META_UPGRADES } from "./upgrades";
import { normalizeCareer } from "./careerStats";

const META_KEY = "hlw-meta-v1";
const SETTINGS_KEY = "hlw-settings-v3";
const AI_KEY = "hlw-ai-brains-v1";

export type SaveExport = {
  version: 1;
  exportedAt: string;
  includeSettings: boolean;
  meta: MetaStore;
  settings?: ClientSettings;
  ai?: unknown;
  note?: string;
};

export function buildSaveExport(opts?: { includeSettings?: boolean; includeAi?: boolean }): SaveExport {
  const includeSettings = opts?.includeSettings ?? true;
  const includeAi = opts?.includeAi ?? true;
  const out: SaveExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    includeSettings,
    meta: loadMetaStore(),
    note: areCheatsEnabled()
      ? "Exported while cheats were enabled (sandbox profile)."
      : undefined,
  };
  if (includeSettings) out.settings = loadSettings();
  if (includeAi) {
    try {
      const raw = localStorage.getItem(AI_KEY);
      if (raw) out.ai = JSON.parse(raw);
    } catch {
      /* ignore */
    }
  }
  return out;
}

export function downloadSaveExport(opts?: { includeSettings?: boolean; includeAi?: boolean }): void {
  const data = buildSaveExport(opts);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hlw-save-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export type ImportResult = { ok: boolean; message: string };

const MAX_CRESTS = 1_000_000_000;
const MAX_COUNTER = 1_000_000_000;

function int(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}

function boolMap<T extends string>(v: unknown, cap = 500): Partial<Record<T, boolean>> {
  const out: Partial<Record<T, boolean>> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  let n = 0;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (n++ >= cap) break;
    if (val === true) out[k as T] = true;
  }
  return out;
}

/**
 * Barracks ranks: unknown ids are dropped (they can never be spent anyway) and
 * every known rank is clamped to its real ceiling, so a hand-edited save cannot
 * grant rank 9999 of an upgrade.
 */
function sanitizeRanks(v: unknown): MetaStore["ranks"] {
  const out: MetaStore["ranks"] = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const def = META_UPGRADES.find((u) => u.id === k);
    if (!def) continue;
    const rank = int(val, 0, def.maxRank, 0);
    if (rank > 0) out[def.id] = rank;
  }
  return out;
}

/**
 * Coerce an untrusted meta block into a valid store. Unknown keys are dropped
 * and missing ones fall back to defaults, so older exports still import cleanly.
 */
export function sanitizeMetaStore(raw: unknown): MetaStore | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const m = raw as Partial<MetaStore>;
  if (typeof m.crests !== "number" || !Number.isFinite(m.crests)) return null;
  return {
    crests: int(m.crests, 0, MAX_CRESTS, 0),
    ranks: sanitizeRanks(m.ranks),
    ascensionUnlocked: int(m.ascensionUnlocked, 0, MAX_ASCENSION, 0),
    highestAscensionCleared: int(m.highestAscensionCleared, -1, MAX_ASCENSION, -1),
    totalWins: int(m.totalWins, 0, MAX_COUNTER, 0),
    totalRuns: int(m.totalRuns, 0, MAX_COUNTER, 0),
    bestWave: int(m.bestWave, 0, MAX_COUNTER, 0),
    lifetimeCrests: int(m.lifetimeCrests, 0, MAX_CRESTS, 0),
    challengesCompleted: boolMap(m.challengesCompleted),
    mapsReachedWave12: boolMap(m.mapsReachedWave12) as Record<string, boolean>,
    career: normalizeCareer(m.career),
  };
}

export function validateSaveImport(
  raw: unknown,
): { ok: true; data: SaveExport } | { ok: false; message: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "Invalid JSON object" };
  }
  const o = raw as Partial<SaveExport>;
  if (o.version !== 1) return { ok: false, message: "Unsupported save version" };
  if (!o.meta || typeof o.meta !== "object") return { ok: false, message: "Missing meta block" };
  const meta = sanitizeMetaStore(o.meta);
  if (!meta) return { ok: false, message: "Meta block is corrupt (crests missing)" };
  const settings =
    o.settings && typeof o.settings === "object" && !Array.isArray(o.settings)
      ? (o.settings as ClientSettings)
      : undefined;
  return {
    ok: true,
    data: {
      version: 1,
      exportedAt: typeof o.exportedAt === "string" ? o.exportedAt : new Date().toISOString(),
      includeSettings: !!settings,
      meta,
      settings,
      ai: o.ai,
      note: typeof o.note === "string" ? o.note.slice(0, 200) : undefined,
    },
  };
}

/** Overwrites local progress after validation. */
export function applySaveImport(data: SaveExport, opts?: { importSettings?: boolean; importAi?: boolean }): ImportResult {
  const v = validateSaveImport(data);
  if (!v.ok) return v;
  saveMetaStore(v.data.meta);
  // Also write raw key for tools that read it directly
  localStorage.setItem(META_KEY, JSON.stringify(v.data.meta));
  if (opts?.importSettings !== false && v.data.settings) {
    saveSettings(v.data.settings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(v.data.settings));
  }
  if (opts?.importAi !== false && v.data.ai) {
    localStorage.setItem(AI_KEY, JSON.stringify(v.data.ai));
  }
  invalidateCheatCache();
  return { ok: true, message: "Save imported. Reloading menus…" };
}

export async function importSaveFromFile(file: File): Promise<ImportResult> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;
    const v = validateSaveImport(parsed);
    if (!v.ok) return v;
    return applySaveImport(v.data);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Import failed" };
  }
}
