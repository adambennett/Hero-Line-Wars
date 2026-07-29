import { HERO_LIST, type HeroId } from "../data/heroes";
import { MAP_LIST, type MapId } from "../data/maps";
import { RELIC_LIST } from "../data/relics";
import { SHOP_ITEMS } from "../data/shop";
import { SEND_PACKS } from "../data/send";
import { ENEMY_DEFS, type EnemyKind } from "../data/enemies";
import { RARITY_LABEL, RARITY_COLOR, RARITY_ORDER, type Rarity } from "../data/rarity";
import { DEFAULT_MAX_TURRETS } from "../data/turrets";
import type { RunOptions } from "../game/state";
import {
  ACTION_HINTS,
  ACTION_LABELS,
  DEFAULT_KEYBINDS,
  bindingEquals,
  formatBinding,
  loadSettings,
  saveSettings,
  type Binding,
  type ClientSettings,
  type CombatAction,
} from "./settings";

export type MenuScreen =
  | "main"
  | "singleplayer"
  | "multiplayer"
  | "mp-options"
  | "compendium"
  | "settings"
  | "controls";

export type MatchMode = "1v1" | "2v2" | "3v3" | "2p-pve" | "3p-pve";
export type MatchPrivacy = "private" | "public";
export type MatchRole = "host" | "join";

export type LobbyDraft = {
  mode: MatchMode;
  privacy: MatchPrivacy;
  role: MatchRole;
  joinCode: string;
  hostCode: string;
  mapChoice: MapId | "random";
  maxTurrets: number;
};

export type MenuCallbacks = {
  onStartSingleplayer: (heroId: HeroId, opts?: Partial<RunOptions>) => void;
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
  };
  private spMapChoice: MapId | "random" = "random";
  private settings: ClientSettings = loadSettings();
  private compendiumTab: CompTab = "heroes";
  private compSearch = "";
  private compRarity: Rarity | "all" = "all";
  private compSort: "name" | "rarity" = "rarity";
  private toast = "";
  private rebinding: CombatAction | null = null;
  private unbindListen: (() => void) | null = null;

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
        this.go(t.dataset.screen as MenuScreen);
        break;
      case "quit":
        this.quit();
        break;
      case "pick-hero":
        this.selectedHero = t.dataset.heroId as HeroId;
        this.render();
        break;
      case "play-sp":
        this.callbacks.onStartSingleplayer(this.selectedHero, {
          mapId: this.spMapChoice,
          maxTurrets: DEFAULT_MAX_TURRETS,
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
        this.go("mp-options");
        break;
      case "mp-stub":
        this.setToast("Online play is not wired up yet — lobby UI only.");
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
      this.callbacks.onRunOptionsChanged?.({
        mapId: this.lobby.mapChoice,
        maxTurrets: this.lobby.maxTurrets,
      });
      const label = this.root.querySelector("#turret-cap-label");
      if (label) label.textContent = String(this.lobby.maxTurrets);
    }
    if (el.dataset.field === "comp-search") {
      this.compSearch = el.value;
      this.renderCompendiumListOnly();
    }
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
    } else if (el.dataset.field === "comp-rarity") {
      this.compRarity = el.value as Rarity | "all";
      this.renderCompendiumListOnly();
    } else if (el.dataset.field === "comp-sort") {
      this.compSort = el.value as "name" | "rarity";
      this.renderCompendiumListOnly();
    }
  }

  private quit(): void {
    window.close();
    this.setToast("Close this tab to quit (browser blocked auto-close).");
  }

  private render(): void {
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
      case "settings":
        body = this.renderSettings();
        break;
      case "controls":
        body = this.renderControls();
        break;
    }

    this.root.innerHTML = `
      <div class="menu-backdrop"></div>
      <div class="menu-shell">
        ${body}
        ${toastHtml}
      </div>
    `;

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
      const sx = w / 1600;
      const sy = h / 560;
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
        <button type="button" class="menu-btn" data-action="goto" data-screen="compendium">Compendium</button>
        <button type="button" class="menu-btn" data-action="goto" data-screen="settings">Settings</button>
        <button type="button" class="menu-btn ghost" data-action="quit">Quit</button>
      </nav>
    `;
  }

  private renderSingleplayer(): string {
    const kb = this.settings.keybinds;
    const cards = HERO_LIST.map((h) => {
      const selected = h.id === this.selectedHero;
      const [mobility, ultimate] = h.abilities;
      return `
        <button type="button" class="hero-card ${selected ? "selected" : ""}" data-action="pick-hero" data-hero-id="${h.id}">
          <span class="hero-swatch" style="--hero:${h.color}"></span>
          <strong>${escapeHtml(h.name)}</strong>
          <span>${escapeHtml(h.blurb)}</span>
          <ul class="hero-abilities">
            <li><em>Passive</em> ${escapeHtml(h.passive.name)} — ${escapeHtml(h.passive.blurb)}</li>
            <li><kbd>${formatBinding(kb.attack)}</kbd> ${escapeHtml(h.attackHint)}</li>
            <li><kbd>${formatBinding(kb.mobility)}</kbd> ${escapeHtml(mobility.name)}</li>
            <li><kbd>${formatBinding(kb.ultimate)}</kbd> ${escapeHtml(ultimate.name)}</li>
          </ul>
        </button>
      `;
    }).join("");

    const mapChips = [
      `<button type="button" class="chip ${this.spMapChoice === "random" ? "selected" : ""}" data-action="set-sp-map" data-map-id="random">Random</button>`,
      ...MAP_LIST.map(
        (m) =>
          `<button type="button" class="chip ${this.spMapChoice === m.id ? "selected" : ""}" data-action="set-sp-map" data-map-id="${m.id}">${escapeHtml(m.name)}</button>`,
      ),
    ].join("");

    return `
      <header class="menu-header compact">
        <button type="button" class="menu-back" data-action="goto" data-screen="main">← Back</button>
        <h1 class="menu-title">Singleplayer</h1>
        <p class="menu-sub">Choose a hero. Map defaults to random each run.</p>
      </header>
      <section class="menu-section">
        <h2>Map</h2>
        <div class="choice-row wrap">${mapChips}</div>
      </section>
      <div class="hero-grid">${cards}</div>
      <div class="menu-footer">
        <button type="button" class="menu-btn primary wide" data-action="play-sp">Play</button>
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
        <p class="menu-sub">Lobby setup only for now — networking comes later.</p>
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
        <button type="button" class="menu-btn primary wide" data-action="mp-continue">Continue</button>
      </div>
    `;
  }

  private renderLobbyDetails(): string {
    if (this.lobby.privacy === "public") {
      return `
        <section class="menu-section muted-box">
          <p>Public matchmaking will search for an open ${escapeHtml(labelForMode(this.lobby.mode))} lobby.</p>
          <button type="button" class="menu-btn" data-action="mp-stub">${this.lobby.role === "host" ? "Create public lobby" : "Find match"}</button>
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
    const summary = `${labelForMode(this.lobby.mode)} · ${capitalize(this.lobby.privacy)} · ${capitalize(this.lobby.role)}`;
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
            <p class="menu-sub">Host-only run settings (stored for when online play lands).</p>
            <h3 class="comp-subhead">Map</h3>
            <div class="choice-row wrap">${mapChips}</div>
            <label class="setting-row">
              <span>Max turrets <em id="turret-cap-label">${this.lobby.maxTurrets}</em></span>
              <input type="range" min="1" max="6" step="1" value="${this.lobby.maxTurrets}" data-field="mp-turrets" />
            </label>
            <label class="setting-row"><span>Starting gold</span><select disabled><option>45 (default)</option><option>80</option></select></label>
            <label class="setting-row"><span>Waves to win</span><select disabled><option>10</option><option>8</option><option>12</option></select></label>
            <label class="setting-row"><span>Friendly fire</span><select disabled><option>Off</option><option>On</option></select></label>
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
        <p class="menu-sub">${escapeHtml(summary)}</p>
      </header>
      ${hostBits}
      <div class="menu-footer stack">
        <button type="button" class="menu-btn primary wide" data-action="mp-stub">
          ${this.lobby.role === "host" ? "Start lobby" : "Join lobby"}
        </button>
        <p class="menu-footnote">Online sessions are not connected yet.</p>
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
      return HERO_LIST.filter((h) => this.matchesFilter(h.name, h.blurb + " " + h.passive.blurb))
        .map((h) => {
          const [mobility, ultimate] = h.abilities;
          return `
        <article class="comp-card">
          <h3>${escapeHtml(h.name)}</h3>
          <p>${escapeHtml(h.blurb)}</p>
          <p class="comp-meta">HP ${h.maxHp} · Speed ${h.speed} · Atk ${h.attackDamage}</p>
          <ul>
            <li><strong>Passive — ${escapeHtml(h.passive.name)}</strong> — ${escapeHtml(h.passive.blurb)}</li>
            <li><strong>${formatBinding(kb.attack)} Attack</strong> — ${escapeHtml(h.attackHint)}</li>
            <li><strong>${formatBinding(kb.mobility)} ${escapeHtml(mobility.name)}</strong> — ${escapeHtml(mobility.hint)}</li>
            <li><strong>${formatBinding(kb.ultimate)} ${escapeHtml(ultimate.name)}</strong> — ${escapeHtml(ultimate.hint)}</li>
          </ul>
        </article>`;
        })
        .join("");
    }
    if (this.compendiumTab === "items") {
      let items = SHOP_ITEMS.filter((i) => this.matchesFilter(i.name, i.effect, i.rarity));
      items = sortByRarityOrName(items, this.compSort, (i) => i.rarity, (i) => i.name);
      return items
        .map(
          (i) => `
          <article class="comp-card">
            ${this.rarityBadge(i.rarity)}
            <h3>${escapeHtml(i.name)}</h3>
            <p>${escapeHtml(i.effect)}</p>
            <p class="comp-meta">${i.cost}g · max ×${i.maxStacks} · ${i.category}</p>
          </article>`,
        )
        .join("");
    }
    if (this.compendiumTab === "relics") {
      let relics = RELIC_LIST.filter((r) => this.matchesFilter(r.name, r.blurb, r.rarity));
      relics = sortByRarityOrName(relics, this.compSort, (r) => r.rarity, (r) => r.name);
      return relics
        .map(
          (r) => `
        <article class="comp-card">
          ${this.rarityBadge(r.rarity)}
          <h3>${escapeHtml(r.name)}</h3>
          <p>${escapeHtml(r.blurb)}</p>
          <p class="comp-meta">${escapeHtml(r.tag)} · draft after elite/boss waves</p>
        </article>`,
        )
        .join("");
    }
    if (this.compendiumTab === "enemies") {
      return ENEMY_KINDS.filter((k) => {
        const d = ENEMY_DEFS[k];
        return this.matchesFilter(d.name, `${d.intent} ${d.kind}`);
      })
        .map((k) => {
          const d = ENEMY_DEFS[k];
          return `
          <article class="comp-card">
            <h3>${escapeHtml(d.name)}</h3>
            <p>Intent: <strong>${escapeHtml(d.intent)}</strong> · Role ${escapeHtml(d.kind)}</p>
            <p class="comp-meta">HP ${d.maxHp} · Spd ${d.speed} · Contact ${d.contactDamage}/s · Base hit ${d.baseDamage} · Gold ${d.goldReward}${d.ranged ? ` · Ranged ${d.attackDamage}` : ""}${d.slamRadius ? ` · Slam r${d.slamRadius}` : ""}</p>
          </article>`;
        })
        .join("");
    }
    if (this.compendiumTab === "sends") {
      return SEND_PACKS.filter((p) => this.matchesFilter(p.name, p.detail))
        .map(
          (p) => `
          <article class="comp-card">
            <h3>${escapeHtml(p.name)}</h3>
            <p>${escapeHtml(p.detail)}</p>
            <p class="comp-meta">${p.cost}g base · hotkey ${p.digit} · unlock Base Lv ${p.minBaseLevel} · ${p.enemies} creeps · +${p.incomeBonus}/s · HP×${p.hpScale}</p>
          </article>`,
        )
        .join("");
    }
    return MAP_LIST.filter((m) => this.matchesFilter(m.name, m.blurb))
      .map(
        (m) => `
        <article class="comp-card">
          <div class="map-thumb"><canvas data-map="${m.id}"></canvas></div>
          <h3>${escapeHtml(m.name)}</h3>
          <p>${escapeHtml(m.blurb)}</p>
          <p class="comp-meta">Obstacles ${m.obstacles.length} · High grounds ${m.highGrounds.length} · Turret slots ${m.turretSlots.length}</p>
        </article>`,
      )
      .join("");
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
        <p class="menu-sub">Browse heroes, gear, relics, enemies, sends, and maps.</p>
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

  private renderSettings(): string {
    const s = this.settings;
    return `
      <header class="menu-header compact">
        <button type="button" class="menu-back" data-action="goto" data-screen="main">← Back</button>
        <h1 class="menu-title">Settings</h1>
        <p class="menu-sub">Client preferences (saved locally). Master volume also scales SFX.</p>
      </header>
      <section class="menu-section settings-list">
        <button type="button" class="setting-row linkish" data-action="goto" data-screen="controls">
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
        <p class="menu-sub">Defaults: LMB attack · RMB mobility · MMB ultimate. Click a binding to remap.</p>
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

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
