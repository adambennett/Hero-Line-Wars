import { HERO_LIST, type HeroId } from "../data/heroes";
import { MAP_LIST, type MapId } from "../data/maps";
import { MAP_H, MAP_W } from "../data/constants";
import { RELIC_LIST } from "../data/relics";
import { SHOP_ITEMS } from "../data/shop";
import { SEND_PACKS } from "../data/send";
import { ENEMY_DEFS, type EnemyKind } from "../data/enemies";
import { RARITY_LABEL, RARITY_COLOR, RARITY_ORDER, type Rarity } from "../data/rarity";
import { DEFAULT_MAX_TURRETS } from "../data/turrets";
import { STARTING_GOLD, WIN_WAVES } from "../data/constants";
import type { RunOptions } from "../game/state";
import type { MatchMode, MatchPrivacy } from "../net/types";
import {
  ACTION_HINTS,
  ACTION_LABELS,
  DAMAGE_FX_LABELS,
  DEFAULT_KEYBINDS,
  bindingEquals,
  formatBinding,
  loadSettings,
  saveSettings,
  type Binding,
  type ClientSettings,
  type CombatAction,
  type DamageScreenFx,
} from "./settings";
import { RECIPES, type RecipeId } from "../ai/brain";
import {
  deleteSchool,
  loadAiStore,
  saveTrainingResult,
  setSelectedOpponent,
  type AiSelection,
  type AiStore,
} from "../ai/store";
import { isTraining, runTraining, stopTraining, type TrainProgress } from "../ai/train";
import {
  ASCENSIONS,
  ascensionLabel,
} from "../meta/ascension";
import {
  getRank,
  isHeroUnlocked,
  loadMetaStore,
  purchaseUpgrade,
} from "../meta/store";
import { META_UPGRADES, nextCost } from "../meta/upgrades";
import { unlockAudio } from "../systems/audio";

export type { MatchMode, MatchPrivacy } from "../net/types";

export type MenuScreen =
  | "main"
  | "singleplayer"
  | "multiplayer"
  | "mp-options"
  | "compendium"
  | "game-info"
  | "settings"
  | "controls"
  | "ai-lab"
  | "barracks";

export type MatchRole = "host" | "join";

export type LobbyDraft = {
  mode: MatchMode;
  privacy: MatchPrivacy;
  role: MatchRole;
  joinCode: string;
  hostCode: string;
  mapChoice: MapId | "random";
  maxTurrets: number;
  startingGold: number;
  /** 0 = unlimited. */
  wavesToWin: number;
  friendlyFire: boolean;
};

export type MenuCallbacks = {
  onStartSingleplayer: (heroId: HeroId, opts?: Partial<RunOptions>) => void;
  onOpenMultiplayer: (draft: LobbyDraft, heroId: HeroId) => void;
  onSettingsChanged?: () => void;
  onRunOptionsChanged?: (opts: Partial<RunOptions>) => void;
};

type CompTab = "heroes" | "items" | "relics" | "enemies" | "sends" | "maps";

const MODE_OPTIONS: { id: MatchMode; label: string; hint: string }[] = [
  { id: "1v1", label: "1v1 PvP", hint: "One hero per side" },
  { id: "2v2", label: "2v2 PvP", hint: "Two allies, shared lane" },
  { id: "3v3", label: "3v3 PvP", hint: "Three allies, shared lane" },
  { id: "2p-pve", label: "2 Player PvE", hint: "Co-op vs AI" },
  { id: "3p-pve", label: "3 Player PvE", hint: "Co-op vs AI" },
];

const COMBAT_ACTIONS: CombatAction[] = ["attack", "mobility", "ultimate"];
const ENEMY_KINDS = Object.keys(ENEMY_DEFS) as EnemyKind[];

function randomLobbyCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  return out;
}

export class MenuController {
  private readonly root: HTMLElement;
  private readonly callbacks: MenuCallbacks;
  private screen: MenuScreen = "main";
  private selectedHero: HeroId = HERO_LIST[0]!.id;
  private lobby: LobbyDraft = {
    mode: "1v1",
    privacy: "private",
    role: "host",
    joinCode: "",
    hostCode: randomLobbyCode(),
    mapChoice: "random",
    maxTurrets: DEFAULT_MAX_TURRETS,
    startingGold: STARTING_GOLD,
    wavesToWin: WIN_WAVES,
    friendlyFire: false,
  };
  private spMapChoice: MapId | "random" = "random";
  private spMaxTurrets = DEFAULT_MAX_TURRETS;
  private spStartingGold = STARTING_GOLD;
  private spWavesToWin = WIN_WAVES;
  private spFriendlyFire = false;
  private spAscension = 0;
  private settings: ClientSettings = loadSettings();
  private compendiumTab: CompTab = "heroes";
  private compSearch = "";
  private compRarity: Rarity | "all" = "all";
  private compSort: "name" | "rarity" = "rarity";
  private toast = "";
  private rebinding: CombatAction | null = null;
  private unbindListen: (() => void) | null = null;
  private trainProgress: TrainProgress | null = null;

  constructor(root: HTMLElement, callbacks: MenuCallbacks) {
    this.root = root;
    this.callbacks = callbacks;
    this.root.addEventListener("click", (e) => this.onClick(e));
    this.root.addEventListener("input", (e) => this.onInput(e));
    this.root.addEventListener("change", (e) => this.onChange(e));
  }

  show(screen: MenuScreen = "main"): void {
    this.settings = loadSettings();
    this.stopRebindListen();
    this.root.classList.remove("hidden");
    this.go(screen);
  }

  hide(): void {
    this.stopRebindListen();
    this.root.classList.add("hidden");
    this.root.innerHTML = "";
  }

  isVisible(): boolean {
    return !this.root.classList.contains("hidden");
  }

  go(screen: MenuScreen): void {
    if (screen !== "controls") this.stopRebindListen();
    this.screen = screen;
    this.render();
  }

  private persist(): void {
    saveSettings(this.settings);
    this.callbacks.onSettingsChanged?.();
  }

  private setToast(message: string): void {
    this.toast = message;
    this.render();
  }

  private onClick(e: Event): void {
    if (this.rebinding) return;
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!t) return;
    const action = t.dataset.action;
    if (!action) return;

    switch (action) {
      case "goto":
        if (t.dataset.screen === "multiplayer") {
          this.callbacks.onOpenMultiplayer({ ...this.lobby }, this.selectedHero);
          break;
        }
        this.go(t.dataset.screen as MenuScreen);
        break;
      case "quit":
        this.quit();
        break;
      case "pick-hero":
        this.selectedHero = t.dataset.heroId as HeroId;
        if (this.screen === "singleplayer") this.paintSpHeroSelection();
        else this.render();
        break;
      case "play-sp":
        if (!isHeroUnlocked(this.selectedHero)) {
          this.setToast("Commission that hero in the Barracks first.");
          break;
        }
        this.callbacks.onStartSingleplayer(this.selectedHero, {
          mapId: this.spMapChoice,
          maxTurrets: this.spMaxTurrets,
          startingGold: this.spStartingGold,
          wavesToWin: this.spWavesToWin,
          friendlyFire: this.spFriendlyFire,
          ascension: this.spAscension,
        });
        break;
      case "set-sp-map":
        this.spMapChoice = t.dataset.mapId as MapId | "random";
        this.render();
        break;
      case "set-mp-map":
        this.lobby.mapChoice = t.dataset.mapId as MapId | "random";
        this.callbacks.onRunOptionsChanged?.({
          mapId: this.lobby.mapChoice,
          maxTurrets: this.lobby.maxTurrets,
          startingGold: this.lobby.startingGold,
          wavesToWin: this.lobby.wavesToWin,
          friendlyFire: this.lobby.friendlyFire,
        });
        this.render();
        break;
      case "set-mode":
        this.lobby.mode = t.dataset.mode as MatchMode;
        this.render();
        break;
      case "set-privacy":
        this.lobby.privacy = t.dataset.privacy as MatchPrivacy;
        this.render();
        break;
      case "set-role":
        this.lobby.role = t.dataset.role as MatchRole;
        if (this.lobby.role === "host" && !this.lobby.hostCode) this.lobby.hostCode = randomLobbyCode();
        this.render();
        break;
      case "regen-code":
        this.lobby.hostCode = randomLobbyCode();
        this.setToast("New lobby code generated.");
        break;
      case "copy-code":
        void navigator.clipboard?.writeText(this.lobby.hostCode).then(
          () => this.setToast("Lobby code copied."),
          () => this.setToast(`Code: ${this.lobby.hostCode}`),
        );
        break;
      case "mp-continue":
      case "mp-stub":
      case "mp-connect":
        this.callbacks.onOpenMultiplayer({ ...this.lobby }, this.selectedHero);
        break;
      case "comp-tab":
        this.compendiumTab = t.dataset.tab as CompTab;
        this.render();
        break;
      case "reset-settings":
        this.settings = {
          masterVolume: 0.7,
          showDamageNumbers: true,
          screenShake: true,
          reduceMotion: false,
          damageScreenFx: "full",
          keybinds: { ...DEFAULT_KEYBINDS },
        };
        this.persist();
        this.setToast("Settings reset.");
        break;
      case "reset-binds":
        this.settings.keybinds = { ...DEFAULT_KEYBINDS };
        this.persist();
        this.setToast("Controls reset to mouse defaults.");
        break;
      case "rebind":
        this.beginRebind(t.dataset.bind as CombatAction);
        break;
      case "cancel-rebind":
        this.stopRebindListen();
        this.render();
        break;
      case "ai-start":
        void this.startAiTraining();
        break;
      case "ai-stop":
        stopTraining();
        {
          const st = this.root.querySelector("#ai-status");
          if (st) st.textContent = "Stopping…";
        }
        break;
      case "ai-del-school":
        deleteSchool(t.dataset.school!);
        this.render();
        break;
      case "buy-meta":
        {
          const res = purchaseUpgrade(t.dataset.upgradeId as import("../meta/upgrades").MetaUpgradeId);
          this.setToast(res.message);
        }
        break;
      default:
        break;
    }
  }

  private beginRebind(action: CombatAction): void {
    this.stopRebindListen();
    this.rebinding = action;
    this.render();

    const onKey = (ev: KeyboardEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.code === "Escape") {
        this.stopRebindListen();
        this.render();
        return;
      }
      this.applyBinding(action, { device: "key", code: ev.code });
    };
    const onMouse = (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.button > 2) return;
      this.applyBinding(action, { device: "mouse", button: ev.button as 0 | 1 | 2 });
    };

    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onMouse, true);
    this.unbindListen = () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onMouse, true);
      this.rebinding = null;
      this.unbindListen = null;
    };
  }

  private applyBinding(action: CombatAction, binding: Binding): void {
    for (const other of COMBAT_ACTIONS) {
      if (other === action) continue;
      if (bindingEquals(this.settings.keybinds[other], binding)) {
        this.settings.keybinds[other] = this.settings.keybinds[action];
      }
    }
    this.settings.keybinds[action] = binding;
    this.persist();
    this.stopRebindListen();
    this.setToast(`${ACTION_LABELS[action]} → ${formatBinding(binding)}`);
  }

  private stopRebindListen(): void {
    this.unbindListen?.();
  }

  private onInput(e: Event): void {
    const el = e.target as HTMLInputElement;
    if (el.dataset.field === "join-code") {
      this.lobby.joinCode = el.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
      return;
    }
    if (el.dataset.field === "volume") {
      this.settings.masterVolume = Number(el.value);
      this.persist();
      const label = this.root.querySelector("#volume-label");
      if (label) label.textContent = `${Math.round(this.settings.masterVolume * 100)}%`;
    }
    if (el.dataset.field === "mp-turrets") {
      this.lobby.maxTurrets = Math.max(1, Math.min(6, Number(el.value) || DEFAULT_MAX_TURRETS));
      this.emitLobbyOpts();
      const label = this.root.querySelector("#mp-turret-label");
      if (label) label.textContent = String(this.lobby.maxTurrets);
    }
    if (el.dataset.field === "sp-turrets") {
      this.spMaxTurrets = Math.max(1, Math.min(6, Number(el.value) || DEFAULT_MAX_TURRETS));
      const label = this.root.querySelector("#sp-turret-label");
      if (label) label.textContent = String(this.spMaxTurrets);
    }
    if (el.dataset.field === "comp-search") {
      this.compSearch = el.value;
      this.renderCompendiumListOnly();
    }
  }

  private emitLobbyOpts(): void {
    this.callbacks.onRunOptionsChanged?.({
      mapId: this.lobby.mapChoice,
      maxTurrets: this.lobby.maxTurrets,
      startingGold: this.lobby.startingGold,
      wavesToWin: this.lobby.wavesToWin,
      friendlyFire: this.lobby.friendlyFire,
    });
  }

  private onChange(e: Event): void {
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    if ((el as HTMLInputElement).dataset.setting === "showDamageNumbers") {
      this.settings.showDamageNumbers = (el as HTMLInputElement).checked;
      this.persist();
    } else if ((el as HTMLInputElement).dataset.setting === "screenShake") {
      this.settings.screenShake = (el as HTMLInputElement).checked;
      this.persist();
    } else if ((el as HTMLInputElement).dataset.setting === "reduceMotion") {
      this.settings.reduceMotion = (el as HTMLInputElement).checked;
      this.persist();
    } else if (el.dataset.field === "damage-fx") {
      this.settings.damageScreenFx = el.value as DamageScreenFx;
      this.persist();
    } else if (el.dataset.field === "comp-rarity") {
      this.compRarity = el.value as Rarity | "all";
      this.renderCompendiumListOnly();
    } else if (el.dataset.field === "comp-sort") {
      this.compSort = el.value as "name" | "rarity";
      this.renderCompendiumListOnly();
    } else if (el.dataset.field === "mp-starting-gold") {
      this.lobby.startingGold = Number(el.value) || STARTING_GOLD;
      this.emitLobbyOpts();
    } else if (el.dataset.field === "mp-waves-to-win") {
      this.lobby.wavesToWin = Number(el.value);
      this.emitLobbyOpts();
    } else if (el.dataset.field === "mp-friendly-fire") {
      this.lobby.friendlyFire = el.value === "1";
      this.emitLobbyOpts();
    } else if (el.dataset.field === "sp-starting-gold") {
      this.spStartingGold = Number(el.value) || STARTING_GOLD;
    } else if (el.dataset.field === "sp-waves-to-win") {
      this.spWavesToWin = Number(el.value);
    } else if (el.dataset.field === "sp-friendly-fire") {
      this.spFriendlyFire = el.value === "1";
    } else if (el.dataset.field === "sp-turrets") {
      this.spMaxTurrets = Math.max(1, Math.min(6, Number(el.value) || DEFAULT_MAX_TURRETS));
    } else if (el.dataset.field === "sp-ascension") {
      this.spAscension = Number(el.value) || 0;
      this.paintSpRunMeta();
    } else if (el.dataset.field === "sp-map") {
      this.spMapChoice = el.value as MapId | "random";
    } else if (el.dataset.field === "sp-opponent-ai") {
      setSelectedOpponent(parseAiSelectValue(el.value));
    } else if (el.dataset.field === "ai-opponent") {
      setSelectedOpponent(parseAiSelectValue(el.value));
    }
  }

  private async startAiTraining(): Promise<void> {
    if (isTraining()) return;
    unlockAudio();
    const recipe = (this.root.querySelector("#ai-recipe") as HTMLSelectElement)?.value as RecipeId;
    const gens = Number((this.root.querySelector("#ai-gens") as HTMLInputElement)?.value);
    const pop = Number((this.root.querySelector("#ai-pop") as HTMLInputElement)?.value);
    const trials = Number((this.root.querySelector("#ai-trials") as HTMLInputElement)?.value);
    const maxSeconds = Number((this.root.querySelector("#ai-seconds") as HTMLInputElement)?.value) || 180;
    const name =
      ((this.root.querySelector("#ai-name") as HTMLInputElement)?.value || recipe).trim() || recipe;
    const startBtn = this.root.querySelector("#ai-start") as HTMLButtonElement | null;
    const stopBtn = this.root.querySelector("#ai-stop") as HTMLButtonElement | null;
    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;

    const result = await runTraining({ recipe, gens, pop, trials, maxSeconds }, (p) => {
      this.trainProgress = p;
      const st = this.root.querySelector("#ai-status");
      if (st) st.textContent = p.message;
    });

    if (result) saveTrainingResult(name, recipe, result);
    this.trainProgress = null;
    if (this.screen === "ai-lab") this.render();
  }

  private quit(): void {
    const desktop = (window as Window & {
      heroLineWarsDesktop?: { quit?: () => void };
    }).heroLineWarsDesktop;
    if (desktop?.quit) {
      desktop.quit();
      return;
    }
    window.close();
    this.setToast("Close this tab to quit (browser blocked auto-close).");
  }

  private render(): void {
    const prevShell = this.root.querySelector(".menu-shell");
    const scroll = prevShell?.scrollTop ?? 0;
    const toastHtml = this.toast ? `<p class="menu-toast">${escapeHtml(this.toast)}</p>` : "";
    this.toast = "";

    let body = "";
    switch (this.screen) {
      case "main":
        body = this.renderMain();
        break;
      case "singleplayer":
        body = this.renderSingleplayer();
        break;
      case "multiplayer":
        body = this.renderMultiplayer();
        break;
      case "mp-options":
        body = this.renderMpOptions();
        break;
      case "compendium":
        body = this.renderCompendium();
        break;
      case "game-info":
        body = this.renderGameInfo();
        break;
      case "settings":
        body = this.renderSettings();
        break;
      case "controls":
        body = this.renderControls();
        break;
      case "ai-lab":
        body = this.renderAiLab();
        break;
      case "barracks":
        body = this.renderBarracks();
        break;
    }

    this.root.innerHTML = `
      <div class="menu-backdrop"></div>
      <div class="menu-shell${this.screen === "singleplayer" ? " tight" : ""}">
        ${body}
        ${toastHtml}
      </div>
    `;

    const shell = this.root.querySelector(".menu-shell");
    if (shell) shell.scrollTop = scroll;

    if (this.screen === "compendium" && this.compendiumTab === "maps") {
      this.paintMapThumbs();
    }
  }

  private renderCompendiumListOnly(): void {
    const list = this.root.querySelector(".comp-list");
    if (!list) {
      this.render();
      return;
    }
    list.innerHTML = this.compendiumContent();
    if (this.compendiumTab === "maps") this.paintMapThumbs();
  }

  private paintMapThumbs(): void {
    for (const m of MAP_LIST) {
      const canvas = this.root.querySelector<HTMLCanvasElement>(`canvas[data-map="${m.id}"]`);
      if (!canvas) continue;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      const w = (canvas.width = 280);
      const h = (canvas.height = 72);
      ctx.fillStyle = "#0a0f1a";
      ctx.fillRect(0, 0, w, h);
      const sx = w / MAP_W;
      const sy = h / MAP_H;
      ctx.fillStyle = "#152038";
      ctx.fillRect(0, m.laneTop * sy, w, (m.laneBottom - m.laneTop) * sy);
      ctx.fillStyle = "#3d5a8866";
      for (const hg of m.highGrounds) {
        ctx.fillRect(hg.x * sx, hg.y * sy, hg.w * sx, hg.h * sy);
      }
      ctx.fillStyle = "#1c2838";
      for (const o of m.obstacles) {
        ctx.fillRect(o.x * sx, o.y * sy, o.w * sx, o.h * sy);
      }
      ctx.fillStyle = "#2f6fd0";
      ctx.beginPath();
      ctx.arc(m.base.x * sx, m.base.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5a2430";
      ctx.beginPath();
      ctx.arc(m.spawner.x * sx, m.spawner.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2a4a38";
      ctx.beginPath();
      ctx.arc(m.shop.x * sx, m.shop.y * sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderMain(): string {
    return `
      <header class="menu-header">
        <p class="menu-eyebrow">Prototype</p>
        <h1 class="menu-title">Hero Line Wars</h1>
        <p class="menu-sub">Hold the line. Grow your income. Outlast the waves.</p>
      </header>
      <nav class="menu-nav">
        <button type="button" class="menu-btn primary" data-action="goto" data-screen="singleplayer">Singleplayer</button>
        <button type="button" class="menu-btn" data-action="goto" data-screen="multiplayer">Multiplayer</button>
        <button type="button" class="menu-btn" data-action="goto" data-screen="barracks">Barracks</button>
        <button type="button" class="menu-btn" data-action="goto" data-screen="ai-lab">AI Lab</button>
        <button type="button" class="menu-btn" data-action="goto" data-screen="compendium">Compendium</button>
        <button type="button" class="menu-btn" data-action="goto" data-screen="game-info">Game Info</button>
        <button type="button" class="menu-btn" data-action="goto" data-screen="settings">Settings</button>
        <button type="button" class="menu-btn ghost" data-action="quit">Quit</button>
      </nav>
    `;
  }

  private runOptionsFields(scope: "sp" | "mp"): string {
    const turrets = scope === "sp" ? this.spMaxTurrets : this.lobby.maxTurrets;
    const gold = scope === "sp" ? this.spStartingGold : this.lobby.startingGold;
    const waves = scope === "sp" ? this.spWavesToWin : this.lobby.wavesToWin;
    const ff = scope === "sp" ? this.spFriendlyFire : this.lobby.friendlyFire;
    const goldOpts = [45, 60, 80, 100, 150]
      .map(
        (g) =>
          `<option value="${g}" ${gold === g ? "selected" : ""}>${g}${g === STARTING_GOLD ? " (default)" : ""}</option>`,
      )
      .join("");
    const waveOpts = [8, 10, 12, 15, 20, 0]
      .map((w) => {
        const label = w === 0 ? "Unlimited" : String(w);
        const def = w === WIN_WAVES ? " (default)" : "";
        return `<option value="${w}" ${waves === w ? "selected" : ""}>${label}${def}</option>`;
      })
      .join("");
    const turretOpts = [1, 2, 3, 4, 5, 6]
      .map(
        (n) =>
          `<option value="${n}" ${turrets === n ? "selected" : ""}>${n}${n === DEFAULT_MAX_TURRETS ? " (default)" : ""}</option>`,
      )
      .join("");
    if (scope === "sp") {
      return `
        <div class="run-grid cols-4">
          <label class="run-field">
            <span>Turrets</span>
            <select data-field="sp-turrets">${turretOpts}</select>
          </label>
          <label class="run-field">
            <span>Starting gold</span>
            <select data-field="sp-starting-gold">${goldOpts}</select>
          </label>
          <label class="run-field">
            <span>Waves to win</span>
            <select data-field="sp-waves-to-win">${waveOpts}</select>
          </label>
          <label class="run-field">
            <span>Friendly fire</span>
            <select data-field="sp-friendly-fire">
              <option value="0" ${!ff ? "selected" : ""}>Off</option>
              <option value="1" ${ff ? "selected" : ""}>On</option>
            </select>
          </label>
        </div>
      `;
    }
    return `
      <label class="setting-row">
        <span>Max turrets <em id="${scope}-turret-label">${turrets}</em></span>
        <input type="range" min="1" max="6" step="1" value="${turrets}" data-field="${scope}-turrets" />
      </label>
      <label class="setting-row">
        <span>Starting gold</span>
        <select data-field="${scope}-starting-gold">${goldOpts}</select>
      </label>
      <label class="setting-row">
        <span>Waves to win</span>
        <select data-field="${scope}-waves-to-win">${waveOpts}</select>
      </label>
      <label class="setting-row">
        <span>Friendly fire</span>
        <select data-field="${scope}-friendly-fire">
          <option value="0" ${!ff ? "selected" : ""}>Off</option>
          <option value="1" ${ff ? "selected" : ""}>On</option>
        </select>
      </label>
    `;
  }

  private spHeroDetailHtml(): string {
    const kb = this.settings.keybinds;
    const meta = loadMetaStore();
    const h = HERO_LIST.find((x) => x.id === this.selectedHero) ?? HERO_LIST[0]!;
    const unlocked = isHeroUnlocked(h.id, meta);
    if (!unlocked) {
      return `
        <div class="sp-hero-detail-inner locked">
          <span class="hero-swatch" style="--hero:${h.color}"></span>
          <strong>${escapeHtml(h.name)} · Locked</strong>
          <p class="sp-hero-locked">Commission this hero in the Barracks to unlock.</p>
        </div>
      `;
    }
    const [mobility, ultimate] = h.abilities;
    return `
      <div class="sp-hero-detail-inner">
        <span class="hero-swatch" style="--hero:${h.color}"></span>
        <strong style="color:${h.color}">${escapeHtml(h.name)}</strong>
        <p class="sp-hero-blurb">${escapeHtml(h.blurb)}</p>
        <ul class="hero-abilities">
          <li><em>Passive</em> ${escapeHtml(h.passive.name)} — ${escapeHtml(h.passive.blurb)}</li>
          <li><kbd>${formatBinding(kb.attack)}</kbd> ${escapeHtml(h.attackHint)}</li>
          <li><kbd>${formatBinding(kb.mobility)}</kbd> ${escapeHtml(mobility.name)} — ${escapeHtml(mobility.hint)}</li>
          <li><kbd>${formatBinding(kb.ultimate)}</kbd> ${escapeHtml(ultimate.name)} — ${escapeHtml(ultimate.hint)}</li>
        </ul>
      </div>
    `;
  }

  private paintSpHeroSelection(): void {
    this.root.querySelectorAll<HTMLElement>(".hero-card[data-hero-id]").forEach((card) => {
      card.classList.toggle("selected", card.dataset.heroId === this.selectedHero);
    });
    const detail = this.root.querySelector("#sp-hero-detail");
    if (detail) detail.innerHTML = this.spHeroDetailHtml();
  }

  private paintSpRunMeta(): void {
    const play = this.root.querySelector<HTMLElement>("[data-action='play-sp']");
    if (play) play.textContent = `Play · ${ascensionLabel(this.spAscension)}`;
  }

  private renderSingleplayer(): string {
    const meta = loadMetaStore();
    this.spAscension = Math.min(this.spAscension, meta.ascensionUnlocked);
    const cards = HERO_LIST.map((h) => {
      const selected = h.id === this.selectedHero;
      const unlocked = isHeroUnlocked(h.id, meta);
      return `
        <button type="button" class="hero-card compact ${selected ? "selected" : ""} ${unlocked ? "" : "locked"}" data-action="pick-hero" data-hero-id="${h.id}" ${unlocked ? "" : "title=\"Unlock in Barracks\""}>
          <span class="hero-swatch" style="--hero:${h.color}"></span>
          <strong>${escapeHtml(h.name)}</strong>
          <span>${unlocked ? escapeHtml(h.blurb) : "Locked"}</span>
        </button>
      `;
    }).join("");

    const mapOpts = [
      `<option value="random" ${this.spMapChoice === "random" ? "selected" : ""}>Random</option>`,
      ...MAP_LIST.map(
        (m) =>
          `<option value="${m.id}" ${this.spMapChoice === m.id ? "selected" : ""}>${escapeHtml(m.name)}</option>`,
      ),
    ].join("");

    const store = loadAiStore();
    const aiOpts = aiSelectOptions(store, store.selected);
    const ascOpts = Array.from({ length: meta.ascensionUnlocked + 1 }, (_, i) => {
      const def = ASCENSIONS[i]!;
      return `<option value="${i}" ${this.spAscension === i ? "selected" : ""}>A${i} · ${escapeHtml(def.name)}</option>`;
    }).join("");

    return `
      <header class="menu-header compact sp-header">
        <div class="sp-header-row">
          <div class="sp-header-titles">
            <button type="button" class="menu-back" data-action="goto" data-screen="main">← Back</button>
            <h1 class="menu-title">Singleplayer</h1>
          </div>
          <div class="sp-header-links">
            <button type="button" class="menu-btn small ghost" data-action="goto" data-screen="barracks">Barracks</button>
            <button type="button" class="menu-btn small ghost" data-action="goto" data-screen="ai-lab">AI Lab</button>
          </div>
        </div>
        <div class="sp-stat-strip" aria-label="Progress">
          <div class="sp-stat crest">
            <span class="sp-stat-label">Crests</span>
            <strong>${meta.crests}</strong>
          </div>
          <div class="sp-stat">
            <span class="sp-stat-label">Wins</span>
            <strong>${meta.totalWins}</strong>
          </div>
          <div class="sp-stat">
            <span class="sp-stat-label">Best wave</span>
            <strong>${meta.bestWave}</strong>
          </div>
          <div class="sp-stat">
            <span class="sp-stat-label">Max Asc</span>
            <strong>A${meta.ascensionUnlocked}</strong>
          </div>
        </div>
      </header>

      <section class="sp-setup">
        <h2 class="sp-setup-title">Run setup</h2>
        <div class="run-grid cols-3">
          <label class="run-field">
            <span>Map</span>
            <select data-field="sp-map">${mapOpts}</select>
          </label>
          <label class="run-field">
            <span>Ascension</span>
            <select data-field="sp-ascension">${ascOpts}</select>
          </label>
          <label class="run-field">
            <span>Opponent AI</span>
            <select data-field="sp-opponent-ai">${aiOpts}</select>
          </label>
        </div>
        ${this.runOptionsFields("sp")}
      </section>

      <section class="sp-heroes">
        <h2 class="sp-heroes-title">Hero</h2>
        <div class="hero-grid compact">${cards}</div>
        <div id="sp-hero-detail" class="sp-hero-detail">${this.spHeroDetailHtml()}</div>
      </section>

      <div class="menu-footer sp-footer">
        <button type="button" class="menu-btn primary wide" data-action="play-sp">Play · ${escapeHtml(ascensionLabel(this.spAscension))}</button>
      </div>
    `;
  }

  private renderMultiplayer(): string {
    const modes = MODE_OPTIONS.map((m) => {
      const on = this.lobby.mode === m.id;
      return `
        <button type="button" class="choice-card ${on ? "selected" : ""}" data-action="set-mode" data-mode="${m.id}">
          <strong>${escapeHtml(m.label)}</strong>
          <span>${escapeHtml(m.hint)}</span>
        </button>
      `;
    }).join("");

    return `
      <header class="menu-header compact">
        <button type="button" class="menu-back" data-action="goto" data-screen="main">← Back</button>
        <h1 class="menu-title">Multiplayer</h1>
        <p class="menu-lead">PeerJS lobbies — private codes or public find-match.</p>
      </header>
      <section class="menu-section">
        <h2>Mode</h2>
        <div class="choice-grid">${modes}</div>
      </section>
      <section class="menu-section">
        <h2>Lobby</h2>
        <div class="choice-row">
          <button type="button" class="chip ${this.lobby.privacy === "private" ? "selected" : ""}" data-action="set-privacy" data-privacy="private">Private</button>
          <button type="button" class="chip ${this.lobby.privacy === "public" ? "selected" : ""}" data-action="set-privacy" data-privacy="public">Public</button>
        </div>
        <div class="choice-row">
          <button type="button" class="chip ${this.lobby.role === "host" ? "selected" : ""}" data-action="set-role" data-role="host">Host</button>
          <button type="button" class="chip ${this.lobby.role === "join" ? "selected" : ""}" data-action="set-role" data-role="join">Join</button>
        </div>
      </section>
      ${this.renderLobbyDetails()}
      <div class="menu-footer">
        <button type="button" class="menu-btn primary wide" data-action="mp-continue">Go online</button>
      </div>
    `;
  }

  private renderLobbyDetails(): string {
    if (this.lobby.privacy === "public") {
      return `
        <section class="menu-section muted-box">
          <p>Public matchmaking will search for an open ${escapeHtml(labelForMode(this.lobby.mode))} lobby.</p>
          <button type="button" class="menu-btn" data-action="mp-connect">${this.lobby.role === "host" ? "Create public lobby" : "Find match"}</button>
        </section>
      `;
    }
    if (this.lobby.role === "host") {
      return `
        <section class="menu-section muted-box">
          <p>Share this lobby code with friends:</p>
          <div class="code-row">
            <code class="lobby-code">${escapeHtml(this.lobby.hostCode)}</code>
            <button type="button" class="menu-btn small" data-action="copy-code">Copy</button>
            <button type="button" class="menu-btn small ghost" data-action="regen-code">New</button>
          </div>
        </section>
      `;
    }
    return `
      <section class="menu-section muted-box">
        <label class="field-label" for="join-code">Enter host lobby code</label>
        <input id="join-code" class="menu-input" data-field="join-code" maxlength="8" value="${escapeHtml(this.lobby.joinCode)}" placeholder="ABC123" autocomplete="off" spellcheck="false" />
      </section>
    `;
  }

  private renderMpOptions(): string {
    const mapChips = [
      `<button type="button" class="chip ${this.lobby.mapChoice === "random" ? "selected" : ""}" data-action="set-mp-map" data-map-id="random">Random</button>`,
      ...MAP_LIST.map(
        (m) =>
          `<button type="button" class="chip ${this.lobby.mapChoice === m.id ? "selected" : ""}" data-action="set-mp-map" data-map-id="${m.id}" title="${escapeHtml(m.blurb)}">${escapeHtml(m.name)}</button>`,
      ),
    ].join("");

    const hostBits =
      this.lobby.role === "host"
        ? `
          <section class="menu-section muted-box">
            <h2>Game Options</h2>
            <p class="menu-note">Host-only — applied when the match starts.</p>
            <h3 class="comp-subhead">Map</h3>
            <div class="choice-row wrap">${mapChips}</div>
            ${this.runOptionsFields("mp")}
          </section>
        `
        : `
          <section class="menu-section muted-box">
            <p>Waiting for host… Game options are host-only.</p>
          </section>
        `;

    return `
      <header class="menu-header compact">
        <button type="button" class="menu-back" data-action="goto" data-screen="multiplayer">← Back</button>
        <h1 class="menu-title">Lobby</h1>
        <p class="menu-lead">Confirm mode and run options, then go online.</p>
      </header>
      <div class="choice-row wrap" style="margin-bottom:1rem">
        <span class="chip selected">${escapeHtml(labelForMode(this.lobby.mode))}</span>
        <span class="chip">${escapeHtml(capitalize(this.lobby.privacy))}</span>
        <span class="chip">${escapeHtml(capitalize(this.lobby.role))}</span>
      </div>
      ${hostBits}
      <div class="menu-footer stack">
        <button type="button" class="menu-btn primary wide" data-action="mp-connect">
          ${this.lobby.role === "host" ? "Open online lobby" : "Join online lobby"}
        </button>
        <p class="menu-note">PeerJS relay · host simulates both lanes.</p>
      </div>
    `;
  }

  private matchesFilter(name: string, blurb: string, rarity?: Rarity): boolean {
    const q = this.compSearch.trim().toLowerCase();
    if (q) {
      const hay = `${name} ${blurb} ${rarity ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (this.compRarity !== "all" && rarity && rarity !== this.compRarity) return false;
    return true;
  }

  private rarityBadge(r: Rarity): string {
    return `<span class="rarity-badge" style="color:${RARITY_COLOR[r]}">${RARITY_LABEL[r]}</span>`;
  }

  private compendiumContent(): string {
    const kb = this.settings.keybinds;
    if (this.compendiumTab === "heroes") {
      const cards = HERO_LIST.filter((h) => this.matchesFilter(h.name, h.blurb + " " + h.passive.blurb))
        .map((h) => {
          const [mobility, ultimate] = h.abilities;
          return `
        <article class="comp-card hero-comp">
          <div class="comp-card-top">
            <span class="comp-swatch" style="background:${h.color}"></span>
            <div>
              <h3>${escapeHtml(h.name)}</h3>
              <p class="comp-meta">HP ${h.maxHp} · Spd ${h.speed} · Atk ${h.attackDamage}</p>
            </div>
          </div>
          <p>${escapeHtml(h.blurb)}</p>
          <ul class="comp-ability-list">
            <li><strong>Passive — ${escapeHtml(h.passive.name)}</strong><span>${escapeHtml(h.passive.blurb)}</span></li>
            <li><strong>${formatBinding(kb.attack)}</strong><span>${escapeHtml(h.attackHint)}</span></li>
            <li><strong>${formatBinding(kb.mobility)} ${escapeHtml(mobility.name)}</strong><span>${escapeHtml(mobility.hint)}</span></li>
            <li><strong>${formatBinding(kb.ultimate)} ${escapeHtml(ultimate.name)}</strong><span>${escapeHtml(ultimate.hint)}</span></li>
          </ul>
        </article>`;
        })
        .join("");
      return `<div class="comp-grid heroes">${cards || emptyComp()}</div>`;
    }
    if (this.compendiumTab === "items") {
      let items = SHOP_ITEMS.filter((i) => this.matchesFilter(i.name, i.effect, i.rarity));
      items = sortByRarityOrName(items, this.compSort, (i) => i.rarity, (i) => i.name);
      const byCat = new Map<string, typeof items>();
      for (const i of items) {
        const list = byCat.get(i.category) ?? [];
        list.push(i);
        byCat.set(i.category, list);
      }
      const sections = [...byCat.entries()]
        .map(([cat, list]) => {
          const cards = list
            .map(
              (i) => `
            <article class="comp-card compact">
              ${this.rarityBadge(i.rarity)}
              <h3>${escapeHtml(i.name)}</h3>
              <p>${escapeHtml(i.effect)}</p>
              <p class="comp-meta">${i.cost}g · max ×${i.maxStacks}</p>
            </article>`,
            )
            .join("");
          return `<section class="comp-section"><h2 class="comp-section-title">${escapeHtml(capitalize(cat))}</h2><div class="comp-grid">${cards}</div></section>`;
        })
        .join("");
      return sections || emptyComp();
    }
    if (this.compendiumTab === "relics") {
      let relics = RELIC_LIST.filter((r) => this.matchesFilter(r.name, r.blurb, r.rarity));
      relics = sortByRarityOrName(relics, this.compSort, (r) => r.rarity, (r) => r.name);
      const cards = relics
        .map(
          (r) => `
        <article class="comp-card compact">
          ${this.rarityBadge(r.rarity)}
          <h3>${escapeHtml(r.name)}</h3>
          <p>${escapeHtml(r.blurb)}</p>
          <p class="comp-meta">${escapeHtml(r.tag)} · after elite/boss</p>
        </article>`,
        )
        .join("");
      return `<div class="comp-grid">${cards || emptyComp()}</div>`;
    }
    if (this.compendiumTab === "enemies") {
      const byRole = new Map<string, EnemyKind[]>();
      for (const k of ENEMY_KINDS) {
        const d = ENEMY_DEFS[k];
        if (!this.matchesFilter(d.name, `${d.intent} ${d.kind}`)) continue;
        const list = byRole.get(d.kind) ?? [];
        list.push(k);
        byRole.set(d.kind, list);
      }
      const sections = [...byRole.entries()]
        .map(([role, kinds]) => {
          const cards = kinds
            .map((k) => {
              const d = ENEMY_DEFS[k];
              return `
            <article class="comp-card compact">
              <h3>${escapeHtml(d.name)}</h3>
              <p>Intent: <strong>${escapeHtml(d.intent)}</strong>${d.ranged ? " · ranged" : ""}${d.dashSpeed ? " · dash" : ""}${d.projectileAoe ? " · AoE shell" : ""}</p>
              <p class="comp-meta">HP ${d.maxHp} · Spd ${d.speed} · Contact ${d.contactDamage}/s${d.attackDamage ? ` · Shot ${d.attackDamage}` : ""} · Gold ${d.goldReward}</p>
            </article>`;
            })
            .join("");
          return `<section class="comp-section"><h2 class="comp-section-title">${escapeHtml(capitalize(role))}</h2><div class="comp-grid">${cards}</div></section>`;
        })
        .join("");
      return sections || emptyComp();
    }
    if (this.compendiumTab === "sends") {
      const cards = SEND_PACKS.filter((p) => this.matchesFilter(p.name, p.detail))
        .map(
          (p) => `
          <article class="comp-card compact">
            <h3>${escapeHtml(p.name)}</h3>
            <p>${escapeHtml(p.detail)}</p>
            <p class="comp-meta">${p.cost}g · key ${p.digit} · Base Lv ${p.minBaseLevel}+ · ${p.enemies} creeps · +${p.incomeBonus}/s</p>
          </article>`,
        )
        .join("");
      return `<div class="comp-grid">${cards || emptyComp()}</div>`;
    }
    const cards = MAP_LIST.filter((m) => this.matchesFilter(m.name, m.blurb))
      .map(
        (m) => `
        <article class="comp-card map-comp">
          <div class="map-thumb"><canvas data-map="${m.id}"></canvas></div>
          <h3>${escapeHtml(m.name)}${m.shiftingObstacles ? ` <em class="special-tag">Special</em>` : ""}</h3>
          <p>${escapeHtml(m.blurb)}</p>
          <p class="comp-meta">Obstacles ${m.obstacles.length} · High grounds ${m.highGrounds.length} · Turrets ${m.turretSlots.length}</p>
        </article>`,
      )
      .join("");
    return `<div class="comp-grid maps">${cards || emptyComp()}</div>`;
  }

  private renderCompendium(): string {
    const tabs = (["heroes", "items", "relics", "enemies", "sends", "maps"] as const)
      .map(
        (tab) => `
        <button type="button" class="chip ${this.compendiumTab === tab ? "selected" : ""}" data-action="comp-tab" data-tab="${tab}">
          ${capitalize(tab)}
        </button>`,
      )
      .join("");

    const showRarity = this.compendiumTab === "items" || this.compendiumTab === "relics";
    const rarityOpts = [
      `<option value="all"${this.compRarity === "all" ? " selected" : ""}>All rarities</option>`,
      ...RARITY_ORDER.map(
        (r) =>
          `<option value="${r}"${this.compRarity === r ? " selected" : ""}>${RARITY_LABEL[r]}</option>`,
      ),
    ].join("");

    return `
      <header class="menu-header compact">
        <button type="button" class="menu-back" data-action="goto" data-screen="main">← Back</button>
        <h1 class="menu-title">Compendium</h1>
        <p class="menu-lead">Browse heroes, items, relics, enemies, and maps.</p>
      </header>
      <div class="choice-row">${tabs}</div>
      <div class="comp-toolbar">
        <input class="comp-search" data-field="comp-search" placeholder="Search…" value="${escapeHtml(this.compSearch)}" />
        ${
          showRarity
            ? `<select class="comp-select" data-field="comp-rarity">${rarityOpts}</select>
               <select class="comp-select" data-field="comp-sort">
                 <option value="rarity"${this.compSort === "rarity" ? " selected" : ""}>Sort: rarity</option>
                 <option value="name"${this.compSort === "name" ? " selected" : ""}>Sort: name</option>
               </select>`
            : ""
        }
      </div>
      <div class="comp-list">${this.compendiumContent()}</div>
    `;
  }

  private renderGameInfo(): string {
    return `
      <header class="menu-header compact">
        <button type="button" class="menu-back" data-action="goto" data-screen="main">← Back</button>
        <h1 class="menu-title">Game Info</h1>
        <p class="menu-lead">How the lane, sends, and combat loop work.</p>
      </header>
      <div class="info-stack">
        <section class="info-block">
          <h2>The line</h2>
          <p>You defend your <strong>base</strong> on the left. Enemies spawn on the right and march toward you. Survive waves, spend gold, and outlast the enemy lane.</p>
        </section>
        <section class="info-block highlight">
          <h2>Sending enemies (the core loop)</h2>
          <p>Gold buys <strong>send packs</strong> (keys 1–3, or the send bar). Sending does two things:</p>
          <ul>
            <li><strong>Raises your income</strong> permanently for the run (+gold/sec).</li>
            <li><strong>Adds those creeps to the enemy's next wave</strong> — pressuring their hero and base.</li>
          </ul>
          <p>The AI opponent does the same to you. Spending on sends is how you snowball economy <em>and</em> attack the other lane.</p>
        </section>
        <section class="info-block">
          <h2>Shop, base, relics</h2>
          <p>Walk to the shop pad and press <strong>F</strong>. Upgrade Base (<strong>U</strong>) unlocks stronger packs. After elite/boss waves, draft a relic. Level-ups offer passive drafts.</p>
        </section>
        <section class="info-block">
          <h2>Combat</h2>
          <p>WASD to move. Hold attack and <strong>aim with the mouse</strong> (Prism auto-aims his beam). Mobility and ultimate are mouse-bound by default (RMB / MMB).</p>
        </section>
        <section class="info-block">
          <h2>Enemy lane panel</h2>
          <p>Top-right shows opponent HP, level, income, fight status, and whether they are sending — without leaving your lane. <strong>View lane</strong> toggles a full flip to their lane; toggle again to return.</p>
        </section>
      </div>
    `;
  }

  private renderSettings(): string {
    const s = this.settings;
    const fxOpts = (["full", "reduced", "off"] as DamageScreenFx[])
      .map(
        (v) =>
          `<option value="${v}"${s.damageScreenFx === v ? " selected" : ""}>${DAMAGE_FX_LABELS[v]}</option>`,
      )
      .join("");
    return `
      <header class="menu-header compact">
        <button type="button" class="menu-back" data-action="goto" data-screen="main">← Back</button>
        <h1 class="menu-title">Settings</h1>
        <p class="menu-lead">Client preferences — saved in this browser.</p>
      </header>
      <section class="menu-section settings-list">
        <button type="button" class="setting-row setting-nav" data-action="goto" data-screen="controls">
          <span>Controls<em>Remap mouse / keys</em></span>
          <span class="chevron">›</span>
        </button>
        <label class="setting-row">
          <span>Master volume <em id="volume-label">${Math.round(s.masterVolume * 100)}%</em></span>
          <input type="range" min="0" max="1" step="0.05" value="${s.masterVolume}" data-field="volume" />
        </label>
        <label class="setting-row check">
          <span>Show damage numbers</span>
          <input type="checkbox" data-setting="showDamageNumbers" ${s.showDamageNumbers ? "checked" : ""} />
        </label>
        <label class="setting-row">
          <span>Damage screen effects<em>Flash / vignette / shake intensity</em></span>
          <select data-field="damage-fx">${fxOpts}</select>
        </label>
        <label class="setting-row check">
          <span>Screen shake</span>
          <input type="checkbox" data-setting="screenShake" ${s.screenShake ? "checked" : ""} />
        </label>
        <label class="setting-row check">
          <span>Reduce motion</span>
          <input type="checkbox" data-setting="reduceMotion" ${s.reduceMotion ? "checked" : ""} />
        </label>
      </section>
      <div class="menu-footer">
        <button type="button" class="menu-btn ghost" data-action="reset-settings">Reset to defaults</button>
      </div>
    `;
  }

  private renderControls(): string {
    const rows = COMBAT_ACTIONS.map((action) => {
      const listening = this.rebinding === action;
      const bind = this.settings.keybinds[action];
      return `
        <div class="setting-row bind-row ${listening ? "listening" : ""}">
          <span>
            <strong>${ACTION_LABELS[action]}</strong>
            <em>${ACTION_HINTS[action]}</em>
          </span>
          <button type="button" class="bind-btn" data-action="rebind" data-bind="${action}">
            ${listening ? "Press key / mouse…" : formatBinding(bind)}
          </button>
        </div>
      `;
    }).join("");

    return `
      <header class="menu-header compact">
        <button type="button" class="menu-back" data-action="goto" data-screen="settings">← Back</button>
        <h1 class="menu-title">Controls</h1>
        <p class="menu-lead">Defaults: LMB attack, RMB mobility, MMB ultimate.</p>
      </header>
      <section class="menu-section settings-list">
        ${rows}
      </section>
      ${
        this.rebinding
          ? `<p class="menu-footnote">Listening… Esc to cancel.</p>`
          : `<div class="menu-footer"><button type="button" class="menu-btn ghost" data-action="reset-binds">Reset mouse defaults</button></div>`
      }
    `;
  }

  private renderAiLab(): string {
    const store = loadAiStore();
    const prog = this.trainProgress;
    const recipeOpts = Object.values(RECIPES)
      .map((r) => `<option value="${r.id}">${escapeHtml(r.name)} — ${escapeHtml(r.desc)}</option>`)
      .join("");
    const oppOpts = aiSelectOptions(store, store.selected);
    const schools =
      store.schools.length === 0
        ? `<p class="menu-note">No trained schools yet — Classic AI will be used.</p>`
        : store.schools
            .map((s) => {
              let gen = "?";
              try {
                gen = String((JSON.parse(s.champion) as { gen?: number }).gen ?? "?");
              } catch {
                /* ignore */
              }
              return `
            <div class="history-row">
              <strong>${escapeHtml(s.name)}</strong>
              <span>${escapeHtml(s.recipe)} · gen ${escapeHtml(gen)} · ${escapeHtml(new Date(s.trainedAt).toLocaleDateString())}
                <button type="button" class="menu-btn ghost" data-action="ai-del-school" data-school="${escapeHtml(s.name)}" style="padding:0.2rem 0.5rem;margin-left:0.5rem">Delete</button>
              </span>
            </div>`;
            })
            .join("");

    return `
      <header class="menu-header compact">
        <button type="button" class="menu-back" data-action="goto" data-screen="main">← Back</button>
        <h1 class="menu-title">AI Lab</h1>
        <p class="menu-lead">Train brains on unlimited-wave duels. Checkpoints become difficulty tiers.</p>
      </header>

      <section class="menu-section muted-box">
        <h2>Opponent for matches</h2>
        <label class="setting-row">
          <span>Selected AI</span>
          <select data-field="ai-opponent">${oppOpts}</select>
        </label>
      </section>

      <section class="menu-section muted-box">
        <h2>Train</h2>
        <label class="setting-row">
          <span>Recipe</span>
          <select id="ai-recipe">${recipeOpts}</select>
        </label>
        <div class="choice-row wrap" style="gap:0.75rem">
          <label class="setting-row" style="flex:1;min-width:5rem">
            <span>Gens</span>
            <input type="number" id="ai-gens" min="3" max="40" value="10" />
          </label>
          <label class="setting-row" style="flex:1;min-width:5rem">
            <span>Pop</span>
            <input type="number" id="ai-pop" min="4" max="24" value="8" />
          </label>
          <label class="setting-row" style="flex:1;min-width:5rem">
            <span>Trials</span>
            <input type="number" id="ai-trials" min="1" max="6" value="2" />
          </label>
          <label class="setting-row" style="flex:1;min-width:5rem">
            <span>Duel cap (s)</span>
            <input type="number" id="ai-seconds" min="60" max="400" value="180" />
          </label>
        </div>
        <label class="setting-row">
          <span>School name</span>
          <input id="ai-name" maxlength="24" value="balanced" />
        </label>
        <p class="menu-note" id="ai-status">${escapeHtml(
          prog
            ? prog.message
            : store.schools.length
              ? `${store.schools.length} school(s) saved.`
              : "No trained schools yet — Classic AI will be used.",
        )}</p>
        <div class="choice-row">
          <button type="button" class="menu-btn primary" id="ai-start" data-action="ai-start" ${isTraining() ? "disabled" : ""}>Start training</button>
          <button type="button" class="menu-btn" id="ai-stop" data-action="ai-stop" ${isTraining() ? "" : "disabled"}>Stop</button>
        </div>
      </section>

      <section class="menu-section">
        <h2>Schools</h2>
        <div class="history-list">${schools}</div>
      </section>
    `;
  }

  private renderBarracks(): string {
    const store = loadMetaStore();
    const rows = META_UPGRADES.map((u) => {
      const rank = getRank(store, u.id);
      const cost = nextCost(u.id, rank);
      const maxed = cost == null;
      const canBuy = !maxed && store.crests >= cost!;
      const rankLabel = u.kind === "unlock" ? (rank >= 1 ? "Owned" : "Locked") : `Rank ${rank}/${u.maxRank}`;
      return `
        <div class="meta-row">
          <div>
            <strong>${escapeHtml(u.name)}</strong>
            <span class="stat-hint">${escapeHtml(u.blurb)}</span>
            <em>${escapeHtml(rankLabel)}</em>
          </div>
          <button type="button" class="menu-btn ${canBuy ? "primary" : ""}" data-action="buy-meta" data-upgrade-id="${u.id}" ${maxed || !canBuy ? "disabled" : ""}>
            ${maxed ? "Max" : `${cost} crests`}
          </button>
        </div>`;
    }).join("");

    const ascName = ASCENSIONS.find((a) => a.level === store.ascensionUnlocked)?.name ?? "Standard";

    return `
      <header class="menu-header compact">
        <button type="button" class="menu-back" data-action="goto" data-screen="main">← Back</button>
        <h1 class="menu-title">Barracks</h1>
        <p class="menu-lead">Permanent upgrades bought with War Crests.</p>
      </header>
      <div class="menu-hero-stats" aria-label="Progression summary">
        <div class="stat-tile stat-crest">
          <p class="stat-label">War Crests</p>
          <p class="stat-value">${store.crests}</p>
          <p class="stat-hint">Spend below · earn on run end</p>
        </div>
        <div class="stat-tile">
          <p class="stat-label">Wins</p>
          <p class="stat-value">${store.totalWins}</p>
          <p class="stat-hint">${store.totalRuns} runs total</p>
        </div>
        <div class="stat-tile">
          <p class="stat-label">Best wave</p>
          <p class="stat-value">${store.bestWave}</p>
          <p class="stat-hint">Highest reached</p>
        </div>
        <div class="stat-tile">
          <p class="stat-label">Ascension</p>
          <p class="stat-value">A${store.ascensionUnlocked}</p>
          <p class="stat-hint">${escapeHtml(ascName)} unlocked</p>
        </div>
      </div>
      <section class="menu-section muted-box meta-list">
        <h2>Upgrades</h2>
        ${rows}
      </section>
      <p class="menu-note">Win at your highest Ascension to unlock the next. Crest payouts scale with waves, sends, and Ascension.</p>
    `;
  }
}

function aiSelectOptions(store: AiStore, selected: AiSelection): string {
  const classic = `<option value="classic" ${selected.kind === "classic" ? "selected" : ""}>Classic (abstract)</option>`;
  const schools = store.schools
    .map((s) => {
      const tiers = ["rookie", "steady", "sharp", "brutal"] as const;
      return tiers
        .map((tier) => {
          const val = `${s.name}::${tier}`;
          const sel =
            selected.kind === "neural" && selected.school === s.name && selected.tier === tier
              ? "selected"
              : "";
          return `<option value="${escapeHtml(val)}" ${sel}>${escapeHtml(s.name)} · ${tier}</option>`;
        })
        .join("");
    })
    .join("");
  return classic + schools;
}

function parseAiSelectValue(v: string): AiSelection {
  if (v === "classic") return { kind: "classic" };
  const [school, tier] = v.split("::");
  if (school && (tier === "rookie" || tier === "steady" || tier === "sharp" || tier === "brutal")) {
    return { kind: "neural", school, tier };
  }
  return { kind: "classic" };
}

function sortByRarityOrName<T>(
  items: T[],
  sort: "name" | "rarity",
  rarityOf: (t: T) => Rarity,
  nameOf: (t: T) => string,
): T[] {
  const copy = [...items];
  copy.sort((a, b) => {
    if (sort === "name") return nameOf(a).localeCompare(nameOf(b));
    const dr = RARITY_ORDER.indexOf(rarityOf(a)) - RARITY_ORDER.indexOf(rarityOf(b));
    if (dr !== 0) return dr;
    return nameOf(a).localeCompare(nameOf(b));
  });
  return copy;
}

function labelForMode(mode: MatchMode): string {
  return MODE_OPTIONS.find((m) => m.id === mode)?.label ?? mode;
}

function capitalize(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function emptyComp(): string {
  return `<p class="comp-empty">No entries match.</p>`;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
