import type { Rarity } from "./rarity";

export type HeroId =
  | "ranger"
  | "warden"
  | "scatter"
  | "arbalest"
  | "prism"
  | "frost"
  | "wizard"
  | "coil"
  | "thorn"
  | "ember"
  | "void"
  | "titan"
  | "mirage"
  | "medic"
  | "tempest"
  | "curses"
  | "warp"
  | "gyro"
  | "lodestone"
  | "chrona"
  | "hive"
  | "gunner"
  | "sapper"
  | "vector"
  | "cloud";

export type AbilityKind =
  | "dash"
  | "volley"
  | "bulwark"
  | "whirlwind"
  | "slide"
  | "buckshot"
  | "anchor"
  | "piercer"
  | "phase"
  | "beamstorm"
  | "glide"
  | "frostnova"
  | "blinkrng"
  | "chaosburst"
  | "zip"
  | "stormcage"
  | "burrow"
  | "bloom"
  | "flare"
  | "inferno"
  | "rift"
  | "singularity"
  | "charge"
  | "quake"
  | "swapblink"
  | "mirrorshard"
  | "fieldstep"
  | "sanctuary"
  | "gust"
  | "cyclone"
  | "hexstep"
  | "hexstorm"
  | "padlink"
  | "echonova"
  | "bladehook"
  | "bladestorm"
  | "polarpull"
  | "fluxburst"
  | "timestep"
  | "stasis"
  | "swarmdash"
  | "hivedetonate"
  | "gunfire"
  | "gunswap"
  | "plantmine"
  | "detonate"
  | "momentumdash"
  | "kineticburst"
  | "walldart"
  | "gasspew";

/** Combat slots bound to mouse by default (see Settings → Controls). */
export type AbilitySlot = "mobility" | "ultimate";

/** Distinct LMB attack feel per hero. */
export type AttackStyle =
  | "bolt"
  | "cleave"
  | "shotgun"
  | "heavy"
  | "beam"
  | "frostbolt"
  | "chaos"
  | "chain"
  | "vine"
  | "hex"
  | "spin"
  | "wind"
  | "syringe"
  | "emberbolt"
  | "needle"
  | "echo"
  | "warpbolt"
  | "magnet"
  | "chrono"
  | "drone"
  | "machinegun"
  | "grenade"
  | "kinetic"
  | "poisondash";
/**
 * How basics / ults interact with attack range:
 * - free: fire along aim anywhere (no range circle / no engage gate)
 * - engage: must have an enemy inside attackRange to basic or ultimate
 * - auto: Prism-style auto-aim beam within range
 */
export type AimMode = "free" | "engage" | "auto";

export type AbilityDef = {
  id: AbilityKind;
  slot: AbilitySlot;
  name: string;
  cooldown: number;
  hint: string;
};

export type HeroPassive = {
  id: string;
  name: string;
  blurb: string;
};

export type HeroDef = {
  id: HeroId;
  name: string;
  blurb: string;
  color: string;
  glowColor: string;
  radius: number;
  speed: number;
  maxHp: number;
  attackRange: number;
  attackDamage: number;
  attackCooldown: number;
  projectileSpeed: number;
  attackStyle: AttackStyle;
  aimMode: AimMode;
  /** Short line for UI / compendium. */
  attackHint: string;
  passive: HeroPassive;
  /** Order: mobility, then ultimate. */
  abilities: [AbilityDef, AbilityDef];
  /** Optional custom-hero advanced knobs. */
  projectileCount?: number;
  attackSpreadDeg?: number;
  abilityPowerMul?: number;
  passivePowerMul?: number;
  basicPierce?: number;
  basicBounce?: number;
  lifesteal?: number;
  moveSpeedMul?: number;
};

export const HEROES: Record<HeroId, HeroDef> = {
  ranger: {
    id: "ranger",
    name: "Ranger",
    blurb: "Long-range poke, a dash, and a fan of arrows.",
    color: "#5ec8f0",
    glowColor: "#5ef0c8",
    radius: 16,
    speed: 230,
    maxHp: 95,
    attackRange: 170,
    attackDamage: 17,
    attackCooldown: 0.32,
    projectileSpeed: 560,
    attackStyle: "bolt",
    aimMode: "free",
    attackHint: "Free-aim bolt (any direction)",
    passive: {
      id: "marksman",
      name: "Marksman",
      blurb: "Kills grant +25% attack speed for 2.5s (refreshes).",
    },
    abilities: [
      {
        id: "dash",
        slot: "mobility",
        name: "Dash",
        cooldown: 5,
        hint: "Burst in move direction (~110 units).",
      },
      {
        id: "volley",
        slot: "ultimate",
        name: "Volley",
        cooldown: 8,
        hint: "Fire 5 arrows in a cone toward the nearest foe.",
      },
    ],
  },
  warden: {
    id: "warden",
    name: "Warden",
    blurb: "Closer fights — bulwark step and whirlwind.",
    color: "#e0a045",
    glowColor: "#ffe08a",
    radius: 18,
    speed: 205,
    maxHp: 135,
    attackRange: 78,
    attackDamage: 26,
    attackCooldown: 0.48,
    projectileSpeed: 0,
    attackStyle: "cleave",
    aimMode: "engage",
    attackHint: "Aimed melee cleave — need a foe in range",
    passive: {
      id: "platebound",
      name: "Platebound",
      blurb: "Start with 42 Armor. Armor chips under fire and does not regenerate.",
    },
    abilities: [
      {
        id: "bulwark",
        slot: "mobility",
        name: "Bulwark Step",
        cooldown: 6,
        hint: "Short dash (~85) plus a 2.2s barrier that cuts contact damage.",
      },
      {
        id: "whirlwind",
        slot: "ultimate",
        name: "Whirlwind",
        cooldown: 7,
        hint: "Spin for 1.4s, dealing continuous AoE damage around you.",
      },
    ],
  },
  scatter: {
    id: "scatter",
    name: "Scatter",
    blurb: "Point-blank shotgun blasts and a sliding reload.",
    color: "#f07858",
    glowColor: "#ffb090",
    radius: 16,
    speed: 220,
    maxHp: 105,
    attackRange: 115,
    attackDamage: 9,
    attackCooldown: 0.55,
    projectileSpeed: 480,
    attackStyle: "shotgun",
    aimMode: "engage",
    attackHint: "Aimed shotgun — need a foe in range",
    passive: {
      id: "close_quarters",
      name: "Close Quarters",
      blurb: "+30% damage when any enemy is within 90 units.",
    },
    abilities: [
      {
        id: "slide",
        slot: "mobility",
        name: "Slide",
        cooldown: 4.5,
        hint: "Long slide in move direction (~140 units).",
      },
      {
        id: "buckshot",
        slot: "ultimate",
        name: "Buckstorm",
        cooldown: 9,
        hint: "Huge close-range pellet blast in a wide cone.",
      },
    ],
  },
  arbalest: {
    id: "arbalest",
    name: "Arbalest",
    blurb: "Slow heavy bolts that punch through the line.",
    color: "#8a7cf0",
    glowColor: "#c8b8ff",
    radius: 17,
    speed: 195,
    maxHp: 110,
    attackRange: 210,
    attackDamage: 38,
    attackCooldown: 0.85,
    projectileSpeed: 420,
    attackStyle: "heavy",
    aimMode: "free",
    attackHint: "Free-aim piercing bolt",
    passive: {
      id: "siege_focus",
      name: "Siege Focus",
      blurb: "Basic attacks deal +40% damage to Brutes, Elites, and Bosses.",
    },
    abilities: [
      {
        id: "anchor",
        slot: "mobility",
        name: "Anchor Step",
        cooldown: 5.5,
        hint: "Short reposition (~70) plus a brief barrier.",
      },
      {
        id: "piercer",
        slot: "ultimate",
        name: "Siege Bolt",
        cooldown: 10,
        hint: "Massive piercing shot that punches through many foes.",
      },
    ],
  },
  prism: {
    id: "prism",
    name: "Prism",
    blurb: "Hold-fire beam that burns whatever it touches.",
    color: "#5ef0a8",
    glowColor: "#b8ffe0",
    radius: 15,
    speed: 215,
    maxHp: 90,
    attackRange: 155,
    /** Nerf: continuous beam is easy to land — low per-tick damage. */
    attackDamage: 6,
    attackCooldown: 0.12,
    projectileSpeed: 0,
    attackStyle: "beam",
    aimMode: "auto",
    attackHint: "Auto-aim continuous beam",
    passive: {
      id: "aegis_lattice",
      name: "Aegis Lattice",
      blurb: "Start with 28 Energy Shield. Shields fully recharge after 3.2s without taking hits. Basics deal bonus damage to shielded foes.",
    },
    abilities: [
      {
        id: "phase",
        slot: "mobility",
        name: "Phase Blink",
        cooldown: 5.5,
        hint: "Blink toward move direction or nearest target (~150).",
      },
      {
        id: "beamstorm",
        slot: "ultimate",
        name: "Prism Storm",
        cooldown: 11,
        hint: "Wide sweeping burn Nova around you.",
      },
    ],
  },
  frost: {
    id: "frost",
    name: "Frost",
    blurb: "Ice bolts that chill the lane — and freeze the shop clock.",
    color: "#7ec8ff",
    glowColor: "#d0f0ff",
    radius: 16,
    speed: 210,
    maxHp: 100,
    attackRange: 165,
    attackDamage: 15,
    attackCooldown: 0.38,
    projectileSpeed: 500,
    attackStyle: "frostbolt",
    aimMode: "free",
    attackHint: "Free-aim ice bolt (slows)",
    passive: {
      id: "cryostasis",
      name: "Cryostasis",
      blurb: "Shop gains a Freeze button — pause/unpause stock refresh indefinitely.",
    },
    abilities: [
      {
        id: "glide",
        slot: "mobility",
        name: "Ice Glide",
        cooldown: 5,
        hint: "Slide on ice (~120) and briefly chill nearby foes.",
      },
      {
        id: "frostnova",
        slot: "ultimate",
        name: "Frost Nova",
        cooldown: 9,
        hint: "AoE burst that damages and heavily slows enemies.",
      },
    ],
  },
  wizard: {
    id: "wizard",
    name: "Chaos",
    blurb: "Chaos mage — basics and spells roll the dice every cast.",
    color: "#e070d0",
    glowColor: "#ffb0f0",
    radius: 16,
    speed: 215,
    maxHp: 92,
    attackRange: 150,
    attackDamage: 14,
    attackCooldown: 0.4,
    projectileSpeed: 480,
    attackStyle: "chaos",
    aimMode: "free",
    attackHint: "Free-aim random attack modes",
    passive: {
      id: "wild_magic",
      name: "Wild Magic",
      blurb: "Basics cycle bolt / shotgun / cleave / heavy. Abilities roll bonus effects.",
    },
    abilities: [
      {
        id: "blinkrng",
        slot: "mobility",
        name: "Unstable Blink",
        cooldown: 4.5,
        hint: "Blink a random distance (70–160). 25% chance to reset CD.",
      },
      {
        id: "chaosburst",
        slot: "ultimate",
        name: "Chaos Burst",
        cooldown: 8,
        hint: "Random: volley, nova, or heavy piercer — with scaled damage.",
      },
    ],
  },
  coil: {
    id: "coil",
    name: "Coil",
    blurb: "Tesla caster — aimed sparks that jump between foes.",
    color: "#ffd24a",
    glowColor: "#fff0a8",
    radius: 15,
    speed: 220,
    maxHp: 88,
    attackRange: 160,
    attackDamage: 13,
    attackCooldown: 0.36,
    projectileSpeed: 620,
    attackStyle: "chain",
    aimMode: "free",
    attackHint: "Free-aim spark (chains on hit)",
    passive: {
      id: "overcharge",
      name: "Overcharge",
      blurb: "Kills grant +20% damage for 2s (refreshes).",
    },
    abilities: [
      {
        id: "zip",
        slot: "mobility",
        name: "Magnetic Zip",
        cooldown: 5,
        hint: "Snap toward aim (~130). Brief speed surge.",
      },
      {
        id: "stormcage",
        slot: "ultimate",
        name: "Storm Cage",
        cooldown: 10,
        hint: "Drop a lightning cage that shreds and slows enemies inside.",
      },
    ],
  },
  thorn: {
    id: "thorn",
    name: "Thorn",
    blurb: "Lane predator — vine shots that root, then bloom for blood.",
    color: "#6bcf5a",
    glowColor: "#b8f0a0",
    radius: 16,
    speed: 225,
    maxHp: 105,
    attackRange: 145,
    attackDamage: 16,
    attackCooldown: 0.4,
    projectileSpeed: 480,
    attackStyle: "vine",
    aimMode: "free",
    attackHint: "Free-aim vine bolt (roots)",
    passive: {
      id: "sap",
      name: "Sap",
      blurb: "Basic attacks heal for 12% of damage dealt.",
    },
    abilities: [
      {
        id: "burrow",
        slot: "mobility",
        name: "Burrow",
        cooldown: 5.5,
        hint: "Tunnel toward move/aim (~125) and gain a short bark barrier.",
      },
      {
        id: "bloom",
        slot: "ultimate",
        name: "Blood Bloom",
        cooldown: 9,
        hint: "Burst of thorns — heavy AoE damage and self-heal.",
      },
    ],
  },
  ember: {
    id: "ember",
    name: "Ember",
    blurb: "Pyromancer — scorched bolts and a lane-wide inferno.",
    color: "#ff6a3a",
    glowColor: "#ffc090",
    radius: 16,
    speed: 215,
    maxHp: 95,
    attackRange: 155,
    attackDamage: 15,
    attackCooldown: 0.36,
    projectileSpeed: 520,
    attackStyle: "emberbolt",
    aimMode: "free",
    attackHint: "Firebolt — burn DoT + splash",
    passive: {
      id: "scorch",
      name: "Scorch",
      blurb: "Basics splash 20% damage and leave a short burn.",
    },
    abilities: [
      {
        id: "flare",
        slot: "mobility",
        name: "Flare Dash",
        cooldown: 5,
        hint: "Blazing slide (~120) that scorches foes along the path.",
      },
      {
        id: "inferno",
        slot: "ultimate",
        name: "Inferno",
        cooldown: 10,
        hint: "Wide fire nova — heavy AoE burn.",
      },
    ],
  },
  void: {
    id: "void",
    name: "Void",
    blurb: "Assassin of rifts — blink in, collapse space.",
    color: "#7a5cff",
    glowColor: "#c8b0ff",
    radius: 15,
    speed: 235,
    maxHp: 85,
    attackRange: 130,
    attackDamage: 18,
    attackCooldown: 0.34,
    projectileSpeed: 680,
    attackStyle: "needle",
    aimMode: "free",
    attackHint: "Piercing void needle",
    passive: {
      id: "riftmark",
      name: "Riftmark",
      blurb: "Kills refund 15% of mobility cooldown.",
    },
    abilities: [
      {
        id: "rift",
        slot: "mobility",
        name: "Rift Step",
        cooldown: 4.5,
        hint: "Phase blink toward aim (~160) — brief untouchable window.",
      },
      {
        id: "singularity",
        slot: "ultimate",
        name: "Singularity",
        cooldown: 11,
        hint: "Pull and crush enemies in a void well.",
      },
    ],
  },
  titan: {
    id: "titan",
    name: "Titan",
    blurb: "Living siege engine — charge and quake the line.",
    color: "#c8a060",
    glowColor: "#ffe0a8",
    radius: 20,
    speed: 185,
    maxHp: 160,
    attackRange: 70,
    attackDamage: 30,
    attackCooldown: 0.55,
    projectileSpeed: 0,
    attackStyle: "cleave",
    aimMode: "engage",
    attackHint: "Aimed seismic cleave — need a foe in range",
    passive: {
      id: "bedrock",
      name: "Bedrock",
      blurb: "Take 15% less damage while barrier is active.",
    },
    abilities: [
      {
        id: "charge",
        slot: "mobility",
        name: "Bull Charge",
        cooldown: 6,
        hint: "Long charge (~150) with brief barrier.",
      },
      {
        id: "quake",
        slot: "ultimate",
        name: "Quake",
        cooldown: 9,
        hint: "Stomp AoE — damage and heavy slow.",
      },
    ],
  },
  mirage: {
    id: "mirage",
    name: "Mirage",
    blurb: "Illusionist — swap places and shatter mirror shards.",
    color: "#50d0d8",
    glowColor: "#a8f0f8",
    radius: 15,
    speed: 228,
    maxHp: 90,
    attackRange: 145,
    attackDamage: 14,
    attackCooldown: 0.33,
    projectileSpeed: 540,
    attackStyle: "echo",
    aimMode: "free",
    attackHint: "Twin echo bolts (slight spread)",
    passive: {
      id: "afterimage",
      name: "Afterimage",
      blurb: "After mobility, next basic deals +40% damage.",
    },
    abilities: [
      {
        id: "swapblink",
        slot: "mobility",
        name: "Swap Blink",
        cooldown: 5,
        hint: "Blink (~130). Marks next hit empowered.",
      },
      {
        id: "mirrorshard",
        slot: "ultimate",
        name: "Mirror Shard",
        cooldown: 9,
        hint: "Fan of piercing shards toward aim.",
      },
    ],
  },
  medic: {
    id: "medic",
    name: "Medic",
    blurb: "Field surgeon — heal yourself and harden the line.",
    color: "#70e090",
    glowColor: "#c0ffd0",
    radius: 16,
    speed: 218,
    maxHp: 110,
    attackRange: 140,
    attackDamage: 12,
    attackCooldown: 0.38,
    projectileSpeed: 420,
    attackStyle: "syringe",
    aimMode: "free",
    attackHint: "Syringe dart — heals you on hit",
    passive: {
      id: "triage",
      name: "Triage",
      blurb: "Between waves, heal 25% of missing HP.",
    },
    abilities: [
      {
        id: "fieldstep",
        slot: "mobility",
        name: "Field Step",
        cooldown: 5,
        hint: "Short field slide (~100) and heal 12 HP.",
      },
      {
        id: "sanctuary",
        slot: "ultimate",
        name: "Sanctuary",
        cooldown: 10,
        hint: "AoE heal pulse + barrier for 2s.",
      },
    ],
  },
  tempest: {
    id: "tempest",
    name: "Tempest",
    blurb: "Wind archer — gust reposition and cyclone pierce.",
    color: "#90c8ff",
    glowColor: "#d0e8ff",
    radius: 16,
    speed: 225,
    maxHp: 98,
    attackRange: 175,
    attackDamage: 16,
    attackCooldown: 0.34,
    projectileSpeed: 620,
    attackStyle: "wind",
    aimMode: "free",
    attackHint: "Piercing wind arrow (slows)",
    passive: {
      id: "gale",
      name: "Gale",
      blurb: "Basics briefly slow enemies by 20%.",
    },
    abilities: [
      {
        id: "gust",
        slot: "mobility",
        name: "Gust Step",
        cooldown: 4.8,
        hint: "Wind dash (~125) that knocks foes back slightly.",
      },
      {
        id: "cyclone",
        slot: "ultimate",
        name: "Cyclone",
        cooldown: 9,
        hint: "Piercing wind spear through the lane.",
      },
    ],
  },
  curses: {
    id: "curses",
    name: "Hex",
    blurb: "Dark hexer — soft-locks the enemy lane; weak personal damage, strong DoT zone.",
    color: "#a060c8",
    glowColor: "#e0a0ff",
    radius: 15,
    speed: 210,
    maxHp: 100,
    attackRange: 130,
    attackDamage: 8,
    attackCooldown: 0.42,
    projectileSpeed: 420,
    attackStyle: "hex",
    aimMode: "free",
    attackHint: "Hex bolt — poison DoT + slow",
    passive: {
      id: "hexmark",
      name: "Hex Mark",
      blurb: "Basics apply a poison DoT. Low personal DPS — clear with zones.",
    },
    abilities: [
      {
        id: "hexstep",
        slot: "mobility",
        name: "Hex Step",
        cooldown: 5.5,
        hint: "Blink (~100) and leave a DoT zone for 3s.",
      },
      {
        id: "hexstorm",
        slot: "ultimate",
        name: "Hex Storm",
        cooldown: 14,
        hint: "Pause and choose 1 of 3 curses to soft-lock the enemy lane.",
      },
    ],
  },
  warp: {
    id: "warp",
    name: "Warp",
    blurb: "Trickster — place linked pads, hop the lane, detonate the gate.",
    color: "#48c8e8",
    glowColor: "#a8f0ff",
    radius: 15,
    speed: 228,
    maxHp: 88,
    attackRange: 140,
    attackDamage: 9,
    attackCooldown: 0.4,
    projectileSpeed: 500,
    attackStyle: "warpbolt",
    aimMode: "free",
    attackHint: "Needle — pads also fire random bolts",
    passive: {
      id: "gatewalker",
      name: "Gatewalker",
      blurb: "After stepping a pad, gain +30% move speed for 1.2s. Leaving a pad pulses a shockwave.",
    },
    abilities: [
      {
        id: "padlink",
        slot: "mobility",
        name: "Pad Link",
        cooldown: 6,
        hint: "Place pad A, then B to link. Further casts alternate replacing A/B.",
      },
      {
        id: "echonova",
        slot: "ultimate",
        name: "Echo Nova",
        cooldown: 11,
        hint: "Detonate both pads (or yourself) for AoE damage and brief chill.",
      },
    ],
  },
  gyro: {
    id: "gyro",
    name: "Gyro",
    blurb: "Blade tank — spin for AoE, hook walls, shrug off contact.",
    color: "#c0c8d8",
    glowColor: "#e8f0ff",
    radius: 19,
    speed: 195,
    maxHp: 155,
    attackRange: 68,
    attackDamage: 11,
    attackCooldown: 0.1,
    projectileSpeed: 0,
    attackStyle: "spin",
    aimMode: "free",
    attackHint: "Hold attack to spin blades — AoE contact damage",
    passive: {
      id: "bladeguard",
      name: "Blade Guard",
      blurb: "Immune to enemy collision/contact damage while blades are wrapped. Projectiles still hurt.",
    },
    abilities: [
      {
        id: "bladehook",
        slot: "mobility",
        name: "Blade Hook",
        cooldown: 7,
        hint: "Hold to charge range, release to fire. Wall hit slings you; miss pulls you in.",
      },
      {
        id: "bladestorm",
        slot: "ultimate",
        name: "Blade Storm",
        cooldown: 14,
        hint: "Fire blades outward for huge hits, then reform slowly — vulnerable window.",
      },
    ],
  },
  lodestone: {
    id: "lodestone",
    name: "Lodestone",
    blurb: "Magnet controller — yank creeps into kill zones, then reverse the field.",
    color: "#6a8cff",
    glowColor: "#b8c8ff",
    radius: 17,
    speed: 205,
    maxHp: 115,
    attackRange: 145,
    attackDamage: 12,
    attackCooldown: 0.38,
    projectileSpeed: 480,
    attackStyle: "magnet",
    aimMode: "free",
    attackHint: "Magnet bolt — pulls foes a short distance on hit",
    passive: {
      id: "field_drag",
      name: "Field Drag",
      blurb: "Nearby enemies slowly drift toward you while you are alive.",
    },
    abilities: [
      {
        id: "polarpull",
        slot: "mobility",
        name: "Polar Pull",
        cooldown: 6,
        hint: "Dash (~100), then yank nearby enemies toward you.",
      },
      {
        id: "fluxburst",
        slot: "ultimate",
        name: "Flux Burst",
        cooldown: 12,
        hint: "Reverse polarity — blast nearby foes outward for heavy damage.",
      },
    ],
  },
  chrona: {
    id: "chrona",
    name: "Chrona",
    blurb: "Timeweaver — delayed echoes, blink scars, and stasis locks.",
    color: "#c8a0ff",
    glowColor: "#e8d0ff",
    radius: 15,
    speed: 222,
    maxHp: 90,
    attackRange: 155,
    attackDamage: 11,
    attackCooldown: 0.42,
    projectileSpeed: 400,
    attackStyle: "chrono",
    aimMode: "free",
    attackHint: "Chrono bolt — damage lands after a short delay",
    passive: {
      id: "rewind_ward",
      name: "Rewind Ward",
      blurb: "Damage taken is banked. After 2s without hits, heal 40% of banked damage.",
    },
    abilities: [
      {
        id: "timestep",
        slot: "mobility",
        name: "Time Step",
        cooldown: 5.5,
        hint: "Blink (~130) and leave a lingering damage scar for 2s.",
      },
      {
        id: "stasis",
        slot: "ultimate",
        name: "Stasis Field",
        cooldown: 13,
        hint: "Freeze and shred enemies in a large zone for 2.2s.",
      },
    ],
  },
  hive: {
    id: "hive",
    name: "Hive",
    blurb: "Swarmcaller — launch drones, orbit kills, and detonate the nest.",
    color: "#d4a020",
    glowColor: "#ffe08a",
    radius: 16,
    speed: 210,
    maxHp: 105,
    attackRange: 150,
    attackDamage: 10,
    attackCooldown: 0.36,
    projectileSpeed: 380,
    attackStyle: "drone",
    aimMode: "free",
    attackHint: "Seeking drone — homes on nearest foe briefly",
    passive: {
      id: "nest_memory",
      name: "Nest Memory",
      blurb: "Kills spawn an orbiting drone (max 5) that deals contact damage.",
    },
    abilities: [
      {
        id: "swarmdash",
        slot: "mobility",
        name: "Swarm Dash",
        cooldown: 5.5,
        hint: "Dash (~110). Extra range and trail damage per orbiting drone.",
      },
      {
        id: "hivedetonate",
        slot: "ultimate",
        name: "Hive Detonate",
        cooldown: 12,
        hint: "Explode all drones for AoE damage, then refill two.",
      },
    ],
  },
  gunner: {
    id: "gunner",
    name: "Gunner",
    blurb: "No dash — a walking arsenal. LMB machine gun; RMB fires the equipped heavy weapon; Ult cycles guns.",
    color: "#9aab80",
    glowColor: "#d0e0a8",
    radius: 17,
    speed: 200,
    maxHp: 118,
    attackRange: 82,
    attackDamage: 5,
    attackCooldown: 0.12,
    projectileSpeed: 760,
    attackStyle: "machinegun",
    aimMode: "free",
    attackHint: "Rapid-fire machine gun — low damage per hit",
    passive: {
      id: "walking_arsenal",
      name: "Walking Arsenal",
      blurb: "Eight ultimate weapons. Ult cycles; RMB fires. Snipers lock movement (solo freeze).",
    },
    abilities: [
      {
        id: "gunfire",
        slot: "mobility",
        name: "Fire Weapon",
        cooldown: 0.4,
        hint: "Hold to fire / aim / charge the equipped ultimate weapon (not a dash).",
      },
      {
        id: "gunswap",
        slot: "ultimate",
        name: "Swap Weapon",
        cooldown: 0.4,
        hint: "Cycle Rockets → Bolt Sniper → Auto Sniper → Shotgun → BR → AR → LMG → Laser. Locked while reloading.",
      },
    ],
  },
  sapper: {
    id: "sapper",
    name: "Sapper",
    blurb: "Demolitions — lob grenades, seed the lane with mines, then detonate the field.",
    color: "#c87840",
    glowColor: "#f0c080",
    radius: 16,
    speed: 215,
    maxHp: 108,
    attackRange: 150,
    attackDamage: 14,
    attackCooldown: 0.6,
    projectileSpeed: 340,
    attackStyle: "grenade",
    aimMode: "free",
    attackHint: "Lobbed grenade — arcs to aim and bursts on impact",
    passive: {
      id: "demolition",
      name: "Demolition",
      blurb: "Mine kills refund 25% of Plant Mine cooldown. Armed mines pulse visibly.",
    },
    abilities: [
      {
        id: "plantmine",
        slot: "mobility",
        name: "Plant Mine",
        cooldown: 5.5,
        hint: "Drop an armed mine at your feet (~1.2s arm). Up to 5 active.",
      },
      {
        id: "detonate",
        slot: "ultimate",
        name: "Detonate",
        cooldown: 11,
        hint: "Explode all armed mines for heavy AoE. Unusable with no armed mines.",
      },
    ],
  },
  vector: {
    id: "vector",
    name: "Vector",
    blurb: "Momentum fighter — move to charge kinetic power, then spend it on dash or shockwave.",
    color: "#ff8a40",
    glowColor: "#ffd080",
    radius: 16,
    speed: 232,
    maxHp: 96,
    attackRange: 145,
    attackDamage: 13,
    attackCooldown: 0.34,
    projectileSpeed: 560,
    attackStyle: "kinetic",
    aimMode: "free",
    attackHint: "Kinetic slug — damage and pierce scale with momentum",
    passive: {
      id: "inertia",
      name: "Inertia",
      blurb: "Build Momentum while moving (cap 100). High momentum: +damage, attack speed, pierce.",
    },
    abilities: [
      {
        id: "momentumdash",
        slot: "mobility",
        name: "Momentum Dash",
        cooldown: 5,
        hint: "Spend momentum for a long dash; low momentum = short hop.",
      },
      {
        id: "kineticburst",
        slot: "ultimate",
        name: "Kinetic Burst",
        cooldown: 12,
        hint: "Convert all momentum into a shockwave — damage and knockback scale with charge.",
      },
    ],
  },
  cloud: {
    id: "cloud",
    name: "Cloud",
    blurb: "Poison ninja — dash through foes, ricochet the lane walls, blank them in gas.",
    color: "#5ec878",
    glowColor: "#a8f0b8",
    radius: 15,
    speed: 272,
    maxHp: 108,
    attackRange: 110,
    attackDamage: 11,
    attackCooldown: 0.62,
    projectileSpeed: 0,
    attackStyle: "poisondash",
    aimMode: "free",
    attackHint: "Poison Dash — zoom through foes; no contact damage; applies poison",
    passive: {
      id: "venom_cache",
      name: "Venom Cache",
      blurb: "Poisoned kills leave a tiny poison puff. Poison never heals you.",
    },
    abilities: [
      {
        id: "walldart",
        slot: "mobility",
        name: "Wall Dart",
        cooldown: 2.8,
        hint: "Brief pause, then zip top↔bottom twice. Drop a small poison cloud on each wall hit.",
      },
      {
        id: "gasspew",
        slot: "ultimate",
        name: "Gas Spew",
        cooldown: 13,
        hint: "Spew poison clouds while moving/dashing for a few seconds. Enemies in clouds stack poison.",
      },
    ],
  },
};

export const HERO_LIST: HeroDef[] = [
  HEROES.ranger,
  HEROES.warden,
  HEROES.scatter,
  HEROES.arbalest,
  HEROES.prism,
  HEROES.frost,
  HEROES.wizard,
  HEROES.coil,
  HEROES.thorn,
  HEROES.ember,
  HEROES.void,
  HEROES.titan,
  HEROES.mirage,
  HEROES.medic,
  HEROES.tempest,
  HEROES.curses,
  HEROES.warp,
  HEROES.gyro,
  HEROES.lodestone,
  HEROES.chrona,
  HEROES.hive,
  HEROES.gunner,
  HEROES.sapper,
  HEROES.vector,
  HEROES.cloud,
];

export function heroRarity(_id: HeroId): Rarity {
  return "rare";
}
