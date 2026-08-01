import { TURRET_DEFS, isTurretKind, type TurretKind } from "./turrets";
import type { Rarity } from "./rarity";
import { isItemUnlocked } from "../meta/contentLocks";

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
  | "reroll_token"
  | "reroll_pouch"
  | "shadow_greaves"
  | "monk_beads"
  | "rust_nail"
  | "quiet_ledger"
  | "beggar_cloak"
  | "copper_spike"
  | "boss_fang"
  | "trophy_ring"
  | "marrow_flask"
  | "marathon_boots"
  | "endurance_charm"
  | "longwatch_scope"
  | "architect_hammer"
  | "scaffold_kit"
  | "keystone_shard"
  | "miser_coin"
  | "thrift_seal"
  | "empty_purse"
  | "legend_quill"
  | "ascent_crown"
  | "void_thread"
  | "starfall_lens"
  | "jade_anklet"
  | "sparring_gloves"
  | "field_rations"
  | "courier_badge"
  | "lane_chalk"
  | "pulse_bracer"
  | "mirror_shard"
  | "harvest_sickle"
  | "arc_capacitor"
  | "grove_charm"
  | "siege_grease"
  | "whisper_cloak"
  | "xp_primer"
  | "mentor_tome"
  | "scholar_lens"
  | "blood_engine"
  | "forge_heart"
  | "eclipse_crown"
  | "nest_core"
  | "temporal_coil"
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
    id: "reroll_token",
    name: "Reroll Token",
    cost: 45,
    effect: "+1 draft reroll token (level or relic)",
    maxStacks: 8,
    category: "gear",
    rarity: "uncommon",
  },
  {
    id: "reroll_pouch",
    name: "Reroll Pouch",
    cost: 110,
    effect: "+3 draft reroll tokens",
    maxStacks: 3,
    category: "gear",
    rarity: "rare",
  },
  { id: "shadow_greaves", name: "Shadow Greaves", cost: 70, effect: "+40 speed, +8 damage", maxStacks: 1, category: "gear", rarity: "rare" },
  { id: "monk_beads", name: "Monk Beads", cost: 55, effect: "+0.5 income, +10 max HP", maxStacks: 2, category: "gear", rarity: "uncommon" },
  { id: "rust_nail", name: "Rust Nail", cost: 40, effect: "+6 damage", maxStacks: 3, category: "gear", rarity: "common" },
  { id: "quiet_ledger", name: "Quiet Ledger", cost: 65, effect: "Shop prices −6%", maxStacks: 1, category: "gear", rarity: "rare" },
  { id: "beggar_cloak", name: "Beggar's Cloak", cost: 50, effect: "+35 speed", maxStacks: 2, category: "gear", rarity: "common" },
  { id: "copper_spike", name: "Copper Spike", cost: 48, effect: "+5 damage, +2 kill gold", maxStacks: 2, category: "gear", rarity: "uncommon" },
  { id: "boss_fang", name: "Boss Fang", cost: 95, effect: "+12 damage vs elites/bosses feel (+10 dmg)", maxStacks: 1, category: "gear", rarity: "rare" },
  { id: "trophy_ring", name: "Trophy Ring", cost: 80, effect: "+0.8 income, +8 max HP", maxStacks: 1, category: "gear", rarity: "rare" },
  { id: "marrow_flask", name: "Marrow Flask", cost: 70, effect: "Heal 40, +15 max HP", maxStacks: 2, category: "gear", rarity: "uncommon" },
  { id: "marathon_boots", name: "Marathon Boots", cost: 75, effect: "+50 speed, +0.3 income", maxStacks: 1, category: "gear", rarity: "rare" },
  { id: "endurance_charm", name: "Endurance Charm", cost: 60, effect: "+35 max HP", maxStacks: 2, category: "gear", rarity: "uncommon" },
  { id: "longwatch_scope", name: "Longwatch Scope", cost: 85, effect: "+8 damage, attacks 6% faster", maxStacks: 1, category: "gear", rarity: "rare" },
  { id: "architect_hammer", name: "Architect's Hammer", cost: 90, effect: "Base +30 HP, upgrades −5% feel ( +0.2 income)", maxStacks: 1, category: "gear", rarity: "mythic" },
  { id: "scaffold_kit", name: "Scaffold Kit", cost: 70, effect: "Base +20 HP", maxStacks: 2, category: "gear", rarity: "uncommon" },
  { id: "keystone_shard", name: "Keystone Shard", cost: 100, effect: "+10 damage, +0.5 income", maxStacks: 1, category: "gear", rarity: "mythic" },
  { id: "miser_coin", name: "Miser Coin", cost: 55, effect: "+4 kill gold", maxStacks: 2, category: "gear", rarity: "uncommon" },
  { id: "thrift_seal", name: "Thrift Seal", cost: 80, effect: "Shop prices −10%", maxStacks: 1, category: "gear", rarity: "rare" },
  { id: "empty_purse", name: "Empty Purse", cost: 35, effect: "+0.45 income", maxStacks: 3, category: "gear", rarity: "common" },
  { id: "legend_quill", name: "Legend Quill", cost: 140, effect: "+16 damage, +20 max HP", maxStacks: 1, category: "gear", rarity: "legendary" },
  { id: "ascent_crown", name: "Ascent Crown", cost: 160, effect: "+1.2 income, +12 damage", maxStacks: 1, category: "gear", rarity: "legendary" },
  { id: "void_thread", name: "Void Thread", cost: 130, effect: "Attack 15% faster, +8 damage", maxStacks: 1, category: "gear", rarity: "mythic" },
  { id: "starfall_lens", name: "Starfall Lens", cost: 150, effect: "+0.15 crit, +10 damage", maxStacks: 1, category: "gear", rarity: "legendary" },
  { id: "jade_anklet", name: "Jade Anklet", cost: 32, effect: "+18 move speed", maxStacks: 3, category: "gear", rarity: "common" },
  { id: "sparring_gloves", name: "Sparring Gloves", cost: 36, effect: "+3 damage, attacks 4% faster", maxStacks: 3, category: "gear", rarity: "common" },
  { id: "field_rations", name: "Field Rations", cost: 34, effect: "+18 max HP (heals 18)", maxStacks: 3, category: "gear", rarity: "common" },
  { id: "courier_badge", name: "Courier Badge", cost: 42, effect: "+0.4 gold/sec income", maxStacks: 2, category: "gear", rarity: "common" },
  { id: "lane_chalk", name: "Lane Chalk", cost: 48, effect: "+5 damage", maxStacks: 3, category: "gear", rarity: "common" },
  { id: "pulse_bracer", name: "Pulse Bracer", cost: 62, effect: "+6 damage, +8 max HP", maxStacks: 2, category: "gear", rarity: "uncommon" },
  { id: "mirror_shard", name: "Mirror Shard", cost: 70, effect: "+10% crit chance", maxStacks: 2, category: "gear", rarity: "uncommon" },
  { id: "harvest_sickle", name: "Harvest Sickle", cost: 68, effect: "+3 gold per kill", maxStacks: 2, category: "gear", rarity: "uncommon" },
  { id: "arc_capacitor", name: "Arc Capacitor", cost: 78, effect: "Attacks 10% faster", maxStacks: 2, category: "gear", rarity: "uncommon" },
  { id: "grove_charm", name: "Grove Charm", cost: 72, effect: "+28 max HP (heals 14)", maxStacks: 2, category: "gear", rarity: "uncommon" },
  { id: "siege_grease", name: "Siege Grease", cost: 88, effect: "Base +25 HP (repairs 25)", maxStacks: 2, category: "gear", rarity: "rare" },
  { id: "whisper_cloak", name: "Whisper Cloak", cost: 95, effect: "+40 speed, +6% crit", maxStacks: 1, category: "gear", rarity: "rare" },
  { id: "xp_primer", name: "XP Primer", cost: 90, effect: "+12% XP from kills", maxStacks: 1, category: "gear", rarity: "rare" },
  { id: "mentor_tome", name: "Mentor Tome", cost: 110, effect: "+18% XP from kills", maxStacks: 1, category: "gear", rarity: "mythic" },
  { id: "scholar_lens", name: "Scholar Lens", cost: 100, effect: "+10% XP, +5% crit", maxStacks: 1, category: "gear", rarity: "rare" },
  { id: "blood_engine", name: "Blood Engine", cost: 200, effect: "Legendary: kills heal 8 HP; +2% damage per stack (max 10)", maxStacks: 1, category: "gear", rarity: "legendary" },
  { id: "forge_heart", name: "Forge Heart", cost: 190, effect: "Legendary: +1 artifact slot; artifacts +20% damage", maxStacks: 1, category: "gear", rarity: "legendary" },
  { id: "eclipse_crown", name: "Eclipse Crown", cost: 210, effect: "Legendary: +25% damage under 50% HP; +0.8 income", maxStacks: 1, category: "gear", rarity: "legendary" },
  { id: "nest_core", name: "Nest Core", cost: 185, effect: "Legendary: every 8 kills, queue 1 into next wave", maxStacks: 1, category: "gear", rarity: "legendary" },
  { id: "temporal_coil", name: "Temporal Coil", cost: 195, effect: "Legendary: mobility & ultimate cool 18% faster", maxStacks: 1, category: "gear", rarity: "legendary" },
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
  {
    id: "frost_spire",
    name: TURRET_DEFS.frost_spire.name,
    cost: TURRET_DEFS.frost_spire.cost,
    effect: TURRET_DEFS.frost_spire.effect,
    maxStacks: 3,
    category: "artifact",
    rarity: "rare",
  },
  {
    id: "chain_coil",
    name: TURRET_DEFS.chain_coil.name,
    cost: TURRET_DEFS.chain_coil.cost,
    effect: TURRET_DEFS.chain_coil.effect,
    maxStacks: 3,
    category: "artifact",
    rarity: "rare",
  },
  {
    id: "gold_siphon",
    name: TURRET_DEFS.gold_siphon.name,
    cost: TURRET_DEFS.gold_siphon.cost,
    effect: TURRET_DEFS.gold_siphon.effect,
    maxStacks: 3,
    category: "artifact",
    rarity: "uncommon",
  },
  {
    id: "bastion_lamp",
    name: TURRET_DEFS.bastion_lamp.name,
    cost: TURRET_DEFS.bastion_lamp.cost,
    effect: TURRET_DEFS.bastion_lamp.effect,
    maxStacks: 3,
    category: "artifact",
    rarity: "uncommon",
  },
  {
    id: "venom_censer",
    name: TURRET_DEFS.venom_censer.name,
    cost: TURRET_DEFS.venom_censer.cost,
    effect: TURRET_DEFS.venom_censer.effect,
    maxStacks: 3,
    category: "artifact",
    rarity: "rare",
  },
  {
    id: "grav_anchor",
    name: TURRET_DEFS.grav_anchor.name,
    cost: TURRET_DEFS.grav_anchor.cost,
    effect: TURRET_DEFS.grav_anchor.effect,
    maxStacks: 3,
    category: "artifact",
    rarity: "mythic",
  },
  {
    id: "rail_lance",
    name: TURRET_DEFS.rail_lance.name,
    cost: TURRET_DEFS.rail_lance.cost,
    effect: TURRET_DEFS.rail_lance.effect,
    maxStacks: 3,
    category: "artifact",
    rarity: "mythic",
  },
  {
    id: "splinter_nest",
    name: TURRET_DEFS.splinter_nest.name,
    cost: TURRET_DEFS.splinter_nest.cost,
    effect: TURRET_DEFS.splinter_nest.effect,
    maxStacks: 3,
    category: "artifact",
    rarity: "rare",
  },
  {
    id: "execute_glyph",
    name: TURRET_DEFS.execute_glyph.name,
    cost: TURRET_DEFS.execute_glyph.cost,
    effect: TURRET_DEFS.execute_glyph.effect,
    maxStacks: 3,
    category: "artifact",
    rarity: "mythic",
  },
  {
    id: "mine_layer",
    name: TURRET_DEFS.mine_layer.name,
    cost: TURRET_DEFS.mine_layer.cost,
    effect: TURRET_DEFS.mine_layer.effect,
    maxStacks: 3,
    category: "artifact",
    rarity: "rare",
  },
  {
    id: "storm_rod",
    name: TURRET_DEFS.storm_rod.name,
    cost: TURRET_DEFS.storm_rod.cost,
    effect: TURRET_DEFS.storm_rod.effect,
    maxStacks: 3,
    category: "artifact",
    rarity: "mythic",
  },
  {
    id: "ward_beacon",
    name: TURRET_DEFS.ward_beacon.name,
    cost: TURRET_DEFS.ward_beacon.cost,
    effect: TURRET_DEFS.ward_beacon.effect,
    maxStacks: 3,
    category: "artifact",
    rarity: "rare",
  },
  {
    id: "sovereign_nexus",
    name: TURRET_DEFS.sovereign_nexus.name,
    cost: TURRET_DEFS.sovereign_nexus.cost,
    effect: TURRET_DEFS.sovereign_nexus.effect,
    maxStacks: 1,
    category: "artifact",
    rarity: "legendary",
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
  return isTurretKind(id);
}

/** Roll a fresh offer of distinct items. Prefer not repeating the previous offer. */
export function rollShopOffer(previous: ShopItemId[] = []): ShopItemId[] {
  const pool = SHOP_ITEMS.map((i) => i.id).filter((id) => isItemUnlocked(id));
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
