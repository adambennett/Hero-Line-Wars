/**
 * Hero-specific level-up bonuses — rare drops offered only to the matching hero.
 * Gunner gets 6 (weapon specialization); everyone else gets 3.
 */
import type { HeroId } from "./heroes";
import type { GunnerWeaponId } from "./gunnerWeapons";
import type { Rarity } from "./rarity";

export type PerkEffects = {
  damageMul?: number;
  attackCdMul?: number;
  moveSpeedFlat?: number;
  maxHpFlat?: number;
  mobilityCdMul?: number;
  ultimateCdMul?: number;
  abilityDamageMul?: number;
  abilityAreaMul?: number;
  /** Scales hero passive strength where wired. */
  passiveMul?: number;
  /** Gunner: boost a specific ultimate weapon. */
  gun?: GunnerWeaponId;
  gunDamageMul?: number;
  gunClipBonus?: number;
  gunReloadMul?: number;
  gunCdMul?: number;
  /** Sapper: mine / grenade scalars. */
  mineDamageMul?: number;
  mineArmMul?: number;
  /** Vector: momentum scalars. */
  momentumGainMul?: number;
  momentumCapBonus?: number;
};

export type HeroPerkDef = {
  id: string;
  heroId: HeroId;
  name: string;
  blurb: string;
  tag: string;
  rarity: Rarity;
  effects: PerkEffects;
};

function p(
  id: string,
  heroId: HeroId,
  name: string,
  blurb: string,
  tag: string,
  rarity: Rarity,
  effects: PerkEffects,
): HeroPerkDef {
  return { id, heroId, name, blurb, tag, rarity, effects };
}

export const HERO_PERK_DEFS: HeroPerkDef[] = [
  // Ranger
  p("ranger_hunters_cadence", "ranger", "Hunter's Cadence", "Basics 8% faster; Marksman lasts longer.", "Passive", "rare", { attackCdMul: 0.92, passiveMul: 1.5 }),
  p("ranger_trailblazer", "ranger", "Trailblazer", "Dash cools 18% faster.", "Mobility", "mythic", { mobilityCdMul: 0.82 }),
  p("ranger_skyfall", "ranger", "Skyfall Volley", "Volley deals +30% damage.", "Ultimate", "legendary", { abilityDamageMul: 1.3, ultimateCdMul: 0.9 }),
  // Warden
  p("warden_iron_bastion", "warden", "Iron Bastion", "+25 max HP; Bastion barrier stronger.", "Passive", "rare", { maxHpFlat: 25, passiveMul: 1.35 }),
  p("warden_bulwark_tempo", "warden", "Bulwark Tempo", "Bulwark Step cools 20% faster.", "Mobility", "mythic", { mobilityCdMul: 0.8 }),
  p("warden_tempest_spin", "warden", "Tempest Spin", "Whirlwind +25% damage and area.", "Ultimate", "legendary", { abilityDamageMul: 1.25, abilityAreaMul: 1.2 }),
  // Scatter
  p("scatter_point_blank", "scatter", "Point Blank", "Close Quarters +15% more damage.", "Passive", "rare", { passiveMul: 1.5, damageMul: 1.06 }),
  p("scatter_greased_slide", "scatter", "Greased Slide", "Slide cools 22% faster.", "Mobility", "mythic", { mobilityCdMul: 0.78 }),
  p("scatter_pellet_storm", "scatter", "Pellet Storm", "Buckstorm +35% damage.", "Ultimate", "legendary", { abilityDamageMul: 1.35 }),
  // Arbalest
  p("arbalest_siege_optics", "arbalest", "Siege Optics", "Siege Focus +20%; +4 damage.", "Passive", "rare", { passiveMul: 1.5, damageMul: 1.08 }),
  p("arbalest_anchor_chain", "arbalest", "Anchor Chain", "Anchor Step cools 18% faster.", "Mobility", "mythic", { mobilityCdMul: 0.82 }),
  p("arbalest_breach_bolt", "arbalest", "Breach Bolt", "Siege Bolt +30% damage.", "Ultimate", "legendary", { abilityDamageMul: 1.3 }),
  // Prism
  p("prism_refraction_lens", "prism", "Refraction Lens", "Beam splash +40%.", "Passive", "rare", { passiveMul: 1.4, damageMul: 1.08 }),
  p("prism_phase_lattice", "prism", "Phase Lattice", "Phase Blink cools 20% faster.", "Mobility", "mythic", { mobilityCdMul: 0.8 }),
  p("prism_nova_core", "prism", "Nova Core", "Prism Storm +30% damage/area.", "Ultimate", "legendary", { abilityDamageMul: 1.3, abilityAreaMul: 1.15 }),
  // Frost
  p("frost_deep_freeze", "frost", "Deep Freeze", "Shop freeze + chill basics stronger.", "Passive", "rare", { passiveMul: 1.4, damageMul: 1.06 }),
  p("frost_ice_skates", "frost", "Ice Skates", "Ice Glide cools 20% faster.", "Mobility", "mythic", { mobilityCdMul: 0.8 }),
  p("frost_whiteout", "frost", "Whiteout", "Frost Nova +30% damage/area.", "Ultimate", "legendary", { abilityDamageMul: 1.3, abilityAreaMul: 1.2 }),
  // Chaos (wizard)
  p("wizard_loaded_dice", "wizard", "Loaded Dice", "Wild Magic procs hit harder.", "Passive", "rare", { passiveMul: 1.35, damageMul: 1.1 }),
  p("wizard_unstable_step", "wizard", "Unstable Step", "Unstable Blink cools 18% faster.", "Mobility", "mythic", { mobilityCdMul: 0.82 }),
  p("wizard_entropy_peak", "wizard", "Entropy Peak", "Chaos Burst +35% damage.", "Ultimate", "legendary", { abilityDamageMul: 1.35 }),
  // Coil
  p("coil_overclock", "coil", "Overclock", "Overcharge lasts longer; +5% damage.", "Passive", "rare", { passiveMul: 1.4, damageMul: 1.05 }),
  p("coil_magnetic_rails", "coil", "Magnetic Rails", "Magnetic Zip cools 20% faster.", "Mobility", "mythic", { mobilityCdMul: 0.8 }),
  p("coil_faraday_cage", "coil", "Faraday Cage", "Storm Cage +30% damage.", "Ultimate", "legendary", { abilityDamageMul: 1.3 }),
  // Thorn
  p("thorn_deep_sap", "thorn", "Deep Sap", "Sap heals +40% more.", "Passive", "rare", { passiveMul: 1.4 }),
  p("thorn_root_tunnel", "thorn", "Root Tunnel", "Burrow cools 18% faster.", "Mobility", "mythic", { mobilityCdMul: 0.82 }),
  p("thorn_crimson_bloom", "thorn", "Crimson Bloom", "Blood Bloom +30% damage/heal.", "Ultimate", "legendary", { abilityDamageMul: 1.3 }),
  // Ember
  p("ember_white_hot", "ember", "White Hot", "Scorch splash/burn +35%.", "Passive", "rare", { passiveMul: 1.35, damageMul: 1.06 }),
  p("ember_cinder_dash", "ember", "Cinder Dash", "Flare Dash cools 20% faster.", "Mobility", "mythic", { mobilityCdMul: 0.8 }),
  p("ember_worldfire", "ember", "Worldfire", "Inferno +30% damage/area.", "Ultimate", "legendary", { abilityDamageMul: 1.3, abilityAreaMul: 1.2 }),
  // Void
  p("void_rift_echo", "void", "Rift Echo", "Riftmark refunds more mobility CD.", "Passive", "rare", { passiveMul: 1.5 }),
  p("void_shadow_step", "void", "Shadow Step", "Rift Step cools 18% faster.", "Mobility", "mythic", { mobilityCdMul: 0.82 }),
  p("void_event_horizon", "void", "Event Horizon", "Singularity +30% damage/area.", "Ultimate", "legendary", { abilityDamageMul: 1.3, abilityAreaMul: 1.2 }),
  // Titan
  p("titan_living_stone", "titan", "Living Stone", "+30 max HP; Bedrock stronger.", "Passive", "rare", { maxHpFlat: 30, passiveMul: 1.3 }),
  p("titan_bull_rush", "titan", "Bull Rush", "Bull Charge cools 18% faster.", "Mobility", "mythic", { mobilityCdMul: 0.82 }),
  p("titan_fault_line", "titan", "Fault Line", "Quake +30% damage/area.", "Ultimate", "legendary", { abilityDamageMul: 1.3, abilityAreaMul: 1.2 }),
  // Mirage
  p("mirage_double_image", "mirage", "Double Image", "Afterimage bonus +25%.", "Passive", "rare", { passiveMul: 1.4, damageMul: 1.05 }),
  p("mirage_quick_swap", "mirage", "Quick Swap", "Swap Blink cools 20% faster.", "Mobility", "mythic", { mobilityCdMul: 0.8 }),
  p("mirage_shard_storm", "mirage", "Shard Storm", "Mirror Shard +30% damage.", "Ultimate", "legendary", { abilityDamageMul: 1.3 }),
  // Medic
  p("medic_field_triage", "medic", "Field Triage", "Between-wave heal +40%.", "Passive", "rare", { passiveMul: 1.4, maxHpFlat: 15 }),
  p("medic_combat_slide", "medic", "Combat Slide", "Field Step cools 20% faster.", "Mobility", "mythic", { mobilityCdMul: 0.8 }),
  p("medic_aegis_ward", "medic", "Aegis Ward", "Sanctuary +30% heal/barrier.", "Ultimate", "legendary", { abilityDamageMul: 1.3 }),
  // Tempest
  p("tempest_cutting_gale", "tempest", "Cutting Gale", "Gale slow stronger; +5% damage.", "Passive", "rare", { passiveMul: 1.35, damageMul: 1.05 }),
  p("tempest_tailwind", "tempest", "Tailwind", "Gust Step cools 20% faster.", "Mobility", "mythic", { mobilityCdMul: 0.8 }),
  p("tempest_eye_storm", "tempest", "Eye of the Storm", "Cyclone +30% damage.", "Ultimate", "legendary", { abilityDamageMul: 1.3 }),
  // Hex (curses)
  p("curses_virulent_mark", "curses", "Virulent Mark", "Hex Mark DoT +40%.", "Passive", "rare", { passiveMul: 1.4 }),
  p("curses_hex_skitter", "curses", "Hex Skitter", "Hex Step cools 18% faster.", "Mobility", "mythic", { mobilityCdMul: 0.82 }),
  p("curses_black_mass", "curses", "Black Mass", "Hex Storm cools 15% faster.", "Ultimate", "legendary", { ultimateCdMul: 0.85, abilityAreaMul: 1.15 }),
  // Warp
  p("warp_gate_surge", "warp", "Gate Surge", "Gatewalker speed lasts longer.", "Passive", "rare", { passiveMul: 1.4, moveSpeedFlat: 12 }),
  p("warp_pad_engineer", "warp", "Pad Engineer", "Pad Link cools 18% faster.", "Mobility", "mythic", { mobilityCdMul: 0.82 }),
  p("warp_echo_collapse", "warp", "Echo Collapse", "Echo Nova +30% damage/area.", "Ultimate", "legendary", { abilityDamageMul: 1.3, abilityAreaMul: 1.2 }),
  // Gyro
  p("gyro_tempered_guard", "gyro", "Tempered Guard", "+20 max HP; Blade Guard stronger.", "Passive", "rare", { maxHpFlat: 20, passiveMul: 1.25 }),
  p("gyro_hook_mastery", "gyro", "Hook Mastery", "Blade Hook cools 18% faster.", "Mobility", "mythic", { mobilityCdMul: 0.82 }),
  p("gyro_maelstrom", "gyro", "Maelstrom", "Blade Storm +30% damage.", "Ultimate", "legendary", { abilityDamageMul: 1.3 }),
  // Lodestone
  p("lodestone_deep_drag", "lodestone", "Deep Drag", "Field Drag pulls harder.", "Passive", "rare", { passiveMul: 1.4 }),
  p("lodestone_polar_snap", "lodestone", "Polar Snap", "Polar Pull cools 18% faster.", "Mobility", "mythic", { mobilityCdMul: 0.82 }),
  p("lodestone_flux_bomb", "lodestone", "Flux Bomb", "Flux Burst +30% damage/area.", "Ultimate", "legendary", { abilityDamageMul: 1.3, abilityAreaMul: 1.2 }),
  // Chrona
  p("chrona_deep_rewind", "chrona", "Deep Rewind", "Rewind Ward heals +25% more.", "Passive", "rare", { passiveMul: 1.4 }),
  p("chrona_scar_step", "chrona", "Scar Step", "Time Step cools 18% faster.", "Mobility", "mythic", { mobilityCdMul: 0.82 }),
  p("chrona_locked_moment", "chrona", "Locked Moment", "Stasis Field +25% duration/damage.", "Ultimate", "legendary", { abilityDamageMul: 1.25, abilityAreaMul: 1.15 }),
  // Hive
  p("hive_brood_memory", "hive", "Brood Memory", "Nest Memory max drones +1 effect.", "Passive", "rare", { passiveMul: 1.4 }),
  p("hive_swarm_path", "hive", "Swarm Path", "Swarm Dash cools 18% faster.", "Mobility", "mythic", { mobilityCdMul: 0.82 }),
  p("hive_nest_bomb", "hive", "Nest Bomb", "Hive Detonate +30% damage.", "Ultimate", "legendary", { abilityDamageMul: 1.3 }),
  // Gunner (6)
  p("gunner_belt_feed", "gunner", "Belt Feed", "Machine gun +12% damage and fire rate.", "Passive", "rare", { damageMul: 1.12, attackCdMul: 0.9, passiveMul: 1.2 }),
  p("gunner_rocket_rack", "gunner", "Rocket Rack", "Rockets +25% damage, −15% reload.", "Arsenal", "rare", { gun: "rockets", gunDamageMul: 1.25, gunReloadMul: 0.85 }),
  p("gunner_cold_bore", "gunner", "Cold Bore", "Both snipers +20% damage; steadier aim.", "Arsenal", "mythic", { gun: "bolt_sniper", gunDamageMul: 1.2 }),
  p("gunner_drum_mag", "gunner", "Drum Mag", "AR / BR / Shotgun +6 clip, −12% reload.", "Arsenal", "mythic", { gun: "ar", gunClipBonus: 6, gunReloadMul: 0.88 }),
  p("gunner_spin_governor", "gunner", "Spin Governor", "LMG +20% damage, less move penalty.", "Arsenal", "legendary", { gun: "lmg", gunDamageMul: 1.2, gunCdMul: 0.9 }),
  p("gunner_lens_cooling", "gunner", "Lens Cooling", "Laser +20% damage; −25% self-damage.", "Arsenal", "legendary", { gun: "laser", gunDamageMul: 1.2 }),
  // Sapper
  p("sapper_shaped_charge", "sapper", "Shaped Charge", "Grenades +15% damage; mines arm faster.", "Passive", "rare", { damageMul: 1.15, mineArmMul: 0.75, passiveMul: 1.3 }),
  p("sapper_tripwire", "sapper", "Tripwire Kit", "Plant Mine cools 20% faster.", "Mobility", "mythic", { mobilityCdMul: 0.8, mineDamageMul: 1.15 }),
  p("sapper_chain_reaction", "sapper", "Chain Reaction", "Detonate +35% damage/area.", "Ultimate", "legendary", { abilityDamageMul: 1.35, abilityAreaMul: 1.2, mineDamageMul: 1.2 }),
  // Vector
  p("vector_inertia_core", "vector", "Inertia Core", "Momentum builds 25% faster; +10 cap.", "Passive", "rare", { momentumGainMul: 1.25, momentumCapBonus: 10, passiveMul: 1.3 }),
  p("vector_slipstream", "vector", "Slipstream", "Momentum Dash cools 18% faster.", "Mobility", "mythic", { mobilityCdMul: 0.82, moveSpeedFlat: 15 }),
  p("vector_shock_release", "vector", "Shock Release", "Kinetic Burst +30% damage/area.", "Ultimate", "legendary", { abilityDamageMul: 1.3, abilityAreaMul: 1.2 }),
];

export const HERO_PERKS: Record<string, HeroPerkDef> = Object.fromEntries(
  HERO_PERK_DEFS.map((d) => [d.id, d]),
);

export type HeroPerkId = (typeof HERO_PERK_DEFS)[number]["id"];

export function isHeroPerkId(id: string): id is HeroPerkId {
  return Object.prototype.hasOwnProperty.call(HERO_PERKS, id);
}

export function heroPerksFor(heroId: HeroId): HeroPerkDef[] {
  return HERO_PERK_DEFS.filter((p) => p.heroId === heroId);
}

/** Draft weight — commons dominate; hero perks are uncommon pulls. */
export function perkDraftWeight(rarity: Rarity): number {
  switch (rarity) {
    case "common":
      return 24;
    case "uncommon":
      return 12;
    case "rare":
      return 6;
    case "mythic":
      return 3;
    case "legendary":
      return 1;
  }
}
