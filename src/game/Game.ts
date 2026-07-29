import { MAP_W, WIN_WAVES } from "../data/constants";
import { canUpgradeBase } from "../data/baseUpgrades";
import { waveTierLabel } from "../data/enemies";
import { HEROES, type HeroId } from "../data/heroes";
import { RELICS } from "../data/relics";
import { LEVEL_PASSIVES } from "../data/xp";
import { getShopItem } from "../data/shop";
import type { ShopItemId } from "../data/shop";
import { SEND_PACKS } from "../data/send";
import { RARITY_LABEL, RARITY_COLOR } from "../data/rarity";
import { DEFAULT_MAX_TURRETS } from "../data/turrets";
import {
  chooseLevelUp,
  chooseRelic,
  createState,
  pendingSendCount,
  skipRelic,
  update,
  type GameState,
  type RunOptions,
} from "./state";
import { buyShopItem, toggleShopFreeze } from "../systems/shop";
import { availableSendPacks, buySendPack, sendPackCost } from "../systems/send";
import { tryUpgradeBase, upgradeBaseCost } from "../systems/baseUpgrade";
import { xpProgress } from "../systems/xp";
import { effectiveMaxTurrets, livingTurrets } from "../systems/turrets";
import { Input } from "../systems/input";
import { computeView, draw } from "../render/draw";
import { MenuController } from "../ui/MenuController";
import { formatBinding, loadSettings } from "../ui/settings";
import { playSfx, unlockAudio } from "../systems/audio";

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
  };

  private readonly statsEl: HTMLElement;
  private readonly goldAmountEl: HTMLElement;
  private readonly incomeEl: HTMLElement;
  private readonly hintEl: HTMLElement;
  private readonly abilityEl: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly bannerEl: HTMLElement;
  private readonly respawnEl: HTMLElement;
  private readonly relicsEl: HTMLElement;
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
  private lastShopKey = "";
  private lastSendUnlockKey = "";
  private lastDraftKey = "";
  private lastAbilityKey = "";
  private pauseMode: "none" | "paused" | "confirm" | "settings" | "inventory" = "none";

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
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
    this.relicsEl = document.querySelector("#hud-relics")!;
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
      onSettingsChanged: () => this.input.reloadBinds(),
      onRunOptionsChanged: (opts) => {
        this.runDefaults = { ...this.runDefaults, ...opts };
      },
    });

    this.refreshHint();
    this.upgradeBaseBtn.addEventListener("click", () => {
      if (!this.state || this.state.paused) return;
      tryUpgradeBase(this.state);
      this.refreshSendBar();
    });
    this.pauseBtn.addEventListener("click", () => this.togglePause());
    this.invBtn.addEventListener("click", () => this.toggleInventory());
    document.querySelector("#inv-close")!.addEventListener("click", () => {
      this.closeInventory();
    });
    this.shopFreezeBtn.addEventListener("click", () => {
      if (!this.state) return;
      toggleShopFreeze(this.state);
      this.lastShopKey = "";
      this.refreshShopDom();
    });
    this.relicSkip.addEventListener("click", () => {
      if (!this.state) return;
      skipRelic(this.state);
      this.lastDraftKey = "";
      this.relicDraft.classList.add("hidden");
    });

    for (const el of [this.shopPanel, this.sendBar, this.relicDraft, this.laneChrome, this.invPanel]) {
      el.addEventListener("mousedown", (e) => e.stopPropagation());
      el.addEventListener("mouseup", (e) => e.stopPropagation());
    }

    window.addEventListener("resize", () => this.resize());
    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape" && this.state) {
        e.preventDefault();
        if (this.state.pausedForDraft) return;
        if (this.pauseMode === "confirm" || this.pauseMode === "settings") {
          this.showPauseMenu();
          return;
        }
        this.togglePause();
      }
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
      `WASD move · ${formatBinding(kb.attack)} attack · ${formatBinding(kb.mobility)} mobility · ${formatBinding(kb.ultimate)} ult · 1–6 send · U upgrade · F shop · Esc pause`;
  }

  private showMainMenu(): void {
    this.state = null;
    this.pauseMode = "none";
    this.hud.classList.add("hidden");
    this.laneChrome.classList.add("hidden");
    this.shopPanel.classList.add("hidden");
    this.relicDraft.classList.add("hidden");
    this.invPanel.classList.add("hidden");
    this.overlay.classList.add("hidden");
    this.input.reloadBinds();
    this.refreshHint();
    this.menus.show();
  }

  private returnToMainMenu(): void {
    this.state = null;
    this.pauseMode = "none";
    this.shopPanel.classList.add("hidden");
    this.laneChrome.classList.add("hidden");
    this.relicDraft.classList.add("hidden");
    this.invPanel.classList.add("hidden");
    this.overlay.classList.add("hidden");
    this.hud.classList.add("hidden");
    this.input.reloadBinds();
    this.refreshHint();
    this.menus.show();
  }

  private beginRun(heroId: HeroId, opts?: Partial<RunOptions>): void {
    unlockAudio();
    this.menus.hide();
    this.input.reloadBinds();
    this.refreshHint();
    const merged: RunOptions = {
      mapId: opts?.mapId ?? this.runDefaults.mapId ?? "random",
      maxTurrets: opts?.maxTurrets ?? this.runDefaults.maxTurrets ?? DEFAULT_MAX_TURRETS,
    };
    this.state = createState(heroId, merged);
    this.pauseMode = "none";
    this.overlay.classList.add("hidden");
    this.shopPanel.classList.add("hidden");
    this.relicDraft.classList.add("hidden");
    this.invPanel.classList.add("hidden");
    this.laneChrome.classList.remove("hidden");
    this.hud.classList.remove("hidden");
    this.lastDraftKey = "";
    this.lastShopKey = "";
    this.lastSendUnlockKey = "";
    this.lastAbilityKey = "";
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
    const barStack = 36; // meta + track approximate height

    const sendW = Math.min(laneW, window.innerWidth - 40);
    this.sendBar.style.width = `${sendW}px`;
    this.sendBar.style.left = `${(window.innerWidth - sendW) / 2}px`;
    // Send sits above the XP bar, which sits just above the lane.
    this.xpBar.style.width = `${laneW}px`;
    this.xpBar.style.left = `${laneLeft}px`;
    this.xpBar.style.top = `${Math.max(pad, laneTopCss - barStack - 6)}px`;

    const xpTop = parseFloat(this.xpBar.style.top) || laneTopCss - barStack;
    this.sendBar.style.top = `${Math.max(pad, xpTop - 78)}px`;

    // Top-left stats panel sits just above the XP bar (aligned to lane left).
    this.hudPanel.style.left = `${laneLeft}px`;
    this.hudPanel.style.top = `${Math.max(pad, xpTop - this.hudPanel.offsetHeight - 8)}px`;

    this.hpBar.style.width = `${laneW}px`;
    this.hpBar.style.left = `${laneLeft}px`;
    this.hpBar.style.top = `${laneBottomCss + pad}px`;

    const belowHp = laneBottomCss + pad + barStack + 10;
    this.pauseBtn.style.left = `${laneLeft}px`;
    this.pauseBtn.style.top = `${belowHp}px`;

    const rightPad = Math.max(pad, window.innerWidth - laneLeft - laneW);
    this.abilityEl.style.right = `${rightPad}px`;
    this.abilityEl.style.top = `${belowHp}px`;

    // Bag centered under the HP bar
    this.invBtn.style.left = `${laneLeft + laneW / 2}px`;
    this.invBtn.style.right = "auto";
    this.invBtn.style.top = `${belowHp}px`;
  }

  private togglePause(): void {
    if (!this.state || this.state.status !== "playing") return;
    if (this.state.pausedForDraft) return;
    if (this.pauseMode === "inventory") {
      this.closeInventory();
      return;
    }
    if (this.state.paused && this.pauseMode === "paused") {
      this.resumeFromPause();
      return;
    }
    this.closeInventory();
    this.state.paused = true;
    this.showPauseMenu();
    playSfx("ui");
  }

  private resumeFromPause(): void {
    if (!this.state) return;
    this.state.paused = false;
    this.pauseMode = "none";
    this.overlay.classList.add("hidden");
    playSfx("ui");
  }

  private showPauseMenu(): void {
    this.pauseMode = "paused";
    this.overlayTitle.textContent = "Paused";
    this.overlayBody.textContent = "Combat and waves are frozen.";
    this.overlayActions.innerHTML = "";

    const cont = document.createElement("button");
    cont.type = "button";
    cont.textContent = "Continue";
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
    this.menus.show("settings");
    // When leaving settings back to main, intercept — keep paused overlay
    const check = () => {
      if (!this.state?.paused) return;
      if (!this.menus.isVisible()) {
        this.showPauseMenu();
        return;
      }
      // If user navigated to main from settings while paused, send them back to pause
      requestAnimationFrame(check);
    };
    // Hook: when menus go to main while paused, return to pause menu
    const root = document.querySelector("#menus")!;
    const obs = new MutationObserver(() => {
      if (!this.state?.paused) {
        obs.disconnect();
        return;
      }
      // If menu shows main title while paused mid-run, bounce to pause
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
    if (this.state.pausedForDraft) return;
    // Don't open bag over the Esc pause menu
    if (this.pauseMode === "paused" || this.pauseMode === "confirm" || this.pauseMode === "settings") {
      return;
    }

    if (this.invPanel.classList.contains("hidden")) {
      this.refreshInventory();
      this.invPanel.classList.remove("hidden");
      // Singleplayer: freeze combat while browsing inventory
      if (!this.state.paused) {
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
    // Bag button keeps focus after toggle-close; Input ignores keys on UI targets.
    // Close (display:none) blurs automatically — match that here.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
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
    const hero = HEROES[this.state.hero.heroId];
    parts.unshift(
      `<article class="inv-row"><strong>Passive — ${hero.passive.name}</strong><span>${hero.passive.blurb}</span></article>`,
    );
    this.invList.innerHTML = parts.join("");
  }

  private showEndOverlay(): void {
    if (!this.state || !this.overlay.classList.contains("hidden")) return;
    if (this.pauseMode !== "none") return;
    const won = this.state.status === "won";
    const heroName = HEROES[this.state.hero.heroId].name;
    const relicNames = this.state.relics.map((id) => RELICS[id].name).join(", ") || "none";
    const mapName = this.state.map.name;
    this.overlayTitle.textContent = won ? "Lane held!" : "Base fallen";
    this.overlayBody.textContent = won
      ? `${heroName} cleared ${WIN_WAVES} waves on ${mapName} (Lv ${this.state.level}, base ${this.state.baseLevel}) with ${Math.floor(this.state.gold)} gold, ${this.state.sendsThisRun} sends. Relics: ${relicNames}.`
      : `${heroName} fell on wave ${this.state.wave} (${mapName}). Deaths ${this.state.deathCount}. Relics: ${relicNames}.`;
    this.overlayActions.innerHTML = "";

    const again = document.createElement("button");
    again.type = "button";
    again.textContent = "Play again";
    again.addEventListener("click", () => {
      this.state = null;
      this.hud.classList.add("hidden");
      this.laneChrome.classList.add("hidden");
      this.shopPanel.classList.add("hidden");
      this.relicDraft.classList.add("hidden");
      this.overlay.classList.add("hidden");
      this.menus.show("singleplayer");
    });
    this.overlayActions.appendChild(again);

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

    const maxed = !canUpgradeBase(this.state.baseLevel);
    const cost = upgradeBaseCost(this.state);
    this.upgradeBaseBtn.disabled = maxed || this.state.gold < cost || this.state.paused;
    this.upgradeBaseBtn.textContent = maxed
      ? `Base Max (Lv ${this.state.baseLevel})`
      : `Upgrade Base · ${cost}g (Lv ${this.state.baseLevel} → ${this.state.baseLevel + 1})`;
    this.upgradeBaseBtn.dataset.tip =
      "Raises base level: unlocks packs and strengthens existing send costs, income, and HP.";

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
        const broke = this.state!.gold < item.cost;
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
        const costLabel = maxed ? `×${owned} max` : broke ? `LOCKED ${item.cost}g` : `${item.cost}g`;
        row.innerHTML = `<span class="shop-name">[${i + 4}] ${item.name}</span><span class="shop-meta">${tag}${item.effect}</span><span class="shop-cost">${costLabel}</span>`;
        row.dataset.tip = `<strong style="color:${RARITY_COLOR[item.rarity]}">${item.name}</strong> · ${rarity}<br/>${item.effect}<br/>${item.cost}g · max ×${item.maxStacks}${broke && !maxed ? "<br/><span style=\"color:#ff6b6b\">Not enough gold</span>" : ""}`;
        const buyId = id;
        row.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (!this.state || this.state.paused) return;
          buyShopItem(this.state, buyId);
          this.lastShopKey = "";
          this.refreshShopDom();
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
        const broke = this.state!.gold < item.cost;
        row.disabled = maxed || broke || this.state!.paused;
        row.classList.toggle("owned-max", maxed);
        row.classList.toggle("unaffordable", broke && !maxed);
        const costEl = row.querySelector(".shop-cost");
        if (costEl) {
          costEl.textContent = maxed ? `×${owned} max` : broke ? `LOCKED ${item.cost}g` : `${item.cost}g`;
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
    this.shopMetaEl.textContent = `${stock} · Turrets ${turrets}/${cap}`;
  }

  private syncDraft(): void {
    if (!this.state) return;
    if (this.state.pausedForDraft && this.state.levelDraft) {
      this.relicDraft.classList.remove("hidden");
      this.relicSkip.classList.add("hidden");
      this.draftTitle.textContent = `Level Up! (Lv ${this.state.level})`;
      this.draftBlurb.textContent = "Choose one passive upgrade.";
      const key = `L:${this.state.levelDraft.join(",")}`;
      if (key === this.lastDraftKey) return;
      this.lastDraftKey = key;
      this.relicChoices.innerHTML = "";
      for (const id of this.state.levelDraft) {
        const def = LEVEL_PASSIVES[id];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "relic-card level-card";
        btn.innerHTML = `<span class="relic-tag">${def.tag}</span><strong>${def.name}</strong><span>${def.blurb}</span>`;
        btn.addEventListener("click", () => {
          if (!this.state) return;
          chooseLevelUp(this.state, id);
          this.lastDraftKey = "";
          if (!this.state.pausedForDraft) this.relicDraft.classList.add("hidden");
        });
        this.relicChoices.appendChild(btn);
      }
    } else if (this.state.pausedForDraft && this.state.relicDraft) {
      this.relicDraft.classList.remove("hidden");
      this.relicSkip.classList.remove("hidden");
      this.draftTitle.textContent = "Choose a Relic";
      this.draftBlurb.textContent = "Pick one build-defining power — or skip if none fit.";
      const key = `R:${this.state.relicDraft.join(",")}`;
      if (key === this.lastDraftKey) return;
      this.lastDraftKey = key;
      this.relicChoices.innerHTML = "";
      for (const id of this.state.relicDraft) {
        const def = RELICS[id];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "relic-card";
        btn.innerHTML = `<span class="relic-tag" style="color:${RARITY_COLOR[def.rarity]}">${RARITY_LABEL[def.rarity]} · ${def.tag}</span><strong>${def.name}</strong><span>${def.blurb}</span>`;
        btn.addEventListener("click", () => {
          if (!this.state) return;
          chooseRelic(this.state, id);
          this.lastDraftKey = "";
          if (!this.state.pausedForDraft) this.relicDraft.classList.add("hidden");
        });
        this.relicChoices.appendChild(btn);
      }
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

    if (this.state) {
      // Don't sim while pause settings menu is open either
      const menusOpen = this.menus.isVisible() && this.state.paused;
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
      this.relicsEl.textContent = "";
      this.goldAmountEl.textContent = "0";
      this.incomeEl.textContent = "";
    }

    requestAnimationFrame((t) => this.frame(t));
  }

  private syncShopPanel(): void {
    if (!this.state) return;
    if (this.state.shopOpen) {
      this.shopPanel.classList.remove("hidden");
      this.refreshShopDom();
    } else {
      this.shopPanel.classList.add("hidden");
    }
  }

  private syncHud(): void {
    const s = this.state;
    if (!s) return;
    const hero = HEROES[s.hero.heroId];
    const kb = loadSettings().keybinds;
    const tier = waveTierLabel(s.waveTier);
    const waveLabel = s.spawning
      ? `Wave ${s.wave}${tier ? ` · ${tier}` : ""}`
      : s.wave === 0
        ? "Get ready…"
        : s.pausedForDraft
          ? s.levelDraft
            ? `Level up — choose a passive`
            : `Wave ${s.wave} cleared — choose a relic`
          : s.paused
            ? "Paused"
            : `Wave ${s.wave} cleared — next in ${Math.max(0, s.waveTimer).toFixed(1)}s`;
    const queued = pendingSendCount(s);

    this.goldAmountEl.textContent = `${Math.floor(s.gold)}`;
    this.incomeEl.textContent = `+${s.incomePerSec.toFixed(1)}/s`;

    this.statsEl.innerHTML = [
      `<div class="hud-line"><strong>${hero.name}</strong> · Lv ${s.level}</div>`,
      `<div class="hud-line">${waveLabel}</div>`,
      `<div class="hud-line">${s.map.name} · Base Lv ${s.baseLevel}</div>`,
      `<div class="hud-line">Base HP ${Math.ceil(s.baseHp)}/${s.map.base.maxHp} · Hero ${s.hero.alive ? `${Math.ceil(s.hero.hp)}/${s.hero.maxHp}` : "DOWN"}${queued ? ` · Queued ${queued}` : ""}</div>`,
    ].join("");

    // HTML banner as backup — keep clear of XP bar
    this.bannerEl.textContent = "";
    this.bannerEl.className = "";

    if (!s.hero.alive) {
      this.respawnEl.textContent = `Respawning in ${Math.max(0, s.respawnTimer).toFixed(1)}s`;
      this.respawnEl.classList.remove("hidden");
    } else {
      this.respawnEl.textContent = "";
      this.respawnEl.classList.add("hidden");
    }

    this.relicsEl.innerHTML =
      s.relics.length > 0
        ? `Relics: ${s.relics
            .map((id) => {
              const r = RELICS[id];
              return `<span class="relic-chip" data-tip="<strong>${r.name}</strong><br/>${r.blurb}" style="color:${RARITY_COLOR[r.rarity]}">${r.name}</span>`;
            })
            .join(" · ")}`
        : "";

    const labels = [formatBinding(kb.mobility), formatBinding(kb.ultimate)];
    const abilityKey = `${s.hero.abilityCds.map((c) => c.toFixed(1)).join(",")}:${s.hero.alive}`;
    if (abilityKey !== this.lastAbilityKey) {
      this.lastAbilityKey = abilityKey;
      this.abilityEl.innerHTML = hero.abilities
        .map((a, i) => {
          const cd = s.hero.abilityCds[i] ?? 0;
          const ready = cd <= 0 && s.hero.alive;
          const cdText = !s.hero.alive ? "—" : ready ? "ready" : cd.toFixed(1);
          const tip = `<strong>${a.name}</strong><br/>${a.hint}<br/>CD ${a.cooldown}s`;
          return `<div class="ability ${ready ? "ready" : "cooling"}" data-tip="${tip.replace(/"/g, "&quot;")}"><kbd>${labels[i]}</kbd><span>${a.name}</span><em>${cdText}</em></div>`;
        })
        .join("");
    }

    this.toastEl.textContent =
      s.toastTimer > 0 ? s.toast : s.nearShop && !s.shopOpen ? "F — open shop" : "";
  }
}
