/**
 * Per-controller economy / progression for shared-lane MP.
 * Physical lane (enemies, base, map, curses-on-lane) stays shared;
 * gold, shop, relics, XP drafts, utility, and sends are per player.
 */
import type { CurseId } from "../data/curses";
import type { RelicId } from "../data/relics";
import type { ShopItemId } from "../data/shop";
import type { UtilityId } from "../data/utilities";
import type { LevelPassiveId } from "../data/xp";
import type { BaseBranchId, BaseBranchMods } from "../data/baseBranches";
import { emptyBranchMods } from "../data/baseBranches";
import { rollShopOffer } from "../data/shop";
import type { ChestRewardOption, GameState, HeroRuntime } from "../game/state";

export type PlayerBag = {
  gold: number;
  incomePerSec: number;
  shopOpen: boolean;
  nearShop: boolean;
  wasNearShop: boolean;
  shopOwned: Partial<Record<ShopItemId, number>>;
  shopOffer: ShopItemId[];
  shopRefreshesLeft: number;
  shopRefreshTimer: number;
  shopFrozen: boolean;
  relics: RelicId[];
  relicDraft: RelicId[] | null;
  level: number;
  xp: number;
  pendingLevelUps: number;
  levelDraft: LevelPassiveId[] | null;
  levelPassives: LevelPassiveId[];
  draftKind: GameState["draftKind"];
  pausedForDraft: boolean;
  pendingRelicDraft: boolean;
  rerollTokens: number;
  sendsThisRun: number;
  utilityId: UtilityId | null;
  utilityCd: number;
  utilityDraft: UtilityId[] | null;
  utilityDraftOffered: boolean;
  curseDraft: CurseId[] | null;
  chestDraft: ChestRewardOption[] | null;
  baseBranchDraft: BaseBranchId[] | null;
  baseBranches: BaseBranchId[];
  baseBranchMods: BaseBranchMods;
  pendingBaseBranch: boolean;
  utilityIncomeBoost: number;
  utilityIncomeAmount: number;
  utilityTurretBoost: number;
  utilitySendDiscount: boolean;
  utilitySprintTimer: number;
  utilityDamageBoost: number;
  utilityBountyKills: number;
  goldFromIncome: number;
  goldSpent: number;
  peakGold: number;
  peakIncome: number;
  shopBuys: number;
  levelDraftsTaken: number;
  phoenixCharges: number;
  /** Rewards earned while another draft of the same kind was open. */
  draftQueue: import("../systems/drafts").PendingDraft[];
};

const BAG_KEYS: (keyof PlayerBag)[] = [
  "gold",
  "incomePerSec",
  "shopOpen",
  "nearShop",
  "wasNearShop",
  "shopOwned",
  "shopOffer",
  "shopRefreshesLeft",
  "shopRefreshTimer",
  "shopFrozen",
  "relics",
  "relicDraft",
  "level",
  "xp",
  "pendingLevelUps",
  "levelDraft",
  "levelPassives",
  "draftKind",
  "pausedForDraft",
  "pendingRelicDraft",
  "rerollTokens",
  "sendsThisRun",
  "utilityId",
  "utilityCd",
  "utilityDraft",
  "utilityDraftOffered",
  "curseDraft",
  "chestDraft",
  "baseBranchDraft",
  "baseBranches",
  "baseBranchMods",
  "pendingBaseBranch",
  "utilityIncomeBoost",
  "utilityIncomeAmount",
  "utilityTurretBoost",
  "utilitySendDiscount",
  "utilitySprintTimer",
  "utilityDamageBoost",
  "utilityBountyKills",
  "goldFromIncome",
  "goldSpent",
  "peakGold",
  "peakIncome",
  "shopBuys",
  "levelDraftsTaken",
  "phoenixCharges",
  "draftQueue",
];

export function bagKey(slot: number): string {
  return String(slot);
}

export function createPlayerBag(from: GameState): PlayerBag {
  return {
    gold: from.gold,
    incomePerSec: from.incomePerSec,
    shopOpen: false,
    nearShop: false,
    wasNearShop: false,
    shopOwned: {},
    shopOffer: rollShopOffer(),
    shopRefreshesLeft: from.shopRefreshesLeft,
    shopRefreshTimer: from.shopRefreshTimer,
    shopFrozen: false,
    relics: [],
    relicDraft: null,
    level: 1,
    xp: 0,
    pendingLevelUps: 0,
    levelDraft: null,
    levelPassives: [],
    draftKind: null,
    pausedForDraft: false,
    pendingRelicDraft: false,
    rerollTokens: from.rerollTokens,
    sendsThisRun: 0,
    utilityId: null,
    utilityCd: 0,
    utilityDraft: null,
    utilityDraftOffered: false,
    curseDraft: null,
    chestDraft: null,
    baseBranchDraft: null,
    baseBranches: [],
    baseBranchMods: emptyBranchMods(),
    pendingBaseBranch: false,
    utilityIncomeBoost: 0,
    utilityIncomeAmount: 0,
    utilityTurretBoost: 0,
    utilitySendDiscount: false,
    utilitySprintTimer: 0,
    utilityDamageBoost: 0,
    utilityBountyKills: 0,
    goldFromIncome: 0,
    goldSpent: 0,
    peakGold: from.gold,
    peakIncome: from.incomePerSec,
    shopBuys: 0,
    levelDraftsTaken: 0,
    phoenixCharges: 0,
    draftQueue: [],
  };
}

/** Snapshot lane economy fields into a bag (used when seeding primary). */
export function captureBagFromState(state: GameState): PlayerBag {
  const bag = createPlayerBag(state);
  for (const k of BAG_KEYS) {
    const v = state[k as keyof GameState];
    (bag as Record<string, unknown>)[k] = Array.isArray(v)
      ? [...(v as unknown[])]
      : v && typeof v === "object"
        ? { ...(v as object) }
        : v;
  }
  return bag;
}

function writeBagToState(state: GameState, bag: PlayerBag): void {
  for (const k of BAG_KEYS) {
    const v = bag[k];
    (state as unknown as Record<string, unknown>)[k] = Array.isArray(v)
      ? [...(v as unknown[])]
      : v && typeof v === "object"
        ? { ...(v as object) }
        : v;
  }
}

function readBagFromState(state: GameState, bag: PlayerBag): void {
  for (const k of BAG_KEYS) {
    const v = state[k as keyof GameState];
    (bag as Record<string, unknown>)[k] = Array.isArray(v)
      ? [...(v as unknown[])]
      : v && typeof v === "object"
        ? { ...(v as object) }
        : v;
  }
}

export function ensureLaneBags(state: GameState, heroes: HeroRuntime[]): void {
  if (!state.playerBags) state.playerBags = {};
  for (const h of heroes) {
    const slot = h.controllerSlot;
    if (slot == null) continue;
    const key = bagKey(slot);
    if (!state.playerBags[key]) {
      state.playerBags[key] = createPlayerBag(state);
    }
  }
}

export function getBag(state: GameState, slot: number): PlayerBag | null {
  return state.playerBags?.[bagKey(slot)] ?? null;
}

/** Run fn with this controller's economy swapped onto lane state fields. */
export function withPlayerBag<T>(state: GameState, slot: number, fn: () => T): T {
  const bags = state.playerBags;
  if (!bags) return fn();
  const key = bagKey(slot);
  const bag = bags[key];
  if (!bag) return fn();

  const prevKey = state.activeBagKey ?? null;
  // Stash previous active bag if any
  if (prevKey != null && bags[prevKey] && prevKey !== key) {
    readBagFromState(state, bags[prevKey]!);
  }

  writeBagToState(state, bag);
  state.activeBagKey = key;
  try {
    return fn();
  } finally {
    readBagFromState(state, bag);
    if (prevKey != null && prevKey !== key && bags[prevKey]) {
      writeBagToState(state, bags[prevKey]!);
      state.activeBagKey = prevKey;
    } else {
      state.activeBagKey = key;
      // Leave this bag mirrored on state for HUD when it's the focus seat
      writeBagToState(state, bag);
    }
  }
}

/** True if any per-player bag (or lane) is paused on a draft. */
export function anyBagPausedForDraft(state: GameState): boolean {
  if (!state.playerBags) {
    return !!(
      state.pausedForDraft &&
      (state.relicDraft ||
        state.levelDraft ||
        state.utilityDraft ||
        state.curseDraft ||
        state.chestDraft ||
        state.baseBranchDraft)
    );
  }
  for (const bag of Object.values(state.playerBags)) {
    if (
      bag.pausedForDraft &&
      (bag.relicDraft ||
        bag.levelDraft ||
        bag.utilityDraft ||
        bag.curseDraft ||
        bag.chestDraft ||
        bag.baseBranchDraft)
    ) {
      return true;
    }
  }
  return false;
}

/** Mirror a seat's bag onto lane fields for HUD / snap of local view. */
export function focusBag(state: GameState, slot: number): void {
  const bag = getBag(state, slot);
  if (!bag) return;
  if (state.activeBagKey && state.playerBags?.[state.activeBagKey]) {
    readBagFromState(state, state.playerBags[state.activeBagKey]!);
  }
  writeBagToState(state, bag);
  state.activeBagKey = bagKey(slot);
}

export function serializeBags(
  bags: Record<string, PlayerBag> | undefined,
): Record<string, PlayerBag> | undefined {
  if (!bags) return undefined;
  const out: Record<string, PlayerBag> = {};
  for (const [k, bag] of Object.entries(bags)) {
    out[k] = {
      ...bag,
      shopOwned: { ...bag.shopOwned },
      shopOffer: [...bag.shopOffer],
      relics: [...bag.relics],
      relicDraft: bag.relicDraft ? [...bag.relicDraft] : null,
      levelDraft: bag.levelDraft ? [...bag.levelDraft] : null,
      levelPassives: [...bag.levelPassives],
      utilityDraft: bag.utilityDraft ? [...bag.utilityDraft] : null,
      curseDraft: bag.curseDraft ? [...bag.curseDraft] : null,
      chestDraft: bag.chestDraft ? bag.chestDraft.map((c) => ({ ...c })) : null,
      baseBranchDraft: bag.baseBranchDraft ? [...bag.baseBranchDraft] : null,
      baseBranches: [...bag.baseBranches],
      baseBranchMods: { ...bag.baseBranchMods },
      draftQueue: (bag.draftQueue ?? []).map((d) => ({ ...d })),
    };
  }
  return out;
}

export function applyBags(
  state: GameState,
  bags: Record<string, PlayerBag> | undefined,
  focusSlot?: number | null,
): void {
  if (!bags) return;
  state.playerBags = serializeBags(bags);
  if (focusSlot != null) focusBag(state, focusSlot);
}
