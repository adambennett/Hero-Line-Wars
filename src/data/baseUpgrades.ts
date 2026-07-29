/** Base upgrade ladder — unlocks stronger send packs. */

export const MAX_BASE_LEVEL = 4;

/** Gold cost to go from `currentLevel` → `currentLevel + 1`. */
export function baseUpgradeCost(currentLevel: number): number {
  const costs = [80, 150, 250, 400];
  return costs[currentLevel] ?? Infinity;
}

export function canUpgradeBase(level: number): boolean {
  return level < MAX_BASE_LEVEL;
}
