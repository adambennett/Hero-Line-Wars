import { HERO_LIST, HEROES, type HeroId } from "../data/heroes";
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

  private renderHub(): void {
    const modes = (Object.keys(MODE_LABEL) as MatchMode[])
      .map(
        (m) =>
          `<option value="${m}" ${m === this.mode ? "selected" : ""}>${MODE_LABEL[m]}</option>`,
      )
      .join("");

    this.root.innerHTML = `
      <div class="menu-shell mp-shell">
        <header class="menu-header compact">
          <button type="button" class="menu-back" id="mp-back">← Back</button>
          <h1 class="menu-title">Online Lobby</h1>
          <p class="menu-sub">PeerJS P2P · host-authoritative · all five modes</p>
        </header>
        <label class="field-label" for="mp-name">Display name</label>
        <input id="mp-name" class="menu-input" maxlength="18" value="${escapeAttr(this.name)}" />
        <section class="menu-section">
          <h2>Mode</h2>
          <select id="mp-mode" class="menu-input">${modes}</select>
        </section>
        <section class="menu-section">
          <h2>Lobby</h2>
          <div class="choice-row">
            <button type="button" class="chip ${this.privacy === "private" ? "selected" : ""}" id="priv-private">Private</button>
            <button type="button" class="chip ${this.privacy === "public" ? "selected" : ""}" id="priv-public">Public</button>
          </div>
          <div class="choice-row">
            <button type="button" class="chip ${this.role === "host" ? "selected" : ""}" id="role-host">Host</button>
            <button type="button" class="chip ${this.role === "join" ? "selected" : ""}" id="role-join">Join</button>
          </div>
        </section>
        <div id="mp-hub-body"></div>
        <p class="menu-footnote" id="mp-status">${this.statusHtml || "Pick Host or Join to connect."}</p>
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

    const body = this.root.querySelector("#mp-hub-body")!;
    if (this.role === "host") {
      const mapOpts = [
        `<option value="random">Random map</option>`,
        ...MAP_LIST.map(
          (m) =>
            `<option value="${m.id}" ${this.mapChoice === m.id ? "selected" : ""}>${escapeAttr(m.name)}</option>`,
        ),
      ].join("");
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
      body.innerHTML = `
        <label class="field-label" for="mp-map">Map (host)</label>
        <select id="mp-map" class="menu-input">${mapOpts}</select>
        <label class="setting-row"><span>Max turrets <em id="mp-turret-label">${this.maxTurrets}</em></span>
          <input type="range" id="mp-turrets" min="1" max="6" value="${this.maxTurrets}" />
        </label>
        <label class="setting-row"><span>Starting gold</span>
          <select id="mp-gold">${goldOpts}</select>
        </label>
        <label class="setting-row"><span>Waves to win</span>
          <select id="mp-waves">${waveOpts}</select>
        </label>
        <label class="setting-row"><span>Friendly fire</span>
          <select id="mp-ff">
            <option value="0" ${!this.friendlyFire ? "selected" : ""}>Off</option>
            <option value="1" ${this.friendlyFire ? "selected" : ""}>On</option>
          </select>
        </label>
        <button type="button" class="menu-btn primary wide" id="mp-go" ${this.busy ? "disabled" : ""}>
          ${this.privacy === "public" ? "Create public lobby" : "Create private lobby"}
        </button>
      `;
      body.querySelector("#mp-turrets")!.addEventListener("input", (e) => {
        this.maxTurrets = Number((e.target as HTMLInputElement).value) || 3;
        const lab = body.querySelector("#mp-turret-label");
        if (lab) lab.textContent = String(this.maxTurrets);
      });
      body.querySelector("#mp-map")!.addEventListener("change", (e) => {
        this.mapChoice = (e.target as HTMLSelectElement).value as MapId | "random";
      });
      body.querySelector("#mp-gold")!.addEventListener("change", (e) => {
        this.startingGold = Number((e.target as HTMLSelectElement).value) || STARTING_GOLD;
      });
      body.querySelector("#mp-waves")!.addEventListener("change", (e) => {
        this.wavesToWin = Number((e.target as HTMLSelectElement).value);
      });
      body.querySelector("#mp-ff")!.addEventListener("change", (e) => {
        this.friendlyFire = (e.target as HTMLSelectElement).value === "1";
      });
      body.querySelector("#mp-go")!.addEventListener("click", () => void this.doHost());
    } else if (this.privacy === "public") {
      body.innerHTML = `
        <p class="menu-sub">Searches open public lobbies for this mode.</p>
        <button type="button" class="menu-btn primary wide" id="mp-go" ${this.busy ? "disabled" : ""}>Find match</button>
      `;
      body.querySelector("#mp-go")!.addEventListener("click", () => void this.doFindPublic());
    } else {
      body.innerHTML = `
        <label class="field-label" for="mp-join">Host lobby code</label>
        <input id="mp-join" class="menu-input" maxlength="16" value="${escapeAttr(this.joinCode)}" placeholder="ABC123" />
        <button type="button" class="menu-btn primary wide" id="mp-go" ${this.busy ? "disabled" : ""}>Join lobby</button>
      `;
      body.querySelector("#mp-join")!.addEventListener("input", (e) => {
        this.joinCode = (e.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      });
      body.querySelector("#mp-go")!.addEventListener("click", () => void this.doJoin());
    }
  }

  private async doHost(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.captureName();
    const code = await quickHost(
      this.mode,
      this.name,
      this.heroId,
      this.privacy,
      this.mapChoice,
      this.maxTurrets,
      undefined,
      this.startingGold,
      this.wavesToWin,
      this.friendlyFire,
    );
    this.busy = false;
    if (!code) this.refresh();
    else this.refresh();
  }

  private async doJoin(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.captureName();
    await quickJoin(this.joinCode, this.name, this.heroId);
    this.busy = false;
    this.refresh();
  }

  private async doFindPublic(): Promise<void> {
    if (this.busy) return;
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

  private renderLobby(lobby: LobbyState, mySlot: number, mode: NetMode): void {
    const cap = modeCap(lobby.mode);
    const seats = Array.from({ length: cap }, (_, i) => {
      const s = lobbySeat(lobby, i);
      if (!s) {
        return `<li class="mp-seat empty">Seat ${i + 1} — open</li>`;
      }
      const you = s.slot === mySlot ? " (you)" : "";
      const team =
        isPveMode(lobby.mode) ? "Co-op" : s.team === 0 ? "Team A" : "Team B";
      const ready = s.ready ? "✓ ready" : "…";
      const hero = HEROES[s.heroId]?.name ?? s.heroId;
      return `<li class="mp-seat ${s.slot === mySlot ? "you" : ""}"><strong>${escapeAttr(s.name)}${you}</strong> · ${team} · ${escapeAttr(hero)} · ${ready}</li>`;
    }).join("");

    const heroChips = HERO_LIST.map(
      (h) =>
        `<button type="button" class="chip ${this.heroId === h.id ? "selected" : ""}" data-hero="${h.id}">${escapeAttr(h.name)}</button>`,
    ).join("");

    const need = teamNeed(lobby.mode);
    const bal = isPveMode(lobby.mode)
      ? `${lobby.slots.length}/${cap} players`
      : `A ${lobbyTeamCount(lobby, 0)}/${need} · B ${lobbyTeamCount(lobby, 1)}/${need}`;

    const canStart = mode === "host" && canStartMatch();
    const mySeat = lobbySeat(lobby, mySlot);
    const amReady = mySeat?.ready ?? false;

    this.root.innerHTML = `
      <div class="menu-shell mp-shell">
        <header class="menu-header compact">
          <button type="button" class="menu-back" id="mp-leave">← Leave</button>
          <h1 class="menu-title">${MODE_LABEL[lobby.mode]}</h1>
          <p class="menu-sub">Code <code class="lobby-code">${escapeAttr(lobby.code ?? "—")}</code> · ${bal}</p>
        </header>
        <section class="menu-section">
          <h2>Players</h2>
          <ul class="mp-seat-list">${seats}</ul>
        </section>
        <section class="menu-section">
          <h2>Your hero</h2>
          <div class="choice-row wrap">${heroChips}</div>
        </section>
        ${
          !isPveMode(lobby.mode)
            ? `<div class="menu-footer"><button type="button" class="menu-btn ghost" id="mp-team">Switch team</button></div>`
            : ""
        }
        ${
          mode === "host"
            ? `<section class="menu-section muted-box">
                <p class="menu-sub">Host: map ${escapeAttr(String(lobby.mapChoice))} · turrets ${lobby.maxTurrets} · gold ${lobby.startingGold} · waves ${lobby.wavesToWin <= 0 ? "∞" : lobby.wavesToWin}${lobby.friendlyFire ? " · FF on" : ""}</p>
                <button type="button" class="menu-btn primary wide" id="mp-start" ${canStart ? "" : "disabled"}>
                  ${canStart ? "Start match" : `Waiting (${lobbyReadyCount(lobby)}/${cap} ready, full & balanced)`}
                </button>
              </section>`
            : `<p class="menu-sub">Waiting for host to start…</p>`
        }
        <div class="menu-footer stack">
          <button type="button" class="menu-btn ${amReady ? "ghost" : "primary"} wide" id="mp-ready">
            ${amReady ? "Unready" : "Ready"}
          </button>
        </div>
        <p class="menu-footnote" id="mp-status">${this.statusHtml}</p>
      </div>
    `;

    this.root.querySelector("#mp-leave")!.addEventListener("click", () => {
      disconnectNet();
      this.cbs.onBack();
    });
    this.root.querySelectorAll<HTMLElement>("[data-hero]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.heroId = btn.dataset.hero as HeroId;
        localPickHero(this.heroId);
        this.refresh();
      });
    });
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
        lobby.mapChoice,
        lobby.maxTurrets,
        lobby.startingGold,
        lobby.wavesToWin,
        lobby.friendlyFire,
      );
      const mapId = resolveMapChoice(lobby.mapChoice);
      const msg = hostStartMatch(
        mapId,
        lobby.maxTurrets,
        lobby.startingGold,
        lobby.wavesToWin,
        lobby.friendlyFire,
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
