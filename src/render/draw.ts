import { MAP_H, MAP_W } from "../data/constants";
import { ENEMY_DEFS, isBossKind, isEliteKind } from "../data/enemies";
import { resolveHero } from "../custom/registry";
import { TURRET_DEFS } from "../data/turrets";
import { type EnemyUnit, type GameState, type TurretUnit } from "../game/state";
import { inHighGround } from "../systems/combat";
import { loadSettings } from "../ui/settings";

export type View = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export function computeView(canvas: HTMLCanvasElement): View {
  // Leave room above/below for send/XP and HP/controls chrome.
  const marginTop = canvas.height * 0.11;
  const marginBottom = canvas.height * 0.16;
  const availW = canvas.width * 0.98;
  const availH = Math.max(1, canvas.height - marginTop - marginBottom);
  const scale = Math.min(availW / MAP_W, availH / MAP_H);
  return {
    scale,
    offsetX: (canvas.width - MAP_W * scale) / 2,
    offsetY: marginTop + (availH - MAP_H * scale) / 2,
  };
}

function worldToScreen(view: View, x: number, y: number): { x: number; y: number } {
  return {
    x: view.offsetX + x * view.scale,
    y: view.offsetY + y * view.scale,
  };
}

function drawHpBar(
  ctx: CanvasRenderingContext2D,
  view: View,
  x: number,
  y: number,
  radius: number,
  hp: number,
  maxHp: number,
): void {
  const p = worldToScreen(view, x, y - radius - 8);
  const w = 28 * view.scale;
  const h = 4 * view.scale;
  ctx.fillStyle = "#1a2030";
  ctx.fillRect(p.x - w / 2, p.y, w, h);
  ctx.fillStyle = hp / maxHp > 0.35 ? "#3ecf8e" : "#ff5f5f";
  ctx.fillRect(p.x - w / 2, p.y, w * Math.max(0, hp / maxHp), h);
}

function drawEnemyShape(ctx: CanvasRenderingContext2D, e: EnemyUnit): void {
  const def = ENEMY_DEFS[e.kind];
  const r = e.radius;
  ctx.fillStyle = e.sent ? mixTint(def.color, "#a34bd4", 0.45) : def.color;
  ctx.strokeStyle = def.stroke;
  ctx.lineWidth = isBossKind(e.kind) || isEliteKind(e.kind) ? 3 : 2;

  ctx.beginPath();
  switch (def.shape) {
    case "diamond":
      ctx.moveTo(e.x, e.y - r);
      ctx.lineTo(e.x + r, e.y);
      ctx.lineTo(e.x, e.y + r);
      ctx.lineTo(e.x - r, e.y);
      ctx.closePath();
      break;
    case "triangle":
      ctx.moveTo(e.x, e.y - r);
      ctx.lineTo(e.x + r * 0.95, e.y + r * 0.75);
      ctx.lineTo(e.x - r * 0.95, e.y + r * 0.75);
      ctx.closePath();
      break;
    case "square":
      ctx.rect(e.x - r * 0.85, e.y - r * 0.85, r * 1.7, r * 1.7);
      break;
    case "star": {
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const px = e.x + Math.cos(a) * r;
        const py = e.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case "hex": {
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = e.x + Math.cos(a) * r;
        const py = e.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    default:
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      break;
  }
  ctx.fill();
  ctx.stroke();

  if (e.telegraph > 0 && e.slamRadius) {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.slamRadius, 0, Math.PI * 2);
    ctx.strokeStyle = "#ff505088";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (e.kind === "boss" || e.kind === "elite" || isBossKind(e.kind) || isEliteKind(e.kind)) {
    ctx.fillStyle = "#fff8";
    ctx.font = "bold 9px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(isBossKind(e.kind) ? "BOSS" : "ELITE", e.x, e.y + 3);
  } else if (e.kind === "sniper" || e.kind === "mortar" || e.kind === "hexer") {
    ctx.fillStyle = "#ffffff66";
    ctx.font = "bold 8px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(e.kind === "sniper" ? "SNP" : e.kind === "mortar" ? "MRT" : "HEX", e.x, e.y + 3);
  }
}

function drawTurret(ctx: CanvasRenderingContext2D, t: TurretUnit): void {
  const def = TURRET_DEFS[t.kind];
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
  ctx.fillStyle = def.color;
  ctx.fill();
  ctx.strokeStyle = def.stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Barrel hint
  ctx.beginPath();
  ctx.moveTo(t.x, t.y);
  ctx.lineTo(t.x + t.radius + 6, t.y);
  ctx.strokeStyle = def.stroke;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#fff8";
  ctx.font = "bold 8px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(t.kind === "ballista" ? "BAL" : t.kind === "brazier" ? "AOE" : "HEX", t.x, t.y + 3);
}

function mixTint(a: string, b: string, t: number): string {
  return t > 0.3 ? b : a;
}

function drawFeedbackOverlay(ctx: CanvasRenderingContext2D, state: GameState): void {
  const settings = loadSettings();
  const fx = settings.damageScreenFx ?? "full";
  if (fx === "off" || settings.reduceMotion) {
    if (!state.hero.alive) {
      ctx.fillStyle = "rgba(8, 10, 18, 0.35)";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    return;
  }

  const mul = fx === "reduced" ? 0.35 : 1;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  const flash = Number.isFinite(state.damageFlash) ? Math.min(0.5, Math.max(0, state.damageFlash)) : 0;
  const vig = Number.isFinite(state.vignette) ? Math.min(0.8, Math.max(0, state.vignette)) : 0;

  if (flash > 0) {
    const a = Math.min(0.35, flash * 1.2) * mul;
    ctx.fillStyle = `rgba(180, 20, 30, ${a})`;
    ctx.fillRect(0, 0, w, h);
  }

  if (vig > 0) {
    const a = Math.min(0.55, vig * 1.1) * mul;
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(120, 0, 20, ${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  if (!state.hero.alive) {
    ctx.fillStyle = "rgba(8, 10, 18, 0.35)";
    ctx.fillRect(0, 0, w, h);
  }
}

export function draw(ctx: CanvasRenderingContext2D, state: GameState, view: View): void {
  const settings = loadSettings();
  const map = state.map;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  let shakeX = 0;
  let shakeY = 0;
  const fx = settings.damageScreenFx ?? "full";
  const shakeOk = settings.screenShake && !settings.reduceMotion && fx !== "off";
  const shakeAmt = Number.isFinite(state.shake) ? Math.min(0.45, Math.max(0, state.shake)) : 0;
  if (shakeAmt > 0 && shakeOk && !state.viewOpponentLane) {
    const amp = Math.min(10, 7 * (shakeAmt / 0.22) * (fx === "reduced" ? 0.4 : 1));
    shakeX = (Math.random() * 2 - 1) * amp;
    shakeY = (Math.random() * 2 - 1) * amp;
  }

  const origin = worldToScreen(view, 0, 0);
  ctx.save();
  ctx.translate(origin.x + shakeX, origin.y + shakeY);
  ctx.scale(view.scale, view.scale);

  if (state.viewOpponentLane) {
    drawOpponentLaneWorld(ctx, state);
    ctx.restore();
    drawFeedbackOverlay(ctx, state);
    return;
  }

  // Lane floor
  ctx.fillStyle = "#152038";
  ctx.fillRect(0, map.laneTop, MAP_W, map.laneBottom - map.laneTop);

  ctx.strokeStyle = "#2a3d60";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, map.laneTop);
  ctx.lineTo(MAP_W, map.laneTop);
  ctx.moveTo(0, map.laneBottom);
  ctx.lineTo(MAP_W, map.laneBottom);
  ctx.stroke();

  // High grounds
  for (const hg of map.highGrounds) {
    ctx.fillStyle = "#3d5a8822";
    ctx.strokeStyle = "#7eb0ff88";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.fillRect(hg.x, hg.y, hg.w, hg.h);
    ctx.strokeRect(hg.x, hg.y, hg.w, hg.h);
    ctx.setLineDash([]);
    ctx.fillStyle = "#9ec1ff99";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("HIGH GROUND", hg.x + 10, hg.y + 18);
  }

  // Obstacles / cover
  for (const o of map.obstacles) {
    ctx.fillStyle = "#1c2838";
    ctx.strokeStyle = "#4a6078";
    ctx.lineWidth = 2;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeRect(o.x, o.y, o.w, o.h);
  }

  const paintZones = (
    zones: { x: number; y: number; w: number; h: number }[] | undefined,
    fill: string,
    stroke: string,
    label: string,
  ) => {
    if (!zones?.length) return;
    for (const z of zones) {
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeRect(z.x, z.y, z.w, z.h);
      ctx.fillStyle = stroke;
      ctx.font = "10px Segoe UI, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, z.x + 4, z.y + 12);
    }
  };
  paintZones(map.healSprings, "#40e08022", "#60f0a0aa", "HEAL");
  paintZones(map.slowMires, "#8060c022", "#a080e0aa", "MIRE");
  paintZones(map.hastePads, "#e0c04022", "#f0d060aa", "HASTE");
  paintZones(map.goldVents, "#e0c02022", "#ffd040aa", "GOLD");
  paintZones(map.windCurrents, "#60c0e022", "#80d0f0aa", "WIND");
  for (const sp of map.spikePulses ?? []) {
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.radius || 36, 0, Math.PI * 2);
    ctx.fillStyle = "#ff505028";
    ctx.fill();
    ctx.strokeStyle = "#ff7070aa";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Moving hazard
  if (map.movingHazards) {
    const hx = state.mapHazardX;
    const hy = (map.laneTop + map.laneBottom) / 2;
    ctx.beginPath();
    ctx.arc(hx, hy, 42, 0, Math.PI * 2);
    ctx.fillStyle = "#ff404033";
    ctx.fill();
    ctx.strokeStyle = "#ff6060aa";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#ffb0b0";
    ctx.font = "bold 9px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("HAZARD", hx, hy + 3);
  }

  // Chests
  for (const c of state.chests) {
    const colors: Record<string, string> = {
      common: "#9ab0c8",
      uncommon: "#5ecf8a",
      rare: "#5a9cff",
      mythic: "#c86cff",
    };
    ctx.beginPath();
    ctx.rect(c.x - 14, c.y - 10, 28, 20);
    ctx.fillStyle = "#1a1420";
    ctx.fill();
    ctx.strokeStyle = colors[c.rarity] ?? "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    if (c.openProgress > 0) {
      ctx.fillStyle = "#ffe080";
      ctx.fillRect(c.x - 14, c.y + 12, 28 * Math.min(1, c.openProgress / c.openDuration), 4);
    }
    ctx.fillStyle = colors[c.rarity] ?? "#fff";
    ctx.font = "bold 8px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CHEST", c.x, c.y + 3);
  }

  // Shop pad
  const shop = map.shop;
  ctx.beginPath();
  ctx.arc(shop.x, shop.y, shop.radius, 0, Math.PI * 2);
  ctx.fillStyle = state.nearShop ? "#3a6b4a" : "#2a4a38";
  ctx.fill();
  ctx.strokeStyle = state.nearShop ? "#8dffb0" : "#6aaf7a";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#c8f5d4";
  ctx.font = "bold 11px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SHOP", shop.x, shop.y + 4);
  if (state.nearShop && !state.shopOpen) {
    ctx.fillStyle = "#e8ffe8";
    ctx.font = "10px Segoe UI, sans-serif";
    ctx.fillText("[F]", shop.x, shop.y + shop.radius + 14);
  }

  // Base
  const base = map.base;
  ctx.beginPath();
  ctx.arc(base.x, base.y, base.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#2f6fd0";
  ctx.fill();
  ctx.strokeStyle = "#8ec3ff";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#dfe7f5";
  ctx.font = "bold 11px Segoe UI, sans-serif";
  ctx.fillText(`BASE L${state.baseLevel}`, base.x, base.y + 4);

  // Spawner
  const spawner = map.spawner;
  ctx.beginPath();
  ctx.arc(spawner.x, spawner.y, spawner.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#5a2430";
  ctx.fill();
  ctx.strokeStyle = "#ff7a7a";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#ffc9c9";
  ctx.fillText("SPAWN", spawner.x, spawner.y + 4);

  // Turret slot ghosts
  for (const slot of map.turretSlots) {
    const occupied = state.turrets.some(
      (t) => t.alive && Math.hypot(t.x - slot.x, t.y - slot.y) < 8,
    );
    if (occupied) continue;
    ctx.beginPath();
    ctx.arc(slot.x, slot.y, 10, 0, Math.PI * 2);
    ctx.strokeStyle = "#5a6a8088";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // FX rings
  for (const f of state.fx) {
    const a = Math.max(0, f.life / f.maxLife);
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.radius * (1.15 - a * 0.15), 0, Math.PI * 2);
    ctx.strokeStyle = f.color;
    ctx.globalAlpha = a;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Beam
  if (state.beam) {
    ctx.strokeStyle = "#5ef0a8cc";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(state.beam.x1, state.beam.y1);
    ctx.lineTo(state.beam.x2, state.beam.y2);
    ctx.stroke();
  }

  // Hex DoT zones
  for (const z of state.hexZones) {
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#a060c822";
    ctx.fill();
    ctx.strokeStyle = "#c080ff55";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Warp teleporter pads
  const drawPad = (pad: { x: number; y: number } | null, label: string) => {
    if (!pad) return;
    ctx.beginPath();
    ctx.arc(pad.x, pad.y, 22, 0, Math.PI * 2);
    ctx.fillStyle = state.teleporters.linked ? "#48c8e833" : "#48c8e818";
    ctx.fill();
    ctx.strokeStyle = "#48c8e8cc";
    ctx.lineWidth = 2;
    ctx.setLineDash(state.teleporters.linked ? [] : [4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#a8f0ff";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, pad.x, pad.y + 3);
  };
  drawPad(state.teleporters.a, "A");
  drawPad(state.teleporters.b, "B");
  if (state.teleporters.linked && state.teleporters.a && state.teleporters.b) {
    ctx.beginPath();
    ctx.moveTo(state.teleporters.a.x, state.teleporters.a.y);
    ctx.lineTo(state.teleporters.b.x, state.teleporters.b.y);
    ctx.strokeStyle = "#48c8e844";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Turrets
  for (const t of state.turrets) {
    if (t.alive) drawTurret(ctx, t);
  }

  // Enemies
  for (const e of state.enemies) {
    drawEnemyShape(ctx, e);
  }

  // Heroes (primary + allies)
  const heroesToDraw = [state.hero, ...(state.allies ?? [])];
  for (const h of heroesToDraw) {
    const def = resolveHero(h.heroId);
    if (h.alive) {
      const heroGlow = inHighGround(state, h);
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      ctx.fillStyle =
        h === state.hero && state.hitFlash > 0 ? "#ffffff" : heroGlow ? def.glowColor : def.color;
      ctx.fill();
      ctx.strokeStyle = h === state.hero ? "#d8fbff" : "#ffffff88";
      ctx.lineWidth = h === state.hero ? 2 : 1.5;
      ctx.stroke();

      if (h.barrierTimer > 0) {
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffe08acc";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      if (h.whirlwindTimer > 0) {
        ctx.beginPath();
        ctx.arc(h.x, h.y, 72, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffb06055";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Gyro blade orbit VFX — close spinny death-ball, not distant orbs
      if (h.heroId === "gyro") {
        const mode = h.bladeMode ?? "wrapped";
        const spin = h.bladeSpin ?? 0;
        const ang = h.bladeAngle ?? 0;
        if (mode === "wrapped" || mode === "reforming") {
          const orbit = h.radius + 6 + spin * 10;
          const blades = 8;
          const reforming = mode === "reforming";
          for (let i = 0; i < blades; i++) {
            const a = ang + (i / blades) * Math.PI * 2;
            const bx = h.x + Math.cos(a) * orbit;
            const by = h.y + Math.sin(a) * orbit;
            // Blade-shaped wedge (tip outward)
            const tx = Math.cos(a);
            const ty = Math.sin(a);
            const px = -ty;
            const py = tx;
            const len = 9 + spin * 5;
            const half = 2.2;
            ctx.beginPath();
            ctx.moveTo(bx + tx * len * 0.55, by + ty * len * 0.55);
            ctx.lineTo(bx - tx * len * 0.35 + px * half, by - ty * len * 0.35 + py * half);
            ctx.lineTo(bx - tx * len * 0.35 - px * half, by - ty * len * 0.35 - py * half);
            ctx.closePath();
            ctx.fillStyle = reforming ? "#8899aa66" : `rgba(232,240,255,${0.75 + spin * 0.25})`;
            ctx.fill();
            ctx.strokeStyle = reforming ? "#66778855" : "#ffffffaa";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          if (spin > 0.12) {
            ctx.beginPath();
            ctx.arc(h.x, h.y, orbit + 4, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(200,210,230,${0.12 + spin * 0.28})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          // Charge ring while holding Blade Hook
          if (h.bladeHookCharging && (h.bladeHookCharge ?? 0) > 0.02) {
            const ch = h.bladeHookCharge ?? 0;
            ctx.beginPath();
            ctx.arc(h.x, h.y, h.radius + 14, -Math.PI / 2, -Math.PI / 2 + ch * Math.PI * 2);
            ctx.strokeStyle = `rgba(200,220,255,${0.45 + ch * 0.4})`;
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        } else {
          const tipX = h.bladeTipX ?? h.x;
          const tipY = h.bladeTipY ?? h.y;
          ctx.beginPath();
          ctx.moveTo(h.x, h.y);
          ctx.lineTo(tipX, tipY);
          ctx.strokeStyle = "#e8f0ffcc";
          ctx.lineWidth = 2.5;
          ctx.stroke();
          // Cluster of blades at the tip
          for (let i = 0; i < 5; i++) {
            const a = ang + (i / 5) * Math.PI * 2;
            const bx = tipX + Math.cos(a) * 7;
            const by = tipY + Math.sin(a) * 7;
            ctx.beginPath();
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(bx + Math.cos(a) * 6, by + Math.sin(a) * 6);
            ctx.strokeStyle = "#ffffffdd";
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      }

      if (h === state.hero && def.aimMode !== "free") {
        ctx.beginPath();
        ctx.arc(h.x, h.y, def.attackRange, 0, Math.PI * 2);
        ctx.strokeStyle = def.aimMode === "auto" ? "#5ef0a828" : "#ffffff18";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffffff44";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Projectiles
  for (const p of state.projectiles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color ?? "#ffcc55";
    ctx.fill();
  }

  if (state.mapFogActive) {
    ctx.fillStyle = "rgba(8, 10, 20, 0.55)";
    ctx.fillRect(0, map.laneTop, MAP_W, map.laneBottom - map.laneTop);
    // Keep a small clear radius around the hero
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(state.hero.x, state.hero.y, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();

  if (state.hero.alive) {
    drawHpBar(ctx, view, state.hero.x, state.hero.y, state.hero.radius, state.hero.hp, state.hero.maxHp);
  }
  for (const h of state.allies ?? []) {
    if (h.alive) drawHpBar(ctx, view, h.x, h.y, h.radius, h.hp, h.maxHp);
  }
  for (const e of state.enemies) {
    drawHpBar(ctx, view, e.x, e.y, e.radius, e.hp, e.maxHp);
  }
  for (const t of state.turrets) {
    if (t.alive) drawHpBar(ctx, view, t.x, t.y, t.radius, t.hp, t.maxHp);
  }
  drawHpBar(ctx, view, base.x, base.y, base.radius, state.baseHp, base.maxHp);

  // Wave / boss banner is HTML (#wave-banner) above the send menu — keep canvas clear.
  drawFeedbackOverlay(ctx, state);
}

function drawOpponentLaneWorld(ctx: CanvasRenderingContext2D, state: GameState): void {
  const map = state.map;
  const opp = state.opponent;

  ctx.fillStyle = "#1a1428";
  ctx.fillRect(0, map.laneTop, MAP_W, map.laneBottom - map.laneTop);

  ctx.strokeStyle = "#4a3560";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, map.laneTop);
  ctx.lineTo(MAP_W, map.laneTop);
  ctx.moveTo(0, map.laneBottom);
  ctx.lineTo(MAP_W, map.laneBottom);
  ctx.stroke();

  for (const hg of map.highGrounds) {
    ctx.fillStyle = "#5a3d8822";
    ctx.strokeStyle = "#b08fff66";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.fillRect(hg.x, hg.y, hg.w, hg.h);
    ctx.strokeRect(hg.x, hg.y, hg.w, hg.h);
    ctx.setLineDash([]);
  }

  for (const o of map.obstacles) {
    ctx.fillStyle = "#241828";
    ctx.strokeStyle = "#6a5078";
    ctx.lineWidth = 2;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeRect(o.x, o.y, o.w, o.h);
  }

  // Opponent base (same pad)
  const base = map.base;
  ctx.beginPath();
  ctx.arc(base.x, base.y, base.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#6a2f90";
  ctx.fill();
  ctx.strokeStyle = "#d0a0ff";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#f0e0ff";
  ctx.font = "bold 11px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`ENEMY BASE`, base.x, base.y + 4);

  ctx.beginPath();
  ctx.arc(map.spawner.x, map.spawner.y, map.spawner.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#3a2040";
  ctx.fill();
  ctx.strokeStyle = "#c070ff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#e8c8ff";
  ctx.fillText("SPAWN", map.spawner.x, map.spawner.y + 4);

  for (const e of opp.vizEnemies) {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fillStyle = e.sent ? "#a34bd4" : e.color;
    ctx.fill();
    ctx.strokeStyle = "#fff6";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(opp.vizHeroX, opp.vizHeroY, 16, 0, Math.PI * 2);
  ctx.fillStyle = opp.color;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px Segoe UI, sans-serif";
  ctx.fillText(opp.name, opp.vizHeroX, opp.vizHeroY - 24);

  ctx.fillStyle = "#c8b0e8aa";
  ctx.font = "bold 14px Segoe UI, sans-serif";
  ctx.fillText("ENEMY LANE", MAP_W / 2, map.laneTop + 22);
}
