/**
 * Generates flatter SVG icons for every gear shop item in public/art/items/.
 * Simpler than relic art — fewer ornaments, readable at small sizes.
 * Does NOT include turret/artifact shop entries.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "art", "items");

/** [id, name, tag, rarity] — gear only (category === "gear"). */
const ITEMS = [
  ["boots", "Swift Boots", "Mobility", "common"],
  ["blade", "Honed Blade", "Attack", "common"],
  ["vitality", "Vitality Charm", "Sustain", "common"],
  ["purse", "Coin Purse", "Economy", "uncommon"],
  ["greaves", "War Greaves", "Mobility", "uncommon"],
  ["razor", "Razor Quill", "Attack", "uncommon"],
  ["aegis", "Base Aegis", "Base", "uncommon"],
  ["siphon", "Kill Siphon", "Economy", "common"],
  ["blueprint", "Blueprint Scroll", "Base", "rare"],
  ["war_banner", "War Banner", "Economy", "rare"],
  ["focus_lens", "Focus Lens", "Attack", "rare"],
  ["iron_mail", "Iron Mail", "Defense", "uncommon"],
  ["swift_quill", "Swift Quill", "Attack", "rare"],
  ["blood_charm", "Blood Charm", "Sustain", "mythic"],
  ["storm_core", "Storm Core", "Economy", "mythic"],
  ["apex_relic", "Apex Shard", "Power", "legendary"],
  ["lucky_dice", "Lucky Dice", "Luck", "common"],
  ["copper_ring", "Copper Ring", "Economy", "common"],
  ["leather_wrap", "Leather Wrap", "Mobility", "common"],
  ["whetstone", "Whetstone", "Attack", "common"],
  ["traveler_cloak", "Traveler Cloak", "Mobility", "uncommon"],
  ["merchant_seal", "Merchant Seal", "Economy", "rare"],
  ["thorn_bracer", "Thorn Bracer", "Attack", "uncommon"],
  ["crystal_vial", "Crystal Vial", "Sustain", "common"],
  ["scout_glass", "Scout Glass", "Attack", "uncommon"],
  ["iron_spikes", "Iron Spikes", "Base", "uncommon"],
  ["gold_magnet", "Gold Magnet", "Economy", "rare"],
  ["berserker_tonic", "Berserker Tonic", "Offense", "rare"],
  ["guardian_crest", "Guardian Crest", "Defense", "rare"],
  ["chrono_sand", "Chrono Sand", "Attack", "mythic"],
  ["phantom_ink", "Phantom Ink", "Mobility", "rare"],
  ["warhorn", "Warhorn", "Economy", "mythic"],
  ["soul_lantern", "Soul Lantern", "Offense", "mythic"],
  ["dragon_scale", "Dragon Scale", "Defense", "legendary"],
  ["void_splinter", "Void Splinter", "Attack", "legendary"],
  ["king_scepter", "King's Scepter", "Power", "legendary"],
  ["reroll_token", "Reroll Token", "Draft", "uncommon"],
  ["reroll_pouch", "Reroll Pouch", "Draft", "rare"],
  ["shadow_greaves", "Shadow Greaves", "Mobility", "rare"],
  ["monk_beads", "Monk Beads", "Economy", "uncommon"],
  ["rust_nail", "Rust Nail", "Attack", "common"],
  ["quiet_ledger", "Quiet Ledger", "Economy", "rare"],
  ["beggar_cloak", "Beggar's Cloak", "Mobility", "common"],
  ["copper_spike", "Copper Spike", "Attack", "uncommon"],
  ["boss_fang", "Boss Fang", "Offense", "rare"],
  ["trophy_ring", "Trophy Ring", "Economy", "rare"],
  ["marrow_flask", "Marrow Flask", "Sustain", "uncommon"],
  ["marathon_boots", "Marathon Boots", "Mobility", "rare"],
  ["endurance_charm", "Endurance Charm", "Defense", "uncommon"],
  ["longwatch_scope", "Longwatch Scope", "Attack", "rare"],
  ["architect_hammer", "Architect's Hammer", "Base", "mythic"],
  ["scaffold_kit", "Scaffold Kit", "Base", "uncommon"],
  ["keystone_shard", "Keystone Shard", "Power", "mythic"],
  ["miser_coin", "Miser Coin", "Economy", "uncommon"],
  ["thrift_seal", "Thrift Seal", "Economy", "rare"],
  ["empty_purse", "Empty Purse", "Economy", "common"],
  ["legend_quill", "Legend Quill", "Attack", "legendary"],
  ["ascent_crown", "Ascent Crown", "Power", "legendary"],
  ["void_thread", "Void Thread", "Attack", "mythic"],
  ["starfall_lens", "Starfall Lens", "Luck", "legendary"],
  ["jade_anklet", "Jade Anklet", "Mobility", "common"],
  ["sparring_gloves", "Sparring Gloves", "Attack", "common"],
  ["field_rations", "Field Rations", "Sustain", "common"],
  ["courier_badge", "Courier Badge", "Economy", "common"],
  ["lane_chalk", "Lane Chalk", "Attack", "common"],
  ["pulse_bracer", "Pulse Bracer", "Attack", "uncommon"],
  ["mirror_shard", "Mirror Shard", "Luck", "uncommon"],
  ["harvest_sickle", "Harvest Sickle", "Economy", "uncommon"],
  ["arc_capacitor", "Arc Capacitor", "Attack", "uncommon"],
  ["grove_charm", "Grove Charm", "Sustain", "uncommon"],
  ["siege_grease", "Siege Grease", "Base", "rare"],
  ["whisper_cloak", "Whisper Cloak", "Mobility", "rare"],
  ["xp_primer", "XP Primer", "Growth", "rare"],
  ["mentor_tome", "Mentor Tome", "Growth", "mythic"],
  ["scholar_lens", "Scholar Lens", "Growth", "rare"],
  ["blood_engine", "Blood Engine", "Sustain", "legendary"],
  ["forge_heart", "Forge Heart", "Artifacts", "legendary"],
  ["eclipse_crown", "Eclipse Crown", "Power", "legendary"],
  ["nest_core", "Nest Core", "Sends", "legendary"],
  ["temporal_coil", "Temporal Coil", "Mobility", "legendary"],
];

const RARITY = {
  common: { border: "#6a7a90", accent: "#b0c0d4" },
  uncommon: { border: "#2db87a", accent: "#8fd9b8" },
  rare: { border: "#4a8ae8", accent: "#a8c8f0" },
  mythic: { border: "#c89030", accent: "#e8c870" },
  legendary: { border: "#d06070", accent: "#f0a8b0" },
};

const TAG = {
  Economy: "#d4b84a",
  Offense: "#e07070",
  Sustain: "#48c878",
  Risk: "#e88840",
  Attack: "#e070a8",
  Mobility: "#40b0e0",
  Defense: "#8898a8",
  Base: "#9080d0",
  Sends: "#30c0b0",
  Artifacts: "#b080e0",
  Luck: "#e8d040",
  Power: "#e0a830",
  Draft: "#a898e0",
  Growth: "#58c8a0",
};

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Flat geometric glyphs — one primary shape, no nested ornaments. */
function glyph(id, accent) {
  const h = hash(id);
  const pick = h % 16;
  const g = [
    // boot
    `<path d="M20 26h12l5 10h11v8H18z" fill="none" stroke="${accent}" stroke-width="2.4" stroke-linejoin="round"/>`,
    // blade
    `<path d="M34 14 L30 44 L26 40 L22 50 L38 42 L32 38 Z" fill="${accent}"/>`,
    // heart / charm
    `<path d="M32 44 C20 34 18 24 24 20c4-2 8 0 8 4 0-4 4-6 8-4 6 4 4 14-8 24z" fill="none" stroke="${accent}" stroke-width="2.2"/>`,
    // purse / bag
    `<rect x="22" y="24" width="20" height="20" rx="3" fill="none" stroke="${accent}" stroke-width="2.2"/>
     <path d="M28 24c0-4 8-4 8 0" fill="none" stroke="${accent}" stroke-width="2"/>`,
    // shield
    `<path d="M32 16l13 5v11c0 9-7 14-13 16-6-2-13-7-13-16V21z" fill="none" stroke="${accent}" stroke-width="2.2"/>`,
    // quill
    `<path d="M20 42 L40 18 M38 20l4 4M22 40l-4 6" stroke="${accent}" stroke-width="2.2" stroke-linecap="round"/>`,
    // coin
    `<circle cx="32" cy="32" r="12" fill="none" stroke="${accent}" stroke-width="2.4"/>
     <path d="M32 24v16M27 28h10M27 36h10" stroke="${accent}" stroke-width="1.6"/>`,
    // dice
    `<rect x="20" y="20" width="24" height="24" rx="4" fill="none" stroke="${accent}" stroke-width="2.2"/>
     <circle cx="28" cy="28" r="2" fill="${accent}"/><circle cx="36" cy="36" r="2" fill="${accent}"/>`,
    // ring
    `<circle cx="32" cy="32" r="11" fill="none" stroke="${accent}" stroke-width="3"/>
     <circle cx="32" cy="32" r="5" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.5"/>`,
    // vial / flask
    `<path d="M28 16h8v8l6 20a8 8 0 1 1-20 0l6-20z" fill="none" stroke="${accent}" stroke-width="2.2"/>`,
    // lens / glass
    `<circle cx="30" cy="30" r="10" fill="none" stroke="${accent}" stroke-width="2.4"/>
     <path d="M38 38l8 8" stroke="${accent}" stroke-width="2.4" stroke-linecap="round"/>`,
    // banner
    `<path d="M24 14v36M24 16h16l-3 5 3 5H24" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linejoin="round"/>`,
    // hammer
    `<rect x="20" y="18" width="24" height="12" rx="2" fill="none" stroke="${accent}" stroke-width="2.2"/>
     <rect x="29" y="30" width="6" height="18" fill="${accent}" opacity="0.85"/>`,
    // book / tome
    `<rect x="20" y="18" width="24" height="28" rx="2" fill="none" stroke="${accent}" stroke-width="2.2"/>
     <path d="M32 18v28M24 26h6M24 32h6" stroke="${accent}" stroke-width="1.6"/>`,
    // crown
    `<path d="M18 40 L22 24 L28 34 L32 20 L36 34 L42 24 L46 40 Z" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linejoin="round"/>`,
    // coil / spiral
    `<path d="M32 18c10 0 14 8 14 14s-6 14-14 14-14-6-14-12 4-10 10-10 8 4 8 8-2 6-6 6" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linecap="round"/>`,
  ];

  // Id-biased pick so related names don't always collide
  const bias = {
    boots: 0, greaves: 0, marathon_boots: 0, jade_anklet: 0, shadow_greaves: 0,
    blade: 1, razor: 1, rust_nail: 1, copper_spike: 1, void_splinter: 1, lane_chalk: 1,
    vitality: 2, blood_charm: 2, endurance_charm: 2, grove_charm: 2,
    purse: 3, empty_purse: 3, courier_badge: 3,
    aegis: 4, iron_mail: 4, guardian_crest: 4, dragon_scale: 4,
    swift_quill: 5, legend_quill: 5, whetstone: 5,
    copper_ring: 8, trophy_ring: 8, miser_coin: 6, gold_magnet: 6, siphon: 6,
    lucky_dice: 7, reroll_token: 7, reroll_pouch: 7,
    crystal_vial: 9, marrow_flask: 9, berserker_tonic: 9, field_rations: 9,
    focus_lens: 10, scout_glass: 10, longwatch_scope: 10, scholar_lens: 10, starfall_lens: 10, mirror_shard: 10,
    war_banner: 11, warhorn: 11,
    architect_hammer: 12, scaffold_kit: 12, iron_spikes: 12, siege_grease: 12,
    mentor_tome: 13, xp_primer: 13, blueprint: 13, quiet_ledger: 13,
    ascent_crown: 14, eclipse_crown: 14, king_scepter: 14, apex_relic: 14,
    temporal_coil: 15, storm_core: 15, arc_capacitor: 15, chrono_sand: 15, void_thread: 15,
    pulse_bracer: 4, thorn_bracer: 4, sparring_gloves: 4,
    harvest_sickle: 1, nest_core: 15, forge_heart: 2, blood_engine: 2,
    leather_wrap: 0, traveler_cloak: 0, beggar_cloak: 0, whisper_cloak: 0, phantom_ink: 0,
    merchant_seal: 8, thrift_seal: 8, keystone_shard: 14, soul_lantern: 9, boss_fang: 1,
  };
  const idx = bias[id] ?? pick;
  return g[idx % g.length];
}

function svgFor([id, name, tag, rarity]) {
  const r = RARITY[rarity] ?? RARITY.common;
  const accent = TAG[tag] ?? r.accent;
  const body = glyph(id, accent);
  // Flatter frame: solid fill, single stroke, no inner rim / glow rings
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 64 64" role="img" aria-label="${name}">
  <rect x="3" y="3" width="58" height="58" rx="10" fill="#141c28" stroke="${r.border}" stroke-width="2"/>
  <rect x="3" y="3" width="58" height="22" rx="10" fill="#1a2434" opacity="0.55"/>
  ${body}
</svg>
`;
}

fs.mkdirSync(outDir, { recursive: true });
for (const row of ITEMS) {
  fs.writeFileSync(path.join(outDir, `${row[0]}.svg`), svgFor(row), "utf8");
}
console.log(`Wrote ${ITEMS.length} item icons → ${outDir}`);
