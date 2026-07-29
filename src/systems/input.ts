import { loadSettings, type Binding, type CombatAction, type Keybinds } from "../ui/settings";

const UI_ROOT_SELECTORS =
  "#menus, #shop-panel, #overlay, #send-bar, #relic-draft, #pause-btn, #hud-abilities, #inv-panel, #lane-chrome";

function isUiTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(UI_ROOT_SELECTORS));
}

export class Input {
  readonly keys = new Set<string>();
  private readonly justPressed = new Set<string>();
  private readonly mouseDown = new Set<number>();
  private readonly mouseJustPressed = new Set<number>();
  private binds: Keybinds = loadSettings().keybinds;

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      if (e.repeat || isUiTarget(e.target)) return;
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
        if (isUiTarget(e.target)) return;
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
        if (!isUiTarget(e.target) && e.button === 1) e.preventDefault();
      },
      true,
    );
    target.addEventListener("contextmenu", (e) => {
      if (!isUiTarget(e.target)) e.preventDefault();
    });
    target.addEventListener("blur", () => {
      this.keys.clear();
      this.justPressed.clear();
      this.mouseDown.clear();
      this.mouseJustPressed.clear();
    });
  }

  reloadBinds(): void {
    this.binds = loadSettings().keybinds;
  }

  setBinds(binds: Keybinds): void {
    this.binds = binds;
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
    return this.consumePress(binding.code);
  }

  isBindingHeld(binding: Binding): boolean {
    if (binding.device === "mouse") return this.mouseDown.has(binding.button);
    return this.keys.has(binding.code);
  }

  consumeAction(action: CombatAction): boolean {
    return this.consumeBinding(this.binds[action]);
  }

  isActionHeld(action: CombatAction): boolean {
    return this.isBindingHeld(this.binds[action]);
  }

  endFrame(): void {
    this.justPressed.clear();
    this.mouseJustPressed.clear();
  }

  moveAxis(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y += 1;
    return { x, y };
  }
}
