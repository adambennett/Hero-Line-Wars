import { type AbilityKind, type AbilitySlot } from "../data/heroes";
import { heroUsesGyroKit, resolveHero, heroHasPassive } from "../custom/registry";
import { MAP_W } from "../data/constants";
import { circleHitsObstacle, findClearSpot, rayObstacleHitT } from "../data/maps";
import { draftCurseChoices, CURSES, type CurseId } from "../data/curses";
import { clamp, dist, normalize, type Vec2 } from "../game/math";
import type { GameState, HeroRuntime, OutgoingCurse } from "../game/state";
import {
  addFx,
  attackDamage,
  damageEnemiesInRadius,
  enemyInAttackRange,
  nearestEnemy,
  pushProjectile,
  applySlow,
  damageEnemy,
} from "./combat";
import { mobilityCdMul, ultimateCdMul } from "./relics";
import { playSfx } from "./audio";

function resolveDashDir(state: GameState, move: Vec2): Vec2 {
  let dx = move.x;
  let dy = move.y;
  if (Math.hypot(dx, dy) < 0.1) {
    const aim = normalize(state.aimWorldX - state.hero.x, state.aimWorldY - state.hero.y);
    if (Math.hypot(aim.x, aim.y) > 0.1) return aim;
    const t = nearestEnemy(state);
    if (t) return normalize(t.x - state.hero.x, t.y - state.hero.y);
    return { x: 1, y: 0 };
  }
  return normalize(dx, dy);
}

function dashHero(
  state: GameState,
  move: Vec2,
  distDash: number,
  color: string,
  opts?: { phase?: boolean; damageTrail?: number },
): void {
  const dir = resolveDashDir(state, move);
  const dx = dir.x;
  const dy = dir.y;
  const map = state.map;
  const r = state.hero.radius;
  const steps = Math.max(4, Math.ceil(distDash / 12));
  let x = state.hero.x;
  let y = state.hero.y;
  for (let i = 1; i <= steps; i++) {
    const nx = clamp(state.hero.x + dx * ((distDash * i) / steps), r, MAP_W - r);
    const ny = clamp(state.hero.y + dy * ((distDash * i) / steps), map.laneTop + r, map.laneBottom - r);
    const blocked = map.obstacles.some((o) => circleHitsObstacle(nx, ny, r, o));
    if (blocked && !opts?.phase) break;
    x = nx;
    y = ny;
    if (opts?.damageTrail) {
      damageEnemiesInRadius(state, x, y, 36, opts.damageTrail * (1 / steps));
    }
  }
  const clear = findClearSpot(map, x, y, r);
  state.hero.x = clear.x;
  state.hero.y = clear.y;
  addFx(state, state.hero.x, state.hero.y, 28, color);
}

function castDash(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 110, "#7ef0ff");
  return true;
}

function castSlide(state: GameState, move: Vec2): boolean {
  const dir = resolveDashDir(state, move);
  state.hero.slideVx = dir.x * 520;
  state.hero.slideVy = dir.y * 520;
  state.hero.slideTimer = 0.32;
  addFx(state, state.hero.x, state.hero.y, 32, "#ff886688");
  return true;
}

function castBulwark(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 85, "#ffe08a");
  state.hero.barrierTimer = 2.2;
  return true;
}

function castAnchor(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 70, "#c8b8ff");
  state.hero.barrierTimer = 1.6;
  return true;
}

function castPhase(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 150, "#5ef0a8", { phase: true });
  state.hero.phaseTimer = 0.55;
  state.hero.barrierTimer = Math.max(state.hero.barrierTimer, 0.55);
  return true;
}

function castGlide(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 120, "#a8e0ff");
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist(state.hero, e) <= 70 + e.radius) applySlow(e, 0.55, 1.4);
  }
  return true;
}

function castFrostNova(state: GameState): boolean {
  damageEnemiesInRadius(state, state.hero.x, state.hero.y, 95, attackDamage(state) * 1.6);
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist(state.hero, e) <= 95 + e.radius) applySlow(e, 0.4, 2.2);
  }
  addFx(state, state.hero.x, state.hero.y, 95, "#7ec8ff88", 0.45);
  return true;
}

function castBlinkRng(state: GameState, move: Vec2): boolean {
  const distDash = 70 + Math.random() * 90;
  dashHero(state, move, distDash, "#e070d0");
  if (Math.random() < 0.25) {
    // Refund handled by caller via negative CD
    state.hero.abilityCds[0] = -0.01;
  }
  return true;
}

function castChaosBurst(state: GameState): boolean {
  const roll = Math.random();
  if (roll < 0.34) {
    return castVolley(state);
  }
  if (roll < 0.67) {
    damageEnemiesInRadius(state, state.hero.x, state.hero.y, 100, attackDamage(state) * 2);
    addFx(state, state.hero.x, state.hero.y, 100, "#e070d088", 0.4);
    return true;
  }
  return castPiercer(state);
}

function castVolley(state: GameState): boolean {
  const target = nearestEnemy(state);
  let angle = 0;
  if (target) angle = Math.atan2(target.y - state.hero.y, target.x - state.hero.x);
  const dmg = attackDamage(state) * 0.75;
  const spread = 0.35;
  for (let i = -2; i <= 2; i++) {
    const a = angle + i * spread;
    pushProjectile(state, {
      x: state.hero.x,
      y: state.hero.y,
      vx: Math.cos(a) * 540,
      vy: Math.sin(a) * 540,
      damage: dmg,
      radius: 3.5,
      kind: "bolt",
      color: "#9ad4ff",
    });
  }
  addFx(state, state.hero.x, state.hero.y, 26, "#9ad4ff");
  return true;
}

function castWhirlwind(state: GameState): boolean {
  state.hero.whirlwindTimer = 1.4;
  addFx(state, state.hero.x, state.hero.y, 70, "#ffb06088");
  return true;
}

function castBuckshot(state: GameState): boolean {
  const target = nearestEnemy(state);
  let angle = 0;
  if (target) angle = Math.atan2(target.y - state.hero.y, target.x - state.hero.x);
  const dmg = attackDamage(state) * 1.1;
  for (let i = -4; i <= 4; i++) {
    const a = angle + i * 0.18;
    pushProjectile(state, {
      x: state.hero.x,
      y: state.hero.y,
      vx: Math.cos(a) * 520,
      vy: Math.sin(a) * 520,
      damage: dmg,
      radius: 3.5,
      kind: "pellet",
      color: "#ff6644",
      life: 0.28,
    });
  }
  addFx(state, state.hero.x, state.hero.y, 40, "#ff664488");
  return true;
}

function castPiercer(state: GameState): boolean {
  const target = nearestEnemy(state);
  let angle = 0;
  if (target) angle = Math.atan2(target.y - state.hero.y, target.x - state.hero.x);
  pushProjectile(state, {
    x: state.hero.x,
    y: state.hero.y,
    vx: Math.cos(angle) * 600,
    vy: Math.sin(angle) * 600,
    damage: attackDamage(state) * 2.4,
    radius: 9,
    kind: "heavy",
    color: "#e8d8ff",
    pierceLeft: 6,
  });
  addFx(state, state.hero.x, state.hero.y, 30, "#c8b8ff");
  return true;
}

function castBeamstorm(state: GameState): boolean {
  damageEnemiesInRadius(state, state.hero.x, state.hero.y, 110, attackDamage(state) * 2.2);
  addFx(state, state.hero.x, state.hero.y, 110, "#5ef0a866", 0.5);
  return true;
}

function castZip(state: GameState, move: Vec2): boolean {
  const aim = normalize(state.aimWorldX - state.hero.x, state.aimWorldY - state.hero.y);
  const dir =
    Math.hypot(aim.x, aim.y) > 0.1
      ? aim
      : Math.hypot(move.x, move.y) > 0.1
        ? normalize(move.x, move.y)
        : { x: 1, y: 0 };
  dashHero(state, dir, 130, "#ffd24a");
  state.hero.zipSpeedTimer = 1.2;
  return true;
}

function castStormCage(state: GameState): boolean {
  state.hero.stormCageTimer = 2.2;
  addFx(state, state.hero.x, state.hero.y, 95, "#ffd24a66", 0.45);
  damageEnemiesInRadius(state, state.hero.x, state.hero.y, 95, attackDamage(state) * 1.4);
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist(state.hero, e) <= 95 + e.radius) applySlow(e, 0.5, 1.8);
  }
  return true;
}

function castBurrow(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 125, "#6bcf5a", { phase: true });
  state.hero.burrowTimer = 0.7;
  state.hero.barrierTimer = Math.max(state.hero.barrierTimer, 1.5);
  return true;
}

function castBloom(state: GameState): boolean {
  const dmg = attackDamage(state) * 2.1;
  damageEnemiesInRadius(state, state.hero.x, state.hero.y, 100, dmg);
  state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + state.hero.maxHp * 0.22);
  addFx(state, state.hero.x, state.hero.y, 100, "#6bcf5a88", 0.5);
  return true;
}

function castFlare(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 120, "#ff6a3a", { damageTrail: attackDamage(state) * 0.9 });
  damageEnemiesInRadius(state, state.hero.x, state.hero.y, 70, attackDamage(state) * 0.8);
  return true;
}

function castInferno(state: GameState): boolean {
  damageEnemiesInRadius(state, state.hero.x, state.hero.y, 115, attackDamage(state) * 2.3);
  addFx(state, state.hero.x, state.hero.y, 115, "#ff6a3a88", 0.5);
  return true;
}

function castRift(state: GameState, move: Vec2): boolean {
  const aim = normalize(state.aimWorldX - state.hero.x, state.aimWorldY - state.hero.y);
  const dir =
    Math.hypot(aim.x, aim.y) > 0.1
      ? aim
      : Math.hypot(move.x, move.y) > 0.1
        ? normalize(move.x, move.y)
        : { x: 1, y: 0 };
  const ox = state.hero.x;
  const oy = state.hero.y;
  dashHero(state, dir, 160, "#7a5cff", { phase: true });
  state.hero.phaseTimer = Math.max(state.hero.phaseTimer ?? 0, 0.4);
  // Residual rift damage at departure
  damageEnemiesInRadius(state, ox, oy, 48, attackDamage(state) * 0.7);
  addFx(state, ox, oy, 48, "#7a5cff66", 0.3);
  return true;
}

function castSingularity(state: GameState): boolean {
  const rad = 105;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist(state.hero, e) > rad + e.radius) continue;
    const n = normalize(state.hero.x - e.x, state.hero.y - e.y);
    e.x += n.x * 28;
    e.y += n.y * 28;
  }
  damageEnemiesInRadius(state, state.hero.x, state.hero.y, rad, attackDamage(state) * 2.4);
  addFx(state, state.hero.x, state.hero.y, rad, "#7a5cff88", 0.5);
  return true;
}

function castCharge(state: GameState, move: Vec2): boolean {
  const dir = resolveDashDir(state, move);
  state.hero.chargeVx = dir.x * 480;
  state.hero.chargeVy = dir.y * 480;
  state.hero.chargeTimer = 0.42;
  state.hero.barrierTimer = Math.max(state.hero.barrierTimer, 1.8);
  addFx(state, state.hero.x, state.hero.y, 36, "#c8a06088");
  return true;
}

function castQuake(state: GameState): boolean {
  damageEnemiesInRadius(state, state.hero.x, state.hero.y, 110, attackDamage(state) * 2);
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist(state.hero, e) <= 110 + e.radius) applySlow(e, 0.35, 2);
  }
  addFx(state, state.hero.x, state.hero.y, 110, "#c8a06088", 0.45);
  return true;
}

function castSwapBlink(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 130, "#50d0d8");
  state.hero.mirageEmpowered = true;
  return true;
}

function castMirrorShard(state: GameState): boolean {
  const angle = Math.atan2(state.aimWorldY - state.hero.y, state.aimWorldX - state.hero.x);
  const dmg = attackDamage(state) * 0.85;
  for (let i = -3; i <= 3; i++) {
    const a = angle + i * 0.14;
    pushProjectile(state, {
      x: state.hero.x,
      y: state.hero.y,
      vx: Math.cos(a) * 560,
      vy: Math.sin(a) * 560,
      damage: dmg,
      radius: 4,
      kind: "bolt",
      color: "#50d0d8",
      pierceLeft: 2,
    });
  }
  addFx(state, state.hero.x, state.hero.y, 30, "#50d0d888");
  return true;
}

function castFieldStep(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 100, "#70e090");
  state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 12);
  return true;
}

function castSanctuary(state: GameState): boolean {
  state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + state.hero.maxHp * 0.28);
  state.hero.barrierTimer = Math.max(state.hero.barrierTimer, 2);
  for (const ally of state.allies) {
    if (!ally.alive) continue;
    ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * 0.2);
    ally.barrierTimer = Math.max(ally.barrierTimer, 1.5);
  }
  addFx(state, state.hero.x, state.hero.y, 90, "#70e09088", 0.5);
  return true;
}

function castGust(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 125, "#90c8ff");
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist(state.hero, e) > 80 + e.radius) continue;
    const n = normalize(e.x - state.hero.x, e.y - state.hero.y);
    e.x += n.x * 22;
    e.y += n.y * 22;
  }
  return true;
}

function castCyclone(state: GameState): boolean {
  const angle = Math.atan2(state.aimWorldY - state.hero.y, state.aimWorldX - state.hero.x);
  pushProjectile(state, {
    x: state.hero.x,
    y: state.hero.y,
    vx: Math.cos(angle) * 620,
    vy: Math.sin(angle) * 620,
    damage: attackDamage(state) * 2.2,
    radius: 8,
    kind: "heavy",
    color: "#90c8ff",
    pierceLeft: 8,
  });
  addFx(state, state.hero.x, state.hero.y, 28, "#90c8ff88");
  return true;
}

function castHexStep(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 100, "#c080ff");
  state.hexZones.push({
    x: state.hero.x,
    y: state.hero.y,
    radius: 70,
    life: 3,
    dps: attackDamage(state) * 0.85,
  });
  addFx(state, state.hero.x, state.hero.y, 70, "#a060c866", 0.4);
  return true;
}

/** Open Hex Storm curse draft (SP pauses combat; AI auto-picks). */
function castHexStorm(state: GameState): boolean {
  state.curseDraft = draftCurseChoices(3);
  state.pausedForDraft = true;
  state.draftKind = "curse";
  state.toast = "Choose a curse for the enemy lane";
  state.toastTimer = 1.6;
  addFx(state, state.hero.x, state.hero.y, 70, "#a060c866", 0.4);
  return true;
}

export function applyCurseChoice(state: GameState, id: CurseId): void {
  if (!state.curseDraft?.includes(id)) return;
  const def = CURSES[id];
  const payload: OutgoingCurse = {
    shopBlock: def.shopBlock,
    sendBlock: def.sendBlock,
    upgradeBlock: def.upgradeBlock,
    incomeTaxMul: def.incomeTaxMul,
    incomeTaxDuration: def.incomeTaxDuration,
    fogDuration: def.fogDuration,
    shopRefreshSlow: def.shopRefreshSlow,
    shopRefreshDuration: def.shopRefreshDuration,
  };
  state.outgoingCurse = payload;
  // Solo abstract opponent
  if (state.opponent && !state.mpLane) {
    if (payload.shopBlock > 0) {
      state.opponent.curseShopBlock = Math.max(state.opponent.curseShopBlock ?? 0, payload.shopBlock);
    }
    if (payload.sendBlock > 0) {
      state.opponent.curseSendBlock = Math.max(state.opponent.curseSendBlock ?? 0, payload.sendBlock);
    }
    if (payload.upgradeBlock > 0) {
      state.opponent.curseUpgradeBlock = Math.max(
        state.opponent.curseUpgradeBlock ?? 0,
        payload.upgradeBlock,
      );
    }
    if (payload.incomeTaxDuration > 0) {
      state.opponent.curseIncomeTaxTimer = Math.max(
        state.opponent.curseIncomeTaxTimer ?? 0,
        payload.incomeTaxDuration,
      );
      state.opponent.curseIncomeTaxMul = payload.incomeTaxMul;
    }
  }
  state.hexZones.push({
    x: state.hero.x,
    y: state.hero.y,
    radius: 95,
    life: 4,
    dps: attackDamage(state) * 1.1,
  });
  addFx(state, state.hero.x, state.hero.y, 110, "#a060c888", 0.6);
  state.toast = `Hex Storm — ${def.name}!`;
  state.toastTimer = 2;
  state.curseDraft = null;
  state.draftKind = null;
  state.pausedForDraft = !!(
    state.relicDraft ||
    state.levelDraft ||
    state.baseBranchDraft ||
    state.utilityDraft ||
    state.chestDraft
  );
  playSfx("cast");
}

const PAD_RADIUS = 22;

export function clearTeleporters(state: GameState): void {
  state.teleporters = { a: null, b: null, linked: false, nextReplace: "a" };
}

function castPadLink(state: GameState): boolean {
  const tp = state.teleporters;
  const pad = { x: state.hero.x, y: state.hero.y };
  if (!tp.a) {
    tp.a = pad;
    addFx(state, pad.x, pad.y, PAD_RADIUS + 8, "#48c8e888", 0.45);
    state.toast = "Pad A placed";
    state.toastTimer = 0.9;
    // First pad: no cooldown — signal via negative CD
    state.hero.abilityCds[0] = -0.01;
    return true;
  }
  if (!tp.b) {
    tp.b = pad;
    tp.linked = true;
    tp.nextReplace = "a";
    addFx(state, pad.x, pad.y, PAD_RADIUS + 8, "#48c8e888", 0.45);
    state.toast = "Pads linked";
    state.toastTimer = 1;
    return true;
  }
  // Alternating replace
  if (tp.nextReplace === "a") {
    tp.a = pad;
    tp.nextReplace = "b";
    state.toast = "Pad A replaced";
  } else {
    tp.b = pad;
    tp.nextReplace = "a";
    state.toast = "Pad B replaced";
  }
  state.toastTimer = 0.9;
  addFx(state, pad.x, pad.y, PAD_RADIUS + 8, "#48c8e888", 0.45);
  return true;
}

function castEchoNova(state: GameState): boolean {
  const tp = state.teleporters;
  const dmg = attackDamage(state) * 2.1;
  const blast = (x: number, y: number) => {
    damageEnemiesInRadius(state, x, y, 85, dmg);
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (dist({ x, y }, e) <= 85 + e.radius) applySlow(e, 0.5, 1.6);
    }
    addFx(state, x, y, 85, "#48c8e866", 0.45);
  };
  if (tp.a) blast(tp.a.x, tp.a.y);
  if (tp.b) blast(tp.b.x, tp.b.y);
  if (!tp.a && !tp.b) blast(state.hero.x, state.hero.y);
  return true;
}

/** Fire blade hook. `charge` 0–1 sets range (tap = short, full = long). */
export function castBladeHook(state: GameState, charge = 0.45): boolean {
  const h = state.hero;
  if ((h.bladeMode ?? "wrapped") !== "wrapped" && (h.bladeMode ?? "wrapped") !== "reforming") {
    return false;
  }
  if ((h.bladeReformTimer ?? 0) > 0) return false;
  const aim = normalize(state.aimWorldX - h.x, state.aimWorldY - h.y);
  const dir = Math.hypot(aim.x, aim.y) > 0.1 ? aim : { x: 1, y: 0 };
  const t = clamp(charge, 0.08, 1);
  // Quick tap ~110, full charge ~340
  const maxRange = 110 + t * 230;
  const endX = h.x + dir.x * maxRange;
  const endY = h.y + dir.y * maxRange;
  const hitT = rayObstacleHitT(state.map, h.x, h.y, endX, endY, 6);
  h.bladeSpin = 0;
  h.bladeHookCharge = 0;
  h.bladeHookCharging = false;
  h.bladeFlyDirX = dir.x;
  h.bladeFlyDirY = dir.y;
  h.bladeFlyRange = maxRange;
  h.bladeFlyDist = 0;
  if (hitT != null) {
    // Aim point on wall face — sling will land on a clear spot beside it
    h.bladeMode = "sling";
    h.bladeHookX = h.x + dir.x * maxRange * hitT;
    h.bladeHookY = h.y + dir.y * maxRange * hitT;
    h.bladeTipX = h.bladeHookX;
    h.bladeTipY = h.bladeHookY;
    addFx(state, h.bladeHookX!, h.bladeHookY!, 28, "#c0c8d888", 0.35);
  } else {
    h.bladeMode = "flying";
    h.bladeTipX = h.x;
    h.bladeTipY = h.y;
    h.bladeHookX = endX;
    h.bladeHookY = endY;
  }
  return true;
}

/** Finish a charged blade hook (player release / cap / AI). */
export function fireChargedBladeHook(state: GameState, move: Vec2): void {
  const hero = resolveHero(state.hero.heroId);
  const index = hero.abilities.findIndex((a) => a.slot === "mobility");
  if (index < 0) return;
  const ability = hero.abilities[index]!;
  if (state.hero.abilityCds[index]! > 0) return;
  const charge = state.hero.bladeHookCharge ?? 0.45;
  const ok = castBladeHook(state, charge);
  if (ok) {
    state.hero.abilityCds[index] = ability.cooldown * mobilityCdMul(state);
    state.toast = `${ability.name}${charge >= 0.95 ? " (max)" : ""}`;
    state.toastTimer = 0.85;
    playSfx("cast");
  }
  void move;
}

function castBladeStorm(state: GameState): boolean {
  const h = state.hero;
  const dmg = attackDamage(state) * 2.6;
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pushProjectile(state, {
      x: h.x,
      y: h.y,
      vx: Math.cos(a) * 480,
      vy: Math.sin(a) * 480,
      damage: dmg,
      radius: 5,
      kind: "heavy",
      color: "#e8f0ff",
      life: 0.45,
      pierceLeft: 2,
    });
  }
  h.bladeMode = "reforming";
  h.bladeReformTimer = 3.2;
  h.bladeSpin = 0;
  addFx(state, h.x, h.y, 100, "#c0c8d866", 0.5);
  state.toast = "Blades reforming — vulnerable!";
  state.toastTimer = 1.4;
  return true;
}

function castPolarPull(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 100, "#8aa0ff");
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist(state.hero, e) > 110 + e.radius) continue;
    const n = normalize(state.hero.x - e.x, state.hero.y - e.y);
    e.x += n.x * 36;
    e.y += n.y * 36;
  }
  addFx(state, state.hero.x, state.hero.y, 110, "#8aa0ff66", 0.35);
  return true;
}

function castFluxBurst(state: GameState): boolean {
  const rad = 120;
  const dmg = attackDamage(state) * 2.1;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist(state.hero, e) > rad + e.radius) continue;
    const n = normalize(e.x - state.hero.x, e.y - state.hero.y);
    e.x += n.x * 48;
    e.y += n.y * 48;
    damageEnemy(state, e, dmg);
  }
  addFx(state, state.hero.x, state.hero.y, rad, "#a0b0ff88", 0.45);
  return true;
}

function castTimeStep(state: GameState, move: Vec2): boolean {
  dashHero(state, move, 130, "#d0a0ff", { phase: true });
  state.hexZones.push({
    x: state.hero.x,
    y: state.hero.y,
    radius: 65,
    life: 2,
    dps: attackDamage(state) * 0.9,
  });
  addFx(state, state.hero.x, state.hero.y, 65, "#c080ff66", 0.35);
  return true;
}

function castStasis(state: GameState): boolean {
  state.hero.stasisTimer = 2.2;
  const rad = 115;
  damageEnemiesInRadius(state, state.hero.x, state.hero.y, rad, attackDamage(state) * 1.5);
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist(state.hero, e) <= rad + e.radius) applySlow(e, 0.15, 2.2);
  }
  addFx(state, state.hero.x, state.hero.y, rad, "#e0c0ff66", 0.5);
  return true;
}

function castSwarmDash(state: GameState, move: Vec2): boolean {
  const drones = state.hero.hiveDrones ?? 0;
  const distDash = 110 + drones * 12;
  const trail = attackDamage(state) * (0.55 + drones * 0.18);
  dashHero(state, move, distDash, "#e8c060", { damageTrail: trail });
  return true;
}

function castHiveDetonate(state: GameState): boolean {
  const drones = Math.max(0, state.hero.hiveDrones ?? 0);
  const per = attackDamage(state) * 1.15;
  for (let i = 0; i < Math.max(1, drones); i++) {
    const a = (i / Math.max(1, drones)) * Math.PI * 2 + state.elapsed;
    const ox = state.hero.x + Math.cos(a) * 28;
    const oy = state.hero.y + Math.sin(a) * 28;
    damageEnemiesInRadius(state, ox, oy, 70, per);
    addFx(state, ox, oy, 70, "#ffe08a66", 0.4);
  }
  if (drones <= 0) {
    damageEnemiesInRadius(state, state.hero.x, state.hero.y, 80, per);
    addFx(state, state.hero.x, state.hero.y, 80, "#ffe08a66", 0.4);
  }
  state.hero.hiveDrones = 2;
  return true;
}

const CASTERS: Record<AbilityKind, (state: GameState, move: Vec2) => boolean> = {
  dash: (s, m) => castDash(s, m),
  slide: (s, m) => castSlide(s, m),
  bulwark: (s, m) => castBulwark(s, m),
  anchor: (s, m) => castAnchor(s, m),
  phase: (s, m) => castPhase(s, m),
  glide: (s, m) => castGlide(s, m),
  blinkrng: (s, m) => castBlinkRng(s, m),
  volley: (s) => castVolley(s),
  whirlwind: (s) => castWhirlwind(s),
  buckshot: (s) => castBuckshot(s),
  piercer: (s) => castPiercer(s),
  beamstorm: (s) => castBeamstorm(s),
  frostnova: (s) => castFrostNova(s),
  chaosburst: (s) => castChaosBurst(s),
  zip: (s, m) => castZip(s, m),
  stormcage: (s) => castStormCage(s),
  burrow: (s, m) => castBurrow(s, m),
  bloom: (s) => castBloom(s),
  flare: (s, m) => castFlare(s, m),
  inferno: (s) => castInferno(s),
  rift: (s, m) => castRift(s, m),
  singularity: (s) => castSingularity(s),
  charge: (s, m) => castCharge(s, m),
  quake: (s) => castQuake(s),
  swapblink: (s, m) => castSwapBlink(s, m),
  mirrorshard: (s) => castMirrorShard(s),
  fieldstep: (s, m) => castFieldStep(s, m),
  sanctuary: (s) => castSanctuary(s),
  gust: (s, m) => castGust(s, m),
  cyclone: (s) => castCyclone(s),
  hexstep: (s, m) => castHexStep(s, m),
  hexstorm: (s) => castHexStorm(s),
  padlink: (s) => castPadLink(s),
  echonova: (s) => castEchoNova(s),
  bladehook: (s) => castBladeHook(s, s.hero.bladeHookCharge ?? 0.45),
  bladestorm: (s) => castBladeStorm(s),
  polarpull: (s, m) => castPolarPull(s, m),
  fluxburst: (s) => castFluxBurst(s),
  timestep: (s, m) => castTimeStep(s, m),
  stasis: (s) => castStasis(s),
  swarmdash: (s, m) => castSwarmDash(s, m),
  hivedetonate: (s) => castHiveDetonate(s),
};

export function tryCastAbility(state: GameState, slot: AbilitySlot, move: Vec2): void {
  const hero = resolveHero(state.hero.heroId);
  const index = hero.abilities.findIndex((a) => a.slot === slot);
  if (index < 0) return;
  const ability = hero.abilities[index]!;
  if (state.hero.abilityCds[index]! > 0) return;

  // Engage heroes need a foe in range for ultimates (mobility always ok).
  if (slot === "ultimate" && hero.aimMode === "engage" && !enemyInAttackRange(state)) {
    return;
  }

  const ok = CASTERS[ability.id](state, move);
  if (ok) {
    state.abilitiesCast += 1;
    let cd = ability.cooldown;
    if (slot === "mobility") cd *= mobilityCdMul(state);
    if (slot === "ultimate") cd *= ultimateCdMul(state);
    // blinkrng / padlink may have set CD negative to refund / skip
    if ((state.hero.abilityCds[index] ?? 0) < 0) {
      state.hero.abilityCds[index] = 0;
      if (ability.id !== "padlink") {
        state.toast = `${ability.name} (proc!)`;
        state.toastTimer = 0.9;
      }
    } else {
      state.hero.abilityCds[index] = cd;
      state.toast = ability.name;
      state.toastTimer = 0.9;
    }
    playSfx("cast");
  }
}

export function tickAbilityEffects(state: GameState, dt: number): void {
  if (state.hero.barrierTimer > 0) {
    state.hero.barrierTimer = Math.max(0, state.hero.barrierTimer - dt);
  }
  if (state.hero.whirlwindTimer > 0) {
    state.hero.whirlwindTimer = Math.max(0, state.hero.whirlwindTimer - dt);
    const dmg = attackDamage(state) * 0.55 * dt;
    damageEnemiesInRadius(state, state.hero.x, state.hero.y, 72, dmg);
  }
  if ((state.hero.marksmanTimer ?? 0) > 0) {
    state.hero.marksmanTimer = Math.max(0, (state.hero.marksmanTimer ?? 0) - dt);
  }
  if ((state.hero.overchargeTimer ?? 0) > 0) {
    state.hero.overchargeTimer = Math.max(0, (state.hero.overchargeTimer ?? 0) - dt);
  }
  if ((state.hero.zipSpeedTimer ?? 0) > 0) {
    state.hero.zipSpeedTimer = Math.max(0, (state.hero.zipSpeedTimer ?? 0) - dt);
  }
  if ((state.hero.gatewalkTimer ?? 0) > 0) {
    state.hero.gatewalkTimer = Math.max(0, (state.hero.gatewalkTimer ?? 0) - dt);
  }
  if ((state.hero.phaseTimer ?? 0) > 0) {
    state.hero.phaseTimer = Math.max(0, (state.hero.phaseTimer ?? 0) - dt);
  }
  if ((state.hero.burrowTimer ?? 0) > 0) {
    state.hero.burrowTimer = Math.max(0, (state.hero.burrowTimer ?? 0) - dt);
  }
  if ((state.hero.stormCageTimer ?? 0) > 0) {
    state.hero.stormCageTimer = Math.max(0, (state.hero.stormCageTimer ?? 0) - dt);
    const dmg = attackDamage(state) * 0.7 * dt;
    damageEnemiesInRadius(state, state.hero.x, state.hero.y, 95, dmg);
    if (Math.floor(state.hero.stormCageTimer * 8) !== Math.floor((state.hero.stormCageTimer + dt) * 8)) {
      addFx(state, state.hero.x, state.hero.y, 95, "#ffd24a33", 0.12);
    }
  }

  // Scatter slide — continuous move with light contact damage
  if ((state.hero.slideTimer ?? 0) > 0) {
    state.hero.slideTimer = Math.max(0, (state.hero.slideTimer ?? 0) - dt);
    moveHeroTo(
      state,
      state.hero,
      state.hero.x + (state.hero.slideVx ?? 0) * dt,
      state.hero.y + (state.hero.slideVy ?? 0) * dt,
    );
    damageEnemiesInRadius(state, state.hero.x, state.hero.y, 40, attackDamage(state) * 0.35 * dt);
  }

  // Titan bull charge
  if ((state.hero.chargeTimer ?? 0) > 0) {
    state.hero.chargeTimer = Math.max(0, (state.hero.chargeTimer ?? 0) - dt);
    moveHeroTo(
      state,
      state.hero,
      state.hero.x + (state.hero.chargeVx ?? 0) * dt,
      state.hero.y + (state.hero.chargeVy ?? 0) * dt,
    );
    damageEnemiesInRadius(state, state.hero.x, state.hero.y, 50, attackDamage(state) * 1.1 * dt);
  }

  // Chrona Stasis Field
  if ((state.hero.stasisTimer ?? 0) > 0) {
    state.hero.stasisTimer = Math.max(0, (state.hero.stasisTimer ?? 0) - dt);
    const dmg = attackDamage(state) * 0.65 * dt;
    damageEnemiesInRadius(state, state.hero.x, state.hero.y, 115, dmg);
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (dist(state.hero, e) <= 115 + e.radius) applySlow(e, 0.15, 0.35);
    }
  }

  // Lodestone Field Drag
  if (state.hero.alive && heroHasPassive(state.hero.heroId, "field_drag")) {
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (dist(state.hero, e) > 130 + e.radius) continue;
      const n = normalize(state.hero.x - e.x, state.hero.y - e.y);
      e.x += n.x * 28 * dt;
      e.y += n.y * 28 * dt;
    }
  }

  // Chrona Rewind Ward clean heal
  if (heroHasPassive(state.hero.heroId, "rewind_ward")) {
    if ((state.hero.chronaCleanTimer ?? 0) > 0) {
      state.hero.chronaCleanTimer = Math.max(0, (state.hero.chronaCleanTimer ?? 0) - dt);
      if ((state.hero.chronaCleanTimer ?? 0) <= 0 && (state.hero.chronaBank ?? 0) > 0) {
        const heal = (state.hero.chronaBank ?? 0) * 0.4;
        const before = state.hero.hp;
        state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + heal);
        state.healingDone += Math.max(0, state.hero.hp - before);
        state.hero.chronaBank = 0;
        addFx(state, state.hero.x, state.hero.y, 40, "#d0a0ff88", 0.35);
      }
    }
  }

  // Hive Nest Memory orbit contact
  const drones = state.hero.hiveDrones ?? 0;
  if (state.hero.alive && drones > 0 && heroHasPassive(state.hero.heroId, "nest_memory")) {
    const rad = state.hero.radius + 18 + drones * 4;
    damageEnemiesInRadius(state, state.hero.x, state.hero.y, rad, attackDamage(state) * 0.22 * drones * dt);
  }

  if ((state.wardBeaconTimer ?? 0) > 0) {
    state.wardBeaconTimer = Math.max(0, state.wardBeaconTimer - dt);
  }
}

const PAD_USE_RADIUS = 22;
const PAD_SHOCK_RADIUS = 70;
const PAD_SHOCK_CD = 2.4;

function padShockwave(state: GameState, x: number, y: number): void {
  const dmg = attackDamage(state) * 1.15;
  damageEnemiesInRadius(state, x, y, PAD_SHOCK_RADIUS, dmg);
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist({ x, y }, e) <= PAD_SHOCK_RADIUS + e.radius) applySlow(e, 0.55, 1.2);
  }
  addFx(state, x, y, PAD_SHOCK_RADIUS, "#48c8e866", 0.4);
}

function tryUseTeleporter(state: GameState, hero: HeroRuntime): void {
  if (state.teleportLock > 0) return;
  const tp = state.teleporters;
  if (!tp.linked || !tp.a || !tp.b) return;
  const onA = dist(hero, tp.a) <= PAD_USE_RADIUS + hero.radius * 0.35;
  const onB = dist(hero, tp.b) <= PAD_USE_RADIUS + hero.radius * 0.35;
  if (!onA && !onB) return;
  const from = onA ? tp.a : tp.b;
  const dest = onA ? tp.b : tp.a;
  const fromKey = onA ? "a" : "b";
  // Shockwave at the pad you LEFT (per-pad cooldown so ping-pong doesn't spam)
  if (fromKey === "a") {
    if ((tp.shockCdA ?? 0) <= 0) {
      padShockwave(state, from.x, from.y);
      tp.shockCdA = PAD_SHOCK_CD;
    }
  } else if ((tp.shockCdB ?? 0) <= 0) {
    padShockwave(state, from.x, from.y);
    tp.shockCdB = PAD_SHOCK_CD;
  }
  hero.x = dest.x;
  hero.y = dest.y;
  hero.gatewalkTimer = 1.2;
  state.teleportLock = 0.85;
  addFx(state, dest.x, dest.y, 36, "#48c8e888", 0.35);
  playSfx("cast");
}

function moveHeroTo(state: GameState, hero: HeroRuntime, nx: number, ny: number): void {
  const r = hero.radius;
  const map = state.map;
  const x = clamp(nx, r, MAP_W - r);
  const y = clamp(ny, map.laneTop + r, map.laneBottom - r);
  if (!map.obstacles.some((o) => circleHitsObstacle(x, y, r, o))) {
    hero.x = x;
    hero.y = y;
    return;
  }
  if (!map.obstacles.some((o) => circleHitsObstacle(x, hero.y, r, o))) {
    hero.x = x;
    return;
  }
  if (!map.obstacles.some((o) => circleHitsObstacle(hero.x, y, r, o))) {
    hero.y = y;
  }
}

function landGyroAtHook(state: GameState, h: HeroRuntime): void {
  const hx = h.bladeHookX ?? h.x;
  const hy = h.bladeHookY ?? h.y;
  const dx = hx - h.x;
  const dy = hy - h.y;
  const n = normalize(dx, dy);
  // Prefer a clear spot just short of the wall along the approach
  const preferX = hx - n.x * (h.radius + 10);
  const preferY = hy - n.y * (h.radius + 10);
  const clear = findClearSpot(state.map, preferX, preferY, h.radius);
  h.x = clear.x;
  h.y = clear.y;
  h.bladeMode = "wrapped";
  h.bladeSpin = 0.35;
  h.bladeTipX = h.x;
  h.bladeTipY = h.y;
  addFx(state, h.x, h.y, 40, "#c0c8d888", 0.3);
}

/** Warp pads + Gyro spin / hook simulation. */
export function tickHeroKits(state: GameState, dt: number, attackHeld: boolean): void {
  if (state.teleportLock > 0) state.teleportLock = Math.max(0, state.teleportLock - dt);
  const tp = state.teleporters;
  if ((tp.shockCdA ?? 0) > 0) tp.shockCdA = Math.max(0, (tp.shockCdA ?? 0) - dt);
  if ((tp.shockCdB ?? 0) > 0) tp.shockCdB = Math.max(0, (tp.shockCdB ?? 0) - dt);

  // Allies + player can use pads; enemies cannot
  if (tp.linked) {
    if (state.hero.alive) tryUseTeleporter(state, state.hero);
    for (const ally of state.allies) {
      if (ally.alive) tryUseTeleporter(state, ally);
    }
  }

  const h = state.hero;
  if (!heroUsesGyroKit(h.heroId) || !h.alive) return;

  // Startup grace: ignore held attack for a moment so menu LMB doesn't max spin
  if ((h.bladeSpawnGrace ?? 0) > 0) {
    h.bladeSpawnGrace = Math.max(0, (h.bladeSpawnGrace ?? 0) - dt);
  }

  if ((h.bladeReformTimer ?? 0) > 0) {
    h.bladeReformTimer = Math.max(0, (h.bladeReformTimer ?? 0) - dt);
    h.bladeMode = "reforming";
    h.bladeAngle = (h.bladeAngle ?? 0) + dt * 2.2;
    if ((h.bladeReformTimer ?? 0) <= 0) {
      h.bladeMode = "wrapped";
      h.bladeSpin = 0;
      state.toast = "Blades reformed";
      state.toastTimer = 1;
    }
    return;
  }

  const mode = h.bladeMode ?? "wrapped";

  if (mode === "wrapped") {
    const canSpin = (h.bladeSpawnGrace ?? 0) <= 0;
    if (attackHeld && canSpin) {
      h.bladeSpin = Math.min(1, (h.bladeSpin ?? 0) + dt * 0.55);
    } else {
      h.bladeSpin = Math.max(0, (h.bladeSpin ?? 0) - dt * 0.7);
    }
    h.bladeAngle = (h.bladeAngle ?? 0) + dt * (5 + (h.bladeSpin ?? 0) * 16);
    const spin = h.bladeSpin ?? 0;
    if (spin > 0.08) {
      // Tight death-ball radius around the hero body
      const radius = h.radius + 10 + spin * 16;
      const dps = attackDamage(state) * (0.55 + spin * 1.8);
      damageEnemiesInRadius(state, h.x, h.y, radius, dps * dt);
    }
    return;
  }

  if (mode === "flying") {
    const tipX = h.bladeTipX ?? h.x;
    const tipY = h.bladeTipY ?? h.y;
    const dirX = h.bladeFlyDirX ?? 1;
    const dirY = h.bladeFlyDirY ?? 0;
    const spd = 560;
    const step = spd * dt;
    const nx = tipX + dirX * step;
    const ny = tipY + dirY * step;
    h.bladeFlyDist = (h.bladeFlyDist ?? 0) + step;
    // Mid-flight wall catch → sling
    const hitT = rayObstacleHitT(state.map, tipX, tipY, nx, ny, 7);
    if (hitT != null) {
      h.bladeHookX = tipX + (nx - tipX) * hitT;
      h.bladeHookY = tipY + (ny - tipY) * hitT;
      h.bladeTipX = h.bladeHookX;
      h.bladeTipY = h.bladeHookY;
      h.bladeMode = "sling";
      addFx(state, h.bladeHookX, h.bladeHookY, 28, "#c0c8d888", 0.3);
      return;
    }
    h.bladeTipX = nx;
    h.bladeTipY = ny;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (dist({ x: nx, y: ny }, e) <= 14 + e.radius) {
        damageEnemy(state, e, attackDamage(state) * (1.0 + (h.bladeFlyRange ?? 200) / 400));
      }
    }
    if ((h.bladeFlyDist ?? 0) >= (h.bladeFlyRange ?? 220)) {
      h.bladeMode = "rewinding";
    }
    return;
  }

  if (mode === "sling") {
    const hx = h.bladeHookX ?? h.x;
    const hy = h.bladeHookY ?? h.y;
    const n = normalize(hx - h.x, hy - h.y);
    const spd = 500;
    moveHeroTo(state, h, h.x + n.x * spd * dt, h.y + n.y * spd * dt);
    if (dist(h, { x: hx, y: hy }) < 28) {
      landGyroAtHook(state, h);
    }
    return;
  }

  if (mode === "rewinding") {
    const tipX = h.bladeTipX ?? h.x;
    const tipY = h.bladeTipY ?? h.y;
    // Slow drag toward blades — movement is locked via heroMoveSpeed
    const n = normalize(tipX - h.x, tipY - h.y);
    const pullSpd = 140;
    const clearPull = findClearSpot(
      state.map,
      h.x + n.x * pullSpd * dt,
      h.y + n.y * pullSpd * dt,
      h.radius,
    );
    h.x = clearPull.x;
    h.y = clearPull.y;
    // Blades slowly return / reel in
    const back = normalize(h.x - tipX, h.y - tipY);
    h.bladeTipX = tipX + back.x * 120 * dt;
    h.bladeTipY = tipY + back.y * 120 * dt;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (dist({ x: h.bladeTipX, y: h.bladeTipY }, e) <= 16 + e.radius) {
        damageEnemy(state, e, attackDamage(state) * 0.55 * dt);
      }
    }
    if (dist(h, { x: h.bladeTipX!, y: h.bladeTipY! }) < 22) {
      const clear = findClearSpot(state.map, h.x, h.y, h.radius);
      h.x = clear.x;
      h.y = clear.y;
      h.bladeMode = "wrapped";
      h.bladeSpin = 0;
      h.bladeTipX = h.x;
      h.bladeTipY = h.y;
    }
  }
}

export { inHighGround, nearestEnemy, attackDamage } from "./combat";
