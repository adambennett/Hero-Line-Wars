/** Barracks meta upgrades — permanent War Crest purchases. */

export type MetaUpgradeId =
  | "war_chest"
  | "supply_lines"
  | "fortified_keep"
  | "field_medic"
  | "quartermaster"
  | "scout_network"
  | "drill_yard"
  | "turret_permit"
  | "unlock_coil"
  | "unlock_thorn";

export type MetaUpgradeDef = {
  id: MetaUpgradeId;
  name: string;
  blurb: string;
  maxRank: number;
  /** Crest cost for rank 1, 2, … */
  costs: number[];
  /** One-time unlock (hero) vs rankable passive. */
  kind: "rank" | "unlock";
};

export const META_UPGRADES: MetaUpgradeDef[] = [
  {
    id: "war_chest",
    name: "War Chest",
    blurb: "+8 starting gold per rank.",
    maxRank: 5,
    costs: [12, 20, 32, 48, 70],
    kind: "rank",
  },
  {
    id: "supply_lines",
    name: "Supply Lines",
    blurb: "+0.3 gold/sec income per rank.",
    maxRank: 4,
    costs: [15, 28, 45, 70],
    kind: "rank",
  },
  {
    id: "fortified_keep",
    name: "Fortified Keep",
    blurb: "+8% base HP per rank.",
    maxRank: 4,
    costs: [18, 30, 50, 75],
    kind: "rank",
  },
  {
    id: "field_medic",
    name: "Field Medic",
    blurb: "−8% respawn time per rank.",
    maxRank: 3,
    costs: [20, 35, 55],
    kind: "rank",
  },
  {
    id: "quartermaster",
    name: "Quartermaster",
    blurb: "−5% shop prices per rank.",
    maxRank: 3,
    costs: [22, 40, 65],
    kind: "rank",
  },
  {
    id: "scout_network",
    name: "Scout Network",
    blurb: "R1: start with a common relic. R2: uncommon+. R3: rare+.",
    maxRank: 3,
    costs: [30, 55, 90],
    kind: "rank",
  },
  {
    id: "drill_yard",
    name: "Drill Yard",
    blurb: "Start each run with a free level-up draft.",
    maxRank: 1,
    costs: [40],
    kind: "rank",
  },
  {
    id: "turret_permit",
    name: "Turret Permit",
    blurb: "+1 max turret slot at run start.",
    maxRank: 1,
    costs: [50],
    kind: "rank",
  },
  {
    id: "unlock_coil",
    name: "Commission: Coil",
    blurb: "Unlock the Tesla hero Coil for all modes.",
    maxRank: 1,
    costs: [45],
    kind: "unlock",
  },
  {
    id: "unlock_thorn",
    name: "Commission: Thorn",
    blurb: "Unlock the vine hero Thorn for all modes.",
    maxRank: 1,
    costs: [55],
    kind: "unlock",
  },
];

export function upgradeDef(id: MetaUpgradeId): MetaUpgradeDef {
  return META_UPGRADES.find((u) => u.id === id)!;
}

export function nextCost(id: MetaUpgradeId, currentRank: number): number | null {
  const def = upgradeDef(id);
  if (currentRank >= def.maxRank) return null;
  return def.costs[currentRank] ?? null;
}
