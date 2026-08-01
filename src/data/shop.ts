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
  | "lucky_dice"
  | "copper_ring"
  | "leather_wrap"
  | "whetstone"
  | "traveler_cloak"
  | "merchant_seal"
  | "thorn_bracer"
  | "crystal_vial"
  | "scout_glass"
  | "iron_spikes"
  | "gold_magnet"
  | "berserker_tonic"
  | "guardian_crest"
  | "chrono_sand"
  | "phantom_ink"
  | "warhorn"
  | "soul_lantern"
  | "dragon_scale"
  | "void_splinter"
  | "king_scepter"
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
    id: "lucky_dice",
    name: "Lucky Dice",
    cost: 40,
    effect: "+6% crit chance",
    maxStacks: 3,
    category: "gear",
    rarity: "common",
  },
  {
    id: "copper_ring",
    name: "Copper Ring",
    cost: 30,
    effect: "+0.35 gold/sec income",
    maxStacks: 3,
    category: "gear",
    rarity: "common",
  },
  {
    id: "leather_wrap",
    name: "Leather Wrap",
    cost: 28,
    effect: "+20 move speed",
    maxStacks: 3,
    category: "gear",
    rarity: "common",
  },
  {
    id: "whetstone",
    name: "Whetstone",
    cost: 38,
    effect: "+4 attack damage",
    maxStacks: 4,
    category: "gear",
    rarity: "common",
  },
  {
    id: "traveler_cloak",
    name: "Traveler Cloak",
    cost: 50,
    effect: "+25 speed, +8 max HP",
    maxStacks: 2,
    category: "gear",
    rarity: "uncommon",
  },
  {
    id: "merchant_seal",
    name: "Merchant Seal",
    cost: 85,
    effect: "Shop prices −8%",
    maxStacks: 1,
    category: "gear",
    rarity: "rare",
  },
  {
    id: "thorn_bracer",
    name: "Thorn Bracer",
    cost: 55,
    effect: "+3 damage, +12 max HP",
    maxStacks: 2,
    category: "gear",
    rarity: "uncommon",
  },
  {
    id: "crystal_vial",
    name: "Crystal Vial",
    cost: 48,
    effect: "Heal 35 HP immediately",
    maxStacks: 4,
    category: "gear",
    rarity: "common",
  },
  {
    id: "scout_glass",
    name: "Scout Glass",
    cost: 65,
    effect: "Attacks 6% faster, +3 damage",
    maxStacks: 2,
    category: "gear",
    rarity: "uncommon",
  },
  {
    id: "iron_spikes",
    name: "Iron Spikes",
    cost: 70,
    effect: "Base +15 HP (repairs 15)",
    maxStacks: 3,
    category: "gear",
    rarity: "uncommon",
  },
  {
    id: "gold_magnet",
    name: "Gold Magnet",
    cost: 95,
    effect: "+3 gold per enemy kill",
    maxStacks: 2,
    category: "gear",
    rarity: "rare",
  },
  {
    id: "berserker_tonic",
    name: "Berserker Tonic",
    cost: 100,
    effect: "+14 damage, −10 max HP",
    maxStacks: 1,
    category: "gear",
    rarity: "rare",
  },
  {
    id: "guardian_crest",
    name: "Guardian Crest",
    cost: 105,
    effect: "+50 max HP (heals 25), base +10 HP",
    maxStacks: 1,
    category: "gear",
    rarity: "rare",
  },
  {
    id: "chrono_sand",
    name: "Chrono Sand",
    cost: 120,
    effect: "Attacks 18% faster",
    maxStacks: 1,
    category: "gear",
    rarity: "mythic",
  },
  {
    id: "phantom_ink",
    name: "Phantom Ink",
    cost: 75,
    effect: "+55 move speed",
    maxStacks: 1,
    category: "gear",
    rarity: "rare",
  },
  {
    id: "warhorn",
    name: "Warhorn",
    cost: 115,
    effect: "+1.0 gold/sec income",
    maxStacks: 1,
    category: "gear",
    rarity: "mythic",
  },
  {
    id: "soul_lantern",
    name: "Soul Lantern",
    cost: 125,
    effect: "+12 damage, +0.6 income",
    maxStacks: 1,
    category: "gear",
    rarity: "mythic",
  },
  {
    id: "dragon_scale",
    name: "Dragon Scale",
    cost: 160,
    effect: "+45 max HP, +8 damage, base +25 HP",
    maxStacks: 1,
    category: "gear",
    rarity: "legendary",
  },
  {
    id: "void_splinter",
    name: "Void Splinter",
    cost: 155,
    effect: "+20 damage, attacks 10% faster",
    maxStacks: 1,
    category: "gear",
    rarity: "legendary",
  },
  {
    id: "king_scepter",
    name: "King's Scepter",
    cost: 200,
    effect: "+15 damage, +1.5 income, +20 max HP",
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
