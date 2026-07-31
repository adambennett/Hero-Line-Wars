/**
 * Hero Line Wars neural AI — genome + forward pass.
 * Pattern adapted from Crosscheck Circuit / Lanebreakers.
 */

export const BRAIN_FORMAT = "hlw-brain-1";
export const N_IN = 24;
export const N_HIDDEN = [16];
export const N_MACRO = 8;
export const N_OUT = N_MACRO;
export const LAYERS = [N_IN, ...N_HIDDEN, N_OUT];

export const MACRO_NAMES = [
  "CLEAR",
  "AGGRESS",
  "SEND",
  "SHOP",
  "RETREAT",
  "HOLD",
  "UPGRADE",
  "CAST",
] as const;

export type MacroMood = (typeof MACRO_NAMES)[number];

export type Genome = {
  format: string;
  weights: Float64Array | number[];
  recipe: string;
  gen?: number;
};

export type RecipeId = "balanced" | "aggressor" | "turtle" | "economist";

export type Recipe = {
  id: RecipeId;
  name: string;
  desc: string;
  weights: {
    win: number;
    baseDiff: number;
    waves: number;
    sends: number;
    gold: number;
    deaths: number;
    timeBonus: number;
  };
};

export const RECIPES: Record<RecipeId, Recipe> = {
  balanced: {
    id: "balanced",
    name: "Balanced",
    desc: "Win by base kill; healthy base + waves.",
    weights: { win: 120, baseDiff: 0.35, waves: 2.5, sends: 0.8, gold: 0.02, deaths: -4, timeBonus: 0.05 },
  },
  aggressor: {
    id: "aggressor",
    name: "Aggressor",
    desc: "Flood the enemy lane; ends fights fast.",
    weights: { win: 100, baseDiff: 0.25, waves: 1.5, sends: 3.5, gold: 0.01, deaths: -2, timeBonus: 0.08 },
  },
  turtle: {
    id: "turtle",
    name: "Turtle",
    desc: "Survive forever; punish leaks.",
    weights: { win: 140, baseDiff: 0.5, waves: 4, sends: 0.3, gold: 0.03, deaths: -10, timeBonus: -0.02 },
  },
  economist: {
    id: "economist",
    name: "Economist",
    desc: "Income and upgrades over splashy sends.",
    weights: { win: 110, baseDiff: 0.3, waves: 2, sends: 0.4, gold: 0.08, deaths: -5, timeBonus: 0.03 },
  },
};

export type AiTierId = "classic" | "rookie" | "steady" | "sharp" | "brutal";

export function weightCount(layers: number[] = LAYERS): number {
  let n = 0;
  for (let i = 0; i < layers.length - 1; i++) n += layers[i]! * layers[i + 1]! + layers[i + 1]!;
  return n;
}

export const N_WEIGHTS = weightCount();

function gauss(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function randomGenome(recipe: RecipeId, rng: () => number = Math.random): Genome {
  const weights = new Float64Array(N_WEIGHTS);
  for (let i = 0; i < weights.length; i++) weights[i] = gauss(rng) * 0.35;
  return { format: BRAIN_FORMAT, weights, recipe, gen: 0 };
}

export function cloneGenome(g: Genome): Genome {
  return {
    format: g.format,
    weights: Float64Array.from(g.weights),
    recipe: g.recipe,
    gen: g.gen,
  };
}

export function mutateGenome(g: Genome, rate = 0.12, scale = 0.18, rng: () => number = Math.random): Genome {
  const out = cloneGenome(g);
  const w = out.weights instanceof Float64Array ? out.weights : Float64Array.from(out.weights);
  out.weights = w;
  for (let i = 0; i < w.length; i++) {
    if (rng() < rate) w[i]! += gauss(rng) * scale;
  }
  return out;
}

export function crossover(a: Genome, b: Genome, rng: () => number = Math.random): Genome {
  const out = cloneGenome(a);
  const w = out.weights instanceof Float64Array ? out.weights : Float64Array.from(out.weights);
  out.weights = w;
  const bw = b.weights;
  for (let i = 0; i < w.length; i++) {
    if (rng() < 0.5) w[i] = bw[i]!;
  }
  return out;
}

/** Standard MLP. Hidden = tanh; output = raw. */
export function forward(weights: ArrayLike<number>, input: ArrayLike<number>, out?: Float64Array): Float64Array {
  let cur: ArrayLike<number> = input;
  let w = 0;
  for (let L = 0; L < LAYERS.length - 1; L++) {
    const nIn = LAYERS[L]!;
    const nOut = LAYERS[L + 1]!;
    const next = L === LAYERS.length - 2 && out ? out : new Float64Array(nOut);
    for (let j = 0; j < nOut; j++) {
      let sum = weights[w + nIn * nOut + j]!;
      const base = w + j * nIn;
      for (let i = 0; i < nIn; i++) sum += weights[base + i]! * cur[i]!;
      next[j] = L === LAYERS.length - 2 ? sum : Math.tanh(sum);
    }
    w += nIn * nOut + nOut;
    cur = next;
  }
  return cur as Float64Array;
}

export function argmaxMood(out: ArrayLike<number>): MacroMood {
  let best = 0;
  for (let i = 1; i < N_MACRO; i++) {
    if (out[i]! > out[best]!) best = i;
  }
  return MACRO_NAMES[best]!;
}

export function isValidGenome(g: unknown): g is Genome {
  if (!g || typeof g !== "object") return false;
  const o = g as Genome;
  if (o.format !== BRAIN_FORMAT) return false;
  if (!o.weights || (o.weights as ArrayLike<number>).length !== N_WEIGHTS) return false;
  return true;
}

export function serializeGenome(g: Genome): string {
  return JSON.stringify({
    format: g.format,
    recipe: g.recipe,
    gen: g.gen ?? 0,
    weights: Array.from(g.weights),
  });
}

export function deserializeGenome(raw: string): Genome | null {
  try {
    const o = JSON.parse(raw) as Genome;
    if (!isValidGenome(o)) return null;
    return { ...o, weights: Float64Array.from(o.weights as number[]) };
  } catch {
    return null;
  }
}
