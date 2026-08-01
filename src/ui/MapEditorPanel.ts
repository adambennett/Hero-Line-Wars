/**
 * Workshop map editor — canvas place/drag tools + library I/O.
 */

import { MAP_H, MAP_W } from "../data/constants";
import { MAP_LIST, type MapDef } from "../data/maps";
import {
  defaultCustomMap,
  deleteCustomMap,
  listCustomMaps,
  saveCustomMap,
} from "../custom/registry";
import { exportCustomMap, importCustomMapFromFile } from "../custom/io";
import { newCustomMapId, type CustomMapDef, type RectZone } from "../custom/types";

export type MapEditorTool =
  | "select"
  | "base"
  | "shop"
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
  | "spike";

type SelKind =
  | { k: "base" }
  | { k: "shop" }
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
  | { k: "spike"; i: number };

type PendingConfirm = "reset" | "reset-lane" | "load-template";

const SPECIAL_TOOLTIPS: Record<string, string> = {
  shiftingObstacles: "Between waves, obstacles reshuffle within the lane.",
  shrinkingLane: "During waves, lane edges slowly close in.",
  movingHazards: "A moving damage hazard drifts mid-lane during waves.",
  eclipseFog: "Periodic fog that dims vision across the lane.",
  dualSpawners: "Waves alternate between primary and alt spawner pads.",
  chestMagnet: "Boosts the chance for chests to spawn.",
  riftSurges: "Periodic horizontal rifts yank units toward lane mid-X during waves.",
  volatileOrbs: "Spawns delayed explosive orbs in the lane during waves.",
};

export class MapEditorPanel {
  draft: CustomMapDef = defaultCustomMap({ id: newCustomMapId() });
  tool: MapEditorTool = "select";
  selected: SelKind | null = null;
  private drag: { ox: number; oy: number; sx: number; sy: number } | null = null;
  private pendingConfirm: PendingConfirm | null = null;
  /** `builtin:<id>` or `custom:<id>` awaiting confirm. */
  private pendingTemplateKey: string | null = null;
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
    return `<label class="chk" title="${escapeAttr(tip)}"><input type="checkbox" data-me-flag="${flag}" ${checked ? "checked" : ""}/> ${label}</label>`;
  }

  render(): string {
    const s = this.draft.specials;
    const tools: { id: MapEditorTool; label: string }[] = [
      { id: "select", label: "Select" },
      { id: "base", label: "Base" },
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
    ];
    return `
      <header class="menu-header compact">
        <button type="button" class="menu-back" data-action="goto" data-screen="main">← Back</button>
        <h1 class="menu-title">Map Editor</h1>
        <p class="menu-lead">Place geometry &amp; specials. Export JSON to share — MP syncs defs at match start.</p>
      </header>
      <div class="workshop-layout">
        <aside class="workshop-side">
          <label class="run-field"><span>Name</span>
            <input type="text" data-me="name" value="${escape(this.draft.name)}" />
          </label>
          <label class="run-field"><span>Blurb</span>
            <input type="text" data-me="blurb" value="${escape(this.draft.blurb)}" />
          </label>
          <label class="run-field"><span>Lane top / bottom</span>
            <div class="run-inline">
              <input type="number" data-me="laneTop" value="${this.draft.laneTop}" />
              <input type="number" data-me="laneBottom" value="${this.draft.laneBottom}" />
            </div>
          </label>
          <button type="button" class="menu-btn tiny ghost me-reset-lane" data-action="me-reset-lane">Reset lane bounds</button>
          <h3 class="workshop-section-label">Tools</h3>
          <div class="workshop-tools">
            ${tools
              .map(
                (t) =>
                  `<button type="button" class="menu-btn tiny ${this.tool === t.id ? "primary" : "ghost"}" data-action="me-tool" data-tool="${t.id}">${t.label}</button>`,
              )
              .join("")}
          </div>
          <details open class="muted-box" style="margin-top:8px">
            <summary>Specials</summary>
            ${this.specialFlagHtml("shiftingObstacles", "Shifting obstacles", s.shiftingObstacles)}
            ${this.specialFlagHtml("shrinkingLane", "Shrinking lane", s.shrinkingLane)}
            ${this.specialFlagHtml("movingHazards", "Moving hazards", s.movingHazards)}
            ${this.specialFlagHtml("eclipseFog", "Eclipse fog", s.eclipseFog)}
            ${this.specialFlagHtml("dualSpawners", "Dual spawners", s.dualSpawners)}
            ${this.specialFlagHtml("chestMagnet", "Chest magnet", s.chestMagnet)}
            ${this.specialFlagHtml("riftSurges", "Rift surges", s.riftSurges)}
            ${this.specialFlagHtml("volatileOrbs", "Volatile orbs", s.volatileOrbs)}
          </details>
          ${this.templatePickerHtml()}
          <div class="workshop-actions">
            <div class="workshop-actions-row primary">
              <button type="button" class="menu-btn primary" data-action="me-save">Save</button>
              <button type="button" class="menu-btn" data-action="me-new">New</button>
            </div>
            <div class="workshop-actions-row io">
              <button type="button" class="menu-btn" data-action="me-export">Export JSON</button>
              <label class="menu-btn ghost file-btn">Import<input type="file" accept="application/json,.json" data-action="me-import" hidden /></label>
            </div>
            <div class="workshop-actions-row danger">
              <button type="button" class="menu-btn ghost" data-action="me-reset">Reset</button>
              <button type="button" class="menu-btn ghost" data-action="me-delete">Delete</button>
              <button type="button" class="menu-btn ghost" data-action="me-del-sel">Delete selected</button>
            </div>
          </div>
          <p class="panel-note">${escape(this.status)}</p>
          <h3 class="workshop-section-label" style="margin-top:0.5rem">Library</h3>
          <div class="workshop-lib">${this.libraryHtml()}</div>
        </aside>
        <div class="workshop-canvas-wrap">
          <canvas id="map-editor-canvas" width="${MAP_W}" height="${MAP_H}"></canvas>
        </div>
      </div>
      ${this.confirmOverlayHtml()}
    `;
  }

  private confirmOverlayHtml(): string {
    if (!this.pendingConfirm) return "";
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
              body: "Lane top and bottom will return to the default values.",
              confirm: "Reset",
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
        else if (key === "laneTop" || key === "laneBottom") {
          (this.draft as Record<string, unknown>)[key] = Number(el.value) || 0;
        }
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

  handleAction(action: string, el: HTMLElement): boolean {
    if (action === "me-tool") {
      this.tool = (el.dataset.tool as MapEditorTool) || "select";
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
      return true;
    }
    if (action === "me-confirm-yes") {
      const kind = this.pendingConfirm;
      const templateKey = this.pendingTemplateKey;
      this.pendingConfirm = null;
      this.pendingTemplateKey = null;
      if (kind === "reset") {
        const id = this.draft.id || newCustomMapId();
        this.draft = defaultCustomMap({ id });
        this.selected = null;
        this.tool = "select";
        this.status = "Reset to defaults.";
      } else if (kind === "reset-lane") {
        const defaults = defaultCustomMap();
        this.draft.laneTop = defaults.laneTop;
        this.draft.laneBottom = defaults.laneBottom;
        this.status = "Lane bounds reset.";
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
      this.deleteSelected();
      this.status = "Removed selection.";
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

  private deleteSelected(): void {
    const s = this.selected;
    if (!s) return;
    if (s.k === "obstacle") this.draft.obstacles.splice(s.i, 1);
    else if (s.k === "highGround") this.draft.highGrounds.splice(s.i, 1);
    else if (s.k === "turret") this.draft.turretSlots.splice(s.i, 1);
    else if (s.k === "heal") this.draft.healSprings!.splice(s.i, 1);
    else if (s.k === "mire") this.draft.slowMires!.splice(s.i, 1);
    else if (s.k === "haste") this.draft.hastePads!.splice(s.i, 1);
    else if (s.k === "gold") this.draft.goldVents!.splice(s.i, 1);
    else if (s.k === "wind") this.draft.windCurrents!.splice(s.i, 1);
    else if (s.k === "spike") this.draft.spikePulses!.splice(s.i, 1);
    else if (s.k === "spawnerAlt") {
      this.draft.spawnerAlt = undefined;
      this.draft.specials.dualSpawners = false;
    }
    this.selected = null;
    this.paintCanvas();
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

    canvas.addEventListener("mousedown", (ev) => {
      const p = toWorld(ev);
      if (this.tool === "select") {
        this.selected = hitTest(this.draft, p.x, p.y);
        if (this.selected) this.drag = { ox: p.x, oy: p.y, sx: p.x, sy: p.y };
        this.paintCanvas();
        return;
      }
      this.placeAt(p.x, p.y);
      this.paintCanvas();
    });
    canvas.addEventListener("mousemove", (ev) => {
      if (!this.drag || !this.selected) return;
      const p = toWorld(ev);
      const dx = p.x - this.drag.ox;
      const dy = p.y - this.drag.oy;
      this.drag.ox = p.x;
      this.drag.oy = p.y;
      moveSelection(this.draft, this.selected, dx, dy);
      this.paintCanvas();
    });
    canvas.addEventListener("mouseup", () => {
      this.drag = null;
    });
  }

  private placeAt(x: number, y: number): void {
    const rect = (): RectZone => ({ x: x - 40, y: y - 30, w: 80, h: 60 });
    switch (this.tool) {
      case "base":
        this.draft.base.x = x;
        this.draft.base.y = y;
        break;
      case "shop":
        this.draft.shop.x = x;
        this.draft.shop.y = y;
        break;
      case "spawner":
        this.draft.spawner.x = x;
        this.draft.spawner.y = y;
        break;
      case "spawnerAlt":
        this.draft.spawnerAlt = { x, y, radius: this.draft.spawner.radius || 28 };
        this.draft.specials.dualSpawners = true;
        break;
      case "obstacle":
        this.draft.obstacles.push({ x: x - 24, y: y - 30, w: 48, h: 60 });
        break;
      case "highGround":
        this.draft.highGrounds.push({
          x: x - 80,
          y: y - 50,
          w: 160,
          h: 100,
          damageBonus: 0.35,
          oathDamageBonus: 0.65,
        });
        break;
      case "turret":
        this.draft.turretSlots.push({ x, y });
        break;
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
      case "spike":
        (this.draft.spikePulses ??= []).push({ x, y, radius: 36, damage: 22 });
        break;
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
    ctx.fillRect(0, m.laneTop, MAP_W, m.laneBottom - m.laneTop);
    ctx.strokeStyle = "#2a3d60";
    ctx.beginPath();
    ctx.moveTo(0, m.laneTop);
    ctx.lineTo(MAP_W, m.laneTop);
    ctx.moveTo(0, m.laneBottom);
    ctx.lineTo(MAP_W, m.laneBottom);
    ctx.stroke();

    const fillR = (list: RectZone[] | undefined, fill: string, label: string) => {
      for (const z of list ?? []) {
        ctx.fillStyle = fill;
        ctx.fillRect(z.x, z.y, z.w, z.h);
        ctx.fillStyle = "#fff8";
        ctx.font = "11px Segoe UI";
        ctx.fillText(label, z.x + 4, z.y + 14);
      }
    };
    fillR(m.healSprings, "#40e08044", "HEAL");
    fillR(m.slowMires, "#8060c044", "MIRE");
    fillR(m.hastePads, "#e0c04044", "HASTE");
    fillR(m.goldVents, "#e0c02044", "GOLD");
    fillR(m.windCurrents, "#60c0e044", "WIND");
    for (const hg of m.highGrounds) {
      ctx.fillStyle = "#3d5a8844";
      ctx.strokeStyle = "#7eb0ff";
      ctx.fillRect(hg.x, hg.y, hg.w, hg.h);
      ctx.strokeRect(hg.x, hg.y, hg.w, hg.h);
    }
    for (const o of m.obstacles) {
      ctx.fillStyle = "#1c2838";
      ctx.strokeStyle = "#4a6078";
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
    pad(m.shop, "#5a6a9a88", "SHOP");
    pad(m.spawner, "#9a4a4a88", "SPAWN");
    if (m.spawnerAlt) pad(m.spawnerAlt, "#9a6a4a88", "ALT");
  }
}

function validateMap(m: CustomMapDef): string | null {
  if (!m.name.trim()) return "Name required";
  if (m.laneTop >= m.laneBottom - 40) return "Lane bounds invalid";
  if (!m.base || !m.shop || !m.spawner) return "Base, shop, and spawner required";
  if (m.specials.dualSpawners && !m.spawnerAlt) return "Dual spawners needs an alt spawner";
  return null;
}

/** Built-in MapDef → editable CustomMapDef with a fresh custom id. */
function mapDefToCustomDraft(m: MapDef): CustomMapDef {
  return {
    id: newCustomMapId(),
    name: `${m.name} (copy)`,
    blurb: m.blurb,
    laneTop: m.laneTop,
    laneBottom: m.laneBottom,
    base: structuredClone(m.base),
    shop: structuredClone(m.shop),
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
    },
    healSprings: structuredClone(m.healSprings ?? []),
    slowMires: structuredClone(m.slowMires ?? []),
    hastePads: structuredClone(m.hastePads ?? []),
    goldVents: structuredClone(m.goldVents ?? []),
    windCurrents: structuredClone(m.windCurrents ?? []),
    spikePulses: structuredClone(m.spikePulses ?? []),
  };
}

/** Second spawner default: same X as primary, offset below (or above if clamped). */
function defaultSpawnerAlt(m: CustomMapDef): { x: number; y: number; radius: number } {
  const radius = m.spawner.radius || 28;
  const yOff = 80;
  const minY = m.laneTop + radius;
  const maxY = m.laneBottom - radius;
  let y = m.spawner.y + yOff;
  if (y > maxY) y = m.spawner.y - yOff;
  y = Math.max(minY, Math.min(maxY, y));
  return { x: m.spawner.x, y, radius };
}

function hitTest(m: CustomMapDef, x: number, y: number): SelKind | null {
  const inC = (p: { x: number; y: number; radius: number }) =>
    (x - p.x) ** 2 + (y - p.y) ** 2 <= p.radius ** 2;
  const inR = (r: RectZone, i: number, k: SelKind["k"]): SelKind | null =>
    x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h ? ({ k, i } as SelKind) : null;
  if (inC(m.base)) return { k: "base" };
  if (inC(m.shop)) return { k: "shop" };
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
  for (let i = m.turretSlots.length - 1; i >= 0; i--) {
    const t = m.turretSlots[i]!;
    if ((x - t.x) ** 2 + (y - t.y) ** 2 <= 12 ** 2) return { k: "turret", i };
  }
  return null;
}

function moveSelection(m: CustomMapDef, sel: SelKind, dx: number, dy: number): void {
  const movePad = (p: { x: number; y: number }) => {
    p.x += dx;
    p.y += dy;
  };
  const moveR = (r: RectZone) => {
    r.x += dx;
    r.y += dy;
  };
  switch (sel.k) {
    case "base":
      movePad(m.base);
      break;
    case "shop":
      movePad(m.shop);
      break;
    case "spawner":
      movePad(m.spawner);
      break;
    case "spawnerAlt":
      if (m.spawnerAlt) movePad(m.spawnerAlt);
      break;
    case "obstacle":
      moveR(m.obstacles[sel.i]!);
      break;
    case "highGround":
      moveR(m.highGrounds[sel.i]!);
      break;
    case "turret":
      movePad(m.turretSlots[sel.i]!);
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
      break;
    }
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
