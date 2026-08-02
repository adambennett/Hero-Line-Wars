/**
 * Helpers for per-seat AI picks in SP / MP lobbies.
 */
import type { AiTierId } from "./brain";
import {
  loadAiStore,
  resolveOpponentAi,
  type AiSelection,
  type AiStore,
  type ResolvedOpponentAi,
} from "./store";
import type { LobbyAiKind } from "../net/types";
import { createNeuralLaneAi, type NeuralLaneAi } from "./runtime";

export function lobbyAiToSelection(ai: LobbyAiKind): AiSelection {
  if (ai.kind === "classic") return { kind: "classic" };
  return { kind: "neural", school: ai.school, tier: ai.tier };
}

export function selectionToLobbyAi(sel: AiSelection): LobbyAiKind {
  if (sel.kind === "classic") return { kind: "classic" };
  return { kind: "neural", school: sel.school, tier: sel.tier === "classic" ? "brutal" : sel.tier };
}

export function resolveLobbyAi(ai: LobbyAiKind, store: AiStore = loadAiStore()): ResolvedOpponentAi {
  return resolveOpponentAi(lobbyAiToSelection(ai), store);
}

/** Runtime controller for mpSim — null means classic scripted AI. */
export function neuralFromResolved(
  resolved: ResolvedOpponentAi,
  aggressionMul = 1,
): NeuralLaneAi | null {
  if (resolved.kind !== "neural") return null;
  return createNeuralLaneAi(
    resolved.genome,
    Math.max(0, resolved.hesitation / Math.max(0.01, aggressionMul)),
    resolved.label,
  );
}

export function aiKindLabel(ai: LobbyAiKind, store: AiStore = loadAiStore()): string {
  if (ai.kind === "classic") return "Classic";
  const school = store.schools.find((s) => s.name === ai.school);
  const name = school?.name ?? ai.school;
  const tier = ai.tier.charAt(0).toUpperCase() + ai.tier.slice(1);
  return `${name} · ${tier}`;
}

/** `<option>` list for an AI difficulty select. */
export function aiKindOptionsHtml(selected: LobbyAiKind, store: AiStore = loadAiStore()): string {
  const opts: string[] = [];
  const classicSel = selected.kind === "classic" ? " selected" : "";
  opts.push(`<option value="classic"${classicSel}>Classic (scripted)</option>`);
  for (const school of store.schools) {
    for (const tier of ["rookie", "steady", "sharp", "brutal"] as const) {
      const value = `neural:${school.name}:${tier}`;
      const sel =
        selected.kind === "neural" && selected.school === school.name && selected.tier === tier
          ? " selected"
          : "";
      const label = `${school.name} · ${tier.charAt(0).toUpperCase()}${tier.slice(1)}`;
      opts.push(`<option value="${value}"${sel}>${label}</option>`);
    }
  }
  return opts.join("");
}

export function parseAiKindValue(value: string): LobbyAiKind {
  if (!value || value === "classic") return { kind: "classic" };
  const m = /^neural:(.+):(rookie|steady|sharp|brutal)$/.exec(value);
  if (!m) return { kind: "classic" };
  return { kind: "neural", school: m[1]!, tier: m[2] as Exclude<AiTierId, "classic"> };
}

export function newAiSeatId(): string {
  return `ai_${Math.random().toString(36).slice(2, 10)}`;
}
