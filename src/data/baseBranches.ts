/** Branching base upgrade choices after early linear levels. */

export type BaseBranchId =
  | "offense_spikes"
  | "offense_overclock"
  | "offense_sharpshoot"
  | "economy_tax"
  | "economy_courier"
  | "economy_mint"
  | "defense_plate"
  | "defense_repair"
  | "defense_bastion"
  | "send_pressure"
  | "send_bargain"
  | "send_horde"
  | "artifact_calibrate"
  | "artifact_fortify"
  | "artifact_network"
  | "hybrid_warchest"
  | "hybrid_field"
  | "hybrid_tempo";

export type BaseBranchDef = {
  id: BaseBranchId;
  name: string;
  blurb: string;
  tag: "Offense" | "Economy" | "Defense" | "Sends" | "Artifacts" | "Hybrid";
  /** Applied once when chosen. */
  apply: (mods: BaseBranchMods) => void;
};

export type BaseBranchMods = {
  damageFlat: number;
  attackSpeedMul: number;
  incomeFlat: number;
  shopPriceMul: number;
  baseHpFlat: number;
  baseDamageTakenMul: number;
  sendCostMul: number;
  sendIncomeMul: number;
  sendHpMul: number;
  artifactDamageMul: number;
  artifactFireMul: number;
  maxTurretsBonus: number;
  heroHpFlat: number;
  moveSpeedFlat: number;
  killGoldFlat: number;
};

export function emptyBranchMods(): BaseBranchMods {
  return {
    damageFlat: 0,
    attackSpeedMul: 1,
    incomeFlat: 0,
    shopPriceMul: 1,
    baseHpFlat: 0,
    baseDamageTakenMul: 1,
    sendCostMul: 1,
    sendIncomeMul: 1,
    sendHpMul: 1,
    artifactDamageMul: 1,
    artifactFireMul: 1,
    maxTurretsBonus: 0,
    heroHpFlat: 0,
    moveSpeedFlat: 0,
    killGoldFlat: 0,
  };
}

export const BASE_BRANCHES: Record<BaseBranchId, BaseBranchDef> = {
  offense_spikes: {
    id: "offense_spikes",
    name: "Spike Barrage",
    blurb: "+8 attack damage.",
    tag: "Offense",
    apply: (m) => {
      m.damageFlat += 8;
    },
  },
  offense_overclock: {
    id: "offense_overclock",
    name: "Overclocked Arms",
    blurb: "Attack 12% faster.",
    tag: "Offense",
    apply: (m) => {
      m.attackSpeedMul *= 0.88;
    },
  },
  offense_sharpshoot: {
    id: "offense_sharpshoot",
    name: "Sharpshoot Doctrine",
    blurb: "+5 damage and +15 move speed.",
    tag: "Offense",
    apply: (m) => {
      m.damageFlat += 5;
      m.moveSpeedFlat += 15;
    },
  },
  economy_tax: {
    id: "economy_tax",
    name: "War Tax Office",
    blurb: "+0.7 gold/sec income.",
    tag: "Economy",
    apply: (m) => {
      m.incomeFlat += 0.7;
    },
  },
  economy_courier: {
    id: "economy_courier",
    name: "Courier Contracts",
    blurb: "Shop prices −8%.",
    tag: "Economy",
    apply: (m) => {
      m.shopPriceMul *= 0.92;
    },
  },
  economy_mint: {
    id: "economy_mint",
    name: "Kill Mint",
    blurb: "+3 gold per kill.",
    tag: "Economy",
    apply: (m) => {
      m.killGoldFlat += 3;
    },
  },
  defense_plate: {
    id: "defense_plate",
    name: "Plated Keep",
    blurb: "Base +35 max HP (repairs 35).",
    tag: "Defense",
    apply: (m) => {
      m.baseHpFlat += 35;
    },
  },
  defense_repair: {
    id: "defense_repair",
    name: "Field Medics",
    blurb: "+25 hero max HP (heals 25).",
    tag: "Defense",
    apply: (m) => {
      m.heroHpFlat += 25;
    },
  },
  defense_bastion: {
    id: "defense_bastion",
    name: "Bastion Rites",
    blurb: "Base takes 10% less damage.",
    tag: "Defense",
    apply: (m) => {
      m.baseDamageTakenMul *= 0.9;
    },
  },
  send_pressure: {
    id: "send_pressure",
    name: "Pressure Doctrine",
    blurb: "Sent creeps +15% HP.",
    tag: "Sends",
    apply: (m) => {
      m.sendHpMul *= 1.15;
    },
  },
  send_bargain: {
    id: "send_bargain",
    name: "Bargain Sends",
    blurb: "Send packs cost 12% less.",
    tag: "Sends",
    apply: (m) => {
      m.sendCostMul *= 0.88;
    },
  },
  send_horde: {
    id: "send_horde",
    name: "Horde Stipend",
    blurb: "Send income +18%.",
    tag: "Sends",
    apply: (m) => {
      m.sendIncomeMul *= 1.18;
    },
  },
  artifact_calibrate: {
    id: "artifact_calibrate",
    name: "Calibrated Artifacts",
    blurb: "Artifacts deal +20% damage.",
    tag: "Artifacts",
    apply: (m) => {
      m.artifactDamageMul *= 1.2;
    },
  },
  artifact_fortify: {
    id: "artifact_fortify",
    name: "Fortified Emplacements",
    blurb: "Artifacts fire 15% faster.",
    tag: "Artifacts",
    apply: (m) => {
      m.artifactFireMul *= 0.85;
    },
  },
  artifact_network: {
    id: "artifact_network",
    name: "Artifact Network",
    blurb: "+1 max artifact slot.",
    tag: "Artifacts",
    apply: (m) => {
      m.maxTurretsBonus += 1;
    },
  },
  hybrid_warchest: {
    id: "hybrid_warchest",
    name: "War Chest Annex",
    blurb: "+0.4 income and +4 damage.",
    tag: "Hybrid",
    apply: (m) => {
      m.incomeFlat += 0.4;
      m.damageFlat += 4;
    },
  },
  hybrid_field: {
    id: "hybrid_field",
    name: "Field Synergy",
    blurb: "+15 hero HP and shop −5%.",
    tag: "Hybrid",
    apply: (m) => {
      m.heroHpFlat += 15;
      m.shopPriceMul *= 0.95;
    },
  },
  hybrid_tempo: {
    id: "hybrid_tempo",
    name: "Tempo Engine",
    blurb: "Attack 8% faster; +20 move speed.",
    tag: "Hybrid",
    apply: (m) => {
      m.attackSpeedMul *= 0.92;
      m.moveSpeedFlat += 20;
    },
  },
};

const POOLS: BaseBranchId[][] = [
  ["offense_spikes", "economy_tax", "defense_plate"],
  ["send_pressure", "artifact_calibrate", "hybrid_warchest"],
  ["offense_overclock", "economy_courier", "defense_bastion"],
  ["send_bargain", "artifact_fortify", "hybrid_field"],
  ["offense_sharpshoot", "economy_mint", "defense_repair"],
  ["send_horde", "artifact_network", "hybrid_tempo"],
];

/** After linear early levels, every other upgrade presents a branch draft. */
export function shouldOfferBaseBranch(newLevel: number): boolean {
  // Levels 1–2: linear only. From 3 onward, odd levels offer a branch.
  return newLevel >= 3 && newLevel % 2 === 1;
}

export function draftBaseBranches(owned: BaseBranchId[]): BaseBranchId[] {
  const poolIndex = Math.min(POOLS.length - 1, Math.floor(owned.length));
  const pool = POOLS[poolIndex]!.filter((id) => !owned.includes(id));
  if (pool.length >= 3) return pool.slice(0, 3);
  // Fill from all unused
  const rest = (Object.keys(BASE_BRANCHES) as BaseBranchId[]).filter(
    (id) => !owned.includes(id) && !pool.includes(id),
  );
  const out = [...pool];
  for (const id of rest) {
    if (out.length >= 3) break;
    out.push(id);
  }
  while (out.length < 3) {
    out.push(POOLS[0]![out.length % 3]!);
  }
  return out.slice(0, 3);
}

export function recomputeBranchMods(owned: BaseBranchId[]): BaseBranchMods {
  const mods = emptyBranchMods();
  for (const id of owned) {
    BASE_BRANCHES[id]?.apply(mods);
  }
  return mods;
}
