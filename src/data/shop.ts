import { TURRET_DEFS, type TurretKind } from "./turrets";
import type { Rarity } from "./rarity";

export type ShopItemId =
  | "boots"
  | "blade"
  | "vitality"
  | "purse"
  | "greaves"
  | "razor"
  | "aegis"
  | "siphon"
  | "blueprint"
  | "war_banner"
  | "focus_lens"
  | "iron_mail"
  | "swift_quill"
  | "blood_charm"
  | "storm_core"
  | "apex_relic"
  | TurretKind;

export type ShopCategory = "gear" | "artifact";

export type ShopItemDef = {
  id: ShopItemId;
  name: string;
  cost: number;
  /** One-line effect for the shop panel. */
  effect: string;
  /** Max purchases this run (1 = unique). */
  maxStacks: number;
  category: ShopCategory;
  rarity: Rarity;
};

export const SHOP_ITEMS: ShopItemDef[] = [
  {
    id: "boots",
    name: "Swift Boots",
    cost: 35,
    effect: "+45 move speed",
    maxStacks: 2,
    category: "gear",
    rarity: "common",
  },
  {
    id: "blade",
    name: "Honed Blade",
    cost: 45,
    effect: "+7 attack damage",
    maxStacks: 3,
    category: "gear",
    rarity: "common",
  },
  {
    id: "vitality",
    name: "Vitality Charm",
    cost: 40,
    effect: "+25 max HP (heals 25)",
    maxStacks: 3,
    category: "gear",
    rarity: "common",
  },
  {
    id: "purse",
    name: "Coin Purse",
    cost: 70,
    effect: "+0.8 gold/sec income",
    maxStacks: 2,
    category: "gear",
    rarity: "uncommon",
  },
  {
    id: "greaves",
    name: "War Greaves",
    cost: 55,
    effect: "+30 speed, +10 max HP",
    maxStacks: 2,
    category: "gear",
    rarity: "uncommon",
  },
  {
    id: "razor",
    name: "Razor Quill",
    cost: 60,
    effect: "+5 damage, attacks 8% faster",
    maxStacks: 2,
    category: "gear",
    rarity: "uncommon",
  },
  {
    id: "aegis",
    name: "Base Aegis",
    cost: 65,
    effect: "Base +20 HP (repairs 20)",
    maxStacks: 2,
    category: "gear",
    rarity: "uncommon",
  },
  {
    id: "siphon",
    name: "Kill Siphon",
    cost: 50,
    effect: "+2 gold per enemy kill",
    maxStacks: 3,
    category: "gear",
    rarity: "common",
  },
  {
    id: "blueprint",
    name: "Blueprint Scroll",
    cost: 75,
    effect: "Base upgrades cost 20% less",
    maxStacks: 1,
    category: "gear",
    rarity: "rare",
  },
  {
    id: "war_banner",
    name: "War Banner",
    cost: 90,
    effect: "+0.25 income per base level (applies now + on upgrades)",
    maxStacks: 1,
    category: "gear",
    rarity: "rare",
  },
  {
    id: "focus_lens",
    name: "Focus Lens",
    cost: 80,
    effect: "+12% crit chance",
    maxStacks: 2,
    category: "gear",
    rarity: "rare",
  },
  {
    id: "iron_mail",
    name: "Iron Mail",
    cost: 70,
    effect: "+40 max HP (heals 20)",
    maxStacks: 2,
    category: "gear",
    rarity: "uncommon",
  },
  {
    id: "swift_quill",
    name: "Swift Quill",
    cost: 85,
    effect: "Attacks 12% faster",
    maxStacks: 2,
    category: "gear",
    rarity: "rare",
  },
  {
    id: "blood_charm",
    name: "Blood Charm",
    cost: 110,
    effect: "+10 damage, +15 max HP",
    maxStacks: 1,
    category: "gear",
    rarity: "mythic",
  },
  {
    id: "storm_core",
    name: "Storm Core",
    cost: 130,
    effect: "+1.0 gold/sec and +8 damage",
    maxStacks: 1,
    category: "gear",
    rarity: "mythic",
  },
  {
    id: "apex_relic",
    name: "Apex Shard",
    cost: 180,
    effect: "+18 damage, +30 max HP, +0.5 income",
    maxStacks: 1,
    category: "gear",
    rarity: "legendary",
  },
  {
    id: "ballista",
    name: TURRET_DEFS.ballista.name,
    cost: TURRET_DEFS.ballista.cost,
    effect: TURRET_DEFS.ballista.effect,
    maxStacks: 3,
    category: "artifact",
    rarity: "rare",
  },
  {
    id: "brazier",
    name: TURRET_DEFS.brazier.name,
    cost: TURRET_DEFS.brazier.cost,
    effect: TURRET_DEFS.brazier.effect,
    maxStacks: 3,
    category: "artifact",
    rarity: "rare",
  },
  {
    id: "hex_totem",
    name: TURRET_DEFS.hex_totem.name,
    cost: TURRET_DEFS.hex_totem.cost,
    effect: TURRET_DEFS.hex_totem.effect,
    maxStacks: 3,
    category: "artifact",
    rarity: "mythic",
  },
];

export const SHOP_OFFER_SIZE = 3;
/** Extra refreshes during an active wave (initial offer + 2 = 3 opportunities). */
export const SHOP_REFRESHES_PER_WAVE = 2;
/** Seconds between mid-wave shop refreshes while the wave is active. */
export const SHOP_REFRESH_INTERVAL_SEC = 10;

export function getShopItem(id: ShopItemId): ShopItemDef | undefined {
  return SHOP_ITEMS.find((i) => i.id === id);
}

export function isTurretArtifact(id: ShopItemId): id is TurretKind {
  return id === "ballista" || id === "brazier" || id === "hex_totem";
}

/** Roll a fresh offer of distinct items. Prefer not repeating the previous offer. */
export function rollShopOffer(previous: ShopItemId[] = []): ShopItemId[] {
  const pool = SHOP_ITEMS.map((i) => i.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const gear = pool.filter((id) => getShopItem(id)?.category === "gear");
  const arts = pool.filter((id) => getShopItem(id)?.category === "artifact");
  const preferGear = gear.filter((id) => !previous.includes(id));
  const preferArts = arts.filter((id) => !previous.includes(id));
  const out: ShopItemId[] = [];
  const gearSrc = preferGear.length >= 2 ? preferGear : gear;
  const artSrc = preferArts.length > 0 ? preferArts : arts;
  for (const id of gearSrc) {
    if (out.length >= SHOP_OFFER_SIZE - 1) break;
    out.push(id);
  }
  if (artSrc[0] && out.length < SHOP_OFFER_SIZE) out.push(artSrc[0]);
  for (const id of pool) {
    if (out.length >= SHOP_OFFER_SIZE) break;
    if (!out.includes(id)) out.push(id);
  }
  return out.slice(0, SHOP_OFFER_SIZE);
}
