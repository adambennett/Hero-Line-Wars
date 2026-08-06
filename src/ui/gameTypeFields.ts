/**
 * Shared Game Type option form HTML (SP/MP/Campaign editor).
 * No Mode dropdown — team composition lives on the lobby roster.
 */

import { STARTING_GOLD, WIN_WAVES } from "../data/constants";
import { utilityDraftLevelOptionsHtml } from "../data/utilities";
import {
  formatChestDespawn,
  formatChestOpen,
  formatCritLottery,
  formatEnemyMutation,
  formatMul,
  formatRelicDrop,
  formatRespawnMul,
  type CritLotteryMode,
  type EnemyMutationMode,
  type RelicDropMode,
} from "../meta/creativeOptions";
import type { GameTypeOptions } from "../meta/gameTypes";
import {
  contentFilterCatalog,
  emptyContentFilters,
  isAllContentEnabled,
  type ContentFilterKey,
  type GameTypeContentFilters,
} from "../meta/contentFilters";
import {
  RUN_OPTION_DEFAULTS,
  RUN_OPTION_POOLS,
  runTip,
  type RunOptionTipKey,
} from "./runOptionsMeta";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Styled HLW tooltips (data-tip), not browser title tooltips. */
function tip(key: RunOptionTipKey): string {
  return ` data-tip="${escapeHtml(runTip(key))}"`;
}

function artifactLabel(n: number, withDefaultMarker: boolean): string {
  if (n === -2) return "Unlimited";
  if (n < 0) return "Map Default";
  const base = String(n);
  if (!withDefaultMarker) return base;
  return n === RUN_OPTION_DEFAULTS.maxTurrets ? `${base} (default)` : base;
}

/** Turret select options shared by SP / MP / Game Type editor. */
export function turretOptionsHtml(current: number): string {
  return RUN_OPTION_POOLS.maxTurrets
    .map(
      (n) =>
        `<option value="${n}" ${current === n ? "selected" : ""}>${artifactLabel(n, true)}</option>`,
    )
    .join("");
}

export function gameTypeOptionsFieldsHtml(
  o: GameTypeOptions,
  prefix: string,
  editable: boolean,
): string {
  const dis = editable ? "" : "disabled";
  const sel = (
    field: string,
    label: string,
    tipKey: RunOptionTipKey,
    pool: readonly number[],
    current: number,
    fmt: (n: number) => string,
  ) => `
    <label class="run-field"${tip(tipKey)}><span>${label}</span>
      <select data-gt="${field}" id="${prefix}-${field}" ${dis}${tip(tipKey)}>
        ${pool.map((n) => `<option value="${n}" ${current === n ? "selected" : ""}>${fmt(n)}</option>`).join("")}
      </select>
    </label>`;

  const dmgSel = (
    field: string,
    label: string,
    tipKey: RunOptionTipKey,
    current: number,
  ) => sel(field, label, tipKey, RUN_OPTION_POOLS.damageMul, current, (n) => formatMul(n));

  const goldOpts = RUN_OPTION_POOLS.startingGold
    .map(
      (g) =>
        `<option value="${g}" ${o.startingGold === g ? "selected" : ""}>${g}${g === STARTING_GOLD ? " (default)" : ""}</option>`,
    )
    .join("");
  const waveOpts = RUN_OPTION_POOLS.wavesToWin
    .map((w) => {
      const label = w === 0 ? "Unlimited" : String(w);
      const def = w === WIN_WAVES ? " (default)" : "";
      return `<option value="${w}" ${o.wavesToWin === w ? "selected" : ""}>${label}${def}</option>`;
    })
    .join("");
  const livesWaveOpts = RUN_OPTION_POOLS.livesPerWave
    .map((n) => {
      const label = n === 0 ? "Unlimited" : String(n);
      return `<option value="${n}" ${o.livesPerWave === n ? "selected" : ""}>${label}</option>`;
    })
    .join("");
  const livesRunOpts = RUN_OPTION_POOLS.livesPerRun
    .map((n) => {
      const label = n === 0 ? "Unlimited" : String(n);
      return `<option value="${n}" ${o.livesPerRun === n ? "selected" : ""}>${label}</option>`;
    })
    .join("");

  const creativeFlags: Array<[string, string, boolean, RunOptionTipKey]> = [
    ["disableArtifacts", "No artifacts", o.disableArtifacts, "noArtifacts"],
    ["disableChests", "No chests", o.disableChests, "noChests"],
    ["disableElites", "No elites", o.disableElites, "noElites"],
    ["disableBosses", "No bosses", o.disableBosses, "noBosses"],
    ["disableShop", "No shop", o.disableShop, "noShop"],
    ["disableSends", "No sends", o.disableSends, "noSends"],
    ["disableRelics", "No relics", o.disableRelics, "noRelics"],
    ["fogAlways", "Fog always", o.fogAlways, "fogAlways"],
    ["doubleElites", "Double elites", o.doubleElites, "doubleElites"],
    ["glassCannon", "Glass cannon", o.glassCannon, "glassCannon"],
    ["goldRush", "Gold rush", o.goldRush, "goldRush"],
    ["wildChests", "Wild chests", o.wildChests, "wildChests"],
    ["crampedLane", "Cramped lane", o.crampedLane, "crampedLane"],
    ["playerBaseInvincible", "Your base invincible", o.playerBaseInvincible, "playerBaseInvincible"],
    ["enemyBaseInvincible", "Enemy base invincible", o.enemyBaseInvincible, "enemyBaseInvincible"],
    ["respawnMinigame", "Respawn minigame", o.respawnMinigame, "respawnMinigame"],
    ["allowBarracks", "Allow barracks upgrades", o.allowBarracks, "allowBarracks"],
    ["endless", "No rival lane", o.endless, "mode"],
    ["randomizeUtilityWave", "Randomize utility / wave", o.randomizeUtilityWave, "randomizeUtilityWave"],
    ["doubleAllProjectiles", "Double all projectiles", o.doubleAllProjectiles, "doubleAllProjectiles"],
    ["immuneToProjectiles", "Immune to projectiles", o.immuneToProjectiles, "immuneToProjectiles"],
    ["randomizeHeroWave", "Randomize hero / wave", o.randomizeHeroWave, "randomizeHeroWave"],
    ["randomizeMapWave", "Randomize map / wave", o.randomizeMapWave, "randomizeMapWave"],
    ["artifactDamageDoubled", "Artifact damage doubled", o.artifactDamageDoubled, "artifactDamageDoubled"],
    ["artifactsFree", "Artifacts are free", o.artifactsFree, "artifactsFree"],
    ["itemsFree", "Items are free", o.itemsFree, "itemsFree"],
    ["infiniteRerolls", "Infinite rerolls", o.infiniteRerolls, "infiniteRerolls"],
    ["thornsAura", "Thorns aura", o.thornsAura, "thornsAura"],
    ["bloodTax", "Blood tax", o.bloodTax, "bloodTax"],
    ["echoBarrage", "Echo barrage", o.echoBarrage, "echoBarrage"],
    ["pacifistPays", "Pacifist pays", o.pacifistPays, "pacifistPays"],
    ["berserkerEdge", "Berserker's edge", o.berserkerEdge, "berserkerEdge"],
    ["slipNSlide", "Slip n' slide", o.slipNSlide, "slipNSlide"],
    ["vampiricCreeps", "Vampiric creeps", o.vampiricCreeps, "vampiricCreeps"],
    ["corpseExplosion", "Corpse explosion", o.corpseExplosion, "corpseExplosion"],
    ["bounceHouse", "Bounce house", o.bounceHouse, "bounceHouse"],
  ];

  const d = RUN_OPTION_DEFAULTS;
  const creativeActive =
    creativeFlags.filter(([, , on]) => on).length +
    [
      o.enemyDensityMul !== d.enemyDensityMul,
      o.enemyHpMul !== d.enemyHpMul,
      o.enemySpeedMul !== d.enemySpeedMul,
      o.incomeMul !== d.incomeMul,
      o.respawnMul !== d.respawnMul,
      o.startingBaseLevel !== d.startingBaseLevel,
      o.levelDraftSize !== d.levelDraftSize,
      o.relicDraftSize !== d.relicDraftSize,
      o.suddenDeathBaseHp !== d.suddenDeathBaseHp,
      o.fogThicknessPct !== d.fogThicknessPct,
      o.fogVisionRadius !== d.fogVisionRadius,
      o.waveBreakSec !== d.waveBreakSec,
      o.laneClearSpeedPct !== d.laneClearSpeedPct,
      o.artifactPlacement !== d.artifactPlacement,
      o.sendLocation !== "enemy",
      o.relicDrop !== d.relicDrop,
      o.enemyProjectileDmgMul !== d.enemyProjectileDmgMul,
      o.enemyCollisionDmgMul !== d.enemyCollisionDmgMul,
      o.playerDmgLmbMul !== d.playerDmgLmbMul,
      o.playerDmgRmbMul !== d.playerDmgRmbMul,
      o.playerDmgMmbMul !== d.playerDmgMmbMul,
      o.wallBounciness !== d.wallBounciness,
      o.playerSpeedMul !== d.playerSpeedMul,
      o.playerSizeMul !== d.playerSizeMul,
      o.enemySizeMul !== d.enemySizeMul,
      o.critLottery !== d.critLottery,
      o.enemyMutation !== d.enemyMutation,
    ].filter(Boolean).length;

  // No-rival (endless) only removes the enemy lane — waves-to-win is independent.
  // 0 = Unlimited from the real pool; never invent a fake "Until you fall" option.
  const wavesField = `<label class="run-field"${tip("wavesToWin")}>
          <span>Waves to win</span>
          <select data-gt="wavesToWin" id="${prefix}-wavesToWin" ${dis}${tip("wavesToWin")}>${waveOpts}</select>
        </label>`;

  const laneClearOpts = RUN_OPTION_POOLS.laneClearSpeedPct
    .map(
      (n) =>
        `<option value="${n}" ${o.laneClearSpeedPct === n ? "selected" : ""}>${n === 0 ? "0% (default)" : `${n}%`}</option>`,
    )
    .join("");

  const relicDropOpts = RUN_OPTION_POOLS.relicDrop
    .map(
      (m) =>
        `<option value="${m}" ${o.relicDrop === m ? "selected" : ""}>${formatRelicDrop(m)}</option>`,
    )
    .join("");
  const critOpts = RUN_OPTION_POOLS.critLottery
    .map(
      (m) =>
        `<option value="${m}" ${o.critLottery === m ? "selected" : ""}>${formatCritLottery(m)}</option>`,
    )
    .join("");
  const mutOpts = RUN_OPTION_POOLS.enemyMutation
    .map(
      (m) =>
        `<option value="${m}" ${o.enemyMutation === m ? "selected" : ""}>${formatEnemyMutation(m)}</option>`,
    )
    .join("");

  return `
    <div class="run-grid cols-4">
      <label class="run-field"${tip("artifacts")}>
        <span>Artifacts</span>
        <select data-gt="maxTurrets" id="${prefix}-maxTurrets" ${dis}${tip("artifacts")}>${turretOptionsHtml(o.maxTurrets)}</select>
      </label>
      <label class="run-field"${tip("artifactPlacement")}>
        <span>Artifact place</span>
        <select data-gt="artifactPlacement" id="${prefix}-artifactPlacement" ${dis}${tip("artifactPlacement")}>
          <option value="free" ${o.artifactPlacement === "free" ? "selected" : ""}>Free</option>
          <option value="locked" ${o.artifactPlacement === "locked" ? "selected" : ""}>Locked</option>
        </select>
      </label>
      <label class="run-field"${tip("startingGold")}>
        <span>Starting gold</span>
        <select data-gt="startingGold" id="${prefix}-startingGold" ${dis}${tip("startingGold")}>${goldOpts}</select>
      </label>
      ${wavesField}
      <label class="run-field"${tip("friendlyFire")}>
        <span>Friendly fire</span>
        <select data-gt="friendlyFire" id="${prefix}-friendlyFire" ${dis}${tip("friendlyFire")}>
          <option value="0" ${!o.friendlyFire ? "selected" : ""}>Off</option>
          <option value="1" ${o.friendlyFire ? "selected" : ""}>On</option>
        </select>
      </label>
      <label class="run-field"${tip("livesWave")}>
        <span>Lives / wave</span>
        <select data-gt="livesPerWave" id="${prefix}-livesPerWave" ${dis}${tip("livesWave")}>${livesWaveOpts}</select>
      </label>
      <label class="run-field"${tip("livesRun")}>
        <span>Lives / run</span>
        <select data-gt="livesPerRun" id="${prefix}-livesPerRun" ${dis}${tip("livesRun")}>${livesRunOpts}</select>
      </label>
      <label class="run-field"${tip("utilityDraft")}>
        <span>Utility draft Lv</span>
        <select data-gt="utilityDraftLevel" id="${prefix}-utilityDraftLevel" ${dis}${tip("utilityDraft")}>${utilityDraftLevelOptionsHtml(o.utilityDraftLevel)}</select>
      </label>
      <label class="run-field"${tip("sendLocation")}>
        <span>Send location</span>
        <select data-gt="sendLocation" id="${prefix}-sendLocation" ${dis}${tip("sendLocation")}>
          <option value="enemy" ${o.sendLocation === "enemy" ? "selected" : ""}>Enemy lane</option>
          <option value="own" ${o.sendLocation === "own" ? "selected" : ""}>Own lane</option>
        </select>
      </label>
      <label class="run-field"${tip("chestOpen")}>
        <span>Chest open</span>
        <select data-gt="chestOpenMul" id="${prefix}-chestOpenMul" ${dis}${tip("chestOpen")}>${RUN_OPTION_POOLS.chestOpenMul.map((n) => `<option value="${n}" ${o.chestOpenMul === n ? "selected" : ""}>${formatChestOpen(n)}</option>`).join("")}</select>
      </label>
      <label class="run-field"${tip("chestDespawn")}>
        <span>Chest despawn</span>
        <select data-gt="chestDespawnSec" id="${prefix}-chestDespawnSec" ${dis}${tip("chestDespawn")}>${RUN_OPTION_POOLS.chestDespawnSec.map((n) => `<option value="${n}" ${o.chestDespawnSec === n ? "selected" : ""}>${formatChestDespawn(n)}</option>`).join("")}</select>
      </label>
      <label class="run-field"${tip("chestSpawn")}>
        <span>Chest spawn</span>
        <select data-gt="chestSpawnChance" id="${prefix}-chestSpawnChance" ${dis}${tip("chestSpawn")}>${RUN_OPTION_POOLS.chestSpawnChance.map((n) => `<option value="${n}" ${o.chestSpawnChance === n ? "selected" : ""}>${Math.round(n * 100)}% chance</option>`).join("")}</select>
      </label>
    </div>
    <details class="opt-fold"${creativeActive > 0 ? " open" : ""}>
      <summary>Creative options${creativeActive > 0 ? ` <span class="opt-count">${creativeActive} active</span>` : ""}</summary>
      <div class="opt-fold-body">
        <div class="run-grid cols-4">
          ${sel("enemyDensityMul", "Enemy density", "enemyDensity", RUN_OPTION_POOLS.enemyDensityMul, o.enemyDensityMul, (n) => `${n}×`)}
          ${sel("enemyHpMul", "Enemy HP", "enemyHp", RUN_OPTION_POOLS.enemyHpMul, o.enemyHpMul, (n) => `${n}×`)}
          ${sel("enemySpeedMul", "Enemy speed", "enemySpeed", RUN_OPTION_POOLS.enemySpeedMul, o.enemySpeedMul, (n) => formatMul(n))}
          ${sel("playerSpeedMul", "Player speed", "playerSpeed", RUN_OPTION_POOLS.unitSpeed, o.playerSpeedMul, (n) => formatMul(n))}
          ${sel("playerSizeMul", "Player size", "playerSize", RUN_OPTION_POOLS.unitSize, o.playerSizeMul, (n) => formatMul(n))}
          ${sel("enemySizeMul", "Enemy size", "enemySize", RUN_OPTION_POOLS.unitSize, o.enemySizeMul, (n) => formatMul(n))}
          ${sel("incomeMul", "Income", "income", RUN_OPTION_POOLS.incomeMul, o.incomeMul, (n) => `${n}×`)}
          ${sel("respawnMul", "Respawn", "respawn", RUN_OPTION_POOLS.respawnMul, o.respawnMul, formatRespawnMul)}
          ${sel("startingBaseLevel", "Start base Lv", "startBase", RUN_OPTION_POOLS.startingBaseLevel, o.startingBaseLevel, (n) => `${n}`)}
          ${sel("levelDraftSize", "Level draft size", "levelDraft", RUN_OPTION_POOLS.levelDraftSize, o.levelDraftSize, (n) => `${n}`)}
          ${sel("relicDraftSize", "Relic draft size", "relicDraft", RUN_OPTION_POOLS.relicDraftSize, o.relicDraftSize, (n) => `${n}`)}
          <label class="run-field"${tip("relicDrop")}><span>Relic drop</span>
            <select data-gt="relicDrop" id="${prefix}-relicDrop" ${dis}${tip("relicDrop")}>${relicDropOpts}</select>
          </label>
          ${sel("allyAi", "Ally AI", "allyAi", RUN_OPTION_POOLS.allyAi, o.allyAi, (n) => `${n}×`)}
          ${sel("suddenDeathBaseHp", "Sudden death HP", "suddenDeath", RUN_OPTION_POOLS.suddenDeathBaseHp, o.suddenDeathBaseHp, (n) => (n === 0 ? "Off" : `${n}`))}
          ${sel("fogThicknessPct", "Fog thickness", "fogThickness", RUN_OPTION_POOLS.fogThicknessPct, o.fogThicknessPct, (n) => `${n}%`)}
          ${sel("fogVisionRadius", "Fog vision", "fogVision", RUN_OPTION_POOLS.fogVisionRadius, o.fogVisionRadius, (n) => `${n}px`)}
          ${sel("waveBreakSec", "Between waves", "waveBreak", RUN_OPTION_POOLS.waveBreakSec, o.waveBreakSec, (n) => `${n}s`)}
          <label class="run-field"${tip("laneClearSpeed")}><span>Lane-clear speed</span>
            <select data-gt="laneClearSpeedPct" id="${prefix}-laneClearSpeedPct" ${dis}${tip("laneClearSpeed")}>${laneClearOpts}</select>
          </label>
          ${dmgSel("enemyProjectileDmgMul", "Enemy projectile dmg", "enemyProjectileDmg", o.enemyProjectileDmgMul)}
          ${dmgSel("enemyCollisionDmgMul", "Enemy collision dmg", "enemyCollisionDmg", o.enemyCollisionDmgMul)}
          ${dmgSel("playerDmgLmbMul", "Player dmg (Primary)", "playerDmgLmb", o.playerDmgLmbMul)}
          ${dmgSel("playerDmgRmbMul", "Player dmg (Mobility)", "playerDmgRmb", o.playerDmgRmbMul)}
          ${dmgSel("playerDmgMmbMul", "Player dmg (Ultimate)", "playerDmgMmb", o.playerDmgMmbMul)}
          ${sel("wallBounciness", "Wall bounciness", "wallBounciness", RUN_OPTION_POOLS.wallBounciness, o.wallBounciness, (n) => formatMul(n, "Instant Death"))}
          <label class="run-field"${tip("critLottery")}><span>Crit lottery</span>
            <select data-gt="critLottery" id="${prefix}-critLottery" ${dis}${tip("critLottery")}>${critOpts}</select>
          </label>
          <label class="run-field"${tip("enemyMutation")}><span>Enemy mutation</span>
            <select data-gt="enemyMutation" id="${prefix}-enemyMutation" ${dis}${tip("enemyMutation")}>${mutOpts}</select>
          </label>
        </div>
        <div class="creative-check-grid">
          ${creativeFlags
            .map(
              ([field, label, on, tipKey]) =>
                `<label class="setting-row"${tip(tipKey)}><span>${label}</span><input type="checkbox" data-gt="${field}" id="${prefix}-${field}" ${on ? "checked" : ""} ${dis} /></label>`,
            )
            .join("")}
        </div>
      </div>
    </details>
    ${contentFiltersHtml(o.contentFilters ?? emptyContentFilters(), prefix, editable)}
  `;
}

function contentFiltersHtml(
  filters: GameTypeContentFilters,
  _prefix: string,
  editable: boolean,
): string {
  const dis = editable ? "" : "disabled";
  const active = isAllContentEnabled(filters)
    ? 0
    : contentFilterCatalog().reduce((n, cat) => n + (filters[cat.key]?.length ?? 0), 0);
  const blocks = contentFilterCatalog()
    .map((cat) => {
      const disabled = new Set(filters[cat.key] ?? []);
      const checks = cat.ids
        .map((row) => {
          const on = !disabled.has(row.id);
          return `<label class="gt-filter-chip" data-tip="${escapeHtml(row.name)}">
            <input type="checkbox" data-gt-filter="${cat.key}" data-id="${escapeHtml(row.id)}" ${on ? "checked" : ""} ${dis} />
            <span>${escapeHtml(row.name)}</span>
          </label>`;
        })
        .join("");
      return `<details class="opt-fold gt-filter-fold">
        <summary>${escapeHtml(cat.label)}${disabled.size ? ` <span class="opt-count">${disabled.size} off</span>` : ""}</summary>
        <div class="opt-fold-body gt-filter-grid">${checks}</div>
      </details>`;
    })
    .join("");
  return `
    <details class="opt-fold"${active > 0 ? " open" : ""}>
      <summary>Content filters${active > 0 ? ` <span class="opt-count">${active} disabled</span>` : ""}</summary>
      <div class="opt-fold-body">
        <p class="menu-note">Uncheck to disable. Empty categories keep everything. Need ≥1 hero and ≥1 enemy.</p>
        ${blocks}
      </div>
    </details>`;
}

export function readContentFiltersFromDom(
  root: ParentNode,
  existing?: GameTypeContentFilters,
): GameTypeContentFilters {
  const out = emptyContentFilters();
  for (const cat of contentFilterCatalog()) {
    const boxes = root.querySelectorAll<HTMLInputElement>(`input[data-gt-filter="${cat.key}"]`);
    if (!boxes.length) {
      out[cat.key] = existing?.[cat.key] ? [...existing[cat.key]] : [];
      continue;
    }
    const disabled: string[] = [];
    boxes.forEach((el) => {
      if (!el.checked && el.dataset.id) disabled.push(el.dataset.id);
    });
    out[cat.key as ContentFilterKey] = disabled;
  }
  return out;
}

/** Read form values under a root into a GameTypeOptions blob. */
export function readGameTypeOptionsFromDom(root: ParentNode, prefix: string): GameTypeOptions {
  const base = {
    ...RUN_OPTION_DEFAULTS,
    sendLocation: "enemy" as const,
    contentFilters: emptyContentFilters(),
  };
  const num = (id: string, fb: number) => {
    const el = root.querySelector<HTMLSelectElement>(`#${prefix}-${id}`);
    if (!el) return fb;
    const v = Number(el.value);
    return Number.isFinite(v) ? v : fb;
  };
  const bool = (id: string, fb: boolean) => {
    const el = root.querySelector<HTMLInputElement>(`#${prefix}-${id}`);
    if (!el) return fb;
    return el.checked;
  };
  const sel = (id: string) => root.querySelector<HTMLSelectElement>(`#${prefix}-${id}`);
  const str = (id: string, fb: string) => {
    const el = sel(id);
    return el?.value ?? fb;
  };
  const ff = sel("friendlyFire");
  const send = sel("sendLocation");
  const place = sel("artifactPlacement");
  const relicDrop = str("relicDrop", base.relicDrop) as RelicDropMode;
  const critLottery = str("critLottery", base.critLottery) as CritLotteryMode;
  const enemyMutation = str("enemyMutation", base.enemyMutation) as EnemyMutationMode;
  return {
    maxTurrets: num("maxTurrets", base.maxTurrets),
    startingGold: num("startingGold", base.startingGold),
    wavesToWin: num("wavesToWin", base.wavesToWin),
    livesPerWave: num("livesPerWave", base.livesPerWave),
    livesPerRun: num("livesPerRun", base.livesPerRun),
    utilityDraftLevel: num("utilityDraftLevel", base.utilityDraftLevel),
    friendlyFire: ff ? ff.value === "1" : base.friendlyFire,
    endless: bool("endless", base.endless),
    sendLocation: send?.value === "own" ? "own" : "enemy",
    chestOpenMul: num("chestOpenMul", base.chestOpenMul),
    chestDespawnSec: num("chestDespawnSec", base.chestDespawnSec),
    chestSpawnChance: num("chestSpawnChance", base.chestSpawnChance),
    enemyDensityMul: num("enemyDensityMul", base.enemyDensityMul),
    enemyHpMul: num("enemyHpMul", base.enemyHpMul),
    enemySpeedMul: num("enemySpeedMul", base.enemySpeedMul),
    incomeMul: num("incomeMul", base.incomeMul),
    respawnMul: num("respawnMul", base.respawnMul),
    startingBaseLevel: num("startingBaseLevel", base.startingBaseLevel),
    levelDraftSize: num("levelDraftSize", base.levelDraftSize),
    relicDraftSize: num("relicDraftSize", base.relicDraftSize),
    allyAi: num("allyAi", base.allyAi),
    suddenDeathBaseHp: num("suddenDeathBaseHp", base.suddenDeathBaseHp),
    fogThicknessPct: num("fogThicknessPct", base.fogThicknessPct),
    fogVisionRadius: num("fogVisionRadius", base.fogVisionRadius),
    waveBreakSec: num("waveBreakSec", base.waveBreakSec),
    disableArtifacts: bool("disableArtifacts", base.disableArtifacts),
    disableChests: bool("disableChests", base.disableChests),
    disableElites: bool("disableElites", base.disableElites),
    disableBosses: bool("disableBosses", base.disableBosses),
    disableShop: bool("disableShop", base.disableShop),
    disableSends: bool("disableSends", base.disableSends),
    disableRelics: bool("disableRelics", base.disableRelics),
    fogAlways: bool("fogAlways", base.fogAlways),
    doubleElites: bool("doubleElites", base.doubleElites),
    glassCannon: bool("glassCannon", base.glassCannon),
    goldRush: bool("goldRush", base.goldRush),
    wildChests: bool("wildChests", base.wildChests),
    crampedLane: bool("crampedLane", base.crampedLane),
    playerBaseInvincible: bool("playerBaseInvincible", base.playerBaseInvincible),
    enemyBaseInvincible: bool("enemyBaseInvincible", base.enemyBaseInvincible),
    laneClearSpeedPct: num("laneClearSpeedPct", base.laneClearSpeedPct),
    respawnMinigame: bool("respawnMinigame", base.respawnMinigame),
    artifactPlacement: place?.value === "locked" ? "locked" : "free",
    allowBarracks: bool("allowBarracks", base.allowBarracks),
    relicDrop: RUN_OPTION_POOLS.relicDrop.includes(relicDrop) ? relicDrop : base.relicDrop,
    enemyProjectileDmgMul: num("enemyProjectileDmgMul", base.enemyProjectileDmgMul),
    enemyCollisionDmgMul: num("enemyCollisionDmgMul", base.enemyCollisionDmgMul),
    playerDmgLmbMul: num("playerDmgLmbMul", base.playerDmgLmbMul),
    playerDmgRmbMul: num("playerDmgRmbMul", base.playerDmgRmbMul),
    playerDmgMmbMul: num("playerDmgMmbMul", base.playerDmgMmbMul),
    wallBounciness: num("wallBounciness", base.wallBounciness),
    playerSpeedMul: num("playerSpeedMul", base.playerSpeedMul),
    playerSizeMul: num("playerSizeMul", base.playerSizeMul),
    enemySizeMul: num("enemySizeMul", base.enemySizeMul),
    critLottery: RUN_OPTION_POOLS.critLottery.includes(critLottery) ? critLottery : base.critLottery,
    enemyMutation: RUN_OPTION_POOLS.enemyMutation.includes(enemyMutation)
      ? enemyMutation
      : base.enemyMutation,
    randomizeUtilityWave: bool("randomizeUtilityWave", base.randomizeUtilityWave),
    doubleAllProjectiles: bool("doubleAllProjectiles", base.doubleAllProjectiles),
    immuneToProjectiles: bool("immuneToProjectiles", base.immuneToProjectiles),
    randomizeHeroWave: bool("randomizeHeroWave", base.randomizeHeroWave),
    randomizeMapWave: bool("randomizeMapWave", base.randomizeMapWave),
    artifactDamageDoubled: bool("artifactDamageDoubled", base.artifactDamageDoubled),
    artifactsFree: bool("artifactsFree", base.artifactsFree),
    itemsFree: bool("itemsFree", base.itemsFree),
    infiniteRerolls: bool("infiniteRerolls", base.infiniteRerolls),
    thornsAura: bool("thornsAura", base.thornsAura),
    bloodTax: bool("bloodTax", base.bloodTax),
    echoBarrage: bool("echoBarrage", base.echoBarrage),
    pacifistPays: bool("pacifistPays", base.pacifistPays),
    berserkerEdge: bool("berserkerEdge", base.berserkerEdge),
    slipNSlide: bool("slipNSlide", base.slipNSlide),
    vampiricCreeps: bool("vampiricCreeps", base.vampiricCreeps),
    corpseExplosion: bool("corpseExplosion", base.corpseExplosion),
    bounceHouse: bool("bounceHouse", base.bounceHouse),
    contentFilters: readContentFiltersFromDom(root),
  };
}
