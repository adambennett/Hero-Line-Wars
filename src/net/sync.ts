import type { GameState, HeroRuntime } from "../game/state";
import type { CombatIntent, HeroSnap, LaneSnap, MatchSnap, MpTeam } from "./types";
import type { MpMatch } from "./matchFactory";
import { allLaneHeroes } from "./matchFactory";

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
  };
}

export function buildMatchSnap(match: MpMatch, viewTeam: MpTeam): MatchSnap {
  return {
    mode: match.mode,
    myTeam: match.myTeam,
    viewTeam,
    lanes: [buildLaneSnap(match.lanes[0]), buildLaneSnap(match.lanes[1])],
    ended: match.ended,
    winnerTeam: match.winnerTeam,
  };
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
}

export function applyLaneSnap(state: GameState, snap: LaneSnap): void {
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
  state.pendingSends = snap.pendingSends.map((s) => ({ ...s }));
  state.beam = snap.beam ? { ...snap.beam } : null;
  state.fx = snap.fx.map((f) => ({ ...f }));

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

export function applyMatchSnap(match: MpMatch, snap: MatchSnap): void {
  applyLaneSnap(match.lanes[0], snap.lanes[0]);
  applyLaneSnap(match.lanes[1], snap.lanes[1]);
  match.viewTeam = snap.viewTeam;
  match.ended = snap.ended;
  match.winnerTeam = snap.winnerTeam;
}

/** Transfer pending sends that were just purchased — call after both lanes update shop/sends. */
export function exchangeLaneSends(a: GameState, b: GameState): void {
  // Sends queued on A should spawn on B and vice versa.
  // buySendPack already pushes to pendingSends on the buyer's state.
  // Host moves newly purchased packs across each frame via drain markers.
  const move = (from: GameState, to: GameState) => {
    if (from.pendingSends.length === 0) return;
    const batch = from.pendingSends.splice(0, from.pendingSends.length);
    to.pendingSends.push(...batch);
  };
  // Only exchange packs marked as outbound this tick — see mpUpdate outbound buffers.
  void move;
  void a;
  void b;
}

export type { CombatIntent };
