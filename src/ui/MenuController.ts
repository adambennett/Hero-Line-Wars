import { HERO_LIST, type HeroId } from "../data/heroes";
import { MAP_LIST, type MapId } from "../data/maps";
import { MAP_H, MAP_W } from "../data/constants";
import { RELIC_LIST } from "../data/relics";
import { SHOP_ITEMS } from "../data/shop";
import { SEND_PACKS } from "../data/send";
import { ENEMY_DEFS, isBossKind, isEliteKind, type EnemyKind } from "../data/enemies";
import { RARITY_LABEL, RARITY_COLOR, RARITY_ORDER, type Rarity } from "../data/rarity";
import { DEFAULT_MAX_TURRETS } from "../data/turrets";
import { STARTING_GOLD, WIN_WAVES } from "../data/constants";
import type { RunOptions } from "../game/state";
import type { MatchMode, MatchPrivacy } from "../net/types";
import {
  ACTION_HINTS,
  ACTION_LABELS,
  ALL_BINDABLE,
  COMBAT_ACTIONS,
  DAMAGE_FX_LABELS,
  DEFAULT_GAMEPAD,
  DEFAULT_KEYBINDS,
  MOVE_ACTIONS,
  UTILITY_ACTIONS,
  bindingEquals,
  formatBinding,
  loadSettings,
  saveSettings,
  type Binding,
  type BindableAction,
  type ClientSettingsFull,
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
  getCareerStats,
  getRank,
  isHeroUnlocked,
  loadMetaStore,
  purchaseUpgrade,
} from "../meta/store";
import { META_UPGRADES, nextCost } from "../meta/upgrades";
import {
  CHALLENGES,
  challengeProgressHint,
  isChallengeComplete,
} from "../meta/challenges";
import {
  areCheatsEnabled,
  disableCheats,
  enableCheats,
  loadCheatOptions,
  updateCheatOption,
  type CheatOptions,
} from "../meta/cheats";
import { downloadSaveExport, importSaveFromFile } from "../meta/saveio";
import { isMapUnlocked } from "../meta/contentLocks";
import { unlockAudio } from "../systems/audio";
import { listCustomHeroes, listCustomMaps, resolveHero, resolveMap } from "../custom/registry";
import { isCustomHeroId } from "../custom/types";
import { MapEditorPanel } from "./MapEditorPanel";
import { HeroEditorPanel } from "./HeroEditorPanel";
import {
  formatCompact,
  formatDuration,
  topEntries,
  winRate,
  type CareerStats,
} from "../meta/careerStats";
import { MainMenuFx } from "./mainMenuFx";

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
  | "barracks"
  | "challenges"
  | "cheats"
  | "map-editor"
  | "hero-editor"
  | "stats";

type StatsTab = "overview" | "combat" | "economy" | "progress" | "favorites";

export type MatchRole = "host" | "join";

export type LobbyDraft = {
  mode: MatchMode;
  privacy: MatchPrivacy;
  role: MatchRole;
  joinCode: string;
  hostCode: string;
  mapChoice: MapId | string | "random";
  maxTurrets: number;
  startingGold: number;
  /** 0 = unlimited. */
  wavesToWin: number;
  friendlyFire: boolean;
  /** Level for global utility draft; 0 = Never. */
  utilityDraftLevel: number;
};

export type MenuCallbacks = {
  onStartSingleplayer: (heroId: HeroId, opts?: Partial<RunOptions>) => void;
  onOpenMultiplayer: (draft: LobbyDraft, heroId: HeroId) => void;
  onSettingsChanged?: () => void;
  onRunOptionsChanged?: (opts: Partial<RunOptions>) => void;
};

type CompTab = "heroes" | "items" | "relics" | "enemies" | "sends" | "maps" | "ascensions";

const MODE_OPTIONS: { id: MatchMode; label: string; hint: string }[] = [
  { id: "1v1", label: "1v1 PvP", hint: "One hero per side" },
  { id: "2v2", label: "2v2 PvP", hint: "Two allies, shared lane" },
  { id: "3v3", label: "3v3 PvP", hint: "Three allies, shared lane" },
  { id: "2p-pve", label: "2 Player PvE", hint: "Co-op vs AI" },
  { id: "3p-pve", label: "3 Player PvE", hint: "Co-op vs AI" },
];

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
    utilityDraftLevel: 10,
  };
  private spMapChoice: MapId | string | "random" = "random";
  private spMaxTurrets = DEFAULT_MAX_TURRETS;
  private spStartingGold = STARTING_GOLD;
  private spWavesToWin = WIN_WAVES;
  private spFriendlyFire = false;
  private spAscension = 0;
  private spTeamSize: 1 | 2 | 3 = 1;
  private spEndless = false;
  private spChestOpenMul = 1;
  private spChestDespawnSec = 28;
  private spChestSpawnChance = 0.08;
  private spEnemyDensity = 1;
  private spEnemyHp = 1;
  private spEnemySpeed = 1;
  private spIncomeMul = 1;
  private spRespawnMul = 1;
  private spStartingBase = 0;
  private spLevelDraftSize = 3;
  private spRelicDraftSize = 3;
  private spUtilityDraftLevel = 10;
  private spDisableArtifacts = false;
  private spDisableChests = false;
  private spDisableElites = false;
  private spDisableBosses = false;
  private spDisableShop = false;
  private spDisableSends = false;
  private spDisableRelics = false;
  private spFogAlways = false;
  private spDoubleElites = false;
  private spSuddenDeath = 0;
  private spAllyAi = 1;
  private settings: ClientSettingsFull = loadSettings();
  private compendiumTab: CompTab = "heroes";
  private compSearch = "";
  private compRarity: Rarity | "all" = "all";
  private compSort: "name" | "rarity" = "rarity";
  private toast = "";
  private rebinding: BindableAction | null = null;
  private rebindingPad = false;
  private unbindListen: (() => void) | null = null;
  private trainProgress: TrainProgress | null = null;
  private readonly mapEditor = new MapEditorPanel();
  private readonly heroEditor = new HeroEditorPanel();
  private statsTab: StatsTab = "overview";
  private readonly mainFx = new MainMenuFx();
  private cheatOpts: CheatOptions = loadCheatOptions();

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
    this.mainFx.stop();
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

    if (action.startsWith("me-") && this.mapEditor.handleAction(action, t)) {
      this.render();
      return;
    }
    if (action.startsWith("he-") && this.heroEditor.handleAction(action, t)) {
      this.render();
      return;
    }
    if (action === "stats-tab") {
      this.statsTab = (t.dataset.tab as StatsTab) || "overview";
      this.render();
      return;
    }

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
        if (!isCustomHeroId(this.selectedHero) && !isHeroUnlocked(this.selectedHero)) {
          this.setToast("Commission that hero in the Barracks first.");
          break;
        }
        this.callbacks.onStartSingleplayer(this.selectedHero, {
          mapId: this.spMapChoice,
          maxTurrets: this.spMaxTurrets,
          startingGold: this.spStartingGold,
          wavesToWin: this.spEndless ? 0 : this.spWavesToWin,
          friendlyFire: this.spEndless ? false : this.spFriendlyFire,
          ascension: this.spAscension,
          teamSize: this.spEndless ? 1 : this.spTeamSize,
          endless: this.spEndless,
          chestOpenMul: this.spChestOpenMul,
          chestDespawnSec: this.spChestDespawnSec,
          chestSpawnChance: this.spChestSpawnChance,
          enemyDensityMul: this.spEnemyDensity,
          enemyHpMul: this.spEnemyHp,
          enemySpeedMul: this.spEnemySpeed,
          incomeMul: this.spIncomeMul,
          respawnMul: this.spRespawnMul,
          startingBaseLevel: this.spStartingBase,
          levelDraftSize: this.spLevelDraftSize,
          relicDraftSize: this.spRelicDraftSize,
          utilityDraftLevel: this.spUtilityDraftLevel,
          disableArtifacts: this.spDisableArtifacts,
          disableChests: this.spDisableChests,
          disableElites: this.spDisableElites,
          disableBosses: this.spDisableBosses,
          disableShop: this.spDisableShop,
          disableSends: this.spDisableSends,
          disableRelics: this.spDisableRelics,
          fogAlways: this.spFogAlways,
          doubleElites: this.spDoubleElites,
          suddenDeathBaseHp: this.spSuddenDeath > 0 ? this.spSuddenDeath : undefined,
          allyAiAggression: this.spAllyAi,
          sharedFriendlyFire: this.spFriendlyFire && this.spTeamSize > 1,
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
          gamepadEnabled: true,
          gamepadBinds: { ...DEFAULT_GAMEPAD },
        };
        this.persist();
        this.setToast("Settings reset.");
        break;
      case "reset-binds":
        this.settings.keybinds = { ...DEFAULT_KEYBINDS };
        this.settings.gamepadBinds = { ...DEFAULT_GAMEPAD };
        this.persist();
        this.setToast("Controls reset to defaults.");
        break;
      case "rebind":
        this.rebindingPad = false;
        this.beginRebind(t.dataset.bind as BindableAction);
        break;
      case "rebind-pad":
        this.rebindingPad = true;
        this.beginRebind(t.dataset.bind as BindableAction);
        break;
      case "export-save":
        downloadSaveExport({ includeSettings: true, includeAi: true });
        this.setToast("Save exported.");
        break;
      case "import-save":
        {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "application/json,.json";
          input.addEventListener("change", () => {
            const file = input.files?.[0];
            if (!file) return;
            if (!confirm("Import will overwrite local meta progress. Continue?")) return;
            void importSaveFromFile(file).then((res) => {
              this.setToast(res.message);
              if (res.ok) this.render();
            });
          });
          input.click();
        }
        break;
      case "toggle-cheats":
        if (areCheatsEnabled()) {
          disableCheats();
          this.setToast("Cheats off — real profile restored.");
        } else {
          if (
            !confirm(
              "Cheats use a SEPARATE sandbox profile. Your real Barracks progress is cached and restored when you turn cheats off. Continue?",
            )
          )
            break;
          enableCheats();
          this.setToast("Cheats on — sandbox profile active.");
        }
        this.cheatOpts = loadCheatOptions();
        this.render();
        break;
      case "cheat-opt":
        // Handled via change on checkbox; ignore click toggle race
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

  private beginRebind(action: BindableAction): void {
    this.stopRebindListen();
    this.rebinding = action;
    this.render();

    const onKey = (ev: KeyboardEvent) => {
      if (this.rebindingPad) return;
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
      if (this.rebindingPad) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.button > 2) return;
      this.applyBinding(action, { device: "mouse", button: ev.button as 0 | 1 | 2 });
    };
    let padPoll: number | null = null;
    if (this.rebindingPad) {
      const prev = new Map<number, boolean>();
      padPoll = window.setInterval(() => {
        const pads = navigator.getGamepads?.() ?? [];
        const pad = pads.find((p) => p) ?? null;
        if (!pad) return;
        for (let i = 0; i < pad.buttons.length; i++) {
          const pressed = !!pad.buttons[i]?.pressed;
          if (pressed && !prev.get(i)) {
            this.applyBinding(action, { device: "gamepad", button: i });
            if (padPoll != null) clearInterval(padPoll);
            return;
          }
          prev.set(i, pressed);
        }
      }, 50);
    }

    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onMouse, true);
    this.unbindListen = () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onMouse, true);
      if (padPoll != null) clearInterval(padPoll);
      this.rebinding = null;
      this.rebindingPad = false;
      this.unbindListen = null;
    };
  }

  private applyBinding(action: BindableAction, binding: Binding): void {
    if (binding.device === "gamepad") {
      this.settings.gamepadBinds[action] = binding;
    } else {
      for (const other of ALL_BINDABLE) {
        if (other === action) continue;
        if (bindingEquals(this.settings.keybinds[other], binding)) {
          this.settings.keybinds[other] = this.settings.keybinds[action];
        }
      }
      this.settings.keybinds[action] = binding;
    }
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
      this.lobby.maxTurrets = Math.max(1, Math.min(10, Number(el.value) || DEFAULT_MAX_TURRETS));
      this.emitLobbyOpts();
      const label = this.root.querySelector("#mp-turret-label");
      if (label) label.textContent = String(this.lobby.maxTurrets);
    }
    if (el.dataset.field === "sp-turrets") {
      this.spMaxTurrets = Math.max(1, Math.min(10, Number(el.value) || DEFAULT_MAX_TURRETS));
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
      utilityDraftLevel: this.lobby.utilityDraftLevel,
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
    } else if (el.dataset.field === "mp-utility-level") {
      this.lobby.utilityDraftLevel = Number(el.value);
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
      this.spMaxTurrets = Math.max(1, Math.min(10, Number(el.value) || DEFAULT_MAX_TURRETS));
    } else if (el.dataset.field === "sp-ascension") {
      this.spAscension = Number(el.value) || 0;
      this.paintSpRunMeta();
    } else if (el.dataset.field === "sp-map") {
      this.spMapChoice = el.value as MapId | string | "random";
    } else if (el.dataset.field === "sp-team-size") {
      if (el.value === "endless") {
        this.spEndless = true;
        this.spTeamSize = 1;
      } else {
        this.spEndless = false;
        this.spTeamSize = (Number(el.value) || 1) as 1 | 2 | 3;
      }
      this.render();
    } else if (el.dataset.field === "sp-chest-open") {
      this.spChestOpenMul = Number(el.value) || 1;
    } else if (el.dataset.field === "sp-chest-despawn") {
      this.spChestDespawnSec = Number(el.value) || 28;
    } else if (el.dataset.field === "sp-chest-chance") {
      this.spChestSpawnChance = Number(el.value) || 0.08;
    } else if (el.dataset.field === "sp-enemy-density") {
      this.spEnemyDensity = Number(el.value) || 1;
    } else if (el.dataset.field === "sp-enemy-hp") {
      this.spEnemyHp = Number(el.value) || 1;
    } else if (el.dataset.field === "sp-enemy-speed") {
      this.spEnemySpeed = Number(el.value) || 1;
    } else if (el.dataset.field === "sp-income") {
      this.spIncomeMul = Number(el.value) || 1;
    } else if (el.dataset.field === "sp-respawn") {
      this.spRespawnMul = Number(el.value) || 1;
    } else if (el.dataset.field === "sp-start-base") {
      this.spStartingBase = Number(el.value) || 0;
    } else if (el.dataset.field === "sp-level-draft") {
      this.spLevelDraftSize = Number(el.value) || 3;
    } else if (el.dataset.field === "sp-relic-draft") {
      this.spRelicDraftSize = Number(el.value) || 3;
    } else if (el.dataset.field === "sp-utility-level") {
      this.spUtilityDraftLevel = Number(el.value);
    } else if (el.dataset.field === "sp-ally-ai") {
      this.spAllyAi = Number(el.value) || 1;
    } else if (el.dataset.field === "sp-sudden") {
      this.spSuddenDeath = Number(el.value) || 0;
    } else if (el.dataset.field === "sp-no-art") {
      this.spDisableArtifacts = (el as HTMLInputElement).checked;
    } else if (el.dataset.field === "sp-no-chest") {
      this.spDisableChests = (el as HTMLInputElement).checked;
    } else if (el.dataset.field === "sp-no-elite") {
      this.spDisableElites = (el as HTMLInputElement).checked;
    } else if (el.dataset.field === "sp-no-boss") {
      this.spDisableBosses = (el as HTMLInputElement).checked;
    } else if (el.dataset.field === "sp-no-shop") {
      this.spDisableShop = (el as HTMLInputElement).checked;
    } else if (el.dataset.field === "sp-no-send") {
      this.spDisableSends = (el as HTMLInputElement).checked;
    } else if (el.dataset.field === "sp-no-relic") {
      this.spDisableRelics = (el as HTMLInputElement).checked;
    } else if (el.dataset.field === "sp-fog") {
      this.spFogAlways = (el as HTMLInputElement).checked;
    } else if (el.dataset.field === "sp-dbl-elite") {
      this.spDoubleElites = (el as HTMLInputElement).checked;
    } else if ((el as HTMLInputElement).dataset.setting === "gamepadEnabled") {
      this.settings.gamepadEnabled = (el as HTMLInputElement).checked;
      this.persist();
    } else if ((el as HTMLInputElement).dataset.cheat) {
      const key = (el as HTMLInputElement).dataset.cheat as keyof CheatOptions;
      updateCheatOption(key, (el as HTMLInputElement).checked as never);
      this.cheatOpts = loadCheatOptions();
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
      case "challenges":
        body = this.renderChallenges();
        break;
      case "cheats":
        body = this.renderCheats();
        break;
      case "map-editor":
        body = this.mapEditor.render();
        break;
      case "hero-editor":
        body = this.heroEditor.render();
        break;
      case "stats":
        body = this.renderStats();
        break;
    }

    this.mainFx.stop();
    const isMain = this.screen === "main";
    this.root.innerHTML = `
      <div class="menu-backdrop${isMain ? " main-fx" : ""}">
        ${
          isMain
            ? `<div class="menu-aurora" aria-hidden="true"></div>
               <div class="menu-waves" aria-hidden="true"></div>
               <canvas id="menu-fx-canvas" aria-hidden="true"></canvas>`
            : ""
        }
      </div>
      <div class="menu-shell${isMain ? " main-shell" : ""}${this.screen === "singleplayer" || this.screen === "map-editor" || this.screen === "hero-editor" || this.screen === "stats" ? " tight" : ""}${this.screen === "map-editor" || this.screen === "hero-editor" ? " workshop-shell" : ""}${this.screen === "stats" ? " stats-shell" : ""}">
        ${body}
        ${toastHtml}
      </div>
    `;

    const shell = this.root.querySelector(".menu-shell");
    if (shell) shell.scrollTop = scroll;

    if (isMain) {
      const fxCanvas = this.root.querySelector<HTMLCanvasElement>("#menu-fx-canvas");
      if (fxCanvas) this.mainFx.start(fxCanvas);
    }

    if (this.screen === "compendium" && this.compendiumTab === "maps") {
      this.paintMapThumbs();
    }
    if (this.screen === "map-editor") this.mapEditor.bind(this.root);
    if (this.screen === "hero-editor") this.heroEditor.bind(this.root);

    const meImport = this.root.querySelector<HTMLInputElement>('input[data-action="me-import"]');
    if (meImport) {
      meImport.addEventListener("change", () => {
        const file = meImport.files?.[0];
        if (!file) return;
        void this.mapEditor.handleImport(file).then((err) => {
          if (err) this.setToast(err);
          else this.render();
        });
      });
    }
    const heImport = this.root.querySelector<HTMLInputElement>('input[data-action="he-import"]');
    if (heImport) {
      heImport.addEventListener("change", () => {
        const file = heImport.files?.[0];
        if (!file) return;
        void this.heroEditor.handleImport(file).then((err) => {
          if (err) this.setToast(err);
          else this.render();
        });
      });
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

  private renderStats(): string {
    const meta = loadMetaStore();
    const c = getCareerStats(meta);
    const tabs: { id: StatsTab; label: string }[] = [
      { id: "overview", label: "Overview" },
      { id: "combat", label: "Combat" },
      { id: "economy", label: "Economy" },
      { id: "progress", label: "Progress" },
      { id: "favorites", label: "Favorites" },
    ];
    const tabNav = tabs
      .map(
        (t) =>
          `<button type="button" class="stats-tab ${this.statsTab === t.id ? "active" : ""}" data-action="stats-tab" data-tab="${t.id}">${t.label}</button>`,
      )
      .join("");

    return `
      <header class="menu-header compact stats-header">
        <button type="button" class="menu-back" data-action="goto" data-screen="main">← Back</button>
        <div class="stats-header-text">
          <h1 class="menu-title">Career Stats</h1>
          <p class="menu-lead">Lifetime record across every finished run.</p>
        </div>
        <div class="stats-crest-pill" title="War Crests">
          <span>Crests</span>
          <strong>${formatCompact(meta.crests)}</strong>
        </div>
      </header>
      <div class="stats-hero-strip">
        <article class="stats-hero-card tone-win">
          <span class="stats-hero-label">Win rate</span>
          <strong>${c.runs ? winRate(c).toFixed(1) : "—"}%</strong>
          <em>${c.wins}W · ${c.losses}L · ${c.runs} runs</em>
        </article>
        <article class="stats-hero-card tone-wave">
          <span class="stats-hero-label">Best wave</span>
          <strong>${formatCompact(Math.max(c.bestWave, meta.bestWave))}</strong>
          <em>${formatCompact(c.wavesCleared)} waves cleared</em>
        </article>
        <article class="stats-hero-card tone-time">
          <span class="stats-hero-label">Time in runs</span>
          <strong>${formatDuration(c.playTimeSec)}</strong>
          <em>${formatCompact(meta.lifetimeCrests)} lifetime crests</em>
        </article>
        <article class="stats-hero-card tone-kill">
          <span class="stats-hero-label">Kills</span>
          <strong>${formatCompact(c.kills)}</strong>
          <em>${formatCompact(c.damageDealt)} damage dealt</em>
        </article>
      </div>
      <nav class="stats-tabs" aria-label="Stats sections">${tabNav}</nav>
      <div class="stats-panel">${this.renderStatsTab(c, meta.crests, meta.lifetimeCrests)}</div>
    `;
  }

  private renderStatsTab(c: CareerStats, crests: number, lifetimeCrests: number): string {
    const cell = (label: string, value: string, hint?: string) =>
      `<div class="stats-cell"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${hint ? `<em>${escapeHtml(hint)}</em>` : ""}</div>`;

    if (this.statsTab === "combat") {
      return `
        <div class="stats-grid two">
          <section class="stats-section accent-crimson">
            <h2>Offense</h2>
            <div class="stats-cells">
              ${cell("Damage dealt", formatCompact(c.damageDealt))}
              ${cell("Kills", formatCompact(c.kills))}
              ${cell("Boss kills", formatCompact(c.bossesKilled))}
              ${cell("Elite kills", formatCompact(c.elitesKilled))}
              ${cell("Basics fired", formatCompact(c.basicsFired))}
              ${cell("Abilities cast", formatCompact(c.abilitiesCast))}
            </div>
          </section>
          <section class="stats-section accent-slate">
            <h2>Survival</h2>
            <div class="stats-cells">
              ${cell("Damage taken", formatCompact(c.damageTaken))}
              ${cell("Base damage taken", formatCompact(c.baseDamageTaken))}
              ${cell("Healing done", formatCompact(c.healingDone))}
              ${cell("Deaths", formatCompact(c.deaths))}
              ${cell("Flawless wins", formatCompact(c.flawlessWins))}
              ${cell("Deaths / run", c.runs ? (c.deaths / c.runs).toFixed(2) : "—")}
            </div>
          </section>
        </div>`;
    }

    if (this.statsTab === "economy") {
      return `
        <div class="stats-grid two">
          <section class="stats-section accent-gold">
            <h2>Gold flow</h2>
            <div class="stats-cells">
              ${cell("From kills", formatCompact(c.goldFromKills))}
              ${cell("From income", formatCompact(c.goldFromIncome))}
              ${cell("Gold spent", formatCompact(c.goldSpent))}
              ${cell("Peak gold", formatCompact(c.peakGold))}
              ${cell("Peak income /s", formatCompact(c.peakIncome))}
              ${cell("Net from kills+income", formatCompact(c.goldFromKills + c.goldFromIncome))}
            </div>
          </section>
          <section class="stats-section accent-teal">
            <h2>Spending habits</h2>
            <div class="stats-cells">
              ${cell("Sends purchased", formatCompact(c.sends))}
              ${cell("Shop buys", formatCompact(c.shopBuys))}
              ${cell("Artifacts placed", formatCompact(c.artifactsPlaced))}
              ${cell("Base upgrades", formatCompact(c.baseUpgrades))}
              ${cell("Chests opened", formatCompact(c.chestsOpened))}
              ${cell("Crests on hand", formatCompact(crests), `${formatCompact(lifetimeCrests)} earned lifetime`)}
            </div>
          </section>
        </div>`;
    }

    if (this.statsTab === "progress") {
      return `
        <div class="stats-grid two">
          <section class="stats-section accent-violet">
            <h2>Run milestones</h2>
            <div class="stats-cells">
              ${cell("Best wave", formatCompact(c.bestWave))}
              ${cell("Waves cleared", formatCompact(c.wavesCleared))}
              ${cell("Highest hero Lv", formatCompact(c.highestHeroLevel))}
              ${cell("Highest base Lv", formatCompact(c.highestBaseLevel))}
              ${cell("Highest Asc played", `A${c.highestAscensionPlayed}`)}
              ${cell("Level drafts", formatCompact(c.levelDrafts))}
            </div>
          </section>
          <section class="stats-section accent-amber">
            <h2>Modes &amp; build</h2>
            <div class="stats-cells">
              ${cell("Endless runs", formatCompact(c.endlessRuns))}
              ${cell("Endless best wave", formatCompact(c.endlessBestWave))}
              ${cell("Relics collected", formatCompact(c.relicsCollected))}
              ${cell("Wins", formatCompact(c.wins))}
              ${cell("Losses", formatCompact(c.losses))}
              ${cell("Avg wave / run", c.runs ? (c.wavesCleared / c.runs).toFixed(1) : "—")}
            </div>
          </section>
        </div>`;
    }

    if (this.statsTab === "favorites") {
      const heroes = topEntries(c.heroRuns, 6);
      const heroWins = topEntries(c.heroWins, 6);
      const maps = topEntries(c.mapRuns, 6);
      const mapWaves = topEntries(c.mapBestWave, 6);
      const heroRow = (id: string, value: number, suffix: string) => {
        const h = resolveHero(id);
        return `<li class="stats-fav-row"><span class="swatch" style="background:${h.color}"></span><span class="name">${escapeHtml(h.name)}</span><strong>${formatCompact(value)} ${suffix}</strong></li>`;
      };
      const mapRow = (id: string, value: number, suffix: string) => {
        const m = resolveMap(id);
        return `<li class="stats-fav-row"><span class="swatch map"></span><span class="name">${escapeHtml(m.name)}</span><strong>${formatCompact(value)} ${suffix}</strong></li>`;
      };
      return `
        <div class="stats-grid two">
          <section class="stats-section accent-sky">
            <h2>Most played heroes</h2>
            <ul class="stats-fav-list">${heroes.length ? heroes.map((e) => heroRow(e.id, e.value, "runs")).join("") : `<li class="stats-empty">Play a run to begin tracking.</li>`}</ul>
          </section>
          <section class="stats-section accent-mint">
            <h2>Most wins by hero</h2>
            <ul class="stats-fav-list">${heroWins.length ? heroWins.map((e) => heroRow(e.id, e.value, "wins")).join("") : `<li class="stats-empty">No wins recorded yet.</li>`}</ul>
          </section>
          <section class="stats-section accent-rose">
            <h2>Maps played</h2>
            <ul class="stats-fav-list">${maps.length ? maps.map((e) => mapRow(e.id, e.value, "runs")).join("") : `<li class="stats-empty">No map history yet.</li>`}</ul>
          </section>
          <section class="stats-section accent-indigo">
            <h2>Best wave by map</h2>
            <ul class="stats-fav-list">${mapWaves.length ? mapWaves.map((e) => mapRow(e.id, e.value, "wave")).join("") : `<li class="stats-empty">No map peaks yet.</li>`}</ul>
          </section>
        </div>`;
    }

    // overview
    const dmgPerKill = c.kills > 0 ? c.damageDealt / c.kills : 0;
    return `
      <div class="stats-grid two">
        <section class="stats-section accent-ember">
          <h2>At a glance</h2>
          <div class="stats-cells">
            ${cell("Runs finished", formatCompact(c.runs))}
            ${cell("Win rate", c.runs ? `${winRate(c).toFixed(1)}%` : "—")}
            ${cell("Time played", formatDuration(c.playTimeSec))}
            ${cell("Flawless wins", formatCompact(c.flawlessWins))}
            ${cell("Endless best", formatCompact(c.endlessBestWave))}
            ${cell("Avg dmg / kill", formatCompact(dmgPerKill))}
          </div>
        </section>
        <section class="stats-section accent-steel">
          <h2>Pressure &amp; tempo</h2>
          <div class="stats-cells">
            ${cell("Damage dealt", formatCompact(c.damageDealt))}
            ${cell("Damage taken", formatCompact(c.damageTaken))}
            ${cell("Gold earned*", formatCompact(c.goldFromKills + c.goldFromIncome), "*kills + income")}
            ${cell("Sends", formatCompact(c.sends))}
            ${cell("Shop buys", formatCompact(c.shopBuys))}
            ${cell("Abilities cast", formatCompact(c.abilitiesCast))}
          </div>
        </section>
      </div>
      <p class="stats-footnote">Stats update when a run ends (solo, endless, and offline solo-vs-AI). Older saves backfill wins/runs/best wave only.</p>`;
  }

  private renderMain(): string {
    return `
      <header class="menu-header main-hero">
        <h1 class="menu-title brand-title" aria-label="Hero Line Wars">
          <span class="brand-line">
            <span class="brand-word" data-text="Hero">Hero</span>
            <span class="brand-word accent" data-text="Line">Line</span>
          </span>
          <span class="brand-line">
            <span class="brand-word wars" data-text="Wars">Wars</span>
          </span>
        </h1>
        <div class="menu-sub brand-sub">
          <p>Hold the line.</p>
          <p>Grow your income.</p>
          <p>Outlast the waves.</p>
        </div>
      </header>

      <nav class="main-menu-grid" aria-label="Main menu">
        <section class="main-group play">
          <h2 class="main-group-label">Play</h2>
          <div class="main-group-btns play-btns">
            <button type="button" class="menu-btn primary shine-btn play-card" data-action="goto" data-screen="singleplayer">
              <span class="btn-label">Singleplayer</span>
              <span class="btn-hint">Solo runs, endless, Ascension</span>
            </button>
            <button type="button" class="menu-btn shine-btn play-card" data-action="goto" data-screen="multiplayer">
              <span class="btn-label">Multiplayer</span>
              <span class="btn-hint">Lobby codes &amp; online lanes</span>
            </button>
          </div>
        </section>

        <section class="main-group progress">
          <h2 class="main-group-label">Progress</h2>
          <div class="main-group-btns cols-3">
            <button type="button" class="menu-btn shine-btn" data-action="goto" data-screen="barracks"><span class="btn-label">Barracks</span></button>
            <button type="button" class="menu-btn shine-btn" data-action="goto" data-screen="stats"><span class="btn-label">Stats</span></button>
            <button type="button" class="menu-btn shine-btn" data-action="goto" data-screen="challenges"><span class="btn-label">Challenges</span></button>
          </div>
        </section>

        <section class="main-group workshop">
          <h2 class="main-group-label">Workshop</h2>
          <div class="main-group-btns cols-3">
            <button type="button" class="menu-btn shine-btn" data-action="goto" data-screen="map-editor"><span class="btn-label">Map Editor</span></button>
            <button type="button" class="menu-btn shine-btn" data-action="goto" data-screen="hero-editor"><span class="btn-label">Hero Editor</span></button>
            <button type="button" class="menu-btn shine-btn" data-action="goto" data-screen="ai-lab"><span class="btn-label">AI Lab</span></button>
          </div>
        </section>

        <section class="main-group library">
          <h2 class="main-group-label">Library</h2>
          <div class="main-group-btns cols-2">
            <button type="button" class="menu-btn shine-btn" data-action="goto" data-screen="compendium"><span class="btn-label">Compendium</span></button>
            <button type="button" class="menu-btn shine-btn" data-action="goto" data-screen="game-info"><span class="btn-label">Game Info</span></button>
          </div>
        </section>

        <section class="main-group system">
          <div class="main-group-btns system-btns">
            <button type="button" class="menu-btn shine-btn" data-action="goto" data-screen="settings"><span class="btn-label">Settings</span></button>
            <button type="button" class="menu-btn ghost shine-btn" data-action="goto" data-screen="cheats"><span class="btn-label">Cheats</span></button>
            <button type="button" class="menu-btn ghost shine-btn" data-action="quit"><span class="btn-label">Quit</span></button>
          </div>
        </section>
      </nav>
    `;
  }

  private runOptionsFields(scope: "sp" | "mp"): string {
    const turrets = scope === "sp" ? this.spMaxTurrets : this.lobby.maxTurrets;
    const gold = scope === "sp" ? this.spStartingGold : this.lobby.startingGold;
    const waves = scope === "sp" ? this.spWavesToWin : this.lobby.wavesToWin;
    const ff = scope === "sp" ? this.spFriendlyFire : this.lobby.friendlyFire;
    const goldOpts = [0, 10, 45, 50, 60, 80, 100, 150, 200, 500, 1000]
      .map(
        (g) =>
          `<option value="${g}" ${gold === g ? "selected" : ""}>${g}${g === STARTING_GOLD ? " (default)" : ""}</option>`,
      )
      .join("");
    const waveOpts = [1, 2, 3, 5, 8, 10, 12, 15, 20, 25, 50, 100, 500, 0]
      .map((w) => {
        const label = w === 0 ? "Unlimited" : String(w);
        const def = w === WIN_WAVES ? " (default)" : "";
        return `<option value="${w}" ${waves === w ? "selected" : ""}>${label}${def}</option>`;
      })
      .join("");
    const turretOpts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      .map(
        (n) =>
          `<option value="${n}" ${turrets === n ? "selected" : ""}>${n}${n === DEFAULT_MAX_TURRETS ? " (default)" : ""}</option>`,
      )
      .join("");
    const showFf =
      scope === "mp" ? this.lobby.mode !== "1v1" : !this.spEndless && this.spTeamSize > 1;
    const ffField = showFf
      ? `<label class="run-field">
            <span>Friendly fire</span>
            <select data-field="${scope}-friendly-fire">
              <option value="0" ${!ff ? "selected" : ""}>Off</option>
              <option value="1" ${ff ? "selected" : ""}>On</option>
            </select>
          </label>`
      : "";
    if (scope === "sp") {
      const teamOpts = [
        ...[1, 2, 3].map(
          (n) =>
            `<option value="${n}" ${!this.spEndless && this.spTeamSize === n ? "selected" : ""}>${n}v${n}${n === 1 ? " (classic)" : " (+ AI allies)"}</option>`,
        ),
        `<option value="endless" ${this.spEndless ? "selected" : ""}>Endless (solo survival)</option>`,
      ].join("");
      const openOpts = [0.75, 1, 1.25, 1.5, 2]
        .map(
          (n) =>
            `<option value="${n}" ${this.spChestOpenMul === n ? "selected" : ""}>${n}× open time</option>`,
        )
        .join("");
      const despawnOpts = [12, 20, 28, 40, 60]
        .map(
          (n) =>
            `<option value="${n}" ${this.spChestDespawnSec === n ? "selected" : ""}>${n}s despawn</option>`,
        )
        .join("");
      const chanceOpts = [0.04, 0.08, 0.12, 0.2]
        .map(
          (n) =>
            `<option value="${n}" ${this.spChestSpawnChance === n ? "selected" : ""}>${Math.round(n * 100)}% chance</option>`,
        )
        .join("");
      const wavesField = this.spEndless
        ? `<label class="run-field">
            <span>Waves to win</span>
            <select disabled title="Endless runs until your base falls">
              <option selected>Until you fall</option>
            </select>
          </label>`
        : `<label class="run-field">
            <span>Waves to win</span>
            <select data-field="sp-waves-to-win">${waveOpts}</select>
          </label>`;
      return `
        <div class="run-grid cols-4">
          <label class="run-field">
            <span>Mode</span>
            <select data-field="sp-team-size">${teamOpts}</select>
          </label>
          <label class="run-field">
            <span>Artifacts</span>
            <select data-field="sp-turrets">${turretOpts}</select>
          </label>
          <label class="run-field">
            <span>Starting gold</span>
            <select data-field="sp-starting-gold">${goldOpts}</select>
          </label>
          ${wavesField}
          ${ffField}
        </div>
        ${
          this.spEndless
            ? `<p class="panel-note" style="margin:8px 0 0">Endless: no enemy lane. Sends queue into <em>your</em> next wave for income — fight what you buy.</p>`
            : ""
        }
        <div class="run-grid cols-3" style="margin-top:8px">
          <label class="run-field">
            <span>Chest open</span>
            <select data-field="sp-chest-open">${openOpts}</select>
          </label>
          <label class="run-field">
            <span>Chest despawn</span>
            <select data-field="sp-chest-despawn">${despawnOpts}</select>
          </label>
          <label class="run-field">
            <span>Chest spawn</span>
            <select data-field="sp-chest-chance">${chanceOpts}</select>
          </label>
        </div>
        <details class="muted-box" style="margin-top:10px">
          <summary>Creative options</summary>
          <div class="run-grid cols-4" style="margin-top:8px">
            <label class="run-field"><span>Enemy density</span>
              <select data-field="sp-enemy-density">${[0.75, 1, 1.25, 1.5, 2].map((n) => `<option value="${n}" ${this.spEnemyDensity === n ? "selected" : ""}>${n}×</option>`).join("")}</select>
            </label>
            <label class="run-field"><span>Enemy HP</span>
              <select data-field="sp-enemy-hp">${[0.75, 1, 1.25, 1.5, 2].map((n) => `<option value="${n}" ${this.spEnemyHp === n ? "selected" : ""}>${n}×</option>`).join("")}</select>
            </label>
            <label class="run-field"><span>Enemy speed</span>
              <select data-field="sp-enemy-speed">${[0.8, 1, 1.15, 1.3].map((n) => `<option value="${n}" ${this.spEnemySpeed === n ? "selected" : ""}>${n}×</option>`).join("")}</select>
            </label>
            <label class="run-field"><span>Income</span>
              <select data-field="sp-income">${[0.75, 1, 1.25, 1.5, 2].map((n) => `<option value="${n}" ${this.spIncomeMul === n ? "selected" : ""}>${n}×</option>`).join("")}</select>
            </label>
            <label class="run-field"><span>Respawn</span>
              <select data-field="sp-respawn">${[0.5, 0.75, 1, 1.25, 1.5].map((n) => `<option value="${n}" ${this.spRespawnMul === n ? "selected" : ""}>${n}×</option>`).join("")}</select>
            </label>
            <label class="run-field"><span>Start base Lv</span>
              <select data-field="sp-start-base">${[0, 1, 2, 3, 4].map((n) => `<option value="${n}" ${this.spStartingBase === n ? "selected" : ""}>${n}</option>`).join("")}</select>
            </label>
            <label class="run-field"><span>Level draft size</span>
              <select data-field="sp-level-draft">${[2, 3, 4, 5].map((n) => `<option value="${n}" ${this.spLevelDraftSize === n ? "selected" : ""}>${n}</option>`).join("")}</select>
            </label>
            <label class="run-field"><span>Relic draft size</span>
              <select data-field="sp-relic-draft">${[2, 3, 4, 5].map((n) => `<option value="${n}" ${this.spRelicDraftSize === n ? "selected" : ""}>${n}</option>`).join("")}</select>
            </label>
            <label class="run-field"><span>Utility draft Lv</span>
              <select data-field="sp-utility-level">${[0, 3, 5, 7, 8, 10, 12, 15, 20, 25].map((n) => `<option value="${n}" ${this.spUtilityDraftLevel === n ? "selected" : ""}>${n === 0 ? "Never" : n}</option>`).join("")}</select>
            </label>
            <label class="run-field"><span>Ally AI</span>
              <select data-field="sp-ally-ai">${[0.7, 1, 1.4, 1.8].map((n) => `<option value="${n}" ${this.spAllyAi === n ? "selected" : ""}>${n}×</option>`).join("")}</select>
            </label>
            <label class="run-field"><span>Sudden death HP</span>
              <select data-field="sp-sudden">${[0, 40, 60, 80].map((n) => `<option value="${n}" ${this.spSuddenDeath === n ? "selected" : ""}>${n === 0 ? "Off" : n}</option>`).join("")}</select>
            </label>
          </div>
          <div class="choice-row wrap" style="margin-top:8px;gap:0.75rem">
            ${[
              ["sp-no-art", "No artifacts", this.spDisableArtifacts],
              ["sp-no-chest", "No chests", this.spDisableChests],
              ["sp-no-elite", "No elites", this.spDisableElites],
              ["sp-no-boss", "No bosses", this.spDisableBosses],
              ["sp-no-shop", "No shop", this.spDisableShop],
              ["sp-no-send", "No sends", this.spDisableSends],
              ["sp-no-relic", "No relics", this.spDisableRelics],
              ["sp-fog", "Fog always", this.spFogAlways],
              ["sp-dbl-elite", "Double elites", this.spDoubleElites],
            ]
              .map(
                ([field, label, on]) =>
                  `<label class="setting-row" style="min-width:9rem"><span>${label}</span><input type="checkbox" data-field="${field}" ${on ? "checked" : ""} /></label>`,
              )
              .join("")}
          </div>
        </details>
      `;
    }
    return `
      <label class="setting-row">
        <span>Max artifacts <em id="${scope}-turret-label">${turrets}</em></span>
        <input type="range" min="1" max="10" step="1" value="${turrets}" data-field="${scope}-turrets" />
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
        <span>Utility draft Lv</span>
        <select data-field="${scope}-utility-level">${[0, 3, 5, 7, 8, 10, 12, 15, 20, 25].map((n) => `<option value="${n}" ${(scope === "mp" ? this.lobby.utilityDraftLevel : this.spUtilityDraftLevel) === n ? "selected" : ""}>${n === 0 ? "Never" : n}</option>`).join("")}</select>
      </label>
      ${
        showFf
          ? `<label class="setting-row">
        <span>Friendly fire</span>
        <select data-field="${scope}-friendly-fire">
          <option value="0" ${!ff ? "selected" : ""}>Off</option>
          <option value="1" ${ff ? "selected" : ""}>On</option>
        </select>
      </label>`
          : ""
      }
    `;
  }

  private spHeroDetailHtml(): string {
    const kb = this.settings.keybinds;
    const meta = loadMetaStore();
    const h = resolveHero(this.selectedHero);
    const custom = isCustomHeroId(this.selectedHero);
    const unlocked = custom || isHeroUnlocked(h.id as HeroId, meta);
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
        <strong style="color:${h.color}">${escapeHtml(h.name)}${custom ? " · Custom" : ""}</strong>
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
    const customHeroCards = listCustomHeroes().map((h) => {
      const selected = h.id === this.selectedHero;
      return `
        <button type="button" class="hero-card compact ${selected ? "selected" : ""}" data-action="pick-hero" data-hero-id="${h.id}">
          <span class="hero-swatch" style="--hero:${h.color}"></span>
          <strong>${escapeHtml(h.name)}</strong>
          <span>Custom · ${escapeHtml(h.blurb)}</span>
        </button>
      `;
    });
    const cards = [
      ...customHeroCards,
      ...HERO_LIST.map((h) => {
        const selected = h.id === this.selectedHero;
        const unlocked = isHeroUnlocked(h.id, meta);
        return `
        <button type="button" class="hero-card compact ${selected ? "selected" : ""} ${unlocked ? "" : "locked"}" data-action="pick-hero" data-hero-id="${h.id}" ${unlocked ? "" : "title=\"Unlock in Barracks\""}>
          <span class="hero-swatch" style="--hero:${h.color}"></span>
          <strong>${escapeHtml(h.name)}</strong>
          <span>${unlocked ? escapeHtml(h.blurb) : "Locked"}</span>
        </button>
      `;
      }),
    ].join("");

    const customMapOpts = listCustomMaps().map(
      (m) =>
        `<option value="${m.id}" ${this.spMapChoice === m.id ? "selected" : ""}>Custom · ${escapeHtml(m.name)}</option>`,
    );
    const mapOpts = [
      `<option value="random" ${this.spMapChoice === "random" ? "selected" : ""}>Random</option>`,
      ...customMapOpts,
      ...MAP_LIST.map((m) => {
        const unlocked = isMapUnlocked(m.id);
        return `<option value="${m.id}" ${this.spMapChoice === m.id ? "selected" : ""} ${unlocked ? "" : "disabled"}>${escapeHtml(m.name)}${unlocked ? "" : " (challenge)"}</option>`;
      }),
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
          ${
            this.spEndless
              ? `<label class="run-field">
            <span>Opponent AI</span>
            <select disabled title="Endless has no rival lane">
              <option selected>None (Endless)</option>
            </select>
          </label>`
              : `<label class="run-field">
            <span>Opponent AI</span>
            <select data-field="sp-opponent-ai">${aiOpts}</select>
          </label>`
          }
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
      ...MAP_LIST.map((m) => {
        const unlocked = isMapUnlocked(m.id);
        return `<button type="button" class="chip ${this.lobby.mapChoice === m.id ? "selected" : ""} ${unlocked ? "" : "locked"}" data-action="set-mp-map" data-map-id="${m.id}" title="${escapeHtml(m.blurb)}" ${unlocked ? "" : "disabled"}>${escapeHtml(m.name)}</button>`;
      }),
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
      const tiers: { id: string; title: string; filter: (k: EnemyKind) => boolean }[] = [
        {
          id: "normal",
          title: "Normal",
          filter: (k) => !isEliteKind(k) && !isBossKind(k),
        },
        { id: "elite", title: "Elites", filter: (k) => isEliteKind(k) },
        { id: "boss", title: "Bosses", filter: (k) => isBossKind(k) },
      ];
      const sections = tiers
        .map(({ title, filter }) => {
          const kinds = ENEMY_KINDS.filter(
            (k) => filter(k) && this.matchesFilter(ENEMY_DEFS[k].name, `${ENEMY_DEFS[k].intent} ${k}`),
          );
          if (kinds.length === 0) return "";
          const cards = kinds
            .map((k) => {
              const d = ENEMY_DEFS[k];
              return `
            <article class="comp-card compact">
              <h3>${escapeHtml(d.name)}</h3>
              <p>Intent: <strong>${escapeHtml(d.intent)}</strong>${d.ranged ? " · ranged" : ""}${d.dashSpeed ? " · dash" : ""}${d.projectileAoe ? " · AoE shell" : ""}${d.slamRadius ? " · slam" : ""}</p>
              <p class="comp-meta">HP ${d.maxHp} · Spd ${d.speed} · Contact ${d.contactDamage}/s${d.attackDamage ? ` · Shot ${d.attackDamage}` : ""} · Gold ${d.goldReward}</p>
            </article>`;
            })
            .join("");
          return `<section class="comp-section"><h2 class="comp-section-title">${escapeHtml(title)}</h2><div class="comp-grid">${cards}</div></section>`;
        })
        .join("");
      return sections || emptyComp();
    }
    if (this.compendiumTab === "ascensions") {
      const cards = ASCENSIONS.filter((a) => this.matchesFilter(a.name, a.blurb))
        .map((a) => {
          const stack =
            a.level <= 0
              ? "Baseline difficulty."
              : ASCENSIONS.filter((x) => x.level >= 1 && x.level <= a.level)
                  .map((x) => `A${x.level}: ${x.blurb}`)
                  .join(" · ");
          return `
          <article class="comp-card compact">
            <h3>A${a.level} · ${escapeHtml(a.name)}</h3>
            <p>${escapeHtml(a.blurb)}</p>
            <p class="comp-meta">${escapeHtml(stack)}</p>
          </article>`;
        })
        .join("");
      return `<div class="comp-grid">${cards || emptyComp()}</div>`;
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
          <h3>${escapeHtml(m.name)}${m.shiftingObstacles || m.shrinkingLane || m.movingHazards || m.eclipseFog || m.dualSpawners ? ` <em class="special-tag">Special</em>` : ""}</h3>
          <p>${escapeHtml(m.blurb)}</p>
          <p class="comp-meta">Obstacles ${m.obstacles.length} · High grounds ${m.highGrounds.length} · Artifacts ${m.turretSlots.length}</p>
        </article>`,
      )
      .join("");
    return `<div class="comp-grid maps">${cards || emptyComp()}</div>`;
  }

  private renderCompendium(): string {
    const tabs = (["heroes", "items", "relics", "enemies", "sends", "maps", "ascensions"] as const)
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
        <button type="button" class="menu-btn" data-action="export-save">Export save JSON</button>
        <button type="button" class="menu-btn" data-action="import-save">Import save JSON</button>
        <button type="button" class="menu-btn ghost" data-action="reset-settings">Reset to defaults</button>
      </div>
    `;
  }

  private renderControls(): string {
    const section = (title: string, actions: BindableAction[]) => {
      const rows = actions
        .map((action) => {
          const listening = this.rebinding === action && !this.rebindingPad;
          const listeningPad = this.rebinding === action && this.rebindingPad;
          const bind = this.settings.keybinds[action];
          const pad = this.settings.gamepadBinds[action];
          return `
        <div class="setting-row bind-row ${listening || listeningPad ? "listening" : ""}">
          <span>
            <strong>${ACTION_LABELS[action]}</strong>
            <em>${ACTION_HINTS[action]}</em>
          </span>
          <div class="choice-row" style="gap:0.35rem">
            <button type="button" class="bind-btn" data-action="rebind" data-bind="${action}">
              ${listening ? "Press key / mouse…" : formatBinding(bind)}
            </button>
            <button type="button" class="bind-btn" data-action="rebind-pad" data-bind="${action}">
              ${listeningPad ? "Press pad…" : pad ? formatBinding(pad) : "Pad —"}
            </button>
          </div>
        </div>`;
        })
        .join("");
      return `<h2>${title}</h2>${rows}`;
    };

    return `
      <header class="menu-header compact">
        <button type="button" class="menu-back" data-action="goto" data-screen="settings">← Back</button>
        <h1 class="menu-title">Controls</h1>
        <p class="menu-lead">Keyboard/mouse + Xbox pad. Left stick always moves. Remap keys and pad buttons separately.</p>
      </header>
      <section class="menu-section settings-list">
        <label class="setting-row">
          <span>Enable gamepad</span>
          <input type="checkbox" data-setting="gamepadEnabled" ${this.settings.gamepadEnabled ? "checked" : ""} />
        </label>
        ${section("Combat", COMBAT_ACTIONS)}
        ${section("Movement", MOVE_ACTIONS)}
        ${section("Utility / Sends", UTILITY_ACTIONS)}
      </section>
      ${
        this.rebinding
          ? `<p class="menu-footnote">Listening… Esc to cancel.</p>`
          : `<div class="menu-footer"><button type="button" class="menu-btn ghost" data-action="reset-binds">Reset defaults</button></div>`
      }
    `;
  }

  private renderChallenges(): string {
    const store = loadMetaStore();
    const rows = CHALLENGES.map((c) => {
      const done = isChallengeComplete(c.id, store);
      const unlock = META_UPGRADES.find((u) => u.id === c.unlocks);
      const owned = unlock ? getRank(store, unlock.id) >= 1 : false;
      return `
        <div class="meta-row">
          <div>
            <strong>${escapeHtml(c.name)}</strong>
            <span class="stat-hint">${escapeHtml(c.blurb)}</span>
            <em>${escapeHtml(challengeProgressHint(c, store))} · Reward: ${escapeHtml(unlock?.name ?? c.unlocks)}${owned ? " (purchased)" : done ? " (buy in Barracks)" : ""}</em>
          </div>
          <span class="chip ${done ? "selected" : ""}">${done ? "Done" : "Locked"}</span>
        </div>`;
    }).join("");
    return `
      <header class="menu-header compact">
        <button type="button" class="menu-back" data-action="goto" data-screen="main">← Back</button>
        <h1 class="menu-title">Challenges</h1>
        <p class="menu-lead">Complete mid/end-run goals to unlock Barracks purchases — rewards are not free.</p>
      </header>
      <section class="menu-section muted-box meta-list">${rows}</section>
      <div class="menu-footer">
        <button type="button" class="menu-btn" data-action="goto" data-screen="barracks">Open Barracks</button>
      </div>
    `;
  }

  private renderCheats(): string {
    const on = areCheatsEnabled();
    const o = this.cheatOpts;
    const toggles: { key: keyof CheatOptions; label: string }[] = [
      { key: "unlockAll", label: "Unlock everything" },
      { key: "infiniteGold", label: "Infinite gold" },
      { key: "godMode", label: "God mode" },
      { key: "skipWaves", label: "Skip waves (N)" },
      { key: "forceChest", label: "Force chest (C)" },
      { key: "infiniteRerolls", label: "Infinite rerolls" },
      { key: "oneShot", label: "One-shot (reserved)" },
      { key: "freeShop", label: "Free shop" },
      { key: "revealFog", label: "Reveal fog" },
    ];
    return `
      <header class="menu-header compact">
        <button type="button" class="menu-back" data-action="goto" data-screen="main">← Back</button>
        <h1 class="menu-title">Cheats</h1>
        <p class="menu-lead" style="color:#e08060">Sandbox profile only. Enabling caches your real Barracks save and swaps a separate cheater profile so normal progress is not polluted.</p>
      </header>
      <section class="menu-section muted-box">
        <button type="button" class="menu-btn ${on ? "" : "primary"}" data-action="toggle-cheats">
          ${on ? "Disable cheats (restore real profile)" : "Enable cheats (enter sandbox)"}
        </button>
        <p class="menu-note">${on ? "CHEATS ACTIVE — sandbox profile" : "Cheats off — real profile"}</p>
      </section>
      <section class="menu-section settings-list">
        ${toggles
          .map(
            (t) => `
          <label class="setting-row">
            <span>${t.label}</span>
            <input type="checkbox" data-cheat="${t.key}" ${o[t.key] ? "checked" : ""} ${on ? "" : "disabled"} />
          </label>`,
          )
          .join("")}
      </section>
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
      const challengeBlocked =
        !!u.requiresChallenge &&
        !store.challengesCompleted?.[u.requiresChallenge as import("../meta/challenges").ChallengeId] &&
        rank < 1;
      const canBuy = !maxed && !challengeBlocked && store.crests >= cost!;
      const rankLabel = u.kind === "unlock" ? (rank >= 1 ? "Owned" : "Locked") : `Rank ${rank}/${u.maxRank}`;
      const challengeNote = challengeBlocked
        ? ` · Requires challenge: ${u.requiresChallenge}`
        : "";
      return `
        <div class="meta-row">
          <div>
            <strong>${escapeHtml(u.name)}</strong>
            <span class="stat-hint">${escapeHtml(u.blurb)}${escapeHtml(challengeNote)}</span>
            <em>${escapeHtml(rankLabel)}</em>
          </div>
          <button type="button" class="menu-btn ${canBuy ? "primary" : ""}" data-action="buy-meta" data-upgrade-id="${u.id}" ${maxed || !canBuy ? "disabled" : ""}>
            ${maxed ? "Max" : challengeBlocked ? "Challenge" : `${cost} crests`}
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
