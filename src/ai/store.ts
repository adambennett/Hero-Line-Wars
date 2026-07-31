/**
 * Persist trained Hero Line Wars brains + selected opponent tiers.
 */

import {
  deserializeGenome,
  type AiTierId,
  type Genome,
  type RecipeId,
  serializeGenome,
} from "./brain";
import type { TrainResult } from "./train";

const STORE_KEY = "hlw-ai-brains-v1";

export type SavedSchool = {
  name: string;
  recipe: RecipeId;
  champion: string;
  checkpoints: { gen: number; fit: number; genome: string }[];
  history: { gen: number; best: number; avg: number; wr: number }[];
  trainedAt: string;
};

export type AiSelection = { kind: "classic" } | { kind: "neural"; school: string; tier: AiTierId };

export type AiStore = {
  schools: SavedSchool[];
  /** Solo / PvE opponent AI. */
  selected: AiSelection;
};

const DEFAULT_STORE: AiStore = {
  schools: [],
  selected: { kind: "classic" },
};

export function loadAiStore(): AiStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return structuredClone(DEFAULT_STORE);
    const parsed = JSON.parse(raw) as Partial<AiStore>;
    return {
      ...DEFAULT_STORE,
      ...parsed,
      schools: parsed.schools ?? [],
      selected: parsed.selected ?? { kind: "classic" },
    };
  } catch {
    return structuredClone(DEFAULT_STORE);
  }
}

export function saveAiStore(store: AiStore): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function saveTrainingResult(name: string, recipe: RecipeId, result: TrainResult): AiStore {
  const store = loadAiStore();
  const school: SavedSchool = {
    name,
    recipe,
    champion: serializeGenome(result.champion),
    checkpoints: result.checkpoints.map((c) => ({
      gen: c.gen,
      fit: c.fit,
      genome: serializeGenome(c.genome),
    })),
    history: result.history,
    trainedAt: new Date().toISOString(),
  };
  store.schools = store.schools.filter((s) => s.name !== name);
  store.schools.unshift(school);
  store.selected = { kind: "neural", school: name, tier: "brutal" };
  saveAiStore(store);
  return store;
}

export type ResolvedOpponentAi =
  | { kind: "classic" }
  | { kind: "neural"; genome: Genome; hesitation: number; label: string };

/** Map a selection → runtime AI config. */
export function resolveOpponentAi(sel: AiSelection, store: AiStore = loadAiStore()): ResolvedOpponentAi {
  if (sel.kind === "classic") return { kind: "classic" };
  const school = store.schools.find((s) => s.name === sel.school);
  if (!school) return { kind: "classic" };

  const tier = sel.tier;
  const cps = [...school.checkpoints].sort((a, b) => a.gen - b.gen);
  let genomeRaw = school.champion;
  let hesitation = 0;
  let label = `${school.name} · Brutal`;

  if (tier === "rookie" && cps[0]) {
    genomeRaw = cps[0].genome;
    hesitation = 0.28;
    label = `${school.name} · Rookie`;
  } else if (tier === "steady" && cps[Math.floor(cps.length * 0.4)]) {
    genomeRaw = cps[Math.floor(cps.length * 0.4)]!.genome;
    hesitation = 0.12;
    label = `${school.name} · Steady`;
  } else if (tier === "sharp" && cps[Math.floor(cps.length * 0.75)]) {
    genomeRaw = cps[Math.floor(cps.length * 0.75)]!.genome;
    hesitation = 0.04;
    label = `${school.name} · Sharp`;
  } else if (tier !== "brutal" && tier !== "classic") {
    label = `${school.name} · ${tier}`;
  }

  const genome = deserializeGenome(genomeRaw);
  if (!genome) return { kind: "classic" };
  return { kind: "neural", genome, hesitation, label };
}

export function resolveSelectedOpponent(store: AiStore = loadAiStore()): ResolvedOpponentAi {
  return resolveOpponentAi(store.selected, store);
}

export function setSelectedOpponent(sel: AiSelection): AiStore {
  const store = loadAiStore();
  store.selected = sel;
  saveAiStore(store);
  return store;
}

export function deleteSchool(name: string): AiStore {
  const store = loadAiStore();
  store.schools = store.schools.filter((s) => s.name !== name);
  if (store.selected.kind === "neural" && store.selected.school === name) {
    store.selected = { kind: "classic" };
  }
  saveAiStore(store);
  return store;
}
