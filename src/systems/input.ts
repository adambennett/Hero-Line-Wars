import {
  loadSettings,
  type Binding,
  type BindableAction,
  type Keybinds,
  type GamepadBinds,
} from "../ui/settings";

/** Only block game keys when the user is typing in a real field — never for buttons/panels. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean((target as HTMLElement).isContentEditable);
}

const DEADZONE = 0.28;

export class Input {
  readonly keys = new Set<string>();
  private readonly justPressed = new Set<string>();
  private readonly mouseDown = new Set<number>();
  private readonly mouseJustPressed = new Set<number>();
  private binds: Keybinds = loadSettings().keybinds;
  private gamepadBinds: GamepadBinds = loadSettings().gamepadBinds;
  private gamepadEnabled = loadSettings().gamepadEnabled;
  private gpPrevButtons = new Map<number, boolean>();
  private gpJustPressed = new Set<number>();
  private gpStickX = 0;
  private gpStickY = 0;
  private gpAimX = 0;
  private gpAimY = 0;
  private usingGamepad = false;
  /** Client (CSS) pixel coords relative to the game canvas. */
  mouseClientX = 0;
  mouseClientY = 0;

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      if (e.repeat || isTypingTarget(e.target)) return;
      this.usingGamepad = false;
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === "Space") e.preventDefault();
    });
    target.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });
    target.addEventListener(
      "mousedown",
      (e) => {
        // HUD / menus own their clicks; don't treat those as attack/mobility presses.
        if (e.target instanceof Element && e.target.closest("#menus, #overlay, #relic-draft, #shop-panel, #send-bar, #inv-panel, #lane-chrome, #opponent-panel, button, a")) {
          return;
        }
        this.usingGamepad = false;
        if (!this.mouseDown.has(e.button)) this.mouseJustPressed.add(e.button);
        this.mouseDown.add(e.button);
        if (e.button === 1 || e.button === 2) e.preventDefault();
      },
      true,
    );
    target.addEventListener(
      "mouseup",
      (e) => {
        this.mouseDown.delete(e.button);
      },
      true,
    );
    target.addEventListener(
      "auxclick",
      (e) => {
        if (!(e.target instanceof Element && e.target.closest("button, a, input, textarea")) && e.button === 1) {
          e.preventDefault();
        }
      },
      true,
    );
    target.addEventListener("contextmenu", (e) => {
      if (!(e.target instanceof Element && e.target.closest("button, a, input, textarea, #menus, #overlay"))) {
        e.preventDefault();
      }
    });
    target.addEventListener("mousemove", (e) => {
      this.mouseClientX = e.clientX;
      this.mouseClientY = e.clientY;
      this.usingGamepad = false;
    });
    target.addEventListener("blur", () => {
      this.keys.clear();
      this.justPressed.clear();
      this.mouseDown.clear();
      this.mouseJustPressed.clear();
    });
    window.addEventListener("gamepadconnected", () => {
      /* poll handles it */
    });
  }

  reloadBinds(): void {
    const s = loadSettings();
    this.binds = s.keybinds;
    this.gamepadBinds = s.gamepadBinds;
    this.gamepadEnabled = s.gamepadEnabled;
  }

  setBinds(binds: Keybinds): void {
    this.binds = binds;
  }

  /** Call once per frame before reading actions. */
  pollGamepad(): void {
    this.gpJustPressed.clear();
    if (!this.gamepadEnabled) {
      this.gpStickX = 0;
      this.gpStickY = 0;
      return;
    }
    const pads = navigator.getGamepads?.() ?? [];
    let pad: Gamepad | null = null;
    for (const p of pads) {
      if (p) {
        pad = p;
        break;
      }
    }
    if (!pad) {
      this.gpStickX = 0;
      this.gpStickY = 0;
      return;
    }

    const lx = pad.axes[0] ?? 0;
    const ly = pad.axes[1] ?? 0;
    const rx = pad.axes[2] ?? 0;
    const ry = pad.axes[3] ?? 0;
    this.gpStickX = Math.abs(lx) > DEADZONE ? lx : 0;
    this.gpStickY = Math.abs(ly) > DEADZONE ? ly : 0;
    this.gpAimX = Math.abs(rx) > DEADZONE ? rx : 0;
    this.gpAimY = Math.abs(ry) > DEADZONE ? ry : 0;

    if (
      Math.abs(this.gpStickX) > 0 ||
      Math.abs(this.gpStickY) > 0 ||
      Math.abs(this.gpAimX) > 0 ||
      Math.abs(this.gpAimY) > 0
    ) {
      this.usingGamepad = true;
    }

    for (let i = 0; i < pad.buttons.length; i++) {
      const pressed = !!pad.buttons[i]?.pressed || (pad.buttons[i]?.value ?? 0) > 0.4;
      const was = this.gpPrevButtons.get(i) ?? false;
      if (pressed && !was) {
        this.gpJustPressed.add(i);
        this.usingGamepad = true;
      }
      this.gpPrevButtons.set(i, pressed);
    }
  }

  isUsingGamepad(): boolean {
    return this.usingGamepad;
  }

  gamepadAim(): { x: number; y: number } {
    return { x: this.gpAimX, y: this.gpAimY };
  }

  consumePress(code: string): boolean {
    if (!this.justPressed.has(code)) return false;
    this.justPressed.delete(code);
    return true;
  }

  consumeBinding(binding: Binding): boolean {
    if (binding.device === "mouse") {
      if (!this.mouseJustPressed.has(binding.button)) return false;
      this.mouseJustPressed.delete(binding.button);
      return true;
    }
    if (binding.device === "gamepad") {
      if (!this.gpJustPressed.has(binding.button)) return false;
      this.gpJustPressed.delete(binding.button);
      return true;
    }
    return this.consumePress(binding.code);
  }

  isBindingHeld(binding: Binding): boolean {
    if (binding.device === "mouse") return this.mouseDown.has(binding.button);
    if (binding.device === "gamepad") return this.gpPrevButtons.get(binding.button) ?? false;
    return this.keys.has(binding.code);
  }

  consumeAction(action: BindableAction): boolean {
    if (this.consumeBinding(this.binds[action])) return true;
    const gp = this.gamepadBinds[action];
    if (gp && this.gamepadEnabled && this.consumeBinding(gp)) return true;
    return false;
  }

  isActionHeld(action: BindableAction): boolean {
    if (this.isBindingHeld(this.binds[action])) return true;
    const gp = this.gamepadBinds[action];
    if (gp && this.gamepadEnabled && this.isBindingHeld(gp)) return true;
    return false;
  }

  endFrame(): void {
    this.justPressed.clear();
    this.mouseJustPressed.clear();
    this.gpJustPressed.clear();
  }

  /** Clear stuck keys/buttons (call when starting a run so menu clicks don't leak). */
  reset(): void {
    this.keys.clear();
    this.justPressed.clear();
    this.mouseDown.clear();
    this.mouseJustPressed.clear();
    this.gpJustPressed.clear();
    this.gpPrevButtons.clear();
    this.gpStickX = 0;
    this.gpStickY = 0;
    this.gpAimX = 0;
    this.gpAimY = 0;
  }

  moveAxis(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.isActionHeld("moveLeft") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.isActionHeld("moveRight") || this.keys.has("ArrowRight")) x += 1;
    if (this.isActionHeld("moveUp") || this.keys.has("ArrowUp")) y -= 1;
    if (this.isActionHeld("moveDown") || this.keys.has("ArrowDown")) y += 1;
    // Left stick overrides / adds when active
    if (this.gamepadEnabled && (this.gpStickX !== 0 || this.gpStickY !== 0)) {
      x = this.gpStickX;
      y = this.gpStickY;
    }
    return { x, y };
  }
}
