/**
 * Export / import local progress as JSON.
 */

import { loadMetaStore, saveMetaStore, type MetaStore } from "./store";
import { loadSettings, saveSettings, type ClientSettings } from "../ui/settings";
import { areCheatsEnabled } from "./cheats";

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

export function validateSaveImport(raw: unknown): { ok: true; data: SaveExport } | { ok: false; message: string } {
  if (!raw || typeof raw !== "object") return { ok: false, message: "Invalid JSON object" };
  const o = raw as Partial<SaveExport>;
  if (o.version !== 1) return { ok: false, message: "Unsupported save version" };
  if (!o.meta || typeof o.meta !== "object") return { ok: false, message: "Missing meta block" };
  if (typeof (o.meta as MetaStore).crests !== "number") {
    return { ok: false, message: "Meta.crests missing" };
  }
  return { ok: true, data: o as SaveExport };
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
