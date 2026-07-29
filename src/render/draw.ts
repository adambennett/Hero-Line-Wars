import { MAP_H, MAP_W } from "../data/constants";
import { ENEMY_DEFS, waveTierLabel } from "../data/enemies";
import { HEROES } from "../data/heroes";
import { TURRET_DEFS } from "../data/turrets";
import { heroOnHighGround, type EnemyUnit, type GameState, type TurretUnit } from "../game/state";
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
  ctx.lineWidth = e.kind === "boss" || e.kind === "elite" ? 3 : 2;

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

  if (e.kind === "boss" || e.kind === "elite") {
    ctx.fillStyle = "#fff8";
    ctx.font = "bold 9px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(e.kind === "boss" ? "BOSS" : "ELITE", e.x, e.y + 3);
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
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  if (state.damageFlash > 0 && !settings.reduceMotion) {
    const a = Math.min(0.35, state.damageFlash * 1.2);
    ctx.fillStyle = `rgba(180, 20, 30, ${a})`;
    ctx.fillRect(0, 0, w, h);
  }

  if (state.vignette > 0) {
    const a = Math.min(0.55, state.vignette * 1.1);
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
  if (state.shake > 0 && settings.screenShake && !settings.reduceMotion) {
    const amp = 7 * (state.shake / 0.22);
    shakeX = (Math.random() * 2 - 1) * amp;
    shakeY = (Math.random() * 2 - 1) * amp;
  }

  const origin = worldToScreen(view, 0, 0);
  ctx.save();
  ctx.translate(origin.x + shakeX, origin.y + shakeY);
  ctx.scale(view.scale, view.scale);

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

  // Turrets
  for (const t of state.turrets) {
    if (t.alive) drawTurret(ctx, t);
  }

  // Enemies
  for (const e of state.enemies) {
    drawEnemyShape(ctx, e);
  }

  // Hero
  if (state.hero.alive) {
    const def = HEROES[state.hero.heroId];
    const heroGlow = heroOnHighGround(state);
    ctx.beginPath();
    ctx.arc(state.hero.x, state.hero.y, state.hero.radius, 0, Math.PI * 2);
    ctx.fillStyle =
      state.hitFlash > 0 ? "#ffffff" : heroGlow ? def.glowColor : def.color;
    ctx.fill();
    ctx.strokeStyle = "#d8fbff";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (state.hero.barrierTimer > 0) {
      ctx.beginPath();
      ctx.arc(state.hero.x, state.hero.y, state.hero.radius + 8, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffe08acc";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    if (state.hero.whirlwindTimer > 0) {
      ctx.beginPath();
      ctx.arc(state.hero.x, state.hero.y, 72, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffb06055";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.arc(state.hero.x, state.hero.y, def.attackRange, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff18";
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(state.hero.x, state.hero.y, state.hero.radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff44";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Projectiles
  for (const p of state.projectiles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color ?? "#ffcc55";
    ctx.fill();
  }

  ctx.restore();

  if (state.hero.alive) {
    drawHpBar(ctx, view, state.hero.x, state.hero.y, state.hero.radius, state.hero.hp, state.hero.maxHp);
  }
  for (const e of state.enemies) {
    drawHpBar(ctx, view, e.x, e.y, e.radius, e.hp, e.maxHp);
  }
  for (const t of state.turrets) {
    if (t.alive) drawHpBar(ctx, view, t.x, t.y, t.radius, t.hp, t.maxHp);
  }
  drawHpBar(ctx, view, base.x, base.y, base.radius, state.baseHp, base.maxHp);

  // Wave banner drawn above the playfield (XP bar sits just above lane)
  const banner = waveTierLabel(state.waveTier);
  if (banner && (state.spawning || state.enemies.length > 0)) {
    ctx.save();
    ctx.font = "bold 26px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = state.waveTier === "boss" ? "#ff6a4a" : "#d090ff";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 10;
    const bannerY = Math.max(36, view.offsetY - 48);
    ctx.fillText(banner, ctx.canvas.width / 2, bannerY);
    ctx.restore();
  }

  drawFeedbackOverlay(ctx, state);
}
