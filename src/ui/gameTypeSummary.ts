/**
 * Diff GameTypeOptions against Outlast (factory default) → lobby summary bullets.
 * Format is always `[Option name]: [value]`.
 */

import {
  formatChestDespawn,
  formatChestOpen,
  formatCritLottery,
  formatEnemyMutation,
  formatMul,
  formatRelicDrop,
  formatRespawnMul,
} from "../meta/creativeOptions";
import {
  CORE_BUILTIN_GAME_TYPES,
  type GameTypeOptions,
  type SendLocation,
} from "../meta/gameTypes";

export type GameTypeSummaryBullet = { label: string };

/** Lobby / selector baseline = Outlast, not raw Race-era defaults. */
export function outlastBaselineOptions(): GameTypeOptions {
  const outlast = CORE_BUILTIN_GAME_TYPES.find((t) => t.id === "outlast");
  return structuredClone(outlast?.options ?? CORE_BUILTIN_GAME_TYPES[0]!.options);
}

function artifactLabel(n: number): string {
  if (n === -2) return "Unlimited";
  if (n < 0) return "Map Default";
  return String(n);
}

function sendLabel(s: SendLocation): string {
  return s === "own" ? "Own lane" : "Enemy lane";
}

function onOff(v: boolean): string {
  return v ? "ON" : "OFF";
}

function bullet(name: string, value: string): string {
  return `${name}: ${value}`;
}

/** Non-default option deltas vs Outlast (order roughly matches editor groups). */
export function gameTypeOptionDeltas(
  o: GameTypeOptions,
  defaults: GameTypeOptions = outlastBaselineOptions(),
): string[] {
  const bullets: string[] = [];
  const push = (cond: boolean, name: string, value: string) => {
    if (cond) bullets.push(bullet(name, value));
  };

  push(o.endless !== defaults.endless, "No rival lane", onOff(o.endless));
  push(
    o.wavesToWin !== defaults.wavesToWin,
    "Waves to win",
    o.wavesToWin <= 0 ? "Unlimited" : String(o.wavesToWin),
  );
  push(
    o.livesPerRun !== defaults.livesPerRun,
    "Lives per run",
    o.livesPerRun <= 0 ? "Unlimited" : String(o.livesPerRun),
  );
  push(
    o.livesPerWave !== defaults.livesPerWave,
    "Lives per wave",
    o.livesPerWave <= 0 ? "Unlimited" : String(o.livesPerWave),
  );
  push(o.startingGold !== defaults.startingGold, "Starting gold", String(o.startingGold));
  push(o.maxTurrets !== defaults.maxTurrets, "Artifacts", artifactLabel(o.maxTurrets));
  push(o.friendlyFire !== defaults.friendlyFire, "Friendly fire", onOff(o.friendlyFire));
  push(
    o.utilityDraftLevel !== defaults.utilityDraftLevel,
    "Utility draft",
    o.utilityDraftLevel < 0
      ? "Run start"
      : o.utilityDraftLevel === 0
        ? "Never"
        : `Lv ${o.utilityDraftLevel}`,
  );
  push(o.sendLocation !== defaults.sendLocation, "Sends", sendLabel(o.sendLocation));
  push(o.chestOpenMul !== defaults.chestOpenMul, "Chest open", formatChestOpen(o.chestOpenMul));
  push(
    o.chestDespawnSec !== defaults.chestDespawnSec,
    "Chest despawn",
    formatChestDespawn(o.chestDespawnSec),
  );
  push(
    o.chestSpawnChance !== defaults.chestSpawnChance,
    "Chest spawn",
    `${Math.round(o.chestSpawnChance * 100)}%`,
  );
  push(o.enemyDensityMul !== defaults.enemyDensityMul, "Enemy density", `${o.enemyDensityMul}x`);
  push(o.enemyHpMul !== defaults.enemyHpMul, "Enemy HP", `${o.enemyHpMul}x`);
  push(o.enemySpeedMul !== defaults.enemySpeedMul, "Enemy speed", `${o.enemySpeedMul}x`);
  push(o.incomeMul !== defaults.incomeMul, "Income", `${o.incomeMul}x`);
  push(o.respawnMul !== defaults.respawnMul, "Respawn", formatRespawnMul(o.respawnMul));
  push(o.startingBaseLevel !== defaults.startingBaseLevel, "Start base Lv", String(o.startingBaseLevel));
  push(o.levelDraftSize !== defaults.levelDraftSize, "Level draft size", String(o.levelDraftSize));
  push(o.relicDraftSize !== defaults.relicDraftSize, "Relic draft size", String(o.relicDraftSize));
  push(o.allyAi !== defaults.allyAi, "Ally AI", `${o.allyAi}x`);
  push(
    o.suddenDeathBaseHp !== defaults.suddenDeathBaseHp && o.suddenDeathBaseHp > 0,
    "Sudden-death base HP",
    String(o.suddenDeathBaseHp),
  );
  push(o.fogThicknessPct !== defaults.fogThicknessPct, "Fog thickness", `${o.fogThicknessPct}%`);
  push(o.fogVisionRadius !== defaults.fogVisionRadius, "Fog vision", String(o.fogVisionRadius));
  push(o.waveBreakSec !== defaults.waveBreakSec, "Between waves", `${o.waveBreakSec}s`);
  push(
    o.laneClearSpeedPct !== defaults.laneClearSpeedPct,
    "Lane-clear speed",
    `${o.laneClearSpeedPct}%`,
  );
  push(o.artifactPlacement !== defaults.artifactPlacement, "Artifact placement", o.artifactPlacement);
  push(o.allowBarracks !== defaults.allowBarracks, "Barracks", onOff(o.allowBarracks));
  push(o.respawnMinigame !== defaults.respawnMinigame, "Respawn minigame", onOff(o.respawnMinigame));
  push(
    o.playerBaseInvincible !== defaults.playerBaseInvincible,
    "Your base invincible",
    onOff(o.playerBaseInvincible),
  );
  push(
    o.enemyBaseInvincible !== defaults.enemyBaseInvincible,
    "Enemy base invincible",
    onOff(o.enemyBaseInvincible),
  );
  push(o.disableArtifacts !== defaults.disableArtifacts, "No artifacts", onOff(o.disableArtifacts));
  push(o.disableChests !== defaults.disableChests, "No chests", onOff(o.disableChests));
  push(o.disableElites !== defaults.disableElites, "No elites", onOff(o.disableElites));
  push(o.disableBosses !== defaults.disableBosses, "No bosses", onOff(o.disableBosses));
  push(o.disableShop !== defaults.disableShop, "No shop", onOff(o.disableShop));
  push(o.disableSends !== defaults.disableSends, "No sends", onOff(o.disableSends));
  push(o.disableRelics !== defaults.disableRelics, "No relics", onOff(o.disableRelics));
  push(o.fogAlways !== defaults.fogAlways, "Fog always", onOff(o.fogAlways));
  push(o.doubleElites !== defaults.doubleElites, "Double elites", onOff(o.doubleElites));
  push(o.glassCannon !== defaults.glassCannon, "Glass cannon", onOff(o.glassCannon));
  push(o.goldRush !== defaults.goldRush, "Gold rush", onOff(o.goldRush));
  push(o.wildChests !== defaults.wildChests, "Wild chests", onOff(o.wildChests));
  push(o.crampedLane !== defaults.crampedLane, "Cramped lane", onOff(o.crampedLane));
  push(o.relicDrop !== defaults.relicDrop, "Relic drop", formatRelicDrop(o.relicDrop));
  push(
    o.enemyProjectileDmgMul !== defaults.enemyProjectileDmgMul,
    "Enemy projectile dmg",
    formatMul(o.enemyProjectileDmgMul),
  );
  push(
    o.enemyCollisionDmgMul !== defaults.enemyCollisionDmgMul,
    "Enemy collision dmg",
    formatMul(o.enemyCollisionDmgMul),
  );
  push(o.playerDmgLmbMul !== defaults.playerDmgLmbMul, "LMB dmg", formatMul(o.playerDmgLmbMul));
  push(o.playerDmgRmbMul !== defaults.playerDmgRmbMul, "RMB dmg", formatMul(o.playerDmgRmbMul));
  push(o.playerDmgMmbMul !== defaults.playerDmgMmbMul, "MMB dmg", formatMul(o.playerDmgMmbMul));
  push(o.wallBounciness !== defaults.wallBounciness, "Wall bounce", formatMul(o.wallBounciness));
  push(o.playerSpeedMul !== defaults.playerSpeedMul, "Player speed", `${o.playerSpeedMul}x`);
  push(o.playerSizeMul !== defaults.playerSizeMul, "Player Size", `${o.playerSizeMul}x`);
  push(o.enemySizeMul !== defaults.enemySizeMul, "Enemy Size", `${o.enemySizeMul}x`);
  push(o.critLottery !== defaults.critLottery, "Crit lottery", formatCritLottery(o.critLottery));
  push(o.enemyMutation !== defaults.enemyMutation, "Enemy mutation", formatEnemyMutation(o.enemyMutation));
  push(
    o.randomizeUtilityWave !== defaults.randomizeUtilityWave,
    "Randomize utility / wave",
    onOff(o.randomizeUtilityWave),
  );
  push(
    o.randomizeHeroWave !== defaults.randomizeHeroWave,
    "Randomize hero / wave",
    onOff(o.randomizeHeroWave),
  );
  push(o.randomizeMapWave !== defaults.randomizeMapWave, "Randomize map / wave", onOff(o.randomizeMapWave));
  push(
    o.doubleAllProjectiles !== defaults.doubleAllProjectiles,
    "Double all projectiles",
    onOff(o.doubleAllProjectiles),
  );
  push(
    o.immuneToProjectiles !== defaults.immuneToProjectiles,
    "Immune to projectiles",
    onOff(o.immuneToProjectiles),
  );
  push(
    o.artifactDamageDoubled !== defaults.artifactDamageDoubled,
    "Artifact damage doubled",
    onOff(o.artifactDamageDoubled),
  );
  push(o.artifactsFree !== defaults.artifactsFree, "Artifacts free", onOff(o.artifactsFree));
  push(o.itemsFree !== defaults.itemsFree, "Items free", onOff(o.itemsFree));
  push(o.infiniteRerolls !== defaults.infiniteRerolls, "Infinite rerolls", onOff(o.infiniteRerolls));
  push(o.thornsAura !== defaults.thornsAura, "Thorns aura", onOff(o.thornsAura));
  push(o.bloodTax !== defaults.bloodTax, "Blood tax", onOff(o.bloodTax));
  push(o.echoBarrage !== defaults.echoBarrage, "Echo barrage", onOff(o.echoBarrage));
  push(o.pacifistPays !== defaults.pacifistPays, "Pacifist pays", onOff(o.pacifistPays));
  push(o.berserkerEdge !== defaults.berserkerEdge, "Berserker's edge", onOff(o.berserkerEdge));
  push(o.slipNSlide !== defaults.slipNSlide, "Slip n' slide", onOff(o.slipNSlide));
  push(o.vampiricCreeps !== defaults.vampiricCreeps, "Vampiric creeps", onOff(o.vampiricCreeps));
  push(o.corpseExplosion !== defaults.corpseExplosion, "Corpse Explosion", onOff(o.corpseExplosion));
  push(o.bounceHouse !== defaults.bounceHouse, "Bounce house", onOff(o.bounceHouse));

  return bullets;
}

/**
 * HTML multi-column bullet list of non-default options.
 * If more than maxVisible, last cell is “… Show more” that opens the editor.
 */
export function gameTypeSummaryHtml(
  o: GameTypeOptions,
  opts?: {
    maxVisible?: number;
    columns?: number;
    showMoreId?: string;
    showMoreAction?: string;
  },
): string {
  const bullets = gameTypeOptionDeltas(o);
  const max = opts?.maxVisible ?? 12;
  const cols = opts?.columns ?? 2;
  const showMoreId = opts?.showMoreId ?? "gt-summary-more";
  const showMoreAction = opts?.showMoreAction;

  if (bullets.length === 0) {
    return `<p class="gt-summary-empty menu-note compact">All options at defaults.</p>`;
  }

  const overflow = bullets.length > max;
  const shown = overflow ? bullets.slice(0, max - 1) : bullets;
  const items = shown.map((b) => `<li>${escapeHtml(b)}</li>`).join("");
  const moreBtn = overflow
    ? `<li class="gt-summary-more"><button type="button" class="linkish" id="${escapeHtml(showMoreId)}"${
        showMoreAction ? ` data-action="${escapeHtml(showMoreAction)}"` : ""
      }>… Show more</button></li>`
    : "";

  return `
    <ul class="gt-summary-list" style="--gt-cols:${cols}">
      ${items}
      ${moreBtn}
    </ul>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
