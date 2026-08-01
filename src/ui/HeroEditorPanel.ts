/**
 * Workshop hero editor — remix abilities / passives / stats.
 */

import {
  AIM_MODES,
  ATTACK_STYLES,
  MOBILITY_ABILITIES,
  PASSIVE_CATALOG,
  ULTIMATE_ABILITIES,
  abilityTemplate,
  passiveTemplate,
} from "../custom/catalog";
import { exportCustomHero, importCustomHeroFromFile } from "../custom/io";
import {
  defaultCustomHero,
  deleteCustomHero,
  listCustomHeroes,
  saveCustomHero,
} from "../custom/registry";
import { newCustomHeroId, type CustomHeroDef } from "../custom/types";
import type { AbilityKind, AimMode, AttackStyle } from "../data/heroes";

export class HeroEditorPanel {
  draft: CustomHeroDef = defaultCustomHero({ id: newCustomHeroId() });
  status = "";
  private bindRoot: HTMLElement | null = null;

  load(id: string | null): void {
    if (!id) {
      this.draft = defaultCustomHero({ id: newCustomHeroId() });
      return;
    }
    const found = listCustomHeroes().find((h) => h.id === id);
    this.draft = found ? structuredClone(found) : defaultCustomHero({ id: newCustomHeroId() });
  }

  libraryHtml(): string {
    const heroes = listCustomHeroes();
    if (!heroes.length) return `<p class="muted">No custom heroes yet.</p>`;
    return heroes
      .map(
        (h) =>
          `<button type="button" class="menu-btn small ${h.id === this.draft.id ? "primary" : ""}" data-action="he-load" data-id="${h.id}" style="border-left:4px solid ${h.color}">${escape(h.name)}</button>`,
      )
      .join("");
  }

  render(): string {
    const d = this.draft;
    const mobOpts = MOBILITY_ABILITIES.map(
      (a) =>
        `<option value="${a.id}" ${d.abilities[0].id === a.id ? "selected" : ""}>${escape(a.name)}</option>`,
    ).join("");
    const ultOpts = ULTIMATE_ABILITIES.map(
      (a) =>
        `<option value="${a.id}" ${d.abilities[1].id === a.id ? "selected" : ""}>${escape(a.name)}</option>`,
    ).join("");
    const passOpts = PASSIVE_CATALOG.map(
      (p) =>
        `<option value="${p.id}" ${d.passive.id === p.id ? "selected" : ""}>${escape(p.name)}</option>`,
    ).join("");
    const styleOpts = ATTACK_STYLES.map(
      (s) => `<option value="${s}" ${d.attackStyle === s ? "selected" : ""}>${s}</option>`,
    ).join("");
    const aimOpts = AIM_MODES.map(
      (s) => `<option value="${s}" ${d.aimMode === s ? "selected" : ""}>${s}</option>`,
    ).join("");

    return `
      <header class="menu-header compact">
        <button type="button" class="menu-back" data-action="goto" data-screen="main">← Back</button>
        <h1 class="menu-title">Hero Editor</h1>
        <p class="menu-lead">Remix abilities &amp; passives. Export JSON · MP syncs kits at start.</p>
      </header>
      <div class="workshop-layout hero-editor">
        <div class="workshop-form-cols">
          <section class="workshop-form-col">
            <h3>Identity &amp; stats</h3>
            <div class="hero-preview-swatch" id="he-preview-swatch" style="--c:${d.color};--g:${d.glowColor}">
              <strong id="he-preview-name">${escape(d.name)}</strong>
              <span id="he-preview-blurb">${escape(d.blurb)}</span>
            </div>
            <label class="run-field"><span>Name</span><input data-he="name" value="${escape(d.name)}" /></label>
            <label class="run-field"><span>Blurb</span><input data-he="blurb" value="${escape(d.blurb)}" /></label>
            <label class="run-field"><span>Color / Glow</span>
              <div class="run-inline">
                <input type="color" data-he="color" value="${toHex(d.color)}" />
                <input type="color" data-he="glowColor" value="${toHex(d.glowColor)}" />
              </div>
            </label>
            <div class="run-grid cols-2">
              <label class="run-field"><span>Max HP</span><input type="number" data-he="maxHp" value="${d.maxHp}" /></label>
              <label class="run-field"><span>Speed</span><input type="number" data-he="speed" value="${d.speed}" /></label>
              <label class="run-field"><span>Damage</span><input type="number" data-he="attackDamage" value="${d.attackDamage}" /></label>
              <label class="run-field"><span>Attack CD</span><input type="number" step="0.01" data-he="attackCooldown" value="${d.attackCooldown}" /></label>
              <label class="run-field"><span>Range</span><input type="number" data-he="attackRange" value="${d.attackRange}" /></label>
              <label class="run-field"><span>Proj speed</span><input type="number" data-he="projectileSpeed" value="${d.projectileSpeed}" /></label>
              <label class="run-field"><span>Radius</span><input type="number" data-he="radius" value="${d.radius}" /></label>
            </div>
          </section>
          <section class="workshop-form-col">
            <h3>Kit pickers</h3>
            <label class="run-field"><span>Attack style</span><select data-he="attackStyle">${styleOpts}</select></label>
            <label class="run-field"><span>Aim mode</span><select data-he="aimMode">${aimOpts}</select></label>
            <label class="run-field"><span>Passive</span><select data-he="passive">${passOpts}</select></label>
            <p class="panel-note">${escape(d.passive.blurb)}</p>
            <label class="run-field"><span>Mobility</span><select data-he="mobility">${mobOpts}</select></label>
            <label class="run-field"><span>Mobility CD</span><input type="number" step="0.1" data-he="mobCd" value="${d.abilities[0].cooldown}" /></label>
            <label class="run-field"><span>Ultimate</span><select data-he="ultimate">${ultOpts}</select></label>
            <label class="run-field"><span>Ultimate CD</span><input type="number" step="0.1" data-he="ultCd" value="${d.abilities[1].cooldown}" /></label>
            <div class="workshop-actions">
              <button type="button" class="menu-btn primary shine-btn" data-action="he-save"><span class="btn-label">Save</span></button>
              <button type="button" class="menu-btn shine-btn" data-action="he-new"><span class="btn-label">New</span></button>
              <button type="button" class="menu-btn shine-btn" data-action="he-export"><span class="btn-label">Export JSON</span></button>
              <label class="menu-btn ghost file-btn shine-btn"><span class="btn-label">Import</span><input type="file" accept="application/json,.json" data-action="he-import" hidden /></label>
              <button type="button" class="menu-btn ghost danger" data-action="he-delete">Delete</button>
            </div>
            <p class="panel-note">${escape(this.status)}</p>
          </section>
        </div>
        <section class="workshop-kit-preview" id="he-kit-summary">
          <h2>Kit summary</h2>
          ${this.kitSummaryInnerHtml()}
        </section>
        <div class="workshop-footer-bar">
          <h3>Library</h3>
          <div class="workshop-lib horizontal">${this.libraryHtml()}</div>
        </div>
      </div>
    `;
  }

  bind(root: HTMLElement): void {
    this.bindRoot = root;
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-he]").forEach((el) => {
      const apply = () => {
        this.applyField(el.dataset.he!, el.value);
        this.paintLive();
      };
      el.addEventListener("change", apply);
      el.addEventListener("input", apply);
    });
  }

  private kitSummaryInnerHtml(): string {
    const d = this.draft;
    return `
      <article class="inv-row"><strong style="color:${d.color}">${escape(d.name)}</strong><span>${escape(d.blurb)}</span></article>
      <article class="inv-row"><strong>Passive — ${escape(d.passive.name)}</strong><span>${escape(d.passive.blurb)}</span></article>
      <article class="inv-row"><strong>${escape(d.abilities[0].name)}</strong><span>${escape(d.abilities[0].hint)} · ${d.abilities[0].cooldown}s</span><em>Mobility</em></article>
      <article class="inv-row"><strong>${escape(d.abilities[1].name)}</strong><span>${escape(d.abilities[1].hint)} · ${d.abilities[1].cooldown}s</span><em>Ultimate</em></article>
      <article class="inv-row"><strong>Attack</strong><span>${d.attackStyle} · ${d.aimMode} · ${escape(d.attackHint)}</span></article>
    `;
  }

  /** Partial DOM refresh for identity preview + kit summary while editing. */
  private paintLive(): void {
    const root = this.bindRoot;
    if (!root) return;
    const d = this.draft;
    const swatch = root.querySelector<HTMLElement>("#he-preview-swatch");
    if (swatch) {
      swatch.style.setProperty("--c", d.color);
      swatch.style.setProperty("--g", d.glowColor);
    }
    const name = root.querySelector("#he-preview-name");
    if (name) name.textContent = d.name;
    const blurb = root.querySelector("#he-preview-blurb");
    if (blurb) blurb.textContent = d.blurb;
    const kit = root.querySelector("#he-kit-summary");
    if (kit) {
      const h2 = kit.querySelector("h2");
      kit.innerHTML = `<h2>${h2?.textContent ?? "Kit summary"}</h2>${this.kitSummaryInnerHtml()}`;
    }
    const passPicker = root.querySelector<HTMLSelectElement>('select[data-he="passive"]');
    if (passPicker) {
      const note = passPicker.parentElement?.nextElementSibling;
      if (note?.classList.contains("panel-note")) note.textContent = d.passive.blurb;
    }
  }

  handleAction(action: string, el: HTMLElement): boolean {
    if (action === "he-load") {
      this.load(el.dataset.id ?? null);
      this.status = "Loaded.";
      return true;
    }
    if (action === "he-new") {
      this.load(null);
      this.status = "New hero draft.";
      return true;
    }
    if (action === "he-save") {
      if (!this.draft.id) this.draft.id = newCustomHeroId();
      const err = validateHero(this.draft);
      if (err) {
        this.status = err;
        return true;
      }
      saveCustomHero(this.draft);
      this.status = "Saved to library.";
      return true;
    }
    if (action === "he-export") {
      exportCustomHero(this.draft);
      this.status = "Exported.";
      return true;
    }
    if (action === "he-delete") {
      if (this.draft.id) deleteCustomHero(this.draft.id);
      this.load(null);
      this.status = "Deleted.";
      return true;
    }
    return false;
  }

  async handleImport(file: File): Promise<string> {
    const err = await importCustomHeroFromFile(file);
    if (err) return err;
    const heroes = listCustomHeroes();
    const last = heroes[heroes.length - 1];
    if (last) this.load(last.id);
    this.status = "Imported.";
    return "";
  }

  private applyField(key: string, value: string): void {
    const d = this.draft;
    const num = () => Number(value);
    switch (key) {
      case "name":
        d.name = value;
        break;
      case "blurb":
        d.blurb = value;
        break;
      case "color":
        d.color = value;
        break;
      case "glowColor":
        d.glowColor = value;
        break;
      case "maxHp":
        d.maxHp = clamp(num(), 40, 400);
        break;
      case "speed":
        d.speed = clamp(num(), 80, 420);
        break;
      case "attackDamage":
        d.attackDamage = clamp(num(), 4, 80);
        break;
      case "attackCooldown":
        d.attackCooldown = clamp(num(), 0.12, 1.5);
        break;
      case "attackRange":
        d.attackRange = clamp(num(), 40, 320);
        break;
      case "projectileSpeed":
        d.projectileSpeed = clamp(num(), 200, 900);
        break;
      case "radius":
        d.radius = clamp(num(), 10, 28);
        break;
      case "attackStyle":
        d.attackStyle = value as AttackStyle;
        d.attackHint = `${value} attack`;
        break;
      case "aimMode":
        d.aimMode = value as AimMode;
        break;
      case "passive": {
        const p = passiveTemplate(value);
        if (p) d.passive = { ...p };
        break;
      }
      case "mobility": {
        const t = abilityTemplate(value as AbilityKind);
        if (t) d.abilities[0] = { ...t, slot: "mobility", cooldown: d.abilities[0].cooldown };
        break;
      }
      case "ultimate": {
        const t = abilityTemplate(value as AbilityKind);
        if (t) d.abilities[1] = { ...t, slot: "ultimate", cooldown: d.abilities[1].cooldown };
        break;
      }
      case "mobCd":
        d.abilities[0].cooldown = clamp(num(), 1, 20);
        break;
      case "ultCd":
        d.abilities[1].cooldown = clamp(num(), 2, 30);
        break;
      default:
        break;
    }
  }
}

function validateHero(h: CustomHeroDef): string | null {
  if (!h.name.trim()) return "Name required";
  if (!abilityTemplate(h.abilities[0].id) || !abilityTemplate(h.abilities[1].id)) {
    return "Invalid abilities";
  }
  if (!passiveTemplate(h.passive.id)) return "Invalid passive";
  return null;
}

function clamp(n: number, a: number, b: number): number {
  if (!Number.isFinite(n)) return a;
  return Math.max(a, Math.min(b, n));
}

function toHex(c: string): string {
  if (c.startsWith("#") && (c.length === 7 || c.length === 4)) return c.length === 4 ? expand(c) : c;
  return "#5ec8f0";
}

function expand(c: string): string {
  return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
