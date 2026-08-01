/**
 * Reward-draft slots + per-player queue.
 *
 * A lane (or, in shared-lane multiplayer, a player bag) has one slot per draft
 * kind. If a second draft of the SAME kind arrives while one is open — a chest
 * cracked while a chest reward is pending, a second elite wave cleared before a
 * relic was taken — the new one is QUEUED instead of replacing or discarding it.
 * Players work through queued drafts one at a time while the game keeps running.
 *
 * The queue lives on lane state and is mirrored into `PlayerBag`, so it swaps
 * with `withPlayerBag` and survives snapshot sync.
 */
import type { BaseBranchId } from "../data/baseBranches";
import type { CurseId } from "../data/curses";
import type { RelicId } from "../data/relics";
import type { UtilityId } from "../data/utilities";
import type { LevelPassiveId } from "../data/xp";
import type { ChestRewardOption, DraftKind, GameState } from "../game/state";

export type PendingDraft =
  | { kind: "relic"; choices: RelicId[] }
  | { kind: "level"; choices: LevelPassiveId[] }
  | { kind: "utility"; choices: UtilityId[] }
  | { kind: "curse"; choices: CurseId[] }
  | { kind: "chest"; options: ChestRewardOption[] }
  | { kind: "base"; choices: BaseBranchId[] };

export type DraftKindName = PendingDraft["kind"];

/** Display / resolution precedence — matches the in-run draft panel. */
const DRAFT_PRECEDENCE: DraftKindName[] = ["curse", "chest", "utility", "base", "level", "relic"];

/** True when a draft of this kind is already waiting behind the open one. */
export function hasQueuedDraft(state: GameState, kind: DraftKindName): boolean {
  return (state.draftQueue ?? []).some((d) => d.kind === kind);
}

/** Open or queued — used to avoid offering the same reward twice. */
export function hasDraftPending(state: GameState, kind: DraftKindName): boolean {
  return !isDraftSlotFree(state, kind) || hasQueuedDraft(state, kind);
}

export function isDraftSlotFree(state: GameState, kind: DraftKindName): boolean {
  switch (kind) {
    case "relic":
      return !state.relicDraft;
    case "level":
      return !state.levelDraft;
    case "utility":
      return !state.utilityDraft;
    case "curse":
      return !state.curseDraft;
    case "chest":
      return !state.chestDraft;
    case "base":
      return !state.baseBranchDraft;
  }
}

function writeDraftSlot(state: GameState, draft: PendingDraft): void {
  switch (draft.kind) {
    case "relic":
      state.relicDraft = [...draft.choices];
      state.pendingRelicDraft = true;
      break;
    case "level":
      state.levelDraft = [...draft.choices];
      break;
    case "utility":
      state.utilityDraft = [...draft.choices];
      break;
    case "curse":
      state.curseDraft = [...draft.choices];
      break;
    case "chest":
      state.chestDraft = draft.options.map((o) => ({ ...o }));
      break;
    case "base":
      state.baseBranchDraft = [...draft.choices];
      break;
  }
}

/** Highest-precedence draft currently on screen. */
export function currentDraftKind(state: GameState): DraftKind {
  if (state.curseDraft) return "curse";
  if (state.chestDraft) return "chest";
  if (state.utilityDraft) return "utility";
  if (state.baseBranchDraft) return "base";
  if (state.levelDraft) return "level";
  if (state.relicDraft) return "relic";
  return null;
}

/** Pull queued drafts into any slot that freed up (one per kind). */
export function advanceDraftQueue(state: GameState): void {
  const queue = state.draftQueue;
  if (!queue || queue.length === 0) return;
  const rest: PendingDraft[] = [];
  for (const draft of queue) {
    if (isDraftSlotFree(state, draft.kind)) writeDraftSlot(state, draft);
    else rest.push(draft);
  }
  state.draftQueue = rest;
}

/**
 * Recompute `draftKind` / `pausedForDraft` from the open slots after promoting
 * anything waiting in the queue. Call this at the end of every draft resolution.
 */
export function syncDraftFlags(state: GameState): void {
  advanceDraftQueue(state);
  const kind = currentDraftKind(state);
  state.draftKind = kind;
  state.pausedForDraft = kind !== null;
}

/** Open a draft now if its slot is free, otherwise queue it for later. */
export function openOrQueueDraft(state: GameState, draft: PendingDraft): void {
  if (isDraftSlotFree(state, draft.kind)) {
    writeDraftSlot(state, draft);
  } else {
    if (!state.draftQueue) state.draftQueue = [];
    state.draftQueue.push(draft);
  }
  syncDraftFlags(state);
}

/** How many rewards are still waiting behind the visible one. */
export function pendingDraftCount(state: GameState): number {
  const queued = state.draftQueue?.length ?? 0;
  const open = DRAFT_PRECEDENCE.filter((k) => !isDraftSlotFree(state, k)).length;
  return queued + Math.max(0, open - 1);
}

export function clearDraftQueue(state: GameState): void {
  state.draftQueue = [];
}
