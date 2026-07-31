import { HERO_LIST, HEROES, type HeroId } from "../data/heroes";
import { isHeroUnlocked } from "../meta/store";
import { MAP_LIST, resolveMapChoice, type MapId } from "../data/maps";
import { STARTING_GOLD, WIN_WAVES } from "../data/constants";
import { DEFAULT_MAX_TURRETS } from "../data/turrets";
import {
  bindHooks,
  canStartMatch,
  disconnectNet,
  findPublicMatch,
  getSession,
  hostSetMode,
  hostSetOpts,
  hostStartMatch,
  localPickHero,
  localReady,
  localSwitchTeam,
  localUnready,
  quickHost,
  quickJoin,
} from "./session";
import { lobbyBalanced, lobbyFull, lobbyReadyCount, lobbySeat, lobbyTeamCount } from "./lobby";
import type { LobbyState, MatchMode, MatchPrivacy, NetMode, NetMsg } from "./types";
import { isPveMode, modeCap, teamNeed } from "./types";

export type MpUiCallbacks = {
  onBack: () => void;
  onMatchStart: (start: Extract<NetMsg, { k: "start" }>, mySlot: number, isHost: boolean) => void;
};

const MODE_LABEL: Record<MatchMode, string> = {
  "1v1": "1v1 PvP",
  "2v2": "2v2 PvP",
  "3v3": "3v3 PvP",
  "2p-pve": "2 Player PvE",
  "3p-pve": "3 Player PvE",
};

/** Live PeerJS lobby UI — host-authoritative online play. */
export class MultiplayerUi {
  private readonly root: HTMLElement;
  private readonly cbs: MpUiCallbacks;
  private statusHtml = "";
  private name = "Player";
  private heroId: HeroId = HERO_LIST[0]!.id;
  private mode: MatchMode = "1v1";
  private privacy: MatchPrivacy = "private";
  private role: "host" | "join" = "host";
  private joinCode = "";
  private mapChoice: MapId | "random" = "random";
  private maxTurrets = DEFAULT_MAX_TURRETS;
  private startingGold = STARTING_GOLD;
  private wavesToWin = WIN_WAVES;
  private friendlyFire = false;
  private preferredCode = randomMpCode();
  private busy = false;

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
    privacy?: MatchPrivacy;
    role?: "host" | "join";
    mapChoice?: MapId | "random";
    maxTurrets?: number;
    startingGold?: number;
    wavesToWin?: number;
    friendlyFire?: boolean;
    heroId?: HeroId;
    preferredCode?: string;
    joinCode?: string;
  }): void {
    if (opts?.mode) this.mode = opts.mode;
    if (opts?.privacy) this.privacy = opts.privacy;
    if (opts?.role) this.role = opts.role;
    if (opts?.mapChoice) this.mapChoice = opts.mapChoice;
    if (opts?.maxTurrets) this.maxTurrets = opts.maxTurrets;
    if (opts?.startingGold != null) this.startingGold = opts.startingGold;
    if (opts?.wavesToWin != null) this.wavesToWin = opts.wavesToWin;
    if (opts?.friendlyFire != null) this.friendlyFire = opts.friendlyFire;
    if (opts?.heroId) this.heroId = opts.heroId;
    if (opts?.preferredCode) this.preferredCode = opts.preferredCode.toUpperCase();
    if (opts?.joinCode) this.joinCode = opts.joinCode.toUpperCase();
    this.root.classList.remove("hidden");
    this.refresh();
  }

  destroy(): void {
    disconnectNet();
    this.root.innerHTML = "";
  }

  private refreshStatusOnly(): void {
    const el = this.root.querySelector("#mp-status");
    if (el) {
      el.innerHTML = this.statusHtml || "Ready when you are.";
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

  private runSetupHtml(prefix: string, editable: boolean): string {
    const dis = editable ? "" : "disabled";
    const mapOpts = [
      `<option value="random" ${this.mapChoice === "random" ? "selected" : ""}>Random</option>`,
      ...MAP_LIST.map(
        (m) =>
          `<option value="${m.id}" ${this.mapChoice === m.id ? "selected" : ""}>${escapeAttr(m.name)}</option>`,
      ),
    ].join("");
    const turretOpts = [1, 2, 3, 4, 5, 6]
      .map(
        (n) =>
          `<option value="${n}" ${this.maxTurrets === n ? "selected" : ""}>${n}${n === DEFAULT_MAX_TURRETS ? " (default)" : ""}</option>`,
      )
      .join("");
    const goldOpts = [45, 60, 80, 100, 150]
      .map(
        (g) =>
          `<option value="${g}" ${this.startingGold === g ? "selected" : ""}>${g}${g === STARTING_GOLD ? " (default)" : ""}</option>`,
      )
      .join("");
    const waveOpts = [8, 10, 12, 15, 20, 0]
      .map((w) => {
        const label = w === 0 ? "Unlimited" : String(w);
        const def = w === WIN_WAVES ? " (default)" : "";
        return `<option value="${w}" ${this.wavesToWin === w ? "selected" : ""}>${label}${def}</option>`;
      })
      .join("");

    return `
      <section class="sp-setup">
        <h2 class="sp-setup-title">${editable ? "Run setup" : "Host settings"}</h2>
        <div class="run-grid cols-3">
          <label class="run-field">
            <span>Map</span>
            <select id="${prefix}-map" ${dis}>${mapOpts}</select>
          </label>
          <label class="run-field">
            <span>Turrets</span>
            <select id="${prefix}-turrets" ${dis}>${turretOpts}</select>
          </label>
          <label class="run-field">
            <span>Starting gold</span>
            <select id="${prefix}-gold" ${dis}>${goldOpts}</select>
          </label>
        </div>
        <div class="run-grid cols-3">
          <label class="run-field">
            <span>Waves to win</span>
            <select id="${prefix}-waves" ${dis}>${waveOpts}</select>
          </label>
          <label class="run-field">
            <span>Friendly fire</span>
            <select id="${prefix}-ff" ${dis}>
              <option value="0" ${!this.friendlyFire ? "selected" : ""}>Off</option>
              <option value="1" ${this.friendlyFire ? "selected" : ""}>On</option>
            </select>
          </label>
          <div class="run-field"></div>
        </div>
      </section>
    `;
  }

  private bindRunSetup(prefix: string, onChange?: () => void): void {
    const read = () => {
      const map = this.root.querySelector<HTMLSelectElement>(`#${prefix}-map`);
      const turrets = this.root.querySelector<HTMLSelectElement>(`#${prefix}-turrets`);
      const gold = this.root.querySelector<HTMLSelectElement>(`#${prefix}-gold`);
      const waves = this.root.querySelector<HTMLSelectElement>(`#${prefix}-waves`);
      const ff = this.root.querySelector<HTMLSelectElement>(`#${prefix}-ff`);
      if (map) this.mapChoice = map.value as MapId | "random";
      if (turrets) this.maxTurrets = Number(turrets.value) || DEFAULT_MAX_TURRETS;
      if (gold) this.startingGold = Number(gold.value) || STARTING_GOLD;
      if (waves) this.wavesToWin = Number(waves.value);
      if (ff) this.friendlyFire = ff.value === "1";
      onChange?.();
    };
    for (const id of ["map", "turrets", "gold", "waves", "ff"]) {
      this.root.querySelector(`#${prefix}-${id}`)?.addEventListener("change", read);
    }
  }

  private heroGridHtml(): string {
    return HERO_LIST.map((h) => {
      const selected = h.id === this.heroId;
      const unlocked = isHeroUnlocked(h.id);
      return `
        <button type="button" class="hero-card compact ${selected ? "selected" : ""} ${unlocked ? "" : "locked"}" data-hero="${h.id}" ${unlocked ? "" : "disabled title=\"Unlock in Barracks\""}>
          <span class="hero-swatch" style="--hero:${h.color}"></span>
          <strong>${escapeAttr(h.name)}</strong>
          <span>${unlocked ? escapeAttr(h.blurb) : "Locked"}</span>
        </button>
      `;
    }).join("");
  }

  private heroDetailHtml(): string {
    const h = HERO_LIST.find((x) => x.id === this.heroId) ?? HERO_LIST[0]!;
    const unlocked = isHeroUnlocked(h.id);
    if (!unlocked) {
      return `
        <div class="sp-hero-detail-inner locked">
          <span class="hero-swatch" style="--hero:${h.color}"></span>
          <strong>${escapeAttr(h.name)} · Locked</strong>
          <p class="sp-hero-locked">Commission this hero in the Barracks to unlock.</p>
        </div>
      `;
    }
    const [mobility, ultimate] = h.abilities;
    return `
      <div class="sp-hero-detail-inner">
        <span class="hero-swatch" style="--hero:${h.color}"></span>
        <strong style="color:${h.color}">${escapeAttr(h.name)}</strong>
        <p class="sp-hero-blurb">${escapeAttr(h.blurb)}</p>
        <ul class="hero-abilities">
          <li><em>Passive</em> ${escapeAttr(h.passive.name)} — ${escapeAttr(h.passive.blurb)}</li>
          <li>${escapeAttr(h.attackHint)}</li>
          <li>${escapeAttr(mobility.name)} — ${escapeAttr(mobility.hint)}</li>
          <li>${escapeAttr(ultimate.name)} — ${escapeAttr(ultimate.hint)}</li>
        </ul>
      </div>
    `;
  }

  private bindHeroGrid(onPick?: () => void): void {
    this.root.querySelectorAll<HTMLElement>("[data-hero]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.hero as HeroId;
        if (!isHeroUnlocked(id)) return;
        this.heroId = id;
        onPick?.();
        this.root.querySelectorAll<HTMLElement>("[data-hero]").forEach((c) => {
          c.classList.toggle("selected", c.dataset.hero === this.heroId);
        });
        const detail = this.root.querySelector("#mp-hero-detail");
        if (detail) detail.innerHTML = this.heroDetailHtml();
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
          <p class="menu-note">Friends join with this code after you create the lobby.</p>
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
    const modes = (Object.keys(MODE_LABEL) as MatchMode[])
      .map(
        (m) =>
          `<option value="${m}" ${m === this.mode ? "selected" : ""}>${MODE_LABEL[m]}</option>`,
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

    this.root.innerHTML = `
      <div class="menu-backdrop"></div>
      <div class="menu-shell tight mp-shell">
        <header class="menu-header compact sp-header">
          <div class="sp-header-row">
            <div class="sp-header-titles">
              <button type="button" class="menu-back" id="mp-back">← Back</button>
              <h1 class="menu-title">Online Lobby</h1>
            </div>
          </div>
          <p class="menu-lead">PeerJS P2P · host-authoritative</p>
        </header>

        <section class="sp-setup">
          <h2 class="sp-setup-title">Connection</h2>
          <div class="run-grid cols-3">
            <label class="run-field">
              <span>Display name</span>
              <input id="mp-name" class="menu-input run-input" maxlength="18" value="${escapeAttr(this.name)}" />
            </label>
            <label class="run-field">
              <span>Mode</span>
              <select id="mp-mode">${modes}</select>
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

        ${this.role === "host" ? this.runSetupHtml("hub", true) : ""}

        <section class="sp-heroes">
          <h2 class="sp-heroes-title">Your hero</h2>
          <div class="hero-grid compact">${this.heroGridHtml()}</div>
          <div id="mp-hero-detail" class="sp-hero-detail">${this.heroDetailHtml()}</div>
        </section>

        <div class="menu-footer sp-footer">
          <button type="button" class="menu-btn primary wide" id="mp-go" ${this.busy ? "disabled" : ""}>${actionLabel}</button>
          <p class="menu-footnote" id="mp-status">${this.statusHtml || "Pick a hero, then host or join."}</p>
        </div>
      </div>
    `;

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
    this.root.querySelector("#mp-mode")!.addEventListener("change", (e) => {
      this.mode = (e.target as HTMLSelectElement).value as MatchMode;
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

    if (this.role === "host") this.bindRunSetup("hub");
    this.bindHeroGrid();

    this.root.querySelector("#mp-go")!.addEventListener("click", () => {
      if (this.role === "host") void this.doHost();
      else if (this.privacy === "public") void this.doFindPublic();
      else void this.doJoin();
    });
  }

  private async doHost(): Promise<void> {
    if (this.busy) return;
    if (!isHeroUnlocked(this.heroId)) {
      this.statusHtml = '<b style="color:#e85d04">Unlock that hero in the Barracks first.</b>';
      this.refreshStatusOnly();
      return;
    }
    this.busy = true;
    this.captureName();
    const code = await quickHost(
      this.mode,
      this.name,
      this.heroId,
      this.privacy,
      this.mapChoice,
      this.maxTurrets,
      this.privacy === "private" ? this.preferredCode : undefined,
      this.startingGold,
      this.wavesToWin,
      this.friendlyFire,
    );
    this.busy = false;
    void code;
    this.refresh();
  }

  private async doJoin(): Promise<void> {
    if (this.busy) return;
    if (!isHeroUnlocked(this.heroId)) {
      this.statusHtml = '<b style="color:#e85d04">Unlock that hero in the Barracks first.</b>';
      this.refreshStatusOnly();
      return;
    }
    this.busy = true;
    this.captureName();
    await quickJoin(this.joinCode, this.name, this.heroId);
    this.busy = false;
    this.refresh();
  }

  private async doFindPublic(): Promise<void> {
    if (this.busy) return;
    if (!isHeroUnlocked(this.heroId)) {
      this.statusHtml = '<b style="color:#e85d04">Unlock that hero in the Barracks first.</b>';
      this.refreshStatusOnly();
      return;
    }
    this.busy = true;
    this.captureName();
    await findPublicMatch(this.mode, this.name, this.heroId);
    this.busy = false;
    this.refresh();
  }

  private captureName(): void {
    const n = this.root.querySelector<HTMLInputElement>("#mp-name");
    if (n) this.name = n.value.trim() || "Player";
    const m = this.root.querySelector<HTMLSelectElement>("#mp-mode");
    if (m) this.mode = m.value as MatchMode;
  }

  private syncOptsFromLobby(lobby: LobbyState): void {
    this.mapChoice = lobby.mapChoice;
    this.maxTurrets = lobby.maxTurrets;
    this.startingGold = lobby.startingGold;
    this.wavesToWin = lobby.wavesToWin;
    this.friendlyFire = lobby.friendlyFire;
  }

  private renderLobby(lobby: LobbyState, mySlot: number, mode: NetMode): void {
    this.syncOptsFromLobby(lobby);
    const mySeat = lobbySeat(lobby, mySlot);
    if (mySeat) this.heroId = mySeat.heroId;

    const cap = modeCap(lobby.mode);
    const seats = Array.from({ length: cap }, (_, i) => {
      const s = lobbySeat(lobby, i);
      if (!s) {
        return `<li class="mp-seat empty">Seat ${i + 1} — open</li>`;
      }
      const you = s.slot === mySlot ? " (you)" : "";
      const team = isPveMode(lobby.mode) ? "Co-op" : s.team === 0 ? "Team A" : "Team B";
      const ready = s.ready ? "✓ ready" : "…";
      const hero = HEROES[s.heroId]?.name ?? s.heroId;
      return `<li class="mp-seat ${s.slot === mySlot ? "you" : ""}"><strong>${escapeAttr(s.name)}${you}</strong> · ${team} · ${escapeAttr(hero)} · ${ready}</li>`;
    }).join("");

    const need = teamNeed(lobby.mode);
    const bal = isPveMode(lobby.mode)
      ? `${lobby.slots.length}/${cap} players`
      : `A ${lobbyTeamCount(lobby, 0)}/${need} · B ${lobbyTeamCount(lobby, 1)}/${need}`;

    const canStart = mode === "host" && canStartMatch();
    const amReady = mySeat?.ready ?? false;
    const isHost = mode === "host";

    this.root.innerHTML = `
      <div class="menu-backdrop"></div>
      <div class="menu-shell tight mp-shell">
        <header class="menu-header compact sp-header">
          <div class="sp-header-row">
            <div class="sp-header-titles">
              <button type="button" class="menu-back" id="mp-leave">← Leave</button>
              <h1 class="menu-title">${MODE_LABEL[lobby.mode]}</h1>
            </div>
          </div>
          <p class="menu-lead">Code <code class="lobby-code">${escapeAttr(lobby.code ?? "—")}</code> · ${bal}</p>
        </header>

        <section class="menu-section">
          <h2 class="sp-heroes-title">Players</h2>
          <ul class="mp-seat-list">${seats}</ul>
        </section>

        ${this.runSetupHtml("live", isHost)}

        <section class="sp-heroes">
          <h2 class="sp-heroes-title">Your hero</h2>
          <div class="hero-grid compact">${this.heroGridHtml()}</div>
          <div id="mp-hero-detail" class="sp-hero-detail">${this.heroDetailHtml()}</div>
        </section>

        ${
          !isPveMode(lobby.mode)
            ? `<div class="menu-footer"><button type="button" class="menu-btn ghost" id="mp-team">Switch team</button></div>`
            : ""
        }

        <div class="menu-footer sp-footer stack">
          ${
            isHost
              ? `<button type="button" class="menu-btn primary wide" id="mp-start" ${canStart ? "" : "disabled"}>
                  ${canStart ? "Start match" : `Waiting (${lobbyReadyCount(lobby)}/${cap} ready, full & balanced)`}
                </button>`
              : `<p class="menu-note">Waiting for host to start…</p>`
          }
          <button type="button" class="menu-btn ${amReady ? "ghost" : "primary"} wide" id="mp-ready">
            ${amReady ? "Unready" : "Ready"}
          </button>
          <p class="menu-footnote" id="mp-status">${this.statusHtml || "Lobby open — share the code with friends."}</p>
        </div>
      </div>
    `;

    this.root.querySelector("#mp-leave")!.addEventListener("click", () => {
      disconnectNet();
      this.cbs.onBack();
    });

    this.bindHeroGrid(() => {
      localPickHero(this.heroId);
    });

    if (isHost) {
      this.bindRunSetup("live", () => {
        hostSetOpts(
          this.mapChoice,
          this.maxTurrets,
          this.startingGold,
          this.wavesToWin,
          this.friendlyFire,
        );
      });
    }

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
      hostSetMode(lobby.mode);
      hostSetOpts(
        this.mapChoice,
        this.maxTurrets,
        this.startingGold,
        this.wavesToWin,
        this.friendlyFire,
      );
      const mapId = resolveMapChoice(this.mapChoice);
      const msg = hostStartMatch(
        mapId,
        this.maxTurrets,
        this.startingGold,
        this.wavesToWin,
        this.friendlyFire,
      );
      if (msg) this.cbs.onMatchStart(msg, mySlot, true);
    });

    void lobbyFull;
    void lobbyBalanced;
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
