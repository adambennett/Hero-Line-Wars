/**
 * Lightweight particle field for the main menu backdrop.
 */

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  tw: number;
};

export class MainMenuFx {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private particles: Particle[] = [];
  private t0 = 0;
  private running = false;

  start(canvas: HTMLCanvasElement): void {
    this.stop();
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    if (!this.ctx) return;
    this.running = true;
    this.t0 = performance.now();
    this.resize();
    this.spawn(Math.floor((canvas.width * canvas.height) / 18000));
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
  }

  private onResize = (): void => this.resize();

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
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 18,
        vy: -12 - Math.random() * 28,
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
    ctx.clearRect(0, 0, w, h);

    // Soft drifting ribbons
    for (let i = 0; i < 3; i++) {
      const y = h * (0.35 + i * 0.18) + Math.sin(t * 0.35 + i * 1.7) * 28;
      const grad = ctx.createLinearGradient(0, y - 40, w, y + 40);
      grad.addColorStop(0, "rgba(60,120,200,0)");
      grad.addColorStop(0.5, `rgba(${80 + i * 30},${150 - i * 20},${220 - i * 40},${0.06 + i * 0.02})`);
      grad.addColorStop(1, "rgba(60,200,180,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 24) {
        const yy = y + Math.sin(x * 0.008 + t * 0.8 + i) * (16 + i * 6);
        ctx.lineTo(x, yy);
      }
      ctx.lineTo(w, y + 50);
      ctx.lineTo(0, y + 50);
      ctx.closePath();
      ctx.fill();
    }

    for (const p of this.particles) {
      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;
      p.tw += 0.04;
      if (p.y < -10) {
        p.y = h + 10;
        p.x = Math.random() * w;
      }
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      const pulse = 0.55 + 0.45 * Math.sin(p.tw + t);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 220, 255, ${p.a * pulse})`;
      ctx.fill();
    }
  }
}
