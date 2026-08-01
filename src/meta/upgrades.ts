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
  | "unlock_thorn"
  | "unlock_ember"
  | "unlock_void"
  | "unlock_titan"
  | "unlock_mirage"
  | "unlock_medic"
  | "unlock_tempest"
  | "crest_forge"
  | "bounty_board"
  | "veteran_pay"
  | "lane_optics"
  | "steel_ration"
  | "courier_guild"
  | "arcane_cache"
  | "war_drums"
  | "bastion_rites"
  | "send_doctrine"
  | "relic_attunement";

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

function crestForgeCosts(): number[] {
  const costs: number[] = [];
  for (let i = 0; i < 100; i++) {
    costs.push(Math.round(6 + i * 1.2 + i * i * 0.015));
  }
  return costs;
}

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
    id: "crest_forge",
    name: "Crest Forge",
    blurb: "+1% War Crest gain from runs per rank (stacks).",
    maxRank: 100,
    costs: crestForgeCosts(),
    kind: "rank",
  },
  {
    id: "bounty_board",
    name: "Bounty Board",
    blurb: "+4% kill gold per rank.",
    maxRank: 5,
    costs: [14, 24, 38, 55, 80],
    kind: "rank",
  },
  {
    id: "veteran_pay",
    name: "Veteran Pay",
    blurb: "+6 starting gold and +0.1 income per rank.",
    maxRank: 4,
    costs: [16, 28, 44, 68],
    kind: "rank",
  },
  {
    id: "lane_optics",
    name: "Lane Optics",
    blurb: "+3% attack damage equivalent (+2 flat damage) per rank.",
    maxRank: 5,
    costs: [18, 30, 48, 70, 100],
    kind: "rank",
  },
  {
    id: "steel_ration",
    name: "Steel Ration",
    blurb: "+6 max HP at run start per rank.",
    maxRank: 5,
    costs: [14, 22, 36, 52, 75],
    kind: "rank",
  },
  {
    id: "courier_guild",
    name: "Courier Guild",
    blurb: "Send packs cost −4% per rank.",
    maxRank: 4,
    costs: [20, 35, 55, 80],
    kind: "rank",
  },
  {
    id: "arcane_cache",
    name: "Arcane Cache",
    blurb: "Shop prices −3% per rank.",
    maxRank: 4,
    costs: [18, 32, 50, 72],
    kind: "rank",
  },
  {
    id: "war_drums",
    name: "War Drums",
    blurb: "Attack 3% faster per rank.",
    maxRank: 4,
    costs: [22, 38, 58, 85],
    kind: "rank",
  },
  {
    id: "bastion_rites",
    name: "Bastion Rites",
    blurb: "Base takes 4% less damage per rank.",
    maxRank: 4,
    costs: [24, 40, 62, 90],
    kind: "rank",
  },
  {
    id: "send_doctrine",
    name: "Send Doctrine",
    blurb: "Send income +5% per rank.",
    maxRank: 5,
    costs: [16, 28, 45, 65, 95],
    kind: "rank",
  },
  {
    id: "relic_attunement",
    name: "Relic Attunement",
    blurb: "R1: +1 starting level draft. R2: uncommon starting relic floor.",
    maxRank: 2,
    costs: [45, 80],
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
  {
    id: "unlock_ember",
    name: "Commission: Ember",
    blurb: "Unlock the pyromancer Ember.",
    maxRank: 1,
    costs: [50],
    kind: "unlock",
  },
  {
    id: "unlock_void",
    name: "Commission: Void",
    blurb: "Unlock the rift assassin Void.",
    maxRank: 1,
    costs: [60],
    kind: "unlock",
  },
  {
    id: "unlock_titan",
    name: "Commission: Titan",
    blurb: "Unlock the siege titan Titan.",
    maxRank: 1,
    costs: [65],
    kind: "unlock",
  },
  {
    id: "unlock_mirage",
    name: "Commission: Mirage",
    blurb: "Unlock the illusionist Mirage.",
    maxRank: 1,
    costs: [55],
    kind: "unlock",
  },
  {
    id: "unlock_medic",
    name: "Commission: Medic",
    blurb: "Unlock the field surgeon Medic.",
    maxRank: 1,
    costs: [50],
    kind: "unlock",
  },
  {
    id: "unlock_tempest",
    name: "Commission: Tempest",
    blurb: "Unlock the wind archer Tempest.",
    maxRank: 1,
    costs: [58],
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
