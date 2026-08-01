/** Hex Storm curse choices — pick one to soft-lock the enemy lane. */

export type CurseId =
  | "lock_shop"
  | "lock_sends"
  | "lock_upgrades"
  | "income_tax"
  | "lane_fog"
  | "refresh_slow";

export type CurseDef = {
  id: CurseId;
  name: string;
  tag: string;
  blurb: string;
  shopBlock: number;
  sendBlock: number;
  upgradeBlock: number;
  incomeTaxMul: number;
  incomeTaxDuration: number;
  fogDuration: number;
  shopRefreshSlow: number;
  shopRefreshDuration: number;
};

export const CURSES: Record<CurseId, CurseDef> = {
  lock_shop: {
    id: "lock_shop",
    name: "Sealed Shelves",
    tag: "Shop",
    blurb: "Enemy cannot open their shop for 8s.",
    shopBlock: 8,
    sendBlock: 0,
    upgradeBlock: 0,
    incomeTaxMul: 1,
    incomeTaxDuration: 0,
    fogDuration: 0,
    shopRefreshSlow: 1,
    shopRefreshDuration: 0,
  },
  lock_sends: {
    id: "lock_sends",
    name: "Muted Horn",
    tag: "Sends",
    blurb: "Enemy cannot buy sends for 7s.",
    shopBlock: 0,
    sendBlock: 7,
    upgradeBlock: 0,
    incomeTaxMul: 1,
    incomeTaxDuration: 0,
    fogDuration: 0,
    shopRefreshSlow: 1,
    shopRefreshDuration: 0,
  },
  lock_upgrades: {
    id: "lock_upgrades",
    name: "Frozen Foundry",
    tag: "Base",
    blurb: "Enemy cannot upgrade their base for 9s.",
    shopBlock: 0,
    sendBlock: 0,
    upgradeBlock: 9,
    incomeTaxMul: 1,
    incomeTaxDuration: 0,
    fogDuration: 0,
    shopRefreshSlow: 1,
    shopRefreshDuration: 0,
  },
  income_tax: {
    id: "income_tax",
    name: "Blood Tithe",
    tag: "Income",
    blurb: "Enemy income cut to 45% for 10s.",
    shopBlock: 0,
    sendBlock: 0,
    upgradeBlock: 0,
    incomeTaxMul: 0.45,
    incomeTaxDuration: 10,
    fogDuration: 0,
    shopRefreshSlow: 1,
    shopRefreshDuration: 0,
  },
  lane_fog: {
    id: "lane_fog",
    name: "Hex Mist",
    tag: "Vision",
    blurb: "Blanket their lane in fog for 7s.",
    shopBlock: 0,
    sendBlock: 0,
    upgradeBlock: 0,
    incomeTaxMul: 1,
    incomeTaxDuration: 0,
    fogDuration: 7,
    shopRefreshSlow: 1,
    shopRefreshDuration: 0,
  },
  refresh_slow: {
    id: "refresh_slow",
    name: "Sticky Stock",
    tag: "Shop",
    blurb: "Enemy shop refreshes much slower for 10s.",
    shopBlock: 0,
    sendBlock: 0,
    upgradeBlock: 0,
    incomeTaxMul: 1,
    incomeTaxDuration: 0,
    fogDuration: 0,
    shopRefreshSlow: 2.2,
    shopRefreshDuration: 10,
  },
};

export const CURSE_LIST: CurseDef[] = Object.values(CURSES);

/** Draft 3 distinct curses for Hex Storm. */
export function draftCurseChoices(count = 3): CurseId[] {
  const pool = [...CURSE_LIST];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, Math.min(count, pool.length)).map((c) => c.id);
}
