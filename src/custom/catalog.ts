/** Editor pick lists derived from builtin heroes. */

import {
  HERO_LIST,
  type AbilityDef,
  type AbilityKind,
  type AimMode,
  type AttackStyle,
  type HeroPassive,
} from "../data/heroes";

export type AbilityTemplate = AbilityDef;

const abilityByKind = new Map<AbilityKind, AbilityTemplate>();
for (const h of HERO_LIST) {
  for (const a of h.abilities) {
    if (!abilityByKind.has(a.id)) abilityByKind.set(a.id, { ...a });
  }
}

export const ABILITY_TEMPLATES: AbilityTemplate[] = [...abilityByKind.values()].sort((a, b) =>
  a.name.localeCompare(b.name),
);

export const MOBILITY_ABILITIES = ABILITY_TEMPLATES.filter((a) => a.slot === "mobility");
export const ULTIMATE_ABILITIES = ABILITY_TEMPLATES.filter((a) => a.slot === "ultimate");

const passiveById = new Map<string, HeroPassive>();
for (const h of HERO_LIST) {
  if (!passiveById.has(h.passive.id)) passiveById.set(h.passive.id, { ...h.passive });
}

export const PASSIVE_CATALOG: HeroPassive[] = [...passiveById.values()].sort((a, b) =>
  a.name.localeCompare(b.name),
);

export const ATTACK_STYLES: AttackStyle[] = [
  "bolt",
  "cleave",
  "shotgun",
  "heavy",
  "beam",
  "frostbolt",
  "chaos",
  "chain",
  "vine",
  "hex",
  "spin",
  "wind",
  "syringe",
  "emberbolt",
  "needle",
  "echo",
  "warpbolt",
];

export const AIM_MODES: AimMode[] = ["free", "engage", "auto"];

export function abilityTemplate(kind: AbilityKind): AbilityTemplate | undefined {
  return abilityByKind.get(kind);
}

export function passiveTemplate(id: string): HeroPassive | undefined {
  return passiveById.get(id);
}
