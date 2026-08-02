import type { GameState, HeroRuntime } from "../game/state";
import type {
  CombatIntent,
  HeroSnap,
  LanePayload,
  LaneSnap,
  LaneSummary,
  MatchSnap,
  MpTeam,
} from "./types";
import { isLaneSummary } from "./types";
import type { MpMatch } from "./matchFactory";
import { allLaneHeroes } from "./matchFactory";
import { applyBags, serializeBags, type PlayerBag } from "./playerBag";

function heroSnap(h: HeroRuntime): HeroSnap {
  return {
    slot: h.controllerSlot ?? null,
    heroId: h.heroId,
    x: h.x,
    y: h.y,
    hp: h.hp,
    maxHp: h.maxHp,
    alive: h.alive,
    attackCd: h.attackCd,
    abilityCds: [...h.abilityCds],
    barrierTimer: h.barrierTimer,
    whirlwindTimer: h.whirlwindTimer,
    radius: h.radius,
    bladeMode: h.bladeMode,
    bladeSpin: h.bladeSpin,
    bladeAngle: h.bladeAngle,
    bladeTipX: h.bladeTipX,
    bladeTipY: h.bladeTipY,
    bladeHookCharging: h.bladeHookCharging,
    bladeHookCharge: h.bladeHookCharge,
    gunnerWeaponIndex: h.gunnerWeaponIndex,
    gunnerAmmo: h.gunnerAmmo,
    gunnerReload: h.gunnerReload,
    gunnerAiming: h.gunnerAiming,
    gunnerAimTime: h.gunnerAimTime,
    gunnerSpin: h.gunnerSpin,
    gunnerCharge: h.gunnerCharge,
    gunnerSelfDamageFlash: h.gunnerSelfDamageFlash,
    momentum: h.momentum,
  };
}

export function buildLaneSnap(state: GameState): LaneSnap {
  return {
    status: state.status,
    wave: state.wave,
    waveTier: state.waveTier,
    waveTimer: state.waveTimer,
    spawning: state.spawning,
    baseHp: state.baseHp,
    baseMaxHp: state.map.base.maxHp,
    baseLevel: state.baseLevel,
    gold: state.gold,
    incomePerSec: state.incomePerSec,
    level: state.level,
    xp: state.xp,
    toast: state.toast,
    toastTimer: state.toastTimer,
    damageFlash: state.damageFlash,
    vignette: state.vignette,
    hitFlash: state.hitFlash,
    shake: state.shake,
    shopOpen: state.shopOpen,
    nearShop: state.nearShop,
    shopOffer: [...state.shopOffer],
    shopOwned: { ...state.shopOwned },
    shopFrozen: state.shopFrozen,
    shopRefreshesLeft: state.shopRefreshesLeft,
    relics: [...state.relics],
    relicDraft: state.relicDraft ? [...state.relicDraft] : null,
    levelDraft: state.levelDraft ? [...state.levelDraft] : null,
    draftKind: state.draftKind,
    pausedForDraft: state.pausedForDraft,
    respawnTimer: state.respawnTimer,
    livesPerWave: state.livesPerWave,
    livesPerRun: state.livesPerRun,
    waveLivesLeft: state.waveLivesLeft,
    runLivesLeft: state.runLivesLeft,
    waveRespawnBlocked: state.waveRespawnBlocked,
    heroes: allLaneHeroes(state).map(heroSnap),
    enemies: state.enemies.map((e) => ({
      id: e.id,
      kind: e.kind,
      x: e.x,
      y: e.y,
      hp: e.hp,
      maxHp: e.maxHp,
      radius: e.radius,
      alive: e.alive,
      sent: e.sent,
    })),
    turrets: state.turrets.map((t) => ({
      id: t.id,
      kind: t.kind,
      x: t.x,
      y: t.y,
      hp: t.hp,
      maxHp: t.maxHp,
      alive: t.alive,
      slotIndex: t.slotIndex,
    })),
    projectiles: state.projectiles.map((p) => ({
      x: p.x,
      y: p.y,
      vx: p.vx,
      vy: p.vy,
      radius: p.radius,
      color: p.color,
      hostile: p.hostile,
    })),
    fx: state.fx.map((f) => ({ ...f })),
    beam: state.beam ? { ...state.beam } : null,
    pendingSends: state.pendingSends.map((s) => ({ ...s })),
    mapId: state.mapId,
    utilityDraft: state.utilityDraft ? [...state.utilityDraft] : null,
    curseDraft: state.curseDraft ? [...state.curseDraft] : null,
    chestDraft: state.chestDraft
      ? state.chestDraft.map((c) => ({
          label: c.label,
          blurb: c.blurb,
          kind: c.kind,
          amount: c.kind === "gold" ? c.amount : undefined,
        }))
      : null,
    baseBranchDraft: state.baseBranchDraft ? [...state.baseBranchDraft] : null,
    utilityId: state.utilityId,
    levelPassives: [...state.levelPassives],
    rerollTokens: state.rerollTokens,
    playerBags: serializeBags(state.playerBags),
    curseShopBlock: state.curseShopBlock,
    curseSendBlock: state.curseSendBlock,
    curseUpgradeBlock: state.curseUpgradeBlock,
    curseIncomeTaxTimer: state.curseIncomeTaxTimer,
    curseIncomeTaxMul: state.curseIncomeTaxMul,
    curseFogTimer: state.curseFogTimer,
    curseShopRefreshSlowTimer: state.curseShopRefreshSlowTimer,
    curseShopRefreshSlowMul: state.curseShopRefreshSlowMul,
    shopRefreshTimer: state.shopRefreshTimer,
    chests: state.chests.map((c) => ({
      id: c.id,
      x: c.x,
      y: c.y,
      radius: c.radius,
      rarity: c.rarity,
      openProgress: c.openProgress,
      openDuration: c.openDuration,
      life: c.life,
    })),
    hexZones: state.hexZones.map((z) => ({
      x: z.x,
      y: z.y,
      radius: z.radius,
      life: z.life,
      kind: z.kind,
    })),
    mapOrbs: (state.mapOrbs ?? []).map((o) => ({
      x: o.x,
      y: o.y,
      radius: o.radius,
      fuse: o.fuse,
    })),
    teleporters: {
      a: state.teleporters.a ? { x: state.teleporters.a.x, y: state.teleporters.a.y } : null,
      b: state.teleporters.b ? { x: state.teleporters.b.x, y: state.teleporters.b.y } : null,
      linked: state.teleporters.linked,
    },
    mines: (state.mines ?? []).map((m) => ({
      id: m.id,
      x: m.x,
      y: m.y,
      radius: m.radius,
      armTimer: m.armTimer,
    })),
    mapFogActive: state.mapFogActive,
    fogOpacity: state.fogOpacity,
    fogVisionRadiusResolved: state.fogVisionRadiusResolved,
    mapEclipseActive: state.mapEclipseActive,
    mapHazardX: state.mapHazardX,
    mapSupplyCrates: (state.mapSupplyCrates ?? []).map((c) => ({
      id: c.id,
      x: c.x,
      y: c.y,
      radius: c.radius,
      life: c.life,
      gold: c.gold,
    })),
    laneGeometry: laneGeometrySnap(state),
    humanPlayers: state.humanPlayers,
    draftQueueKinds: (state.draftQueue ?? []).map((d) => d.kind),
  };
}

/** Only maps that move geometry mid-run need to ship it (shift / shrink). */
function laneGeometrySnap(state: GameState): LaneSnap["laneGeometry"] {
  const map = state.map;
  if (!map.shiftingObstacles && !map.shrinkingLane) return undefined;
  return {
    laneTop: map.laneTop,
    laneBottom: map.laneBottom,
    laneLeft: map.laneLeft,
    laneRight: map.laneRight,
    obstacles: map.obstacles.map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h })),
  };
}

/**
 * HUD-only digest of a lane nobody is watching. Deliberately excludes enemies,
 * projectiles, effects, map objects, and bags — see `buildMatchSnapFor`.
 */
export function buildLaneSummary(state: GameState): LaneSummary {
  return {
    summary: true,
    status: state.status,
    wave: state.wave,
    waveTier: state.waveTier,
    waveTimer: state.waveTimer,
    spawning: state.spawning,
    baseHp: state.baseHp,
    baseMaxHp: state.map.base.maxHp,
    baseLevel: state.baseLevel,
    enemyCount: state.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0),
    sentIncoming: state.pendingSends.reduce((n, s) => n + s.enemies, 0),
    players: allLaneHeroes(state).map((h) => ({
      slot: h.controllerSlot ?? null,
      heroId: h.heroId,
      alive: h.alive,
      hp: h.hp,
      maxHp: h.maxHp,
      level: state.level,
    })),
  };
}

export function buildMatchSnap(match: MpMatch, viewTeam: MpTeam): MatchSnap {
  return buildMatchSnapFor(match, viewTeam, [true, true]);
}

/**
 * Per-viewer snapshot. `full[t]` decides whether lane `t` ships as a complete
 * `LaneSnap` (own lane + actively-viewed lane) or as a cheap `LaneSummary`.
 * Callers may pass a cache so one built lane snap is reused across peers.
 */
export function buildMatchSnapFor(
  match: MpMatch,
  viewTeam: MpTeam,
  full: [boolean, boolean],
  cache?: { snaps: (LaneSnap | null)[]; summaries: (LaneSummary | null)[] },
): MatchSnap {
  const lane = (t: MpTeam): LanePayload => {
    if (full[t]) {
      if (cache) return (cache.snaps[t] ??= buildLaneSnap(match.lanes[t]));
      return buildLaneSnap(match.lanes[t]);
    }
    if (cache) return (cache.summaries[t] ??= buildLaneSummary(match.lanes[t]));
    return buildLaneSummary(match.lanes[t]);
  };
  return {
    mode: match.mode,
    myTeam: match.myTeam,
    viewTeam,
    lanes: [lane(0), lane(1)],
    ended: match.ended,
    winnerTeam: match.winnerTeam,
  };
}

export function newSnapCache(): {
  snaps: (LaneSnap | null)[];
  summaries: (LaneSummary | null)[];
} {
  return { snaps: [null, null], summaries: [null, null] };
}

function applyHeroSnap(h: HeroRuntime, snap: HeroSnap): void {
  h.heroId = snap.heroId;
  h.x = snap.x;
  h.y = snap.y;
  h.hp = snap.hp;
  h.maxHp = snap.maxHp;
  h.alive = snap.alive;
  h.attackCd = snap.attackCd;
  h.abilityCds = [...snap.abilityCds];
  h.barrierTimer = snap.barrierTimer;
  h.whirlwindTimer = snap.whirlwindTimer;
  h.controllerSlot = snap.slot;
  if (snap.radius != null) h.radius = snap.radius;
  h.bladeMode = snap.bladeMode as HeroRuntime["bladeMode"];
  h.bladeSpin = snap.bladeSpin;
  h.bladeAngle = snap.bladeAngle;
  h.bladeTipX = snap.bladeTipX;
  h.bladeTipY = snap.bladeTipY;
  h.bladeHookCharging = snap.bladeHookCharging;
  h.bladeHookCharge = snap.bladeHookCharge;
  h.gunnerWeaponIndex = snap.gunnerWeaponIndex;
  h.gunnerAmmo = snap.gunnerAmmo;
  h.gunnerReload = snap.gunnerReload;
  h.gunnerAiming = snap.gunnerAiming;
  h.gunnerAimTime = snap.gunnerAimTime;
  h.gunnerSpin = snap.gunnerSpin;
  h.gunnerCharge = snap.gunnerCharge;
  h.gunnerSelfDamageFlash = snap.gunnerSelfDamageFlash;
  h.momentum = snap.momentum;
}

export function applyLaneSnap(
  state: GameState,
  snap: LaneSnap,
  focusSlot?: number | null,
): void {
  state.status = snap.status as GameState["status"];
  state.wave = snap.wave;
  state.waveTier = snap.waveTier as GameState["waveTier"];
  state.waveTimer = snap.waveTimer;
  state.spawning = snap.spawning;
  state.baseHp = snap.baseHp;
  state.baseLevel = snap.baseLevel;
  state.gold = snap.gold;
  state.incomePerSec = snap.incomePerSec;
  state.level = snap.level;
  state.xp = snap.xp;
  state.toast = snap.toast;
  state.toastTimer = snap.toastTimer;
  state.damageFlash = snap.damageFlash;
  state.vignette = snap.vignette;
  state.hitFlash = snap.hitFlash;
  state.shake = snap.shake;
  state.shopOpen = snap.shopOpen;
  state.nearShop = snap.nearShop;
  state.shopOffer = [...snap.shopOffer];
  state.shopOwned = { ...snap.shopOwned };
  state.shopFrozen = snap.shopFrozen;
  state.shopRefreshesLeft = snap.shopRefreshesLeft;
  state.relics = [...snap.relics];
  state.relicDraft = snap.relicDraft ? [...snap.relicDraft] : null;
  state.levelDraft = snap.levelDraft ? [...snap.levelDraft] : null;
  state.draftKind = snap.draftKind as GameState["draftKind"];
  state.pausedForDraft = snap.pausedForDraft;
  state.respawnTimer = snap.respawnTimer;
  state.livesPerWave = snap.livesPerWave ?? 0;
  state.livesPerRun = snap.livesPerRun ?? 0;
  state.waveLivesLeft = snap.waveLivesLeft ?? 0;
  state.runLivesLeft = snap.runLivesLeft ?? 0;
  state.waveRespawnBlocked = !!snap.waveRespawnBlocked;
  state.pendingSends = snap.pendingSends.map((s) => ({ ...s }));
  state.beam = snap.beam ? { ...snap.beam } : null;
  state.fx = snap.fx.map((f) => ({ ...f }));
  state.utilityDraft = snap.utilityDraft ? [...snap.utilityDraft] : null;
  state.curseDraft = snap.curseDraft ? [...snap.curseDraft] : null;
  // Chest options are display-only on the client (the host resolves by index),
  // but carry enough to render the real reward instead of a zero-gold stub.
  if (snap.chestDraft) {
    state.chestDraft = snap.chestDraft.map((c, i) => {
      const prev = state.chestDraft?.[i];
      if (prev && prev.label === c.label) return prev;
      return { kind: "gold" as const, amount: c.amount ?? 0, label: c.label, blurb: c.blurb };
    });
  } else {
    state.chestDraft = null;
  }
  state.baseBranchDraft = snap.baseBranchDraft ? [...snap.baseBranchDraft] : null;
  state.utilityId = snap.utilityId ?? null;
  state.levelPassives = snap.levelPassives ? [...snap.levelPassives] : state.levelPassives;
  state.rerollTokens = snap.rerollTokens ?? state.rerollTokens;
  state.curseShopBlock = snap.curseShopBlock ?? 0;
  state.curseSendBlock = snap.curseSendBlock ?? 0;
  state.curseUpgradeBlock = snap.curseUpgradeBlock ?? 0;
  state.curseIncomeTaxTimer = snap.curseIncomeTaxTimer ?? 0;
  state.curseIncomeTaxMul = snap.curseIncomeTaxMul ?? 1;
  state.curseFogTimer = snap.curseFogTimer ?? 0;
  state.curseShopRefreshSlowTimer = snap.curseShopRefreshSlowTimer ?? 0;
  state.curseShopRefreshSlowMul = snap.curseShopRefreshSlowMul ?? 1;
  state.shopRefreshTimer = snap.shopRefreshTimer ?? state.shopRefreshTimer;
  state.mapFogActive = !!snap.mapFogActive;
  if (snap.fogOpacity != null) state.fogOpacity = snap.fogOpacity;
  if (snap.fogVisionRadiusResolved != null) {
    state.fogVisionRadiusResolved = snap.fogVisionRadiusResolved;
  }
  state.mapEclipseActive = !!snap.mapEclipseActive;
  // Full data again — HUD may stop falling back to the summary counters.
  state.summaryEnemyCount = null;
  state.summaryIncoming = null;
  state.snapIsSummary = false;
  if (snap.mapHazardX != null) state.mapHazardX = snap.mapHazardX;
  state.mapSupplyCrates = (snap.mapSupplyCrates ?? []).map((c) => ({ ...c }));
  if (snap.humanPlayers != null) state.humanPlayers = Math.max(1, snap.humanPlayers);
  state.chests = (snap.chests ?? []).map((c) => ({
    id: c.id,
    x: c.x,
    y: c.y,
    radius: c.radius,
    rarity: c.rarity as GameState["chests"][number]["rarity"],
    openDuration: c.openDuration,
    openProgress: c.openProgress,
    life: c.life,
  }));
  state.hexZones = (snap.hexZones ?? []).map((z) => ({
    x: z.x,
    y: z.y,
    radius: z.radius,
    life: z.life,
    dps: 0,
    kind: z.kind === "poison" ? "poison" : z.kind === "hex" ? "hex" : undefined,
  }));
  state.mapOrbs = (snap.mapOrbs ?? []).map((o) => ({
    x: o.x,
    y: o.y,
    radius: o.radius,
    fuse: o.fuse,
    damage: 0,
  }));
  if (snap.teleporters) {
    const prev = state.teleporters;
    state.teleporters = {
      a: snap.teleporters.a ? { ...snap.teleporters.a } : null,
      b: snap.teleporters.b ? { ...snap.teleporters.b } : null,
      linked: snap.teleporters.linked,
      nextReplace: prev.nextReplace,
    };
  }
  state.mines = (snap.mines ?? []).map((m) => ({
    id: m.id,
    x: m.x,
    y: m.y,
    radius: m.radius,
    armTimer: m.armTimer,
    damage: 0,
  }));
  if (snap.laneGeometry) {
    state.map.laneTop = snap.laneGeometry.laneTop;
    state.map.laneBottom = snap.laneGeometry.laneBottom;
    if (snap.laneGeometry.laneLeft != null) state.map.laneLeft = snap.laneGeometry.laneLeft;
    if (snap.laneGeometry.laneRight != null) state.map.laneRight = snap.laneGeometry.laneRight;
    state.map.obstacles = snap.laneGeometry.obstacles.map((o) => ({ ...o }));
  }

  if (snap.playerBags) {
    applyBags(state, snap.playerBags as Record<string, PlayerBag>, focusSlot);
  }

  const heroes = snap.heroes;
  if (heroes[0]) {
    applyHeroSnap(state.hero, heroes[0]);
  }
  while (state.allies.length < Math.max(0, heroes.length - 1)) {
    state.allies.push({ ...state.hero, id: state.nextId++ });
  }
  state.allies = state.allies.slice(0, Math.max(0, heroes.length - 1));
  for (let i = 1; i < heroes.length; i++) {
    applyHeroSnap(state.allies[i - 1]!, heroes[i]!);
  }

  // Rebuild lightweight enemy/turret/projectile lists from snap
  state.enemies = snap.enemies.map((e) => ({
    id: e.id,
    kind: e.kind as GameState["enemies"][number]["kind"],
    intent: "nearest" as const,
    x: e.x,
    y: e.y,
    hp: e.hp,
    maxHp: e.maxHp,
    radius: e.radius,
    alive: e.alive,
    sent: e.sent,
    speed: 40,
    contactDamage: 5,
    baseDamage: 8,
    goldReward: 5,
    ranged: false,
    attackRange: 0,
    attackCooldown: 1,
    attackCd: 0,
    attackDamage: 0,
    projectileSpeed: 0,
    telegraph: 0,
  }));
  state.turrets = snap.turrets.map((t) => ({
    id: t.id,
    kind: t.kind as GameState["turrets"][number]["kind"],
    x: t.x,
    y: t.y,
    hp: t.hp,
    maxHp: t.maxHp,
    radius: 14,
    alive: t.alive,
    fireCd: 0,
    slotIndex: t.slotIndex,
  }));
  state.projectiles = snap.projectiles.map((p) => ({
    x: p.x,
    y: p.y,
    vx: p.vx,
    vy: p.vy,
    damage: 0,
    alive: true,
    radius: p.radius,
    color: p.color,
    hostile: p.hostile,
  }));
}

/**
 * Apply a HUD-only lane digest. Entity arrays are deliberately left alone: the
 * client keeps its last known picture of that lane until it looks over and the
 * host promotes it back to full snapshots (no flicker, no vanishing units).
 */
export function applyLaneSummary(state: GameState, snap: LaneSummary): void {
  state.snapIsSummary = true;
  state.status = snap.status as GameState["status"];
  state.wave = snap.wave;
  state.waveTier = snap.waveTier as GameState["waveTier"];
  state.waveTimer = snap.waveTimer;
  state.spawning = snap.spawning;
  state.baseHp = snap.baseHp;
  state.baseLevel = snap.baseLevel;
  state.summaryEnemyCount = snap.enemyCount;
  state.summaryIncoming = snap.sentIncoming;
  const heroes = allLaneHeroes(state);
  for (const p of snap.players) {
    const h = heroes.find((x) => (x.controllerSlot ?? null) === p.slot);
    if (!h) continue;
    h.heroId = p.heroId;
    h.alive = p.alive;
    h.hp = p.hp;
    h.maxHp = p.maxHp;
  }
}

export function applyMatchSnap(match: MpMatch, snap: MatchSnap): void {
  const focus0 = match.myTeam === 0 ? match.mySlot : null;
  const focus1 = match.myTeam === 1 ? match.mySlot : null;
  const apply = (team: MpTeam, focus: number | null): void => {
    const payload = snap.lanes[team];
    if (isLaneSummary(payload)) applyLaneSummary(match.lanes[team], payload);
    else applyLaneSnap(match.lanes[team], payload, focus);
  };
  apply(0, focus0);
  apply(1, focus1);
  // viewTeam is local-only — never overwrite from host snap
  match.ended = snap.ended;
  match.winnerTeam = snap.winnerTeam;
}

/**
 * Cross-lane send exchange is handled inside `stepMpMatch` via outbound buffers.
 * Kept as a named helper for clarity / future drain markers.
 */
export function exchangeLaneSends(
  outboundFromA: GameState["pendingSends"],
  outboundFromB: GameState["pendingSends"],
  laneA: GameState,
  laneB: GameState,
): void {
  laneB.pendingSends.push(...outboundFromA);
  laneA.pendingSends.push(...outboundFromB);
  outboundFromA.length = 0;
  outboundFromB.length = 0;
}

export type { CombatIntent };
