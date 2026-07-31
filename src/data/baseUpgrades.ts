/** Base upgrade ladder — unlocks send packs, then scales them forever. */

/** Levels 0→1 … 3→4 use these; further upgrades use a growth formula. */
const EARLY_COSTS = [80, 150, 250, 400];

/** Gold cost to go from `currentLevel` → `currentLevel + 1`. Always available. */
export function baseUpgradeCost(currentLevel: number): number {
  if (currentLevel < EARLY_COSTS.length) return EARLY_COSTS[currentLevel]!;
  // Soft exponential so send-spam builds keep a sink forever
  const over = currentLevel - (EARLY_COSTS.length - 1);
  return Math.round(400 * Math.pow(1.38, over));
}

/** Always true — base level has no hard cap. */
export function canUpgradeBase(_level: number): boolean {
  return true;
}
