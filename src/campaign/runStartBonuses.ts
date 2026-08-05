/** Campaign run-start bonuses (pick 1 of 3 before the map opens). */

import type { CampaignRun } from "./run";

export type RunStartBonusId =
  | "steel_ration"
  | "blood_pact"
  | "gold_rush_start"
  | "glass_edge"
  | "sturdy_keep"
  | "lucky_start"
  | "scrapper";

export type RunStartBonusDef = {
  id: RunStartBonusId;
  name: string;
  blurb: string;
  /** Applied onto the run before map phase. */
  apply: (run: CampaignRun) => void;
};

export const RUN_START_BONUSES: RunStartBonusDef[] = [
  {
    id: "steel_ration",
    name: "Steel Ration",
    blurb: "+25 base HP now. −8 max base HP for the run.",
    apply: (run) => {
      run.baseMaxHp = Math.max(40, run.baseMaxHp - 8);
      run.baseHp = Math.min(run.baseMaxHp, run.baseHp + 25);
      run.perks.push("rsb_steel_ration");
    },
  },
  {
    id: "blood_pact",
    name: "Blood Pact",
    blurb: "+1 combat temp item next fight. −12 current base HP.",
    apply: (run) => {
      run.baseHp = Math.max(20, run.baseHp - 12);
      // Temp boots-style starter for next fight
      if (!run.tempItems.includes("blade" as import("../data/shop").ShopItemId)) {
        run.tempItems.push("blade" as import("../data/shop").ShopItemId);
      }
      run.perks.push("rsb_blood_pact");
    },
  },
  {
    id: "gold_rush_start",
    name: "Purse Advance",
    blurb: "+18 coins. Your first combat starts with −10 gold.",
    apply: (run) => {
      run.coins += 18;
      run.perks.push("rsb_gold_debt");
    },
  },
  {
    id: "glass_edge",
    name: "Glass Edge",
    blurb: "+2 damage starting next combat. −15 max base HP.",
    apply: (run) => {
      run.baseMaxHp = Math.max(40, run.baseMaxHp - 15);
      run.baseHp = Math.min(run.baseMaxHp, run.baseHp);
      run.perks.push("rsb_glass_edge");
    },
  },
  {
    id: "sturdy_keep",
    name: "Sturdy Keep",
    blurb: "+20 max & current base HP. −6 coins.",
    apply: (run) => {
      run.coins = Math.max(0, run.coins - 6);
      run.baseMaxHp += 20;
      run.baseHp = Math.min(run.baseMaxHp, run.baseHp + 20);
      run.perks.push("rsb_sturdy_keep");
    },
  },
  {
    id: "lucky_start",
    name: "Lucky Draw",
    blurb: "+1 reroll token. −10 current base HP.",
    apply: (run) => {
      run.rerollTokens += 1;
      run.baseHp = Math.max(20, run.baseHp - 10);
      run.perks.push("rsb_lucky_draw");
    },
  },
  {
    id: "scrapper",
    name: "Scrapper's Kit",
    blurb: "+12 coins and +8 base HP. Slight risk later.",
    apply: (run) => {
      run.coins += 12;
      run.baseHp = Math.min(run.baseMaxHp, run.baseHp + 8);
      run.perks.push("rsb_scrapper");
    },
  },
];

export function rollRunStartBonusChoices(seed: number, count = 3): RunStartBonusDef[] {
  // Deterministic-ish shuffle from seed
  const pool = [...RUN_START_BONUSES];
  let s = seed >>> 0 || 1;
  for (let i = pool.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count);
}

export function getRunStartBonus(id: string): RunStartBonusDef | undefined {
  return RUN_START_BONUSES.find((b) => b.id === id);
}
