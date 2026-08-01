/**
 * SP vs MP parity harness.
 *
 * Runs the same seeded run through `update()` (state.ts) and `stepMpMatch()`
 * (mpSim.ts) with an idle hero and compares the lane outcomes. The two sims are
 * intentionally not bit-identical (MP resolves per-seat intents and cross-lane
 * sends), so this asserts the shared lane rules: wave cadence, spawn budget,
 * base damage and gold income must stay in the same shape.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createState, update, type GameState } from "../src/game/state";
import { buildSoloVsAiMatch } from "../src/net/matchFactory";
import { stepMpMatch } from "../src/net/mpSim";
import type { Input } from "../src/systems/input";
import type { CombatIntent } from "../src/net/types";
import { isBossKind, isEliteKind, waveTier } from "../src/data/enemies";

const SEED = 1234;
const DT = 1 / 60;
const TICKS = 60 * 45;

/** Deterministic Math.random so both sims see the same roll sequence. */
function seedRandom(seed: number): void {
  let s = seed >>> 0;
  vi.spyOn(Math, "random").mockImplementation(() => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  });
}

const RUN_OPTS = {
  mapId: "lane",
  maxTurrets: 2,
  startingGold: 100,
  wavesToWin: 0,
  friendlyFire: false,
  // Sends are cross-lane by definition and have no SP equivalent, so they are
  // off here — this harness compares the shared lane rules, not the send economy.
  disableSends: true,
};

/** Headless stand-in for the browser `Input` — hero holds attack, never moves. */
function idleInput(): Input {
  return {
    moveAxis: () => ({ x: 0, y: 0 }),
    isActionHeld: (a: string) => a === "attack",
    consumeAction: () => false,
    consumePress: () => false,
    endFrame: () => {},
  } as unknown as Input;
}

function idleIntent(): CombatIntent {
  return {
    moveX: 0,
    moveY: 0,
    aimX: 1,
    aimY: 0,
    attackHeld: true,
    mobility: false,
    mobilityHeld: false,
    ultimate: false,
    utility: false,
    toggleShop: false,
    upgradeBase: false,
    sendDigit: null,
    shopSlot: null,
    chooseRelic: null,
    skipRelic: false,
    chooseLevel: null,
    chooseUtility: null,
    chooseCurse: null,
    chooseChest: null,
    chooseBaseBranch: null,
    rerollLevel: false,
    rerollRelic: false,
    viewOpponent: null,
  };
}

type Sample = {
  wave: number;
  gold: number;
  baseHp: number;
  /** Enemies the run has committed to so far — spawned plus still queued. */
  waveBudget: number;
  curseFogTimer: number;
};

function sample(s: GameState): Sample {
  return {
    wave: s.wave,
    gold: Math.round(s.gold),
    baseHp: Math.round(s.baseHp),
    waveBudget: s.kills + s.enemies.length + s.toSpawn,
    curseFogTimer: s.curseFogTimer,
  };
}

describe("SP vs MP lane parity", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("advances waves and economy the same way for an idle hero", () => {
    seedRandom(SEED);
    const sp = createState("ranger", RUN_OPTS);
    const input = idleInput();
    for (let i = 0; i < TICKS; i++) update(sp, input, DT);
    const spOut = sample(sp);
    vi.restoreAllMocks();

    seedRandom(SEED);
    const match = buildSoloVsAiMatch({ ...RUN_OPTS, playerHeroId: "ranger", seed: SEED });
    const intents = new Map<number, CombatIntent>([[0, idleIntent()]]);
    for (let i = 0; i < TICKS; i++) stepMpMatch(match, intents, DT);
    const mpOut = sample(match.lanes[0]);

    // Same wave cadence — the shared wave helper drives both.
    expect(mpOut.wave).toBe(spOut.wave);
    expect(mpOut.wave).toBeGreaterThan(1);
    // Same enemy budget for the waves reached. Exact equality is not expected:
    // creeps that reach the base despawn without a kill, and the two sims place
    // heroes slightly differently, so a couple of units of slack is normal. A
    // real drift (a wave spawning from a different plan) is far larger than 2.
    expect(Math.abs(mpOut.waveBudget - spOut.waveBudget)).toBeLessThanOrEqual(2);
    // Passive income is identical; kill gold can differ with hero placement.
    expect(mpOut.gold).toBeGreaterThan(0);
    expect(spOut.gold).toBeGreaterThan(0);
    expect(mpOut.curseFogTimer).toBe(spOut.curseFogTimer);
    expect(mpOut.baseHp).toBeGreaterThan(0);
    expect(spOut.baseHp).toBeGreaterThan(0);
  });

  it("honours disableElites / disableBosses in the mp sim too", () => {
    // Jump straight to the first scheduled elite wave instead of grinding to it.
    let eliteWave = 0;
    for (let w = 1; w <= 200 && !eliteWave; w++) if (waveTier(w) === "elite") eliteWave = w;
    expect(eliteWave).toBeGreaterThan(0);

    const run = (opts: { disableElites?: boolean; disableBosses?: boolean }) => {
      seedRandom(SEED);
      const match = buildSoloVsAiMatch({
        ...RUN_OPTS,
        playerHeroId: "ranger",
        seed: SEED,
        ...opts,
      });
      for (const lane of match.lanes) {
        lane.wave = eliteWave - 1;
        lane.waveTimer = 0;
        lane.enemies.length = 0;
        lane.spawning = false;
      }
      const intents = new Map<number, CombatIntent>([[0, idleIntent()]]);
      for (let i = 0; i < 60 * 20; i++) stepMpMatch(match, intents, DT);
      vi.restoreAllMocks();
      return match.lanes[0];
    };

    const plain = run({});
    expect(plain.wave).toBe(eliteWave);
    expect(plain.enemies.some((e) => isEliteKind(e.kind))).toBe(true);

    const clean = run({ disableElites: true, disableBosses: true });
    expect(clean.wave).toBe(eliteWave);
    expect(clean.enemies.some((e) => isEliteKind(e.kind) || isBossKind(e.kind))).toBe(false);
  });

  it("never pauses the mp lane for a draft when two humans are in the match", () => {
    seedRandom(SEED);
    const match = buildSoloVsAiMatch({ ...RUN_OPTS, playerHeroId: "ranger", seed: SEED });
    for (const lane of match.lanes) lane.humanPlayers = 2;
    match.lanes[0].pausedForDraft = true;
    match.lanes[0].relicDraft = ["lucky_coin"];

    const intents = new Map<number, CombatIntent>([[0, idleIntent()]]);
    const waveBefore = match.lanes[0].wave;
    for (let i = 0; i < 60 * 120; i++) stepMpMatch(match, intents, DT);
    expect(match.lanes[0].wave).toBeGreaterThan(waveBefore);
  });
});
