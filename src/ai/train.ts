/**
 * Browser genetic trainer — dual-lane unlimited-wave duels vs scripted AI.
 * Fitness rewards destroying the enemy base (whoever's base dies first loses).
 */

import {
  cloneGenome,
  crossover,
  mutateGenome,
  randomGenome,
  RECIPES,
  serializeGenome,
  type Genome,
  type RecipeId,
} from "./brain";
import { createNeuralLaneAi, type NeuralLaneAi } from "./runtime";
import { HERO_LIST, type HeroId } from "../data/heroes";
import { MAP_LIST, type MapId } from "../data/maps";
import { buildSoloVsAiMatch, type MpMatch } from "../net/matchFactory";
import { stepMpMatch } from "../net/mpSim";
import type { CombatIntent } from "../net/types";
import { composeRunModifiers } from "../meta/modifiers";
import type { RunOptions } from "../game/state";

/** Creative / ascension knobs applied to every training duel. */
export type TrainRunOptions = Pick<
  RunOptions,
  | "ascension"
  | "enemyDensityMul"
  | "enemyHpMul"
  | "enemySpeedMul"
  | "incomeMul"
  | "respawnMul"
  | "startingBaseLevel"
  | "doubleElites"
  | "disableElites"
  | "disableBosses"
  | "disableRelics"
  | "disableShop"
  | "disableSends"
  | "disableChests"
  | "disableArtifacts"
  | "glassCannon"
  | "goldRush"
  | "wildChests"
  | "crampedLane"
  | "fogAlways"
  | "fogThicknessPct"
  | "fogVisionRadius"
  | "suddenDeathBaseHp"
>;

export type TrainConfig = {
  recipe: RecipeId;
  gens: number;
  pop: number;
  trials: number;
  /** Max simulated seconds per duel (base-death wins earlier). */
  maxSeconds: number;
  /** Run / creative options mirrored from solo setup. */
  runOptions?: Partial<TrainRunOptions>;
};

export type TrainProgress = {
  gen: number;
  bestFit: number;
  avgFit: number;
  matches: number;
  winVsScripted: number;
  status: "idle" | "running" | "paused" | "done";
  message: string;
};

export type TrainResult = {
  champion: Genome;
  checkpoints: { gen: number; genome: Genome; fit: number }[];
  history: { gen: number; best: number; avg: number; wr: number }[];
};

const DEFAULT_CFG: TrainConfig = {
  recipe: "balanced",
  gens: 10,
  pop: 8,
  trials: 2,
  maxSeconds: 180,
};

let abort = false;
let running = false;

export function stopTraining(): void {
  abort = true;
}

export function isTraining(): boolean {
  return running;
}

function pickHero(seed: number): HeroId {
  return HERO_LIST[Math.abs(seed) % HERO_LIST.length]!.id;
}

function pickMap(seed: number): MapId {
  return MAP_LIST[Math.abs(seed) % MAP_LIST.length]!.id as MapId;
}

function matchOptsFromTrain(run?: Partial<TrainRunOptions>) {
  const ascension = run?.ascension ?? 0;
  const mods = composeRunModifiers(ascension, {}, false);
  return {
    playerModifiers: mods,
    enemyModifiers: mods,
    ascension,
    enemyDensityMul: run?.enemyDensityMul,
    enemyHpMul: run?.enemyHpMul,
    enemySpeedMul: run?.enemySpeedMul,
    incomeMul: run?.incomeMul,
    respawnMul: run?.respawnMul,
    startingBaseLevel: run?.startingBaseLevel,
    doubleElites: run?.doubleElites,
    disableElites: run?.disableElites,
    disableBosses: run?.disableBosses,
    disableRelics: run?.disableRelics,
    disableShop: run?.disableShop,
    disableSends: run?.disableSends,
    disableChests: run?.disableChests,
    disableArtifacts: run?.disableArtifacts,
    glassCannon: run?.glassCannon,
    goldRush: run?.goldRush,
    wildChests: run?.wildChests,
    crampedLane: run?.crampedLane,
    fogAlways: run?.fogAlways,
    fogThicknessPct: run?.fogThicknessPct,
    fogVisionRadius: run?.fogVisionRadius,
    suddenDeathBaseHp:
      run?.suddenDeathBaseHp && run.suddenDeathBaseHp > 0 ? run.suddenDeathBaseHp : undefined,
  };
}

/** Headless unlimited-wave duel: trainee on lane 0 vs scripted (or rival genome) on lane 1. */
export function simulateDuel(
  trainee: Genome,
  opts: {
    seed: number;
    maxSeconds: number;
    rival?: Genome | null;
    traineeHesitation?: number;
    rivalHesitation?: number;
    runOptions?: Partial<TrainRunOptions>;
  },
): { match: MpMatch; traineeWon: boolean; timedOut: boolean } {
  const heroA = pickHero(opts.seed);
  const heroB = pickHero(opts.seed + 11);
  const mapId = pickMap(opts.seed + 3);
  const match = buildSoloVsAiMatch({
    playerHeroId: heroA,
    aiHeroId: heroB,
    mapId,
    maxTurrets: 3,
    seed: opts.seed,
    startingGold: 60,
    wavesToWin: 0, // unlimited — base death only
    friendlyFire: false,
    ...matchOptsFromTrain(opts.runOptions),
  });

  // Both lanes AI-driven for training
  match.lanes[0].aiControlled = true;
  match.lanes[0].hero.controllerSlot = -1;
  match.lanes[1].aiControlled = true;

  match.laneAi = [
    createNeuralLaneAi(trainee, opts.traineeHesitation ?? 0, "Trainee"),
    opts.rival
      ? createNeuralLaneAi(opts.rival, opts.rivalHesitation ?? 0, "Rival")
      : null, // null → scripted baseline in mpSim
  ];

  const dt = 1 / 20;
  const maxSteps = Math.ceil(opts.maxSeconds / dt);
  let steps = 0;
  const empty = new Map<number, CombatIntent>();

  while (!match.ended && steps < maxSteps) {
    stepMpMatch(match, empty, dt);
    steps += 1;
  }

  const timedOut = !match.ended;
  // Trainee is lane 0; win if opponent base died (winnerTeam 0)
  let traineeWon = match.winnerTeam === 0;
  if (timedOut) {
    // Timeout: whoever has more base HP "wins" the trial for WR tracking
    const b0 = match.lanes[0].baseHp;
    const b1 = match.lanes[1].baseHp;
    traineeWon = b0 > b1;
  }

  return { match, traineeWon, timedOut };
}

function fitness(match: MpMatch, recipe: RecipeId, traineeWon: boolean, timedOut: boolean): number {
  const r = RECIPES[recipe].weights;
  const mine = match.lanes[0];
  const theirs = match.lanes[1];
  const baseDiff = mine.baseHp - theirs.baseHp;
  const win = traineeWon ? (timedOut ? 0.45 : 1) : timedOut ? 0.2 : 0;
  const timeBonus = timedOut ? 0 : Math.max(0, 200 - mine.elapsed) * r.timeBonus;

  return (
    win * r.win +
    baseDiff * r.baseDiff +
    mine.wave * r.waves +
    mine.sendsThisRun * r.sends +
    mine.gold * r.gold +
    mine.deathCount * r.deaths +
    timeBonus
  );
}

export async function runTraining(
  partial: Partial<TrainConfig>,
  onProgress: (p: TrainProgress) => void,
): Promise<TrainResult | null> {
  if (running) return null;
  running = true;
  abort = false;
  const cfg: TrainConfig = { ...DEFAULT_CFG, ...partial };
  const recipe = cfg.recipe;
  const runOptions = cfg.runOptions;
  let pop: Genome[] = Array.from({ length: cfg.pop }, () => randomGenome(recipe));
  const checkpoints: TrainResult["checkpoints"] = [];
  const history: TrainResult["history"] = [];
  let matches = 0;
  let champion = cloneGenome(pop[0]!);

  const yieldFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

  for (let gen = 0; gen < cfg.gens; gen++) {
    if (abort) break;
    const scores: number[] = [];
    let wins = 0;
    let trials = 0;

    for (let i = 0; i < pop.length; i++) {
      if (abort) break;
      let fit = 0;
      for (let t = 0; t < cfg.trials; t++) {
        const { match, traineeWon, timedOut } = simulateDuel(pop[i]!, {
          seed: gen * 1000 + i * 17 + t * 3,
          maxSeconds: cfg.maxSeconds,
          runOptions,
        });
        fit += fitness(match, recipe, traineeWon, timedOut);
        matches += 1;
        trials += 1;
        if (traineeWon && !timedOut) wins += 1;
        else if (traineeWon && timedOut) wins += 0.35;
      }
      scores[i] = fit / cfg.trials;
      if (i % 2 === 0) {
        const filled = scores.filter((x) => typeof x === "number");
        onProgress({
          gen,
          bestFit: filled.length ? Math.max(...filled) : 0,
          avgFit: filled.length ? filled.reduce((a, b) => a + b, 0) / filled.length : 0,
          matches,
          winVsScripted: trials ? wins / trials : 0,
          status: "running",
          message: `Gen ${gen + 1}/${cfg.gens} · bot ${i + 1}/${pop.length} · unlimited-wave duels`,
        });
        await yieldFrame();
      }
    }

    const ranked = pop
      .map((g, i) => ({ g, fit: scores[i]! }))
      .sort((a, b) => b.fit - a.fit);
    champion = cloneGenome(ranked[0]!.g);
    champion.gen = gen + 1;
    champion.recipe = recipe;

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const wr = trials ? wins / trials : 0;
    history.push({ gen: gen + 1, best: ranked[0]!.fit, avg, wr });
    if (gen === 0 || (gen + 1) % Math.max(1, Math.floor(cfg.gens / 4)) === 0 || gen === cfg.gens - 1) {
      checkpoints.push({ gen: gen + 1, genome: cloneGenome(champion), fit: ranked[0]!.fit });
    }

    onProgress({
      gen: gen + 1,
      bestFit: ranked[0]!.fit,
      avgFit: avg,
      matches,
      winVsScripted: wr,
      status: "running",
      message: `Finished gen ${gen + 1} · best ${ranked[0]!.fit.toFixed(1)} · WR ${(wr * 100).toFixed(0)}%`,
    });

    const elites = ranked.slice(0, Math.max(2, Math.floor(cfg.pop * 0.3))).map((x) => x.g);
    const next: Genome[] = elites.map(cloneGenome);
    while (next.length < cfg.pop) {
      const a = elites[Math.floor(Math.random() * elites.length)]!;
      const b = elites[Math.floor(Math.random() * elites.length)]!;
      next.push(mutateGenome(crossover(a, b)));
    }
    pop = next;
    await yieldFrame();
  }

  running = false;
  onProgress({
    gen: champion.gen ?? cfg.gens,
    bestFit: history[history.length - 1]?.best ?? 0,
    avgFit: history[history.length - 1]?.avg ?? 0,
    matches,
    winVsScripted: history[history.length - 1]?.wr ?? 0,
    status: abort ? "paused" : "done",
    message: abort ? "Training stopped." : `Done · ${matches} duels · champion gen ${champion.gen}`,
  });

  return { champion, checkpoints, history };
}

export function genomeToDownload(g: Genome): Blob {
  return new Blob([serializeGenome(g)], { type: "application/json" });
}

export type { NeuralLaneAi };
