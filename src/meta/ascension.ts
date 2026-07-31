/** Ascension difficulty — cumulative modifiers (StS-style). */

export const MAX_ASCENSION = 12;

export type AscensionDef = {
  level: number;
  name: string;
  blurb: string;
};

/** Flavor names per level; effects are stacked from 1..N in compose. */
export const ASCENSIONS: AscensionDef[] = [
  { level: 0, name: "Standard", blurb: "No extra pressure." },
  { level: 1, name: "Hardened Creeps", blurb: "Enemies have +12% HP." },
  { level: 2, name: "Light Purse", blurb: "−12 starting gold." },
  { level: 3, name: "Sharper Blades", blurb: "Enemy damage +12%." },
  { level: 4, name: "Short Breath", blurb: "Wave breaks 20% shorter." },
  { level: 5, name: "Swarming Tide", blurb: "+15% enemies per wave." },
  { level: 6, name: "Taxed Income", blurb: "Your income −12%." },
  { level: 7, name: "Hostile Neighbor", blurb: "Opponent sends more aggressively." },
  { level: 8, name: "War Profiteers", blurb: "Shop prices +12%." },
  { level: 9, name: "Ascendant Elites", blurb: "Elite/boss HP +20%." },
  { level: 10, name: "Long Road Back", blurb: "Respawn times +20%." },
  { level: 11, name: "Scant Spoils", blurb: "Kill gold −15%." },
  { level: 12, name: "March of Iron", blurb: "Enemies move +8% faster." },
];

export function ascensionLabel(level: number): string {
  const def = ASCENSIONS.find((a) => a.level === level) ?? ASCENSIONS[0]!;
  return level <= 0 ? "A0 · Standard" : `A${level} · ${def.name}`;
}

/** All active effect blurbs for levels 1..ascension (cumulative). */
export function ascensionStackBlurbs(ascension: number): string[] {
  return ASCENSIONS.filter((a) => a.level >= 1 && a.level <= ascension).map(
    (a) => `A${a.level}: ${a.blurb}`,
  );
}
