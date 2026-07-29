import type { Rarity } from "./rarity";

export type HeroId =
  | "ranger"
  | "warden"
  | "scatter"
  | "arbalest"
  | "prism"
  | "frost"
  | "wizard";

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
  | "chaosburst";

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
  | "chaos";

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
  /** Short line for UI / compendium. */
  attackHint: string;
  passive: HeroPassive;
  /** Order: mobility, then ultimate. */
  abilities: [AbilityDef, AbilityDef];
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
    attackHint: "Fast single bolt",
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
    attackHint: "Melee cleave arc",
    passive: {
      id: "bastion",
      name: "Bastion",
      blurb: "At the start of each wave, gain a 1.8s damage barrier.",
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
    attackHint: "5-pellet shotgun spread",
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
    attackHint: "Slow piercing bolt",
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
    attackDamage: 14,
    attackCooldown: 0.12,
    projectileSpeed: 0,
    attackStyle: "beam",
    attackHint: "Continuous beam DoT",
    passive: {
      id: "refraction",
      name: "Refraction",
      blurb: "Beam hits splash 25% damage to one nearby enemy.",
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
    attackHint: "Ice bolt that slows on hit",
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
    name: "RNG Wizard",
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
    attackHint: "Cycles random attack modes each shot",
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
};

export const HERO_LIST: HeroDef[] = [
  HEROES.ranger,
  HEROES.warden,
  HEROES.scatter,
  HEROES.arbalest,
  HEROES.prism,
  HEROES.frost,
  HEROES.wizard,
];

export function heroRarity(_id: HeroId): Rarity {
  return "rare";
}
