/**
 * Generates unique simple SVG icons for every relic in public/art/relics/.
 * Deterministic per relic id — readable at small sizes, dark lane-wars palette.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "art", "relics");

const RELICS = [
  ["crowded_ledger", "Crowded Ledger", "Economy", "common"],
  ["high_ground_oath", "High Ground Oath", "Offense", "uncommon"],
  ["second_wind", "Second Wind", "Sustain", "common"],
  ["blood_price", "Blood Price", "Risk", "rare"],
  ["chain_spark", "Chain Spark", "Attack", "uncommon"],
  ["gold_fever", "Gold Fever", "Economy", "rare"],
  ["phantom_step", "Phantom Step", "Mobility", "common"],
  ["overcharge", "Overcharge", "Attack", "uncommon"],
  ["iron_dividend", "Iron Dividend", "Defense", "uncommon"],
  ["hungry_blade", "Hungry Blade", "Sustain", "rare"],
  ["war_tax", "War Tax", "Economy", "common"],
  ["splinter_tip", "Splinter Tip", "Attack", "rare"],
  ["foundation_spikes", "Foundation Spikes", "Base", "uncommon"],
  ["send_sovereign", "Send Sovereign", "Sends", "rare"],
  ["architects_favor", "Architect's Favor", "Artifacts", "mythic"],
  ["glass_cannon", "Glass Cannon", "Risk", "mythic"],
  ["frost_sigil", "Frost Sigil", "Control", "uncommon"],
  ["lucky_coin", "Lucky Coin", "Luck", "common"],
  ["tide_charm", "Tide Charm", "Sustain", "common"],
  ["mythic_engine", "Mythic Engine", "Economy", "mythic"],
  ["legend_crown", "Crown of the Line", "Power", "legendary"],
  ["spare_clip", "Spare Clip", "Attack", "common"],
  ["runners_band", "Runner's Band", "Mobility", "common"],
  ["penny_whistle", "Penny Whistle", "Economy", "common"],
  ["stone_skin", "Stone Skin", "Defense", "common"],
  ["keen_eye", "Keen Eye", "Luck", "uncommon"],
  ["bounty_mark", "Bounty Mark", "Economy", "uncommon"],
  ["rally_banner", "Rally Banner", "Sustain", "uncommon"],
  ["echo_chamber", "Echo Chamber", "Power", "uncommon"],
  ["vampiric_edge", "Vampiric Edge", "Sustain", "rare"],
  ["fortress_pact", "Fortress Pact", "Defense", "rare"],
  ["haste_sigil", "Haste Sigil", "Attack", "rare"],
  ["miser_purse", "Miser's Purse", "Economy", "rare"],
  ["shockwave_core", "Shockwave Core", "Attack", "mythic"],
  ["last_stand", "Last Stand", "Risk", "mythic"],
  ["wave_rider", "Wave Rider", "Sustain", "uncommon"],
  ["turret_overclock", "Artifact Overclock", "Artifacts", "mythic"],
  ["blood_tithe", "Blood Tithe", "Offense", "rare"],
  ["oracle_lens", "Oracle Lens", "Luck", "mythic"],
  ["phoenix_down", "Phoenix Down", "Survival", "legendary"],
  ["eternal_engine", "Eternal Engine", "Economy", "legendary"],
  ["worldbreaker", "Worldbreaker", "Power", "legendary"],
  ["sovereign_seal", "Sovereign Seal", "Sends", "legendary"],
  ["line_tyrant", "Line Tyrant", "Power", "legendary"],
  ["quiet_market", "Quiet Market", "Economy", "rare"],
  ["send_silence", "Send Silence", "Economy", "uncommon"],
  ["iron_breath", "Iron Breath", "Sustain", "uncommon"],
  ["second_chance", "Second Chance", "Survival", "mythic"],
  ["flawless_oath", "Flawless Oath", "Offense", "rare"],
  ["untouchable", "Untouchable", "Defense", "rare"],
  ["elite_bane", "Elite Bane", "Offense", "rare"],
  ["trophy_hunter", "Trophy Hunter", "Economy", "uncommon"],
  ["chest_magnet", "Chest Magnet", "Utility", "uncommon"],
  ["lucky_lockpick", "Lucky Lockpick", "Utility", "rare"],
  ["relic_nest", "Relic Nest", "Draft", "mythic"],
  ["stacked_fate", "Stacked Fate", "Draft", "rare"],
  ["draft_sage", "Draft Sage", "Draft", "rare"],
  ["level_torrent", "Level Torrent", "Growth", "uncommon"],
  ["bare_hands", "Bare Hands", "Risk", "mythic"],
  ["scrap_king", "Scrap King", "Economy", "common"],
  ["cleaver_crown", "Cleaver Crown", "Power", "legendary"],
  ["storm_sovereign", "Storm Sovereign", "Power", "legendary"],
  ["curse_mirror", "Curse Mirror", "Hex", "legendary"],
  ["twin_lanes", "Twin Lanes", "Command", "legendary"],
  ["mentor_sigil", "Mentor Sigil", "Growth", "uncommon"],
  ["scholar_band", "Scholar Band", "Growth", "rare"],
  ["ascent_primer", "Ascent Primer", "Growth", "rare"],
];

const RARITY = {
  common: { border: "#7a8aa8", glow: "#9ab0d0", accent: "#c5d4ef" },
  uncommon: { border: "#3ecf8e", glow: "#2dd4bf", accent: "#a7f3d0" },
  rare: { border: "#5b9cff", glow: "#38bdf8", accent: "#bfdbfe" },
  mythic: { border: "#e0a045", glow: "#fbbf24", accent: "#fde68a" },
  legendary: { border: "#f07178", glow: "#fb7185", accent: "#fecdd3" },
};

const TAG = {
  Economy: "#e6c35c",
  Offense: "#f07178",
  Sustain: "#4ade80",
  Risk: "#fb923c",
  Attack: "#f472b6",
  Mobility: "#38bdf8",
  Defense: "#94a3b8",
  Base: "#a78bfa",
  Sends: "#2dd4bf",
  Artifacts: "#c084fc",
  Control: "#67e8f9",
  Luck: "#fde047",
  Power: "#fbbf24",
  Survival: "#fdba74",
  Utility: "#86efac",
  Draft: "#c4b5fd",
  Growth: "#6ee7b7",
  Hex: "#e879f9",
  Command: "#7dd3fc",
};

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function motif(id, tag, accent) {
  const h = hash(id);
  const pick = h % 12;
  // Unique glyph per id — geometric emblem in the center
  const glyphs = [
    // ledger / book
    `<rect x="22" y="20" width="20" height="24" rx="2" fill="none" stroke="${accent}" stroke-width="2.2"/>
     <path d="M26 26h12M26 32h12M26 38h8" stroke="${accent}" stroke-width="1.8" stroke-linecap="round"/>`,
    // oath / peak
    `<path d="M32 18 L44 42 H20 Z" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linejoin="round"/>
     <circle cx="32" cy="34" r="3" fill="${accent}"/>`,
    // wind swirl
    `<path d="M18 28c8-10 20-10 28 0M20 36c7-7 17-7 24 0" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linecap="round"/>`,
    // droplet / blood
    `<path d="M32 16c8 12 12 18 12 24a12 12 0 1 1-24 0c0-6 4-12 12-24z" fill="none" stroke="${accent}" stroke-width="2.2"/>`,
    // spark / bolt
    `<path d="M36 14 L26 34 h8 L28 50 L42 28 h-8 Z" fill="${accent}" opacity="0.9"/>`,
    // coin
    `<circle cx="32" cy="32" r="14" fill="none" stroke="${accent}" stroke-width="2.4"/>
     <text x="32" y="37" text-anchor="middle" font-size="14" font-family="Georgia,serif" fill="${accent}" font-weight="700">¢</text>`,
    // boot / step
    `<path d="M22 24h10l4 8h10v8H20z" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linejoin="round"/>`,
    // charge rings
    `<circle cx="32" cy="32" r="6" fill="${accent}"/>
     <circle cx="32" cy="32" r="12" fill="none" stroke="${accent}" stroke-width="2" opacity="0.7"/>
     <circle cx="32" cy="32" r="17" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.4"/>`,
    // shield
    `<path d="M32 16l14 6v12c0 10-8 16-14 18-6-2-14-8-14-18V22z" fill="none" stroke="${accent}" stroke-width="2.2"/>`,
    // blade
    `<path d="M34 14 L30 42 L26 38 L22 48 L36 40 L32 36 Z" fill="${accent}"/>
     <rect x="28" y="42" width="8" height="6" rx="1" fill="${accent}" opacity="0.7"/>`,
    // banner
    `<path d="M24 14v36M24 16h18l-4 6 4 6H24" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linejoin="round"/>`,
    // crown
    `<path d="M16 38 L20 22 L28 32 L32 18 L36 32 L44 22 L48 38 Z" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linejoin="round"/>
     <rect x="16" y="38" width="32" height="6" rx="1" fill="${accent}" opacity="0.55"/>`,
  ];

  // Tag-biased overrides for readability
  const tagBias = {
    Economy: 5,
    Offense: 9,
    Sustain: 3,
    Risk: 3,
    Attack: 9,
    Mobility: 6,
    Defense: 8,
    Base: 1,
    Sends: 7,
    Artifacts: 7,
    Control: 4,
    Luck: 5,
    Power: 11,
    Survival: 3,
    Utility: 0,
    Draft: 0,
    Growth: 2,
    Hex: 4,
    Command: 10,
  };
  const idx = ((tagBias[tag] ?? pick) + (h % 5)) % glyphs.length;

  // Extra id-specific accent mark so no two share identical composition
  const markX = 14 + (h % 37);
  const markY = 12 + ((h >> 5) % 40);
  const mark = `<circle cx="${markX}" cy="${markY}" r="2.2" fill="${accent}" opacity="0.55"/>`;

  return `${glyphs[idx]}${mark}`;
}

function svgFor([id, name, tag, rarity]) {
  const r = RARITY[rarity] ?? RARITY.common;
  const accent = TAG[tag] ?? r.accent;
  const h = hash(id);
  const rot = (h % 7) - 3;
  const body = motif(id, tag, accent);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 64 64" role="img" aria-label="${name}">
  <defs>
    <radialGradient id="bg" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#243552"/>
      <stop offset="100%" stop-color="#0a101c"/>
    </radialGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${r.glow}"/>
      <stop offset="100%" stop-color="${r.border}"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="60" height="60" rx="12" fill="url(#bg)" stroke="url(#rim)" stroke-width="2.5"/>
  <rect x="6" y="6" width="52" height="52" rx="9" fill="none" stroke="${accent}" stroke-width="0.8" opacity="0.35"/>
  <g transform="rotate(${rot} 32 32)">${body}</g>
  <circle cx="32" cy="32" r="26" fill="none" stroke="${r.glow}" stroke-width="0.6" opacity="0.25"/>
</svg>
`;
}

fs.mkdirSync(outDir, { recursive: true });
for (const row of RELICS) {
  const file = path.join(outDir, `${row[0]}.svg`);
  fs.writeFileSync(file, svgFor(row), "utf8");
}
console.log(`Wrote ${RELICS.length} relic icons → ${outDir}`);
