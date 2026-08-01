import { MAP_W, STARTING_GOLD, WIN_WAVES } from "../data/constants";
import { waveTierLabel } from "../data/enemies";
import { HEROES, type HeroId } from "../data/heroes";
import { registerSessionCustoms, resolveHero } from "../custom/registry";
import { RELICS } from "../data/relics";
import { relicArtImg } from "../data/relicArt";
import { LEVEL_PASSIVES } from "../data/xp";
import { RARITY_COLOR, RARITY_LABEL } from "../data/rarity";
import { gunnerWeaponLabel } from "../systems/gunner";
import { getShopItem } from "../data/shop";
import type { ShopItemId } from "../data/shop";
import { SEND_PACKS } from "../data/send";
import { DEFAULT_MAX_TURRETS } from "../data/turrets";
import {
  chooseCurse,
  chooseLevelUp,
  chooseRelic,
  chooseUtility,
  createState,
  laneEnemiesRemaining,
  skipRelic,
  update,
  type GameState,
  type RunOptions,
} from "./state";
import { UTILITIES } from "../data/utilities";
import { nearAnyShop } from "../data/maps";
import { CURSES } from "../data/curses";
import { buyShopItem, toggleShopFreeze, shopItemCost } from "../systems/shop";
import { chooseChestReward } from "../systems/chests";
import { availableSendPacks, buySendPack, sendPackCost } from "../systems/send";
import { tryUpgradeBase, upgradeBaseCost } from "../systems/baseUpgrade";
import { xpProgress, openRunStartUtilityDraft, rerollLevelDraft, rerollRelicDraft } from "../systems/xp";
import { effectiveMaxTurrets, livingTurrets } from "../systems/turrets";
import { Input } from "../systems/input";
import { computeView, draw } from "../render/draw";
import { MenuController, type LobbyDraft } from "../ui/MenuController";
import { formatBinding, loadSettings } from "../ui/settings";
import { playSfx, unlockAudio } from "../systems/audio";
import { stopMenuMusic } from "../systems/music";
import { opponentStatusLabel, opponentEnemiesRemaining } from "../systems/opponent";
import { MultiplayerUi } from "../net/MultiplayerUi";
import {
  bindHooks,
  bindMatchHandlers,
  disconnectNet,
  netPeerSlots,
  netSendToHost,
  netSendToSlot,
} from "../net/session";
import { applyMatchSnap, buildMatchSnapFor, newSnapCache } from "../net/sync";
import { gatherLocalIntent, stepMpMatch } from "../net/mpSim";
import type { CombatIntent, NetMsg } from "../net/types";
import { createNeuralLaneAi } from "../ai/runtime";
import { resolveSelectedOpponent } from "../ai/store";
import { applyRunStartExtras } from "../meta/apply";
import { composeRunModifiers } from "../meta/modifiers";
import { applyRunPayout, loadMetaStore } from "../meta/store";
import { careerDeltaFromState } from "../meta/runStats";
import { evaluateChallenges, CHALLENGES } from "../meta/challenges";
import { gameplayCheats } from "../meta/cheats";
import { canPauseSimulation, isMultiHumanGame } from "./pause";
import { pendingDraftCount } from "../systems/drafts";
import { chooseBaseBranch } from "../systems/baseUpgrade";
import { BASE_BRANCHES } from "../data/baseBranches";
import { ascensionLabel } from "../meta/ascension";
import {
  buildMpMatch,
  buildSoloVsAiMatch,
  heroForSlot,
  laneForSlot,
  type MpMatch,
} from "../net/matchFactory";
import { focusBag, withPlayerBag } from "../net/playerBag";
import { emptyIntent } from "../net/types";

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly input = new Input();
  private state: GameState | null = null;
  private last = 0;
  private running = false;
  private runDefaults: RunOptions = {
    mapId: "random",
    maxTurrets: DEFAULT_MAX_TURRETS,
    startingGold: STARTING_GOLD,
    wavesToWin: WIN_WAVES,
    friendlyFire: false,
    ascension: 0,
    livesPerWave: 0,
    livesPerRun: 0,
  };

  private readonly statsEl: HTMLElement;
  private readonly goldAmountEl: HTMLElement;
  private readonly incomeEl: HTMLElement;
  private readonly hintEl: HTMLElement;
  private readonly abilityEl: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly bannerEl: HTMLElement;
  private readonly respawnEl: HTMLElement;
  private readonly hud: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly overlayTitle: HTMLElement;
  private readonly overlayBody: HTMLElement;
  private readonly overlayActions: HTMLElement;
  private readonly shopPanel: HTMLElement;
  private readonly shopItemsEl: HTMLElement;
  private readonly shopMetaEl: HTMLElement;
  private readonly shopFreezeBtn: HTMLButtonElement;
  private readonly sendBar: HTMLElement;
  private readonly sendItemsEl: HTMLElement;
  private readonly upgradeBaseBtn: HTMLButtonElement;
  private readonly xpLevelEl: HTMLElement;
  private readonly xpTextEl: HTMLElement;
  private readonly xpFillEl: HTMLElement;
  private readonly xpBar: HTMLElement;
  private readonly hpLabelEl: HTMLElement;
  private readonly hpTextEl: HTMLElement;
  private readonly hpFillEl: HTMLElement;
  private readonly hpBar: HTMLElement;
  private readonly hudPanel: HTMLElement;
  private readonly laneChrome: HTMLElement;
  private readonly mapNameEl: HTMLElement;
  private readonly waveBannerEl: HTMLElement;
  private readonly waveNumberEl: HTMLElement;
  private readonly waveTierEl: HTMLElement;
  private readonly laneEnemyCountsEl: HTMLElement;
  private readonly baseHpRail: HTMLElement;
  private readonly baseHpFill: HTMLElement;
  private readonly opponentPanel: HTMLElement;
  private readonly oppNameEl: HTMLElement;
  private readonly oppStatsEl: HTMLElement;
  private readonly laneFlipBtn: HTMLButtonElement;
  private readonly relicDraft: HTMLElement;
  private readonly relicChoices: HTMLElement;
  private readonly relicSkip: HTMLButtonElement;
  private readonly draftTitle: HTMLElement;
  private readonly draftBlurb: HTMLElement;
  private readonly pauseBtn: HTMLButtonElement;
  private readonly invBtn: HTMLButtonElement;
  private readonly invPanel: HTMLElement;
  private readonly invList: HTMLElement;
  private readonly tooltip: HTMLElement;
  private readonly menus: MenuController;
  private mpUi: MultiplayerUi | null = null;
  private mpMatch: MpMatch | null = null;
  private mpHost = false;
  private remoteIntents = new Map<number, CombatIntent>();
  /** Host: which lane each remote seat is watching (drives full vs summary snaps). */
  private remoteViews = new Map<number, 0 | 1>();
  /** Client: last lane we told the host we were watching. */
  private lastReportedView: 0 | 1 | null = null;
  private intentSeq = 0;
  private snapSeq = 0;
  /** Queued draft / shop UI choices for the next MP intent frame. */
  private mpUiIntent: CombatIntent = emptyIntent();
  private lastShopKey = "";
  private lastSendUnlockKey = "";
  private lastDraftKey = "";
  private lastAbilityKey = "";
  private pauseMode: "none" | "paused" | "confirm" | "settings" | "inventory" = "none";
  /** Edge tracker for auto-open shop in MP / dual-lane. */
  private wasNearShopAuto = false;
  private mpDisconnectHandled = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.canvas.tabIndex = 0;
    this.canvas.style.outline = "none";
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");
    this.ctx = ctx;

    this.statsEl = document.querySelector("#hud-stats")!;
    this.goldAmountEl = document.querySelector("#hud-gold-amount")!;
    this.incomeEl = document.querySelector("#hud-income")!;
    this.hintEl = document.querySelector("#hud-hint")!;
    this.abilityEl = document.querySelector("#hud-abilities")!;
    this.toastEl = document.querySelector("#hud-toast")!;
    this.bannerEl = document.querySelector("#hud-banner")!;
    this.respawnEl = document.querySelector("#hud-respawn")!;
    this.hud = document.querySelector("#hud")!;
    this.overlay = document.querySelector("#overlay")!;
    this.overlayTitle = document.querySelector("#overlay-title")!;
    this.overlayBody = document.querySelector("#overlay-body")!;
    this.overlayActions = document.querySelector("#overlay-actions")!;
    this.shopPanel = document.querySelector("#shop-panel")!;
    this.shopItemsEl = document.querySelector("#shop-items")!;
    this.shopMetaEl = document.querySelector("#shop-meta")!;
    this.shopFreezeBtn = document.querySelector("#shop-freeze-btn")!;
    this.sendBar = document.querySelector("#send-bar")!;
    this.sendItemsEl = document.querySelector("#send-bar-items")!;
    this.upgradeBaseBtn = document.querySelector("#upgrade-base-btn")!;
    this.xpLevelEl = document.querySelector("#xp-level")!;
    this.xpTextEl = document.querySelector("#xp-text")!;
    this.xpFillEl = document.querySelector("#xp-fill")!;
    this.xpBar = document.querySelector("#xp-bar")!;
    this.hpLabelEl = document.querySelector("#hp-label")!;
    this.hpTextEl = document.querySelector("#hp-text")!;
    this.hpFillEl = document.querySelector("#hp-fill")!;
    this.hpBar = document.querySelector("#hp-bar")!;
    this.hudPanel = document.querySelector("#hud-panel")!;
    this.laneChrome = document.querySelector("#lane-chrome")!;
    this.mapNameEl = document.querySelector("#map-name-label")!;
    this.waveBannerEl = document.querySelector("#wave-banner")!;
    this.waveNumberEl = document.querySelector("#wave-number")!;
    this.waveTierEl = document.querySelector("#wave-tier")!;
    this.laneEnemyCountsEl = document.querySelector("#lane-enemy-counts")!;
    this.baseHpRail = document.querySelector("#base-hp-rail")!;
    this.baseHpFill = document.querySelector("#base-hp-fill")!;
    this.opponentPanel = document.querySelector("#opponent-panel")!;
    this.oppNameEl = document.querySelector("#opp-name")!;
    this.oppStatsEl = document.querySelector("#opp-stats")!;
    this.laneFlipBtn = document.querySelector("#lane-flip-btn")!;
    this.relicDraft = document.querySelector("#relic-draft")!;
    this.relicChoices = document.querySelector("#relic-choices")!;
    this.relicSkip = document.querySelector("#relic-skip")!;
    this.draftTitle = document.querySelector("#draft-title")!;
    this.draftBlurb = document.querySelector("#draft-blurb")!;
    this.pauseBtn = document.querySelector("#pause-btn")!;
    this.invBtn = document.querySelector("#inv-btn")!;
    this.invPanel = document.querySelector("#inv-panel")!;
    this.invList = document.querySelector("#inv-list")!;
    this.tooltip = document.querySelector("#tooltip")!;

    const menusRoot = document.querySelector<HTMLElement>("#menus");
    if (!menusRoot) throw new Error("#menus missing");
    this.menus = new MenuController(menusRoot, {
      onStartSingleplayer: (heroId, opts) => this.beginRun(heroId, opts),
      onOpenMultiplayer: (draft, heroId) => this.openMultiplayer(draft, heroId),
      onSettingsChanged: () => {
        this.input.reloadBinds();
      },
      onRunOptionsChanged: (opts) => {
        this.runDefaults = { ...this.runDefaults, ...opts };
      },
    });

    this.refreshHint();
    const focusGame = () => {
      this.canvas.focus({ preventScroll: true });
    };
    this.upgradeBaseBtn.addEventListener("click", () => {
      if (!this.state || this.state.paused) return;
      tryUpgradeBase(this.state);
      this.refreshSendBar();
      focusGame();
    });
    this.pauseBtn.addEventListener("click", () => {
      this.togglePause();
      focusGame();
    });
    this.invBtn.addEventListener("click", () => {
      this.toggleInventory();
      focusGame();
    });
    this.laneFlipBtn.addEventListener("click", () => {
      if (this.mpMatch) {
        this.mpMatch.viewTeam = (1 - this.mpMatch.viewTeam) as 0 | 1;
        this.state = this.mpMatch.lanes[this.mpMatch.viewTeam];
        this.reportViewTeam();
        this.laneFlipBtn.textContent =
          this.mpMatch.viewTeam === this.mpMatch.myTeam ? "View lane" : "Your lane";
        this.laneFlipBtn.classList.toggle("active", this.mpMatch.viewTeam !== this.mpMatch.myTeam);
        playSfx("ui");
        focusGame();
        return;
      }
      if (!this.state || this.state.paused || this.state.endless) return;
      this.state.viewOpponentLane = !this.state.viewOpponentLane;
      this.laneFlipBtn.textContent = this.state.viewOpponentLane ? "Your lane" : "View lane";
      this.laneFlipBtn.classList.toggle("active", this.state.viewOpponentLane);
      playSfx("ui");
      focusGame();
    });
    document.querySelector("#inv-close")!.addEventListener("click", () => {
      this.closeInventory();
      focusGame();
    });
    this.shopFreezeBtn.addEventListener("click", () => {
      if (!this.state) return;
      toggleShopFreeze(this.state);
      this.lastShopKey = "";
      this.refreshShopDom();
      focusGame();
    });
    this.relicSkip.addEventListener("click", () => {
      if (!this.state) return;
      if (this.mpMatch) {
        this.mpUiIntent.skipRelic = true;
      } else {
        skipRelic(this.state);
      }
      this.lastDraftKey = "";
      this.relicDraft.classList.add("hidden");
      focusGame();
    });
    for (const el of [
      this.shopPanel,
      this.sendBar,
      this.relicDraft,
      this.laneChrome,
      this.invPanel,
      this.opponentPanel,
      this.baseHpRail,
      this.waveBannerEl,
    ]) {
      el.addEventListener("mousedown", (e) => e.stopPropagation());
      el.addEventListener("mouseup", (e) => e.stopPropagation());
      el.addEventListener("click", () => focusGame());
    }

    window.addEventListener("resize", () => this.resize());
    window.addEventListener("keydown", (e) => {
      // Plain Escape is handled by the frame loop via consumeAction("pause") so
      // it stays remappable and never double-toggles. Sub-overlays are handled
      // here because the frame loop skips input while a menu is on screen.
      if (e.code !== "Escape" || !this.state) return;
      if (this.pauseMode !== "confirm" && this.pauseMode !== "settings") return;
      e.preventDefault();
      this.showPauseMenu();
    });
    window.addEventListener(
      "pointerdown",
      () => unlockAudio(),
      { once: true },
    );

    this.bindTooltipDelegation();
    this.resize();
    this.showMainMenu();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  private bindTooltipDelegation(): void {
    const show = (html: string, ev: MouseEvent) => {
      this.tooltip.innerHTML = html;
      this.tooltip.classList.remove("hidden");
      this.positionTooltip(ev.clientX, ev.clientY);
    };
    const hide = () => this.tooltip.classList.add("hidden");
    const move = (ev: MouseEvent) => {
      if (!this.tooltip.classList.contains("hidden")) {
        this.positionTooltip(ev.clientX, ev.clientY);
      }
    };
    document.addEventListener("mouseover", (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
      if (!t?.dataset.tip) return;
      show(t.dataset.tip, e as MouseEvent);
    });
    document.addEventListener("mouseout", (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
      if (t) hide();
    });
    document.addEventListener("mousemove", move);
  }

  private positionTooltip(x: number, y: number): void {
    const pad = 14;
    this.tooltip.style.left = `${Math.min(window.innerWidth - 280, x + pad)}px`;
    this.tooltip.style.top = `${Math.min(window.innerHeight - 120, y + pad)}px`;
  }

  private refreshHint(): void {
    const kb = loadSettings().keybinds;
    this.hintEl.textContent =
      `Move · ${formatBinding(kb.attack)} attack · ${formatBinding(kb.mobility)} mobility · ${formatBinding(kb.ultimate)} ult · ${formatBinding(kb.utility)} utility · sends · U upgrade · shop · Esc pause · Pad supported`;
  }

  private showMainMenu(): void {
    this.endMultiplayer();
    this.state = null;
    this.pauseMode = "none";
    this.hideCombatChrome();
    this.input.reloadBinds();
    this.refreshHint();
    this.menus.show("main", { allowMenuMusic: true });
  }

  private returnToMainMenu(): void {
    this.endMultiplayer();
    this.state = null;
    this.pauseMode = "none";
    this.hideCombatChrome();
    this.input.reloadBinds();
    this.refreshHint();
    this.menus.show("main", { allowMenuMusic: true });
  }

  private beginRun(heroId: HeroId, opts?: Partial<RunOptions>): void {
    unlockAudio();
    stopMenuMusic();
    this.menus.hide();
    this.input.reset();
    this.input.reloadBinds();
    this.canvas.focus({ preventScroll: true });
    this.refreshHint();
    const ascension = opts?.ascension ?? this.runDefaults.ascension ?? 0;
    const meta = loadMetaStore();
    const playerMods = composeRunModifiers(ascension, meta.ranks, true);
    const merged: RunOptions = {
      ...opts,
      mapId: opts?.mapId ?? this.runDefaults.mapId ?? "random",
      maxTurrets: opts?.maxTurrets ?? this.runDefaults.maxTurrets ?? DEFAULT_MAX_TURRETS,
      startingGold: opts?.startingGold ?? this.runDefaults.startingGold ?? STARTING_GOLD,
      wavesToWin: opts?.wavesToWin ?? this.runDefaults.wavesToWin ?? WIN_WAVES,
      friendlyFire: opts?.friendlyFire ?? this.runDefaults.friendlyFire ?? false,
      ascension,
      livesPerWave: opts?.livesPerWave ?? this.runDefaults.livesPerWave ?? 0,
      livesPerRun: opts?.livesPerRun ?? this.runDefaults.livesPerRun ?? 0,
      modifiers: playerMods,
      teamSize: opts?.teamSize ?? 1,
      endless: !!opts?.endless,
      chestOpenMul: opts?.chestOpenMul ?? 1,
      chestDespawnSec: opts?.chestDespawnSec ?? 28,
      chestSpawnChance: opts?.chestSpawnChance ?? 0.08,
      utilityDraftLevel: opts?.utilityDraftLevel ?? 10,
    };

    if (merged.endless) {
      merged.teamSize = 1;
      merged.wavesToWin = 0;
      merged.friendlyFire = false;
    }

    const opp = resolveSelectedOpponent();
    const teamSize = merged.teamSize ?? 1;

    // Dual-lane when team size > 1 (AI allies) or neural opponent selected (not endless)
    if (!merged.endless && (teamSize > 1 || opp.kind === "neural")) {
      this.beginSoloVsAi(heroId, merged, opp.kind === "neural" ? opp : null, teamSize);
      return;
    }

    this.mpMatch = null;
    this.state = createState(heroId, merged);
    applyRunStartExtras(this.state, playerMods);
    this.pauseMode = "none";
    this.overlay.classList.add("hidden");
    this.shopPanel.classList.add("hidden");
    this.relicDraft.classList.add("hidden");
    this.invPanel.classList.add("hidden");
    this.laneChrome.classList.remove("hidden");
    this.baseHpRail.classList.remove("hidden");
    this.opponentPanel.classList.toggle("hidden", !!this.state.endless);
    this.hud.classList.remove("hidden");
    this.waveBannerEl.classList.remove("hidden");
    this.laneFlipBtn.textContent = "View lane";
    this.laneFlipBtn.classList.remove("active");
    this.laneFlipBtn.classList.toggle("hidden", !!this.state.endless);
    this.mapNameEl.textContent = this.state.map.name;
    this.lastDraftKey = "";
    this.lastShopKey = "";
    this.lastSendUnlockKey = "";
    this.lastAbilityKey = "";
    this.wasNearShopAuto = false;
    this.buildSendBar();
    this.layoutLaneChrome();
    this.last = performance.now();
  }

  /** Dual-lane offline match vs a trained (or scripted) AI — base death wins on unlimited. */
  private beginSoloVsAi(
    heroId: HeroId,
    opts: RunOptions,
    opp: Extract<ReturnType<typeof resolveSelectedOpponent>, { kind: "neural" }> | null,
    teamSize: 1 | 2 | 3 = 1,
  ): void {
    this.mpHost = true;
    this.remoteIntents.clear();
    const meta = loadMetaStore();
    const playerMods = opts.modifiers ?? composeRunModifiers(opts.ascension, meta.ranks, true);
    const enemyMods = composeRunModifiers(opts.ascension, meta.ranks, false);
    const agg = playerMods.opponentAggressionMul;
    const neural = opp
      ? createNeuralLaneAi(opp.genome, Math.max(0, opp.hesitation / agg), opp.label)
      : null;
    this.mpMatch = buildSoloVsAiMatch({
      playerHeroId: heroId,
      mapId: opts.mapId,
      maxTurrets: opts.maxTurrets,
      seed: (Math.random() * 1e9) | 0,
      startingGold: opts.startingGold,
      wavesToWin: opts.wavesToWin,
      friendlyFire: opts.friendlyFire,
      neural,
      opponentLabel: opp?.label ?? "Lane AI",
      playerModifiers: playerMods,
      enemyModifiers: enemyMods,
      teamSize,
      chestOpenMul: opts.chestOpenMul,
      chestDespawnSec: opts.chestDespawnSec,
      chestSpawnChance: opts.chestSpawnChance,
      utilityDraftLevel: opts.utilityDraftLevel,
      livesPerWave: opts.livesPerWave ?? 0,
      livesPerRun: opts.livesPerRun ?? 0,
      enemyDensityMul: opts.enemyDensityMul,
      enemyHpMul: opts.enemyHpMul,
      enemySpeedMul: opts.enemySpeedMul,
      incomeMul: opts.incomeMul,
      respawnMul: opts.respawnMul,
      startingBaseLevel: opts.startingBaseLevel,
      levelDraftSize: opts.levelDraftSize,
      relicDraftSize: opts.relicDraftSize,
      disableArtifacts: opts.disableArtifacts,
      disableChests: opts.disableChests,
      disableElites: opts.disableElites,
      disableBosses: opts.disableBosses,
      disableShop: opts.disableShop,
      disableSends: opts.disableSends,
      disableRelics: opts.disableRelics,
      fogAlways: opts.fogAlways,
      fogThicknessPct: opts.fogThicknessPct,
      fogVisionRadius: opts.fogVisionRadius,
      doubleElites: opts.doubleElites,
      suddenDeathBaseHp: opts.suddenDeathBaseHp,
      glassCannon: opts.glassCannon,
      goldRush: opts.goldRush,
      wildChests: opts.wildChests,
      crampedLane: opts.crampedLane,
    });
    applyRunStartExtras(this.mpMatch.lanes[0], playerMods);
    this.state = this.mpMatch.lanes[0];
    this.pauseMode = "none";
    this.overlay.classList.add("hidden");
    this.shopPanel.classList.add("hidden");
    this.relicDraft.classList.add("hidden");
    this.invPanel.classList.add("hidden");
    this.laneChrome.classList.remove("hidden");
    this.baseHpRail.classList.remove("hidden");
    this.opponentPanel.classList.remove("hidden");
    this.hud.classList.remove("hidden");
    this.waveBannerEl.classList.remove("hidden");
    this.laneFlipBtn.classList.remove("hidden");
    this.laneFlipBtn.textContent = "View lane";
    this.laneFlipBtn.classList.remove("active");
    this.mapNameEl.textContent = this.state.map.name;
    this.lastDraftKey = "";
    this.lastShopKey = "";
    this.lastSendUnlockKey = "";
    this.lastAbilityKey = "";
    this.wasNearShopAuto = false;
    this.buildSendBar();
    this.layoutLaneChrome();
    this.last = performance.now();
  }

  private layoutLaneChrome(): void {
    if (!this.state) return;
    const view = computeView(this.canvas);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s = view.scale / dpr;
    const mapLeft = view.offsetX / dpr;
    const mapTop = view.offsetY / dpr;
    const map = this.state.map;
    const laneTopCss = mapTop + map.laneTop * s;
    const laneBottomCss = mapTop + map.laneBottom * s;
    const laneW = MAP_W * s;
    const laneLeft = mapLeft;
    const pad = 10;
    const barStack = 36;

    const sendW = Math.min(laneW, window.innerWidth - 40);
    this.sendBar.style.width = `${sendW}px`;
    this.sendBar.style.left = `${(window.innerWidth - sendW) / 2}px`;

    this.xpBar.style.width = `${laneW}px`;
    this.xpBar.style.left = `${laneLeft}px`;
    this.xpBar.style.top = `${Math.max(pad, laneTopCss - barStack - 6)}px`;

    const xpTop = parseFloat(this.xpBar.style.top) || laneTopCss - barStack;
    this.sendBar.style.top = `${Math.max(pad + 44, xpTop - 78)}px`;

    // Wave banner sits directly above the send menu (centered).
    const sendTop = parseFloat(this.sendBar.style.top) || pad + 44;
    this.waveBannerEl.style.width = `${sendW}px`;
    this.waveBannerEl.style.left = `${(window.innerWidth - sendW) / 2}px`;
    this.waveBannerEl.style.top = `${Math.max(8, sendTop - 52)}px`;

    // Top-left stats panel sits just above the XP bar (aligned to lane left).
    this.hudPanel.style.left = `${laneLeft}px`;
    this.hudPanel.style.top = `${Math.max(pad + 22, xpTop - this.hudPanel.offsetHeight - 8)}px`;

    // Subtle map name — way top-left of the screen.
    this.mapNameEl.style.left = `${Math.max(10, laneLeft)}px`;
    this.mapNameEl.style.top = `8px`;

    // Vertical base HP rail — same height as the playable lane strip (between XP and HP bars).
    const railH = Math.max(60, laneBottomCss - laneTopCss);
    this.baseHpRail.style.left = `${Math.max(4, laneLeft - 20)}px`;
    this.baseHpRail.style.top = `${laneTopCss}px`;
    this.baseHpRail.style.height = `${railH}px`;

    this.hpBar.style.width = `${laneW}px`;
    this.hpBar.style.left = `${laneLeft}px`;
    this.hpBar.style.top = `${laneBottomCss + pad}px`;

    const belowHp = laneBottomCss + pad + barStack + 10;
    this.pauseBtn.style.left = `${laneLeft}px`;
    this.pauseBtn.style.top = `${belowHp}px`;

    const rightPad = Math.max(pad, window.innerWidth - laneLeft - laneW);
    this.abilityEl.style.right = `${rightPad}px`;
    this.abilityEl.style.top = `${belowHp}px`;

    this.invBtn.style.left = `${laneLeft + laneW / 2}px`;
    this.invBtn.style.right = "auto";
    this.invBtn.style.top = `${belowHp}px`;
  }

  private syncAimFromMouse(): void {
    if (!this.state) return;
    const view = computeView(this.canvas);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const sx = (this.input.mouseClientX - rect.left) * dpr;
    const sy = (this.input.mouseClientY - rect.top) * dpr;
    this.state.aimWorldX = (sx - view.offsetX) / view.scale;
    this.state.aimWorldY = (sy - view.offsetY) / view.scale;
  }

  /** Single source of truth for "may this client freeze the sim right now?". */
  private canPauseNow(): boolean {
    return canPauseSimulation(this.mpMatch ?? this.state);
  }

  private togglePause(): void {
    if (!this.state || this.state.status !== "playing") return;
    if (this.pauseMode === "inventory") {
      this.closeInventory();
      return;
    }
    if (this.pauseMode === "paused") {
      this.resumeFromPause();
      return;
    }
    if (this.pauseMode === "confirm" || this.pauseMode === "settings") {
      this.showPauseMenu();
      return;
    }
    // A draft owns the screen in single-human runs; with more humans the match
    // keeps running and the menu may open on top of the draft.
    if (this.state.pausedForDraft && this.canPauseNow()) return;
    this.closeInventory();
    if (this.canPauseNow()) this.state.paused = true;
    this.showPauseMenu();
    playSfx("ui");
  }

  private resumeFromPause(): void {
    if (!this.state) return;
    this.state.paused = false;
    this.pauseMode = "none";
    this.overlay.classList.add("hidden");
    this.canvas.focus({ preventScroll: true });
    playSfx("ui");
  }

  private showPauseMenu(): void {
    const freeze = this.canPauseNow();
    this.pauseMode = "paused";
    this.overlayTitle.textContent = freeze ? "Paused" : "Menu";
    this.overlayBody.textContent = freeze
      ? "Combat and waves are frozen."
      : "The match keeps running — pausing is disabled with more than one player.";
    this.overlayActions.innerHTML = "";

    const cont = document.createElement("button");
    cont.type = "button";
    cont.textContent = freeze ? "Continue" : "Back to match";
    cont.addEventListener("click", () => this.resumeFromPause());
    this.overlayActions.appendChild(cont);

    const settings = document.createElement("button");
    settings.type = "button";
    settings.textContent = "Settings";
    settings.addEventListener("click", () => this.openPauseSettings());
    this.overlayActions.appendChild(settings);

    const menu = document.createElement("button");
    menu.type = "button";
    menu.textContent = "Back to menu";
    menu.addEventListener("click", () => this.confirmAbandon());
    this.overlayActions.appendChild(menu);

    this.overlay.classList.remove("hidden");
  }

  private openPauseSettings(): void {
    this.pauseMode = "settings";
    this.overlay.classList.add("hidden");
    this.menus.show("settings", { allowMenuMusic: false });
    // Hook: when menus go to main from in-run settings, bounce back to the
    // in-run menu instead of dumping the player on the title screen.
    const root = document.querySelector("#menus")!;
    const obs = new MutationObserver(() => {
      if (this.pauseMode !== "settings" || !this.state) {
        obs.disconnect();
        return;
      }
      if (root.querySelector(".menu-title")?.textContent === "Hero Line Wars") {
        this.menus.hide();
        this.showPauseMenu();
        obs.disconnect();
      }
    });
    obs.observe(root, { childList: true, subtree: true });
  }

  private confirmAbandon(): void {
    this.pauseMode = "confirm";
    this.overlayTitle.textContent = "Abandon run?";
    this.overlayBody.textContent = "You'll lose this run and return to the main menu.";
    this.overlayActions.innerHTML = "";

    const yes = document.createElement("button");
    yes.type = "button";
    yes.textContent = "Abandon";
    yes.addEventListener("click", () => this.returnToMainMenu());
    this.overlayActions.appendChild(yes);

    const no = document.createElement("button");
    no.type = "button";
    no.textContent = "Cancel";
    no.addEventListener("click", () => this.showPauseMenu());
    this.overlayActions.appendChild(no);

    this.overlay.classList.remove("hidden");
  }

  private toggleInventory(): void {
    if (!this.state || this.state.status !== "playing") return;
    if (this.state.pausedForDraft && this.canPauseNow()) return;
    // Don't open bag over the Esc pause menu
    if (this.pauseMode === "paused" || this.pauseMode === "confirm" || this.pauseMode === "settings") {
      return;
    }

    if (this.invPanel.classList.contains("hidden")) {
      this.refreshInventory();
      this.invPanel.classList.remove("hidden");
      // Single human: freeze combat while browsing the bag. With more humans the
      // bag is an overlay only — the match keeps running behind it.
      if (!this.state.paused && this.canPauseNow()) {
        this.state.paused = true;
        this.pauseMode = "inventory";
      }
    } else {
      this.closeInventory();
    }
  }

  private closeInventory(): void {
    this.invPanel.classList.add("hidden");
    if (this.state && this.pauseMode === "inventory") {
      this.state.paused = false;
      this.pauseMode = "none";
    }
    this.canvas.focus({ preventScroll: true });
  }

  private refreshInventory(): void {
    if (!this.state) return;
    const parts: string[] = [];
    if (this.state.relics.length === 0 && Object.keys(this.state.shopOwned).length === 0) {
      parts.push(`<p class="panel-note">Nothing owned yet.</p>`);
    }
    for (const id of this.state.relics) {
      const r = RELICS[id];
      parts.push(
        `<article class="inv-row"><strong style="color:${RARITY_COLOR[r.rarity]}">${r.name}</strong><span>${r.blurb}</span><em>${RARITY_LABEL[r.rarity]} · ${r.tag}</em></article>`,
      );
    }
    for (const [id, n] of Object.entries(this.state.shopOwned)) {
      if (!n) continue;
      const def = getShopItem(id as ShopItemId);
      if (!def) continue;
      parts.push(
        `<article class="inv-row"><strong style="color:${RARITY_COLOR[def.rarity]}">${def.name} ×${n}</strong><span>${def.effect}</span><em>${RARITY_LABEL[def.rarity]}</em></article>`,
      );
    }
    const hero = resolveHero(this.state.hero.heroId);
    parts.unshift(
      `<article class="inv-row"><strong>Passive — ${hero.passive.name}</strong><span>${hero.passive.blurb}</span></article>`,
    );
    this.invList.innerHTML = parts.join("");
  }

  private showEndOverlay(): void {
    if (!this.state || !this.overlay.classList.contains("hidden")) return;
    if (this.pauseMode !== "none") return;
    const won = this.state.status === "won";
    const heroName = resolveHero(this.state.hero.heroId).name;
    const relicNames = this.state.relics.map((id) => RELICS[id].name).join(", ") || "none";
    const mapName = this.state.map.name;
    const payout = applyRunPayout({
      won,
      wave: this.state.wave,
      sends: this.state.sendsThisRun,
      ascension: this.state.ascension,
      deaths: this.state.deathCount,
      unlimited: this.state.wavesToWin <= 0,
      crestGainMul: this.state.modifiers.crestGainMul,
      careerDelta: careerDeltaFromState(this.state, won),
    });
    const newly = evaluateChallenges({
      won,
      wave: this.state.wave,
      deaths: this.state.deathCount,
      ascension: this.state.ascension,
      sends: this.state.sendsThisRun,
      shopBuys: this.state.shopBuys,
      chestsOpened: this.state.chestsOpened,
      bossesKilled: this.state.bossesKilled,
      elitesKilled: this.state.elitesKilled,
      artifactsPlaced: this.state.artifactsPlaced,
      relicsOwned: this.state.relics.length,
      baseLevel: this.state.baseLevel,
      gold: this.state.gold,
      levelDrafts: this.state.levelDraftsTaken,
      mapId: this.state.mapId,
      teamSize: this.state.teamSize,
      heroId: this.state.hero.heroId,
    });
    const challengeLine =
      newly.length > 0
        ? ` Challenges unlocked: ${newly.map((id) => CHALLENGES.find((c) => c.id === id)?.name ?? id).join(", ")}.`
        : "";
    const crestLine = `+${payout.crests} War Crests (${payout.store.crests} total)${
      payout.unlockedAscension != null ? ` · Unlocked ${ascensionLabel(payout.unlockedAscension)}` : ""
    }${challengeLine}`;
    const endless = this.state.endless;
    this.overlayTitle.textContent = won
      ? "Lane held!"
      : endless
        ? "Endless run over"
        : "Base fallen";
    this.overlayBody.textContent = won
      ? `${heroName} cleared ${this.state.wavesToWin <= 0 ? this.state.wave : this.state.wavesToWin} waves on ${mapName} (Lv ${this.state.level}, ${ascensionLabel(this.state.ascension)}). Relics: ${relicNames}. ${crestLine}`
      : endless
        ? `${heroName} survived ${this.state.wave} waves on ${mapName} (Lv ${this.state.level}, ${ascensionLabel(this.state.ascension)}). Sends ${this.state.sendsThisRun}. Deaths ${this.state.deathCount}. Relics: ${relicNames}. ${crestLine}`
        : `${heroName} fell on wave ${this.state.wave} (${mapName}, ${ascensionLabel(this.state.ascension)}). Deaths ${this.state.deathCount}. ${crestLine}`;
    this.overlayActions.innerHTML = "";

    const again = document.createElement("button");
    again.type = "button";
    again.textContent = "Play again";
    again.addEventListener("click", () => {
      this.state = null;
      this.hud.classList.add("hidden");
      this.laneChrome.classList.add("hidden");
      this.baseHpRail.classList.add("hidden");
      this.shopPanel.classList.add("hidden");
      this.relicDraft.classList.add("hidden");
      this.overlay.classList.add("hidden");
      this.menus.show("singleplayer", { allowMenuMusic: true });
    });
    this.overlayActions.appendChild(again);

    const barracks = document.createElement("button");
    barracks.type = "button";
    barracks.textContent = "Barracks";
    barracks.addEventListener("click", () => {
      this.state = null;
      this.hud.classList.add("hidden");
      this.laneChrome.classList.add("hidden");
      this.baseHpRail.classList.add("hidden");
      this.shopPanel.classList.add("hidden");
      this.relicDraft.classList.add("hidden");
      this.overlay.classList.add("hidden");
      this.menus.show("barracks", { allowMenuMusic: true });
    });
    this.overlayActions.appendChild(barracks);

    const menu = document.createElement("button");
    menu.type = "button";
    menu.textContent = "Main menu";
    menu.addEventListener("click", () => this.returnToMainMenu());
    this.overlayActions.appendChild(menu);

    this.overlay.classList.remove("hidden");
  }

  private buildSendBar(): void {
    this.sendItemsEl.innerHTML = "";
    if (!this.state) return;
    const label = document.querySelector(".send-bar-label");
    if (label) {
      label.textContent = this.state.endless
        ? "Send into your next wave (raises income — you fight them)"
        : "Send to enemy lane (raises your income)";
    }
    for (const pack of availableSendPacks(this.state)) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "send-chip";
      row.dataset.packId = pack.id;
      const tip = `<strong>${pack.name}</strong><br/>${pack.detail}<br/>Base ${pack.blurb}<br/><em>Cost scales with base upgrades</em>`;
      row.dataset.tip = tip;
      row.innerHTML = `<span class="send-key">${pack.digit}</span><span class="send-name">${pack.name}</span><span class="send-cost">${pack.cost}g</span>`;
      row.addEventListener("click", () => {
        if (!this.state || this.state.paused) return;
        buySendPack(this.state, pack.id);
        this.refreshSendBar();
      });
      this.sendItemsEl.appendChild(row);
    }
  }

  private refreshSendBar(): void {
    if (!this.state) return;
    const unlockKey = `${this.state.baseLevel}:${availableSendPacks(this.state)
      .map((p) => p.id)
      .join(",")}`;
    if (unlockKey !== this.lastSendUnlockKey) {
      this.lastSendUnlockKey = unlockKey;
      this.buildSendBar();
    }

    const packs = availableSendPacks(this.state);
    const chips = this.sendItemsEl.querySelectorAll<HTMLButtonElement>(".send-chip");
    chips.forEach((row, i) => {
      const pack = packs[i];
      if (!pack) return;
      const cost = sendPackCost(this.state!, pack.id);
      const costEl = row.querySelector(".send-cost");
      if (costEl) costEl.textContent = `${cost}g`;
      row.disabled = this.state!.gold < cost || this.state!.paused;
      const full = SEND_PACKS.find((p) => p.id === pack.id)!;
      row.dataset.tip = `<strong>${full.name}</strong><br/>${full.detail}<br/>Current cost ${cost}g · Base Lv ${this.state!.baseLevel}`;
    });

    const cost = upgradeBaseCost(this.state);
    this.upgradeBaseBtn.disabled = this.state.gold < cost || this.state.paused;
    this.upgradeBaseBtn.textContent = `Upgrade Base · ${cost}g (Lv ${this.state.baseLevel} → ${this.state.baseLevel + 1})`;
    this.upgradeBaseBtn.dataset.tip =
      this.state.baseLevel >= 4
        ? "No max level — each upgrade further strengthens unlocked send packs (cost, income, HP)."
        : "Raises base level: unlocks packs and strengthens existing send costs, income, and HP.";

    const xp = xpProgress(this.state);
    this.xpLevelEl.textContent = `Lv ${this.state.level}`;
    this.xpTextEl.textContent = `${Math.floor(xp.current)} / ${xp.needed}`;
    this.xpFillEl.style.width = `${Math.round(xp.ratio * 100)}%`;

    const hero = this.state.hero;
    const hp = Math.max(0, Math.ceil(hero.alive ? hero.hp : 0));
    const maxHp = Math.max(1, Math.ceil(hero.maxHp));
    this.hpLabelEl.textContent = hero.alive ? "HP" : "DOWN";
    this.hpTextEl.textContent = `${hp} / ${maxHp}`;
    const hpRatio = hero.alive ? Math.min(1, hero.hp / Math.max(1, hero.maxHp)) : 0;
    this.hpFillEl.style.width = `${Math.round(hpRatio * 100)}%`;
    this.hpFillEl.classList.toggle("low", hero.alive && hpRatio <= 0.35);
    this.hpFillEl.classList.toggle("dead", !hero.alive);
  }

  private refreshShopDom(): void {
    if (!this.state) return;
    const offerKey = `${this.state.shopOffer.join(",")}:${JSON.stringify(this.state.shopOwned)}`;
    if (offerKey !== this.lastShopKey) {
      this.shopItemsEl.innerHTML = "";
      this.state.shopOffer.forEach((id, i) => {
        const item = getShopItem(id);
        if (!item) return;
        const owned = this.state!.shopOwned[id] ?? 0;
        const maxed = owned >= item.maxStacks;
        const cost = shopItemCost(this.state!, item.cost);
        const broke = this.state!.gold < cost;
        const row = document.createElement("button");
        row.type = "button";
        row.className =
          "shop-row" +
          (maxed ? " owned-max" : "") +
          (broke && !maxed ? " unaffordable" : "") +
          (item.category === "artifact" ? " artifact" : "");
        row.disabled = maxed || broke || this.state!.paused;
        const tag = item.category === "artifact" ? "ARTIFACT · " : "";
        const rarity = RARITY_LABEL[item.rarity];
        const costLabel = maxed ? `×${owned} max` : broke ? `LOCKED ${cost}g` : `${cost}g`;
        row.innerHTML = `<span class="shop-name">[${i + 4}] ${item.name}</span><span class="shop-meta">${tag}${item.effect}</span><span class="shop-cost">${costLabel}</span>`;
        row.dataset.tip = `<strong style="color:${RARITY_COLOR[item.rarity]}">${item.name}</strong> · ${rarity}<br/>${item.effect}<br/>${cost}g · max ×${item.maxStacks}${broke && !maxed ? "<br/><span style=\"color:#ff6b6b\">Not enough gold</span>" : ""}`;
        const buyId = id;
        row.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (!this.state || this.state.paused) return;
          buyShopItem(this.state, buyId);
          this.lastShopKey = "";
          this.refreshShopDom();
          this.canvas.focus({ preventScroll: true });
        });
        this.shopItemsEl.appendChild(row);
      });
      this.lastShopKey = offerKey;
    } else {
      this.state.shopOffer.forEach((id, i) => {
        const item = getShopItem(id);
        if (!item) return;
        const row = this.shopItemsEl.children[i] as HTMLButtonElement | undefined;
        if (!row) return;
        const owned = this.state!.shopOwned[id] ?? 0;
        const maxed = owned >= item.maxStacks;
        const cost = shopItemCost(this.state!, item.cost);
        const broke = this.state!.gold < cost;
        row.disabled = maxed || broke || this.state!.paused;
        row.classList.toggle("owned-max", maxed);
        row.classList.toggle("unaffordable", broke && !maxed);
        const costEl = row.querySelector(".shop-cost");
        if (costEl) {
          costEl.textContent = maxed ? `×${owned} max` : broke ? `LOCKED ${cost}g` : `${cost}g`;
        }
      });
    }

    const isFrost = this.state.hero.heroId === "frost";
    this.shopFreezeBtn.classList.toggle("hidden", !isFrost);
    if (isFrost) {
      this.shopFreezeBtn.textContent = this.state.shopFrozen ? "Unfreeze timer" : "Freeze timer";
    }

    const turrets = livingTurrets(this.state).length;
    const cap = effectiveMaxTurrets(this.state);
    const waveActive = this.state.spawning || this.state.enemies.length > 0;
    let stock = "";
    if (this.state.shopFrozen) {
      stock = "Timer FROZEN";
    } else if (waveActive && this.state.shopRefreshesLeft > 0) {
      stock = `Stock refreshes in ${Math.max(0, this.state.shopRefreshTimer).toFixed(1)}s · ${this.state.shopRefreshesLeft} left`;
    } else if (waveActive) {
      stock = "No more refreshes this wave";
    } else {
      stock = "Between waves — stock frozen";
    }
    this.shopMetaEl.textContent = `${stock} · Artifacts ${turrets}/${cap}`;
  }

  /**
   * Draft panel. With more than one human the match keeps running behind it, so
   * the panel renders compact and advertises how many rewards are still queued.
   */
  private syncDraft(): void {
    if (!this.state) return;
    const compact = isMultiHumanGame(this.mpMatch ?? this.state);
    this.relicDraft.classList.toggle("compact-draft", compact);
    this.renderDraft();
    if (this.relicDraft.classList.contains("hidden")) return;
    const queued = pendingDraftCount(this.state);
    if (queued > 0) {
      this.draftBlurb.textContent = `${this.draftBlurb.textContent} · ${queued} more reward${queued > 1 ? "s" : ""} queued`;
    }
  }

  private renderDraft(): void {
    if (!this.state) return;
    if (this.state.pausedForDraft && this.state.curseDraft) {
      this.relicDraft.classList.remove("hidden");
      this.relicSkip.classList.add("hidden");
      this.draftTitle.textContent = "Hex Storm — Choose a Curse";
      this.draftBlurb.textContent = "Send one soft-lock to the enemy lane.";
      const key = `C:${this.state.curseDraft.join(",")}`;
      if (key === this.lastDraftKey) return;
      this.lastDraftKey = key;
      this.relicChoices.innerHTML = "";
      for (const id of this.state.curseDraft) {
        const def = CURSES[id];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "relic-card level-card";
        btn.innerHTML = `<span class="relic-tag">${def.tag}</span><strong>${def.name}</strong><span>${def.blurb}</span>`;
        btn.addEventListener("click", () => {
          if (!this.state) return;
          if (this.mpMatch) this.mpUiIntent.chooseCurse = id;
          else chooseCurse(this.state, id);
          this.lastDraftKey = "";
          if (!this.mpMatch && !this.state.pausedForDraft) this.relicDraft.classList.add("hidden");
          this.canvas.focus({ preventScroll: true });
        });
        this.relicChoices.appendChild(btn);
      }
      return;
    }
    if (this.state.pausedForDraft && this.state.chestDraft) {
      this.relicDraft.classList.remove("hidden");
      this.relicSkip.classList.add("hidden");
      this.draftTitle.textContent = "Chest Reward";
      this.draftBlurb.textContent = "Pick one of two rewards.";
      const key = `H:${this.state.chestDraft.map((o) => o.label).join("|")}`;
      if (key === this.lastDraftKey) return;
      this.lastDraftKey = key;
      this.relicChoices.innerHTML = "";
      this.state.chestDraft.forEach((opt, index) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "relic-card level-card";
        btn.innerHTML = `<span class="relic-tag">Chest</span><strong>${opt.label}</strong><span>${opt.blurb}</span>`;
        btn.addEventListener("click", () => {
          if (!this.state) return;
          if (this.mpMatch) this.mpUiIntent.chooseChest = index;
          else chooseChestReward(this.state, index);
          this.lastDraftKey = "";
          if (!this.mpMatch && !this.state.pausedForDraft) this.relicDraft.classList.add("hidden");
          this.canvas.focus({ preventScroll: true });
        });
        this.relicChoices.appendChild(btn);
      });
      return;
    }
    if (this.state.pausedForDraft && this.state.utilityDraft) {
      this.relicDraft.classList.remove("hidden");
      this.relicSkip.classList.add("hidden");
      this.draftTitle.textContent =
        this.state.utilityDraftLevel < 0
          ? "Utility Ability (Run Start)"
          : `Utility Ability (Lv ${this.state.utilityDraftLevel})`;
      this.draftBlurb.textContent = "Choose one global utility for the Spacebar slot.";
      const key = `U:${this.state.utilityDraft.join(",")}`;
      if (key === this.lastDraftKey) return;
      this.lastDraftKey = key;
      this.relicChoices.innerHTML = "";
      for (const id of this.state.utilityDraft) {
        const def = UTILITIES[id];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "relic-card level-card";
        btn.innerHTML = `<span class="relic-tag">${def.tag}</span><strong>${def.name}</strong><span>${def.blurb}<br/>${def.hint}</span>`;
        btn.addEventListener("click", () => {
          if (!this.state) return;
          if (this.mpMatch) this.mpUiIntent.chooseUtility = id;
          else chooseUtility(this.state, id);
          this.lastDraftKey = "";
          if (!this.mpMatch && !this.state.pausedForDraft) this.relicDraft.classList.add("hidden");
        });
        this.relicChoices.appendChild(btn);
      }
      return;
    }
    if (this.state.pausedForDraft && this.state.baseBranchDraft) {
      this.relicDraft.classList.remove("hidden");
      this.relicSkip.classList.add("hidden");
      this.draftTitle.textContent = `Base Branch (Lv ${this.state.baseLevel})`;
      this.draftBlurb.textContent = "Choose one upgrade path to reinforce your build.";
      const key = `B:${this.state.baseBranchDraft.join(",")}`;
      if (key === this.lastDraftKey) return;
      this.lastDraftKey = key;
      this.relicChoices.innerHTML = "";
      for (const id of this.state.baseBranchDraft) {
        const def = BASE_BRANCHES[id];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "relic-card level-card";
        btn.innerHTML = `<span class="relic-tag">${def.tag}</span><strong>${def.name}</strong><span>${def.blurb}</span>`;
        btn.addEventListener("click", () => {
          if (!this.state) return;
          if (this.mpMatch) this.mpUiIntent.chooseBaseBranch = id;
          else chooseBaseBranch(this.state, id);
          this.lastDraftKey = "";
          if (!this.mpMatch && !this.state.pausedForDraft) this.relicDraft.classList.add("hidden");
        });
        this.relicChoices.appendChild(btn);
      }
      return;
    }
    if (this.state.pausedForDraft && this.state.levelDraft) {
      this.relicDraft.classList.remove("hidden");
      this.relicSkip.classList.add("hidden");
      this.draftTitle.textContent = `Level Up! (Lv ${this.state.level}) · Rerolls ${this.state.rerollTokens}`;
      this.draftBlurb.textContent = "Choose one passive upgrade.";
      const key = `L:${this.state.levelDraft.join(",")}:r${this.state.rerollTokens}`;
      if (key === this.lastDraftKey) return;
      this.lastDraftKey = key;
      this.relicChoices.innerHTML = "";
      for (const id of this.state.levelDraft) {
        const def = LEVEL_PASSIVES[id];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "relic-card level-card";
        const heroTag = def.heroId
          ? ` · ${HEROES[def.heroId]?.name ?? def.heroId}`
          : "";
        btn.innerHTML = `<span class="relic-tag" style="color:${RARITY_COLOR[def.rarity]}">${RARITY_LABEL[def.rarity]} · ${def.tag}${heroTag}</span><strong>${def.name}</strong><span>${def.blurb}</span>`;
        btn.addEventListener("click", () => {
          if (!this.state) return;
          if (this.mpMatch) this.mpUiIntent.chooseLevel = id;
          else chooseLevelUp(this.state, id);
          this.lastDraftKey = "";
          if (!this.mpMatch && !this.state.pausedForDraft) this.relicDraft.classList.add("hidden");
        });
        this.relicChoices.appendChild(btn);
      }
      const reroll = document.createElement("button");
      reroll.type = "button";
      reroll.className = "menu-btn ghost wide";
      reroll.textContent =
        this.state.rerollTokens > 0
          ? `Reroll (−1 token, ${this.state.rerollTokens} left)`
          : "No reroll tokens";
      reroll.disabled = this.state.rerollTokens <= 0;
      reroll.addEventListener("click", () => {
        if (!this.state) return;
        if (this.mpMatch) {
          this.mpUiIntent.rerollLevel = true;
          this.lastDraftKey = "";
        } else if (rerollLevelDraft(this.state)) {
          this.lastDraftKey = "";
        }
      });
      this.relicChoices.appendChild(reroll);
    } else if (this.state.pausedForDraft && this.state.relicDraft) {
      this.relicDraft.classList.remove("hidden");
      this.relicSkip.classList.remove("hidden");
      this.draftTitle.textContent = `Choose a Relic · Rerolls ${this.state.rerollTokens}`;
      this.draftBlurb.textContent = "Pick one build-defining power — or skip if none fit.";
      const key = `R:${this.state.relicDraft.join(",")}:r${this.state.rerollTokens}`;
      if (key === this.lastDraftKey) return;
      this.lastDraftKey = key;
      this.relicChoices.innerHTML = "";
      for (const id of this.state.relicDraft) {
        const def = RELICS[id];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "relic-card";
        btn.innerHTML = `${relicArtImg(id, "relic-art relic-card-art")}<span class="relic-tag" style="color:${RARITY_COLOR[def.rarity]}">${RARITY_LABEL[def.rarity]} · ${def.tag}</span><strong>${def.name}</strong><span>${def.blurb}</span>`;
        btn.addEventListener("click", () => {
          if (!this.state) return;
          if (this.mpMatch) this.mpUiIntent.chooseRelic = id;
          else chooseRelic(this.state, id);
          this.lastDraftKey = "";
          if (!this.mpMatch && !this.state.pausedForDraft) this.relicDraft.classList.add("hidden");
        });
        this.relicChoices.appendChild(btn);
      }
      const reroll = document.createElement("button");
      reroll.type = "button";
      reroll.className = "menu-btn ghost wide";
      reroll.textContent =
        this.state.rerollTokens > 0
          ? `Reroll (−1 token, ${this.state.rerollTokens} left)`
          : "No reroll tokens";
      reroll.disabled = this.state.rerollTokens <= 0;
      reroll.addEventListener("click", () => {
        if (!this.state) return;
        if (this.mpMatch) {
          this.mpUiIntent.rerollRelic = true;
          this.lastDraftKey = "";
        } else if (rerollRelicDraft(this.state)) {
          this.lastDraftKey = "";
        }
      });
      this.relicChoices.appendChild(reroll);
    } else {
      this.lastDraftKey = "";
      this.relicDraft.classList.add("hidden");
    }
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    if (this.state) this.layoutLaneChrome();
  }

  private frame(now: number): void {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    if (this.mpMatch) {
      this.frameMultiplayer(dt);
    } else if (this.state) {
      // Don't sim while pause settings menu is open either
      const menusOpen = this.menus.isVisible() && this.state.paused;
      this.input.pollGamepad();
      this.syncAimFromMouse();
      // Gamepad right-stick aim overlay
      const aim = this.input.gamepadAim();
      if (this.input.isUsingGamepad() && (aim.x !== 0 || aim.y !== 0)) {
        this.state.aimWorldX = this.state.hero.x + aim.x * 220;
        this.state.aimWorldY = this.state.hero.y + aim.y * 220;
      }
      // Utility actions outside update()
      if (!menusOpen && !this.state.pausedForDraft) {
        if (this.input.consumeAction("pause")) this.togglePause();
        if (this.input.consumeAction("inventory")) this.toggleInventory();
        if (this.input.consumeAction("laneFlip") && !this.state.endless) {
          this.state.viewOpponentLane = !this.state.viewOpponentLane;
        }
        const cheats = gameplayCheats(this.state);
        if (cheats?.godMode && this.state.hero.alive) {
          this.state.hero.hp = this.state.hero.maxHp;
        }
        if (cheats?.skipWaves && this.input.consumePress("KeyN")) {
          this.state.enemies = [];
          this.state.spawning = false;
          this.state.waveTimer = 0.1;
        }
        if (cheats?.forceChest && this.input.consumePress("KeyC")) {
          this.state.chestSpawnCd = 0;
        }
        if (cheats?.infiniteRerolls) {
          this.state.rerollTokens = Math.max(this.state.rerollTokens, 9);
        }
      }
      if (!menusOpen) update(this.state, this.input, dt);
      else this.input.endFrame();

      const view = computeView(this.canvas);
      draw(this.ctx, this.state, view);
      this.layoutLaneChrome();
      this.syncHud();
      this.syncShopPanel();
      this.refreshSendBar();
      this.syncDraft();
      if (this.state.status !== "playing") this.showEndOverlay();
    } else {
      this.input.endFrame();
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = "#0b1020";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.statsEl.innerHTML = "";
      this.abilityEl.innerHTML = "";
      this.toastEl.textContent = "";
      this.bannerEl.textContent = "";
      this.respawnEl.textContent = "";
      this.goldAmountEl.textContent = "0";
      this.incomeEl.textContent = "";
    }

    requestAnimationFrame((t) => this.frame(t));
  }

  private openMultiplayer(draft: LobbyDraft, heroId: HeroId): void {
    unlockAudio();
    this.hideCombatChrome();
    this.menus.hide({ keepMusic: true });
    const menusRoot = document.querySelector<HTMLElement>("#menus")!;
    this.mpUi = new MultiplayerUi(menusRoot, {
      onBack: () => {
        this.mpUi?.destroy();
        this.mpUi = null;
        this.showMainMenu();
      },
      onMatchStart: (start, mySlot, isHost) => this.beginMultiplayerMatch(start, mySlot, isHost),
    });
    this.mpUi.show({
      mode: draft.mode,
      privacy: draft.privacy,
      role: draft.role,
      mapChoice: draft.mapChoice,
      maxTurrets: draft.maxTurrets,
      startingGold: draft.startingGold,
      wavesToWin: draft.wavesToWin,
      friendlyFire: draft.friendlyFire,
      utilityDraftLevel: draft.utilityDraftLevel,
      ascension: draft.ascension,
      livesPerWave: draft.livesPerWave,
      livesPerRun: draft.livesPerRun,
      chestOpenMul: draft.chestOpenMul,
      chestDespawnSec: draft.chestDespawnSec,
      chestSpawnChance: draft.chestSpawnChance,
      enemyDensityMul: draft.enemyDensityMul,
      enemyHpMul: draft.enemyHpMul,
      enemySpeedMul: draft.enemySpeedMul,
      incomeMul: draft.incomeMul,
      respawnMul: draft.respawnMul,
      startingBaseLevel: draft.startingBaseLevel,
      levelDraftSize: draft.levelDraftSize,
      relicDraftSize: draft.relicDraftSize,
      disableArtifacts: draft.disableArtifacts,
      disableChests: draft.disableChests,
      disableElites: draft.disableElites,
      disableBosses: draft.disableBosses,
      disableShop: draft.disableShop,
      disableSends: draft.disableSends,
      disableRelics: draft.disableRelics,
      fogAlways: draft.fogAlways,
      fogThicknessPct: draft.fogThicknessPct,
      fogVisionRadius: draft.fogVisionRadius,
      doubleElites: draft.doubleElites,
      suddenDeathBaseHp: draft.suddenDeathBaseHp,
      glassCannon: draft.glassCannon,
      goldRush: draft.goldRush,
      wildChests: draft.wildChests,
      crampedLane: draft.crampedLane,
      heroId,
      preferredCode: draft.hostCode,
      joinCode: draft.joinCode,
    });
  }

  /** Hide all in-match chrome so lobby/menu never looks half-combat. */
  private hideCombatChrome(): void {
    this.hud.classList.add("hidden");
    this.laneChrome.classList.add("hidden");
    this.baseHpRail.classList.add("hidden");
    this.opponentPanel.classList.add("hidden");
    this.waveBannerEl.classList.add("hidden");
    this.shopPanel.classList.add("hidden");
    this.relicDraft.classList.add("hidden");
    this.invPanel.classList.add("hidden");
    this.overlay.classList.add("hidden");
  }

  private beginMultiplayerMatch(
    startMsg: Extract<NetMsg, { k: "start" }>,
    mySlot: number,
    isHost: boolean,
  ): void {
    // Keep PeerJS alive — only clear lobby chrome (destroy() defaults to disconnectNet).
    stopMenuMusic();
    this.mpUi?.destroy({ disconnect: false });
    this.mpUi = null;
    bindHooks(null);
    this.menus.hide();
    this.mpHost = isHost;
    this.remoteIntents.clear();
    this.mpUiIntent = emptyIntent();
    this.mpDisconnectHandled = false;
    this.state = null;
    let start = startMsg;
    const rejectCustoms = loadSettings().rejectPeerCustoms;
    const usesCustoms =
      (start.customMaps?.length ?? 0) > 0 ||
      (start.customHeroes?.length ?? 0) > 0 ||
      String(start.mapId).startsWith("cm_") ||
      start.lobby.slots.some((s) => String(s.heroId).startsWith("ch_"));
    if (rejectCustoms && usesCustoms) {
      this.overlay.classList.remove("hidden");
      this.overlayTitle.textContent = "Custom content blocked";
      this.overlayBody.textContent =
        "This lobby uses custom maps or heroes, but Settings → Reject peer custom content is on. Turn the setting off to play, or ask the host to use stock content.";
      this.overlayActions.innerHTML = `<button type="button" class="menu-btn primary" id="mp-custom-block">Back to Menu</button>`;
      document.querySelector("#mp-custom-block")!.addEventListener("click", () => {
        disconnectNet();
        this.showMainMenu();
      });
      return;
    }
    registerSessionCustoms({ maps: start.customMaps, heroes: start.customHeroes });
    this.mpMatch = buildMpMatch(start.lobby, start.mapId, start.maxTurrets, start.seed, mySlot, {
      startingGold: start.startingGold ?? start.lobby.startingGold,
      wavesToWin: start.wavesToWin ?? start.lobby.wavesToWin,
      friendlyFire: start.friendlyFire ?? start.lobby.friendlyFire,
      utilityDraftLevel:
        start.utilityDraftLevel ?? start.lobby.utilityDraftLevel ?? 10,
    });
    for (const lane of this.mpMatch.lanes) {
      if (lane.playerBags) {
        for (const key of Object.keys(lane.playerBags)) {
          withPlayerBag(lane, Number(key), () => openRunStartUtilityDraft(lane));
        }
      } else {
        openRunStartUtilityDraft(lane);
      }
    }

    // Attach trained AI to PvE enemy lane when a school is selected
    if (this.mpMatch.lanes[1].aiControlled) {
      const opp = resolveSelectedOpponent();
      if (opp.kind === "neural") {
        this.mpMatch.laneAi[1] = createNeuralLaneAi(opp.genome, opp.hesitation, opp.label);
        this.mpMatch.opponentLabel = opp.label;
      }
    }
    this.pauseMode = "none";
    this.hud.classList.remove("hidden");
    this.laneChrome.classList.remove("hidden");
    this.baseHpRail.classList.remove("hidden");
    this.opponentPanel.classList.remove("hidden");
    this.waveBannerEl.classList.remove("hidden");
    this.overlay.classList.add("hidden");
    this.refreshHint();

    // Focus local hero for HUD
    const local = heroForSlot(this.mpMatch.lanes[this.mpMatch.myTeam], mySlot);
    if (local && local !== this.mpMatch.lanes[this.mpMatch.myTeam].hero) {
      // Swap so HUD/draw focus the controlled hero
      const lane = this.mpMatch.lanes[this.mpMatch.myTeam];
      const idx = lane.allies.indexOf(local);
      if (idx >= 0) {
        lane.allies[idx] = lane.hero;
        lane.hero = local;
      }
    }
    this.state = this.mpMatch.lanes[this.mpMatch.viewTeam];
    focusBag(this.mpMatch.lanes[this.mpMatch.myTeam], mySlot);

    bindMatchHandlers({
      onState: (msg) => {
        if (this.mpHost || !this.mpMatch) return;
        applyMatchSnap(this.mpMatch, msg.snap);
        focusBag(this.mpMatch.lanes[this.mpMatch.myTeam], this.mpMatch.mySlot);
        this.state = this.mpMatch.lanes[this.mpMatch.viewTeam];
        if (this.mpMatch.viewTeam === this.mpMatch.myTeam) {
          focusBag(this.state, this.mpMatch.mySlot);
        }
      },
      onIntent: (seat, intent) => {
        if (!this.mpHost) return;
        this.remoteIntents.set(seat, intent);
      },
      onView: (seat, team) => {
        if (!this.mpHost) return;
        this.remoteViews.set(seat, team);
      },
      onPeerLost: (who) => {
        this.handleMpDisconnect(who);
      },
    });
  }

  /**
   * Host → peers. Each seat gets a FULL lane snapshot for its own lane and for
   * whatever lane it is currently watching; the other lane ships as a cheap HUD
   * summary. Lane payloads are built at most once per frame and shared.
   */
  private broadcastSnapshots(): void {
    const match = this.mpMatch;
    if (!match) return;
    const cache = newSnapCache();
    for (const slot of netPeerSlots()) {
      const seat = laneForSlot(match, slot);
      const ownTeam = seat?.team ?? 0;
      const viewTeam = this.remoteViews.get(slot) ?? ownTeam;
      const full: [boolean, boolean] = [
        ownTeam === 0 || viewTeam === 0,
        ownTeam === 1 || viewTeam === 1,
      ];
      netSendToSlot(slot, {
        k: "state",
        snap: buildMatchSnapFor(match, viewTeam, full, cache),
        seq: this.snapSeq,
      });
    }
  }

  /** Client → host: tell the host which lane we are watching. */
  private reportViewTeam(): void {
    const match = this.mpMatch;
    if (!match || this.mpHost || match.soloOffline) return;
    if (this.lastReportedView === match.viewTeam) return;
    this.lastReportedView = match.viewTeam;
    netSendToHost({ k: "view", t: match.viewTeam });
  }

  private frameMultiplayer(dt: number): void {
    if (!this.mpMatch) return;
    const view = computeView(this.canvas);

    const controlled =
      heroForSlot(this.mpMatch.lanes[this.mpMatch.myTeam], this.mpMatch.mySlot) ??
      this.mpMatch.lanes[this.mpMatch.myTeam].hero;

    // Aim in world space
    const rect = this.canvas.getBoundingClientRect();
    const dpr = this.canvas.width / Math.max(1, rect.width);
    const sx = (this.input.mouseClientX - rect.left) * dpr;
    const sy = (this.input.mouseClientY - rect.top) * dpr;
    const aim = {
      x: (sx - view.offsetX) / view.scale,
      y: (sy - view.offsetY) / view.scale,
    };

    // Tell the host which lane we watch so it can send full data for it.
    this.reportViewTeam();

    // Escape / pause + bag work in MP too — they just never freeze the sim
    // when more than one human is playing (see `canPauseNow`).
    if (!this.menus.isVisible()) {
      if (this.input.consumeAction("pause")) this.togglePause();
      if (this.input.consumeAction("inventory")) this.toggleInventory();
    }

    const local = gatherLocalIntent(this.input, aim, controlled);
    // Merge queued draft / UI choices (clients must send these — never mutate host sim locally)
    local.chooseRelic = this.mpUiIntent.chooseRelic ?? local.chooseRelic;
    local.skipRelic = this.mpUiIntent.skipRelic || local.skipRelic;
    local.chooseLevel = this.mpUiIntent.chooseLevel ?? local.chooseLevel;
    local.chooseUtility = this.mpUiIntent.chooseUtility ?? local.chooseUtility;
    local.chooseCurse = this.mpUiIntent.chooseCurse ?? local.chooseCurse;
    local.chooseChest = this.mpUiIntent.chooseChest ?? local.chooseChest;
    local.chooseBaseBranch = this.mpUiIntent.chooseBaseBranch ?? local.chooseBaseBranch;
    local.rerollLevel = this.mpUiIntent.rerollLevel || local.rerollLevel;
    local.rerollRelic = this.mpUiIntent.rerollRelic || local.rerollRelic;
    this.mpUiIntent = emptyIntent();

    // Auto-open shop once on pad enter (client setting; edge-triggered).
    const myLane = this.mpMatch.lanes[this.mpMatch.myTeam];
    focusBag(myLane, this.mpMatch.mySlot);
    if (controlled && loadSettings().autoOpenShop && !myLane.disableShop && myLane.curseShopBlock <= 0) {
      const near = nearAnyShop(myLane.map, controlled, controlled.alive);
      if (near && !this.wasNearShopAuto && !myLane.shopOpen) {
        local.toggleShop = true;
      }
      this.wasNearShopAuto = near;
    } else {
      this.wasNearShopAuto = false;
    }
    // Shop slots when LOCAL player's shop is open: digits 4-6 (not viewed opponent lane)
    if (myLane.shopOpen && local.sendDigit != null && local.sendDigit >= 4) {
      local.shopSlot = local.sendDigit - 4;
      local.sendDigit = null;
    }

    const paused = this.canPauseNow() && !!this.mpMatch.lanes[this.mpMatch.myTeam].paused;
    if (!paused) {
      if (this.mpHost) {
        const intents = new Map<number, CombatIntent>();
        intents.set(this.mpMatch.mySlot, local);
        for (const [seat, intent] of this.remoteIntents) {
          if (seat !== this.mpMatch.mySlot) intents.set(seat, intent);
        }
        stepMpMatch(this.mpMatch, intents, dt);
        this.snapSeq++;
        if (!this.mpMatch.soloOffline) this.broadcastSnapshots();
      } else {
        this.intentSeq++;
        netSendToHost({
          k: "intent",
          seat: this.mpMatch.mySlot,
          intent: local,
          seq: this.intentSeq,
        });
      }
    }
    this.input.endFrame();

    this.state = this.mpMatch.lanes[this.mpMatch.viewTeam];
    // Ensure draw focuses controlled hero on my team view + local economy bag
    if (this.mpMatch.viewTeam === this.mpMatch.myTeam && controlled) {
      const L = this.state;
      focusBag(L, this.mpMatch.mySlot);
      if (L.hero !== controlled && L.allies.includes(controlled)) {
        const idx = L.allies.indexOf(controlled);
        L.allies[idx] = L.hero;
        L.hero = controlled;
      }
    }

    draw(this.ctx, this.state, view);
    this.layoutLaneChrome();
    this.syncHudMp();
    this.syncShopPanel();
    this.refreshSendBar();
    this.syncDraft();

    if (this.mpMatch.ended) this.showMpEndOverlay();
  }

  private handleMpDisconnect(who: string): void {
    if (!this.mpMatch || this.mpDisconnectHandled) return;
    this.mpDisconnectHandled = true;
    const hostGone = who === "Host";
    this.overlay.classList.remove("hidden");
    this.overlayTitle.textContent = hostGone ? "Host disconnected" : "Player left";
    this.overlayBody.textContent = hostGone
      ? "The host left the match. Multiplayer session ended — PeerJS reconnect is not supported mid-match."
      : `${who} disconnected. The match cannot continue fairly without them — ending the session.`;
    this.overlayActions.innerHTML = `<button type="button" class="menu-btn primary" id="mp-dc-done">Back to Menu</button>`;
    document.querySelector("#mp-dc-done")!.addEventListener("click", () => {
      this.endMultiplayer();
      this.showMainMenu();
    });
    this.mpMatch = null;
    this.state = null;
    bindMatchHandlers(null);
  }

  private syncHudMp(): void {
    if (!this.mpMatch || !this.state) return;
    this.syncHud();
    const other = this.mpMatch.lanes[(1 - this.mpMatch.myTeam) as 0 | 1];
    this.oppNameEl.textContent = this.mpMatch.opponentLabel
      ? this.mpMatch.opponentLabel
      : other.aiControlled
        ? `AI · ${resolveHero(other.hero.heroId).name}`
        : `Enemy · ${resolveHero(other.hero.heroId).name}`;
    const sendIn =
      other.summaryIncoming ?? other.pendingSends.reduce((n, p) => n + p.enemies, 0);
    const myLane = this.mpMatch.lanes[this.mpMatch.myTeam];
    const myLeft = laneEnemiesRemaining(myLane);
    const theirLeft = laneEnemiesRemaining(other);
    this.laneEnemyCountsEl.innerHTML =
      `<span class="yours">Your lane ${myLeft}</span>` +
      `<span class="sep">·</span>` +
      `<span class="theirs">Enemy lane ${theirLeft}</span>`;
    this.oppStatsEl.innerHTML = [
      `<div>HP ${Math.ceil(other.hero.hp)}/${Math.ceil(other.hero.maxHp)} · Lv ${other.level}</div>`,
      `<div>Base ${Math.ceil(other.baseHp)} · Wave ${other.wave}</div>`,
      `<div>Gold ${Math.floor(other.gold)} · +${other.incomePerSec.toFixed(1)}/s</div>`,
      `<div>Enemies left: ${theirLeft}</div>`,
      `<div>${other.status === "playing" ? (other.spawning || theirLeft > 0 ? "Fighting" : "Between waves") : other.status}</div>`,
      sendIn > 0 ? `<div class="opp-alert">Incoming sends: ${sendIn}</div>` : "",
    ]
      .filter(Boolean)
      .join("");
  }

  private showMpEndOverlay(): void {
    if (!this.mpMatch) return;
    const win = this.mpMatch.winnerTeam === this.mpMatch.myTeam;
    const myLane = this.mpMatch.lanes[this.mpMatch.myTeam];
    let crestLine = "";
    if (this.mpMatch.soloOffline) {
      const payout = applyRunPayout({
        won: win,
        wave: myLane.wave,
        sends: myLane.sendsThisRun,
        ascension: myLane.ascension,
        deaths: myLane.deathCount,
        unlimited: myLane.wavesToWin <= 0,
        crestGainMul: myLane.modifiers.crestGainMul,
        careerDelta: careerDeltaFromState(myLane, win),
      });
      crestLine = ` +${payout.crests} War Crests (${payout.store.crests} total)${
        payout.unlockedAscension != null ? ` · Unlocked ${ascensionLabel(payout.unlockedAscension)}` : ""
      }`;
    }
    this.overlay.classList.remove("hidden");
    this.overlayTitle.textContent = win ? "Victory" : "Defeat";
    this.overlayBody.textContent = win
      ? `Your side broke the enemy base / outlasted them.${crestLine}`
      : `Your base fell — or the enemy cleared the win wave first.${crestLine}`;
    this.overlayActions.innerHTML = `<button type="button" class="menu-btn primary" id="mp-done">Back to Menu</button>`;
    document.querySelector("#mp-done")!.addEventListener("click", () => {
      this.endMultiplayer();
      this.showMainMenu();
    });
    this.mpMatch = null;
    this.state = null;
    bindMatchHandlers(null);
  }

  private endMultiplayer(): void {
    this.mpMatch = null;
    this.state = null;
    bindMatchHandlers(null);
    disconnectNet();
    this.mpUi?.destroy();
    this.mpUi = null;
    this.hud.classList.add("hidden");
    this.laneChrome.classList.add("hidden");
    this.baseHpRail.classList.add("hidden");
    this.opponentPanel.classList.add("hidden");
    this.waveBannerEl.classList.add("hidden");
    this.overlay.classList.add("hidden");
  }

  private syncShopPanel(): void {
    if (!this.state) return;
    if (this.state.shopOpen) {
      this.shopPanel.classList.remove("hidden");
      this.refreshShopDom();
    } else {
      const hadFocus = this.shopPanel.contains(document.activeElement);
      this.shopPanel.classList.add("hidden");
      // Keep WASD/keybinds working after shop UI clicks or auto-close while focused in panel.
      if (hadFocus) this.canvas.focus({ preventScroll: true });
    }
  }

  private syncHud(): void {
    const s = this.state;
    if (!s) return;
    const hero = resolveHero(s.hero.heroId);
    const kb = loadSettings().keybinds;
    const tier = waveTierLabel(s.waveTier);
    const incoming = s.opponent.incomingFromPlayer;
    const aiSend = s.pendingSends.reduce((n, p) => n + p.enemies, 0);

    this.goldAmountEl.textContent = `${Math.floor(s.gold)}`;
    this.incomeEl.textContent =
      s.rerollTokens > 0
        ? `+${s.incomePerSec.toFixed(1)}/s · ⟳${s.rerollTokens}`
        : `+${s.incomePerSec.toFixed(1)}/s`;

    this.mapNameEl.textContent = s.map.name;

    // Wave banner above send menu
    if (s.wave === 0) {
      this.waveNumberEl.textContent = "Get ready…";
    } else if (s.pausedForDraft) {
      this.waveNumberEl.textContent = s.levelDraft
        ? `Level up`
        : `Wave ${s.wave} cleared`;
    } else if (s.paused) {
      this.waveNumberEl.textContent = "Paused";
    } else if (!s.spawning && s.enemies.length === 0) {
      const waitingOpp =
        this.mpMatch &&
        s.wavesToWin <= 0 &&
        s.waveTimer <= 0 &&
        (() => {
          const other = this.mpMatch!.lanes[(1 - this.mpMatch!.viewTeam) as 0 | 1];
          return other.spawning || other.enemies.length > 0 || other.pausedForDraft;
        })();
      this.waveNumberEl.textContent = waitingOpp
        ? `Wave ${s.wave} · waiting on enemy lane…`
        : `Wave ${s.wave} · next ${Math.max(0, s.waveTimer).toFixed(1)}s`;
    } else {
      this.waveNumberEl.textContent = `Wave ${s.wave}`;
    }

    if (tier && (s.spawning || s.enemies.length > 0)) {
      this.waveTierEl.textContent = tier;
      this.waveTierEl.classList.remove("hidden");
      this.waveTierEl.classList.toggle("boss", s.waveTier === "boss");
      this.waveTierEl.classList.toggle("elite", s.waveTier === "elite");
    } else {
      this.waveTierEl.textContent = "";
      this.waveTierEl.classList.add("hidden");
    }

    // Dual-lane enemy counts (classic uses abstract opponent; MP overwrites in syncHudMp)
    if (!this.mpMatch) {
      const myLeft = laneEnemiesRemaining(s);
      if (s.endless) {
        this.laneEnemyCountsEl.innerHTML =
          `<span class="yours">Your lane ${myLeft}</span>` +
          (aiSend > 0 ? `<span class="sep">·</span><span class="theirs">Queued ${aiSend}</span>` : "");
      } else {
        const theirLeft = opponentEnemiesRemaining(s.opponent);
        this.laneEnemyCountsEl.innerHTML =
          `<span class="yours">Your lane ${myLeft}</span>` +
          `<span class="sep">·</span>` +
          `<span class="theirs">Enemy lane ${theirLeft}</span>`;
      }
    }

    // Simplified top-left panel (no map / wave / base·hero HP labels)
    this.statsEl.innerHTML = [
      `<div class="hud-line"><strong>${hero.name}</strong> · Lv ${s.level}${s.ascension > 0 ? ` · A${s.ascension}` : ""}${s.endless ? " · Endless" : ""}${
        s.livesPerRun > 0
          ? ` · Lives ${s.runLivesLeft}`
          : s.livesPerWave > 0
            ? ` · W.lives ${s.waveLivesLeft}`
            : ""
      }</div>`,
      `<div class="hud-line">Base Lv ${s.baseLevel}${
        s.endless
          ? aiSend
            ? ` · Queued ${aiSend}`
            : ""
          : `${incoming ? ` · Sent ${incoming}` : ""}${aiSend ? ` · Incoming ${aiSend}` : ""}`
      }</div>`,
    ].join("");

    // Vertical base HP
    const baseRatio = Math.max(0, Math.min(1, s.baseHp / Math.max(1, s.map.base.maxHp)));
    this.baseHpFill.style.height = `${Math.round(baseRatio * 100)}%`;
    this.baseHpFill.classList.toggle("low", baseRatio <= 0.35);
    this.baseHpRail.title = `Base HP ${Math.ceil(s.baseHp)} / ${s.map.base.maxHp}`;

    // Opponent panel (always visible — no flip required)
    const opp = s.opponent;
    const oppHero = resolveHero(opp.heroId);
    this.oppNameEl.textContent = oppHero?.name ?? opp.name;
    this.oppNameEl.style.color = oppHero?.color ?? opp.color;
    const sendLine =
      opp.sendFlash > 0 && opp.lastSendLabel
        ? `<div class="opp-alert">Sending ${opp.lastSendLabel}!</div>`
        : aiSend > 0
          ? `<div class="opp-alert">Queued ${aiSend} to your next wave</div>`
          : `<div class="opp-muted">No active send</div>`;
    this.oppStatsEl.innerHTML = [
      `<div>${oppHero?.blurb?.split("—")[0]?.trim() ?? "Rival"} · Lv ${opp.level}</div>`,
      `<div>HP ${Math.ceil(opp.heroHp)}/${Math.ceil(opp.heroMaxHp)}</div>`,
      `<div>Base ${Math.ceil(opp.baseHp)}/${opp.baseMaxHp} · BLv ${opp.baseLevel}</div>`,
      `<div>+${opp.incomePerSec.toFixed(1)}/s · ${Math.floor(opp.gold)}g</div>`,
      `<div>Enemies left: ${opponentEnemiesRemaining(opp)}</div>`,
      `<div class="opp-status status-${opp.fightStatus}">${opponentStatusLabel(opp.fightStatus)}</div>`,
      sendLine,
      incoming > 0 ? `<div class="opp-alert">Your sends inbound: ${incoming}</div>` : "",
    ].join("");

    this.laneFlipBtn.textContent = s.viewOpponentLane ? "Your lane" : "View lane";
    this.laneFlipBtn.classList.toggle("active", s.viewOpponentLane);

    this.bannerEl.textContent = "";
    this.bannerEl.className = "";

    if (!s.hero.alive) {
      if (s.livesPerRun > 0 && s.runLivesLeft <= 0) {
        this.respawnEl.textContent = "Out of lives";
      } else if (s.waveRespawnBlocked || !Number.isFinite(s.respawnTimer)) {
        this.respawnEl.textContent = "Respawn next wave";
      } else {
        this.respawnEl.textContent = `Respawning in ${Math.max(0, s.respawnTimer).toFixed(1)}s`;
      }
      this.respawnEl.classList.remove("hidden");
    } else {
      this.respawnEl.textContent = "";
      this.respawnEl.classList.add("hidden");
    }

    const labels = [
      formatBinding(kb.mobility),
      formatBinding(kb.ultimate),
      formatBinding(kb.utility),
    ];
    const utilId = s.utilityId;
    const utilCd = s.utilityCd;
    const gunLabel = s.hero.heroId === "gunner" ? gunnerWeaponLabel(s.hero) : "";
    const momLabel =
      s.hero.heroId === "vector" ? `Mom ${Math.round(s.hero.momentum ?? 0)}` : "";
    const abilityKey = `${s.hero.abilityCds.map((c) => c.toFixed(1)).join(",")}:${utilId ?? "-"}:${utilCd.toFixed(1)}:${s.hero.alive}:${gunLabel}:${momLabel}:${s.hero.gunnerAiming ? 1 : 0}`;
    if (abilityKey !== this.lastAbilityKey) {
      this.lastAbilityKey = abilityKey;
      const heroSlots = hero.abilities
        .map((a, i) => {
          const cd = s.hero.abilityCds[i] ?? 0;
          let ready = cd <= 0 && s.hero.alive;
          let cdText = !s.hero.alive ? "—" : ready ? "ready" : cd.toFixed(1);
          let name = a.name;
          if (s.hero.heroId === "gunner" && a.id === "gunfire") {
            name = gunLabel || a.name;
            ready = (s.hero.gunnerReload ?? 0) <= 0 && s.hero.alive;
            cdText = !s.hero.alive
              ? "—"
              : (s.hero.gunnerReload ?? 0) > 0
                ? `REL ${(s.hero.gunnerReload ?? 0).toFixed(1)}`
                : `${s.hero.gunnerAmmo ?? 0}`;
          }
          if (s.hero.heroId === "vector" && i === 0 && momLabel) {
            cdText = ready ? momLabel : cd.toFixed(1);
          }
          const tip = `<strong>${a.name}</strong><br/>${a.hint}<br/>CD ${a.cooldown}s`;
          return `<div class="ability ${ready ? "ready" : "cooling"}" data-tip="${tip.replace(/"/g, "&quot;")}"><kbd>${labels[i]}</kbd><span>${name}</span><em>${cdText}</em></div>`;
        })
        .join("");
      let utilSlot = "";
      if (utilId) {
        const u = UTILITIES[utilId];
        const ready = utilCd <= 0 && s.hero.alive;
        const cdText = !s.hero.alive ? "—" : ready ? "ready" : utilCd.toFixed(1);
        const tip = `<strong>${u.name}</strong><br/>${u.hint}<br/>CD ${u.cooldown}s`;
        utilSlot = `<div class="ability ${ready ? "ready" : "cooling"}" data-tip="${tip.replace(/"/g, "&quot;")}"><kbd>${labels[2]}</kbd><span>${u.name}</span><em>${cdText}</em></div>`;
      } else {
        const utilWhen =
          s.utilityDraftLevel < 0
            ? "Run Start"
            : s.utilityDraftLevel === 0
              ? "off"
              : `Lv ${s.utilityDraftLevel}`;
        const tip = `<strong>Utility</strong><br/>Empty — draft at ${utilWhen}`;
        utilSlot = `<div class="ability cooling" data-tip="${tip.replace(/"/g, "&quot;")}"><kbd>${labels[2]}</kbd><span>Utility</span><em>${utilWhen}</em></div>`;
      }
      this.abilityEl.innerHTML = heroSlots + utilSlot;
    }

    this.toastEl.textContent =
      s.toastTimer > 0 ? s.toast : s.nearShop && !s.shopOpen ? "F — open shop" : "";
  }
}
