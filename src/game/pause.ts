/**
 * Authoritative pause policy.
 *
 * Pause availability depends ONLY on how many HUMAN players are participating —
 * never on which simulation runs the lane (`game/state.ts` vs `net/mpSim.ts`),
 * whether the match is dual-lane, or whether PeerJS is connected.
 *
 * - Exactly one human  -> pausing is allowed (this includes offline solo runs
 *   that use `mpSim`: solo team modes, neural dual-lane, AI Lab).
 * - More than one human -> nothing may freeze the simulation: not Escape, not
 *   menus, not the bag, not reward drafts, not shops, not aim mechanics.
 *
 * Every pause path in the game must go through the predicates here.
 */
import type { GameState } from "./state";

export type PauseTarget =
  | GameState
  | { lanes: readonly [GameState, GameState] }
  | null
  | undefined;

function isMatchLike(t: object): t is { lanes: readonly [GameState, GameState] } {
  return Array.isArray((t as { lanes?: unknown }).lanes);
}

/** Distinct human controller seats sharing this lane (AI seats are negative / null). */
export function laneHumanSlots(state: GameState): number[] {
  const slots = new Set<number>();
  for (const h of [state.hero, ...(state.allies ?? [])]) {
    const slot = h?.controllerSlot;
    if (slot != null && slot >= 0) slots.add(slot);
  }
  return [...slots];
}

function laneHumanPlayers(state: GameState): number {
  const declared = state.humanPlayers;
  if (typeof declared === "number" && Number.isFinite(declared)) {
    return Math.max(1, Math.floor(declared));
  }
  return Math.max(1, laneHumanSlots(state).length);
}

/**
 * Humans participating in this game. Never returns less than 1 so that plain
 * singleplayer (no controller slots assigned at all) stays pausable.
 */
export function humanPlayerCount(target: PauseTarget): number {
  if (!target) return 1;
  if (isMatchLike(target)) {
    return Math.max(...target.lanes.map((lane) => laneHumanPlayers(lane)));
  }
  return laneHumanPlayers(target);
}

/** True when two or more humans share this game (online OR local). */
export function isMultiHumanGame(target: PauseTarget): boolean {
  return humanPlayerCount(target) > 1;
}

/** The one predicate every pause path consults. */
export function canPauseSimulation(target: PauseTarget): boolean {
  return humanPlayerCount(target) <= 1;
}

/** Reward drafts / bags may only hold the sim in single-human games. */
export function canPauseForDraft(target: PauseTarget): boolean {
  return canPauseSimulation(target);
}

/**
 * Hero mechanics that slow or freeze time to aim (e.g. a future sniper's
 * freeze-to-aim) must gate on this instead of testing for multiplayer.
 */
export function canFreezeForAim(target: PauseTarget): boolean {
  return canPauseSimulation(target);
}

/** Gameplay-altering cheats are only legal when a single human is playing. */
export function cheatsAllowedForPlayers(target: PauseTarget): boolean {
  return canPauseSimulation(target);
}
