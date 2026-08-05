import { HEROES, HERO_LIST, type HeroId } from "../data/heroes";
import { LEVEL_PASSIVE_LIST } from "../data/xp";
import { MAP_LIST, resolveMapChoice, type MapId } from "../data/maps";
import { RELIC_LIST, RELICS } from "../data/relics";
import { SHOP_ITEMS } from "../data/shop";
import { SEND_PACKS } from "../data/send";
import { ENEMY_DEFS, isBossKind, isEliteKind, type EnemyKind } from "../data/enemies";
import { RARITY_LABEL, RARITY_COLOR, RARITY_ORDER, type Rarity } from "../data/rarity";
import { BASE_BRANCHES, type BaseBranchId } from "../data/baseBranches";
import {
  availableNext,
  CAMPAIGN_EVENTS,
  CAMPAIGN_SHOP,
  advanceTo,
  beginCombatCheckpoint,
  campaignNode,
  completeCombatNode,
  createCampaignRun,
  loadCampaignRun,
  rollCombatRewards,
  applyCombatRewards,
  rollPendingChestRelic,
  saveCampaignRun,
  type CampaignRun,
} from "../campaign/run";
import {
  getGameType,
  gameTypeSelectHtml,
  gameTypeToRunOptions,
  listGameTypes,
  loadCustomListSans,
  loadSelectedGameTypeId,
  newGameTypeId,
  saveCustomGameTypes,
  saveSelectedGameTypeId,
  type GameTypeDef,
  type GameTypeOptions,
  defaultGameTypeOptions,
  defaultGameTypeDescription,
  exportGameTypeJson,
  importGameTypeJson,
  BUILTIN_GAME_TYPES,
  normalizeGameTypeId,
} from "../meta/gameTypes";
import { emptyContentFilters, validateContentFilters } from "../meta/contentFilters";
import {
  getRunStartBonus,
  rollRunStartBonusChoices,
  type RunStartBonusDef,
} from "../campaign/runStartBonuses";
import { gameTypeOptionsFieldsHtml, readGameTypeOptionsFromDom } from "./gameTypeFields";
import { STARTING_GOLD, WIN_WAVES } from "../data/constants";
import type { RunOptions } from "../game/state";
import type { LobbyAiHeroPick, LobbyAiKind, MatchMode, MatchPrivacy } from "../net/types";
import {
  aiKindOptionsHtml,
  newAiSeatId,
  parseAiKindValue,
  selectionToLobbyAi,
} from "../ai/lobbyAi";
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
  syncMotionPreference,
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
import { isTraining, runTraining, stopTraining, type TrainProgress, type TrainRunOptions } from "../ai/train";
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
import { stopMenuMusic, syncMenuMusicFromSettings } from "../systems/music";
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
import {
  pickOne,
  RUN_OPTION_DEFAULTS,
  RUN_OPTION_POOLS,
  runTip,
  type RunOptionTipKey,
} from "./runOptionsMeta";
import { paintEnemyThumbs } from "./enemyThumbs";
import { paintMapThumb, paintMapThumbCanvases } from "./mapThumbs";
import { resolveMapShape, shapeLabel } from "../game/playBounds";
import { relicArtImg } from "../data/relicArt";
import { itemArtImg } from "../data/itemArt";
import { PATCH_NOTE_PAGES, patchNotesBodyHtml } from "../data/patchNotes";

export type { MatchMode, MatchPrivacy } from "../net/types";

export type MenuScreen =
  | "main"
  | "singleplayer"
  | "compendium"
  | "game-info"
  | "patch-notes"
  | "campaign"
  | "game-types"
  | "settings"
  | "controls"
  | "ai-lab"
  | "barracks"
  | "challenges"
  | "cheats"
  | "map-editor"
  | "hero-editor"
  | "stats";

/** Human names for back-button targets (see `backButton`). */
const SCREEN_LABELS: Record<MenuScreen, string> = {
  main: "Main Menu",
  singleplayer: "Singleplayer",
  compendium: "Compendium",
  "game-info": "Game Info",
  "patch-notes": "Patch Notes",
  campaign: "Campaign",
  "game-types": "Game Types",
  settings: "Settings",
  controls: "Controls",
  "ai-lab": "AI Lab",
  barracks: "Barracks",
  challenges: "Challenges",
  cheats: "Cheats",
  "map-editor": "Map Editor",
  "hero-editor": "Hero Editor",
  stats: "Stats",
};

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
  /** Level for global utility draft; −1 = Run Start, 0 = Never. */
  utilityDraftLevel: number;
  /** 0 = unlimited. */
  livesPerWave: number;
  /** 0 = unlimited. */
  livesPerRun: number;
  ascension: number;
  chestOpenMul: number;
  chestDespawnSec: number;
  chestSpawnChance: number;
  enemyDensityMul: number;
  enemyHpMul: number;
  enemySpeedMul: number;
  incomeMul: number;
  respawnMul: number;
  startingBaseLevel: number;
  levelDraftSize: number;
  relicDraftSize: number;
  disableArtifacts: boolean;
  disableChests: boolean;
  disableElites: boolean;
  disableBosses: boolean;
  disableShop: boolean;
  disableSends: boolean;
  disableRelics: boolean;
  fogAlways: boolean;
  fogThicknessPct: number;
  fogVisionRadius: number;
  doubleElites: boolean;
  suddenDeathBaseHp: number;
  glassCannon: boolean;
  goldRush: boolean;
  wildChests: boolean;
  crampedLane: boolean;
};

export type MenuCallbacks = {
  onStartSingleplayer: (heroId: HeroId, opts?: Partial<RunOptions>) => void;
  onOpenMultiplayer: (draft: LobbyDraft, heroId: HeroId) => void;
  onSettingsChanged?: () => void;
  onRunOptionsChanged?: (opts: Partial<RunOptions>) => void;
  /** Pause-menu Settings → back returns to the in-run pause overlay. */
  onResumePause?: () => void;
  /** Campaign combat exit (quit / lose / win). */
  onCampaignCombatEnd?: (result: "won" | "lost" | "abandon") => void;
};

type CompTab =
  | "heroes"
  | "bonuses"
  | "items"
  | "artifacts"
  | "relics"
  | "enemies"
  | "sends"
  | "maps"
  | "ascensions"
  | "branches";

const COMP_TAB_LABELS: Record<CompTab, string> = {
  heroes: "Heroes",
  bonuses: "Bonuses",
  items: "Items",
  artifacts: "Artifacts",
  relics: "Relics",
  enemies: "Enemies",
  sends: "Sends",
  maps: "Maps",
  ascensions: "Ascensions",
  branches: "Base Upgrades",
};

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
  /** Screen we navigated from — decides whether "Back" is an honest label. */
  private prevScreen: MenuScreen = "main";
  private selectedHero: HeroId = HERO_LIST[0]!.id;
  private lobby: LobbyDraft = {
    mode: "1v1",
    privacy: "private",
    role: "host",
    joinCode: "",
    hostCode: randomLobbyCode(),
    mapChoice: "random",
    maxTurrets: RUN_OPTION_DEFAULTS.maxTurrets,
    startingGold: STARTING_GOLD,
    wavesToWin: WIN_WAVES,
    friendlyFire: false,
    utilityDraftLevel: 10,
    livesPerWave: 0,
    livesPerRun: 0,
    ascension: 0,
    chestOpenMul: 1,
    chestDespawnSec: 28,
    chestSpawnChance: 0.08,
    enemyDensityMul: 1,
    enemyHpMul: 1,
    enemySpeedMul: 1,
    incomeMul: 1,
    respawnMul: 1,
    startingBaseLevel: 0,
    levelDraftSize: 3,
    relicDraftSize: 3,
    disableArtifacts: false,
    disableChests: false,
    disableElites: false,
    disableBosses: false,
    disableShop: false,
    disableSends: false,
    disableRelics: false,
    fogAlways: false,
    fogThicknessPct: 55,
    fogVisionRadius: 120,
    doubleElites: false,
    suddenDeathBaseHp: 0,
    glassCannon: false,
    goldRush: false,
    wildChests: false,
    crampedLane: false,
  };
  private spMapChoice: MapId | string | "random" = "random";
  private spAscension = 0;
  private spTeamSize: 1 | 2 | 3 = 1;
  private spAllies: { id: string; heroId: LobbyAiHeroPick; ai: LobbyAiKind }[] = [];
  private spEnemies: { id: string; heroId: LobbyAiHeroPick; ai: LobbyAiKind }[] = [];
  private spEndless = false;
  /** AI Lab training duel run / creative options (mirrors solo setup). */
  private aiTrainAscension = 0;
  private aiTrainEnemyDensity = 1;
  private aiTrainEnemyHp = 1;
  private aiTrainEnemySpeed = 1;
  private aiTrainIncomeMul = 1;
  private aiTrainRespawnMul = 1;
  private aiTrainStartingBase = 0;
  private aiTrainSuddenDeath = 0;
  private aiTrainDoubleElites = false;
  private aiTrainDisableElites = false;
  private aiTrainDisableBosses = false;
  private aiTrainGlassCannon = false;
  private aiTrainGoldRush = false;
  private aiTrainFogAlways = false;
  private aiTrainCrampedLane = false;
  private settings: ClientSettingsFull = loadSettings();
  private compendiumTab: CompTab = "heroes";
  private compSearch = "";
  private compRarity: Rarity | "all" = "all";
  private compSort: "name" | "rarity" = "rarity";
  private toast = "";
  /** Index into PATCH_NOTE_PAGES (0 = newest). */
  private patchPageIndex = 0;
  private campaign: CampaignRun | null = loadCampaignRun();
  private campaignEventId: string | null = null;
  private campaignToast = "";
  private campaignConfirmAbandon = false;
  /** Lobby phase before run; map phase when alive. */
  private campaignLobby = !loadCampaignRun()?.alive;
  /** True while Bag overlay is open on campaign map. */
  private campaignBagOpen = false;
  /** Run-start bonus choices pending (after New run hero select). */
  private campaignStartBonusChoices: RunStartBonusDef[] | null = null;
  private campaignLobbyGameTypeId = "race";
  private selectedGameTypeId = loadSelectedGameTypeId();
  private gtEditId: string = "outlast";
  private gtEditOptions: GameTypeOptions = defaultGameTypeOptions();
  private gtEditName = "Outlast";
  private gtEditDescription = "";
  private gtReturnScreen: MenuScreen = "singleplayer";
  private gtReturnToMp = false;
  private rebinding: BindableAction | null = null;
  private rebindingPad = false;
  private unbindListen: (() => void) | null = null;
  private trainProgress: TrainProgress | null = null;
  private readonly mapEditor = new MapEditorPanel();
  private readonly heroEditor = new HeroEditorPanel();
  private statsTab: StatsTab = "overview";
  private readonly mainFx = new MainMenuFx();
  private cheatOpts: CheatOptions = loadCheatOptions();
  /** False while pause-settings overlays a live run (no menu BGM). */
  private allowMenuMusic = true;
  /** When true, Settings/Controls back returns to the pause menu instead of Main. */
  private resumePauseOnBack = false;

  constructor(root: HTMLElement, callbacks: MenuCallbacks) {
    this.root = root;
    this.callbacks = callbacks;
    this.root.addEventListener("click", (e) => this.onClick(e));
    this.root.addEventListener("input", (e) => this.onInput(e));
    this.root.addEventListener("change", (e) => this.onChange(e));
    this.root.addEventListener(
      "pointerdown",
      () => {
        unlockAudio();
        this.syncMenuMusic();
      },
      { passive: true },
    );
  }

  show(
    screen: MenuScreen = "main",
    opts?: { allowMenuMusic?: boolean; resumePause?: boolean },
  ): void {
    this.settings = loadSettings();
    syncMotionPreference(this.settings);
    this.allowMenuMusic = opts?.allowMenuMusic ?? true;
    this.resumePauseOnBack = !!opts?.resumePause;
    this.stopRebindListen();
    this.root.classList.remove("hidden");
    this.go(screen);
    this.syncMenuMusic();
  }

  hide(opts?: { keepMusic?: boolean }): void {
    this.stopRebindListen();
    this.mainFx.stop();
    if (!opts?.keepMusic) {
      stopMenuMusic();
      this.allowMenuMusic = false;
    }
    this.resumePauseOnBack = false;
    this.root.classList.add("hidden");
    this.root.innerHTML = "";
  }

  private syncMenuMusic(): void {
    syncMenuMusicFromSettings(this.allowMenuMusic && this.isVisible());
  }

  /** Public nudge for first-gesture unlock from Game / window handlers. */
  nudgeMenuMusic(): void {
    this.syncMenuMusic();
  }

  isVisible(): boolean {
    return !this.root.classList.contains("hidden");
  }

  go(screen: MenuScreen): void {
    if (screen !== "controls") this.stopRebindListen();
    if (screen !== this.screen) this.prevScreen = this.screen;
    this.screen = screen;
    if (screen === "patch-notes") this.patchPageIndex = 0;
    this.render();
    // Retry BGM on every screen change — first navigation often carries the
    // user-gesture browsers need after an autoplay block on cold load.
    this.syncMenuMusic();
  }

  /**
   * Shared header button. Sub-screens all jump to a fixed target (usually the
   * main menu), so the label only says "Back" when that target really is the
   * screen the player came from — otherwise it names where it goes.
   */
  private backButton(target: MenuScreen): string {
    const label =
      target === "main"
        ? "← Main Menu"
        : target === this.prevScreen
          ? "← Back"
          : `← ${SCREEN_LABELS[target] ?? "Main Menu"}`;
    return `<button type="button" class="menu-back" data-action="goto" data-screen="${target}">${label}</button>`;
  }

  /** Settings opened from the pause menu must return to pause, not Main. */
  private settingsBackButton(): string {
    if (this.resumePauseOnBack) {
      return `<button type="button" class="menu-back" data-action="resume-pause">← Back to pause</button>`;
    }
    return this.backButton("main");
  }

  private persist(): void {
    saveSettings(this.settings);
    this.syncMenuMusic();
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
    if (action === "patch-prev" || action === "patch-next") {
      const n = PATCH_NOTE_PAGES.length;
      if (n > 0) {
        const delta = action === "patch-prev" ? -1 : 1;
        this.patchPageIndex = (this.patchPageIndex + delta + n) % n;
        this.render();
        const shell = this.root.querySelector(".menu-shell");
        if (shell) shell.scrollTop = 0;
        const body = this.root.querySelector(".patch-body");
        if (body) body.scrollTop = 0;
      }
      return;
    }
    if (action === "campaign-new") {
      const gt = getGameType(this.campaignLobbyGameTypeId).options;
      this.campaign = createCampaignRun(this.selectedHero, gt);
      this.campaignEventId = null;
      this.campaignConfirmAbandon = false;
      this.campaignBagOpen = false;
      if (this.settings.campaignRunStartBonuses !== false) {
        this.campaignStartBonusChoices = rollRunStartBonusChoices(this.campaign.seed);
        this.campaignLobby = false;
        this.campaignToast = "Pick a run start bonus.";
        saveCampaignRun(this.campaign);
        this.render();
        return;
      }
      this.campaignStartBonusChoices = null;
      this.campaignToast = "Run started — pick a path.";
      this.campaignLobby = false;
      saveCampaignRun(this.campaign);
      this.render();
      return;
    }
    if (action === "campaign-start-bonus" && t.dataset.id && this.campaign) {
      const bonus = getRunStartBonus(t.dataset.id);
      if (bonus) {
        bonus.apply(this.campaign);
        this.campaignToast = `${bonus.name} taken.`;
      }
      this.campaignStartBonusChoices = null;
      saveCampaignRun(this.campaign);
      this.render();
      return;
    }
    if (action === "campaign-bag") {
      this.campaignBagOpen = !this.campaignBagOpen;
      this.render();
      return;
    }
    if (action === "campaign-bag-close") {
      this.campaignBagOpen = false;
      this.render();
      return;
    }
    if (action === "campaign-abandon") {
      this.campaignConfirmAbandon = true;
      this.render();
      return;
    }
    if (action === "campaign-abandon-yes") {
      this.campaign = null;
      this.campaignEventId = null;
      this.campaignConfirmAbandon = false;
      this.campaignLobby = true;
      saveCampaignRun(null);
      this.render();
      return;
    }
    if (action === "campaign-abandon-no") {
      this.campaignConfirmAbandon = false;
      this.render();
      return;
    }
    if (action === "campaign-go" && t.dataset.node && this.campaign) {
      this.resolveCampaignNode(t.dataset.node);
      return;
    }
    if (action === "campaign-event" && t.dataset.choice && this.campaign && this.campaignEventId) {
      const ev = CAMPAIGN_EVENTS.find((e) => e.id === this.campaignEventId);
      if (ev) {
        this.campaignToast = ev.apply(this.campaign, t.dataset.choice);
        this.campaignEventId = null;
        saveCampaignRun(this.campaign);
        this.render();
      }
      return;
    }
    if (action === "campaign-shop" && t.dataset.shop && this.campaign) {
      const item = CAMPAIGN_SHOP.find((s) => s.id === t.dataset.shop);
      if (item && this.campaign.coins >= item.cost) {
        this.campaign.coins -= item.cost;
        item.apply(this.campaign);
        this.campaignToast = `Bought ${item.name}`;
        saveCampaignRun(this.campaign);
        this.render();
      } else {
        this.campaignToast = "Not enough coins";
        this.render();
      }
      return;
    }
    if (action === "campaign-rest" && t.dataset.rest && this.campaign) {
      if (t.dataset.rest === "heal") {
        this.campaign.baseHp = Math.min(
          this.campaign.baseMaxHp,
          this.campaign.baseHp + Math.round(this.campaign.baseMaxHp * 0.35),
        );
        this.campaignToast = "Rested — base repaired.";
      } else if (t.dataset.rest === "mobility") {
        this.campaign.abilityUpgrades.mobility += 1;
        this.campaignToast = "Mobility upgraded.";
      } else if (t.dataset.rest === "ultimate") {
        this.campaign.abilityUpgrades.ultimate += 1;
        this.campaignToast = "Ultimate upgraded.";
      } else if (t.dataset.rest === "passive") {
        this.campaign.abilityUpgrades.passive += 1;
        this.campaignToast = "Passive upgraded.";
      }
      // Advance past rest once chosen
      this.campaign.activeCombatNodeId = null;
      saveCampaignRun(this.campaign);
      this.render();
      return;
    }
    if (action === "campaign-chest" && this.campaign) {
      if (t.dataset.take === "1" && this.campaign.pendingChestRelicId) {
        const id = this.campaign.pendingChestRelicId;
        if (!this.campaign.relics.includes(id)) this.campaign.relics.push(id);
        this.campaignToast = `Claimed ${RELICS[id]?.name ?? id}`;
      } else {
        this.campaignToast = "Left the chest.";
      }
      this.campaign.pendingChestRelicId = null;
      saveCampaignRun(this.campaign);
      this.render();
      return;
    }
    if (action === "gt-pick" && t.dataset.id) {
      this.openGameTypeEditor(t.dataset.id);
      return;
    }
    if (action === "gt-new") {
      this.gtEditId = newGameTypeId();
      this.gtEditName = "Custom type";
      this.gtEditDescription = defaultGameTypeDescription("Custom type");
      this.gtEditOptions = { ...getGameType(this.selectedGameTypeId).options };
      this.render();
      return;
    }
    if (action === "gt-save") {
      this.commitGameTypeEditor();
      return;
    }
    if (action === "gt-delete") {
      this.deleteEditingGameType();
      return;
    }
    if (action === "gt-use") {
      this.commitGameTypeEditor();
      this.applyGameType(this.gtEditId);
      this.leaveGameTypeEditor();
      return;
    }
    if (action === "gt-export") {
      this.gtEditOptions = readGameTypeOptionsFromDom(this.root, "gt");
      const nameEl = this.root.querySelector<HTMLInputElement>("#gt-name");
      const descEl = this.root.querySelector<HTMLTextAreaElement>("#gt-desc");
      if (nameEl?.value.trim()) this.gtEditName = nameEl.value.trim().slice(0, 40);
      if (descEl) this.gtEditDescription = descEl.value.trim().slice(0, 160);
      exportGameTypeJson({
        id: this.gtEditId,
        name: this.gtEditName || "Custom type",
        description: this.gtEditDescription || defaultGameTypeDescription(this.gtEditName),
        builtin: false,
        options: this.gtEditOptions,
      });
      return;
    }
    if (action === "gt-import") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(String(reader.result));
            const res = importGameTypeJson(parsed);
            if (typeof res === "string") {
              this.setToast(res);
              return;
            }
            const customs = loadCustomListSans(res.id);
            customs.push(res);
            saveCustomGameTypes(customs);
            this.openGameTypeEditor(res.id);
            this.setToast(`Imported “${res.name}”`);
          } catch {
            this.setToast("Could not parse game type JSON.");
          }
        };
        reader.readAsText(file);
      });
      input.click();
      return;
    }
    if (action === "gt-back-mp") {
      this.leaveGameTypeEditor();
      return;
    }

    switch (action) {
      case "resume-pause":
        this.callbacks.onResumePause?.();
        break;
      case "goto":
        if (this.resumePauseOnBack && t.dataset.screen === "main") {
          this.callbacks.onResumePause?.();
          break;
        }
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
        {
          const gt = getGameType(this.selectedGameTypeId).options;
          if (!gt.endless) this.ensureSpAiRoster();
          const fromGt = gameTypeToRunOptions(gt);
          this.callbacks.onStartSingleplayer(this.selectedHero, {
            ...fromGt,
            mapId: this.spMapChoice,
            ascension: this.spAscension,
            teamSize: gt.endless
              ? 1
              : (Math.min(3, 1 + this.spAllies.length) as 1 | 2 | 3),
            aiAllies: gt.endless
              ? undefined
              : this.spAllies.map(({ heroId, ai }) => ({ heroId, ai })),
            aiEnemies: gt.endless
              ? undefined
              : this.spEnemies.map(({ heroId, ai }) => ({ heroId, ai })),
            sharedFriendlyFire: !!fromGt.friendlyFire && this.spAllies.length > 0,
          });
        }
        break;
      case "sp-add-ally":
        if (!this.spEndless && this.spAllies.length < 2) {
          this.spAllies.push(this.newSpAiRow({ kind: "classic" }));
          this.spTeamSize = Math.min(3, 1 + this.spAllies.length) as 1 | 2 | 3;
          this.render();
        }
        break;
      case "sp-add-enemy":
        if (!this.spEndless && this.spEnemies.length < 3) {
          this.spEnemies.push(
            this.newSpAiRow(selectionToLobbyAi(loadAiStore().selected)),
          );
          this.render();
        }
        break;
      case "sp-rm-ai": {
        const side = t.dataset.side;
        const id = t.dataset.id;
        if (side === "ally") {
          this.spAllies = this.spAllies.filter((r) => r.id !== id);
          this.spTeamSize = Math.min(3, Math.max(1, 1 + this.spAllies.length)) as 1 | 2 | 3;
        } else if (side === "enemy") {
          this.spEnemies = this.spEnemies.filter((r) => r.id !== id);
        }
        this.render();
        break;
      }
      case "sp-run-reset":
        // Factory default game type for SP is Outlast
        this.applyGameType("outlast");
        this.spMapChoice = RUN_OPTION_DEFAULTS.mapChoice;
        this.spAscension = RUN_OPTION_DEFAULTS.ascension;
        // Default AI roster: 0 allies, 1 enemy
        this.spTeamSize = 1;
        this.spAllies = [];
        this.spEnemies = [this.newSpAiRow(selectionToLobbyAi(loadAiStore().selected))];
        this.render();
        break;
      case "sp-run-randomize":
        this.randomizeSpRunOptions();
        this.render();
        break;
      case "edit-gametypes":
        this.gtReturnToMp = false;
        this.gtReturnScreen = (t.dataset.from as MenuScreen) || this.screen;
        this.openGameTypeEditor(this.selectedGameTypeId);
        break;
      case "comp-tab":
        this.compendiumTab = t.dataset.tab as CompTab;
        this.render();
        break;
      case "reset-settings":
        this.settings = {
          masterVolume: 0.7,
          musicVolume: 0.7,
          sfxVolume: 0.8,
          menuMusicEnabled: true,
          showDamageNumbers: true,
          screenShake: true,
          reduceMotion: false,
          damageScreenFx: "full",
          autoOpenShop: false,
          rejectPeerCustoms: false,
          artifactPlaceDebounce: true,
          campaignRunStartBonuses: true,
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
    if (el.dataset.field === "volume") {
      this.settings.masterVolume = Number(el.value);
      this.persist();
      const label = this.root.querySelector("#volume-label");
      if (label) label.textContent = `${Math.round(this.settings.masterVolume * 100)}%`;
    }
    if (el.dataset.field === "music-volume") {
      this.settings.musicVolume = Number(el.value);
      this.persist();
      const label = this.root.querySelector("#music-volume-label");
      if (label) label.textContent = `${Math.round(this.settings.musicVolume * 100)}%`;
    }
    if (el.dataset.field === "sfx-volume") {
      this.settings.sfxVolume = Number(el.value);
      this.persist();
      const label = this.root.querySelector("#sfx-volume-label");
      if (label) label.textContent = `${Math.round(this.settings.sfxVolume * 100)}%`;
    }
    if (el.dataset.field === "comp-search") {
      this.compSearch = el.value;
      this.renderCompendiumListOnly();
    }
  }

  private onChange(e: Event): void {
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    if (el instanceof HTMLSelectElement && el.matches("[data-me-shape]")) {
      // Shape changes go through the standard confirm modal + full render so
      // the overlay is always torn down on the next render (see MapEditorPanel).
      this.mapEditor.requestShapeChange(el.value);
      this.render();
      return;
    }
    if ((el as HTMLInputElement).dataset.setting === "showDamageNumbers") {
      this.settings.showDamageNumbers = (el as HTMLInputElement).checked;
      this.persist();
    } else if ((el as HTMLInputElement).dataset.setting === "autoOpenShop") {
      this.settings.autoOpenShop = (el as HTMLInputElement).checked;
      this.persist();
    } else if ((el as HTMLInputElement).dataset.setting === "artifactPlaceDebounce") {
      this.settings.artifactPlaceDebounce = (el as HTMLInputElement).checked;
      this.persist();
    } else if ((el as HTMLInputElement).dataset.setting === "rejectPeerCustoms") {
      this.settings.rejectPeerCustoms = (el as HTMLInputElement).checked;
      this.persist();
    } else if ((el as HTMLInputElement).dataset.setting === "campaignRunStartBonuses") {
      this.settings.campaignRunStartBonuses = (el as HTMLInputElement).checked;
      this.persist();
    } else if ((el as HTMLInputElement).dataset.setting === "screenShake") {
      this.settings.screenShake = (el as HTMLInputElement).checked;
      this.persist();
    } else if ((el as HTMLInputElement).dataset.setting === "reduceMotion") {
      this.settings.reduceMotion = (el as HTMLInputElement).checked;
      this.persist();
      this.render();
    } else if (el.dataset.field === "damage-fx") {
      this.settings.damageScreenFx = el.value as DamageScreenFx;
      this.persist();
    } else if (el.dataset.field === "comp-rarity") {
      this.compRarity = el.value as Rarity | "all";
      this.renderCompendiumListOnly();
    } else if (el.dataset.field === "comp-sort") {
      this.compSort = el.value as "name" | "rarity";
      this.renderCompendiumListOnly();
    } else if (el.dataset.field === "sp-game-type") {
      const id = el.value;
      if (this.screen === "campaign") this.campaignLobbyGameTypeId = normalizeGameTypeId(id);
      else this.applyGameType(id);
      this.render();
    } else if (el.dataset.field === "sp-ascension") {
      this.spAscension = Number(el.value) || 0;
      this.paintSpRunMeta();
    } else if (el.dataset.field === "sp-map") {
      this.spMapChoice = el.value as MapId | string | "random";
      this.paintSpMapPreview();
    } else if (el.dataset.field === "sp-ai-kind") {
      const side = el.dataset.side;
      const id = el.dataset.id;
      const ai = parseAiKindValue(el.value);
      const row =
        side === "ally"
          ? this.spAllies.find((r) => r.id === id)
          : this.spEnemies.find((r) => r.id === id);
      if (row) {
        row.ai = ai;
        if (side === "enemy" && this.spEnemies[0]?.id === id) {
          setSelectedOpponent(
            ai.kind === "classic"
              ? { kind: "classic" }
              : { kind: "neural", school: ai.school, tier: ai.tier },
          );
        }
      }
    } else if (el.dataset.field === "sp-ai-hero") {
      const side = el.dataset.side;
      const id = el.dataset.id;
      const row =
        side === "ally"
          ? this.spAllies.find((r) => r.id === id)
          : this.spEnemies.find((r) => r.id === id);
      if (row) row.heroId = (el.value || "random") as LobbyAiHeroPick;
    } else if ((el as HTMLInputElement).dataset.setting === "gamepadEnabled") {
      this.settings.gamepadEnabled = (el as HTMLInputElement).checked;
      this.persist();
    } else if ((el as HTMLInputElement).dataset.setting === "menuMusicEnabled") {
      this.settings.menuMusicEnabled = (el as HTMLInputElement).checked;
      this.persist();
    } else if ((el as HTMLInputElement).dataset.cheat) {
      const key = (el as HTMLInputElement).dataset.cheat as keyof CheatOptions;
      updateCheatOption(key, (el as HTMLInputElement).checked as never);
      this.cheatOpts = loadCheatOptions();
    } else if (el.dataset.field === "sp-opponent-ai") {
      setSelectedOpponent(parseAiSelectValue(el.value));
    } else if (el.dataset.field === "ai-opponent") {
      setSelectedOpponent(parseAiSelectValue(el.value));
    } else if (el.dataset.field === "ai-train-ascension") {
      this.aiTrainAscension = Number(el.value) || 0;
    } else if (el.dataset.field === "ai-train-enemy-density") {
      this.aiTrainEnemyDensity = Number(el.value) || 1;
    } else if (el.dataset.field === "ai-train-enemy-hp") {
      this.aiTrainEnemyHp = Number(el.value) || 1;
    } else if (el.dataset.field === "ai-train-enemy-speed") {
      this.aiTrainEnemySpeed = Number(el.value) || 1;
    } else if (el.dataset.field === "ai-train-income") {
      this.aiTrainIncomeMul = Number(el.value) || 1;
    } else if (el.dataset.field === "ai-train-respawn") {
      this.aiTrainRespawnMul = Number(el.value) || 1;
    } else if (el.dataset.field === "ai-train-start-base") {
      this.aiTrainStartingBase = Number(el.value) || 0;
    } else if (el.dataset.field === "ai-train-sudden") {
      this.aiTrainSuddenDeath = Number(el.value) || 0;
    } else if (el.dataset.field === "ai-train-dbl-elite") {
      this.aiTrainDoubleElites = (el as HTMLInputElement).checked;
    } else if (el.dataset.field === "ai-train-no-elite") {
      this.aiTrainDisableElites = (el as HTMLInputElement).checked;
    } else if (el.dataset.field === "ai-train-no-boss") {
      this.aiTrainDisableBosses = (el as HTMLInputElement).checked;
    } else if (el.dataset.field === "ai-train-glass") {
      this.aiTrainGlassCannon = (el as HTMLInputElement).checked;
    } else if (el.dataset.field === "ai-train-gold-rush") {
      this.aiTrainGoldRush = (el as HTMLInputElement).checked;
    } else if (el.dataset.field === "ai-train-fog") {
      this.aiTrainFogAlways = (el as HTMLInputElement).checked;
    } else if (el.dataset.field === "ai-train-cramped") {
      this.aiTrainCrampedLane = (el as HTMLInputElement).checked;
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

    const result = await runTraining(
      { recipe, gens, pop, trials, maxSeconds, runOptions: this.collectAiTrainRunOptions() },
      (p) => {
        this.trainProgress = p;
        const st = this.root.querySelector("#ai-status");
        if (st) st.textContent = p.message;
      },
    );

    if (result) saveTrainingResult(name, recipe, result);
    this.trainProgress = null;
    if (this.screen === "ai-lab") this.render();
  }

  private collectAiTrainRunOptions(): Partial<TrainRunOptions> {
    return {
      ascension: this.aiTrainAscension,
      enemyDensityMul: this.aiTrainEnemyDensity,
      enemyHpMul: this.aiTrainEnemyHp,
      enemySpeedMul: this.aiTrainEnemySpeed,
      incomeMul: this.aiTrainIncomeMul,
      respawnMul: this.aiTrainRespawnMul,
      startingBaseLevel: this.aiTrainStartingBase,
      doubleElites: this.aiTrainDoubleElites,
      disableElites: this.aiTrainDisableElites,
      disableBosses: this.aiTrainDisableBosses,
      glassCannon: this.aiTrainGlassCannon,
      goldRush: this.aiTrainGoldRush,
      fogAlways: this.aiTrainFogAlways,
      crampedLane: this.aiTrainCrampedLane,
      suddenDeathBaseHp: this.aiTrainSuddenDeath > 0 ? this.aiTrainSuddenDeath : undefined,
    };
  }

  private aiTrainRunOptionsHtml(): string {
    const tip = (key: RunOptionTipKey) => ` data-tip="${escapeHtml(runTip(key))}"`;
    const meta = loadMetaStore();
    const ascOpts = Array.from({ length: meta.ascensionUnlocked + 1 }, (_, i) => {
      const def = ASCENSIONS[i]!;
      return `<option value="${i}" ${this.aiTrainAscension === i ? "selected" : ""}>A${i} · ${escapeHtml(def.name)}</option>`;
    }).join("");
    const creativeSelect = (
      field: string,
      label: string,
      tipKey: RunOptionTipKey,
      pool: readonly number[],
      current: number,
      fmt: (n: number) => string,
    ) => `
            <label class="run-field"><span>${label}</span>
              <select data-field="${field}"${tip(tipKey)}>${pool.map((n) => `<option value="${n}" ${current === n ? "selected" : ""}>${fmt(n)}</option>`).join("")}</select>
            </label>`;
    const d = RUN_OPTION_DEFAULTS;
    const creativeActive =
      [
        this.aiTrainDoubleElites,
        this.aiTrainDisableElites,
        this.aiTrainDisableBosses,
        this.aiTrainGlassCannon,
        this.aiTrainGoldRush,
        this.aiTrainFogAlways,
        this.aiTrainCrampedLane,
      ].filter(Boolean).length +
      [
        this.aiTrainAscension !== d.ascension,
        this.aiTrainEnemyDensity !== d.enemyDensityMul,
        this.aiTrainEnemyHp !== d.enemyHpMul,
        this.aiTrainEnemySpeed !== d.enemySpeedMul,
        this.aiTrainIncomeMul !== d.incomeMul,
        this.aiTrainRespawnMul !== d.respawnMul,
        this.aiTrainStartingBase !== d.startingBaseLevel,
        this.aiTrainSuddenDeath !== d.suddenDeathBaseHp,
      ].filter(Boolean).length;
    const flags: Array<[string, string, boolean, RunOptionTipKey]> = [
      ["ai-train-dbl-elite", "Double elites", this.aiTrainDoubleElites, "doubleElites"],
      ["ai-train-no-elite", "No elites", this.aiTrainDisableElites, "noElites"],
      ["ai-train-no-boss", "No bosses", this.aiTrainDisableBosses, "noBosses"],
      ["ai-train-glass", "Glass cannon", this.aiTrainGlassCannon, "glassCannon"],
      ["ai-train-gold-rush", "Gold rush", this.aiTrainGoldRush, "goldRush"],
      ["ai-train-fog", "Fog always", this.aiTrainFogAlways, "fogAlways"],
      ["ai-train-cramped", "Cramped lane", this.aiTrainCrampedLane, "crampedLane"],
    ];
    const checkboxes = flags
      .map(
        ([field, label, on, tipKey]) =>
          `<label class="setting-row"${tip(tipKey)}><span>${label}</span><input type="checkbox" data-field="${field}" ${on ? "checked" : ""} /></label>`,
      )
      .join("");
    return `
            <details class="opt-fold"${creativeActive > 0 ? " open" : ""}>
              <summary>Training run options${creativeActive > 0 ? ` <span class="opt-count">${creativeActive} active</span>` : ""}</summary>
              <div class="opt-fold-body">
                <p class="menu-note">Applied to every training duel — stack Ascension + creative modifiers to breed harder schools.</p>
                <label class="setting-row">
                  <span>Ascension</span>
                  <select data-field="ai-train-ascension"${tip("ascension")}>${ascOpts}</select>
                </label>
                <div class="run-grid cols-4">
                  ${creativeSelect("ai-train-enemy-density", "Enemy density", "enemyDensity", RUN_OPTION_POOLS.enemyDensityMul, this.aiTrainEnemyDensity, (n) => `${n}×`)}
                  ${creativeSelect("ai-train-enemy-hp", "Enemy HP", "enemyHp", RUN_OPTION_POOLS.enemyHpMul, this.aiTrainEnemyHp, (n) => `${n}×`)}
                  ${creativeSelect("ai-train-enemy-speed", "Enemy speed", "enemySpeed", RUN_OPTION_POOLS.enemySpeedMul, this.aiTrainEnemySpeed, (n) => `${n}×`)}
                  ${creativeSelect("ai-train-income", "Income", "income", RUN_OPTION_POOLS.incomeMul, this.aiTrainIncomeMul, (n) => `${n}×`)}
                  ${creativeSelect("ai-train-respawn", "Respawn", "respawn", RUN_OPTION_POOLS.respawnMul, this.aiTrainRespawnMul, (n) => `${n}×`)}
                  ${creativeSelect("ai-train-start-base", "Start base Lv", "startBase", RUN_OPTION_POOLS.startingBaseLevel, this.aiTrainStartingBase, (n) => `${n}`)}
                  ${creativeSelect("ai-train-sudden", "Sudden death HP", "suddenDeath", RUN_OPTION_POOLS.suddenDeathBaseHp, this.aiTrainSuddenDeath, (n) => (n === 0 ? "Off" : `${n}`))}
                </div>
                <div class="creative-check-grid">${checkboxes}</div>
              </div>
            </details>`;
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
      case "compendium":
        body = this.renderCompendium();
        break;
      case "game-info":
        body = this.renderGameInfo();
        break;
      case "patch-notes":
        body = this.renderPatchNotes();
        break;
      case "campaign":
        body = this.renderCampaign();
        break;
      case "game-types":
        body = this.renderGameTypes();
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

    const isMain = this.screen === "main";
    const fxVar = isMain ? "main" : "sub";
    const reduceMotion = !!this.settings.reduceMotion;
    const versionHtml = isMain
      ? `<p class="menu-version" aria-hidden="true">v${escapeHtml(__APP_VERSION__)}</p>`
      : "";
    const prefsScreen =
      this.screen === "settings" ||
      this.screen === "controls" ||
      this.screen === "cheats" ||
      this.screen === "ai-lab" ||
      this.screen === "compendium" ||
      this.screen === "game-types" ||
      this.screen === "patch-notes" ||
      this.screen === "campaign";
    const shellClass = `menu-shell${isMain ? " main-shell" : ""}${this.screen === "singleplayer" || this.screen === "map-editor" || this.screen === "hero-editor" ? " tight" : ""}${this.screen === "map-editor" || this.screen === "hero-editor" ? " workshop-shell" : ""}${this.screen === "stats" ? " stats-shell" : ""}${this.screen === "game-info" ? " info-shell" : ""}${this.screen === "barracks" || this.screen === "challenges" ? " meta-shell" : ""}${prefsScreen ? " prefs-shell" : ""}`;

    const backdrop = this.root.querySelector<HTMLElement>(".menu-backdrop.menu-fx");
    const existingShell = this.root.querySelector<HTMLElement>(".menu-shell");
    const reuseFx =
      !!backdrop &&
      !!existingShell &&
      backdrop.classList.contains(`fx-${fxVar}`) &&
      !!this.root.querySelector("#menu-fx-canvas");

    if (reuseFx && backdrop && existingShell) {
      backdrop.classList.toggle("reduce-motion", reduceMotion);
      existingShell.className = shellClass;
      existingShell.innerHTML = `${body}${toastHtml}`;
      const ver = this.root.querySelector(".menu-version");
      if (isMain) {
        if (ver) ver.textContent = `v${__APP_VERSION__}`;
        else this.root.insertAdjacentHTML("beforeend", versionHtml);
      } else {
        ver?.remove();
      }
      existingShell.scrollTop = scroll;
    } else {
      this.mainFx.stop();
      this.root.innerHTML = `
      <div class="menu-backdrop menu-fx fx-${fxVar}${reduceMotion ? " reduce-motion" : ""}">
        <div class="menu-aurora" aria-hidden="true"></div>
        <div class="menu-waves" aria-hidden="true"></div>
        <canvas id="menu-fx-canvas" aria-hidden="true"></canvas>
      </div>
      <div class="${shellClass}">
        ${body}
        ${toastHtml}
      </div>
      ${versionHtml}
    `;
      const shell = this.root.querySelector(".menu-shell");
      if (shell) shell.scrollTop = scroll;
      const fxCanvas = this.root.querySelector<HTMLCanvasElement>("#menu-fx-canvas");
      if (fxCanvas) {
        this.mainFx.start(fxCanvas, { variation: fxVar, reduceMotion });
      }
    }

    if (this.screen === "compendium" && this.compendiumTab === "maps") {
      this.paintMapThumbs();
    }
    if (this.screen === "singleplayer") this.paintSpMapPreview();
    if (this.screen === "compendium" && this.compendiumTab === "enemies") {
      paintEnemyThumbs(this.root);
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
    if (this.compendiumTab === "enemies") paintEnemyThumbs(this.root);
  }

  private paintMapThumbs(): void {
    paintMapThumbCanvases(this.root);
  }

  /** Live shape-aware preview of the selected SP map (or a placeholder for Random). */
  private paintSpMapPreview(): void {
    const canvas = this.root.querySelector<HTMLCanvasElement>("#sp-map-preview-canvas");
    const label = this.root.querySelector<HTMLElement>("#sp-map-preview-label");
    if (!canvas || !label) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(200, Math.round(rect.width) || 360);
    const h = Math.max(48, Math.round(rect.height) || 72);
    if (this.spMapChoice === "random") {
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
    paintMapThumb(canvas, resolveMap(this.spMapChoice), w, h);
    label.style.display = "none";
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
      <div class="stats-layout">
        <header class="menu-header compact stats-header">
          ${this.backButton("main")}
          <h1 class="menu-title">Career Stats</h1>
          <p class="menu-lead">Lifetime totals from finished runs.</p>
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
      </div>
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
            <button type="button" class="menu-btn shine-btn play-card" data-action="goto" data-screen="campaign">
              <span class="btn-label">Campaign</span>
              <span class="btn-hint">Branching acts · roguelike map</span>
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
          <div class="main-group-btns cols-4">
            <button type="button" class="menu-btn shine-btn" data-action="goto" data-screen="map-editor"><span class="btn-label">Map Editor</span></button>
            <button type="button" class="menu-btn shine-btn" data-action="edit-gametypes" data-from="main"><span class="btn-label">Game Type Editor</span></button>
            <button type="button" class="menu-btn shine-btn" data-action="goto" data-screen="hero-editor"><span class="btn-label">Hero Editor</span></button>
            <button type="button" class="menu-btn shine-btn" data-action="goto" data-screen="ai-lab"><span class="btn-label">AI Lab</span></button>
          </div>
        </section>

        <section class="main-group library">
          <h2 class="main-group-label">Library</h2>
          <div class="main-group-btns cols-3">
            <button type="button" class="menu-btn shine-btn" data-action="goto" data-screen="compendium"><span class="btn-label">Compendium</span></button>
            <button type="button" class="menu-btn shine-btn" data-action="goto" data-screen="patch-notes"><span class="btn-label">Patch Notes</span></button>
            <button type="button" class="menu-btn shine-btn" data-action="goto" data-screen="game-info"><span class="btn-label">Game Info</span></button>
          </div>
        </section>

        <section class="main-group system">
          <div class="main-group-btns system-btns">
            <button type="button" class="menu-btn shine-btn" data-action="goto" data-screen="settings"><span class="btn-label">Settings</span></button>
            <button type="button" class="menu-btn ghost shine-btn" data-action="goto" data-screen="cheats"><span class="btn-label">Cheats</span></button>
            <button type="button" class="menu-btn ghost danger" data-action="quit"><span class="btn-label">Quit</span></button>
          </div>
        </section>
      </nav>
    `;
  }

  /** Apply a named game type onto SP runtime flags (AI roster / endless). */
  private applyGameType(id: string): void {
    this.selectedGameTypeId = id;
    saveSelectedGameTypeId(id);
    const o = getGameType(id).options;
    this.spEndless = o.endless;
    if (o.endless) {
      this.spAllies = [];
      this.spEnemies = [];
      this.spTeamSize = 1;
    }
  }

  /** Open game type editor leaving the multiplayer lobby UI mounted off-screen. */
  gtReturnFromMultiplayer(): void {
    this.gtReturnToMp = true;
    this.gtReturnScreen = "main";
    this.openGameTypeEditor(this.selectedGameTypeId);
  }

  private leaveGameTypeEditor(): void {
    if (this.gtReturnToMp) {
      this.gtReturnToMp = false;
      this.callbacks.onOpenMultiplayer({ ...this.lobby }, this.selectedHero);
      return;
    }
    this.go(this.gtReturnScreen);
  }

  private openGameTypeEditor(id: string): void {
    const t = getGameType(id);
    this.gtEditId = t.id;
    this.gtEditName = t.name;
    this.gtEditDescription = t.description || defaultGameTypeDescription(t.name);
    this.gtEditOptions = { ...t.options };
    this.screen = "game-types";
    this.render();
  }

  private commitGameTypeEditor(): void {
    this.gtEditOptions = readGameTypeOptionsFromDom(this.root, "gt");
    const nameEl = this.root.querySelector<HTMLInputElement>("#gt-name");
    const descEl = this.root.querySelector<HTMLTextAreaElement>("#gt-desc");
    if (nameEl?.value.trim()) this.gtEditName = nameEl.value.trim().slice(0, 40);
    if (descEl) this.gtEditDescription = descEl.value.trim().slice(0, 160);
    const filterErr = validateContentFilters(this.gtEditOptions.contentFilters);
    if (filterErr) {
      this.setToast(filterErr);
      return;
    }
    const all = listGameTypes();
    const existing = all.find((t) => t.id === this.gtEditId);
    if (existing?.builtin) {
      this.gtEditId = newGameTypeId();
    }
    // Built-ins must never carry filters when used as templates without copy —
    // saved customs may filter; force empty if somehow still builtin id.
    if (BUILTIN_GAME_TYPES.some((b) => b.id === this.gtEditId)) {
      this.gtEditOptions = {
        ...this.gtEditOptions,
        contentFilters: emptyContentFilters(),
      };
    }
    const next: GameTypeDef = {
      id: this.gtEditId,
      name: this.gtEditName || "Custom type",
      description:
        this.gtEditDescription || defaultGameTypeDescription(this.gtEditName || "Custom type"),
      builtin: false,
      options: this.gtEditOptions,
    };
    const customs = loadCustomListSans(this.gtEditId);
    customs.push(next);
    saveCustomGameTypes(customs);
    this.applyGameType(next.id);
    this.setToast(`Saved “${next.name}”`);
    this.render();
  }

  private deleteEditingGameType(): void {
    const t = getGameType(this.gtEditId);
    if (t.builtin) {
      this.setToast("Built-in game types can’t be deleted.");
      return;
    }
    saveCustomGameTypes(loadCustomListSans(this.gtEditId));
    this.applyGameType("outlast");
    this.openGameTypeEditor("outlast");
  }

  /** True while Campaign combat is running (checkpointed). */
  isCampaignCombatActive(): boolean {
    return !!(this.campaign?.alive && this.campaign.activeCombatNodeId);
  }

  /** Persist sudden-death base HP after a campaign combat ends. */
  applyCampaignBaseHp(hp: number): void {
    if (!this.campaign) return;
    this.campaign.baseHp = Math.max(1, Math.min(this.campaign.baseMaxHp, Math.ceil(hp)));
    saveCampaignRun(this.campaign);
  }

  /** Public: finish campaign battle (win / lose / quit). */
  handleCampaignCombatEnd(result: "won" | "lost" | "abandon"): void {
    if (!this.campaign) {
      this.show("campaign", { allowMenuMusic: true });
      return;
    }
    const nodeId = this.campaign.activeCombatNodeId;
    const node = campaignNode(this.campaign, nodeId);
    if (result === "won" && node && (node.kind === "combat" || node.kind === "elite" || node.kind === "boss")) {
      const reward = rollCombatRewards(this.campaign, node.kind);
      applyCombatRewards(this.campaign, reward);
      completeCombatNode(this.campaign, node.id);
      // Persist surviving base HP from sudden-death value is not auto-synced; keep coins reward.
      if (node.kind === "boss" && node.act === 3) {
        this.campaign.won = true;
        this.campaignToast = "Act III boss cleared — campaign victory!";
      } else {
        this.campaignToast = `Victory · +${reward.coins} coins`;
      }
    } else if (result === "lost") {
      // Base fell — campaign ends
      this.campaign.alive = false;
      this.campaign.activeCombatNodeId = null;
      saveCampaignRun(this.campaign);
      this.campaignToast = "Base fallen — campaign over.";
    } else {
      // Abandon mid-fight: checkpoint stays; do not advance
      saveCampaignRun(this.campaign);
      this.campaignToast = "Battle aborted — resume from checkpoint.";
    }
    this.campaignLobby = false;
    this.show("campaign", { allowMenuMusic: true });
  }

  private randomizeSpRunOptions(): void {
    const meta = loadMetaStore();
    const mapPool: Array<MapId | string | "random"> = [
      "random",
      ...MAP_LIST.filter((m) => isMapUnlocked(m.id)).map((m) => m.id),
      ...listCustomMaps().map((m) => m.id),
    ];
    this.spMapChoice = pickOne(mapPool);
    this.spAscension = Math.floor(Math.random() * (meta.ascensionUnlocked + 1));
    setSelectedOpponent(randomAiSelection(loadAiStore()));
    this.applyGameType(pickOne(listGameTypes()).id);
    if (!this.spEndless) {
      this.spTeamSize = pickOne(RUN_OPTION_POOLS.teamSize);
      this.ensureSpAiRoster(true);
    }
  }

  private newSpAiRow(ai: LobbyAiKind): { id: string; heroId: LobbyAiHeroPick; ai: LobbyAiKind } {
    return { id: newAiSeatId(), heroId: "random", ai };
  }

  /** Keep ally/enemy AI lists in bounds; `resizeToMode` rebuilds from the Mode preset. */
  private ensureSpAiRoster(resizeToMode = false): void {
    if (this.spEndless) return;
    const wantAllies = Math.max(0, this.spTeamSize - 1);
    const wantEnemies = Math.max(0, this.spTeamSize);
    const defAi = selectionToLobbyAi(loadAiStore().selected);
    if (resizeToMode || (this.spAllies.length === 0 && this.spEnemies.length === 0)) {
      this.spAllies = Array.from({ length: wantAllies }, () =>
        this.newSpAiRow({ kind: "classic" }),
      );
      this.spEnemies = Array.from({ length: wantEnemies }, (_, i) =>
        this.newSpAiRow(i === 0 ? defAi : { kind: "classic" }),
      );
      return;
    }
    this.spAllies = this.spAllies.slice(0, 2);
    // Allow zero AI enemies (abstract rival)
    this.spEnemies = this.spEnemies.slice(0, 3);
  }

  private spAiRosterHtml(): string {
    if (this.spEndless) {
      return `<p class="menu-note">Endless has no rival lane — AI roster disabled.</p>`;
    }
    this.ensureSpAiRoster();
    const heroOpts = (sel: LobbyAiHeroPick) =>
      [
        `<option value="random" ${sel === "random" ? "selected" : ""}>Random</option>`,
        ...HERO_LIST.map(
          (h) =>
            `<option value="${h.id}" ${h.id === sel ? "selected" : ""}>${escapeHtml(h.name)}</option>`,
        ),
      ].join("");
    const rowHtml = (
      side: "ally" | "enemy",
      row: { id: string; heroId: LobbyAiHeroPick; ai: LobbyAiKind },
      canRemove: boolean,
    ) => `
      <div class="sp-ai-row" data-ai-id="${row.id}">
        <select class="menu-select" data-field="sp-ai-hero" data-side="${side}" data-id="${row.id}">${heroOpts(row.heroId)}</select>
        <select class="menu-select" data-field="sp-ai-kind" data-side="${side}" data-id="${row.id}">${aiKindOptionsHtml(row.ai)}</select>
        ${
          canRemove
            ? `<button type="button" class="menu-btn small ghost" data-action="sp-rm-ai" data-side="${side}" data-id="${row.id}">✕</button>`
            : `<span class="sp-ai-lock" data-tip="Need at least one foe">—</span>`
        }
      </div>`;
    const you = resolveHero(this.selectedHero).name;
    return `
      <div class="sp-ai-roster">
        <div class="panel-head">
          <h3 class="sp-setup-title">AI roster</h3>
        </div>
        <p class="menu-note">Add or remove AI per lane (0–3 foes). Empty enemy lane uses the abstract rival.</p>
        <div class="sp-ai-cols">
          <div class="sp-ai-col">
            <h4>Your lane · ${1 + this.spAllies.length}/3</h4>
            <div class="sp-ai-row you-row">
              <span class="sp-ai-you-name">You · ${escapeHtml(you)}</span>
              <span class="sp-ai-you-meta">Player</span>
              <span class="sp-ai-lock">—</span>
            </div>
            ${this.spAllies.map((r) => rowHtml("ally", r, true)).join("")}
            <button type="button" class="menu-btn small ghost sp-ai-add" data-action="sp-add-ally" ${this.spAllies.length >= 2 ? "disabled" : ""}>+ AI ally</button>
          </div>
          <div class="sp-ai-col">
            <h4>Enemy lane · ${this.spEnemies.length}/3</h4>
            ${this.spEnemies.map((r) => rowHtml("enemy", r, true))
              .join("")}
            <button type="button" class="menu-btn small ghost sp-ai-add" data-action="sp-add-enemy" ${this.spEnemies.length >= 3 ? "disabled" : ""}>+ AI enemy</button>
          </div>
        </div>
      </div>`;
  }

  /** Game type dropdown + edit — dense options live in the Game Type Editor. */
  private runOptionsFields(): string {
    const gt = getGameType(this.selectedGameTypeId);
    const o = gt.options;
    const blurb = [
      o.endless ? "No rival" : null,
      o.livesPerRun > 0 ? `${o.livesPerRun} lives` : null,
      o.wavesToWin === 0 ? "∞ waves" : `${o.wavesToWin} waves`,
      o.sendLocation === "own" ? "sends→own" : "sends→enemy",
      o.playerBaseInvincible || o.enemyBaseInvincible ? "base invuln" : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return `
      <div class="run-grid cols-3">
        ${gameTypeSelectHtml(this.selectedGameTypeId, "sp-game-type")}
        <label class="run-field">
          <span>Edit</span>
          <button type="button" class="menu-btn small ghost shine-btn" data-action="edit-gametypes" data-from="singleplayer" style="width:100%"><span class="btn-label">Edit Gametypes</span></button>
        </label>
        <div class="run-field">
          <span>Summary</span>
          <p class="menu-note compact" style="margin:0">${escapeHtml(gt.name)}${blurb ? ` — ${escapeHtml(blurb)}` : ""}</p>
        </div>
      </div>
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
    const you = this.root.querySelector(".sp-ai-you-name");
    if (you) you.textContent = `You · ${resolveHero(this.selectedHero).name}`;
  }

  private paintSpRunMeta(): void {
    const play = this.root.querySelector<HTMLElement>("[data-action='play-sp']");
    if (!play) return;
    const label = `Play · ${ascensionLabel(this.spAscension)}`;
    const span = play.querySelector(".btn-label");
    if (span) span.textContent = label;
    else play.textContent = label;
  }

  private renderSingleplayer(): string {
    const meta = loadMetaStore();
    this.spAscension = Math.min(this.spAscension, meta.ascensionUnlocked);
    const customHeroCards = listCustomHeroes().map((h) => {
      const selected = h.id === this.selectedHero;
      return `
        <button type="button" class="hero-card compact shine-btn ${selected ? "selected" : ""}" data-action="pick-hero" data-hero-id="${h.id}">
          <span class="hero-swatch" style="--hero:${h.color}"></span>
          <strong class="btn-label">${escapeHtml(h.name)}</strong>
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
        <button type="button" class="hero-card compact shine-btn ${selected ? "selected" : ""} ${unlocked ? "" : "locked"}" data-action="pick-hero" data-hero-id="${h.id}" ${unlocked ? "" : "data-tip=\"Unlock in Barracks\""}>
          <span class="hero-swatch" style="--hero:${h.color}"></span>
          <strong class="btn-label">${escapeHtml(h.name)}</strong>
          <span>${unlocked ? escapeHtml(h.blurb) : "Locked"}</span>
        </button>
      `;
      }),
    ].join("");

    const customMaps = listCustomMaps();
    const builtinMapOpts = MAP_LIST.map((m) => {
      const unlocked = isMapUnlocked(m.id);
      return `<option value="${m.id}" ${this.spMapChoice === m.id ? "selected" : ""} ${unlocked ? "" : "disabled"}>${escapeHtml(m.name)}${unlocked ? "" : " (challenge)"}</option>`;
    }).join("");
    const customMapOpts = customMaps.length
      ? customMaps
          .map(
            (m) =>
              `<option value="${m.id}" ${this.spMapChoice === m.id ? "selected" : ""}>${escapeHtml(m.name)}</option>`,
          )
          .join("")
      : `<option value="" disabled>(none saved yet)</option>`;
    const mapOpts = [
      `<option value="random" ${this.spMapChoice === "random" ? "selected" : ""}>Random</option>`,
      `<optgroup label="Built-in">${builtinMapOpts}</optgroup>`,
      `<optgroup label="Custom library">${customMapOpts}</optgroup>`,
    ].join("");

    const ascOpts = Array.from({ length: meta.ascensionUnlocked + 1 }, (_, i) => {
      const def = ASCENSIONS[i]!;
      return `<option value="${i}" ${this.spAscension === i ? "selected" : ""}>A${i} · ${escapeHtml(def.name)}</option>`;
    }).join("");

    return `
      <header class="menu-header compact sp-header">
        <div class="sp-header-row">
          <div class="sp-header-titles">
            ${this.backButton("main")}
            <h1 class="menu-title">Singleplayer</h1>
          </div>
          <div class="sp-header-links">
            <button type="button" class="menu-btn small ghost shine-btn" data-action="goto" data-screen="barracks"><span class="btn-label">Barracks</span></button>
            <button type="button" class="menu-btn small ghost shine-btn" data-action="goto" data-screen="ai-lab"><span class="btn-label">AI Lab</span></button>
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

      <div class="sp-run-layout">
        <section class="sp-setup">
          <div class="panel-head">
            <h2 class="sp-setup-title">Run setup</h2>
            <div class="panel-head-actions">
              <button type="button" class="menu-btn small ghost" data-action="sp-run-reset" data-tip="Restore default run options"><span class="btn-label">Reset</span></button>
              <button type="button" class="menu-btn small ghost shine-btn" data-action="sp-run-randomize" data-tip="Roll random run options"><span class="btn-label">Randomize</span></button>
            </div>
          </div>
          <div class="run-grid cols-3">
            <label class="run-field">
              <span>Map</span>
              <select data-field="sp-map" data-tip="${escapeHtml(runTip("map"))}">${mapOpts}</select>
            </label>
            <label class="run-field">
              <span>Ascension</span>
              <select data-field="sp-ascension" data-tip="${escapeHtml(runTip("ascension"))}">${ascOpts}</select>
            </label>
            <label class="run-field">
              <span>Match AI</span>
              <select disabled data-tip="Per-seat difficulty is set in the AI roster below">
                <option selected>${this.spEndless ? "None (Endless)" : "See AI roster"}</option>
              </select>
            </label>
          </div>
          <div class="map-preview" id="sp-map-preview" aria-hidden="true">
            <canvas id="sp-map-preview-canvas"></canvas>
            <span class="map-preview-label" id="sp-map-preview-label"></span>
          </div>
          ${this.spAiRosterHtml()}
          ${this.runOptionsFields()}
        </section>

        <section class="sp-heroes">
          <h2 class="sp-heroes-title">Hero</h2>
          <div class="hero-grid compact">${cards}</div>
          <div id="sp-hero-detail" class="sp-hero-detail">${this.spHeroDetailHtml()}</div>
        </section>
      </div>

      <div class="menu-footer sp-footer">
        <button type="button" class="menu-btn primary wide shine-btn" data-action="play-sp"><span class="btn-label">Play · ${escapeHtml(ascensionLabel(this.spAscension))}</span></button>
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
    if (this.compendiumTab === "bonuses") {
      let list = LEVEL_PASSIVE_LIST.filter((b) =>
        this.matchesFilter(
          b.name,
          `${b.blurb} ${b.tag} ${b.heroId ? HEROES[b.heroId]?.name ?? "" : "all"}`,
          b.rarity,
        ),
      );
      if (this.compSort === "rarity") {
        list = [...list].sort(
          (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name),
        );
      } else {
        list = [...list].sort((a, b) => a.name.localeCompare(b.name));
      }
      const cards = list
        .map((b) => {
          const heroName = b.heroId ? HEROES[b.heroId]?.name ?? b.heroId : null;
          return `
        <article class="comp-card">
          <div class="comp-card-top">
            <div>
              <h3>${escapeHtml(b.name)}</h3>
              <p class="comp-meta">${this.rarityBadge(b.rarity)}${
                heroName
                  ? ` · <span class="comp-hero-tag">${escapeHtml(heroName)}</span>`
                  : " · All heroes"
              }</p>
            </div>
          </div>
          <p>${escapeHtml(b.blurb)}</p>
          <p class="comp-meta">${escapeHtml(b.tag)}</p>
        </article>`;
        })
        .join("");
      return `<div class="comp-grid">${cards || emptyComp()}</div>`;
    }
    if (this.compendiumTab === "items") {
      let items = SHOP_ITEMS.filter(
        (i) => i.category === "gear" && this.matchesFilter(i.name, i.effect, i.rarity),
      );
      items = sortByRarityOrName(items, this.compSort, (i) => i.rarity, (i) => i.name);
      const cards = items
        .map(
          (i) => `
            <article class="comp-card compact item-comp">
              <div class="item-comp-top">
                ${itemArtImg(i.id, "item-art comp-item-art")}
                <div>
                  ${this.rarityBadge(i.rarity)}
                  <h3>${escapeHtml(i.name)}</h3>
                </div>
              </div>
              <p>${escapeHtml(i.effect)}</p>
              <p class="comp-meta">${i.cost}g · max ×${i.maxStacks}</p>
            </article>`,
        )
        .join("");
      return `<div class="comp-grid">${cards || emptyComp()}</div>`;
    }
    if (this.compendiumTab === "artifacts") {
      let items = SHOP_ITEMS.filter(
        (i) => i.category === "artifact" && this.matchesFilter(i.name, i.effect, i.rarity),
      );
      items = sortByRarityOrName(items, this.compSort, (i) => i.rarity, (i) => i.name);
      const cards = items
        .map(
          (i) => `
            <article class="comp-card compact">
              ${this.rarityBadge(i.rarity)}
              <h3>${escapeHtml(i.name)}</h3>
              <p>${escapeHtml(i.effect)}</p>
              <p class="comp-meta">${i.cost}g · max ×${i.maxStacks} · Artifact</p>
            </article>`,
        )
        .join("");
      return `<div class="comp-grid">${cards || emptyComp()}</div>`;
    }
    if (this.compendiumTab === "relics") {
      let relics = RELIC_LIST.filter((r) => this.matchesFilter(r.name, r.blurb, r.rarity));
      relics = sortByRarityOrName(relics, this.compSort, (r) => r.rarity, (r) => r.name);
      const cards = relics
        .map(
          (r) => `
        <article class="comp-card compact relic-comp">
          <div class="relic-comp-top">
            ${relicArtImg(r.id, "relic-art comp-relic-art")}
            <div>
              ${this.rarityBadge(r.rarity)}
              <h3>${escapeHtml(r.name)}</h3>
            </div>
          </div>
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
            <article class="comp-card compact enemy-comp">
              <div class="enemy-thumb"><canvas data-enemy="${k}"></canvas></div>
              <div class="enemy-comp-body">
                <h3>${escapeHtml(d.name)}</h3>
                <p>Intent: <strong>${escapeHtml(d.intent)}</strong>${d.ranged ? " · ranged" : ""}${d.dashSpeed ? " · dash" : ""}${d.projectileAoe ? " · AoE shell" : ""}${d.slamRadius ? " · slam" : ""}</p>
                <p class="comp-meta">HP ${d.maxHp} · Spd ${d.speed} · Contact ${d.contactDamage}/s${d.attackDamage ? ` · Shot ${d.attackDamage}` : ""} · Gold ${d.goldReward}</p>
              </div>
            </article>`;
            })
            .join("");
          return `<section class="comp-section"><h2 class="comp-section-title">${escapeHtml(title)}</h2><div class="comp-grid enemies">${cards}</div></section>`;
        })
        .join("");
      return sections || emptyComp();
    }
    if (this.compendiumTab === "ascensions") {
      const cards = ASCENSIONS.filter((a) => this.matchesFilter(a.name, a.blurb))
        .map(
          (a) => `
          <article class="comp-card compact">
            <h3>A${a.level} · ${escapeHtml(a.name)}</h3>
            <p>${escapeHtml(a.blurb || (a.level <= 0 ? "Baseline difficulty." : ""))}</p>
          </article>`,
        )
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
    if (this.compendiumTab === "branches") {
      let list = (Object.keys(BASE_BRANCHES) as BaseBranchId[]).filter((id) => {
        const b = BASE_BRANCHES[id];
        return this.matchesFilter(b.name, `${b.tag} ${b.blurb}`, b.rarity);
      });
      list = sortByRarityOrName(
        list.map((id) => BASE_BRANCHES[id]),
        this.compSort,
        (b) => b.rarity,
        (b) => b.name,
      ).map((b) => b.id);
      const cards = list
        .map((id) => {
          const b = BASE_BRANCHES[id]!;
          return `
          <article class="comp-card compact">
            ${this.rarityBadge(b.rarity)}
            <h3>${escapeHtml(b.name)}</h3>
            <p>${escapeHtml(b.blurb)}</p>
            <p class="comp-meta">${escapeHtml(b.tag)} · base branch</p>
          </article>`;
        })
        .join("");
      return `<div class="comp-grid">${cards || emptyComp()}</div>`;
    }
    const isSpecialMap = (m: (typeof MAP_LIST)[number]) =>
      !!(
        m.shiftingObstacles ||
        m.shrinkingLane ||
        m.movingHazards ||
        m.eclipseFog ||
        m.dualSpawners ||
        m.riftSurges ||
        m.volatileOrbs ||
        m.chestMagnet ||
        m.emberRain ||
        m.supplyDrops ||
        m.chronoPulse
      );
    const mapCard = (m: (typeof MAP_LIST)[number], tag = "") => `
        <article class="comp-card map-comp">
          <div class="map-thumb"><canvas data-map="${m.id}"></canvas></div>
          <h3>${escapeHtml(m.name)}${tag}</h3>
          <p>${escapeHtml(m.blurb)}</p>
          <p class="comp-meta">${shapeLabel(resolveMapShape(m))} · Obstacles ${m.obstacles.length} · High grounds ${m.highGrounds.length} · Artifacts ${m.turretSlots.length}</p>
        </article>`;
    const cards = MAP_LIST.filter((m) => this.matchesFilter(m.name, m.blurb))
      .slice()
      .sort((a, b) => Number(isSpecialMap(a)) - Number(isSpecialMap(b)))
      .map((m) => mapCard(m, isSpecialMap(m) ? ` <em class="special-tag">Special</em>` : ""))
      .join("");
    const customCards = listCustomMaps()
      .filter((c) => this.matchesFilter(c.name, c.blurb))
      .map((c) => mapCard(resolveMap(c.id), ` <em class="special-tag">Custom</em>`))
      .join("");
    return `<div class="comp-grid maps">${cards + customCards || emptyComp()}</div>`;
  }

  private renderCompendium(): string {
    const tabs = (
      ["heroes", "bonuses", "items", "artifacts", "relics", "enemies", "sends", "maps", "ascensions", "branches"] as const
    )
      .map(
        (tab) => `
        <button type="button" class="chip ${this.compendiumTab === tab ? "selected" : ""}" data-action="comp-tab" data-tab="${tab}">
          ${COMP_TAB_LABELS[tab] ?? capitalize(tab)}
        </button>`,
      )
      .join("");

    const showRarity =
      this.compendiumTab === "bonuses" ||
      this.compendiumTab === "items" ||
      this.compendiumTab === "artifacts" ||
      this.compendiumTab === "relics" ||
      this.compendiumTab === "branches";
    const rarityOpts = [
      `<option value="all"${this.compRarity === "all" ? " selected" : ""}>All rarities</option>`,
      ...RARITY_ORDER.map(
        (r) =>
          `<option value="${r}"${this.compRarity === r ? " selected" : ""}>${RARITY_LABEL[r]}</option>`,
      ),
    ].join("");

    return `
      <div class="prefs-layout">
        <header class="menu-header compact">
          ${this.backButton("main")}
          <h1 class="menu-title">Compendium</h1>
          <p class="menu-lead">Reference for heroes, bonuses, gear, relics, enemies, and maps.</p>
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
      </div>
    `;
  }

  private renderGameInfo(): string {
    return `
      <div class="info-layout expanded">
        <header class="menu-header compact info-header">
          ${this.backButton("main")}
          <h1 class="menu-title">Game Info</h1>
          <p class="menu-lead">Lane wars loop — send, spend, survive.</p>
        </header>

        <section class="info-hero">
          <p class="info-kicker">Core loop</p>
          <h2>Send to grow</h2>
          <p>Passive gold → buy <strong>send packs</strong> (1–6). Sending raises your income, then queues those creeps into the rival's next wave. Same gold snowballs economy and pressure.</p>
          <div class="info-open-block">
            <h3>Endless &amp; lives</h3>
            <p><strong>No rival lane</strong> (game type) has no enemy lane — sends feed <em>your</em> next wave. Optional <strong>Lives / wave</strong> and <strong>Lives / run</strong> change respawn rules; out of run lives loses the side.</p>
          </div>
        </section>

        <div class="info-grid roomy">
          <section class="info-block flat">
            <h2>The line</h2>
            <p>Base left, spawns right. Base death (or wave goal) ends the run. High ground = bonus damage. Win wave count is configurable; Unlimited fights until a base falls.</p>
          </section>
          <section class="info-block flat">
            <h2>Shop &amp; Artifacts</h2>
            <p><strong>F</strong> on the SHOP pad (click to buy — no digit hotkeys). Free placement: attack-click to plant Artifacts. <strong>U</strong> upgrades send packs; some levels draft a base branch.</p>
          </section>
          <section class="info-block flat">
            <h2>Heroes &amp; drafts</h2>
            <p>Starter six free; others via Barracks / challenges. Level &amp; relic drafts support Skip + rerolls. Utility drafts into Space at a chosen level.</p>
          </section>
          <section class="info-block flat">
            <h2>Controls</h2>
            <p>WASD move · LMB attack · RMB mobility · MMB ult · Space utility · 1–6 sends. Remap in Settings → Controls.</p>
          </section>
          <section class="info-block flat">
            <h2>Maps &amp; Ascension</h2>
            <p>Special layouts + A0–A15 modifiers. Custom maps/heroes in Workshop. Full kits in the Compendium.</p>
          </section>
          <section class="info-block flat">
            <h2>Meta</h2>
            <p><strong>War Crests</strong> → Barracks. Gameplay Barracks upgrades stay off in multiplayer / campaign unless you opt in. Challenges unlock purchases (not free). Export/import saves in Settings.</p>
          </section>
        </div>

        <section class="info-band">
          <h2>Modes</h2>
          <div class="info-band-cols">
            <div>
              <h3>Singleplayer</h3>
              <p>Named Game Types (Outlast / Race / Survival + custom) · Classic or neural AI · 1v1–3v3.</p>
            </div>
            <div>
              <h3>Multiplayer</h3>
              <p>PeerJS lobbies · 1v1 / 2v2 / 3v3 · 2p/3p PvE. Host sets Game Type; allies share a lane.</p>
            </div>
          </div>
        </section>

        <section class="info-open-block">
          <h3>More detail</h3>
          <ul>
            <li><strong>Enemy panel</strong> — top-right HP / income / send status; View lane flips camera.</li>
            <li><strong>AI Lab</strong> — train schools for Rookie→Brutal solo / PvE opponents.</li>
            <li><strong>Online</strong> — host-authoritative PeerJS; expect ongoing sync polish.</li>
          </ul>
        </section>
      </div>
    `;
  }

  private resolveCampaignNode(nodeId: string): void {
    if (!this.campaign) return;
    const node = campaignNode(this.campaign, nodeId);
    if (!node) return;

    if (node.kind === "combat" || node.kind === "elite" || node.kind === "boss") {
      beginCombatCheckpoint(this.campaign, nodeId);
      const asc =
        node.kind === "boss" ? 4 + (node.act - 1) * 3 : node.kind === "elite" ? 2 + node.act : node.act - 1;
      const fromGt = gameTypeToRunOptions(this.campaign.gameTypeOptions);
      const startGold =
        50 +
        (this.campaign.perks.includes("start_gold_30") ? 30 : 0) +
        this.campaign.abilityUpgrades.passive * 5;
      let gStart = (fromGt.startingGold ?? 50) + (startGold - 50);
      if (this.campaign.perks.includes("rsb_gold_debt")) gStart = Math.max(0, gStart - 10);
      const allowMeta =
        areCheatsEnabled() && loadCheatOptions().barracksInCampaign === true;
      // Persist map id across quit/resume so random does not re-roll.
      let mapId = this.campaign.combatMapId;
      if (!mapId) {
        mapId = resolveMapChoice("random");
        this.campaign.combatMapId = mapId;
        saveCampaignRun(this.campaign);
      }
      this.callbacks.onStartSingleplayer(this.campaign.heroId, {
        ...fromGt,
        mapId,
        startingGold: gStart,
        wavesToWin: 10,
        ascension: Math.min(12, asc),
        teamSize: 1,
        endless: false,
        suddenDeathBaseHp: this.campaign.baseHp,
        humanPlayers: 1,
        allowBarracks: allowMeta,
        campaignCombat: true,
      });
      return;
    }

    advanceTo(this.campaign, nodeId);
    if (node.kind === "event") {
      this.campaignEventId =
        CAMPAIGN_EVENTS[Math.floor(Math.random() * CAMPAIGN_EVENTS.length)]!.id;
      saveCampaignRun(this.campaign);
      this.render();
      return;
    }
    if (node.kind === "chest") {
      rollPendingChestRelic(this.campaign);
      this.campaignToast = "Chest opened — preview relic.";
      saveCampaignRun(this.campaign);
      this.render();
      return;
    }
    if (node.kind === "shop" || node.kind === "rest") {
      this.campaignToast = node.kind + " — choose below.";
      saveCampaignRun(this.campaign);
      this.render();
      return;
    }
    saveCampaignRun(this.campaign);
    this.render();
  }

  private renderCampaign(): string {
    const confirm = this.campaignConfirmAbandon
      ? `<div class="menu-confirm-overlay" role="alertdialog" aria-modal="true">
          <div class="menu-confirm-card">
            <h1>Abandon campaign?</h1>
            <p>This discards the whole run. Mid-combat quits already keep a battle checkpoint.</p>
            <div class="menu-confirm-actions">
              <button type="button" data-action="campaign-abandon-yes">Abandon</button>
              <button type="button" data-action="campaign-abandon-no">Cancel</button>
            </div>
          </div>
        </div>`
      : "";

    if (!this.campaign || !this.campaign.alive || this.campaignLobby) {
      if (!(this.campaign && this.campaign.alive && !this.campaignLobby)) {
        const meta = loadMetaStore();
        const cards = HERO_LIST.map((h) => {
          const selected = h.id === this.selectedHero;
          const unlocked = isHeroUnlocked(h.id, meta);
          return `
          <button type="button" class="hero-card compact shine-btn ${selected ? "selected" : ""} ${unlocked ? "" : "locked"}" data-action="pick-hero" data-hero-id="${h.id}" ${unlocked ? "" : 'data-tip="Unlock in Barracks"'}>
            <span class="hero-swatch" style="--hero:${h.color}"></span>
            <strong class="btn-label">${escapeHtml(h.name)}</strong>
            <span>${unlocked ? escapeHtml(h.blurb) : "Locked"}</span>
          </button>`;
        }).join("");
        const resume =
          this.campaign && this.campaign.alive
            ? `<button type="button" class="menu-btn primary shine-btn" data-action="campaign-resume"><span class="btn-label">Resume run</span></button>`
            : "";
        return `
          <div class="sp-run-layout campaign-lobby">
            ${confirm}
            <section class="sp-setup">
              <header class="menu-header compact">
                ${this.backButton("main")}
                <h1 class="menu-title">Campaign</h1>
                <p class="menu-lead">Lobby: pick hero + game type, then start a branching run.</p>
              </header>
              <div class="run-grid cols-2">
                ${gameTypeSelectHtml(this.campaignLobbyGameTypeId, "sp-game-type")}
                <label class="run-field">
                  <span>Edit</span>
                  <button type="button" class="menu-btn small ghost shine-btn" data-action="edit-gametypes" data-from="campaign" style="width:100%"><span class="btn-label">Edit Gametypes</span></button>
                </label>
              </div>
              ${(() => {
                const gt = getGameType(this.campaignLobbyGameTypeId);
                return gt.description
                  ? `<p class="menu-note">${escapeHtml(gt.description)}</p>`
                  : "";
              })()}
              <div class="hero-detail-panel">
                ${(() => {
                  const h = HEROES[this.selectedHero] ?? HERO_LIST[0]!;
                  return `<h3>${escapeHtml(h.name)}</h3>
                    <p>${escapeHtml(h.blurb)}</p>
                    <p class="comp-meta">Passive · ${escapeHtml(h.passive.name)}</p>
                    <p class="menu-note">${escapeHtml(h.passive.blurb)}</p>
                    <ul class="hero-ability-list">
                      ${h.abilities
                        .map(
                          (a) =>
                            `<li><strong>${escapeHtml(a.name)}</strong> — ${escapeHtml(a.hint)}</li>`,
                        )
                        .join("")}
                    </ul>`;
                })()}
              </div>
              <div class="campaign-lobby-actions">
                <button type="button" class="menu-btn primary shine-btn wide" data-action="campaign-new"><span class="btn-label">New run</span></button>
                ${resume}
              </div>
            </section>
            <section class="sp-heroes">
              <h2 class="sp-heroes-title">Hero</h2>
              <div class="hero-grid compact">${cards}</div>
            </section>
          </div>
        `;
      }
    }

    const run = this.campaign!;
    if (this.campaignStartBonusChoices?.length) {
      const cards = this.campaignStartBonusChoices
        .map(
          (b) =>
            `<button type="button" class="menu-btn shine-btn campaign-start-bonus" data-action="campaign-start-bonus" data-id="${b.id}">
              <span class="btn-label">${escapeHtml(b.name)}</span>
              <span class="btn-hint">${escapeHtml(b.blurb)}</span>
            </button>`,
        )
        .join("");
      return `
        <div class="prefs-layout">
          <header class="menu-header compact">
            ${this.backButton("main")}
            <h1 class="menu-title">Run start bonus</h1>
            <p class="menu-lead">Pick one — often power with a tradeoff.</p>
          </header>
          <div class="creative-check-grid campaign-start-bonus-grid">${cards}</div>
        </div>`;
    }

    const curId = run.activeCombatNodeId ?? run.currentNodeId;
    const cur = campaignNode(run, curId);
    const next = availableNext(run);
    const toast = this.campaignToast
      ? `<p class="menu-toast">${escapeHtml(this.campaignToast)}</p>`
      : "";
    this.campaignToast = "";
    const hero = resolveHero(run.heroId);

    let panel = "";
    if (this.campaignEventId) {
      const ev = CAMPAIGN_EVENTS.find((e) => e.id === this.campaignEventId)!;
      panel = `
        <section class="info-block">
          <h2>${escapeHtml(ev.title)}</h2>
          <p>${escapeHtml(ev.body)}</p>
          <div class="creative-check-grid">
            ${ev.choices
              .map(
                (c) =>
                  `<button type="button" class="menu-btn shine-btn" data-action="campaign-event" data-choice="${c.id}" data-tip="${escapeHtml(c.blurb)}"><span class="btn-label">${escapeHtml(c.label)}</span></button>`,
              )
              .join("")}
          </div>
        </section>`;
    } else if (cur?.kind === "shop") {
      panel = `
        <section class="info-block campaign-shop">
          <h2>Campaign shop</h2>
          <p>Permanent upgrades · ${run.coins} coins</p>
          <div class="comp-grid">
            ${CAMPAIGN_SHOP.map(
              (shop) =>
                `<button type="button" class="comp-card campaign-shop-card" data-action="campaign-shop" data-shop="${shop.id}" ${run.coins < shop.cost ? "disabled" : ""}>
                  <h3>${escapeHtml(shop.name)}</h3>
                  <p class="comp-meta">${shop.cost} coins</p>
                  <p>${escapeHtml(shop.blurb)}</p>
                </button>`,
            ).join("")}
          </div>
        </section>`;
    } else if (cur?.kind === "rest") {
      panel = `
        <section class="info-block">
          <h2>Rest site</h2>
          <div class="creative-check-grid">
            <button type="button" class="menu-btn shine-btn" data-action="campaign-rest" data-rest="heal"><span class="btn-label">Heal base</span></button>
            <button type="button" class="menu-btn shine-btn" data-action="campaign-rest" data-rest="mobility"><span class="btn-label">Upgrade mobility</span></button>
            <button type="button" class="menu-btn shine-btn" data-action="campaign-rest" data-rest="ultimate"><span class="btn-label">Upgrade ultimate</span></button>
            <button type="button" class="menu-btn shine-btn" data-action="campaign-rest" data-rest="passive"><span class="btn-label">Upgrade passive</span></button>
          </div>
        </section>`;
    } else if (cur?.kind === "chest") {
      const rid = run.pendingChestRelicId;
      const relic = rid ? RELICS[rid] : null;
      panel = relic
        ? `
        <section class="info-block">
          <h2>Relic chest</h2>
          <article class="comp-card compact campaign-chest-preview">
            ${relicArtImg(relic.id, "relic-art comp-item-art")}
            <h3>${escapeHtml(relic.name)}</h3>
            <p>${escapeHtml(relic.blurb)}</p>
            <p class="comp-meta">${escapeHtml(relic.tag)}</p>
          </article>
          <div class="creative-check-grid" style="margin-top:10px">
            <button type="button" class="menu-btn primary shine-btn" data-action="campaign-chest" data-take="1"><span class="btn-label">Take relic</span></button>
            <button type="button" class="menu-btn ghost" data-action="campaign-chest" data-take="0"><span class="btn-label">Skip</span></button>
          </div>
        </section>`
        : `
        <section class="info-block">
          <h2>Relic chest</h2>
          <p>No relics left to claim.</p>
          <button type="button" class="menu-btn ghost" data-action="campaign-chest" data-take="0"><span class="btn-label">Continue</span></button>
        </section>`;
    }

    const pathBtns = next
      .map((n) => {
        const resume = run.activeCombatNodeId === n.id ? "RESUME · " : "";
        const label = `${resume}${n.kind.toUpperCase()} · A${n.act} R${n.row}`;
        return `<button type="button" class="menu-btn shine-btn" data-action="campaign-go" data-node="${n.id}"><span class="btn-label">${label}</span></button>`;
      })
      .join("");

    const bagHtml = this.campaignBagOpen
      ? `<aside class="campaign-bag-panel" role="dialog" aria-label="Run bag">
          <header class="campaign-bag-head">
            <h2>Bag</h2>
            <button type="button" class="menu-btn small ghost" data-action="campaign-bag-close">Close</button>
          </header>
          <div class="campaign-bag-body">
            <h3>Hero</h3>
            <p>${escapeHtml(hero.name)}</p>
            <h3>Relics (${run.relics.length})</h3>
            <ul class="campaign-bag-list">
              ${
                run.relics.length
                  ? run.relics
                      .map((id) => {
                        const r = RELICS[id];
                        return `<li>${r ? escapeHtml(r.name) : id}</li>`;
                      })
                      .join("")
                  : "<li class='muted'>None</li>"
              }
            </ul>
            <h3>Temp gear (${run.tempItems.length})</h3>
            <ul class="campaign-bag-list">
              ${
                run.tempItems.length
                  ? run.tempItems
                      .map((id) => {
                        const it = SHOP_ITEMS.find((s) => s.id === id);
                        return `<li>${it ? escapeHtml(it.name) : id}</li>`;
                      })
                      .join("")
                  : "<li class='muted'>None</li>"
              }
            </ul>
            <h3>Perks</h3>
            <ul class="campaign-bag-list">
              ${
                run.perks.length
                  ? run.perks.map((p) => `<li>${escapeHtml(p.replace(/^rsb_/, "").replace(/_/g, " "))}</li>`).join("")
                  : "<li class='muted'>None</li>"
              }
            </ul>
            <h3>Rerolls</h3>
            <p>${run.rerollTokens}</p>
          </div>
        </aside>`
      : "";

    return `
      <div class="prefs-layout campaign-map-layout">
        ${confirm}
        ${bagHtml}
        <header class="menu-header compact campaign-map-header">
          <div class="campaign-map-title-row">
            ${this.backButton("main")}
            <h1 class="menu-title">Campaign</h1>
            <button type="button" class="menu-btn small shine-btn" data-action="campaign-bag"><span class="btn-label">Bag</span></button>
          </div>
        </header>
        <div class="campaign-stat-panel" aria-label="Run status">
          <div class="campaign-stat-hero">
            <span class="campaign-stat-label">Hero</span>
            <strong>${escapeHtml(hero.name)}</strong>
          </div>
          <div class="campaign-stat-base">
            <span class="campaign-stat-label">Base</span>
            <strong>${Math.ceil(run.baseHp)}/${run.baseMaxHp}</strong>
          </div>
          <div class="campaign-stat-credits">
            <span class="credit-icon" aria-hidden="true"></span>
            <strong>${run.coins}</strong>
            <span class="campaign-stat-label">Credits</span>
          </div>
          <div class="campaign-stat-meta">
            <span>Act ${run.act}</span>
            <span>${cur ? cur.kind : "—"}${run.activeCombatNodeId ? " · fight" : ""}</span>
            <span>Relics ${run.relics.length}</span>
          </div>
        </div>
        ${toast}
        ${panel}
        <section class="info-block">
          <h2>Path</h2>
          <div class="creative-check-grid">${pathBtns || "<p class='comp-empty'>No further paths — run complete or restart.</p>"}</div>
        </section>
        <button type="button" class="menu-btn ghost danger" data-action="campaign-abandon"><span class="btn-label">Abandon run</span></button>
      </div>
    `;
  }

  private renderGameTypes(): string {
    const list = listGameTypes();
    const picks = list
      .map((t) => {
        const tip = escapeHtml(t.description || t.name);
        return `<button type="button" class="chip ${t.id === this.gtEditId ? "selected" : ""}" data-action="gt-pick" data-id="${t.id}" data-tip="${tip}">${escapeHtml(t.name)}${t.builtin ? "" : " ★"}</button>`;
      })
      .join("");
    const editing = list.find((t) => t.id === this.gtEditId) ?? list[0]!;
    const canDelete = !editing.builtin;
    const back = this.gtReturnToMp
      ? `<button type="button" class="menu-back" data-action="gt-back-mp">← Multiplayer</button>`
      : this.backButton(this.gtReturnScreen);
    const summary = escapeHtml(this.gtEditDescription || editing.description || "");
    return `
      <div class="prefs-layout">
        <header class="menu-header compact">
          ${back}
          <h1 class="menu-title">Game Type Editor</h1>
          <p class="menu-lead">Save named run rules for SP, MP, and Campaign.</p>
        </header>
        <div class="gt-type-picks">${picks}</div>
        ${summary ? `<p class="menu-note gt-summary">${summary}</p>` : ""}
        <div class="gt-editor-head">
          <label class="run-field"><span>Name</span>
            <input id="gt-name" type="text" maxlength="40" value="${escapeHtml(this.gtEditName)}" ${editing.builtin ? "readonly" : ""} />
          </label>
          <label class="run-field gt-desc-field"><span>Description</span>
            <textarea id="gt-desc" maxlength="160" rows="2" ${editing.builtin ? "readonly" : ""}>${escapeHtml(this.gtEditDescription)}</textarea>
          </label>
        </div>
        <div class="gt-action-bar">
          <button type="button" class="menu-btn small ghost shine-btn" data-action="gt-new"><span class="btn-label">New copy</span></button>
          <button type="button" class="menu-btn small primary shine-btn" data-action="gt-save"><span class="btn-label">Save</span></button>
          <button type="button" class="menu-btn small ghost shine-btn" data-action="gt-use"><span class="btn-label">Use</span></button>
          <button type="button" class="menu-btn small ghost shine-btn" data-action="gt-export"><span class="btn-label">Export</span></button>
          <button type="button" class="menu-btn small ghost shine-btn" data-action="gt-import"><span class="btn-label">Import</span></button>
          ${canDelete ? `<button type="button" class="menu-btn small ghost danger" data-action="gt-delete"><span class="btn-label">Delete</span></button>` : ""}
        </div>
        ${gameTypeOptionsFieldsHtml(this.gtEditOptions, "gt", true)}
        ${editing.builtin ? `<p class="menu-note">Built-in types save as a custom copy when you hit Save.</p>` : ""}
      </div>
    `;
  }

  private renderPatchNotes(): string {
    const pages = PATCH_NOTE_PAGES;
    const n = pages.length;
    const idx = n === 0 ? 0 : Math.min(this.patchPageIndex, n - 1);
    this.patchPageIndex = idx;
    const page = pages[idx];
    const pager =
      n <= 1
        ? page
          ? `<p class="patch-page-meta">${escapeHtml(page.heading)}</p>`
          : `<p class="patch-empty">No patch notes found.</p>`
        : `<div class="patch-pager" role="navigation" aria-label="Patch note versions">
            <button type="button" class="menu-btn small ghost patch-arrow" data-action="patch-prev" data-tip="Newer" aria-label="Newer version">←</button>
            <div class="patch-page-meta">
              <strong>${escapeHtml(page!.version)}</strong>
              <span>${escapeHtml(page!.date)}</span>
              <span class="patch-page-count">${idx + 1} / ${n}</span>
            </div>
            <button type="button" class="menu-btn small ghost patch-arrow" data-action="patch-next" data-tip="Older" aria-label="Older version">→</button>
          </div>`;

    const body = page
      ? `<div class="patch-body">${patchNotesBodyHtml(page.bodyMd)}</div>`
      : `<p class="patch-empty">No patch notes found.</p>`;

    return `
      <div class="prefs-layout patch-layout">
        <header class="menu-header compact">
          ${this.backButton("main")}
          <h1 class="menu-title">Patch Notes</h1>
          <p class="menu-lead">Newest first — flip versions with the arrows.</p>
        </header>
        ${pager}
        ${body}
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
      <div class="prefs-layout">
        <header class="menu-header compact">
          ${this.settingsBackButton()}
          <h1 class="menu-title">Settings</h1>
          <p class="menu-lead">Local client prefs — saved in this browser.</p>
        </header>
        <section class="menu-section settings-groups">
          <div class="settings-group">
            <h2>Audio</h2>
            <label class="setting-row">
              <span>Master volume <em id="volume-label">${Math.round(s.masterVolume * 100)}%</em></span>
              <input type="range" min="0" max="1" step="0.05" value="${s.masterVolume}" data-field="volume" />
            </label>
            <label class="setting-row">
              <span>Music volume <em id="music-volume-label">${Math.round(s.musicVolume * 100)}%</em></span>
              <input type="range" min="0" max="1" step="0.05" value="${s.musicVolume}" data-field="music-volume" />
            </label>
            <label class="setting-row">
              <span>SFX volume <em id="sfx-volume-label">${Math.round(s.sfxVolume * 100)}%</em></span>
              <input type="range" min="0" max="1" step="0.05" value="${s.sfxVolume}" data-field="sfx-volume" />
            </label>
            <label class="setting-row check">
              <span>Main menu music<em>Shuffle on title screens</em></span>
              <input type="checkbox" data-setting="menuMusicEnabled" ${s.menuMusicEnabled ? "checked" : ""} />
            </label>
          </div>
          <div class="settings-group">
            <h2>Gameplay</h2>
            <button type="button" class="setting-row setting-nav" data-action="goto" data-screen="controls">
              <span>Controls<em>Keyboard, mouse, Xbox pad</em></span>
              <span class="chevron">›</span>
            </button>
            <label class="setting-row check">
              <span>Auto-open shop<em>Once on shop pad</em></span>
              <input type="checkbox" data-setting="autoOpenShop" ${s.autoOpenShop ? "checked" : ""} />
            </label>
            <label class="setting-row check">
              <span>Artifact place delay<em>Debounce free placement after buy</em></span>
              <input type="checkbox" data-setting="artifactPlaceDebounce" ${s.artifactPlaceDebounce !== false ? "checked" : ""} />
            </label>
            <label class="setting-row check">
              <span>Reject peer customs<em>Block MP custom maps/heroes</em></span>
              <input type="checkbox" data-setting="rejectPeerCustoms" ${s.rejectPeerCustoms ? "checked" : ""} />
            </label>
            <label class="setting-row check">
              <span>Run start bonuses<em>Campaign 1-of-3 pick after hero</em></span>
              <input type="checkbox" data-setting="campaignRunStartBonuses" ${s.campaignRunStartBonuses !== false ? "checked" : ""} />
            </label>
          </div>
          <div class="settings-group">
            <h2>Display &amp; motion</h2>
            <label class="setting-row check">
              <span>Show damage numbers</span>
              <input type="checkbox" data-setting="showDamageNumbers" ${s.showDamageNumbers ? "checked" : ""} />
            </label>
            <label class="setting-row">
              <span>Damage screen FX<em>Flash / vignette</em></span>
              <select data-field="damage-fx">${fxOpts}</select>
            </label>
            <label class="setting-row check">
              <span>Screen shake</span>
              <input type="checkbox" data-setting="screenShake" ${s.screenShake ? "checked" : ""} />
            </label>
            <label class="setting-row check">
              <span>Reduce motion<em>Disables shine &amp; idle FX</em></span>
              <input type="checkbox" data-setting="reduceMotion" ${s.reduceMotion ? "checked" : ""} />
            </label>
          </div>
        </section>
        <div class="menu-footer">
          <button type="button" class="menu-btn shine-btn" data-action="export-save"><span class="btn-label">Export save</span></button>
          <button type="button" class="menu-btn shine-btn" data-action="import-save"><span class="btn-label">Import save</span></button>
          <button type="button" class="menu-btn ghost danger" data-action="reset-settings"><span class="btn-label">Reset defaults</span></button>
        </div>
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
      return `<div class="bind-section"><h2>${title}</h2>${rows}</div>`;
    };

    return `
      <div class="prefs-layout">
        <header class="menu-header compact">
          ${this.backButton("settings")}
          <h1 class="menu-title">Controls</h1>
          <p class="menu-lead">Remap keyboard/mouse and Xbox pad separately. Left stick always moves.</p>
        </header>
        <section class="menu-section bind-sections">
          <div class="bind-section">
            <h2>Gamepad</h2>
            <label class="setting-row">
              <span>Enable gamepad</span>
              <input type="checkbox" data-setting="gamepadEnabled" ${this.settings.gamepadEnabled ? "checked" : ""} />
            </label>
          </div>
          ${section("Combat", COMBAT_ACTIONS)}
          ${section("Movement", MOVE_ACTIONS)}
          ${section("Utility / Sends", UTILITY_ACTIONS)}
        </section>
        ${
          this.rebinding
            ? `<p class="menu-footnote">Listening… Esc to cancel.</p>`
            : `<div class="menu-footer"><button type="button" class="menu-btn ghost danger" data-action="reset-binds"><span class="btn-label">Reset defaults</span></button></div>`
        }
      </div>
    `;
  }

  private renderChallenges(): string {
    const store = loadMetaStore();
    const cards = CHALLENGES.map((c) => {
      const done = isChallengeComplete(c.id, store);
      const unlock = META_UPGRADES.find((u) => u.id === c.unlocks);
      const owned = unlock ? getRank(store, unlock.id) >= 1 : false;
      return `
        <article class="meta-card ${done ? "done" : ""}">
          <div class="meta-card-top">
            <strong>${escapeHtml(c.name)}</strong>
            <span class="chip ${done ? "selected" : ""}">${done ? "Done" : "Locked"}</span>
          </div>
          <span class="stat-hint">${escapeHtml(c.blurb)}</span>
          <em>${escapeHtml(challengeProgressHint(c, store))} · Reward: ${
            c.crestReward ? `${c.crestReward} Crests + ` : ""
          }${escapeHtml(unlock?.name ?? c.unlocks)}${owned ? " (purchased)" : done ? " (buy in Barracks)" : ""}</em>
        </article>`;
    }).join("");
    return `
      <div class="meta-hub">
        <header class="menu-header compact">
          ${this.backButton("main")}
          <h1 class="menu-title">Challenges</h1>
          <p class="menu-lead">Unlock Barracks purchases — rewards still cost Crests.</p>
        </header>
        <div class="meta-card-grid">${cards}</div>
        <div class="menu-footer">
          <button type="button" class="menu-btn shine-btn" data-action="goto" data-screen="barracks"><span class="btn-label">Open Barracks</span></button>
        </div>
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
      { key: "oneShot", label: "One-shot" },
      { key: "freeShop", label: "Free shop" },
      { key: "revealFog", label: "Reveal fog" },
      { key: "barracksInCampaign", label: "Barracks in Campaign" },
    ];
    return `
      <div class="prefs-layout">
        <header class="menu-header compact">
          ${this.backButton("main")}
          <h1 class="menu-title">Cheats</h1>
          <p class="menu-lead" style="color:#e08060">Sandbox profile — real Barracks progress stays cached.</p>
        </header>
        <section class="menu-section muted-box">
          <button type="button" class="menu-btn ${on ? "danger" : "primary shine-btn"}" data-action="toggle-cheats">
            <span class="btn-label">${on ? "Disable cheats · restore profile" : "Enable cheats · enter sandbox"}</span>
          </button>
          <p class="menu-note">${on ? "ACTIVE — sandbox profile" : "Off — real profile"} · Solo-only gameplay cheats; Unlock All always applies.</p>
        </section>
        <section class="menu-section cheats-toggle-grid">
          ${toggles
            .map(
              (t) => `
            <label class="setting-row">
              <span>${t.label}${t.key === "unlockAll" ? "" : " <em>(solo)</em>"}</span>
              <input type="checkbox" data-cheat="${t.key}" ${o[t.key] ? "checked" : ""} ${on ? "" : "disabled"} />
            </label>`,
            )
            .join("")}
        </section>
      </div>
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
                <button type="button" class="menu-btn tiny ghost danger" data-action="ai-del-school" data-school="${escapeHtml(s.name)}">Delete</button>
              </span>
            </div>`;
            })
            .join("");

    return `
      <div class="prefs-layout">
        <header class="menu-header compact">
          ${this.backButton("main")}
          <h1 class="menu-title">AI Lab</h1>
          <p class="menu-lead">Train duel brains → Rookie–Brutal solo / PvE tiers.</p>
        </header>

        <div class="ai-lab-layout">
          <section class="menu-section muted-box">
            <h2>Train</h2>
            <label class="setting-row">
              <span>Recipe</span>
              <select id="ai-recipe">${recipeOpts}</select>
            </label>
            <div class="ai-train-params">
              <label class="setting-row">
                <span>Gens</span>
                <input type="number" id="ai-gens" min="3" max="40" value="10" />
              </label>
              <label class="setting-row">
                <span>Pop</span>
                <input type="number" id="ai-pop" min="4" max="24" value="8" />
              </label>
              <label class="setting-row">
                <span>Trials</span>
                <input type="number" id="ai-trials" min="1" max="6" value="2" />
              </label>
              <label class="setting-row">
                <span>Duel cap (s)</span>
                <input type="number" id="ai-seconds" min="60" max="400" value="180" />
              </label>
            </div>
            <label class="setting-row">
              <span>School name</span>
              <input id="ai-name" maxlength="24" value="balanced" />
            </label>
            ${this.aiTrainRunOptionsHtml()}
            <p class="menu-note" id="ai-status">${escapeHtml(
              prog
                ? prog.message
                : store.schools.length
                  ? `${store.schools.length} school(s) saved.`
                  : "No schools yet — Classic AI is used.",
            )}</p>
            <div class="choice-row">
              <button type="button" class="menu-btn primary shine-btn" id="ai-start" data-action="ai-start" ${isTraining() ? "disabled" : ""}><span class="btn-label">Start training</span></button>
              <button type="button" class="menu-btn danger" id="ai-stop" data-action="ai-stop" ${isTraining() ? "" : "disabled"}><span class="btn-label">Stop</span></button>
            </div>
          </section>

          <div class="ai-lab-side">
            <section class="menu-section muted-box">
              <h2>Match opponent</h2>
              <label class="setting-row">
                <span>Selected AI</span>
                <select data-field="ai-opponent">${oppOpts}</select>
              </label>
            </section>
            <section class="menu-section">
              <h2>Schools</h2>
              <div class="history-list">${schools}</div>
            </section>
          </div>
        </div>
      </div>
    `;
  }

  private renderBarracks(): string {
    const store = loadMetaStore();
    const cards = META_UPGRADES.map((u) => {
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
        <article class="meta-card">
          <div class="meta-card-top">
            <strong>${escapeHtml(u.name)}</strong>
            <em>${escapeHtml(rankLabel)}</em>
          </div>
          <span class="stat-hint">${escapeHtml(u.blurb)}${escapeHtml(challengeNote)}</span>
          <button type="button" class="menu-btn ${canBuy ? "primary shine-btn" : ""}" data-action="buy-meta" data-upgrade-id="${u.id}" ${maxed || !canBuy ? "disabled" : ""}>
            <span class="btn-label">${maxed ? "Max" : challengeBlocked ? "Challenge" : `${cost} crests`}</span>
          </button>
        </article>`;
    }).join("");

    const ascName = ASCENSIONS.find((a) => a.level === store.ascensionUnlocked)?.name ?? "Standard";

    return `
      <div class="meta-hub">
        <header class="menu-header compact">
          ${this.backButton("main")}
          <h1 class="menu-title">Barracks</h1>
          <p class="menu-lead">Spend War Crests on permanent ranks &amp; unlocks.</p>
        </header>
        <div class="menu-hero-stats" aria-label="Progression summary">
          <div class="stat-tile stat-crest">
            <p class="stat-label">War Crests</p>
            <p class="stat-value">${store.crests}</p>
            <p class="stat-hint">Earn at run end</p>
          </div>
          <div class="stat-tile">
            <p class="stat-label">Wins</p>
            <p class="stat-value">${store.totalWins}</p>
            <p class="stat-hint">${store.totalRuns} runs</p>
          </div>
          <div class="stat-tile">
            <p class="stat-label">Best wave</p>
            <p class="stat-value">${store.bestWave}</p>
            <p class="stat-hint">Career peak</p>
          </div>
          <div class="stat-tile">
            <p class="stat-label">Ascension</p>
            <p class="stat-value">A${store.ascensionUnlocked}</p>
            <p class="stat-hint">${escapeHtml(ascName)}</p>
          </div>
        </div>
        <h2 class="meta-section-title">Upgrades</h2>
        <div class="meta-card-grid">${cards}</div>
        <p class="menu-note">Win at max Ascension to unlock the next. Crests scale with waves, sends, and Ascension.</p>
      </div>
    `;
  }
}

function randomAiSelection(store: AiStore): AiSelection {
  const options: AiSelection[] = [{ kind: "classic" }];
  for (const s of store.schools) {
    for (const tier of ["rookie", "steady", "sharp", "brutal"] as const) {
      options.push({ kind: "neural", school: s.name, tier });
    }
  }
  return pickOne(options);
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
