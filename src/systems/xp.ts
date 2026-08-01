import {
  draftLevelPassives,
  killXpForEnemy,
  xpToNextLevel,
  type LevelPassiveId,
} from "../data/xp";
import { LEVEL_PASSIVES } from "../data/xp";
import { draftRelicChoices } from "../data/relics";
import {
  draftUtilities,
  UTILITY_DRAFT_AT_RUN_START,
} from "../data/utilities";
import type { EnemyUnit, GameState } from "../game/state";
import { isBossKind, isEliteKind } from "../data/enemies";
import { hasRelic } from "./relics";

function levelDraftChoiceCount(state: GameState): number {
  return (state.levelDraftSize ?? 3) + (hasRelic(state, "draft_sage") ? 1 : 0);
}

export function grantKillXp(state: GameState, e: EnemyUnit): void {
  const kindWeight =
    e.kind === "boss" || isBossKind(e.kind)
      ? 2.2
      : e.kind === "elite" || isEliteKind(e.kind)
        ? 1.6
        : e.kind === "brute"
          ? 1.2
          : 1;
  let xp = killXpForEnemy(e.goldReward, kindWeight);
  // Luck passive: small XP bonus
  xp = Math.round(xp * (1 + state.hero.luck * 0.15));

  let mul = 1;
  if (hasRelic(state, "level_torrent")) mul += 0.15;
  if (hasRelic(state, "mentor_sigil")) mul += 0.12;
  if (hasRelic(state, "scholar_band")) mul += 0.08;
  if (hasRelic(state, "ascent_primer")) mul += 0.22;
  if ((state.shopOwned.xp_primer ?? 0) > 0) mul += 0.12;
  if ((state.shopOwned.mentor_tome ?? 0) > 0) mul += 0.18;
  if ((state.shopOwned.scholar_lens ?? 0) > 0) mul += 0.1;
  xp = Math.round(xp * mul);

  state.xp += xp;
  tryLevelUp(state);
}

export function shouldOfferUtilityDraft(state: GameState): boolean {
  return (
    !state.utilityId &&
    !state.utilityDraftOffered &&
    state.utilityDraftLevel > 0 &&
    state.level >= state.utilityDraftLevel
  );
}

/** Prompt at beginRun when utilityDraftLevel === Run Start (−1). */
export function openRunStartUtilityDraft(state: GameState): void {
  if (state.utilityDraftLevel !== UTILITY_DRAFT_AT_RUN_START) return;
  if (state.utilityId || state.utilityDraftOffered || state.utilityDraft) return;
  state.utilityDraft = draftUtilities(3);
  state.utilityDraftOffered = true;
  state.pausedForDraft = true;
  state.draftKind = "utility";
}

export function openUtilityDraft(state: GameState): void {
  if (!shouldOfferUtilityDraft(state)) return;
  state.utilityDraft = draftUtilities(3);
  state.utilityDraftOffered = true;
  state.pausedForDraft = true;
  state.draftKind = "utility";
}

function tryLevelUp(state: GameState): void {
  while (state.xp >= xpToNextLevel(state.level)) {
    state.xp -= xpToNextLevel(state.level);
    state.level += 1;
    state.pendingLevelUps += 1;
  }
  if (state.pausedForDraft) return;
  if (shouldOfferUtilityDraft(state)) {
    openUtilityDraft(state);
    return;
  }
  if (state.pendingLevelUps > 0 && !state.levelDraft) {
    openLevelDraft(state);
  }
}

export function openLevelDraft(state: GameState): void {
  if (state.pendingLevelUps <= 0) return;
  const size = levelDraftChoiceCount(state);
  state.levelDraft = draftLevelPassives(size);
  state.pausedForDraft = true;
  state.draftKind = "level";
  state.levelDraftsTaken += 1;
}

export function rerollLevelDraft(state: GameState): boolean {
  if (!state.levelDraft) return false;
  if (state.rerollTokens <= 0) return false;
  state.rerollTokens -= 1;
  state.levelDraft = draftLevelPassives(levelDraftChoiceCount(state));
  return true;
}

export function rerollRelicDraft(state: GameState): boolean {
  if (!state.relicDraft) return false;
  if (state.rerollTokens <= 0) return false;
  state.rerollTokens -= 1;
  state.relicDraft = draftRelicChoices(state.relics, state.relicDraftSize ?? 3);
  return true;
}

export function applyLevelPassive(state: GameState, id: LevelPassiveId): void {
  switch (id) {
    case "vitality":
      state.hero.maxHp += 30;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 30);
      break;
    case "might":
      state.hero.damageBonus += 6;
      break;
    case "haste":
      state.hero.speedBonus += 35;
      break;
    case "luck":
      state.hero.luck += 0.08;
      break;
    case "fury":
      state.hero.attackSpeedMul *= 0.9;
      break;
    case "fortune":
      state.incomePerSec += 0.35;
      break;
  }
  state.levelPassives.push(id);
  state.toast = `Level ${state.level}: ${LEVEL_PASSIVES[id].name}`;
  state.toastTimer = 2;
}

export function chooseLevelPassive(state: GameState, id: LevelPassiveId): void {
  if (!state.levelDraft?.includes(id)) return;
  applyLevelPassive(state, id);
  state.levelDraft = null;
  state.pendingLevelUps = Math.max(0, state.pendingLevelUps - 1);
  if (state.pendingLevelUps > 0) {
    state.levelDraft = draftLevelPassives(levelDraftChoiceCount(state));
    state.draftKind = "level";
    state.pausedForDraft = true;
    state.levelDraftsTaken += 1;
  } else if (state.relicDraft) {
    state.draftKind = "relic";
    state.pausedForDraft = true;
  } else {
    state.draftKind = null;
    state.pausedForDraft = false;
  }
}

export function xpProgress(state: GameState): { current: number; needed: number; ratio: number } {
  const needed = xpToNextLevel(state.level);
  return {
    current: state.xp,
    needed,
    ratio: needed > 0 ? Math.min(1, state.xp / needed) : 1,
  };
}
