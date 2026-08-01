/**
 * Lightweight particle / ribbon field for menu backdrops.
 * Variation A = main title; B = submenus (warmer ember drift).
 */

export type MenuFxVariation = "main" | "sub";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  tw: number;
};

const PALETTE = {
  main: {
    ribbon: (i: number, a: number) =>
      `rgba(${80 + i * 30},${150 - i * 20},${220 - i * 40},${a})`,
    ribbonEnds: "rgba(60,120,200,0)" as const,
    ribbonEndAlt: "rgba(60,200,180,0)" as const,
    particle: (a: number) => `rgba(180, 220, 255, ${a})`,
  },
  sub: {
    ribbon: (i: number, a: number) =>
      `rgba(${200 - i * 20},${120 + i * 15},${70 + i * 25},${a})`,
    ribbonEnds: "rgba(180,90,40,0)" as const,
    ribbonEndAlt: "rgba(40,160,140,0)" as const,
    particle: (a: number) => `rgba(255, 210, 150, ${a})`,
  },
} as const;

export class MainMenuFx {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private particles: Particle[] = [];
  private t0 = 0;
  private running = false;
  private variation: MenuFxVariation = "main";
  private reduceMotion = false;
  private staticDrawn = false;

  start(
    canvas: HTMLCanvasElement,
    opts?: { variation?: MenuFxVariation; reduceMotion?: boolean },
  ): void {
    this.stop();
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    if (!this.ctx) return;
    this.variation = opts?.variation ?? "main";
    this.reduceMotion = !!opts?.reduceMotion;
    this.running = true;
    this.t0 = performance.now();
    this.staticDrawn = false;
    this.resize();
    this.spawn(Math.floor((canvas.width * canvas.height) / 18000));

    if (this.reduceMotion) {
      this.tick(0);
      this.staticDrawn = true;
      window.addEventListener("resize", this.onResize);
      return;
    }

    const loop = (now: number) => {
      if (!this.running) return;
      this.tick((now - this.t0) / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    window.addEventListener("resize", this.onResize);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.removeEventListener("resize", this.onResize);
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.staticDrawn = false;
  }

  private onResize = (): void => {
    this.resize();
    if (this.reduceMotion) {
      this.tick(0);
      this.staticDrawn = true;
    } else if (this.canvas) {
      this.spawn(Math.floor((this.canvas.width * this.canvas.height) / 18000));
    }
  };

  private resize(): void {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private spawn(n: number): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.particles = [];
    const upward = this.variation === "main";
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * (upward ? 18 : 22),
        vy: upward ? -12 - Math.random() * 28 : (Math.random() - 0.5) * 20,
        r: 1 + Math.random() * 2.2,
        a: 0.15 + Math.random() * 0.55,
        tw: Math.random() * Math.PI * 2,
      });
    }
  }

  private tick(t: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pal = PALETTE[this.variation];
    ctx.clearRect(0, 0, w, h);

    const ribbonCount = this.variation === "main" ? 3 : 4;
    for (let i = 0; i < ribbonCount; i++) {
      const baseY =
        this.variation === "main"
          ? h * (0.35 + i * 0.18)
          : h * (0.22 + i * 0.16);
      const y = baseY + Math.sin(t * 0.35 + i * 1.7) * (this.reduceMotion ? 0 : 28);
      const grad = ctx.createLinearGradient(0, y - 40, w, y + 40);
      grad.addColorStop(0, pal.ribbonEnds);
      grad.addColorStop(0.5, pal.ribbon(i, 0.06 + i * 0.02));
      grad.addColorStop(1, pal.ribbonEndAlt);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 24) {
        const amp = this.reduceMotion ? 0 : 16 + i * 6;
        const phase = this.variation === "sub" ? x * 0.011 + t * 0.55 + i * 1.3 : x * 0.008 + t * 0.8 + i;
        const yy = y + Math.sin(phase) * amp;
        ctx.lineTo(x, yy);
      }
      ctx.lineTo(w, y + 50);
      ctx.lineTo(0, y + 50);
      ctx.closePath();
      ctx.fill();
    }

    if (this.variation === "sub" && !this.reduceMotion) {
      // Soft diagonal shard accents — submenu tell
      for (let i = 0; i < 5; i++) {
        const x0 = ((t * 12 + i * 140) % (w + 80)) - 40;
        ctx.strokeStyle = `rgba(255, 180, 100, ${0.04 + (i % 3) * 0.015})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x0, 0);
        ctx.lineTo(x0 + h * 0.35, h);
        ctx.stroke();
      }
    }

    for (const p of this.particles) {
      if (!this.reduceMotion) {
        p.x += p.vx * 0.016;
        p.y += p.vy * 0.016;
        p.tw += 0.04;
        if (this.variation === "main") {
          if (p.y < -10) {
            p.y = h + 10;
            p.x = Math.random() * w;
          }
        } else {
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
          if (p.y < -10) p.y = h + 10;
          if (p.y > h + 10) p.y = -10;
        }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
      }
      const pulse = this.reduceMotion ? 0.7 : 0.55 + 0.45 * Math.sin(p.tw + t);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = pal.particle(p.a * pulse);
      ctx.fill();
    }

    void this.staticDrawn;
  }
}
