/** StS-style campaign — branching map + run persistence. */

import type { HeroId } from "../data/heroes";
import type { RelicId } from "../data/relics";
import type { ShopItemId } from "../data/shop";
import { RELIC_LIST } from "../data/relics";
import type { GameTypeOptions } from "../meta/gameTypes";
import { defaultGameTypeOptions } from "../meta/gameTypes";

export type CampaignNodeKind =
  | "combat"
  | "elite"
  | "boss"
  | "shop"
  | "event"
  | "rest"
  | "chest";

export type CampaignNode = {
  id: string;
  act: 1 | 2 | 3;
  row: number;
  col: number;
  kind: CampaignNodeKind;
  next: string[];
};

export type CampaignAbilityUpgrade = {
  mobility: number;
  ultimate: number;
  passive: number;
};

export type CampaignRun = {
  heroId: HeroId;
  seed: number;
  /** Persisted base HP across combats. */
  baseHp: number;
  baseMaxHp: number;
  /** Shop currency (not in-combat gold). */
  coins: number;
  relics: RelicId[];
  /** Temp gear for next combat only. */
  tempItems: ShopItemId[];
  rerollTokens: number;
  abilityUpgrades: CampaignAbilityUpgrade;
  /** Permanent combat-start bonuses. */
  perks: string[];
  map: CampaignNode[];
  /**
   * Node the player last *completed*. Paths branch from here.
   * Combat does not update this until the fight is won.
   */
  currentNodeId: string | null;
  /**
   * Combat node in progress (checkpoint). Quit mid-fight keeps this set so
   * resume restarts the same battle without advancing the map.
   */
  activeCombatNodeId: string | null;
  /** Map locked for the active/last fight (prevents re-roll on resume). */
  combatMapId: string | null;
  /** Predetermined chest relic shown before take/skip. */
  pendingChestRelicId: RelicId | null;
  /** Run options from lobby game type (partial snapshot). */
  gameTypeOptions: GameTypeOptions;
  visited: string[];
  act: 1 | 2 | 3;
  alive: boolean;
  won: boolean;
};

export type CampaignEventChoice = {
  id: string;
  label: string;
  blurb: string;
};

const START_BASE_HP = 120;
const CAMPAIGN_SAVE_KEY = "hlw-campaign-run-v1";

export function createCampaignRun(
  heroId: HeroId,
  gameTypeOptions: GameTypeOptions = defaultGameTypeOptions(),
  seed = (Math.random() * 1e9) | 0,
): CampaignRun {
  const map = generateCampaignMap(seed);
  const start = map.find((n) => n.act === 1 && n.row === 0)!;
  return {
    heroId,
    seed,
    baseHp: START_BASE_HP,
    baseMaxHp: START_BASE_HP,
    coins: 40,
    relics: [],
    tempItems: [],
    rerollTokens: 0,
    abilityUpgrades: { mobility: 0, ultimate: 0, passive: 0 },
    perks: [],
    map,
    currentNodeId: start.id,
    activeCombatNodeId: null,
    combatMapId: null,
    pendingChestRelicId: null,
    gameTypeOptions: { ...gameTypeOptions },
    visited: [start.id],
    act: 1,
    alive: true,
    won: false,
  };
}

export function saveCampaignRun(run: CampaignRun | null): void {
  try {
    if (!run) {
      localStorage.removeItem(CAMPAIGN_SAVE_KEY);
      return;
    }
    localStorage.setItem(CAMPAIGN_SAVE_KEY, JSON.stringify(run));
  } catch {
    /* ignore */
  }
}

export function loadCampaignRun(): CampaignRun | null {
  try {
    const raw = localStorage.getItem(CAMPAIGN_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CampaignRun;
    if (!parsed || !parsed.heroId || !Array.isArray(parsed.map)) return null;
    if (!parsed.gameTypeOptions) parsed.gameTypeOptions = defaultGameTypeOptions();
    if (parsed.activeCombatNodeId === undefined) parsed.activeCombatNodeId = null;
    if (parsed.combatMapId === undefined) parsed.combatMapId = null;
    if (parsed.pendingChestRelicId === undefined) parsed.pendingChestRelicId = null;
    return parsed;
  } catch {
    return null;
  }
}

function mulberry32(a: number): () => number {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 3 acts × ~6 rows of branching nodes ending in a boss. */
export function generateCampaignMap(seed: number): CampaignNode[] {
  const rand = mulberry32(seed);
  const nodes: CampaignNode[] = [];
  let id = 0;
  const nid = () => `n${id++}`;

  for (let act = 1 as 1 | 2 | 3; act <= 3; act = (act + 1) as 1 | 2 | 3) {
    const rows = 6;
    const rowNodes: string[][] = [];
    for (let row = 0; row < rows; row++) {
      const cols = row === 0 || row === rows - 1 ? 1 : 2 + Math.floor(rand() * 2);
      const kinds: CampaignNodeKind[] = [];
      for (let c = 0; c < cols; c++) {
        if (row === 0) kinds.push("combat");
        else if (row === rows - 1) kinds.push("boss");
        else if (row === rows - 2) kinds.push(rand() < 0.5 ? "elite" : "combat");
        else {
          const roll = rand();
          if (roll < 0.35) kinds.push("combat");
          else if (roll < 0.5) kinds.push("elite");
          else if (roll < 0.62) kinds.push("shop");
          else if (roll < 0.74) kinds.push("event");
          else if (roll < 0.86) kinds.push("rest");
          else kinds.push("chest");
        }
      }
      const ids: string[] = [];
      kinds.forEach((kind, col) => {
        const node: CampaignNode = {
          id: nid(),
          act,
          row,
          col,
          kind,
          next: [],
        };
        nodes.push(node);
        ids.push(node.id);
      });
      rowNodes.push(ids);
    }
    for (let row = 0; row < rows - 1; row++) {
      const cur = rowNodes[row]!;
      const nxt = rowNodes[row + 1]!;
      for (let i = 0; i < cur.length; i++) {
        const from = nodes.find((n) => n.id === cur[i]!)!;
        const targets = new Set<string>();
        targets.add(nxt[Math.min(i, nxt.length - 1)]!);
        if (nxt.length > 1) targets.add(nxt[Math.floor(rand() * nxt.length)]!);
        from.next = [...targets];
      }
      for (const tid of nxt) {
        if (!nodes.some((n) => n.next.includes(tid))) {
          const donor = nodes.find((n) => n.id === cur[Math.floor(rand() * cur.length)]!)!;
          donor.next.push(tid);
        }
      }
    }
  }

  for (let act = 1; act <= 2; act++) {
    const bosses = nodes.filter((n) => n.act === act && n.kind === "boss");
    const nextStarts = nodes.filter((n) => n.act === act + 1 && n.row === 0);
    for (const b of bosses) {
      b.next = nextStarts.map((n) => n.id);
    }
  }

  return nodes;
}

export function campaignNode(run: CampaignRun, id: string | null): CampaignNode | null {
  if (!id) return null;
  return run.map.find((n) => n.id === id) ?? null;
}

export function availableNext(run: CampaignRun): CampaignNode[] {
  // While a combat is checkpointed, only that node is "next" (resume).
  if (run.activeCombatNodeId) {
    const n = campaignNode(run, run.activeCombatNodeId);
    return n ? [n] : [];
  }
  const cur = campaignNode(run, run.currentNodeId);
  if (!cur) return [];
  return cur.next
    .map((id) => campaignNode(run, id))
    .filter((n): n is CampaignNode => !!n);
}

export function advanceTo(run: CampaignRun, nodeId: string): void {
  run.currentNodeId = nodeId;
  if (!run.visited.includes(nodeId)) run.visited.push(nodeId);
  const n = campaignNode(run, nodeId);
  if (n) run.act = n.act;
}

/** Mark combat checkpoint without advancing path. */
export function beginCombatCheckpoint(run: CampaignRun, nodeId: string): void {
  run.activeCombatNodeId = nodeId;
  saveCampaignRun(run);
}

/** Victory: advance path, clear combat checkpoint. */
export function completeCombatNode(run: CampaignRun, nodeId: string): void {
  run.activeCombatNodeId = null;
  run.combatMapId = null;
  advanceTo(run, nodeId);
  saveCampaignRun(run);
}

/** Quit mid-fight: leave active combat so player can resume; do not advance. */
export function abortCombatKeepCheckpoint(run: CampaignRun): void {
  saveCampaignRun(run);
}

export function rollPendingChestRelic(run: CampaignRun): RelicId | null {
  const pool = RELIC_LIST.filter((r) => !run.relics.includes(r.id));
  if (!pool.length) {
    run.pendingChestRelicId = null;
    return null;
  }
  const pick = pool[Math.floor(Math.random() * pool.length)]!;
  run.pendingChestRelicId = pick.id;
  return pick.id;
}

export const CAMPAIGN_EVENTS: {
  id: string;
  title: string;
  body: string;
  choices: CampaignEventChoice[];
  apply: (run: CampaignRun, choiceId: string) => string;
}[] = [
  {
    id: "forked_well",
    title: "Forked Well",
    body: "A Forerunner cistern hums. Drink deep, or bottle a draft for later.",
    choices: [
      { id: "drink", label: "Drink", blurb: "Heal 28 base HP." },
      { id: "bottle", label: "Bottle", blurb: "+18 coins, slight HP loss." },
      { id: "leave", label: "Leave", blurb: "Nothing happens." },
    ],
    apply: (run, c) => {
      if (c === "drink") {
        run.baseHp = Math.min(run.baseMaxHp, run.baseHp + 28);
        return "The well mends your keep.";
      }
      if (c === "bottle") {
        run.coins += 18;
        run.baseHp = Math.max(20, run.baseHp - 8);
        return "You sell the draft for coin.";
      }
      return "You walk on.";
    },
  },
  {
    id: "wandering_smith",
    title: "Wandering Smith",
    body: "A smith offers to temper one of your abilities — or sell you scrap.",
    choices: [
      { id: "mobility", label: "Temper mobility", blurb: "+1 mobility upgrade." },
      { id: "ultimate", label: "Temper ultimate", blurb: "+1 ultimate upgrade." },
      { id: "scrap", label: "Buy scrap", blurb: "+25 coins." },
    ],
    apply: (run, c) => {
      if (c === "mobility") {
        run.abilityUpgrades.mobility += 1;
        return "Your mobility sings.";
      }
      if (c === "ultimate") {
        run.abilityUpgrades.ultimate += 1;
        return "Your ultimate hardens.";
      }
      run.coins += 25;
      return "Pocketed scrap coin.";
    },
  },
  {
    id: "cursed_idol",
    title: "Cursed Idol",
    body: "Touching it promises power. Ignoring it keeps you whole.",
    choices: [
      { id: "touch", label: "Touch", blurb: "Random relic; −20 base HP." },
      { id: "smash", label: "Smash", blurb: "+35 coins." },
      { id: "pass", label: "Pass", blurb: "Safe." },
    ],
    apply: (run, c) => {
      if (c === "touch") {
        const pool = RELIC_LIST.filter((r) => !run.relics.includes(r.id));
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (pick) run.relics.push(pick.id);
        run.baseHp = Math.max(15, run.baseHp - 20);
        return pick ? `Gained ${pick.name}.` : "The idol is empty.";
      }
      if (c === "smash") {
        run.coins += 35;
        return "Coin spills from the rubble.";
      }
      return "You leave the idol alone.";
    },
  },
];

export function rollCombatRewards(
  _run: CampaignRun,
  kind: "combat" | "elite" | "boss",
): {
  coins: number;
  rerollTokens: number;
  tempItem: ShopItemId | null;
  heal: number;
} {
  const base = kind === "boss" ? 55 : kind === "elite" ? 38 : 24;
  const coins = base + Math.floor(Math.random() * 12);
  let rerollTokens = 0;
  let tempItem: ShopItemId | null = null;
  let heal = 0;
  if (Math.random() < (kind === "combat" ? 0.22 : 0.4)) rerollTokens = 1;
  if (Math.random() < (kind === "combat" ? 0.28 : 0.45)) {
    const temps: ShopItemId[] = ["blade", "boots", "vitality", "whetstone", "jade_anklet"];
    tempItem = temps[Math.floor(Math.random() * temps.length)]!;
  }
  const healChance = kind === "boss" ? 0.28 : kind === "elite" ? 0.18 : 0.08;
  if (Math.random() < healChance) heal = kind === "boss" ? 22 : 14;
  return { coins, rerollTokens, tempItem, heal };
}

export function applyCombatRewards(
  run: CampaignRun,
  reward: ReturnType<typeof rollCombatRewards>,
): void {
  run.coins += reward.coins;
  run.rerollTokens += reward.rerollTokens;
  if (reward.tempItem) run.tempItems.push(reward.tempItem);
  if (reward.heal > 0) run.baseHp = Math.min(run.baseMaxHp, run.baseHp + reward.heal);
}

export const CAMPAIGN_SHOP: {
  id: string;
  name: string;
  cost: number;
  blurb: string;
  apply: (r: CampaignRun) => void;
}[] = [
  {
    id: "keep_plate",
    name: "Keep Plate",
    cost: 45,
    blurb: "+20 max base HP and repair 20.",
    apply: (r) => {
      r.baseMaxHp += 20;
      r.baseHp = Math.min(r.baseMaxHp, r.baseHp + 20);
    },
  },
  {
    id: "war_coin",
    name: "War Stipend",
    cost: 35,
    blurb: "Start each combat with +30 gold (perk).",
    apply: (r) => {
      if (!r.perks.includes("start_gold_30")) r.perks.push("start_gold_30");
    },
  },
  {
    id: "drill_mobility",
    name: "Mobility Drill",
    cost: 40,
    blurb: "+1 mobility upgrade.",
    apply: (r) => {
      r.abilityUpgrades.mobility += 1;
    },
  },
  {
    id: "drill_ult",
    name: "Ultimate Drill",
    cost: 50,
    blurb: "+1 ultimate upgrade.",
    apply: (r) => {
      r.abilityUpgrades.ultimate += 1;
    },
  },
  {
    id: "reroll_pack",
    name: "Reroll Pack",
    cost: 30,
    blurb: "+2 combat reroll tokens.",
    apply: (r) => {
      r.rerollTokens += 2;
    },
  },
];
