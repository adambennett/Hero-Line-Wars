/** Wave-scaled dedicated shop Reroll Token pricing + run-long stock reroll. */

export function shopRerollBaseCost(wave: number): number {
  const w = Math.max(1, Math.floor(wave));
  return Math.round(28 + (w - 1) * 10);
}

export function shopRerollPriceStep(wave: number): number {
  const w = Math.max(1, Math.floor(wave));
  return Math.round(18 + (w - 1) * 7);
}

export function shopRerollCost(wave: number, purchasesThisWave: number): number {
  return shopRerollBaseCost(wave) + Math.max(0, purchasesThisWave) * shopRerollPriceStep(wave);
}

/** Stock refresh (shop inventory) — cost only rises within a run. */
export function shopStockRerollBaseCost(): number {
  return 35;
}

export function shopStockRerollStep(): number {
  return 22;
}

export function shopStockRerollCost(purchasesThisRun: number, discount = 0): number {
  const raw =
    shopStockRerollBaseCost() + Math.max(0, purchasesThisRun) * shopStockRerollStep() - discount;
  return Math.max(8, Math.round(raw));
}
