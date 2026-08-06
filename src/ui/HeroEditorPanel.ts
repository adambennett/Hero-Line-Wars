/**
 * Workshop hero editor — remix abilities / passives / stats.
 * Basic mode keeps the core kit pickers; Advanced unlocks deep knobs.
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
import { newCustomHeroId, type CustomHeroAdvanced, type CustomHeroDef } from "../custom/types";
import { HERO_LIST, type AbilityKind, type AimMode, type AttackStyle } from "../data/heroes";

/** First known attackHint per style (from stock heroes). */
const ATTACK_HINT_BY_STYLE: Partial<Record<AttackStyle, string>> = {};
for (const h of HERO_LIST) {
  if (!ATTACK_HINT_BY_STYLE[h.attackStyle]) ATTACK_HINT_BY_STYLE[h.attackStyle] = h.attackHint;
}

function attackHintFor(style: AttackStyle): string {
  return ATTACK_HINT_BY_STYLE[style] ?? `${style} attack`;
}

/** data-tip blurbs — same styled hovertips as map-editor tools. */
const FIELD_TIPS: Record<string, string> = {
  name: "Display name in lobbies, Barracks, and the HUD.",
  blurb: "One-line flavor shown on hero cards and pick screens.",
  color: "Body color for the hero model in-lane.",
  glowColor: "Outer glow / aura tint for the hero model.",
  maxHp: "Starting max health (Basic clamp: 40–400).",
  speed: "Base move speed (Basic clamp: 80–420).",
  attackDamage: "Damage of the primary attack (Basic clamp: 4–80).",
  attackCooldown: "Seconds between primary shots (Basic clamp: 0.12–1.5). Lower = faster fire.",
  attackRange: "How far the primary attack can reach (Basic: 40–320).",
  projectileSpeed: "How fast primary projectiles travel (Basic: 200–900). Melee styles still use this for feel where relevant.",
  radius: "Collision / body size of the hero (Basic: 10–28).",
  attackStyle: "Primary attack shape and behavior (bolt, cleave, shotgun, etc.).",
  aimMode:
    "free = aim with mouse any direction · engage = need a foe in range · auto = track nearest foe.",
  passive: "Always-on passive. Changing this refreshes Ability text to the stock name/blurb.",
  mobility: "Mobility slot ability (default RMB). Changing this refreshes Ability text to the stock name/hint.",
  mobCd: "Mobility ability cooldown in seconds.",
  ultimate: "Ultimate slot ability (default MMB). Changing this refreshes Ability text to the stock name/hint.",
  ultCd: "Ultimate ability cooldown in seconds.",
  adv_projectileCount: "Extra primary projectiles per attack (0 = stock count only).",
  adv_attackSpreadDeg: "Cone spread in degrees for multi-shot / spray basics. 0 = no extra spread.",
  adv_basicPierce: "Extra enemies a basic projectile can pass through after the first hit.",
  adv_basicBounce: "Extra chain bounces for basic projectiles after the first hit.",
  adv_abilityPowerMul: "Multiplies mobility / ultimate ability damage and effect strength.",
  adv_passivePowerMul: "Scales passive power where the kit supports a numeric multiplier.",
  adv_lifesteal: "Fraction of damage returned as healing (0–1). 0.12 = 12% lifesteal.",
  adv_moveSpeedMul: "Extra multiplier on base move speed for this hero only.",
  maxHpWide: "Max HP with a wider Advanced clamp (20–900).",
  speedWide: "Move speed with a wider Advanced clamp (40–900).",
  attackDamageWide: "Primary damage with a wider Advanced clamp (1–250).",
  attackCooldownWide: "Attack cooldown with a wider Advanced clamp (0.05–3s).",
  attackRangeWide: "Attack range with a wider Advanced clamp (20–600).",
  projectileSpeedWide: "Projectile speed with a wider Advanced clamp (80–1600).",
  radiusWide: "Body radius with a wider Advanced clamp (6–48).",
  mobCdWide: "Mobility CD with a wider Advanced clamp (0.2–45s).",
  ultCdWide: "Ultimate CD with a wider Advanced clamp (0.5–60s).",
  adv_mobilityName: "Display name for the mobility ability in the HUD / kit summary.",
  adv_mobilityHint: "Short description of the mobility ability.",
  adv_ultimateName: "Display name for the ultimate in the HUD / kit summary.",
  adv_ultimateHint: "Short description of the ultimate ability.",
  adv_passiveName: "Display name for the passive.",
  adv_passiveBlurb: "Short description of the passive effect.",
  adv_attackHintCustom: "Hint text for the primary attack (shown on kit cards).",
  heModeBasic: "Core identity, stats, and kit pickers only.",
  heModeAdvanced: "Deep combat knobs, wider clamps, and custom ability text.",
};

export class HeroEditorPanel {
  draft: CustomHeroDef = defaultCustomHero({ id: newCustomHeroId() });
  status = "";
  /** Advanced mode unlocks deep numeric/ability text fields. */
  advancedMode = false;
  private bindRoot: HTMLElement | null = null;
  /** When kit pickers change, force Ability text inputs to template defaults. */
  private syncAbilityTextOnPaint = false;
  private pendingDeleteConfirm = false;
  /** Ok-only modal for non-unique name on save. */
  nameConflictMsg: string | null = null;

  load(id: string | null): void {
    this.pendingDeleteConfirm = false;
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
          `<button type="button" class="menu-btn small ${h.id === this.draft.id ? "primary" : ""}" data-action="he-load" data-id="${h.id}" style="border-left:4px solid ${h.color}" data-tip="${escape(h.blurb || h.name)}">${escape(h.name)}</button>`,
      )
      .join("");
  }

  render(): string {
    const d = this.draft;
    const adv = d.advanced ?? {};
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

    const f = (key: string) => tipAttr(FIELD_TIPS[key] ?? "");

    const advancedBlock = this.advancedMode
      ? `
          <section class="workshop-form-col he-advanced-col">
            <h3>Advanced combat</h3>
            <p class="panel-note">Deep kit values — extras only on custom heroes.</p>
            <div class="run-grid cols-2">
              <label class="run-field"${f("adv_projectileCount")}><span>Proj count (+)</span><input type="number" step="1" data-he="adv_projectileCount" value="${adv.projectileCount ?? 0}" /></label>
              <label class="run-field"${f("adv_attackSpreadDeg")}><span>Spread deg</span><input type="number" step="1" data-he="adv_attackSpreadDeg" value="${adv.attackSpreadDeg ?? 0}" /></label>
              <label class="run-field"${f("adv_basicPierce")}><span>Basic pierce</span><input type="number" step="1" data-he="adv_basicPierce" value="${adv.basicPierce ?? 0}" /></label>
              <label class="run-field"${f("adv_basicBounce")}><span>Basic bounce</span><input type="number" step="1" data-he="adv_basicBounce" value="${adv.basicBounce ?? 0}" /></label>
              <label class="run-field"${f("adv_abilityPowerMul")}><span>Ability power ×</span><input type="number" step="0.05" data-he="adv_abilityPowerMul" value="${adv.abilityPowerMul ?? 1}" /></label>
              <label class="run-field"${f("adv_passivePowerMul")}><span>Passive power ×</span><input type="number" step="0.05" data-he="adv_passivePowerMul" value="${adv.passivePowerMul ?? 1}" /></label>
              <label class="run-field"${f("adv_lifesteal")}><span>Lifesteal</span><input type="number" step="0.01" data-he="adv_lifesteal" value="${adv.lifesteal ?? 0}" /></label>
              <label class="run-field"${f("adv_moveSpeedMul")}><span>Move speed ×</span><input type="number" step="0.05" data-he="adv_moveSpeedMul" value="${adv.moveSpeedMul ?? 1}" /></label>
            </div>
            <h3>Wide clamps</h3>
            <div class="run-grid cols-2">
              <label class="run-field"${f("maxHpWide")}><span>Max HP</span><input type="number" data-he="maxHpWide" value="${d.maxHp}" /></label>
              <label class="run-field"${f("speedWide")}><span>Speed</span><input type="number" data-he="speedWide" value="${d.speed}" /></label>
              <label class="run-field"${f("attackDamageWide")}><span>Damage</span><input type="number" data-he="attackDamageWide" value="${d.attackDamage}" /></label>
              <label class="run-field"${f("attackCooldownWide")}><span>Attack CD</span><input type="number" step="0.01" data-he="attackCooldownWide" value="${d.attackCooldown}" /></label>
              <label class="run-field"${f("attackRangeWide")}><span>Range</span><input type="number" data-he="attackRangeWide" value="${d.attackRange}" /></label>
              <label class="run-field"${f("projectileSpeedWide")}><span>Proj speed</span><input type="number" data-he="projectileSpeedWide" value="${d.projectileSpeed}" /></label>
              <label class="run-field"${f("radiusWide")}><span>Radius</span><input type="number" data-he="radiusWide" value="${d.radius}" /></label>
              <label class="run-field"${f("mobCdWide")}><span>Mob CD</span><input type="number" step="0.05" data-he="mobCdWide" value="${d.abilities[0].cooldown}" /></label>
              <label class="run-field"${f("ultCdWide")}><span>Ult CD</span><input type="number" step="0.05" data-he="ultCdWide" value="${d.abilities[1].cooldown}" /></label>
            </div>
          </section>
          <section class="workshop-form-col he-advanced-col">
            <h3>Ability text</h3>
            <p class="panel-note">Display names / blurbs. Kit pickers reload these from stock text when you change abilities.</p>
            <label class="run-field"${f("adv_mobilityName")}><span>Mobility name</span><input data-he="adv_mobilityName" value="${escape(adv.mobilityName ?? d.abilities[0].name)}" /></label>
            <label class="run-field"${f("adv_mobilityHint")}><span>Mobility hint</span><input data-he="adv_mobilityHint" value="${escape(adv.mobilityHint ?? d.abilities[0].hint)}" /></label>
            <label class="run-field"${f("adv_ultimateName")}><span>Ultimate name</span><input data-he="adv_ultimateName" value="${escape(adv.ultimateName ?? d.abilities[1].name)}" /></label>
            <label class="run-field"${f("adv_ultimateHint")}><span>Ultimate hint</span><input data-he="adv_ultimateHint" value="${escape(adv.ultimateHint ?? d.abilities[1].hint)}" /></label>
            <label class="run-field"${f("adv_passiveName")}><span>Passive name</span><input data-he="adv_passiveName" value="${escape(adv.passiveName ?? d.passive.name)}" /></label>
            <label class="run-field"${f("adv_passiveBlurb")}><span>Passive blurb</span><input data-he="adv_passiveBlurb" value="${escape(adv.passiveBlurb ?? d.passive.blurb)}" /></label>
            <label class="run-field"${f("adv_attackHintCustom")}><span>Attack hint</span><input data-he="adv_attackHintCustom" value="${escape(adv.attackHintCustom ?? d.attackHint)}" /></label>
          </section>`
      : "";

    return `
      <header class="menu-header compact he-header">
        <button type="button" class="menu-back" data-action="goto" data-screen="main">← Back</button>
        <div class="he-header-titles">
          <h1 class="menu-title">Hero Editor</h1>
          <p class="menu-lead">Remix abilities &amp; passives. Export JSON · MP syncs kits at start.</p>
        </div>
        <div class="he-mode-toggle">
          <button type="button" class="menu-btn small ${!this.advancedMode ? "primary" : ""}" data-action="he-mode-basic"${f("heModeBasic")}><span class="btn-label">Basic</span></button>
          <button type="button" class="menu-btn small ${this.advancedMode ? "primary" : ""}" data-action="he-mode-advanced"${f("heModeAdvanced")}><span class="btn-label">Advanced</span></button>
        </div>
      </header>
      <div class="workshop-layout hero-editor">
        <div class="workshop-form-cols${this.advancedMode ? " he-advanced-grid" : ""}">
          <section class="workshop-form-col">
            <h3>Identity &amp; stats</h3>
            <div class="hero-preview-swatch" id="he-preview-swatch" style="--c:${d.color};--g:${d.glowColor}">
              <strong id="he-preview-name">${escape(d.name)}</strong>
              <span id="he-preview-blurb">${escape(d.blurb)}</span>
            </div>
            <label class="run-field"${f("name")}><span>Name</span><input data-he="name" value="${escape(d.name)}" /></label>
            <label class="run-field"${f("blurb")}><span>Blurb</span><input data-he="blurb" value="${escape(d.blurb)}" /></label>
            <label class="run-field"${f("color")}><span>Color / Glow</span>
              <div class="run-inline">
                <input type="color" data-he="color" value="${toHex(d.color)}"${f("color")} />
                <input type="color" data-he="glowColor" value="${toHex(d.glowColor)}"${f("glowColor")} />
              </div>
            </label>
            <div class="run-grid cols-2">
              <label class="run-field"${f("maxHp")}><span>Max HP</span><input type="number" data-he="maxHp" value="${d.maxHp}" /></label>
              <label class="run-field"${f("speed")}><span>Speed</span><input type="number" data-he="speed" value="${d.speed}" /></label>
              <label class="run-field"${f("attackDamage")}><span>Damage</span><input type="number" data-he="attackDamage" value="${d.attackDamage}" /></label>
              <label class="run-field"${f("attackCooldown")}><span>Attack CD</span><input type="number" step="0.01" data-he="attackCooldown" value="${d.attackCooldown}" /></label>
              <label class="run-field"${f("attackRange")}><span>Range</span><input type="number" data-he="attackRange" value="${d.attackRange}" /></label>
              <label class="run-field"${f("projectileSpeed")}><span>Proj speed</span><input type="number" data-he="projectileSpeed" value="${d.projectileSpeed}" /></label>
              <label class="run-field"${f("radius")}><span>Radius</span><input type="number" data-he="radius" value="${d.radius}" /></label>
            </div>
          </section>
          <section class="workshop-form-col">
            <h3>Kit pickers</h3>
            <label class="run-field"${f("attackStyle")}><span>Attack style</span><select data-he="attackStyle">${styleOpts}</select></label>
            <label class="run-field"${f("aimMode")}><span>Aim mode</span><select data-he="aimMode">${aimOpts}</select></label>
            <label class="run-field"${f("passive")}><span>Passive</span><select data-he="passive">${passOpts}</select></label>
            <p class="panel-note" id="he-passive-note">${escape(d.passive.blurb)}</p>
            <label class="run-field"${f("mobility")}><span>Mobility</span><select data-he="mobility">${mobOpts}</select></label>
            <label class="run-field"${f("mobCd")}><span>Mobility CD</span><input type="number" step="0.1" data-he="mobCd" value="${d.abilities[0].cooldown}" /></label>
            <label class="run-field"${f("ultimate")}><span>Ultimate</span><select data-he="ultimate">${ultOpts}</select></label>
            <label class="run-field"${f("ultCd")}><span>Ultimate CD</span><input type="number" step="0.1" data-he="ultCd" value="${d.abilities[1].cooldown}" /></label>
            <div class="workshop-actions">
              <button type="button" class="menu-btn primary shine-btn" data-action="he-save" data-tip="Save this hero to your local library"><span class="btn-label">Save</span></button>
              <button type="button" class="menu-btn shine-btn" data-action="he-new" data-tip="Start a fresh custom hero draft"><span class="btn-label">New</span></button>
              <button type="button" class="menu-btn shine-btn" data-action="he-export" data-tip="Download this hero as JSON"><span class="btn-label">Export JSON</span></button>
              <label class="menu-btn ghost file-btn shine-btn" data-tip="Import a custom hero JSON into the library"><span class="btn-label">Import</span><input type="file" accept="application/json,.json" data-action="he-import" hidden /></label>
              <button type="button" class="menu-btn ghost danger" data-action="he-delete" data-tip="Remove this hero from the local library">Delete</button>
            </div>
            <p class="panel-note">${escape(this.status)}</p>
          </section>
          ${advancedBlock}
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
      ${this.confirmOverlayHtml()}
    `;
  }

  private confirmOverlayHtml(): string {
    if (this.nameConflictMsg) {
      return `
      <div class="menu-confirm-overlay" role="alertdialog" aria-modal="true" aria-labelledby="he-name-title" aria-describedby="he-name-body">
        <div class="menu-confirm-card">
          <h1 id="he-name-title">Name already used</h1>
          <p id="he-name-body">${escape(this.nameConflictMsg)}</p>
          <div class="menu-confirm-actions">
            <button type="button" data-action="he-name-ok">Ok</button>
          </div>
        </div>
      </div>`;
    }
    if (!this.pendingDeleteConfirm) return "";
    const name = this.draft.name || "this hero";
    return `
      <div class="menu-confirm-overlay" role="alertdialog" aria-modal="true" aria-labelledby="he-confirm-title" aria-describedby="he-confirm-body">
        <div class="menu-confirm-card">
          <h1 id="he-confirm-title">Delete custom hero?</h1>
          <p id="he-confirm-body">Permanently remove “${escape(name)}” from your local library. This cannot be undone (export a JSON backup first if you might want it back).</p>
          <div class="menu-confirm-actions">
            <button type="button" data-action="he-confirm-yes">Delete hero</button>
            <button type="button" data-action="he-confirm-no">Cancel</button>
          </div>
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
    const adv = d.advanced;
    const mobName = adv?.mobilityName ?? d.abilities[0].name;
    const mobHint = adv?.mobilityHint ?? d.abilities[0].hint;
    const ultName = adv?.ultimateName ?? d.abilities[1].name;
    const ultHint = adv?.ultimateHint ?? d.abilities[1].hint;
    const passName = adv?.passiveName ?? d.passive.name;
    const passBlurb = adv?.passiveBlurb ?? d.passive.blurb;
    const atkHint = adv?.attackHintCustom ?? d.attackHint;
    const extras = adv
      ? `<article class="inv-row"><strong>Advanced</strong><span>shots+${adv.projectileCount ?? 0} · pierce ${adv.basicPierce ?? 0} · bounce ${adv.basicBounce ?? 0} · ability ×${adv.abilityPowerMul ?? 1}</span></article>`
      : "";
    return `
      <article class="inv-row"><strong style="color:${d.color}">${escape(d.name)}</strong><span>${escape(d.blurb)}</span></article>
      <article class="inv-row"><strong>Passive — ${escape(passName)}</strong><span>${escape(passBlurb)}</span></article>
      <article class="inv-row"><strong>${escape(mobName)}</strong><span>${escape(mobHint)} · ${d.abilities[0].cooldown}s</span><em>Mobility</em></article>
      <article class="inv-row"><strong>${escape(ultName)}</strong><span>${escape(ultHint)} · ${d.abilities[1].cooldown}s</span><em>Ultimate</em></article>
      <article class="inv-row"><strong>Attack</strong><span>${d.attackStyle} · ${d.aimMode} · ${escape(atkHint)}</span></article>
      ${extras}
    `;
  }

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
    const passNote = root.querySelector("#he-passive-note");
    if (passNote) passNote.textContent = d.passive.blurb;

    if (this.syncAbilityTextOnPaint) {
      this.syncAbilityTextOnPaint = false;
      this.pushAbilityTextToDom(root);
    }
  }

  /** Overwrite Ability text inputs after a kit picker change. */
  private pushAbilityTextToDom(root: HTMLElement): void {
    const d = this.draft;
    const adv = d.advanced ?? {};
    const set = (key: string, value: string) => {
      const el = root.querySelector<HTMLInputElement>(`[data-he="${key}"]`);
      if (el) el.value = value;
    };
    set("adv_mobilityName", adv.mobilityName ?? d.abilities[0].name);
    set("adv_mobilityHint", adv.mobilityHint ?? d.abilities[0].hint);
    set("adv_ultimateName", adv.ultimateName ?? d.abilities[1].name);
    set("adv_ultimateHint", adv.ultimateHint ?? d.abilities[1].hint);
    set("adv_passiveName", adv.passiveName ?? d.passive.name);
    set("adv_passiveBlurb", adv.passiveBlurb ?? d.passive.blurb);
    set("adv_attackHintCustom", adv.attackHintCustom ?? d.attackHint);
  }

  handleAction(action: string, el: HTMLElement): boolean {
    if (action === "he-mode-basic") {
      this.advancedMode = false;
      this.status = "Basic mode";
      return true;
    }
    if (action === "he-mode-advanced") {
      this.advancedMode = true;
      this.status = "Advanced mode — deep kit knobs unlocked.";
      return true;
    }
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
      const saveErr = saveCustomHero(this.draft);
      if (saveErr) {
        this.nameConflictMsg = saveErr;
        this.status = "";
        return true;
      }
      this.status = "Saved to library.";
      return true;
    }
    if (action === "he-name-ok") {
      this.nameConflictMsg = null;
      return true;
    }
    if (action === "he-export") {
      exportCustomHero(this.draft);
      this.status = "Exported.";
      return true;
    }
    if (action === "he-confirm-no") {
      this.pendingDeleteConfirm = false;
      return true;
    }
    if (action === "he-confirm-yes") {
      this.pendingDeleteConfirm = false;
      if (this.draft.id) deleteCustomHero(this.draft.id);
      this.load(null);
      this.status = "Deleted.";
      return true;
    }
    if (action === "he-delete") {
      if (!this.draft.id || !listCustomHeroes().some((h) => h.id === this.draft.id)) {
        this.status = "Nothing saved to delete — start from a library hero or save first.";
        return true;
      }
      this.pendingDeleteConfirm = true;
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

  private adv(): CustomHeroAdvanced {
    if (!this.draft.advanced) this.draft.advanced = {};
    return this.draft.advanced;
  }

  /** Reset Ability text fields to stock template text for the new kit. */
  private refreshAbilityTextFromKit(
    which: "mobility" | "ultimate" | "passive" | "attack" | "all",
  ): void {
    const d = this.draft;
    const a = this.adv();
    if (which === "mobility" || which === "all") {
      a.mobilityName = d.abilities[0].name;
      a.mobilityHint = d.abilities[0].hint;
    }
    if (which === "ultimate" || which === "all") {
      a.ultimateName = d.abilities[1].name;
      a.ultimateHint = d.abilities[1].hint;
    }
    if (which === "passive" || which === "all") {
      a.passiveName = d.passive.name;
      a.passiveBlurb = d.passive.blurb;
    }
    if (which === "attack" || which === "all") {
      a.attackHintCustom = d.attackHint;
    }
    this.syncAbilityTextOnPaint = true;
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
      case "maxHpWide":
        d.maxHp = clamp(num(), 20, 900);
        break;
      case "speed":
        d.speed = clamp(num(), 80, 420);
        break;
      case "speedWide":
        d.speed = clamp(num(), 40, 900);
        break;
      case "attackDamage":
        d.attackDamage = clamp(num(), 4, 80);
        break;
      case "attackDamageWide":
        d.attackDamage = clamp(num(), 1, 250);
        break;
      case "attackCooldown":
        d.attackCooldown = clamp(num(), 0.12, 1.5);
        break;
      case "attackCooldownWide":
        d.attackCooldown = clamp(num(), 0.05, 3);
        break;
      case "attackRange":
        d.attackRange = clamp(num(), 40, 320);
        break;
      case "attackRangeWide":
        d.attackRange = clamp(num(), 20, 600);
        break;
      case "projectileSpeed":
        d.projectileSpeed = clamp(num(), 200, 900);
        break;
      case "projectileSpeedWide":
        d.projectileSpeed = clamp(num(), 80, 1600);
        break;
      case "radius":
        d.radius = clamp(num(), 10, 28);
        break;
      case "radiusWide":
        d.radius = clamp(num(), 6, 48);
        break;
      case "attackStyle": {
        d.attackStyle = value as AttackStyle;
        d.attackHint = attackHintFor(d.attackStyle);
        this.refreshAbilityTextFromKit("attack");
        break;
      }
      case "aimMode":
        d.aimMode = value as AimMode;
        break;
      case "passive": {
        const p = passiveTemplate(value);
        if (p) {
          d.passive = { ...p };
          this.refreshAbilityTextFromKit("passive");
        }
        break;
      }
      case "mobility": {
        const t = abilityTemplate(value as AbilityKind);
        if (t) {
          d.abilities[0] = { ...t, slot: "mobility", cooldown: d.abilities[0].cooldown };
          this.refreshAbilityTextFromKit("mobility");
        }
        break;
      }
      case "ultimate": {
        const t = abilityTemplate(value as AbilityKind);
        if (t) {
          d.abilities[1] = { ...t, slot: "ultimate", cooldown: d.abilities[1].cooldown };
          this.refreshAbilityTextFromKit("ultimate");
        }
        break;
      }
      case "mobCd":
        d.abilities[0].cooldown = clamp(num(), 1, 20);
        break;
      case "mobCdWide":
        d.abilities[0].cooldown = clamp(num(), 0.2, 45);
        break;
      case "ultCd":
        d.abilities[1].cooldown = clamp(num(), 2, 30);
        break;
      case "ultCdWide":
        d.abilities[1].cooldown = clamp(num(), 0.5, 60);
        break;
      case "adv_projectileCount":
        this.adv().projectileCount = Math.max(0, Math.floor(num()));
        break;
      case "adv_attackSpreadDeg":
        this.adv().attackSpreadDeg = clamp(num(), 0, 90);
        break;
      case "adv_basicPierce":
        this.adv().basicPierce = Math.max(0, Math.floor(num()));
        break;
      case "adv_basicBounce":
        this.adv().basicBounce = Math.max(0, Math.floor(num()));
        break;
      case "adv_abilityPowerMul":
        this.adv().abilityPowerMul = clamp(num(), 0.1, 10);
        break;
      case "adv_passivePowerMul":
        this.adv().passivePowerMul = clamp(num(), 0.1, 10);
        break;
      case "adv_lifesteal":
        this.adv().lifesteal = clamp(num(), 0, 1);
        break;
      case "adv_moveSpeedMul":
        this.adv().moveSpeedMul = clamp(num(), 0.25, 5);
        break;
      case "adv_mobilityName":
        this.adv().mobilityName = value.slice(0, 40);
        break;
      case "adv_mobilityHint":
        this.adv().mobilityHint = value.slice(0, 120);
        break;
      case "adv_ultimateName":
        this.adv().ultimateName = value.slice(0, 40);
        break;
      case "adv_ultimateHint":
        this.adv().ultimateHint = value.slice(0, 120);
        break;
      case "adv_passiveName":
        this.adv().passiveName = value.slice(0, 40);
        break;
      case "adv_passiveBlurb":
        this.adv().passiveBlurb = value.slice(0, 160);
        break;
      case "adv_attackHintCustom":
        this.adv().attackHintCustom = value.slice(0, 120);
        d.attackHint = value.slice(0, 120);
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

function tipAttr(text: string): string {
  if (!text) return "";
  return ` data-tip="${escape(text)}"`;
}
