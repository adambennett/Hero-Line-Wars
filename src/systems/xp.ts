import {
  draftLevelPassives,
  killXpForEnemy,
  xpToNextLevel,
  type LevelPassiveId,
} from "../data/xp";
import { LEVEL_PASSIVES, isHeroPerkId } from "../data/xp";
import { HERO_PERKS } from "../data/heroPerks";
import { draftRelicChoices } from "../data/relics";
import {
  draftUtilities,
  UTILITY_DRAFT_AT_RUN_START,
} from "../data/utilities";
import type { EnemyUnit, GameState } from "../game/state";
import { isBossKind, isEliteKind } from "../data/enemies";
import { hasRelic } from "./relics";
import { hasDraftPending, openOrQueueDraft, syncDraftFlags } from "./drafts";
import { applyHeroPerkOnChoose, perkEligibleForHero } from "./heroPerks";

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
  state.utilityDraftOffered = true;
  openOrQueueDraft(state, { kind: "utility", choices: draftUtilities(3) });
}

export function openUtilityDraft(state: GameState): void {
  if (!shouldOfferUtilityDraft(state)) return;
  state.utilityDraftOffered = true;
  openOrQueueDraft(state, { kind: "utility", choices: draftUtilities(3) });
}

export function tryLevelUp(state: GameState): void {
  while (state.xp >= xpToNextLevel(state.level)) {
    state.xp -= xpToNextLevel(state.level);
    state.level += 1;
    state.pendingLevelUps += 1;
  }
  // Drafts queue now, so a level-up earned mid-draft is never dropped.
  if (shouldOfferUtilityDraft(state)) {
    openUtilityDraft(state);
    return;
  }
  if (state.pendingLevelUps > 0) {
    openLevelDraft(state);
  }
}

export function openLevelDraft(state: GameState): void {
  if (state.pendingLevelUps <= 0) return;
  if (state.disableBonuses || (state.levelDraftSize ?? 0) <= 0) {
    state.pendingLevelUps = 0;
    return;
  }
  // One level draft per pending level-up — the queue must not double-offer.
  if (hasDraftPending(state, "level")) return;
  const size = levelDraftChoiceCount(state);
  openOrQueueDraft(state, {
    kind: "level",
    choices: draftLevelPassives(size, state.hero.heroId, state.contentFilters),
  });
  state.levelDraftsTaken += 1;
}

export function rerollLevelDraft(state: GameState): boolean {
  if (!state.levelDraft) return false;
  if (state.rerollTokens <= 0) return false;
  state.rerollTokens -= 1;
  state.levelDraft = draftLevelPassives(
    levelDraftChoiceCount(state),
    state.hero.heroId,
    state.contentFilters,
  );
  return true;
}

export function rerollRelicDraft(state: GameState): boolean {
  if (!state.relicDraft) return false;
  if (state.rerollTokens <= 0) return false;
  state.rerollTokens -= 1;
  state.relicDraft = draftRelicChoices(
    state.relics,
    state.relicDraftSize ?? 3,
    state.contentFilters,
  );
  return true;
}

export function applyLevelPassive(state: GameState, id: LevelPassiveId): void {
  if (isHeroPerkId(id)) {
    const def = HERO_PERKS[id];
    if (!def || !perkEligibleForHero(id, state.hero.heroId)) return;
    applyHeroPerkOnChoose(state, def);
    state.levelPassives.push(id);
    state.toast = `Level ${state.level}: ${def.name}`;
    state.toastTimer = 2;
    return;
  }
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
    case "thick_hide":
      state.hero.maxHp += 22;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 22);
      break;
    case "keen_eye":
      state.hero.damageBonus += 4;
      break;
    case "sprint_laces":
      state.hero.speedBonus += 25;
      break;
    case "coin_purse":
      state.incomePerSec += 0.25;
      break;
    case "second_wind":
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 40);
      break;
    case "honed_edge":
      state.hero.damageBonus += 5;
      break;
    case "quick_hands":
      state.hero.attackSpeedMul *= 0.93;
      break;
    case "field_ration":
      state.hero.maxHp += 18;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 18);
      break;
    case "steady_aim":
      state.hero.luck += 0.05;
      break;
    case "scrap_scavenger":
      state.hero.killGoldBonus += 1;
      break;
    case "iron_soles":
      state.hero.speedBonus += 18;
      state.hero.maxHp += 10;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 10);
      break;
    case "blood_warmth":
      state.hero.maxHp += 15;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 15);
      state.hero.damageBonus += 3;
      break;
    case "bounty_scrap":
      state.incomePerSec += 0.15;
      state.gold += 12;
      break;
    case "light_step":
      state.hero.speedBonus += 20;
      break;
    case "ranged_focus":
      state.hero.damageBonus += 3;
      state.hero.attackSpeedMul *= 0.95;
      break;
    case "calloused":
      state.hero.maxHp += 25;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 25);
      break;
    case "war_tax":
      state.incomePerSec += 0.65;
      state.hero.damageBonus += 8;
      break;
    case "bulwark_frame":
      state.hero.maxHp += 50;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 50);
      break;
    case "adrenaline_surge":
      state.hero.attackSpeedMul *= 0.85;
      state.hero.speedBonus += 40;
      break;
    case "crit_lattice":
      state.hero.luck += 0.14;
      break;
    case "gold_vein":
      state.hero.killGoldBonus += 2;
      state.incomePerSec += 0.4;
      break;
    case "apex_tempo":
      state.hero.attackSpeedMul *= 0.8;
      state.hero.damageBonus += 10;
      break;
    case "phoenix_sinew":
      state.hero.maxHp += 70;
      state.hero.hp = state.hero.maxHp;
      state.hero.speedBonus += 25;
      break;
    case "siege_blood":
      state.hero.damageBonus += 18;
      state.hero.killGoldBonus += 1.5;
      break;
    case "fortune_engine":
      state.incomePerSec += 1.1;
      break;
    case "ghost_stride":
      state.hero.speedBonus += 70;
      state.hero.attackSpeedMul *= 0.9;
      break;
    case "godfall_edge":
      state.hero.damageBonus += 30;
      state.hero.luck += 0.18;
      break;
    case "immortal_grove":
      state.hero.maxHp += 100;
      state.hero.hp = state.hero.maxHp;
      state.incomePerSec += 0.5;
      break;
    case "treasury_core":
      state.incomePerSec += 1.6;
      state.hero.killGoldBonus += 3;
      break;
    case "void_reflex":
      state.hero.attackSpeedMul *= 0.72;
      state.hero.speedBonus += 55;
      break;
    case "worldbreaker":
      state.hero.damageBonus += 22;
      state.hero.maxHp += 45;
      state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 45);
      state.hero.attackSpeedMul *= 0.88;
      break;
  }
  state.levelPassives.push(id);
  state.toast = `Level ${state.level}: ${LEVEL_PASSIVES[id].name}`;
  state.toastTimer = 2;
}

export function skipLevelDraft(state: GameState): void {
  if (!state.levelDraft) return;
  state.levelDraft = null;
  state.pendingLevelUps = Math.max(0, state.pendingLevelUps - 1);
  if (state.pendingLevelUps > 0) {
    openLevelDraft(state);
  } else {
    syncDraftFlags(state);
  }
  state.toast = "Level bonus skipped";
  state.toastTimer = 1.2;
}

export function chooseLevelPassive(state: GameState, id: LevelPassiveId): void {
  if (!state.levelDraft?.includes(id)) return;
  if (!perkEligibleForHero(id, state.hero.heroId)) return;
  applyLevelPassive(state, id);
  state.levelDraft = null;
  state.pendingLevelUps = Math.max(0, state.pendingLevelUps - 1);
  if (state.pendingLevelUps > 0) {
    openOrQueueDraft(state, {
      kind: "level",
      choices: draftLevelPassives(levelDraftChoiceCount(state), state.hero.heroId),
    });
    state.levelDraftsTaken += 1;
  } else {
    syncDraftFlags(state);
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
