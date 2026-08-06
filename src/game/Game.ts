import { MAP_H, MAP_W, STARTING_GOLD, WIN_WAVES } from "../data/constants";
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
  skipLevelUp,
  skipRelic,
  update,
  type GameState,
  type RunOptions,
} from "./state";
import { UTILITIES } from "../data/utilities";
import { nearAnyShop } from "../data/maps";
import { CURSES } from "../data/curses";
import { buyShopItem, buyShopRerollToken, toggleShopFreeze, shopItemCost, buyShopStockReroll } from "../systems/shop";
import { shopStockRerollCost } from "../data/shopReroll";
import { chooseChestReward } from "../systems/chests";
import { availableSendPacks, buySendPack, sendPackCost } from "../systems/send";
import { tryUpgradeBase, upgradeBaseCost } from "../systems/baseUpgrade";
import { xpProgress, openRunStartUtilityDraft, rerollLevelDraft, rerollRelicDraft } from "../systems/xp";
import { effectiveMaxTurrets, livingTurrets } from "../systems/turrets";
import { Input } from "../systems/input";
import { computeView, draw, type ViewChrome, DEFAULT_VIEW_CHROME, type ViewWorldBand } from "../render/draw";
import { playBounds } from "./playBounds";
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
import { canPauseSimulation } from "./pause";
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
  /** When true, combat exit routes back into Campaign with win/lose/abandon. */
  private campaignMatch = false;
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
  private readonly respawnStack: HTMLElement;
  private readonly respawnEl: HTMLElement;
  private readonly respawnMinigameEl: HTMLElement;
  private readonly respawnMgTrack: HTMLElement;
  private readonly respawnMgZone: HTMLElement;
  private readonly respawnMgCursor: HTMLElement;
  private readonly respawnMgHint: HTMLElement;
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
  private readonly draftReroll: HTMLButtonElement;
  private readonly draftActions: HTMLElement;
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
  private lastTokenShopKey = "";
  private lastSendUnlockKey = "";
  private lastDraftKey = "";
  private lastAbilityKey = "";
  private pauseMode: "none" | "paused" | "confirm" | "settings" | "inventory" = "none";
  /** Edge tracker for auto-open shop in MP / dual-lane. */
  private wasNearShopAuto = false;
  private mpDisconnectHandled = false;
  /** Live HUD chrome (CSS px) fed into computeView — top/bottom reserved for panels. */
  private viewChrome: ViewChrome = { ...DEFAULT_VIEW_CHROME };

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
    this.respawnStack = document.querySelector("#hud-respawn-stack")!;
    this.respawnEl = document.querySelector("#hud-respawn")!;
    this.respawnMinigameEl = document.querySelector("#hud-respawn-minigame")!;
    this.respawnMgTrack = this.respawnMinigameEl.querySelector(".respawn-mg-track")!;
    this.respawnMgZone = this.respawnMinigameEl.querySelector(".respawn-mg-zone")!;
    this.respawnMgCursor = this.respawnMinigameEl.querySelector(".respawn-mg-cursor")!;
    this.respawnMgHint = this.respawnMinigameEl.querySelector(".respawn-mg-hint")!;
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
    this.draftReroll = document.querySelector("#draft-reroll")!;
    this.draftActions = document.querySelector("#draft-actions")!;
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
      onStartSingleplayer: (heroId, opts) => {
        // Only real campaign fights — not SP while a campaign checkpoint exists.
        this.campaignMatch = !!opts?.campaignCombat;
        this.beginRun(heroId, opts);
      },
      onOpenMultiplayer: (draft, heroId) => this.openMultiplayer(draft, heroId),
      onSettingsChanged: () => {
        this.input.reloadBinds();
      },
      onRunOptionsChanged: (opts) => {
        this.runDefaults = { ...this.runDefaults, ...opts };
      },
      onResumePause: () => {
        if (!this.state || this.pauseMode !== "settings") return;
        this.menus.hide();
        this.showPauseMenu();
      },
    });

    this.refreshHint();
    const focusGame = () => {
      this.canvas.focus({ preventScroll: true });
    };
    this.upgradeBaseBtn.addEventListener("click", () => {
      const lane = this.actingLane();
      if (!lane || lane.paused) return;
      tryUpgradeBase(lane);
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
        this.toggleMpLaneView();
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
      const draft = this.draftSourceState();
      if (!draft) return;
      if (draft.levelDraft) {
        if (this.mpMatch) this.mpUiIntent.skipLevel = true;
        else skipLevelUp(draft);
      } else if (draft.relicDraft) {
        if (this.mpMatch) this.mpUiIntent.skipRelic = true;
        else skipRelic(draft);
      }
      this.lastDraftKey = "";
      this.relicDraft.classList.add("hidden");
      focusGame();
    });
    this.draftReroll.addEventListener("click", () => {
      const draft = this.draftSourceState();
      if (!draft) return;
      if (draft.levelDraft) {
        if (this.mpMatch) {
          this.mpUiIntent.rerollLevel = true;
          this.lastDraftKey = "";
        } else if (rerollLevelDraft(draft)) {
          this.lastDraftKey = "";
        }
      } else if (draft.relicDraft) {
        if (this.mpMatch) {
          this.mpUiIntent.rerollRelic = true;
          this.lastDraftKey = "";
        } else if (rerollRelicDraft(draft)) {
          this.lastDraftKey = "";
        }
      }
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
      () => {
        unlockAudio();
        // Title-screen BGM often needs this first gesture after a cold load.
        if (this.menus.isVisible()) this.menus.nudgeMenuMusic();
      },
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
    const hide = () => this.hideTooltip();
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
    // Cursor left the window — mouseout won't fire on a removed HUD node.
    document.addEventListener("mouseleave", hide);
  }

  private hideTooltip(): void {
    this.tooltip.classList.add("hidden");
    this.tooltip.innerHTML = "";
  }

  /**
   * HUD ability slots are re-rendered via innerHTML, so the hovered [data-tip]
   * node can vanish without ever firing mouseout — the classic "stuck tooltip".
   * Each frame, if the tooltip is visible but the cursor is no longer over a
   * [data-tip] element (HUD re-render, pause menu, run end, back to menu),
   * hide it.
   */
  private validateTooltip(): void {
    if (this.tooltip.classList.contains("hidden")) return;
    const x = this.input.mouseClientX;
    const y = this.input.mouseClientY;
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      if (this.tooltip.contains(el)) continue;
      if (el.closest("[data-tip]")) return;
      break;
    }
    this.hideTooltip();
  }

  private positionTooltip(x: number, y: number): void {
    const pad = 14;
    this.tooltip.style.left = `${Math.min(window.innerWidth - 280, x + pad)}px`;
    this.tooltip.style.top = `${Math.min(window.innerHeight - 120, y + pad)}px`;
  }

  private refreshHint(): void {
    this.hintEl.textContent = "";
    this.hintEl.style.display = "none";
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

  private exitCampaignCombat(result: "won" | "lost" | "abandon", baseHp?: number): void {
    if ((result === "won" || result === "lost") && baseHp != null) {
      this.menus.applyCampaignBaseHp(baseHp);
    }
    this.endMultiplayer();
    this.state = null;
    this.campaignMatch = false;
    this.pauseMode = "none";
    this.hideCombatChrome();
    this.input.reloadBinds();
    this.refreshHint();
    this.menus.handleCampaignCombatEnd(result);
  }

  private returnToMainMenu(): void {
    if (this.campaignMatch) {
      this.exitCampaignCombat("abandon");
      return;
    }
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
    const allowMeta = !!opts?.allowBarracks;
    const playerMods = composeRunModifiers(ascension, allowMeta ? meta.ranks : {}, allowMeta);
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
      // No rival lane: drop enemy fillers, keep ally AI + waves-to-win.
      merged.aiEnemies = [];
      merged.friendlyFire = false;
    }

    const opp = resolveSelectedOpponent();
    const teamSize = merged.teamSize ?? 1;
    const allies = merged.aiAllies ?? [];
    const enemies = merged.aiEnemies ?? [];
    const wantsDual =
      allies.length > 0 ||
      (!merged.endless &&
        (enemies.length > 1 ||
          enemies.some((e) => e.ai.kind === "neural") ||
          teamSize > 1 ||
          opp.kind === "neural"));

    // Dual-lane when AI allies (even no-rival), multi-enemy, neural foe, or team-size > 1
    if (wantsDual) {
      this.beginSoloVsAi(
        heroId,
        merged,
        !merged.endless && opp.kind === "neural" ? opp : null,
        teamSize,
      );
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
    const allowMeta = !!opts.allowBarracks;
    const playerMods =
      opts.modifiers ?? composeRunModifiers(opts.ascension, allowMeta ? meta.ranks : {}, allowMeta);
    const enemyMods = composeRunModifiers(opts.ascension, {}, false);
    const agg = playerMods.opponentAggressionMul;
    const noRival = !!opts.endless;
    const neural =
      !noRival && opp
        ? createNeuralLaneAi(opp.genome, Math.max(0, opp.hesitation / agg), opp.label)
        : null;
    const allies = opts.aiAllies;
    const enemies = noRival ? [] : opts.aiEnemies;
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
      allies,
      enemies,
      noRivalLane: noRival,
      endless: noRival,
      allyAiAggression: opts.allyAiAggression,
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
      disableBonuses: opts.disableBonuses,
      disableBaseUpgrades: opts.disableBaseUpgrades,
      contentFilters: opts.contentFilters,
      fogAlways: opts.fogAlways,
      fogThicknessPct: opts.fogThicknessPct,
      fogVisionRadius: opts.fogVisionRadius,
      doubleElites: opts.doubleElites,
      suddenDeathBaseHp: opts.suddenDeathBaseHp,
      glassCannon: opts.glassCannon,
      goldRush: opts.goldRush,
      wildChests: opts.wildChests,
      crampedLane: opts.crampedLane,
      playerBaseInvincible: opts.playerBaseInvincible,
      enemyBaseInvincible: opts.enemyBaseInvincible,
      waveBreakSec: opts.waveBreakSec,
      laneClearSpeedPct: opts.laneClearSpeedPct,
      respawnMinigame: opts.respawnMinigame,
      sendLocation: opts.sendLocation,
      artifactPlacement: opts.artifactPlacement,
      allowBarracks: opts.allowBarracks,
      relicDrop: opts.relicDrop,
      enemyProjectileDmgMul: opts.enemyProjectileDmgMul,
      enemyCollisionDmgMul: opts.enemyCollisionDmgMul,
      playerDmgLmbMul: opts.playerDmgLmbMul,
      playerDmgRmbMul: opts.playerDmgRmbMul,
      playerDmgMmbMul: opts.playerDmgMmbMul,
      wallBounciness: opts.wallBounciness,
      playerSpeedMul: opts.playerSpeedMul,
      playerSizeMul: opts.playerSizeMul,
      enemySizeMul: opts.enemySizeMul,
      critLottery: opts.critLottery,
      enemyMutation: opts.enemyMutation,
      randomizeUtilityWave: opts.randomizeUtilityWave,
      doubleAllProjectiles: opts.doubleAllProjectiles,
      immuneToProjectiles: opts.immuneToProjectiles,
      randomizeHeroWave: opts.randomizeHeroWave,
      randomizeMapWave: opts.randomizeMapWave,
      artifactDamageDoubled: opts.artifactDamageDoubled,
      artifactsFree: opts.artifactsFree,
      itemsFree: opts.itemsFree,
      infiniteRerolls: opts.infiniteRerolls,
      thornsAura: opts.thornsAura,
      bloodTax: opts.bloodTax,
      echoBarrage: opts.echoBarrage,
      pacifistPays: opts.pacifistPays,
      berserkerEdge: opts.berserkerEdge,
      slipNSlide: opts.slipNSlide,
      vampiricCreeps: opts.vampiricCreeps,
      corpseExplosion: opts.corpseExplosion,
      bounceHouse: opts.bounceHouse,
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
    this.opponentPanel.classList.toggle("hidden", noRival);
    this.hud.classList.remove("hidden");
    this.waveBannerEl.classList.remove("hidden");
    this.laneFlipBtn.classList.toggle("hidden", noRival);
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
    const cssH = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    const dprY = this.canvas.height / cssH;
    const dprX = this.canvas.width / Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const topPad = 6;
    const xpPad = 3;
    const xpH = 20;
    // Breathing room: XP above lane, HP below lane (not flush/overlapping).
    const gapToMap = 11;
    const pad = 10;
    const barStack = 34;
    const band = this.viewBand();

    // Iterate so measured panel height → chrome with bar margins → max map scale.
    let view = computeView(this.canvas, this.viewChrome, band);
    for (let pass = 0; pass < 2; pass++) {
      this.applyTopHudLayout(view, dprX, dprY, topPad);

      const hudTop = this.hudPanel.parentElement;
      const hudH = hudTop instanceof HTMLElement ? Math.max(1, hudTop.offsetHeight) : 120;
      // Reserve panels + XP + margin under XP before the playable lane top.
      const measuredTop = topPad + hudH + xpPad + xpH + gapToMap;

      this.viewChrome = {
        topCss: Math.min(240, measuredTop),
        bottomCss: this.viewChrome.bottomCss,
        sideFrac: 0.006,
      };
      view = computeView(this.canvas, this.viewChrome, band);
    }

    this.applyTopHudLayout(view, dprX, dprY, topPad);

    let s = view.scale / dprY;
    let mapLeft = view.offsetX / dprX;
    let laneW = MAP_W * s;

    const hudTop = this.hudPanel.parentElement;
    const hudH2 = hudTop instanceof HTMLElement ? Math.max(1, hudTop.offsetHeight) : 120;
    // XP sits under gold/sends; gapToMap keeps clear air above the blue floor.
    const xpTop = topPad + hudH2 + xpPad;
    this.xpBar.style.width = `${laneW}px`;
    this.xpBar.style.left = `${mapLeft}px`;
    this.xpBar.style.right = "auto";
    this.xpBar.style.top = `${xpTop}px`;

    // Refine top chrome from measured XP so margin under XP is stable.
    const xpBottom = xpTop + Math.max(xpH, this.xpBar.offsetHeight || xpH);
    const tightTop = xpBottom + gapToMap;
    if (Math.abs(tightTop - this.viewChrome.topCss) > 0.5) {
      this.viewChrome = { ...this.viewChrome, topCss: Math.min(240, tightTop) };
      view = computeView(this.canvas, this.viewChrome, band);
      this.applyTopHudLayout(view, dprX, dprY, topPad);
      s = view.scale / dprY;
      mapLeft = view.offsetX / dprX;
      laneW = MAP_W * s;
      this.xpBar.style.width = `${laneW}px`;
      this.xpBar.style.left = `${mapLeft}px`;
    }

    // Playable lane edges in CSS (band-aware view keeps blue floor under XP).
    const map = this.state.map;
    const laneTopCss = (view.offsetY + map.laneTop * view.scale) / dprY;
    const laneBottomCss = (view.offsetY + map.laneBottom * view.scale) / dprY;
    const laneLeft = mapLeft;
    const laneRight = laneLeft + laneW;

    const railH = Math.max(60, laneBottomCss - laneTopCss);
    const railW = 14;
    const railGap = 8;
    this.baseHpRail.style.width = `${railW}px`;
    this.baseHpRail.style.left = `${Math.max(2, laneLeft - railW - railGap)}px`;
    this.baseHpRail.style.top = `${laneTopCss}px`;
    this.baseHpRail.style.height = `${railH}px`;

    this.hpBar.style.width = `${laneW}px`;
    this.hpBar.style.left = `${laneLeft}px`;
    this.hpBar.style.top = `${laneBottomCss + pad}px`;

    const belowHp = laneBottomCss + pad + barStack + 8;
    this.pauseBtn.style.left = `${laneLeft}px`;
    this.pauseBtn.style.top = `${belowHp}px`;

    this.abilityEl.style.left = "auto";
    this.abilityEl.style.right = `${Math.max(0, window.innerWidth - laneRight)}px`;
    this.abilityEl.style.top = `${belowHp}px`;
    this.abilityEl.style.maxWidth = `${Math.min(420, laneW * 0.55)}px`;
    this.abilityEl.style.flexWrap = "nowrap";
    this.abilityEl.style.justifyContent = "flex-end";

    this.invBtn.style.left = `${laneLeft + laneW / 2}px`;
    this.invBtn.style.right = "auto";
    this.invBtn.style.transform = "translateX(-50%)";
    this.invBtn.style.top = `${belowHp}px`;

    // Bottom chrome: HP margin + control row under the playable bottom.
    const controlsEnd = belowHp + 40;
    const needBelowLane = Math.max(0, controlsEnd - laneBottomCss);
    const idealBottom = Math.min(130, Math.max(70, needBelowLane + 6));
    if (Math.abs(idealBottom - this.viewChrome.bottomCss) > 1.5) {
      this.viewChrome = { ...this.viewChrome, bottomCss: idealBottom };
    }
  }

  /** Playable Y band for view fit — gutters outside the blue floor are not scaled in. */
  private viewBand(): ViewWorldBand {
    if (!this.state) return { top: 0, bottom: MAP_H };
    const b = playBounds(this.state.map);
    // Tiny edge so stroke/labels aren't hard-clipped by chrome.
    const edge = 2;
    return {
      top: Math.max(0, b.top - edge),
      bottom: Math.min(MAP_H, b.bottom + edge),
    };
  }

  /** Gold | sends | rival row + wave pill — absolute X alignment to lane band. */
  private applyTopHudLayout(
    view: { scale: number; offsetX: number; offsetY: number },
    dprX: number,
    dprY: number,
    topPad: number,
  ): void {
    const s = view.scale / dprY;
    const laneLeft = view.offsetX / dprX;
    const laneW = MAP_W * s;

    const hudTop = this.hudPanel.parentElement;
    if (hudTop) {
      hudTop.style.left = `${laneLeft}px`;
      hudTop.style.width = `${laneW}px`;
      hudTop.style.right = "auto";
      hudTop.style.top = `${topPad}px`;
      hudTop.style.maxHeight = "";
    }

    for (const el of [this.hudPanel, this.sendBar, this.opponentPanel]) {
      el.style.left = "";
      el.style.right = "";
      el.style.top = "";
      el.style.transform = "";
      el.style.position = "";
      el.style.width = "";
      el.style.minWidth = "";
      el.style.maxWidth = "";
    }
    this.sendBar.classList.toggle("hidden", !!this.state?.disableSends);

    this.waveBannerEl.style.left = `${laneLeft + laneW / 2}px`;
    this.waveBannerEl.style.right = "auto";
    this.waveBannerEl.style.width = "auto";
    this.waveBannerEl.style.maxWidth = "none";
    this.waveBannerEl.style.transform = "translateX(-50%)";
    this.waveBannerEl.style.top = `${topPad}px`;

    this.mapNameEl.textContent = "";
    this.mapNameEl.style.display = "none";
    this.hintEl.textContent = "";
    this.hintEl.style.display = "none";
  }

  private viewForCanvas(): ReturnType<typeof computeView> {
    return computeView(this.canvas, this.viewChrome, this.viewBand());
  }

  private syncAimFromMouse(): void {
    if (!this.state) return;
    const view = this.viewForCanvas();
    const rect = this.canvas.getBoundingClientRect();
    const dprX = this.canvas.width / Math.max(1, rect.width);
    const dprY = this.canvas.height / Math.max(1, rect.height);
    const sx = (this.input.mouseClientX - rect.left) * dprX;
    const sy = (this.input.mouseClientY - rect.top) * dprY;
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
    this.menus.show("settings", { allowMenuMusic: false, resumePause: true });
  }

  private confirmAbandon(): void {
    // Campaign combat: leave via checkpoint without an "abandon run" scare.
    if (this.campaignMatch) {
      this.exitCampaignCombat("abandon");
      return;
    }
    this.pauseMode = "confirm";
    this.overlayTitle.textContent = "Abandon run?";
    this.overlayBody.textContent = "You'll lose this run and return to the main menu.";
    this.overlayActions.innerHTML = "";

    const yes = document.createElement("button");
    yes.type = "button";
    yes.textContent = "Abandon";
    yes.addEventListener("click", () => {
      this.returnToMainMenu();
    });
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
    if (this.campaignMatch) {
      const won = this.state.status === "won";
      const baseHp = Math.max(1, Math.ceil(this.state.baseHp));
      this.exitCampaignCombat(won ? "won" : "lost", baseHp);
      return;
    }
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
    const grid = this.sendItemsEl;
    grid.classList.add("send-bar-grid");
    grid.hidden = false;
    grid.classList.remove("hidden");
    const lane = this.actingLane();
    if (!lane) return;
    const label = document.querySelector(".send-bar-label");
    if (label instanceof HTMLElement) label.hidden = true;

    // Column-major layout (3 rows × 2 cols):
    //   [Base] [3]
    //   [1]    [4]
    //   [2]    [5]
    const up = this.upgradeBaseBtn;
    // Detach chips we keep, then rebuild grid order.
    grid.querySelectorAll(".send-chip:not(#upgrade-base-btn)").forEach((el) => el.remove());
    up.className = "send-chip upgrade-base-chip";
    if (!up.querySelector(".send-meta")) {
      up.innerHTML =
        `<span class="send-key">▲</span>` +
        `<span class="send-meta"><span class="up-label send-name">Upgrade Base</span>` +
        `<span class="up-cost send-cost">—</span></span>`;
    }
    up.style.display = lane.disableBaseUpgrades ? "none" : "";
    if (!up.isConnected) grid.prepend(up);
    else grid.prepend(up);

    const packs = availableSendPacks(lane);
    for (const pack of packs) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "send-chip";
      row.dataset.packId = pack.id;
      const shortName = pack.name.replace(/\s*Pack\s*$/i, "").trim() || pack.name;
      const tip = `<strong>${pack.name}</strong><br/>${pack.detail}<br/>Base ${pack.blurb}<br/><em>Cost scales with base upgrades</em>`;
      row.dataset.tip = tip;
      row.innerHTML =
        `<span class="send-key">${pack.digit}</span>` +
        `<span class="send-meta"><span class="send-name">${shortName}</span>` +
        `<span class="send-cost">${pack.cost}g</span></span>`;
      row.addEventListener("click", () => {
        const act = this.actingLane();
        if (!act || act.paused) return;
        buySendPack(act, pack.id);
        this.refreshSendBar();
      });
      grid.appendChild(row);
    }
  }

  private refreshSendBar(): void {
    const lane = this.actingLane();
    if (!lane) return;
    if (this.mpMatch) focusBag(lane, this.mpMatch.mySlot);
    const packs = availableSendPacks(lane);
    const unlockKey = `${lane.baseLevel}:${packs.map((p) => p.id).join(",")}:${lane.disableBaseUpgrades ? 0 : 1}`;
    if (unlockKey !== this.lastSendUnlockKey) {
      this.lastSendUnlockKey = unlockKey;
      this.buildSendBar();
      // Re-measure HUD height so XP bar sits under the send strip.
      this.layoutLaneChrome();
    }

    const chips = document.querySelectorAll<HTMLButtonElement>("#send-bar .send-chip:not(#upgrade-base-btn)");
    chips.forEach((row) => {
      const packId = row.dataset.packId;
      const pack = packs.find((p) => p.id === packId);
      if (!pack) return;
      const cost = sendPackCost(lane, pack.id);
      const costEl = row.querySelector(".send-cost");
      if (costEl) costEl.textContent = `${cost}g`;
      const nameEl = row.querySelector(".send-name");
      if (nameEl) {
        const shortName = pack.name.replace(/\s*Pack\s*$/i, "").trim() || pack.name;
        nameEl.textContent = shortName;
      }
      const keyEl = row.querySelector(".send-key");
      if (keyEl) keyEl.textContent = String(pack.digit);
      row.disabled = lane.gold < cost || lane.paused;
      const full = SEND_PACKS.find((p) => p.id === pack.id)!;
      row.dataset.tip = `<strong>${full.name}</strong><br/>${full.detail}<br/>Current cost ${cost}g · Base Lv ${lane.baseLevel}`;
    });

    const cost = upgradeBaseCost(lane);
    this.upgradeBaseBtn.disabled = lane.gold < cost || lane.paused || !!lane.disableBaseUpgrades;
    this.upgradeBaseBtn.style.display = lane.disableBaseUpgrades ? "none" : "";
    const upLabel = this.upgradeBaseBtn.querySelector(".up-label");
    const upCostEl = this.upgradeBaseBtn.querySelector(".up-cost");
    if (upLabel && upCostEl) {
      upLabel.textContent = `Base ${lane.baseLevel}→${lane.baseLevel + 1}`;
      upCostEl.textContent = `${cost}g`;
    } else {
      this.upgradeBaseBtn.innerHTML =
        `<span class="send-key">▲</span>` +
        `<span class="send-meta"><span class="up-label send-name">Base ${lane.baseLevel}→${lane.baseLevel + 1}</span>` +
        `<span class="up-cost send-cost">${cost}g</span></span>`;
    }
    this.upgradeBaseBtn.dataset.tip =
      lane.baseLevel >= 4
        ? `Upgrade base · ${cost}g. No max level — each upgrade further strengthens unlocked send packs.`
        : `Upgrade base · ${cost}g. Unlocks packs and strengthens existing send costs, income, and HP.`;

    const xp = xpProgress(lane);
    this.xpLevelEl.textContent = `Lv ${lane.level}`;
    this.xpTextEl.textContent = `${Math.floor(xp.current)} / ${xp.needed}`;
    this.xpFillEl.style.width = `${Math.round(xp.ratio * 100)}%`;

    const hero = lane.hero;
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
    // Stock offer key excludes reroll-token price so stock refresh does not
    // rebuild (visually "reroll") the dedicated token slot.
    const stockKey = `${this.state.shopOffer.join(",")}:${this.state.shopStockRerollBuys}:${this.state.shopStockRerollDiscount}:${JSON.stringify(this.state.shopOwned)}:${this.state.disableArtifacts}`;
    const tokenKey = `${this.state.shopRerollCost}:${this.state.shopRerollBuysWave}`;
    if (stockKey !== this.lastShopKey) {
      this.shopItemsEl.innerHTML = "";
      {
        const cost = shopItemCost(
          this.state,
          shopStockRerollCost(this.state.shopStockRerollBuys, this.state.shopStockRerollDiscount),
        );
        const broke = this.state.gold < cost;
        const stockBtn = document.createElement("button");
        stockBtn.type = "button";
        stockBtn.id = "shop-stock-reroll";
        stockBtn.className = "shop-stock-reroll" + (broke ? " unaffordable" : "");
        stockBtn.disabled = broke || this.state.paused;
        stockBtn.textContent = `Reroll stock · ${cost}g`;
        stockBtn.dataset.tip = `Refresh gear + artifact offers. Reroll Token price is unchanged.`;
        stockBtn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (!this.state || this.state.paused) return;
          buyShopStockReroll(this.state);
          this.lastShopKey = "";
          this.refreshShopDom();
          this.canvas.focus({ preventScroll: true });
        });
        this.shopItemsEl.appendChild(stockBtn);
      }
      let gearRows = 0;
      this.state.shopOffer.forEach((id) => {
        const item = getShopItem(id);
        if (!item) return;
        if (item.category === "artifact" && this.state!.disableArtifacts) return;
        if (item.category === "artifact" || gearRows === 3) {
          if (item.category === "artifact") {
            const div = document.createElement("div");
            div.className = "shop-divider";
            this.shopItemsEl.appendChild(div);
          }
        }
        const owned = this.state!.shopOwned[id] ?? 0;
        const maxed = owned >= item.maxStacks;
        const cost = shopItemCost(this.state!, item.cost, id);
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
        row.innerHTML = `<span class="shop-name">${item.name}</span><span class="shop-meta">${tag}${item.effect}</span><span class="shop-cost">${costLabel}</span>`;
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
        if (item.category !== "artifact") gearRows += 1;
      });
      {
        const div = document.createElement("div");
        div.className = "shop-divider";
        this.shopItemsEl.appendChild(div);
        this.appendRerollTokenRow();
      }
      this.lastShopKey = stockKey;
      this.lastTokenShopKey = tokenKey;
      const closeHint = this.shopPanel.querySelector(".close-hint");
      if (closeHint) closeHint.textContent = "F to close · click items to buy";
    } else {
      for (const row of this.shopItemsEl.querySelectorAll<HTMLButtonElement>("button.shop-row")) {
        if (row.classList.contains("reroll-slot")) {
          const cost = shopItemCost(this.state, this.state.shopRerollCost);
          const broke = this.state.gold < cost;
          row.disabled = broke || this.state.paused;
          row.classList.toggle("unaffordable", broke);
          const costEl = row.querySelector(".shop-cost");
          if (costEl) costEl.textContent = broke ? `LOCKED ${cost}g` : `${cost}g`;
          continue;
        }
      }
      this.state.shopOffer.forEach((id, i) => {
        const item = getShopItem(id);
        if (!item) return;
        const rows = this.shopItemsEl.querySelectorAll<HTMLButtonElement>("button.shop-row:not(.reroll-slot)");
        const row = rows[i];
        if (!row) return;
        const owned = this.state!.shopOwned[id] ?? 0;
        const maxed = owned >= item.maxStacks;
        const cost = shopItemCost(this.state!, item.cost, id);
        const broke = this.state!.gold < cost;
        row.disabled = maxed || broke || this.state!.paused;
        row.classList.toggle("owned-max", maxed);
        row.classList.toggle("unaffordable", broke && !maxed);
        const costEl = row.querySelector(".shop-cost");
        if (costEl) {
          costEl.textContent = maxed ? `×${owned} max` : broke ? `LOCKED ${cost}g` : `${cost}g`;
        }
      });
      const stockBtn = this.shopItemsEl.querySelector<HTMLButtonElement>("#shop-stock-reroll");
      if (stockBtn) {
        const cost = shopItemCost(
          this.state,
          shopStockRerollCost(this.state.shopStockRerollBuys, this.state.shopStockRerollDiscount),
        );
        const broke = this.state.gold < cost;
        stockBtn.disabled = broke || this.state.paused;
        stockBtn.textContent = `Reroll stock · ${cost}g`;
        stockBtn.classList.toggle("unaffordable", broke);
      }
      if (tokenKey !== this.lastTokenShopKey) {
        const existing = this.shopItemsEl.querySelector(".reroll-slot");
        if (existing) existing.remove();
        this.appendRerollTokenRow();
        this.lastTokenShopKey = tokenKey;
      }
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

  private appendRerollTokenRow(): void {
    if (!this.state) return;
    const cost = shopItemCost(this.state, this.state.shopRerollCost);
    const broke = this.state.gold < cost;
    const row = document.createElement("button");
    row.type = "button";
    row.className = "shop-row reroll-slot" + (broke ? " unaffordable" : "");
    row.disabled = broke || this.state.paused;
    const costLabel = broke ? `LOCKED ${cost}g` : `${cost}g`;
    row.innerHTML = `<span class="shop-name">Reroll Token</span><span class="shop-meta">+1 draft reroll · price rises this wave</span><span class="shop-cost">${costLabel}</span>`;
    row.dataset.tip = `<strong style="color:${RARITY_COLOR.uncommon}">Reroll Token</strong> · Uncommon<br/>+1 level or relic draft reroll<br/>Base cost scales with wave; each buy raises price until the next wave.<br/>${cost}g`;
    row.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (!this.state || this.state.paused) return;
      buyShopRerollToken(this.state);
      this.lastTokenShopKey = "";
      this.refreshShopDom();
      this.canvas.focus({ preventScroll: true });
    });
    this.shopItemsEl.appendChild(row);
  }

  /**
   * Draft UI always uses the *local player's* economy bag / lane — never the
   * spectated enemy lane. Watching them must not show a blocking choose UI.
   * Presentation is the full centered choose-N panel (not the compact bottom strip).
   */
  private draftSourceState(): GameState | null {
    if (!this.state) return null;
    if (this.mpMatch) {
      const mine = this.mpMatch.lanes[this.mpMatch.myTeam];
      focusBag(mine, this.mpMatch.mySlot);
      return mine;
    }
    // SP never draws opponent drafts into this overlay.
    if (this.state.viewOpponentLane) return null;
    return this.state;
  }

  private localHasPendingDraft(s: GameState): boolean {
    return !!(
      s.pausedForDraft &&
      (s.relicDraft ||
        s.levelDraft ||
        s.utilityDraft ||
        s.curseDraft ||
        s.chestDraft ||
        s.baseBranchDraft)
    );
  }

  private syncDraft(): void {
    if (!this.state) return;
    // Always full-size choose UI (user-facing restore after compact multi-human style).
    this.relicDraft.classList.remove("compact-draft");
    const src = this.draftSourceState();
    if (!src || !this.localHasPendingDraft(src)) {
      this.lastDraftKey = "";
      this.relicDraft.classList.add("hidden");
      this.draftActions.classList.add("hidden");
      return;
    }
    this.renderDraft(src);
    if (this.relicDraft.classList.contains("hidden")) return;
    const queued = pendingDraftCount(src);
    if (queued > 0) {
      this.draftBlurb.textContent = `${this.draftBlurb.textContent} · ${queued} more reward${queued > 1 ? "s" : ""} queued`;
    }
  }

  private renderDraft(src?: GameState): void {
    const state = src ?? this.draftSourceState();
    if (!state || !this.localHasPendingDraft(state)) {
      this.lastDraftKey = "";
      this.relicDraft.classList.add("hidden");
      this.draftActions.classList.add("hidden");
      return;
    }
    if (state.curseDraft) {
      this.relicDraft.classList.remove("hidden");
      this.draftActions.classList.add("hidden");
      this.draftTitle.textContent = "Hex Storm — Choose a Curse";
      this.draftBlurb.textContent = "Send one soft-lock to the enemy lane.";
      const key = `C:${state.curseDraft.join(",")}`;
      if (key === this.lastDraftKey) return;
      this.lastDraftKey = key;
      this.relicChoices.innerHTML = "";
      for (const id of state.curseDraft) {
        const def = CURSES[id];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "relic-card level-card";
        btn.innerHTML = `<span class="relic-tag">${def.tag}</span><strong>${def.name}</strong><span>${def.blurb}</span>`;
        btn.addEventListener("click", () => {
          if (this.mpMatch) this.mpUiIntent.chooseCurse = id;
          else chooseCurse(state, id);
          this.lastDraftKey = "";
          if (!this.mpMatch && !state.pausedForDraft) this.relicDraft.classList.add("hidden");
          this.canvas.focus({ preventScroll: true });
        });
        this.relicChoices.appendChild(btn);
      }
      return;
    }
    if (state.chestDraft) {
      this.relicDraft.classList.remove("hidden");
      this.draftActions.classList.add("hidden");
      this.draftTitle.textContent = "Chest Reward";
      this.draftBlurb.textContent = "Pick one of two rewards.";
      const key = `H:${state.chestDraft.map((o) => o.label).join("|")}`;
      if (key === this.lastDraftKey) return;
      this.lastDraftKey = key;
      this.relicChoices.innerHTML = "";
      state.chestDraft.forEach((opt, index) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "relic-card level-card";
        btn.innerHTML = `<span class="relic-tag">Chest</span><strong>${opt.label}</strong><span>${opt.blurb}</span>`;
        btn.addEventListener("click", () => {
          if (this.mpMatch) this.mpUiIntent.chooseChest = index;
          else chooseChestReward(state, index);
          this.lastDraftKey = "";
          if (!this.mpMatch && !state.pausedForDraft) this.relicDraft.classList.add("hidden");
          this.canvas.focus({ preventScroll: true });
        });
        this.relicChoices.appendChild(btn);
      });
      return;
    }
    if (state.utilityDraft) {
      this.relicDraft.classList.remove("hidden");
      this.draftActions.classList.add("hidden");
      this.draftTitle.textContent =
        state.utilityDraftLevel < 0
          ? "Utility Ability (Run Start)"
          : `Utility Ability (Lv ${state.utilityDraftLevel})`;
      this.draftBlurb.textContent = "Choose one global utility for the Spacebar slot.";
      const key = `U:${state.utilityDraft.join(",")}`;
      if (key === this.lastDraftKey) return;
      this.lastDraftKey = key;
      this.relicChoices.innerHTML = "";
      for (const id of state.utilityDraft) {
        const def = UTILITIES[id];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "relic-card level-card";
        btn.innerHTML = `<span class="relic-tag">${def.tag}</span><strong>${def.name}</strong><span>${def.blurb}<br/>${def.hint}</span>`;
        btn.addEventListener("click", () => {
          if (this.mpMatch) this.mpUiIntent.chooseUtility = id;
          else chooseUtility(state, id);
          this.lastDraftKey = "";
          if (!this.mpMatch && !state.pausedForDraft) this.relicDraft.classList.add("hidden");
        });
        this.relicChoices.appendChild(btn);
      }
      return;
    }
    if (state.baseBranchDraft) {
      this.relicDraft.classList.remove("hidden");
      this.draftActions.classList.add("hidden");
      this.draftTitle.textContent = `Base Upgrade (Lv ${state.baseLevel})`;
      this.draftBlurb.textContent = "";
      const key = `B:${state.baseBranchDraft.join(",")}`;
      if (key === this.lastDraftKey) return;
      this.lastDraftKey = key;
      this.relicChoices.innerHTML = "";
      for (const id of state.baseBranchDraft) {
        const def = BASE_BRANCHES[id];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "relic-card level-card";
        btn.innerHTML = `<span class="relic-tag">${def.tag}</span><strong>${def.name}</strong><span>${def.blurb}</span>`;
        btn.addEventListener("click", () => {
          if (this.mpMatch) this.mpUiIntent.chooseBaseBranch = id;
          else chooseBaseBranch(state, id);
          this.lastDraftKey = "";
          if (!this.mpMatch && !state.pausedForDraft) this.relicDraft.classList.add("hidden");
        });
        this.relicChoices.appendChild(btn);
      }
      return;
    }
    if (state.levelDraft) {
      this.relicDraft.classList.remove("hidden");
      this.draftActions.classList.remove("hidden");
      this.draftTitle.textContent = `Level Up! (Lv ${state.level})`;
      this.draftBlurb.textContent = "";
      this.paintDraftActionButtons(true, state);
      const key = `L:${state.levelDraft.join(",")}:r${state.rerollTokens}`;
      if (key === this.lastDraftKey) return;
      this.lastDraftKey = key;
      this.relicChoices.innerHTML = "";
      for (const id of state.levelDraft) {
        const def = LEVEL_PASSIVES[id];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "relic-card level-card";
        const heroTag = def.heroId
          ? ` · ${HEROES[def.heroId]?.name ?? def.heroId}`
          : "";
        btn.innerHTML = `<span class="relic-tag" style="color:${RARITY_COLOR[def.rarity]}">${RARITY_LABEL[def.rarity]} · ${def.tag}${heroTag}</span><strong>${def.name}</strong><span>${def.blurb}</span>`;
        btn.addEventListener("click", () => {
          if (this.mpMatch) this.mpUiIntent.chooseLevel = id;
          else chooseLevelUp(state, id);
          this.lastDraftKey = "";
          if (!this.mpMatch && !state.pausedForDraft) this.relicDraft.classList.add("hidden");
        });
        this.relicChoices.appendChild(btn);
      }
    } else if (state.relicDraft) {
      this.relicDraft.classList.remove("hidden");
      this.draftActions.classList.remove("hidden");
      this.draftTitle.textContent = "Choose a Relic";
      this.draftBlurb.textContent = "";
      this.paintDraftActionButtons(true, state);
      const key = `R:${state.relicDraft.join(",")}:r${state.rerollTokens}`;
      if (key === this.lastDraftKey) return;
      this.lastDraftKey = key;
      this.relicChoices.innerHTML = "";
      for (const id of state.relicDraft) {
        const def = RELICS[id];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "relic-card";
        btn.innerHTML = `${relicArtImg(id, "relic-art relic-card-art")}<span class="relic-tag" style="color:${RARITY_COLOR[def.rarity]}">${RARITY_LABEL[def.rarity]} · ${def.tag}</span><strong>${def.name}</strong><span>${def.blurb}</span>`;
        btn.addEventListener("click", () => {
          if (this.mpMatch) this.mpUiIntent.chooseRelic = id;
          else chooseRelic(state, id);
          this.lastDraftKey = "";
          if (!this.mpMatch && !state.pausedForDraft) this.relicDraft.classList.add("hidden");
        });
        this.relicChoices.appendChild(btn);
      }
    } else {
      this.lastDraftKey = "";
      this.relicDraft.classList.add("hidden");
      this.draftActions.classList.add("hidden");
    }
  }

  private paintDraftActionButtons(showReroll: boolean, src?: GameState): void {
    const state = src ?? this.draftSourceState() ?? this.state;
    if (!state) return;
    this.relicSkip.classList.remove("hidden");
    const tokens = state.rerollTokens;
    const infinite = !!state.infiniteRerolls;
    if (!showReroll) {
      this.draftReroll.classList.add("hidden");
      return;
    }
    this.draftReroll.classList.remove("hidden");
    if (infinite || tokens > 0) {
      this.draftReroll.textContent = `Reroll (${infinite ? "∞" : tokens})`;
      this.draftReroll.disabled = false;
    } else {
      this.draftReroll.textContent = "No reroll tokens";
      this.draftReroll.disabled = true;
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

      this.layoutLaneChrome();
      const view = this.viewForCanvas();
      draw(this.ctx, this.state, view);
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
      this.respawnStack.classList.add("hidden");
      this.respawnMinigameEl.classList.add("hidden");
      this.goldAmountEl.textContent = "0";
      this.incomeEl.textContent = "";
    }

    this.validateTooltip();

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
      onEditGameTypes: () => {
        this.mpUi?.destroy({ disconnect: false });
        this.mpUi = null;
        this.menus.gtReturnFromMultiplayer();
      },
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
    this.remoteViews.clear();
    this.lastReportedView = null;
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

  /**
   * Flip which lane the local player watches in MP. Clients drop the stale
   * entity copy of a lane that was only receiving HUD summaries so the view
   * shows the real sim (fresh full snaps arrive within a round trip) instead
   * of ghost enemies frozen at old positions.
   */
  private toggleMpLaneView(): void {
    const match = this.mpMatch;
    if (!match) return;
    match.viewTeam = (1 - match.viewTeam) as 0 | 1;
    const lane = match.lanes[match.viewTeam];
    if (!this.mpHost && !match.soloOffline && lane.snapIsSummary) {
      lane.enemies = [];
      lane.projectiles = [];
      lane.fx = [];
      lane.beam = null;
    }
    this.state = lane;
    this.reportViewTeam();
    this.updateMpLaneFlipBtn();
  }

  private updateMpLaneFlipBtn(): void {
    const match = this.mpMatch;
    if (!match) return;
    const viewingOpponent = match.viewTeam !== match.myTeam;
    this.laneFlipBtn.textContent = viewingOpponent ? "Your lane" : "View lane";
    this.laneFlipBtn.classList.toggle("active", viewingOpponent);
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
    const view = this.viewForCanvas();

    const controlled =
      heroForSlot(this.mpMatch.lanes[this.mpMatch.myTeam], this.mpMatch.mySlot) ??
      this.mpMatch.lanes[this.mpMatch.myTeam].hero;

    // Aim in world space
    const rect = this.canvas.getBoundingClientRect();
    const dprX = this.canvas.width / Math.max(1, rect.width);
    const dprY = this.canvas.height / Math.max(1, rect.height);
    const sx = (this.input.mouseClientX - rect.left) * dprX;
    const sy = (this.input.mouseClientY - rect.top) * dprY;
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
      if (this.input.consumeAction("laneFlip")) this.toggleMpLaneView();
    }

    const local = gatherLocalIntent(this.input, aim, controlled);
    // Merge queued draft / UI choices (clients must send these — never mutate host sim locally)
    local.chooseRelic = this.mpUiIntent.chooseRelic ?? local.chooseRelic;
    local.skipRelic = this.mpUiIntent.skipRelic || local.skipRelic;
    local.skipLevel = this.mpUiIntent.skipLevel || local.skipLevel;
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
    // Shop is click-only; digits always go to sends even while shop is open.

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

    // Rival purple palette while watching their real dual-lane sim
    this.mpMatch.lanes[0].spectateRivalTint = false;
    this.mpMatch.lanes[1].spectateRivalTint = false;
    this.state.spectateRivalTint = this.mpMatch.viewTeam !== this.mpMatch.myTeam;

    this.layoutLaneChrome();
    const layoutView = this.viewForCanvas();
    draw(this.ctx, this.state, layoutView);
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

  /** Lane the local player acts on (sends / shop / gold) — never the spectated lane. */
  private actingLane(): GameState | null {
    if (this.mpMatch) return this.mpMatch.lanes[this.mpMatch.myTeam];
    return this.state;
  }

  private syncHudMp(): void {
    if (!this.mpMatch || !this.state) return;
    const match = this.mpMatch;
    const myLane = match.lanes[match.myTeam];
    const viewLane = match.lanes[match.viewTeam];
    const watchingThem = match.viewTeam !== match.myTeam;

    // Economy / abilities / sends always reflect YOUR lane.
    const prev = this.state;
    this.state = myLane;
    focusBag(myLane, match.mySlot);
    this.syncHud();
    this.state = prev;

    // Wave pill shows the lane you're looking at.
    const s = viewLane;
    const tier = waveTierLabel(s.waveTier);
    if (s.wave === 0) {
      this.waveNumberEl.textContent = watchingThem ? "Their lane · ready…" : "Get ready…";
    } else if (!s.spawning && s.enemies.length === 0) {
      this.waveNumberEl.textContent = watchingThem
        ? `Their wave ${s.wave} · next ${Math.max(0, s.waveTimer).toFixed(1)}s`
        : `Wave ${s.wave} · next ${Math.max(0, s.waveTimer).toFixed(1)}s`;
    } else {
      this.waveNumberEl.textContent = watchingThem ? `Their wave ${s.wave}` : `Wave ${s.wave}`;
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

    const other = match.lanes[(1 - match.myTeam) as 0 | 1];
    this.oppNameEl.textContent = match.opponentLabel
      ? match.opponentLabel
      : other.aiControlled
        ? `AI · ${resolveHero(other.hero.heroId).name}`
        : `Enemy · ${resolveHero(other.hero.heroId).name}`;
    const sendIn =
      other.summaryIncoming ?? other.pendingSends.reduce((n, p) => n + p.enemies, 0);
    const theirLeft = laneEnemiesRemaining(other);
    this.laneEnemyCountsEl.innerHTML = "";
    this.oppStatsEl.innerHTML = [
      watchingThem ? `<div class="opp-alert">Watching their lane</div>` : "",
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
    if (this.state.shopOpen && !this.state.paused) {
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
    } else if (!s.spawning && s.enemies.length === 0) {
      const waitingOpp =
        this.mpMatch &&
        s.wavesToWin <= 0 &&
        s.waveTimer <= 0 &&
        (() => {
          const other = this.mpMatch!.lanes[(1 - this.mpMatch!.myTeam) as 0 | 1];
          // Enemy draft UI must not block your wave cadence banner / break sense.
          return other.spawning || other.enemies.length > 0;
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

    // Lane counts belong on the side panels — keep the wave pill one line.
    this.laneEnemyCountsEl.innerHTML = "";
    const myLeft = laneEnemiesRemaining(s);

    this.mapNameEl.textContent = "";
    this.statsEl.innerHTML = [
      `<div class="hud-map">${s.map.name}</div>`,
      `<div class="hud-line"><strong>${hero.name}</strong> · Lv ${s.level}${
        s.ascension > 0 ? ` · A${s.ascension}` : ""
      }${s.endless ? " · Endless" : ""}</div>`,
      `<div class="hud-line">Base Lv ${s.baseLevel} · Lane ${myLeft}${
        s.livesPerRun > 0
          ? ` · Lives ${s.runLivesLeft}`
          : s.livesPerWave > 0
            ? ` · W.lives ${s.waveLivesLeft}`
            : ""
      }</div>`,
      `<div class="hud-line">${
        s.endless
          ? aiSend
            ? `Queued to next wave: ${aiSend}`
            : "No sends queued"
          : `${incoming ? `Sent ${incoming}` : "No outbound"}${aiSend ? ` · Incoming ${aiSend}` : ""}`
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

    // MP owns the flip-button label (viewTeam); SP uses the abstract-lane flag.
    if (this.mpMatch) {
      this.updateMpLaneFlipBtn();
    } else {
      this.laneFlipBtn.textContent = s.viewOpponentLane ? "Your lane" : "View lane";
      this.laneFlipBtn.classList.toggle("active", s.viewOpponentLane);
    }

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
      this.respawnStack.classList.remove("hidden");
      this.respawnEl.classList.remove("hidden");

      const g = s.respawnMinigame;
      const showMg = !!(g && Number.isFinite(s.respawnTimer) && s.respawnTimer > 1 && !s.waveRespawnBlocked);
      this.respawnMinigameEl.classList.toggle("hidden", !showMg);
      if (showMg && g) {
        const zStart = Math.max(0, Math.min(1, g.zoneStart));
        const zEnd = Math.max(zStart, Math.min(1, g.zoneEnd));
        const cursor = Math.max(0, Math.min(1, g.cursor));
        this.respawnMgZone.style.left = `${zStart * 100}%`;
        this.respawnMgZone.style.width = `${(zEnd - zStart) * 100}%`;
        this.respawnMgCursor.style.left = `${cursor * 100}%`;
        this.respawnMgTrack.classList.toggle("miss", g.lastHit === false && g.feedback > 0);
        this.respawnMgHint.textContent = `${formatBinding(kb.utility)} — shave respawn`;
      }
    } else {
      this.respawnEl.textContent = "";
      this.respawnStack.classList.add("hidden");
      this.respawnMinigameEl.classList.add("hidden");
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

    this.toastEl.textContent = "";
  }
}
