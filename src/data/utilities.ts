/** Shared global utility abilities — drafted once per run for the Spacebar slot. */

export type UtilityId =
  | "dash_refresh"
  | "gold_burst"
  | "temp_barrier"
  | "aoe_slow"
  | "field_heal"
  | "income_spike"
  | "artifact_boost"
  | "send_discount"
  | "sprint_burst"
  | "cleanse"
  | "bounty_mark"
  | "shockwave"
  | "second_wind"
  | "market_favor"
  | "focus_lens";

export type UtilityDef = {
  id: UtilityId;
  name: string;
  cooldown: number;
  hint: string;
  blurb: string;
  tag: string;
};

export const UTILITIES: Record<UtilityId, UtilityDef> = {
  dash_refresh: {
    id: "dash_refresh",
    name: "Dash Refresh",
    cooldown: 18,
    hint: "Instantly reset mobility cooldown.",
    blurb: "Ready your mobility again.",
    tag: "Mobility",
  },
  gold_burst: {
    id: "gold_burst",
    name: "Gold Burst",
    cooldown: 22,
    hint: "Gain 55 gold immediately.",
    blurb: "A quick purse of war gold.",
    tag: "Economy",
  },
  temp_barrier: {
    id: "temp_barrier",
    name: "Temp Barrier",
    cooldown: 16,
    hint: "Gain a 2.8s damage barrier.",
    blurb: "Hard light shell.",
    tag: "Defense",
  },
  aoe_slow: {
    id: "aoe_slow",
    name: "Frost Pulse",
    cooldown: 14,
    hint: "Slow nearby enemies for 2.5s.",
    blurb: "Chill the press.",
    tag: "Control",
  },
  field_heal: {
    id: "field_heal",
    name: "Field Heal",
    cooldown: 18,
    hint: "Restore 28% of max HP.",
    blurb: "Emergency triage.",
    tag: "Sustain",
  },
  income_spike: {
    id: "income_spike",
    name: "Income Spike",
    cooldown: 30,
    hint: "+2.5 gold/s for 8s.",
    blurb: "Short supply surge.",
    tag: "Economy",
  },
  artifact_boost: {
    id: "artifact_boost",
    name: "Artifact Boost",
    cooldown: 24,
    hint: "Turrets deal +40% damage for 6s.",
    blurb: "Overclock emplacements.",
    tag: "Offense",
  },
  send_discount: {
    id: "send_discount",
    name: "Send Discount",
    cooldown: 26,
    hint: "Next send pack costs 40% less.",
    blurb: "Cut a deal with the barracks.",
    tag: "Economy",
  },
  sprint_burst: {
    id: "sprint_burst",
    name: "Sprint Burst",
    cooldown: 12,
    hint: "+70 move speed for 2.5s.",
    blurb: "Short lane sprint.",
    tag: "Mobility",
  },
  cleanse: {
    id: "cleanse",
    name: "Cleanse",
    cooldown: 15,
    hint: "Clear slows and heal 10 HP.",
    blurb: "Shake off the hex.",
    tag: "Sustain",
  },
  bounty_mark: {
    id: "bounty_mark",
    name: "Bounty Mark",
    cooldown: 20,
    hint: "Next 4 kills grant +8 gold each.",
    blurb: "Mark the next bag.",
    tag: "Economy",
  },
  shockwave: {
    id: "shockwave",
    name: "Shockwave",
    cooldown: 16,
    hint: "Deal moderate AoE damage around you.",
    blurb: "Knock the line back.",
    tag: "Offense",
  },
  second_wind: {
    id: "second_wind",
    name: "Second Wind",
    cooldown: 28,
    hint: "Heal 18% max HP and gain brief barrier.",
    blurb: "Catch your breath.",
    tag: "Sustain",
  },
  market_favor: {
    id: "market_favor",
    name: "Market Favor",
    cooldown: 35,
    hint: "Gain +1 shop refresh charge (or 25g).",
    blurb: "A favor from the quartermaster.",
    tag: "Economy",
  },
  focus_lens: {
    id: "focus_lens",
    name: "Focus Lens",
    cooldown: 20,
    hint: "+25% damage for 4s.",
    blurb: "Sharpen every shot.",
    tag: "Offense",
  },
};

export const UTILITY_LIST: UtilityDef[] = Object.values(UTILITIES);

/** Level at which the utility draft appears. `0` / null = Never (off). */
export const UTILITY_DRAFT_LEVEL_OPTIONS = [0, 3, 5, 7, 8, 10, 12, 15, 20, 25] as const;
export const DEFAULT_UTILITY_DRAFT_LEVEL = 10;

export function draftUtilities(count = 3, exclude: UtilityId[] = []): UtilityId[] {
  const pool = UTILITY_LIST.map((u) => u.id).filter((id) => !exclude.includes(id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  return pool.slice(0, Math.min(count, pool.length));
}
