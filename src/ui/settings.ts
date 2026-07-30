const STORAGE_KEY = "hlw-settings-v3";

/** Mouse: 0 left, 1 middle, 2 right. Keyboard: KeyboardEvent.code */
export type Binding =
  | { device: "mouse"; button: 0 | 1 | 2 }
  | { device: "key"; code: string };

export type CombatAction = "attack" | "mobility" | "ultimate";

export type Keybinds = Record<CombatAction, Binding>;

/** Screen flash / vignette / shake intensity when the hero takes damage. */
export type DamageScreenFx = "off" | "reduced" | "full";

export type ClientSettings = {
  masterVolume: number;
  showDamageNumbers: boolean;
  screenShake: boolean;
  reduceMotion: boolean;
  damageScreenFx: DamageScreenFx;
  keybinds: Keybinds;
};

export const DEFAULT_KEYBINDS: Keybinds = {
  attack: { device: "mouse", button: 0 },
  mobility: { device: "mouse", button: 2 },
  ultimate: { device: "mouse", button: 1 },
};

const DEFAULTS: ClientSettings = {
  masterVolume: 0.7,
  showDamageNumbers: true,
  screenShake: true,
  reduceMotion: false,
  damageScreenFx: "full",
  keybinds: { ...DEFAULT_KEYBINDS },
};

export function loadSettings(): ClientSettings {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem("hlw-settings-v2") ??
      localStorage.getItem("hlw-settings-v1");
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw) as Partial<ClientSettings>;
    const fx = parsed.damageScreenFx;
    return {
      ...DEFAULTS,
      ...parsed,
      damageScreenFx: fx === "off" || fx === "reduced" || fx === "full" ? fx : DEFAULTS.damageScreenFx,
      keybinds: {
        ...DEFAULT_KEYBINDS,
        ...(parsed.keybinds ?? {}),
      },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveSettings(settings: ClientSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function bindingEquals(a: Binding, b: Binding): boolean {
  if (a.device !== b.device) return false;
  if (a.device === "mouse" && b.device === "mouse") return a.button === b.button;
  if (a.device === "key" && b.device === "key") return a.code === b.code;
  return false;
}

export function formatBinding(b: Binding): string {
  if (b.device === "mouse") {
    return b.button === 0 ? "LMB" : b.button === 1 ? "MMB" : "RMB";
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

export const ACTION_LABELS: Record<CombatAction, string> = {
  attack: "Attack",
  mobility: "Mobility",
  ultimate: "Ultimate",
};

export const ACTION_HINTS: Record<CombatAction, string> = {
  attack: "Basic attack (hold) — aim with mouse (Prism auto-aims)",
  mobility: "Movement / utility ability",
  ultimate: "Big cooldown ability",
};

export const DAMAGE_FX_LABELS: Record<DamageScreenFx, string> = {
  full: "Full",
  reduced: "Reduced",
  off: "Off",
};
