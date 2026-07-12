"use client";

import { useEffect, useRef } from "react";

interface RainDrop {
  x: number;
  y: number;
  r: number;
  speed: number;
  opacity: number;
  sway: number;
  swayPhase: number;
  trail: Array<{ x: number; y: number }>;
}

export function GlassRain({ active = true }: { active?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    const drops: RainDrop[] = [];

    // Arrow consts, not function declarations: declarations are hoisted, so TS
    // can't see that the null-guards above already ran and treats `canvas`/`ctx`
    // as possibly-null inside them. Arrows are created after the guards, which
    // keeps the narrowing — and lets us drop the `!` assertions.
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    const W = () => canvas.width;
    const H = () => canvas.height;

    const spawn = (): RainDrop => {
      const r = 3 + Math.random() * 9;
      return {
        x: Math.random() * W(),
        y: -r * 3,
        r,
        speed: 0.4 + (r / 10) * 2.2 + Math.random() * 1.2,
        opacity: 0.45 + Math.random() * 0.35,
        sway: 0.15 + Math.random() * 0.35,
        swayPhase: Math.random() * Math.PI * 2,
        trail: [],
      };
    };

    // seed so the glass looks already wet
    for (let i = 0; i < 14; i++) {
      const d = spawn();
      d.y = Math.random() * H();
      drops.push(d);
    }

    let spawnTimer = 0;

    const tick = () => {
      ctx.clearRect(0, 0, W(), H());

      spawnTimer++;
      if (spawnTimer > 35 && drops.length < 28) {
        drops.push(spawn());
        spawnTimer = 0;
      }

      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];

        // physics
        d.y += d.speed;
        d.x += Math.sin(d.y / 28 + d.swayPhase) * d.sway;
        d.trail.push({ x: d.x, y: d.y - d.r * 0.9 });
        if (d.trail.length > 10) d.trail.shift();

        if (d.y > H() + d.r * 3) {
          drops.splice(i, 1);
          continue;
        }

        // trail — thin water streak
        if (d.trail.length > 2) {
          ctx.beginPath();
          ctx.moveTo(d.trail[0].x, d.trail[0].y);
          for (let j = 1; j < d.trail.length; j++) {
            ctx.lineTo(d.trail[j].x, d.trail[j].y);
          }
          ctx.strokeStyle = `rgba(255,255,255,${d.opacity * 0.10})`;
          ctx.lineWidth = d.r * 0.7;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.stroke();
        }

        // droplet body — radial gradient simulating refraction
        const gx = d.x - d.r * 0.28;
        const gy = d.y - d.r * 0.38;
        const grad = ctx.createRadialGradient(gx, gy, d.r * 0.05, d.x, d.y + d.r * 0.1, d.r * 1.1);
        grad.addColorStop(0,   `rgba(255,255,255,${d.opacity * 0.88})`);
        grad.addColorStop(0.35,`rgba(255,255,255,${d.opacity * 0.45})`);
        grad.addColorStop(0.7, `rgba(255,255,255,${d.opacity * 0.18})`);
        grad.addColorStop(1,   `rgba(255,255,255,0)`);

        ctx.beginPath();
        // slightly taller than wide (teardrop-ish)
        ctx.ellipse(d.x, d.y, d.r * 0.72, d.r, 0, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // specular highlight — small bright spot upper-left
        ctx.beginPath();
        ctx.ellipse(
          d.x - d.r * 0.22,
          d.y - d.r * 0.28,
          d.r * 0.22,
          d.r * 0.16,
          -0.4,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = `rgba(255,255,255,${d.opacity * 0.55})`;
        ctx.fill();

        // bottom rim — subtle dark crescent for depth
        ctx.beginPath();
        ctx.ellipse(d.x, d.y + d.r * 0.55, d.r * 0.5, d.r * 0.22, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,0,0,${d.opacity * 0.08})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(tick);
    };

    tick();

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 h-full w-full rounded-2xl"
      style={{ mixBlendMode: "screen", opacity: active ? 1 : 0.35 }}
    />
  );
}
