/**
 * Workshop map editor — canvas place/drag/resize tools + library I/O.
 */

import { MAP_H, MAP_W } from "../data/constants";
import { MAP_LIST, mapRespawn, mapShops, type MapDef, type ShopPad } from "../data/maps";
import {
  defaultCustomMap,
  deleteCustomMap,
  listCustomMaps,
  saveCustomMap,
} from "../custom/registry";
import { exportCustomMap, importCustomMapFromFile } from "../custom/io";
import {
  applyShapeChange,
  countShapeAffectedObjects,
  resetLaneBoundsToShapeDefault,
} from "../custom/shapeEdit";
import { newCustomMapId, type CustomMapDef, type RectZone } from "../custom/types";
import {
  MAP_SHAPES,
  clampToPlayable,
  fillPlayablePath,
  isMapShapeId,
  playBounds,
  resolveMapShape,
  shapeLabel,
  strokePlayablePath,
  type MapShapeId,
} from "../game/playBounds";

export type MapEditorTool =
  | "select"
  | "erase"
  | "base"
  | "shop"
  | "respawn"
  | "spawner"
  | "spawnerAlt"
  | "obstacle"
  | "highGround"
  | "turret"
  | "heal"
  | "mire"
  | "haste"
  | "gold"
  | "wind"
  | "spike"
  | "bounce"
  | "portal"
  | "relay";

type SelKind =
  | { k: "base" }
  | { k: "shop"; i: number }
  | { k: "respawn" }
  | { k: "spawner" }
  | { k: "spawnerAlt" }
  | { k: "obstacle"; i: number }
  | { k: "highGround"; i: number }
  | { k: "turret"; i: number }
  | { k: "heal"; i: number }
  | { k: "mire"; i: number }
  | { k: "haste"; i: number }
  | { k: "gold"; i: number }
  | { k: "wind"; i: number }
  | { k: "spike"; i: number }
  | { k: "bounce"; i: number }
  | { k: "portal"; i: number }
  | { k: "relay"; i: number }
  | { k: "laneEdge"; edge: "top" | "bottom" | "left" | "right" };

type PendingConfirm = "reset" | "reset-lane" | "load-template" | "shape";

type DragMode =
  | { kind: "move"; ox: number; oy: number }
  | { kind: "resize"; handle: ResizeHandle; ox: number; oy: number; start: RectZone | { radius: number } }
  | { kind: "lane"; which: "top" | "bottom" | "left" | "right"; oy: number; ox: number };

type ResizeHandle = "nw" | "ne" | "sw" | "se" | "radius";

const SPECIAL_TOOLTIPS: Record<string, string> = {
  shiftingObstacles: "Between waves, obstacles reshuffle within the lane.",
  shrinkingLane: "During waves, lane edges slowly close in.",
  movingHazards: "A moving damage hazard drifts mid-lane during waves.",
  eclipseFog: "Periodic fog that dims vision across the lane.",
  dualSpawners: "Waves alternate between primary and alt spawner pads.",
  chestMagnet: "Boosts the chance for chests to spawn.",
  riftSurges: "Periodic horizontal rifts yank units toward lane mid-X during waves.",
  volatileOrbs: "Spawns delayed explosive orbs in the lane during waves.",
  emberRain: "Periodic ember rain AoE drops across the lane during waves.",
  supplyDrops: "Free gold supply crates drop during waves — walk over to collect.",
  chronoPulse: "Every few seconds: freeze creeps briefly and haste heroes.",
};

const TOOL_TOOLTIPS: Record<MapEditorTool, string> = {
  select: "Select and drag objects. Drag corners to resize zones. Drag playable edges to adjust bounds.",
  erase: "Click to delete placeable objects. Base, primary spawner, and respawn cannot be removed.",
  base: "Move the player base pad (required).",
  shop: "Place a shop pad (optional — 0 or many). Click existing shops with Delete to remove.",
  respawn: "Move the hero respawn pad (required — exactly one). All lane heroes respawn here.",
  spawner: "Move the primary wave spawner (required).",
  spawnerAlt: "Place or move the alternate spawner (enables Dual spawners).",
  obstacle: "Place a blocking obstacle rectangle.",
  highGround: "Place a high-ground damage zone. Resize with corner handles when selected.",
  turret: "Place an artifact turret slot marker.",
  heal: "Place a heal spring zone. Resize with corner handles when selected.",
  mire: "Place a slow mire zone. Resize with corner handles when selected.",
  haste: "Place a haste pad zone. Resize with corner handles when selected.",
  gold: "Place a gold vent zone. Resize with corner handles when selected.",
  wind: "Place a wind current zone. Resize with corner handles when selected.",
  spike: "Place a spike pulse (circular). Drag the edge handle to resize radius.",
  bounce: "Place a bounce pad — launches heroes with an impulse on contact.",
  portal: "Place a one-way portal (enter here, exit nearby). Drag to reposition.",
  relay: "Place a relay beacon — standing nearby grants temporary damage.",
};

const HANDLE = 10;
const LANE_HIT = 10;
const MIN_RECT = 24;
const MIN_SPIKE_R = 12;
const MAX_SPIKE_R = 120;

export class MapEditorPanel {
  draft: CustomMapDef = defaultCustomMap({ id: newCustomMapId() });
  tool: MapEditorTool = "select";
  selected: SelKind | null = null;
  private drag: DragMode | null = null;
  private pendingConfirm: PendingConfirm | null = null;
  /** `builtin:<id>` or `custom:<id>` awaiting confirm. */
  private pendingTemplateKey: string | null = null;
  private pendingShape: MapShapeId | null = null;
  status = "";

  load(id: string | null): void {
    this.pendingConfirm = null;
    this.pendingTemplateKey = null;
    if (!id) {
      this.draft = defaultCustomMap({ id: newCustomMapId() });
      this.selected = null;
      this.ensureDualSpawnerMarker();
      return;
    }
    const found = listCustomMaps().find((m) => m.id === id);
    this.draft = found ? structuredClone(found) : defaultCustomMap({ id: newCustomMapId() });
    this.selected = null;
    this.ensureDualSpawnerMarker();
  }

  libraryHtml(): string {
    const maps = listCustomMaps();
    if (!maps.length) return `<p class="muted">No custom maps yet.</p>`;
    return maps
      .map(
        (m) =>
          `<button type="button" class="menu-btn small ${m.id === this.draft.id ? "primary" : ""}" data-action="me-load" data-id="${m.id}">${escape(m.name)}</button>`,
      )
      .join("");
  }

  private templatePickerHtml(): string {
    const customs = listCustomMaps();
    const builtinOpts = MAP_LIST.map(
      (m) => `<option value="builtin:${escapeAttr(m.id)}">${escape(m.name)}</option>`,
    ).join("");
    const customOpts = customs.length
      ? customs
          .map((m) => `<option value="custom:${escapeAttr(m.id)}">${escape(m.name)}</option>`)
          .join("")
      : `<option value="" disabled>(none saved yet)</option>`;
    return `
      <label class="run-field"><span>Load template…</span>
        <select data-me-template>
          <option value="">Choose a map…</option>
          <optgroup label="Built-in">${builtinOpts}</optgroup>
          <optgroup label="Custom library">${customOpts}</optgroup>
        </select>
      </label>
      <button type="button" class="menu-btn tiny ghost" data-action="me-load-template">Load as new draft</button>
    `;
  }

  private specialFlagHtml(
    flag: keyof CustomMapDef["specials"],
    label: string,
    checked: boolean | undefined,
  ): string {
    const tip = SPECIAL_TOOLTIPS[flag] ?? "";
    return `<label class="chk" data-tip="${escapeAttr(tip)}"><input type="checkbox" data-me-flag="${flag}" ${checked ? "checked" : ""}/> ${label}</label>`;
  }

  render(): string {
    const s = this.draft.specials;
    const tools: { id: MapEditorTool; label: string }[] = [
      { id: "select", label: "Select" },
      { id: "erase", label: "Delete" },
      { id: "base", label: "Base" },
      { id: "respawn", label: "Respawn" },
      { id: "shop", label: "Shop" },
      { id: "spawner", label: "Spawner" },
      { id: "spawnerAlt", label: "Alt spawn" },
      { id: "obstacle", label: "Obstacle" },
      { id: "highGround", label: "High ground" },
      { id: "turret", label: "Turret slot" },
      { id: "heal", label: "Heal spring" },
      { id: "mire", label: "Slow mire" },
      { id: "haste", label: "Haste pad" },
      { id: "gold", label: "Gold vent" },
      { id: "wind", label: "Wind" },
      { id: "spike", label: "Spike" },
      { id: "bounce", label: "Bounce" },
      { id: "portal", label: "Portal" },
      { id: "relay", label: "Relay" },
    ];
    const shape = resolveMapShape(this.draft);
    const shapeOpts = MAP_SHAPES.map(
      (id) =>
        `<option value="${id}" ${shape === id ? "selected" : ""}>${shapeLabel(id)}</option>`,
    ).join("");
    return `
      <header class="menu-header compact">
        <button type="button" class="menu-back" data-action="goto" data-screen="main">← Back</button>
        <h1 class="menu-title">Map Editor</h1>
        <p class="menu-lead">Paint geometry &amp; specials · drag playable edges to resize · MP syncs at start.</p>
      </header>
      <div class="workshop-layout">
        <aside class="workshop-side">
          <label class="run-field"><span>Name</span>
            <input type="text" data-me="name" value="${escape(this.draft.name)}" />
          </label>
          <label class="run-field"><span>Blurb</span>
            <input type="text" data-me="blurb" value="${escape(this.draft.blurb)}" />
          </label>
          <label class="run-field"><span>Shape</span>
            <select data-me-shape>${shapeOpts}</select>
          </label>
          <button type="button" class="menu-btn tiny ghost me-reset-lane" data-action="me-reset-lane" data-tip="Playable bounds return to this shape's default size">Reset lane bounds</button>
          <h3 class="workshop-section-label">Specials</h3>
          <div class="me-specials-grid">
            ${this.specialFlagHtml("shiftingObstacles", "Shifting walls", s.shiftingObstacles)}
            ${this.specialFlagHtml("shrinkingLane", "Shrinking lane", s.shrinkingLane)}
            ${this.specialFlagHtml("movingHazards", "Moving hazards", s.movingHazards)}
            ${this.specialFlagHtml("eclipseFog", "Eclipse fog", s.eclipseFog)}
            ${this.specialFlagHtml("dualSpawners", "Dual spawners", s.dualSpawners)}
            ${this.specialFlagHtml("chestMagnet", "Chest magnet", s.chestMagnet)}
            ${this.specialFlagHtml("riftSurges", "Rift surges", s.riftSurges)}
            ${this.specialFlagHtml("volatileOrbs", "Volatile orbs", s.volatileOrbs)}
            ${this.specialFlagHtml("emberRain", "Ember rain", s.emberRain)}
            ${this.specialFlagHtml("supplyDrops", "Supply drops", s.supplyDrops)}
            ${this.specialFlagHtml("chronoPulse", "Chrono pulse", s.chronoPulse)}
          </div>
          <div class="workshop-actions">
            <div class="workshop-actions-row primary">
              <button type="button" class="menu-btn primary shine-btn" data-action="me-save"><span class="btn-label">Save</span></button>
              <button type="button" class="menu-btn shine-btn" data-action="me-new"><span class="btn-label">New</span></button>
            </div>
            <div class="workshop-actions-row io">
              <button type="button" class="menu-btn shine-btn" data-action="me-export"><span class="btn-label">Export JSON</span></button>
              <label class="menu-btn ghost file-btn shine-btn"><span class="btn-label">Import</span><input type="file" accept="application/json,.json" data-action="me-import" hidden /></label>
            </div>
            <div class="workshop-actions-row danger">
              <button type="button" class="menu-btn ghost" data-action="me-reset">Reset</button>
              <button type="button" class="menu-btn ghost danger" data-action="me-delete">Delete</button>
              <button type="button" class="menu-btn ghost danger" data-action="me-del-sel">Delete selected</button>
            </div>
          </div>
          <p class="panel-note workshop-status">${escape(this.status)}</p>
        </aside>
        <div class="workshop-main">
          <div class="workshop-toolbar">
            <h3 class="workshop-section-label">Tools</h3>
            ${tools
              .map(
                (t) =>
                  `<button type="button" class="menu-btn tiny ${this.tool === t.id ? "primary" : "ghost"}" data-action="me-tool" data-tool="${t.id}" data-tip="${escapeAttr(TOOL_TOOLTIPS[t.id])}">${t.label}</button>`,
              )
              .join("")}
          </div>
          <div class="workshop-canvas-wrap">
            <canvas id="map-editor-canvas" width="${MAP_W}" height="${MAP_H}"></canvas>
          </div>
        </div>
        <div class="workshop-footer-bar">
          <div class="workshop-footer-group">
            ${this.templatePickerHtml()}
          </div>
          <div class="workshop-lib horizontal">
            <h3>Library</h3>
            ${this.libraryHtml()}
          </div>
        </div>
      </div>
      ${this.confirmOverlayHtml()}
    `;
  }

  private confirmOverlayHtml(): string {
    if (!this.pendingConfirm) return "";
    const affected = countShapeAffectedObjects(this.draft);
    const copy =
      this.pendingConfirm === "reset"
        ? {
            title: "Reset map editor?",
            body: "All unsaved geometry, specials, and settings on this draft will be lost.",
            confirm: "Reset",
          }
        : this.pendingConfirm === "reset-lane"
          ? {
              title: "Reset lane bounds?",
              body: "Playable bounds return to this shape’s default size. Placed objects are clamped or removed if they no longer fit.",
              confirm: "Reset",
            }
          : this.pendingConfirm === "shape"
            ? {
                title: "Change map shape?",
                body: `Switching to ${shapeLabel(this.pendingShape ?? "rectangle")} resets playable bounds and may reposition required pads. Up to ${affected} placed object${affected === 1 ? "" : "s"} may be moved or removed.`,
                confirm: "Change shape",
              }
            : {
                title: "Load map as template?",
                body: "Your current draft will be replaced with a copy of the selected map. The new draft gets a fresh id — the original is unchanged.",
                confirm: "Load template",
              };
    return `
      <div class="menu-confirm-overlay" role="alertdialog" aria-modal="true" aria-labelledby="me-confirm-title" aria-describedby="me-confirm-body">
        <div class="menu-confirm-card">
          <h1 id="me-confirm-title">${copy.title}</h1>
          <p id="me-confirm-body">${copy.body}</p>
          <div class="menu-confirm-actions">
            <button type="button" data-action="me-confirm-yes">${copy.confirm}</button>
            <button type="button" data-action="me-confirm-no">Cancel</button>
          </div>
        </div>
      </div>
    `;
  }

  bind(root: HTMLElement): void {
    root.querySelectorAll<HTMLInputElement>("[data-me]").forEach((el) => {
      el.addEventListener("change", () => {
        const key = el.dataset.me!;
        if (key === "name" || key === "blurb") (this.draft as Record<string, unknown>)[key] = el.value;
        this.paintCanvas();
      });
    });
    root.querySelectorAll<HTMLInputElement>("[data-me-flag]").forEach((el) => {
      el.addEventListener("change", () => {
        const f = el.dataset.meFlag as keyof CustomMapDef["specials"];
        this.draft.specials[f] = el.checked;
        if (f === "dualSpawners") this.applyDualSpawnersFlag(el.checked);
        this.paintCanvas();
      });
    });
    const canvas = root.querySelector<HTMLCanvasElement>("#map-editor-canvas");
    if (canvas) this.wireCanvas(canvas);
    this.paintCanvas();
  }

  /**
   * Queue a shape change behind the standard confirm modal. Called from
   * MenuController.onChange so the confirm renders through the normal
   * full-shell render path (a bespoke overlay path here used to orphan the
   * modal outside the shell and softlock the editor).
   */
  requestShapeChange(next: string): void {
    const cur = resolveMapShape(this.draft);
    if (!isMapShapeId(next) || next === cur) return;
    this.pendingShape = next;
    this.pendingConfirm = "shape";
  }

  handleAction(action: string, el: HTMLElement): boolean {
    if (action === "me-tool") {
      this.tool = (el.dataset.tool as MapEditorTool) || "select";
      this.drag = null;
      return true;
    }
    if (action === "me-load") {
      this.load(el.dataset.id ?? null);
      this.status = "Loaded.";
      return true;
    }
    if (action === "me-new") {
      this.load(null);
      this.status = "New map draft.";
      return true;
    }
    if (action === "me-load-template") {
      const select = document.querySelector<HTMLSelectElement>("[data-me-template]");
      const key = select?.value?.trim() ?? "";
      if (!key) {
        this.status = "Pick a map to load as template.";
        return true;
      }
      this.pendingTemplateKey = key;
      this.pendingConfirm = "load-template";
      return true;
    }
    if (action === "me-reset") {
      this.pendingConfirm = "reset";
      return true;
    }
    if (action === "me-reset-lane") {
      this.pendingConfirm = "reset-lane";
      return true;
    }
    if (action === "me-confirm-no") {
      this.pendingConfirm = null;
      this.pendingTemplateKey = null;
      this.pendingShape = null;
      return true;
    }
    if (action === "me-confirm-yes") {
      const kind = this.pendingConfirm;
      const templateKey = this.pendingTemplateKey;
      const shape = this.pendingShape;
      this.pendingConfirm = null;
      this.pendingTemplateKey = null;
      this.pendingShape = null;
      if (kind === "reset") {
        const id = this.draft.id || newCustomMapId();
        this.draft = defaultCustomMap({ id });
        this.selected = null;
        this.tool = "select";
        this.status = "Reset to defaults.";
      } else if (kind === "reset-lane") {
        resetLaneBoundsToShapeDefault(this.draft);
        clampAllObjectsInLane(this.draft);
        this.status = "Lane bounds reset.";
      } else if (kind === "shape" && shape) {
        const removed = applyShapeChange(this.draft, shape);
        clampAllObjectsInLane(this.draft);
        this.selected = null;
        this.status =
          removed > 0
            ? `Shape → ${shapeLabel(shape)}. Removed ${removed} object${removed === 1 ? "" : "s"} that no longer fit.`
            : `Shape → ${shapeLabel(shape)}.`;
      } else if (kind === "load-template") {
        this.applyTemplate(templateKey);
      }
      return true;
    }
    if (action === "me-save") {
      if (!this.draft.id) this.draft.id = newCustomMapId();
      const err = validateMap(this.draft);
      if (err) {
        this.status = err;
        return true;
      }
      saveCustomMap(this.draft);
      this.status = "Saved to library.";
      return true;
    }
    if (action === "me-export") {
      exportCustomMap(this.draft);
      this.status = "Exported.";
      return true;
    }
    if (action === "me-delete") {
      if (this.draft.id) deleteCustomMap(this.draft.id);
      this.load(null);
      this.status = "Deleted.";
      return true;
    }
    if (action === "me-del-sel") {
      if (!this.deleteSelection(this.selected)) {
        this.status = this.selected
          ? "Cannot delete required objects (base / primary spawner / respawn)."
          : "Nothing selected.";
      } else {
        this.status = "Removed selection.";
      }
      return true;
    }
    return false;
  }

  async handleImport(file: File): Promise<string> {
    const err = await importCustomMapFromFile(file);
    if (err) return err;
    const maps = listCustomMaps();
    const last = maps[maps.length - 1];
    if (last) this.load(last.id);
    this.status = "Imported.";
    return "";
  }

  /** Returns false when selection is missing or protected. */
  private deleteSelection(s: SelKind | null): boolean {
    if (!s) return false;
    if (s.k === "base" || s.k === "spawner" || s.k === "respawn" || s.k === "laneEdge") {
      return false;
    }
    if (s.k === "shop") this.draft.shops.splice(s.i, 1);
    else if (s.k === "obstacle") this.draft.obstacles.splice(s.i, 1);
    else if (s.k === "highGround") this.draft.highGrounds.splice(s.i, 1);
    else if (s.k === "turret") this.draft.turretSlots.splice(s.i, 1);
    else if (s.k === "heal") this.draft.healSprings!.splice(s.i, 1);
    else if (s.k === "mire") this.draft.slowMires!.splice(s.i, 1);
    else if (s.k === "haste") this.draft.hastePads!.splice(s.i, 1);
    else if (s.k === "gold") this.draft.goldVents!.splice(s.i, 1);
    else if (s.k === "wind") this.draft.windCurrents!.splice(s.i, 1);
    else if (s.k === "spike") this.draft.spikePulses!.splice(s.i, 1);
    else if (s.k === "bounce") this.draft.bouncePads!.splice(s.i, 1);
    else if (s.k === "portal") this.draft.mapPortals!.splice(s.i, 1);
    else if (s.k === "relay") this.draft.relayBeacons!.splice(s.i, 1);
    else if (s.k === "spawnerAlt") {
      this.draft.spawnerAlt = undefined;
      this.draft.specials.dualSpawners = false;
    } else {
      return false;
    }
    this.selected = null;
    this.paintCanvas();
    return true;
  }

  /** Keep `spawnerAlt` marker in sync with the Dual spawners special. */
  private applyDualSpawnersFlag(enabled: boolean): void {
    if (enabled) {
      if (!this.draft.spawnerAlt) {
        this.draft.spawnerAlt = defaultSpawnerAlt(this.draft);
      }
      return;
    }
    if (this.selected?.k === "spawnerAlt") this.selected = null;
    this.draft.spawnerAlt = undefined;
  }

  /** Repair drafts that have the flag but no alt pad (e.g. older saves). */
  private ensureDualSpawnerMarker(): void {
    if (!this.draft.shops) this.draft.shops = [];
    if (!this.draft.respawn) {
      this.draft.respawn = {
        x: this.draft.base.x + 120,
        y: this.draft.base.y,
        radius: 28,
      };
    }
    if (this.draft.specials.dualSpawners && !this.draft.spawnerAlt) {
      this.draft.spawnerAlt = defaultSpawnerAlt(this.draft);
    }
  }

  /** Copy a built-in or library map into the editor as a brand-new draft id. */
  private applyTemplate(key: string | null): void {
    if (!key) {
      this.status = "No template selected.";
      return;
    }
    const colon = key.indexOf(":");
    const kind = colon >= 0 ? key.slice(0, colon) : "";
    const id = colon >= 0 ? key.slice(colon + 1) : "";
    let draft: CustomMapDef | null = null;
    if (kind === "builtin" && id) {
      const m = MAP_LIST.find((x) => x.id === id);
      if (m) draft = mapDefToCustomDraft(m);
    } else if (kind === "custom" && id) {
      const found = listCustomMaps().find((m) => m.id === id);
      if (found) {
        draft = structuredClone(found);
        draft.id = newCustomMapId();
        if (!/\(copy\)$/i.test(draft.name)) draft.name = `${draft.name} (copy)`;
      }
    }
    if (!draft) {
      this.status = "Template not found.";
      return;
    }
    this.draft = draft;
    this.selected = null;
    this.tool = "select";
    this.ensureDualSpawnerMarker();
    this.status = `Loaded “${draft.name}” as a new draft.`;
  }

  private wireCanvas(canvas: HTMLCanvasElement): void {
    const toWorld = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * MAP_W;
      const y = ((ev.clientY - rect.top) / rect.height) * MAP_H;
      return { x, y };
    };

    const setCursor = (ev: MouseEvent) => {
      if (this.tool === "erase") {
        canvas.style.cursor = "pointer";
        return;
      }
      if (this.tool !== "select") {
        canvas.style.cursor = "crosshair";
        return;
      }
      const p = toWorld(ev);
      const handle = this.selected ? hitResizeHandle(this.draft, this.selected, p.x, p.y) : null;
      if (handle) {
        canvas.style.cursor = handle === "radius" ? "nwse-resize" : `${handle}-resize`;
        return;
      }
      const lane = hitLaneEdge(this.draft, p.x, p.y);
      if (lane === "top" || lane === "bottom") {
        canvas.style.cursor = "ns-resize";
        return;
      }
      if (lane === "left" || lane === "right") {
        canvas.style.cursor = "ew-resize";
        return;
      }
      canvas.style.cursor = hitTest(this.draft, p.x, p.y) ? "move" : "default";
    };

    canvas.addEventListener("mousedown", (ev) => {
      const p = toWorld(ev);
      if (this.tool === "erase") {
        const hit = hitTest(this.draft, p.x, p.y);
        if (!hit) {
          this.status = "Nothing under cursor.";
          this.paintCanvas();
          return;
        }
        this.selected = hit;
        if (!this.deleteSelection(hit)) {
          this.status = "Cannot delete required objects (base / primary spawner / respawn).";
          this.paintCanvas();
        } else {
          this.status = "Deleted.";
        }
        return;
      }
      if (this.tool === "select") {
        const handle = this.selected ? hitResizeHandle(this.draft, this.selected, p.x, p.y) : null;
        if (handle && this.selected) {
          const start = snapshotResize(this.draft, this.selected);
          if (start) {
            this.drag = { kind: "resize", handle, ox: p.x, oy: p.y, start };
            this.paintCanvas();
            return;
          }
        }
        const lane = hitLaneEdge(this.draft, p.x, p.y);
        if (lane) {
          this.selected = { k: "laneEdge", edge: lane };
          this.drag = { kind: "lane", which: lane, oy: p.y, ox: p.x };
          this.paintCanvas();
          return;
        }
        this.selected = hitTest(this.draft, p.x, p.y);
        if (this.selected) this.drag = { kind: "move", ox: p.x, oy: p.y };
        this.paintCanvas();
        return;
      }
      this.placeAt(p.x, p.y);
      this.paintCanvas();
    });
    canvas.addEventListener("mousemove", (ev) => {
      setCursor(ev);
      if (!this.drag) return;
      const p = toWorld(ev);
      if (this.drag.kind === "move" && this.selected) {
        const dx = p.x - this.drag.ox;
        const dy = p.y - this.drag.oy;
        this.drag.ox = p.x;
        this.drag.oy = p.y;
        moveSelection(this.draft, this.selected, dx, dy);
        this.paintCanvas();
        return;
      }
      if (this.drag.kind === "resize" && this.selected) {
        applyResize(this.draft, this.selected, this.drag.handle, this.drag.start, p.x, p.y);
        this.paintCanvas();
        return;
      }
      if (this.drag.kind === "lane") {
        const minGap = 60;
        const left = this.draft.laneLeft ?? 0;
        const right = this.draft.laneRight ?? MAP_W;
        if (this.drag.which === "top") {
          this.draft.laneTop = Math.max(0, Math.min(p.y, this.draft.laneBottom - minGap));
        } else if (this.drag.which === "bottom") {
          this.draft.laneBottom = Math.min(MAP_H, Math.max(p.y, this.draft.laneTop + minGap));
        } else if (this.drag.which === "left") {
          this.draft.laneLeft = Math.max(0, Math.min(p.x, right - minGap));
        } else {
          this.draft.laneRight = Math.min(MAP_W, Math.max(p.x, left + minGap));
        }
        clampAllObjectsInLane(this.draft);
        this.paintCanvas();
      }
    });
    canvas.addEventListener("mouseup", () => {
      this.drag = null;
    });
    canvas.addEventListener("mouseleave", () => {
      this.drag = null;
      canvas.style.cursor = "default";
    });
  }

  private placeAt(x: number, y: number): void {
    const c = clampPointInLane(this.draft, x, y, 0);
    x = c.x;
    y = c.y;
    const rect = (): RectZone => {
      const r: RectZone = { x: x - 40, y: y - 30, w: 80, h: 60 };
      clampRectInLane(this.draft, r);
      return r;
    };
    switch (this.tool) {
      case "base": {
        const p = clampPointInLane(this.draft, x, y, this.draft.base.radius || 40);
        this.draft.base.x = p.x;
        this.draft.base.y = p.y;
        break;
      }
      case "respawn": {
        const p = clampPointInLane(this.draft, x, y, this.draft.respawn.radius || 28);
        this.draft.respawn.x = p.x;
        this.draft.respawn.y = p.y;
        this.status = "Respawn pad moved.";
        break;
      }
      case "shop": {
        const p = clampPointInLane(this.draft, x, y, 36);
        const pad: ShopPad = { x: p.x, y: p.y, radius: 36, interactRange: 56 };
        this.draft.shops.push(pad);
        this.selected = { k: "shop", i: this.draft.shops.length - 1 };
        this.status = `Shop placed (${this.draft.shops.length}).`;
        break;
      }
      case "spawner": {
        const p = clampPointInLane(this.draft, x, y, this.draft.spawner.radius || 28);
        this.draft.spawner.x = p.x;
        this.draft.spawner.y = p.y;
        break;
      }
      case "spawnerAlt": {
        const p = clampPointInLane(this.draft, x, y, this.draft.spawner.radius || 28);
        this.draft.spawnerAlt = { x: p.x, y: p.y, radius: this.draft.spawner.radius || 28 };
        this.draft.specials.dualSpawners = true;
        break;
      }
      case "obstacle": {
        const r: RectZone = { x: x - 24, y: y - 30, w: 48, h: 60 };
        clampRectInLane(this.draft, r);
        this.draft.obstacles.push(r);
        break;
      }
      case "highGround": {
        const r: RectZone & { damageBonus: number; oathDamageBonus: number } = {
          x: x - 80,
          y: y - 50,
          w: 160,
          h: 100,
          damageBonus: 0.35,
          oathDamageBonus: 0.65,
        };
        clampRectInLane(this.draft, r);
        this.draft.highGrounds.push(r);
        break;
      }
      case "turret": {
        const p = clampPointInLane(this.draft, x, y, 12);
        this.draft.turretSlots.push({ x: p.x, y: p.y });
        break;
      }
      case "heal":
        (this.draft.healSprings ??= []).push(rect());
        break;
      case "mire":
        (this.draft.slowMires ??= []).push(rect());
        break;
      case "haste":
        (this.draft.hastePads ??= []).push(rect());
        break;
      case "gold":
        (this.draft.goldVents ??= []).push(rect());
        break;
      case "wind":
        (this.draft.windCurrents ??= []).push({ ...rect(), vx: 40, vy: 0 });
        break;
      case "spike": {
        const p = clampPointInLane(this.draft, x, y, 36);
        (this.draft.spikePulses ??= []).push({ x: p.x, y: p.y, radius: 36, damage: 22 });
        clampSpikeInLane(this.draft, this.draft.spikePulses[this.draft.spikePulses.length - 1]!);
        break;
      }
      case "bounce":
        (this.draft.bouncePads ??= []).push({ ...rect(), impulseX: 200, impulseY: 0 });
        break;
      case "portal": {
        const p = clampPointInLane(this.draft, x, y, 28);
        const exit = clampPointInLane(this.draft, p.x + 160, p.y + 40, 12);
        (this.draft.mapPortals ??= []).push({
          x: p.x,
          y: p.y,
          radius: 28,
          exitX: exit.x,
          exitY: exit.y,
        });
        break;
      }
      case "relay": {
        const p = clampPointInLane(this.draft, x, y, 40);
        (this.draft.relayBeacons ??= []).push({ x: p.x, y: p.y, radius: 42, damageBonus: 0.15 });
        break;
      }
      default:
        break;
    }
  }

  paintCanvas(): void {
    const canvas = document.querySelector<HTMLCanvasElement>("#map-editor-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const m = this.draft;
    ctx.clearRect(0, 0, MAP_W, MAP_H);
    ctx.fillStyle = "#0e1624";
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    ctx.fillStyle = "#152033";
    fillPlayablePath(ctx, m);
    ctx.strokeStyle = "#2a3d60";
    ctx.lineWidth = 2;
    strokePlayablePath(ctx, m);
    ctx.stroke();
    // AABB edge affordances for resizing playable portion
    if (this.tool === "select" || this.selected?.k === "laneEdge") {
      const b = playBounds(m);
      const edge = this.selected?.k === "laneEdge" ? this.selected.edge : null;
      const strokeEdge = (which: "top" | "bottom" | "left" | "right", x1: number, y1: number, x2: number, y2: number) => {
        ctx.strokeStyle = edge === which ? "#5ef0c8" : "#3a5a80";
        ctx.lineWidth = edge === which ? 3 : 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      };
      strokeEdge("top", b.left, b.top, b.right, b.top);
      strokeEdge("bottom", b.left, b.bottom, b.right, b.bottom);
      strokeEdge("left", b.left, b.top, b.left, b.bottom);
      strokeEdge("right", b.right, b.top, b.right, b.bottom);
    }

    const fillR = (list: RectZone[] | undefined, fill: string, label: string) => {
      for (const z of list ?? []) {
        ctx.fillStyle = fill;
        ctx.fillRect(z.x, z.y, z.w, z.h);
        ctx.fillStyle = "#fff8";
        ctx.font = "11px Segoe UI";
        ctx.textAlign = "left";
        ctx.fillText(label, z.x + 4, z.y + 14);
      }
    };
    fillR(m.healSprings, "#40e08044", "HEAL");
    fillR(m.slowMires, "#8060c044", "MIRE");
    fillR(m.hastePads, "#e0c04044", "HASTE");
    fillR(m.goldVents, "#e0c02044", "GOLD");
    fillR(m.windCurrents, "#60c0e044", "WIND");
    fillR(m.bouncePads, "#80e0ff44", "BOUNCE");
    for (const p of m.mapPortals ?? []) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#c080ff55";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.exitX, p.exitY);
      ctx.strokeStyle = "#c080ff88";
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const r of m.relayBeacons ?? []) {
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#f0c06044";
      ctx.fill();
      ctx.fillStyle = "#fff8";
      ctx.font = "11px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText("RELAY", r.x, r.y + 4);
    }
    for (const hg of m.highGrounds) {
      ctx.fillStyle = "#3d5a8844";
      ctx.strokeStyle = "#7eb0ff";
      ctx.lineWidth = 1;
      ctx.fillRect(hg.x, hg.y, hg.w, hg.h);
      ctx.strokeRect(hg.x, hg.y, hg.w, hg.h);
    }
    for (const o of m.obstacles) {
      ctx.fillStyle = "#1c2838";
      ctx.strokeStyle = "#4a6078";
      ctx.lineWidth = 1;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeRect(o.x, o.y, o.w, o.h);
    }
    for (const sp of m.spikePulses ?? []) {
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#ff505044";
      ctx.fill();
    }
    for (const t of m.turretSlots) {
      ctx.fillStyle = "#88a";
      ctx.beginPath();
      ctx.arc(t.x, t.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    const pad = (p: { x: number; y: number; radius: number }, color: string, label: string) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(label, p.x, p.y + 4);
    };
    pad(m.base, "#3a8f5a88", "BASE");
    pad(m.respawn, "#5ef0c888", "RESPAWN");
    for (const shop of m.shops ?? []) pad(shop, "#5a6a9a88", "SHOP");
    pad(m.spawner, "#9a4a4a88", "SPAWN");
    if (m.spawnerAlt) pad(m.spawnerAlt, "#9a6a4a88", "ALT");

    drawSelectionOverlay(ctx, m, this.selected);
  }
}

function validateMap(m: CustomMapDef): string | null {
  if (!m.name.trim()) return "Name required";
  if (m.laneTop >= m.laneBottom - 40) return "Lane bounds invalid";
  if (!m.base || !m.spawner) return "Base and primary spawner required";
  if (!m.respawn) return "Respawn point required";
  if (m.specials.dualSpawners && !m.spawnerAlt) return "Dual spawners needs an alt spawner";
  return null;
}

/** Built-in MapDef → editable CustomMapDef with a fresh custom id. */
function mapDefToCustomDraft(m: MapDef): CustomMapDef {
  return {
    id: newCustomMapId(),
    name: `${m.name} (copy)`,
    blurb: m.blurb,
    shape: m.shape ?? "rectangle",
    laneTop: m.laneTop,
    laneBottom: m.laneBottom,
    laneLeft: m.laneLeft ?? 0,
    laneRight: m.laneRight ?? MAP_W,
    base: structuredClone(m.base),
    shops: structuredClone(mapShops(m)),
    respawn: structuredClone(mapRespawn(m)),
    spawner: structuredClone(m.spawner),
    spawnerAlt: m.spawnerAlt ? structuredClone(m.spawnerAlt) : undefined,
    highGrounds: structuredClone(m.highGrounds ?? []),
    obstacles: structuredClone(m.obstacles ?? []),
    turretSlots: structuredClone(m.turretSlots ?? []),
    specials: {
      shiftingObstacles: !!m.shiftingObstacles,
      shrinkingLane: !!m.shrinkingLane,
      movingHazards: !!m.movingHazards,
      eclipseFog: !!m.eclipseFog,
      dualSpawners: !!m.dualSpawners,
      chestMagnet: !!m.chestMagnet,
      riftSurges: !!m.riftSurges,
      volatileOrbs: !!m.volatileOrbs,
      emberRain: !!m.emberRain,
      supplyDrops: !!m.supplyDrops,
      chronoPulse: !!m.chronoPulse,
    },
    healSprings: structuredClone(m.healSprings ?? []),
    slowMires: structuredClone(m.slowMires ?? []),
    hastePads: structuredClone(m.hastePads ?? []),
    goldVents: structuredClone(m.goldVents ?? []),
    windCurrents: structuredClone(m.windCurrents ?? []),
    spikePulses: structuredClone(m.spikePulses ?? []),
    bouncePads: structuredClone(m.bouncePads ?? []),
    mapPortals: structuredClone(m.mapPortals ?? []),
    relayBeacons: structuredClone(m.relayBeacons ?? []),
  };
}

/** Keep placeables inset a few pixels inside the playable AABB. */
const LANE_INSET = 8;

function laneInnerBounds(m: CustomMapDef): { minX: number; maxX: number; minY: number; maxY: number } {
  const b = playBounds(m);
  return {
    minX: b.left + LANE_INSET,
    maxX: b.right - LANE_INSET,
    minY: b.top + LANE_INSET,
    maxY: b.bottom - LANE_INSET,
  };
}

function clampPointInLane(
  m: CustomMapDef,
  x: number,
  y: number,
  radius = 0,
): { x: number; y: number } {
  return clampToPlayable(m, x, y, radius);
}

function clampRectInLane(m: CustomMapDef, r: RectZone): void {
  const b = laneInnerBounds(m);
  const maxW = Math.max(MIN_RECT, b.maxX - b.minX);
  const maxH = Math.max(MIN_RECT, b.maxY - b.minY);
  r.w = Math.min(Math.max(MIN_RECT, r.w), maxW);
  r.h = Math.min(Math.max(MIN_RECT, r.h), maxH);
  r.x = Math.max(b.minX, Math.min(b.maxX - r.w, r.x));
  r.y = Math.max(b.minY, Math.min(b.maxY - r.h, r.y));
  const c = clampToPlayable(m, r.x + r.w / 2, r.y + r.h / 2, 0);
  r.x = c.x - r.w / 2;
  r.y = c.y - r.h / 2;
}

function clampSpikeInLane(m: CustomMapDef, s: { x: number; y: number; radius: number }): void {
  const b = laneInnerBounds(m);
  const maxR = Math.max(
    MIN_SPIKE_R,
    Math.min(s.x - b.minX, b.maxX - s.x, s.y - b.minY, b.maxY - s.y, MAX_SPIKE_R),
  );
  s.radius = Math.max(MIN_SPIKE_R, Math.min(s.radius, maxR));
  const p = clampPointInLane(m, s.x, s.y, s.radius);
  s.x = p.x;
  s.y = p.y;
}

function clampPadInLane(m: CustomMapDef, p: { x: number; y: number; radius?: number }, fallbackR: number): void {
  const c = clampPointInLane(m, p.x, p.y, p.radius ?? fallbackR);
  p.x = c.x;
  p.y = c.y;
}

function clampAllObjectsInLane(m: CustomMapDef): void {
  clampPadInLane(m, m.base, 40);
  clampPadInLane(m, m.respawn, 28);
  clampPadInLane(m, m.spawner, 28);
  if (m.spawnerAlt) clampPadInLane(m, m.spawnerAlt, 28);
  for (const s of m.shops ?? []) clampPadInLane(m, s, s.radius || 36);
  for (const t of m.turretSlots) {
    const c = clampPointInLane(m, t.x, t.y, 12);
    t.x = c.x;
    t.y = c.y;
  }
  for (const r of m.obstacles) clampRectInLane(m, r);
  for (const r of m.highGrounds) clampRectInLane(m, r);
  for (const r of m.healSprings ?? []) clampRectInLane(m, r);
  for (const r of m.slowMires ?? []) clampRectInLane(m, r);
  for (const r of m.hastePads ?? []) clampRectInLane(m, r);
  for (const r of m.goldVents ?? []) clampRectInLane(m, r);
  for (const r of m.windCurrents ?? []) clampRectInLane(m, r);
  for (const r of m.bouncePads ?? []) clampRectInLane(m, r);
  for (const s of m.spikePulses ?? []) clampSpikeInLane(m, s);
  for (const p of m.mapPortals ?? []) {
    const a = clampPointInLane(m, p.x, p.y, p.radius);
    p.x = a.x;
    p.y = a.y;
    const e = clampPointInLane(m, p.exitX, p.exitY, 8);
    p.exitX = e.x;
    p.exitY = e.y;
  }
  for (const r of m.relayBeacons ?? []) {
    const c = clampPointInLane(m, r.x, r.y, r.radius);
    r.x = c.x;
    r.y = c.y;
  }
}

/** Second spawner default: same X as primary, offset below (or above if clamped). */
function defaultSpawnerAlt(m: CustomMapDef): { x: number; y: number; radius: number } {
  const radius = m.spawner.radius || 28;
  const yOff = 80;
  let y = m.spawner.y + yOff;
  const c = clampPointInLane(m, m.spawner.x, y, radius);
  if (Math.abs(c.y - m.spawner.y) < 10) {
    return { ...clampPointInLane(m, m.spawner.x, m.spawner.y - yOff, radius), radius };
  }
  return { x: c.x, y: c.y, radius };
}

function hitLaneEdge(
  m: CustomMapDef,
  x: number,
  y: number,
): "top" | "bottom" | "left" | "right" | null {
  const b = playBounds(m);
  if (Math.abs(y - b.top) <= LANE_HIT && x >= b.left - LANE_HIT && x <= b.right + LANE_HIT) {
    return "top";
  }
  if (Math.abs(y - b.bottom) <= LANE_HIT && x >= b.left - LANE_HIT && x <= b.right + LANE_HIT) {
    return "bottom";
  }
  if (Math.abs(x - b.left) <= LANE_HIT && y >= b.top - LANE_HIT && y <= b.bottom + LANE_HIT) {
    return "left";
  }
  if (Math.abs(x - b.right) <= LANE_HIT && y >= b.top - LANE_HIT && y <= b.bottom + LANE_HIT) {
    return "right";
  }
  return null;
}

function getSelectedRect(m: CustomMapDef, sel: SelKind): RectZone | null {
  switch (sel.k) {
    case "obstacle":
      return m.obstacles[sel.i] ?? null;
    case "highGround":
      return m.highGrounds[sel.i] ?? null;
    case "heal":
      return m.healSprings?.[sel.i] ?? null;
    case "mire":
      return m.slowMires?.[sel.i] ?? null;
    case "haste":
      return m.hastePads?.[sel.i] ?? null;
    case "gold":
      return m.goldVents?.[sel.i] ?? null;
    case "wind":
      return m.windCurrents?.[sel.i] ?? null;
    case "bounce":
      return m.bouncePads?.[sel.i] ?? null;
    default:
      return null;
  }
}

function getSelectedSpike(m: CustomMapDef, sel: SelKind): { x: number; y: number; radius: number } | null {
  if (sel.k !== "spike") return null;
  return m.spikePulses?.[sel.i] ?? null;
}

function hitResizeHandle(
  m: CustomMapDef,
  sel: SelKind,
  x: number,
  y: number,
): ResizeHandle | null {
  const spike = getSelectedSpike(m, sel);
  if (spike) {
    const dx = x - spike.x;
    const dy = y - spike.y;
    const dist = Math.hypot(dx, dy);
    if (Math.abs(dist - spike.radius) <= HANDLE + 4) return "radius";
    return null;
  }
  const r = getSelectedRect(m, sel);
  if (!r) return null;
  const corners: { h: ResizeHandle; cx: number; cy: number }[] = [
    { h: "nw", cx: r.x, cy: r.y },
    { h: "ne", cx: r.x + r.w, cy: r.y },
    { h: "sw", cx: r.x, cy: r.y + r.h },
    { h: "se", cx: r.x + r.w, cy: r.y + r.h },
  ];
  for (const c of corners) {
    if (Math.abs(x - c.cx) <= HANDLE && Math.abs(y - c.cy) <= HANDLE) return c.h;
  }
  return null;
}

function snapshotResize(
  m: CustomMapDef,
  sel: SelKind,
): RectZone | { radius: number } | null {
  const spike = getSelectedSpike(m, sel);
  if (spike) return { radius: spike.radius };
  const r = getSelectedRect(m, sel);
  if (!r) return null;
  return { x: r.x, y: r.y, w: r.w, h: r.h };
}

function applyResize(
  m: CustomMapDef,
  sel: SelKind,
  handle: ResizeHandle,
  start: RectZone | { radius: number },
  x: number,
  y: number,
): void {
  if (handle === "radius") {
    const spike = getSelectedSpike(m, sel);
    if (!spike || !("radius" in start)) return;
    spike.radius = Math.max(MIN_SPIKE_R, Math.min(MAX_SPIKE_R, Math.hypot(x - spike.x, y - spike.y)));
    clampSpikeInLane(m, spike);
    return;
  }
  const r = getSelectedRect(m, sel);
  if (!r || !("w" in start)) return;
  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;
  if (handle === "nw" || handle === "sw") left = x;
  if (handle === "ne" || handle === "se") right = x;
  if (handle === "nw" || handle === "ne") top = y;
  if (handle === "sw" || handle === "se") bottom = y;
  if (right - left < MIN_RECT) {
    if (handle === "nw" || handle === "sw") left = right - MIN_RECT;
    else right = left + MIN_RECT;
  }
  if (bottom - top < MIN_RECT) {
    if (handle === "nw" || handle === "ne") top = bottom - MIN_RECT;
    else bottom = top + MIN_RECT;
  }
  r.x = left;
  r.y = top;
  r.w = right - left;
  r.h = bottom - top;
  clampRectInLane(m, r);
}

function drawSelectionOverlay(
  ctx: CanvasRenderingContext2D,
  m: CustomMapDef,
  sel: SelKind | null,
): void {
  if (!sel) return;
  const drawHandle = (cx: number, cy: number) => {
    ctx.fillStyle = "#5ef0c8";
    ctx.strokeStyle = "#0a101a";
    ctx.lineWidth = 1;
    ctx.fillRect(cx - HANDLE / 2, cy - HANDLE / 2, HANDLE, HANDLE);
    ctx.strokeRect(cx - HANDLE / 2, cy - HANDLE / 2, HANDLE, HANDLE);
  };
  const spike = getSelectedSpike(m, sel);
  if (spike) {
    ctx.strokeStyle = "#5ef0c8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(spike.x, spike.y, spike.radius, 0, Math.PI * 2);
    ctx.stroke();
    drawHandle(spike.x + spike.radius, spike.y);
    return;
  }
  const r = getSelectedRect(m, sel);
  if (r) {
    ctx.strokeStyle = "#5ef0c8";
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    drawHandle(r.x, r.y);
    drawHandle(r.x + r.w, r.y);
    drawHandle(r.x, r.y + r.h);
    drawHandle(r.x + r.w, r.y + r.h);
  }
}

function hitTest(m: CustomMapDef, x: number, y: number): SelKind | null {
  const inC = (p: { x: number; y: number; radius: number }) =>
    (x - p.x) ** 2 + (y - p.y) ** 2 <= p.radius ** 2;
  const inR = (r: RectZone, i: number, k: SelKind["k"]): SelKind | null =>
    x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h ? ({ k, i } as SelKind) : null;
  if (inC(m.base)) return { k: "base" };
  if (inC(m.respawn)) return { k: "respawn" };
  for (let i = (m.shops ?? []).length - 1; i >= 0; i--) {
    if (inC(m.shops[i]!)) return { k: "shop", i };
  }
  if (inC(m.spawner)) return { k: "spawner" };
  if (m.spawnerAlt && inC(m.spawnerAlt)) return { k: "spawnerAlt" };
  for (let i = m.obstacles.length - 1; i >= 0; i--) {
    const o = m.obstacles[i]!;
    if (x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h) return { k: "obstacle", i };
  }
  for (let i = m.highGrounds.length - 1; i >= 0; i--) {
    const h = m.highGrounds[i]!;
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return { k: "highGround", i };
  }
  for (const [list, k] of [
    [m.healSprings, "heal"],
    [m.slowMires, "mire"],
    [m.hastePads, "haste"],
    [m.goldVents, "gold"],
    [m.windCurrents, "wind"],
    [m.bouncePads, "bounce"],
  ] as const) {
    const arr = list ?? [];
    for (let i = arr.length - 1; i >= 0; i--) {
      const hit = inR(arr[i]!, i, k as SelKind["k"]);
      if (hit) return hit;
    }
  }
  for (let i = (m.spikePulses ?? []).length - 1; i >= 0; i--) {
    const s = m.spikePulses![i]!;
    if ((x - s.x) ** 2 + (y - s.y) ** 2 <= s.radius ** 2) return { k: "spike", i };
  }
  for (let i = (m.mapPortals ?? []).length - 1; i >= 0; i--) {
    const p = m.mapPortals![i]!;
    if ((x - p.x) ** 2 + (y - p.y) ** 2 <= p.radius ** 2) return { k: "portal", i };
  }
  for (let i = (m.relayBeacons ?? []).length - 1; i >= 0; i--) {
    const p = m.relayBeacons![i]!;
    if ((x - p.x) ** 2 + (y - p.y) ** 2 <= p.radius ** 2) return { k: "relay", i };
  }
  for (let i = m.turretSlots.length - 1; i >= 0; i--) {
    const t = m.turretSlots[i]!;
    if ((x - t.x) ** 2 + (y - t.y) ** 2 <= 12 ** 2) return { k: "turret", i };
  }
  return null;
}

function moveSelection(m: CustomMapDef, sel: SelKind, dx: number, dy: number): void {
  if (sel.k === "laneEdge") return;
  const movePad = (p: { x: number; y: number }, radius: number) => {
    p.x += dx;
    p.y += dy;
    const c = clampPointInLane(m, p.x, p.y, radius);
    p.x = c.x;
    p.y = c.y;
  };
  const moveR = (r: RectZone) => {
    r.x += dx;
    r.y += dy;
    clampRectInLane(m, r);
  };
  switch (sel.k) {
    case "base":
      movePad(m.base, m.base.radius || 40);
      break;
    case "respawn":
      movePad(m.respawn, m.respawn.radius || 28);
      break;
    case "shop":
      movePad(m.shops[sel.i]!, m.shops[sel.i]!.radius || 36);
      break;
    case "spawner":
      movePad(m.spawner, m.spawner.radius || 28);
      break;
    case "spawnerAlt":
      if (m.spawnerAlt) movePad(m.spawnerAlt, m.spawnerAlt.radius || 28);
      break;
    case "obstacle":
      moveR(m.obstacles[sel.i]!);
      break;
    case "highGround":
      moveR(m.highGrounds[sel.i]!);
      break;
    case "turret":
      movePad(m.turretSlots[sel.i]!, 12);
      break;
    case "heal":
      moveR(m.healSprings![sel.i]!);
      break;
    case "mire":
      moveR(m.slowMires![sel.i]!);
      break;
    case "haste":
      moveR(m.hastePads![sel.i]!);
      break;
    case "gold":
      moveR(m.goldVents![sel.i]!);
      break;
    case "wind":
      moveR(m.windCurrents![sel.i]!);
      break;
    case "spike": {
      const s = m.spikePulses![sel.i]!;
      s.x += dx;
      s.y += dy;
      clampSpikeInLane(m, s);
      break;
    }
    case "bounce":
      moveR(m.bouncePads![sel.i]!);
      break;
    case "portal": {
      const p = m.mapPortals![sel.i]!;
      p.x += dx;
      p.y += dy;
      p.exitX += dx;
      p.exitY += dy;
      const a = clampPointInLane(m, p.x, p.y, p.radius);
      p.x = a.x;
      p.y = a.y;
      const e = clampPointInLane(m, p.exitX, p.exitY, 8);
      p.exitX = e.x;
      p.exitY = e.y;
      break;
    }
    case "relay":
      movePad(m.relayBeacons![sel.i]!, m.relayBeacons![sel.i]!.radius || 40);
      break;
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escape(s).replace(/'/g, "&#39;");
}
