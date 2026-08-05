/**
 * Armor & energy shields for heroes and enemies.
 * Shields absorb first (low capacity, full regen after a quiet period).
 * Armor mitigates a chunk of remaining damage and chips down permanently.
 */

export type DefensePool = {
  armor: number;
  maxArmor: number;
  shield: number;
  maxShield: number;
  /** Seconds since last damage that touched shield/armor/hp. */
  shieldQuiet: number;
};

export const SHIELD_REGEN_DELAY = 3.2;

export function emptyDefense(): DefensePool {
  return { armor: 0, maxArmor: 0, shield: 0, maxShield: 0, shieldQuiet: 0 };
}

export function tickDefenseRegen(d: DefensePool, dt: number): void {
  if (d.maxShield <= 0) return;
  if (d.shield >= d.maxShield) {
    d.shieldQuiet = SHIELD_REGEN_DELAY;
    return;
  }
  d.shieldQuiet += dt;
  if (d.shieldQuiet >= SHIELD_REGEN_DELAY) {
    d.shield = d.maxShield;
  }
}

export type MitigateResult = {
  /** Damage that should hit HP. */
  hpDamage: number;
  shieldAbsorbed: number;
  armorBlocked: number;
};

/**
 * Apply defensive layers to raw incoming damage.
 * Order: shield → armor mitigation/chip → leftover to HP.
 */
export function mitigateDamage(d: DefensePool, raw: number): MitigateResult {
  let remaining = Math.max(0, raw);
  let shieldAbsorbed = 0;
  let armorBlocked = 0;

  if (remaining > 0 && d.shield > 0) {
    shieldAbsorbed = Math.min(d.shield, remaining);
    d.shield -= shieldAbsorbed;
    remaining -= shieldAbsorbed;
    d.shieldQuiet = 0;
  }

  if (remaining > 0 && d.armor > 0) {
    // Soft mitigation curve — high armor feels tanky but never immune.
    const mitigation = Math.min(0.62, d.armor / (d.armor + 45));
    armorBlocked = remaining * mitigation;
    remaining -= armorBlocked;
    // Armor chips slower than damage blocked so stacks stay meaningful.
    const chip = Math.max(0.35, armorBlocked * 0.55);
    d.armor = Math.max(0, d.armor - chip);
    d.shieldQuiet = 0;
  } else if (remaining > 0) {
    d.shieldQuiet = 0;
  }

  return { hpDamage: remaining, shieldAbsorbed, armorBlocked };
}

/** Bonus damage vs armored / shielded targets (for ability variance). */
export function armorBreakBonus(armor: number): number {
  return armor > 0 ? 1.12 : 1;
}

export function shieldBreakBonus(shield: number): number {
  return shield > 0 ? 1.1 : 1;
}
