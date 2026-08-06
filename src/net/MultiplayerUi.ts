import {
  getGameType,
  gameTypeSelectHtml,
  gameTypeToMpExtras,
  listEnabledGameTypes,
  loadSelectedGameTypeId,
  saveSelectedGameTypeId,
} from "../meta/gameTypes";
import { gameTypeSummaryHtml } from "../ui/gameTypeSummary";
import {
  heroCardHtml,
  heroDetailForPick,
  heroPagerHtml,
  heroSelectPageCount,
  listHeroSelectEntries,
  RANDOM_HERO_ID,
  sliceHeroPage,
  type HeroPickId,
} from "../ui/heroSelect";
import { listCustomMaps, resolveHero, resolveMap } from "../custom/registry";
import { paintMapThumb } from "../ui/mapThumbs";
import { isCustomHeroId } from "../custom/types";
import { MainMenuFx } from "../ui/mainMenuFx";
import { loadSettings, syncMotionPreference } from "../ui/settings";
import { startMenuMusic } from "../systems/music";
import {
  bindHooks,
  canStartMatch,
  disconnectNet,
  findPublicMatch,
  getSession,
  hostAddAiSeat,
  hostRemoveAiSeat,
  hostReplaceAiSeats,
  hostSetMaxHumans,
  hostSetOpts,
  hostStartMatch,
  hostUpdateAiSeat,
  localPickHero,
  localReady,
  localSwitchTeam,
  localUnready,
  quickHost,
  quickJoin,
} from "./session";
import {
  lobbyBalanced,
  lobbyCombatantCount,
  lobbyFull,
  lobbyReadyCount,
  lobbySeat,
  lobbyTeamCount,
  MAX_TEAM_COMBATANTS,
  newAiSeat,
} from "./lobby";
import type {
  LobbyAiHeroPick,
  LobbyAiKind,
  LobbyAiSeat,
  LobbyState,
  MatchMode,
  MatchPrivacy,
  MpRunExtras,
  MpTeam,
  NetMode,
  NetMsg,
} from "./types";
import { clampMaxHumans, isPveMode, lobbyHumanCap, modeFromMaxHumans } from "./types";
import { aiKindOptionsHtml, aiKindLabel, parseAiKindValue } from "../ai/lobbyAi";
import { loadAiStore } from "../ai/store";
import type { HeroId } from "../data/heroes";
import { HERO_LIST } from "../data/heroes";
import { isHeroUnlocked, loadMetaStore } from "../meta/store";
import { ASCENSIONS } from "../meta/ascension";
import { MAP_LIST, resolveMapChoice, type MapId } from "../data/maps";
import { STARTING_GOLD, WIN_WAVES } from "../data/constants";
import { isMapUnlocked } from "../meta/contentLocks";
import { enabledMapIds, isIdEnabled } from "../meta/contentFilters";
import {
  pickOne,
  RUN_OPTION_DEFAULTS,
  runTip,
  type RunOptionTipKey,
} from "../ui/runOptionsMeta";

export type MpUiCallbacks = {
  onBack: () => void;
  onMatchStart: (start: Extract<NetMsg, { k: "start" }>, mySlot: number, isHost: boolean) => void;
  onEditGameTypes?: () => void;
};

/** Live PeerJS lobby UI — host-authoritative online play. */
export class MultiplayerUi {
  private readonly root: HTMLElement;
  private readonly cbs: MpUiCallbacks;
  private statusHtml = "";
  private name = "Player";
  private heroId: HeroPickId = HERO_LIST[0]!.id;
  private heroPage = 0;
  /** Human seat capacity 1–6 (teams decided in-lobby). */
  private maxHumans = 2;
  private privacy: MatchPrivacy = "private";
  private role: "host" | "join" = "host";
  private joinCode = "";
  private mapChoice: MapId | string | "random" = "random";
  private gameTypeId = loadSelectedGameTypeId();
  private maxTurrets = RUN_OPTION_DEFAULTS.maxTurrets;
  private startingGold = STARTING_GOLD;
  private wavesToWin = WIN_WAVES;
  private friendlyFire = false;
  private utilityDraftLevel = 10;
  private livesPerWave = 0;
  private livesPerRun = 0;
  private ascension = 0;
  private preferredCode = randomMpCode();
  private busy = false;
  /** Host hub draft — copied into the PeerJS lobby when the room opens. */
  private hubAiSeats: LobbyAiSeat[] = [];
  private readonly menuFx = new MainMenuFx();

  private get mode(): MatchMode {
    return modeFromMaxHumans(this.maxHumans);
  }

  constructor(root: HTMLElement, cbs: MpUiCallbacks) {
    this.root = root;
    this.cbs = cbs;
    bindHooks({
      onStatus: (html) => {
        this.statusHtml = html;
        this.refreshStatusOnly();
      },
      onLobby: () => this.refresh(),
      onStart: (msg, mySlot) => {
        this.cbs.onMatchStart(msg, mySlot, getSession().mode === "host");
      },
      onDisconnected: (who) => {
        this.statusHtml = `<b style="color:#e85d04">${who} disconnected.</b>`;
        this.refresh();
      },
    });
  }

  show(opts?: {
    mode?: MatchMode;
    maxHumans?: number;
    privacy?: MatchPrivacy;
    role?: "host" | "join";
    mapChoice?: MapId | string | "random";
    maxTurrets?: number;
    startingGold?: number;
    wavesToWin?: number;
    friendlyFire?: boolean;
    utilityDraftLevel?: number;
    livesPerWave?: number;
    livesPerRun?: number;
    ascension?: number;
    heroId?: HeroId;
    preferredCode?: string;
    joinCode?: string;
  }): void {
    if (opts?.maxHumans != null) this.maxHumans = clampMaxHumans(opts.maxHumans);
    else if (opts?.mode) this.maxHumans = lobbyHumanCap({ mode: opts.mode });
    if (opts?.privacy) this.privacy = opts.privacy;
    if (opts?.role) this.role = opts.role;
    if (opts?.mapChoice) this.mapChoice = opts.mapChoice;
    if (opts?.maxTurrets) this.maxTurrets = opts.maxTurrets;
    if (opts?.startingGold != null) this.startingGold = opts.startingGold;
    if (opts?.wavesToWin != null) this.wavesToWin = opts.wavesToWin;
    if (opts?.friendlyFire != null) this.friendlyFire = opts.friendlyFire;
    if (opts?.utilityDraftLevel != null) this.utilityDraftLevel = opts.utilityDraftLevel;
    if (opts?.livesPerWave != null) this.livesPerWave = opts.livesPerWave;
    if (opts?.livesPerRun != null) this.livesPerRun = opts.livesPerRun;
    if (opts?.ascension != null) this.ascension = opts.ascension;
    if (opts?.heroId) this.heroId = opts.heroId;
    if (opts?.preferredCode) this.preferredCode = opts.preferredCode.toUpperCase();
    if (opts?.joinCode) this.joinCode = opts.joinCode.toUpperCase();
    this.applyGameTypeId(loadSelectedGameTypeId());
    this.root.classList.remove("hidden");
    // Re-entering after the Game Type editor applies the selected type to a live host lobby.
    const S = getSession();
    if (S.mode === "host" && S.lobby) {
      this.applyGameTypeId(loadSelectedGameTypeId());
    }
    this.refresh();
    if (S.mode === "host" && S.lobby) this.pushHostOpts();
    startMenuMusic();
  }

  /** Tear down lobby chrome. Pass `{ disconnect: false }` when entering a live match so PeerJS stays up. */
  destroy(opts?: { disconnect?: boolean }): void {
    this.menuFx.stop();
    if (opts?.disconnect !== false) disconnectNet();
    this.root.innerHTML = "";
  }

  private mountFxShell(body: string): void {
    const settings = loadSettings();
    const reduceMotion = !!settings.reduceMotion;
    syncMotionPreference(settings);
    const backdrop = this.root.querySelector<HTMLElement>(".menu-backdrop.menu-fx");
    const reuseFx =
      !!backdrop &&
      backdrop.classList.contains("fx-sub") &&
      !!this.root.querySelector("#menu-fx-canvas");

    if (reuseFx && backdrop) {
      backdrop.classList.toggle("reduce-motion", reduceMotion);
      // Keep backdrop; replace only non-backdrop content
      for (const child of [...this.root.children]) {
        if (child === backdrop) continue;
        child.remove();
      }
      backdrop.insertAdjacentHTML("afterend", body);
      return;
    }

    this.menuFx.stop();
    this.root.innerHTML = `
      <div class="menu-backdrop menu-fx fx-sub${reduceMotion ? " reduce-motion" : ""}">
        <div class="menu-aurora" aria-hidden="true"></div>
        <div class="menu-waves" aria-hidden="true"></div>
        <canvas id="menu-fx-canvas" aria-hidden="true"></canvas>
      </div>
      ${body}
    `;
    const fxCanvas = this.root.querySelector<HTMLCanvasElement>("#menu-fx-canvas");
    if (fxCanvas) this.menuFx.start(fxCanvas, { variation: "sub", reduceMotion });
  }

  private refreshStatusOnly(): void {
    const el = this.root.querySelector("#mp-status");
    if (el) {
      el.innerHTML = this.statusHtml || "";
      return;
    }
    this.refresh();
  }

  private refresh(): void {
    const S = getSession();
    if (S.lobby && (S.open || (S.mode === "host" && S.lobby.code))) {
      this.renderLobby(S.lobby, S.mySlot, S.mode);
      return;
    }
    this.renderHub();
  }

  private runExtras(): MpRunExtras {
    return {
      ...gameTypeToMpExtras(getGameType(this.gameTypeId).options),
      gameTypeId: this.gameTypeId,
      utilityDraftLevel: this.utilityDraftLevel,
      ascension: this.ascension,
      livesPerWave: this.livesPerWave,
      livesPerRun: this.livesPerRun,
    };
  }

  private applyGameTypeId(id: string): void {
    this.gameTypeId = id;
    saveSelectedGameTypeId(id);
    const o = getGameType(id).options;
    this.maxTurrets = o.maxTurrets;
    this.startingGold = o.startingGold;
    this.wavesToWin = o.wavesToWin;
    this.livesPerWave = o.livesPerWave;
    this.livesPerRun = o.livesPerRun;
    this.utilityDraftLevel = o.utilityDraftLevel;
    this.friendlyFire = o.endless ? false : o.friendlyFire;
    if (o.endless) {
      // Strip rival-lane AI only; keep home-lane AI seats.
      this.hubAiSeats = this.hubAiSeats.filter((a) => a.team === 0);
    }
    if (
      this.mapChoice !== "random"
    ) {
      const strict = (o.contentFilters?.maps?.length ?? 0) > 0;
      if (strict) {
        const allowed = enabledMapIds(o.contentFilters);
        if (allowed.length && !allowed.includes(this.mapChoice as MapId)) {
          this.mapChoice = allowed[0]!;
        }
      }
    }
  }

  private pushHostOpts(): void {
    hostSetOpts(
      this.mapChoice,
      this.maxTurrets,
      this.startingGold,
      this.wavesToWin,
      this.friendlyFire,
      this.utilityDraftLevel,
      this.runExtras(),
    );
  }

  private resetRunOptions(): void {
    // Factory default for MP is Outlast (legacy "standard" id mapped to Race)
    this.applyGameTypeId("outlast");
    this.mapChoice = RUN_OPTION_DEFAULTS.mapChoice;
    this.ascension = RUN_OPTION_DEFAULTS.ascension;
  }

  private randomizeRunOptions(): void {
    const meta = loadMetaStore();
    const mapPool: Array<MapId | string | "random"> = [
      "random",
      ...MAP_LIST.filter((m) => isMapUnlocked(m.id)).map((m) => m.id),
      ...listCustomMaps().map((m) => m.id),
    ];
    this.mapChoice = pickOne(mapPool);
    this.ascension = Math.floor(Math.random() * (meta.ascensionUnlocked + 1));
    this.applyGameTypeId(pickOne(listEnabledGameTypes()).id);
  }

  private bindRunResetRandom(prefix: string, editable: boolean, onChange?: () => void): void {
    if (!editable) return;
    this.root.querySelector(`#${prefix}-run-reset`)?.addEventListener("click", () => {
      this.resetRunOptions();
      onChange?.();
      this.refresh();
    });
    this.root.querySelector(`#${prefix}-run-randomize`)?.addEventListener("click", () => {
      this.randomizeRunOptions();
      onChange?.();
      this.refresh();
    });
  }

  private runSetupHtml(
    prefix: string,
    editable: boolean,
    aiRosterOpts?: {
      seats: LobbyAiSeat[];
      editable: boolean;
      pve: boolean;
      team0Humans: number;
      team1Humans: number;
      noRival?: boolean;
    } | null,
  ): string {
    const dis = editable ? "" : "disabled";
    const tip = (key: RunOptionTipKey) => ` data-tip="${escapeAttr(runTip(key))}"`;
    const customMaps = listCustomMaps();
    const gtOpts = getGameType(this.gameTypeId).options;
    const mapFilters = gtOpts.contentFilters;
    const noRival = !!gtOpts.endless;
    const strictMaps = (mapFilters?.maps?.length ?? 0) > 0;
    const allowedBuiltins = new Set(enabledMapIds(mapFilters).map(String));
    const mapOk = (id: string) =>
      strictMaps ? allowedBuiltins.has(id) : isIdEnabled(mapFilters, "maps", id);
    const builtinMapOpts = MAP_LIST.map((m) => {
      const allowed = mapOk(m.id);
      return `<option value="${m.id}" ${this.mapChoice === m.id ? "selected" : ""} ${allowed ? "" : "disabled"}>${escapeAttr(m.name)}${allowed ? "" : " (locked out)"}</option>`;
    }).join("");
    const customMapOpts = customMaps.length
      ? customMaps
          .map((m) => {
            const allowed = !strictMaps && mapOk(m.id);
            return `<option value="${m.id}" ${this.mapChoice === m.id ? "selected" : ""} ${allowed ? "" : "disabled"}>${escapeAttr(m.name)}${allowed ? "" : " (locked out)"}</option>`;
          })
          .join("")
      : `<option value="" disabled>(none saved yet)</option>`;
    const mapOpts = [
      `<option value="random" ${this.mapChoice === "random" ? "selected" : ""}>Random</option>`,
      `<optgroup label="Built-in">${builtinMapOpts}</optgroup>`,
      `<optgroup label="Custom library">${customMapOpts}</optgroup>`,
    ].join("");
    const meta = loadMetaStore();
    const ascMax = Math.max(meta.ascensionUnlocked, this.ascension);
    const ascOpts = Array.from({ length: ascMax + 1 }, (_, i) => {
      const def = ASCENSIONS[i]!;
      return `<option value="${i}" ${this.ascension === i ? "selected" : ""}>A${i} · ${escapeAttr(def.name)}</option>`;
    }).join("");
    const headActions = editable
      ? `<div class="panel-head-actions">
            <button type="button" class="menu-btn small ghost" id="${prefix}-run-reset" data-tip="Restore default run options"><span class="btn-label">Reset</span></button>
            <button type="button" class="menu-btn small ghost shine-btn" id="${prefix}-run-randomize" data-tip="Roll random run options"><span class="btn-label">Randomize</span></button>
            <button type="button" class="menu-btn small ghost shine-btn ${this.heroId === RANDOM_HERO_ID ? "primary" : ""}" id="${prefix}-hero-random" data-tip="Pick a random unlocked hero at match start"><span class="btn-label">Random</span></button>
          </div>`
      : this.heroId === RANDOM_HERO_ID
        ? `<div class="panel-head-actions"><span class="menu-note compact">Hero · Random</span></div>`
        : "";

    const aiBlock =
      aiRosterOpts != null
        ? this.aiRosterInnerHtml({ ...aiRosterOpts, noRival: aiRosterOpts.noRival ?? noRival })
        : "";

    return `
      <section class="sp-setup">
        <div class="panel-head">
          <h2 class="sp-setup-title">${editable ? "Run setup" : "Host settings"}</h2>
          ${headActions}
        </div>
        <div class="run-grid cols-2">
          <label class="run-field">
            <span>Map</span>
            <select id="${prefix}-map" ${dis}${tip("map")}>${mapOpts}</select>
          </label>
          <label class="run-field">
            <span>Ascension</span>
            <select id="${prefix}-ascension" ${dis}${tip("ascension")}>${ascOpts}</select>
          </label>
        </div>
        <div class="map-preview" id="${prefix}-map-preview" aria-hidden="true">
          <canvas></canvas>
          <span class="map-preview-label"></span>
        </div>
        ${aiBlock}
        <div class="gt-lobby-row">
          ${gameTypeSelectHtml(this.gameTypeId, `${prefix}-game-type`, !editable)}
          ${
            editable
              ? `<button type="button" class="menu-btn small ghost shine-btn" id="${prefix}-edit-gt"><span class="btn-label">Edit Gametypes</span></button>`
              : ""
          }
        </div>
        <div class="gt-lobby-summary" id="${prefix}-gt-summary">
          ${gameTypeSummaryHtml(getGameType(this.gameTypeId).options, {
            maxVisible: 12,
            columns: 2,
            showMoreId: `${prefix}-gt-more`,
          })}
        </div>
      </section>
    `;
  }

  private aiRosterInnerHtml(opts: {
    seats: LobbyAiSeat[];
    editable: boolean;
    pve: boolean;
    team0Humans: number;
    team1Humans: number;
    /** Game type / lobby has no rival lane. */
    noRival?: boolean;
  }): string {
    // Same as old aiRosterHtml body, nested under sp-setup (no separate floating box).
    const store = loadAiStore();
    const noRival = !!opts.noRival;
    const heroOpts = (sel: LobbyAiHeroPick) =>
      [
        `<option value="random" ${sel === "random" ? "selected" : ""}>Random</option>`,
        ...HERO_LIST.map(
          (h) =>
            `<option value="${h.id}" ${h.id === sel ? "selected" : ""}>${escapeAttr(h.name)}</option>`,
        ),
      ].join("");

    const count = (team: MpTeam) =>
      (team === 0 ? opts.team0Humans : opts.team1Humans) +
      opts.seats.filter((a) => a.team === team).length;
    const room = (team: MpTeam) => Math.max(0, MAX_TEAM_COMBATANTS - count(team));

    const col = (team: MpTeam, title: string) => {
      if (team === 1 && noRival) {
        return `
        <div class="sp-ai-col" data-team="${team}">
          <h4>${title}</h4>
          <p class="menu-note">No rival lane enabled</p>
        </div>`;
      }
      const rows = opts.seats.filter((a) => a.team === team);
      const list = rows.length
        ? rows
            .map((a) => {
              const heroLabel =
                a.heroId === "random" ? "Random" : resolveHero(a.heroId).name;
              if (!opts.editable) {
                return `<div class="sp-ai-row"><span class="sp-ai-you-name">AI · ${escapeAttr(heroLabel)}</span><span class="sp-ai-you-meta">${escapeAttr(aiKindLabel(a.ai, store))}</span><span class="sp-ai-lock">—</span></div>`;
              }
              return `<div class="sp-ai-row" data-ai-id="${escapeAttr(a.id)}">
                <select class="menu-select mp-ai-hero" data-ai-id="${escapeAttr(a.id)}">${heroOpts(a.heroId)}</select>
                <select class="menu-select mp-ai-kind" data-ai-id="${escapeAttr(a.id)}">${aiKindOptionsHtml(a.ai, store)}</select>
                <button type="button" class="menu-btn small ghost mp-ai-rm" data-ai-id="${escapeAttr(a.id)}">✕</button>
              </div>`;
            })
            .join("")
        : `<p class="menu-note compact">No AI fillers</p>`;
      return `
        <div class="sp-ai-col" data-team="${team}">
          <h4>${title} · ${count(team)}/${MAX_TEAM_COMBATANTS}</h4>
          ${list}
          ${
            opts.editable
              ? `<button type="button" class="menu-btn small ghost sp-ai-add mp-ai-add" data-team="${team}" ${room(team) <= 0 ? "disabled" : ""}>+ AI</button>`
              : ""
          }
        </div>`;
    };

    return `
      <div class="sp-ai-roster mp-ai-roster nested">
        <div class="panel-head">
          <h3 class="sp-setup-title">AI roster</h3>
        </div>
        <p class="menu-note">${
          noRival
            ? "Add AI allies on the home lane. No rival lane enabled."
            : `Add AI allies/enemies (max ${MAX_TEAM_COMBATANTS} per team). Switch Team for humans; PvP/co-op is free-form.`
        }</p>
        <div class="sp-ai-cols">
          ${col(0, opts.pve ? "AI allies (co-op)" : "Home · AI")}
          ${col(1, opts.pve ? "AI foe lane" : "Away · AI")}
        </div>
      </div>`;
  }

  /** @deprecated outer wrapper kept as alias */
  private paintMapPreview(prefix: string): void {
    const box = this.root.querySelector<HTMLElement>(`#${prefix}-map-preview`);
    if (!box) return;
    const canvas = box.querySelector("canvas");
    const label = box.querySelector<HTMLElement>(".map-preview-label");
    if (!canvas || !label) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(200, Math.round(rect.width) || 360);
    const h = Math.max(48, Math.round(rect.height) || 72);
    if (this.mapChoice === "random") {
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#0a0f1a";
        ctx.fillRect(0, 0, w, h);
      }
      label.textContent = "Random map each run";
      label.style.display = "";
      return;
    }
    paintMapThumb(canvas, resolveMap(this.mapChoice), w, h);
    label.style.display = "none";
  }

  private bindRunSetup(prefix: string, onChange?: () => void): void {
    const read = () => {
      const map = this.root.querySelector<HTMLSelectElement>(`#${prefix}-map`);
      const asc = this.root.querySelector<HTMLSelectElement>(`#${prefix}-ascension`);
      const gt = this.root.querySelector<HTMLSelectElement>(`#${prefix}-game-type`);
      if (map) this.mapChoice = map.value as MapId | string | "random";
      if (asc) this.ascension = Number(asc.value) || 0;
      if (gt) this.applyGameTypeId(gt.value);
      this.paintMapPreview(prefix);
      onChange?.();
    };
    for (const id of ["map", "ascension", "game-type"]) {
      this.root.querySelector(`#${prefix}-${id}`)?.addEventListener("change", read);
    }
    this.root.querySelector(`#${prefix}-edit-gt`)?.addEventListener("click", () => {
      this.cbs.onEditGameTypes?.();
    });
    this.root.querySelector(`#${prefix}-gt-more`)?.addEventListener("click", () => {
      this.cbs.onEditGameTypes?.();
    });
    this.root.querySelector(`#${prefix}-hero-random`)?.addEventListener("click", () => {
      this.heroId = RANDOM_HERO_ID;
      this.refresh();
    });
  }

  private syncOptsFromLobby(lobby: LobbyState): void {
    this.mapChoice = lobby.mapChoice;
    this.maxTurrets = lobby.maxTurrets;
    this.startingGold = lobby.startingGold;
    this.wavesToWin = lobby.wavesToWin;
    this.friendlyFire = lobby.friendlyFire;
    if (lobby.utilityDraftLevel != null) this.utilityDraftLevel = lobby.utilityDraftLevel;
    if (lobby.livesPerWave != null) this.livesPerWave = lobby.livesPerWave;
    if (lobby.livesPerRun != null) this.livesPerRun = lobby.livesPerRun;
    if (lobby.ascension != null) this.ascension = lobby.ascension;
    if (lobby.gameTypeId) {
      // Identity only — options already arrived on the lobby; don't re-apply defaults over host.
      this.gameTypeId = lobby.gameTypeId;
    }
  }

  private heroGridHtml(): string {
    const entries = listHeroSelectEntries({ includeRandom: false });
    const pages = heroSelectPageCount(entries.length);
    const page = Math.min(this.heroPage, pages - 1);
    this.heroPage = page;
    // When Random is selected, no hero card should appear selected.
    const selectedId = this.heroId === RANDOM_HERO_ID ? "" : String(this.heroId);
    const slice = sliceHeroPage(entries, page);
    const cards = slice.map((e) => heroCardHtml(e, selectedId)).join("");
    return `${cards}${heroPagerHtml(page, pages, { prefix: "mp-hero" })}`;
  }

  private heroDetailHtml(): string {
    const d = heroDetailForPick(this.heroId);
    if (d.random) {
      return `
        <div class="sp-hero-detail-inner">
          <span class="hero-swatch" style="--hero:${d.color}"></span>
          <strong style="color:${d.color}">???</strong>
          <p class="sp-hero-blurb">???</p>
          <ul class="hero-abilities">
            <li><em>Passive</em> ???</li>
            <li>???</li>
            <li>???</li>
            <li>???</li>
          </ul>
        </div>
      `;
    }
    if (d.locked) {
      return `
        <div class="sp-hero-detail-inner locked">
          <span class="hero-swatch" style="--hero:${d.color}"></span>
          <strong>${escapeAttr(d.name)} · Locked</strong>
          <p class="sp-hero-locked">${escapeAttr(d.blurb)}</p>
        </div>
      `;
    }
    return `
      <div class="sp-hero-detail-inner">
        <span class="hero-swatch" style="--hero:${d.color}"></span>
        <strong style="color:${d.color}">${escapeAttr(d.name)}${d.custom ? " · Custom" : ""}</strong>
        <p class="sp-hero-blurb">${escapeAttr(d.blurb)}</p>
        <ul class="hero-abilities">
          <li><em>Passive</em> ${escapeAttr(d.passive ?? "")}</li>
          <li>${escapeAttr(d.attack ?? "")}</li>
          <li>${escapeAttr(d.mobility ?? "")}</li>
          <li>${escapeAttr(d.ultimate ?? "")}</li>
        </ul>
      </div>
    `;
  }

  private bindHeroGrid(onPick?: () => void): void {
    this.root.querySelectorAll<HTMLElement>("[data-hero-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.heroId as HeroPickId;
        if (id !== RANDOM_HERO_ID && !isCustomHeroId(id) && !isHeroUnlocked(id as HeroId)) return;
        this.heroId = id;
        onPick?.();
        this.root.querySelectorAll<HTMLElement>("[data-hero-id]").forEach((c) => {
          c.classList.toggle("selected", c.dataset.heroId === String(this.heroId));
        });
        const detail = this.root.querySelector("#mp-hero-detail");
        if (detail) detail.innerHTML = this.heroDetailHtml();
      });
    });
    this.root.querySelectorAll<HTMLElement>("[data-action='mp-hero-page-prev']").forEach((b) => {
      b.addEventListener("click", () => {
        this.heroPage = Math.max(0, this.heroPage - 1);
        this.refresh();
      });
    });
    this.root.querySelectorAll<HTMLElement>("[data-action='mp-hero-page-next']").forEach((b) => {
      b.addEventListener("click", () => {
        this.heroPage += 1;
        this.refresh();
      });
    });
  }

  private connectionCodeHtml(): string {
    if (this.privacy === "public") {
      return `<p class="menu-note mp-code-note">Public lobbies use an auto code — no need to share one.</p>`;
    }
    if (this.role === "host") {
      return `
        <div class="mp-code-block">
          <span class="run-field-label">Lobby code</span>
          <div class="code-row">
            <code class="lobby-code">${escapeAttr(this.preferredCode)}</code>
            <button type="button" class="menu-btn small" id="mp-copy-code">Copy</button>
            <button type="button" class="menu-btn small ghost" id="mp-regen-code">New</button>
          </div>
          <p class="menu-note">Share this code after you create the lobby.</p>
        </div>
      `;
    }
    return `
      <label class="run-field mp-code-block">
        <span>Host lobby code</span>
        <input id="mp-join" class="menu-input run-input" maxlength="16" value="${escapeAttr(this.joinCode)}" placeholder="ABC123" autocomplete="off" spellcheck="false" />
      </label>
    `;
  }

  private renderHub(): void {
    const playersOpts = [1, 2, 3, 4, 5, 6]
      .map(
        (n) =>
          `<option value="${n}" ${n === this.maxHumans ? "selected" : ""}>${n}</option>`,
      )
      .join("");

    const actionLabel =
      this.role === "host"
        ? this.privacy === "public"
          ? "Create public lobby"
          : "Create private lobby"
        : this.privacy === "public"
          ? "Find match"
          : "Join lobby";

    const hubAi = {
      seats: this.hubAiSeats,
      editable: true,
      pve: false,
      team0Humans: this.hubTeamHumans(0),
      team1Humans: this.hubTeamHumans(1),
    };

    this.mountFxShell(`
      <div class="menu-shell tight mp-shell">
        <header class="menu-header compact sp-header mp-lobby-header">
          <div class="sp-header-row">
            <div class="sp-header-titles mp-lobby-titles">
              <button type="button" class="menu-back" id="mp-back">← Back</button>
              <h1 class="menu-title mp-lobby-title">Online Lobby</h1>
            </div>
          </div>
          <p class="menu-lead">PeerJS · host-authoritative</p>
        </header>

        <section class="sp-setup mp-connection">
          <h2 class="sp-setup-title">Connection</h2>
          <div class="run-grid cols-3">
            <label class="run-field">
              <span>Display name</span>
              <input id="mp-name" class="menu-input run-input" maxlength="18" value="${escapeAttr(this.name)}" />
            </label>
            <label class="run-field">
              <span>Number of Players</span>
              <select id="mp-players">${playersOpts}</select>
            </label>
            <label class="run-field">
              <span>Lobby</span>
              <div class="choice-row compact-chips">
                <button type="button" class="chip ${this.privacy === "private" ? "selected" : ""}" id="priv-private">Private</button>
                <button type="button" class="chip ${this.privacy === "public" ? "selected" : ""}" id="priv-public">Public</button>
                <button type="button" class="chip ${this.role === "host" ? "selected" : ""}" id="role-host">Host</button>
                <button type="button" class="chip ${this.role === "join" ? "selected" : ""}" id="role-join">Join</button>
              </div>
            </label>
          </div>
          ${this.connectionCodeHtml()}
        </section>

        <div class="sp-run-layout">
          ${
            this.role === "host"
              ? this.runSetupHtml("hub", true, hubAi)
              : `<section class="sp-setup"><h2 class="sp-setup-title">Run setup</h2><p class="menu-note">Host sets map, run options, and AI roster after the lobby opens.</p></section>`
          }

          <section class="sp-heroes">
            <h2 class="sp-heroes-title">Your hero</h2>
            <div class="hero-grid compact">${this.heroGridHtml()}</div>
            <div id="mp-hero-detail" class="sp-hero-detail">${this.heroDetailHtml()}</div>
          </section>
        </div>

        <div class="menu-footer sp-footer">
          <button type="button" class="menu-btn primary wide shine-btn" id="mp-go" ${this.busy ? "disabled" : ""}><span class="btn-label">${actionLabel}</span></button>
          <p class="menu-footnote" id="mp-status">${this.statusHtml || ""}</p>
        </div>
      </div>
    `);

    this.root.querySelector("#mp-back")!.addEventListener("click", () => {
      disconnectNet();
      this.cbs.onBack();
    });
    this.root.querySelector("#priv-private")!.addEventListener("click", () => {
      this.privacy = "private";
      this.refresh();
    });
    this.root.querySelector("#priv-public")!.addEventListener("click", () => {
      this.privacy = "public";
      this.refresh();
    });
    this.root.querySelector("#role-host")!.addEventListener("click", () => {
      this.role = "host";
      this.refresh();
    });
    this.root.querySelector("#role-join")!.addEventListener("click", () => {
      this.role = "join";
      this.refresh();
    });
    this.root.querySelector("#mp-players")!.addEventListener("change", (e) => {
      this.maxHumans = clampMaxHumans(Number((e.target as HTMLSelectElement).value) || 2);
      this.clampHubAiSeats();
      this.refresh();
    });
    this.root.querySelector("#mp-name")!.addEventListener("change", (e) => {
      this.name = (e.target as HTMLInputElement).value.trim() || "Player";
    });
    this.root.querySelector("#mp-join")?.addEventListener("input", (e) => {
      this.joinCode = (e.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    });
    this.root.querySelector("#mp-copy-code")?.addEventListener("click", () => {
      void navigator.clipboard?.writeText(this.preferredCode).then(
        () => {
          this.statusHtml = "Lobby code copied.";
          this.refreshStatusOnly();
        },
        () => {
          this.statusHtml = `Code: ${this.preferredCode}`;
          this.refreshStatusOnly();
        },
      );
    });
    this.root.querySelector("#mp-regen-code")?.addEventListener("click", () => {
      this.preferredCode = randomMpCode();
      this.refresh();
    });

    if (this.role === "host") {
      this.clampHubAiSeats();
      this.bindRunSetup("hub");
      this.bindRunResetRandom("hub", true);
      this.bindAiRoster("hub");
      this.paintMapPreview("hub");
    }
    this.bindHeroGrid();

    this.root.querySelector("#mp-go")!.addEventListener("click", () => {
      if (this.role === "host") void this.doHost();
      else if (this.privacy === "public") void this.doFindPublic();
      else void this.doJoin();
    });
  }

  private async doHost(): Promise<void> {
    if (this.busy) return;
    if (this.heroId !== RANDOM_HERO_ID && !isCustomHeroId(this.heroId) && !isHeroUnlocked(this.heroId as HeroId)) {
      this.statusHtml = '<b style="color:#e85d04">Unlock that hero in the Barracks first.</b>';
      this.refreshStatusOnly();
      return;
    }
    this.busy = true;
    this.captureName();
    this.clampHubAiSeats();
    const code = await quickHost(
      this.mode,
      this.name,
      this.heroId as HeroId | "random",
      this.privacy,
      this.mapChoice,
      this.maxTurrets,
      this.privacy === "private" ? this.preferredCode : undefined,
      this.startingGold,
      this.wavesToWin,
      this.friendlyFire,
      this.maxHumans,
    );
    if (code) {
      hostReplaceAiSeats(this.hubAiSeats);
      this.pushHostOpts();
    }
    this.busy = false;
    void code;
    this.refresh();
  }

  private async doJoin(): Promise<void> {
    if (this.busy) return;
    if (this.heroId !== RANDOM_HERO_ID && !isCustomHeroId(this.heroId) && !isHeroUnlocked(this.heroId as HeroId)) {
      this.statusHtml = '<b style="color:#e85d04">Unlock that hero in the Barracks first.</b>';
      this.refreshStatusOnly();
      return;
    }
    this.busy = true;
    this.captureName();
    await quickJoin(this.joinCode, this.name, this.heroId as HeroId | "random");
    this.busy = false;
    this.refresh();
  }

  private async doFindPublic(): Promise<void> {
    if (this.busy) return;
    if (this.heroId !== RANDOM_HERO_ID && !isCustomHeroId(this.heroId) && !isHeroUnlocked(this.heroId as HeroId)) {
      this.statusHtml = '<b style="color:#e85d04">Unlock that hero in the Barracks first.</b>';
      this.refreshStatusOnly();
      return;
    }
    this.busy = true;
    this.captureName();
    await findPublicMatch(this.mode, this.name, this.heroId as HeroId | "random");
    this.busy = false;
    this.refresh();
  }

  private captureName(): void {
    const n = this.root.querySelector<HTMLInputElement>("#mp-name");
    if (n) this.name = n.value.trim() || "Player";
    const p = this.root.querySelector<HTMLSelectElement>("#mp-players");
    if (p) this.maxHumans = clampMaxHumans(Number(p.value) || 2);
  }

  /** Hub preview: host alone on team 0 until friends join. */
  private hubTeamHumans(team: MpTeam): number {
    return team === 0 ? 1 : 0;
  }

  private hubTeamRoom(team: MpTeam): number {
    const used =
      this.hubTeamHumans(team) + this.hubAiSeats.filter((a) => a.team === team).length;
    return Math.max(0, MAX_TEAM_COMBATANTS - used);
  }

  private clampHubAiSeats(): void {
    const kept: LobbyAiSeat[] = [];
    const room: [number, number] = [
      MAX_TEAM_COMBATANTS - this.hubTeamHumans(0),
      MAX_TEAM_COMBATANTS - this.hubTeamHumans(1),
    ];
    for (const a of this.hubAiSeats) {
      if (room[a.team]! > 0) {
        kept.push(a);
        room[a.team]!--;
      }
    }
    this.hubAiSeats = kept;
  }

  /** Wire +AI / remove / hero / difficulty. `source: "hub"` edits local draft; `"live"` hits the session. */
  private bindAiRoster(source: "hub" | "live"): void {
    this.root.querySelectorAll<HTMLButtonElement>(".mp-ai-add").forEach((btn) => {
      btn.addEventListener("click", () => {
        const team = Number(btn.dataset.team) as MpTeam;
        if (team === 1 && getGameType(this.gameTypeId).options.endless) return;
        if (source === "hub") {
          if (this.hubTeamRoom(team) <= 0) return;
          this.hubAiSeats.push(newAiSeat(team, { kind: "classic" }, "random"));
          this.refresh();
          return;
        }
        hostAddAiSeat(team);
        this.refresh();
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>(".mp-ai-rm").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.aiId ?? "";
        if (source === "hub") {
          this.hubAiSeats = this.hubAiSeats.filter((a) => a.id !== id);
          this.refresh();
          return;
        }
        hostRemoveAiSeat(id);
        this.refresh();
      });
    });
    this.root.querySelectorAll<HTMLSelectElement>(".mp-ai-kind").forEach((sel) => {
      sel.addEventListener("change", () => {
        const id = sel.dataset.aiId ?? "";
        const ai = parseAiKindValue(sel.value) as LobbyAiKind;
        if (source === "hub") {
          const seat = this.hubAiSeats.find((a) => a.id === id);
          if (seat) seat.ai = ai;
          this.refresh();
          return;
        }
        hostUpdateAiSeat(id, { ai });
        this.refresh();
      });
    });
    this.root.querySelectorAll<HTMLSelectElement>(".mp-ai-hero").forEach((sel) => {
      sel.addEventListener("change", () => {
        const id = sel.dataset.aiId ?? "";
        const heroId = (sel.value || "random") as LobbyAiHeroPick;
        if (source === "hub") {
          const seat = this.hubAiSeats.find((a) => a.id === id);
          if (seat) seat.heroId = heroId;
          this.refresh();
          return;
        }
        hostUpdateAiSeat(id, { heroId });
        this.refresh();
      });
    });
  }

  private renderLobby(lobby: LobbyState, mySlot: number, mode: NetMode): void {
    this.syncOptsFromLobby(lobby);
    this.maxHumans = lobbyHumanCap(lobby);
    const mySeat = lobbySeat(lobby, mySlot);
    if (mySeat) this.heroId = mySeat.heroId;

    const cap = lobbyHumanCap(lobby);
    const seatFor = (s: NonNullable<ReturnType<typeof lobbySeat>>, you: string) => {
      const ready = s.ready ? "✓" : "…";
      const hero = s.heroId === "random" ? "Random" : resolveHero(s.heroId).name;
      const tint = s.team === 0 ? "team-home" : "team-away";
      return `<li class="mp-seat ${tint} ${s.slot === mySlot ? "you" : ""}"><strong>${escapeAttr(s.name)}${you}</strong><span class="mp-seat-hero">${escapeAttr(hero)}</span><span class="mp-seat-ready">${ready}</span></li>`;
    };
    const colSeats = (team: MpTeam) => {
      const items: string[] = [];
      for (let i = 0; i < cap; i++) {
        const s = lobbySeat(lobby, i);
        if (!s || s.team !== team) continue;
        const you = s.slot === mySlot ? " (you)" : "";
        items.push(seatFor(s, you));
      }
      for (let i = 0; i < cap; i++) {
        if (!lobbySeat(lobby, i) && team === 0 && items.length + openCount(1) < cap) {
          /* open seats stay uncolored below */
        }
      }
      return items;
    };
    const openCount = (excludeTeam: MpTeam | null) => {
      void excludeTeam;
      return Math.max(0, cap - lobby.slots.length);
    };
    const homeSeats = colSeats(0);
    const awaySeats = colSeats(1);
    const opens = openCount(null);
    for (let i = 0; i < opens; i++) {
      // Prefer filling open markers under home column first visually.
      (homeSeats.length <= awaySeats.length ? homeSeats : awaySeats).push(
        `<li class="mp-seat empty">Open seat</li>`,
      );
    }

    const canStart = mode === "host" && canStartMatch();
    const amReady = mySeat?.ready ?? false;
    const isHost = mode === "host";
    this.hubAiSeats = structuredClone(lobby.aiSeats ?? []);

    const liveAi = {
      seats: lobby.aiSeats ?? [],
      editable: isHost,
      pve: isPveMode(lobby.mode),
      team0Humans: lobbyTeamCount(lobby, 0),
      team1Humans: lobbyTeamCount(lobby, 1),
    };

    this.mountFxShell(`
      <div class="menu-shell tight mp-shell mp-lobby-live">
        <header class="menu-header compact sp-header mp-lobby-header">
          <button type="button" class="menu-back mp-lobby-leave" id="mp-leave">← Leave</button>
          <h1 class="menu-title mp-lobby-title">Multiplayer Lobby</h1>
          <div class="mp-lobby-code-wrap">
            <code class="lobby-code">${escapeAttr(lobby.code ?? "—")}</code>
          </div>
        </header>

        <section class="menu-section mp-players">
          <h2 class="sp-heroes-title">Players</h2>
          <div class="mp-seat-cols">
            <ul class="mp-seat-list team-home">${homeSeats.join("") || `<li class="mp-seat empty">Open seat</li>`}</ul>
            <ul class="mp-seat-list team-away">${awaySeats.join("") || `<li class="mp-seat empty">Open seat</li>`}</ul>
          </div>
        </section>

        <div class="sp-run-layout">
          ${this.runSetupHtml("live", isHost, liveAi)}

          <section class="sp-heroes">
            <h2 class="sp-heroes-title">Your hero</h2>
            <div class="hero-grid compact">${this.heroGridHtml()}</div>
            <div id="mp-hero-detail" class="sp-hero-detail">${this.heroDetailHtml()}</div>
          </section>
        </div>

        <div class="menu-footer sp-footer stack">
          <div class="mp-footer-row">
            <button type="button" class="menu-btn ghost" id="mp-team">Switch team</button>
            <button type="button" class="menu-btn ${amReady ? "ghost" : "primary"} shine-btn" id="mp-ready">
              <span class="btn-label">${amReady ? "Unready" : "Ready"}</span>
            </button>
            ${
              isHost
                ? `<button type="button" class="menu-btn primary shine-btn" id="mp-start" ${canStart ? "" : "disabled"}>
                  <span class="btn-label">${canStart ? "Start match" : `Waiting (${lobbyReadyCount(lobby)}/${lobby.slots.length} ready · each side 1–3)`}</span>
                </button>`
                : `<p class="menu-note">Waiting for host to start…</p>`
            }
          </div>
          <p class="menu-footnote" id="mp-status">${this.statusHtml || "Lobby open — share the code with friends."}</p>
        </div>
      </div>
    `);

    this.root.querySelector("#mp-leave")!.addEventListener("click", () => {
      disconnectNet();
      this.cbs.onBack();
    });

    this.bindHeroGrid(() => {
      localPickHero(this.heroId as HeroId | "random");
    });

    if (isHost) {
      this.bindRunSetup("live", () => {
        this.pushHostOpts();
      });
      this.bindRunResetRandom("live", true, () => this.pushHostOpts());
      this.bindAiRoster("live");
    }
    this.paintMapPreview("live");

    this.root.querySelector("#mp-team")?.addEventListener("click", () => {
      localSwitchTeam();
      this.refresh();
    });
    this.root.querySelector("#mp-ready")!.addEventListener("click", () => {
      if (amReady) localUnready();
      else localReady();
      this.refresh();
    });
    this.root.querySelector("#mp-start")?.addEventListener("click", () => {
      if (!canStartMatch()) return;
      this.pushHostOpts();
      const mapId = resolveMapChoice(
        this.mapChoice,
        getGameType(this.gameTypeId).options.contentFilters?.maps,
      );
      const msg = hostStartMatch(
        mapId,
        this.maxTurrets,
        this.startingGold,
        this.wavesToWin,
        this.friendlyFire,
        this.utilityDraftLevel,
      );
      if (msg) this.cbs.onMatchStart(msg, mySlot, true);
    });

    void lobbyFull;
    void lobbyBalanced;
    void hostSetMaxHumans;
    void lobbyCombatantCount;
  }
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function randomMpCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  return out;
}
