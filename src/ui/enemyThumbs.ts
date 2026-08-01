/** Canvas portraits for Compendium enemies — matches in-game shapes/colors. */

import { ENEMY_DEFS, isBossKind, isEliteKind, type EnemyKind } from "../data/enemies";

function drawShape(
  ctx: CanvasRenderingContext2D,
  kind: EnemyKind,
  cx: number,
  cy: number,
  r: number,
): void {
  const def = ENEMY_DEFS[kind];
  ctx.fillStyle = def.color;
  ctx.strokeStyle = def.stroke;
  ctx.lineWidth = isBossKind(kind) || isEliteKind(kind) ? 3 : 2;
  ctx.beginPath();
  switch (def.shape) {
    case "diamond":
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      break;
    case "triangle":
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.95, cy + r * 0.75);
      ctx.lineTo(cx - r * 0.95, cy + r * 0.75);
      ctx.closePath();
      break;
    case "square":
      ctx.rect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
      break;
    case "star": {
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case "hex": {
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    default:
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      break;
  }
  ctx.fill();
  ctx.stroke();
}

/** Paint every `[data-enemy]` canvas under `root`. */
export function paintEnemyThumbs(root: ParentNode): void {
  const canvases = root.querySelectorAll<HTMLCanvasElement>("canvas[data-enemy]");
  for (const canvas of canvases) {
    const kind = canvas.dataset.enemy as EnemyKind | undefined;
    if (!kind || !ENEMY_DEFS[kind]) continue;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    const w = (canvas.width = 72);
    const h = (canvas.height = 72);
    ctx.clearRect(0, 0, w, h);

    const g = ctx.createRadialGradient(w * 0.45, h * 0.4, 4, w * 0.5, h * 0.55, 40);
    g.addColorStop(0, "#1a2740");
    g.addColorStop(1, "#0a0f1a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Soft ground ellipse
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.72, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    const def = ENEMY_DEFS[kind];
    const r = Math.min(22, def.radius * 1.35);
    drawShape(ctx, kind, w / 2, h * 0.46, r);

    if (isBossKind(kind) || isEliteKind(kind)) {
      ctx.fillStyle = "rgba(255,248,220,0.85)";
      ctx.font = "bold 9px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(isBossKind(kind) ? "BOSS" : "ELITE", w / 2, h - 8);
    }
  }
}
