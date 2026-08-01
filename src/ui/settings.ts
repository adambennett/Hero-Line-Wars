const STORAGE_KEY = "hlw-settings-v6";

/** Mouse: 0 left, 1 middle, 2 right. Keyboard: KeyboardEvent.code. Gamepad: button index. */
export type Binding =
  | { device: "mouse"; button: 0 | 1 | 2 }
  | { device: "key"; code: string }
  | { device: "gamepad"; button: number };

/** Combat: attack/mobility/ultimate + global utility slot (Space by default; ultimate stays MMB). */
export type CombatAction = "attack" | "mobility" | "ultimate" | "utility";
export type MoveAction = "moveUp" | "moveDown" | "moveLeft" | "moveRight";
export type UtilityAction =
  | "shop"
  | "pause"
  | "upgradeBase"
  | "inventory"
  | "laneFlip"
  | "send1"
  | "send2"
  | "send3"
  | "send4"
  | "send5"
  | "send6";

export type BindableAction = CombatAction | MoveAction | UtilityAction;

export type Keybinds = Record<BindableAction, Binding>;

/** Screen flash / vignette / shake intensity when the hero takes damage. */
export type DamageScreenFx = "off" | "reduced" | "full";

export type ClientSettings = {
  /** Overall gain — multiplies music and SFX. */
  masterVolume: number;
  /** Menu / battle music submix (0–1), after master. */
  musicVolume: number;
  /** Procedural SFX submix (0–1), after master. */
  sfxVolume: number;
  /** When false, main-menu playlist stays silent. */
  menuMusicEnabled: boolean;
  showDamageNumbers: boolean;
  screenShake: boolean;
  reduceMotion: boolean;
  damageScreenFx: DamageScreenFx;
  /** Open shop once when walking onto the shop pad (default off — press shop bind). */
  autoOpenShop: boolean;
  /**
   * When true, refuse MP matches that ship custom maps/heroes so peer payloads
   * are never registered on this machine for that match.
   */
  rejectPeerCustoms: boolean;
  keybinds: Keybinds;
  /** Prefer gamepad when a pad is connected and recently used. */
  gamepadEnabled: boolean;
};

/** Xbox / standard mapping defaults (Gamepad API). */
export const DEFAULT_KEYBINDS: Keybinds = {
  attack: { device: "mouse", button: 0 },
  mobility: { device: "mouse", button: 2 },
  ultimate: { device: "mouse", button: 1 },
  /** Global utility slot — Space (ultimate remains MMB). */
  utility: { device: "key", code: "Space" },
  moveUp: { device: "key", code: "KeyW" },
  moveDown: { device: "key", code: "KeyS" },
  moveLeft: { device: "key", code: "KeyA" },
  moveRight: { device: "key", code: "KeyD" },
  shop: { device: "key", code: "KeyF" },
  pause: { device: "key", code: "Escape" },
  upgradeBase: { device: "key", code: "KeyU" },
  inventory: { device: "key", code: "KeyI" },
  laneFlip: { device: "key", code: "KeyV" },
  send1: { device: "key", code: "Digit1" },
  send2: { device: "key", code: "Digit2" },
  send3: { device: "key", code: "Digit3" },
  send4: { device: "key", code: "Digit4" },
  send5: { device: "key", code: "Digit5" },
  send6: { device: "key", code: "Digit6" },
};

/** Default gamepad overlays (merged into remapping UI as alternate device). */
export const DEFAULT_GAMEPAD: Partial<Record<BindableAction, Binding>> = {
  attack: { device: "gamepad", button: 7 }, // RT
  mobility: { device: "gamepad", button: 0 }, // A
  ultimate: { device: "gamepad", button: 3 }, // Y
  utility: { device: "gamepad", button: 10 }, // L3
  shop: { device: "gamepad", button: 2 }, // X
  pause: { device: "gamepad", button: 9 }, // Start
  upgradeBase: { device: "gamepad", button: 1 }, // B
  inventory: { device: "gamepad", button: 8 }, // Back
  laneFlip: { device: "gamepad", button: 5 }, // RB
  send1: { device: "gamepad", button: 14 }, // D-pad left
  send2: { device: "gamepad", button: 12 }, // D-pad up
  send3: { device: "gamepad", button: 15 }, // D-pad right
  send4: { device: "gamepad", button: 13 }, // D-pad down
  send5: { device: "gamepad", button: 4 }, // LB
  send6: { device: "gamepad", button: 6 }, // LT
};

export type GamepadBinds = Partial<Record<BindableAction, Binding>>;

export type ClientSettingsFull = ClientSettings & {
  gamepadBinds: GamepadBinds;
};

const DEFAULTS: ClientSettingsFull = {
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
  keybinds: { ...DEFAULT_KEYBINDS },
  gamepadEnabled: true,
  gamepadBinds: { ...DEFAULT_GAMEPAD },
};

function clamp01(n: unknown, fallback: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

export function loadSettings(): ClientSettingsFull {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem("hlw-settings-v5") ??
      localStorage.getItem("hlw-settings-v4") ??
      localStorage.getItem("hlw-settings-v3") ??
      localStorage.getItem("hlw-settings-v2") ??
      localStorage.getItem("hlw-settings-v1");
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw) as Partial<ClientSettingsFull>;
    const fx = parsed.damageScreenFx;
    return {
      ...DEFAULTS,
      ...parsed,
      masterVolume: clamp01(parsed.masterVolume, DEFAULTS.masterVolume),
      musicVolume: clamp01(parsed.musicVolume, DEFAULTS.musicVolume),
      sfxVolume: clamp01(parsed.sfxVolume, DEFAULTS.sfxVolume),
      menuMusicEnabled:
        typeof parsed.menuMusicEnabled === "boolean" ? parsed.menuMusicEnabled : DEFAULTS.menuMusicEnabled,
      damageScreenFx: fx === "off" || fx === "reduced" || fx === "full" ? fx : DEFAULTS.damageScreenFx,
      autoOpenShop: typeof parsed.autoOpenShop === "boolean" ? parsed.autoOpenShop : DEFAULTS.autoOpenShop,
      rejectPeerCustoms:
        typeof parsed.rejectPeerCustoms === "boolean"
          ? parsed.rejectPeerCustoms
          : DEFAULTS.rejectPeerCustoms,
      keybinds: {
        ...DEFAULT_KEYBINDS,
        ...(parsed.keybinds ?? {}),
      },
      gamepadBinds: {
        ...DEFAULT_GAMEPAD,
        ...(parsed.gamepadBinds ?? {}),
      },
      gamepadEnabled: parsed.gamepadEnabled ?? true,
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveSettings(settings: ClientSettings | ClientSettingsFull): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  syncMotionPreference(settings);
}

/** Mirror reduce-motion onto `<html>` so CSS can kill shine / idle menu motion. */
export function syncMotionPreference(settings?: Pick<ClientSettings, "reduceMotion"> | ClientSettingsFull): void {
  if (typeof document === "undefined") return;
  const on = !!(settings?.reduceMotion ?? loadSettings().reduceMotion);
  document.documentElement.classList.toggle("reduce-motion", on);
}

export function bindingEquals(a: Binding, b: Binding): boolean {
  if (a.device !== b.device) return false;
  if (a.device === "mouse" && b.device === "mouse") return a.button === b.button;
  if (a.device === "key" && b.device === "key") return a.code === b.code;
  if (a.device === "gamepad" && b.device === "gamepad") return a.button === b.button;
  return false;
}

const GP_NAMES: Record<number, string> = {
  0: "A",
  1: "B",
  2: "X",
  3: "Y",
  4: "LB",
  5: "RB",
  6: "LT",
  7: "RT",
  8: "Back",
  9: "Start",
  10: "L3",
  11: "R3",
  12: "D↑",
  13: "D↓",
  14: "D←",
  15: "D→",
};

export function formatBinding(b: Binding): string {
  if (b.device === "mouse") {
    return b.button === 0 ? "LMB" : b.button === 1 ? "MMB" : "RMB";
  }
  if (b.device === "gamepad") {
    return `Pad ${GP_NAMES[b.button] ?? `Btn${b.button}`}`;
  }
  return formatKeyCode(b.code);
}

export function formatKeyCode(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const aliases: Record<string, string> = {
    Space: "Space",
    ShiftLeft: "L-Shift",
    ShiftRight: "R-Shift",
    ControlLeft: "L-Ctrl",
    ControlRight: "R-Ctrl",
    AltLeft: "L-Alt",
    AltRight: "R-Alt",
    Escape: "Esc",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    MouseLeft: "LMB",
    MouseMiddle: "MMB",
    MouseRight: "RMB",
  };
  return aliases[code] ?? code;
}

export const ACTION_LABELS: Record<BindableAction, string> = {
  attack: "Attack",
  mobility: "Mobility",
  ultimate: "Ultimate",
  utility: "Utility",
  moveUp: "Move Up",
  moveDown: "Move Down",
  moveLeft: "Move Left",
  moveRight: "Move Right",
  shop: "Shop",
  pause: "Pause",
  upgradeBase: "Upgrade Base",
  inventory: "Inventory",
  laneFlip: "Lane Flip",
  send1: "Send 1",
  send2: "Send 2",
  send3: "Send 3",
  send4: "Send 4",
  send5: "Send 5",
  send6: "Send 6",
};

export const ACTION_HINTS: Record<BindableAction, string> = {
  attack: "Basic attack (hold) — aim with mouse / right stick",
  mobility: "Movement / reposition ability",
  ultimate: "Big cooldown ability",
  utility: "Global utility slot (drafted mid-run)",
  moveUp: "Walk up (keyboard; left stick always moves on pad)",
  moveDown: "Walk down",
  moveLeft: "Walk left",
  moveRight: "Walk right",
  shop: "Open / close shop near base",
  pause: "Pause menu",
  upgradeBase: "Buy next base upgrade",
  inventory: "Open inventory bag",
  laneFlip: "Toggle enemy lane view",
  send1: "Buy send pack slot 1",
  send2: "Buy send pack slot 2",
  send3: "Buy send pack slot 3",
  send4: "Buy send pack slot 4",
  send5: "Buy send pack slot 5",
  send6: "Buy send pack slot 6",
};

export const COMBAT_ACTIONS: CombatAction[] = ["attack", "mobility", "ultimate", "utility"];
export const MOVE_ACTIONS: MoveAction[] = ["moveUp", "moveDown", "moveLeft", "moveRight"];
export const UTILITY_ACTIONS: UtilityAction[] = [
  "shop",
  "pause",
  "upgradeBase",
  "inventory",
  "laneFlip",
  "send1",
  "send2",
  "send3",
  "send4",
  "send5",
  "send6",
];
export const ALL_BINDABLE: BindableAction[] = [
  ...COMBAT_ACTIONS,
  ...MOVE_ACTIONS,
  ...UTILITY_ACTIONS,
];

export const DAMAGE_FX_LABELS: Record<DamageScreenFx, string> = {
  full: "Full",
  reduced: "Reduced",
  off: "Off",
};
