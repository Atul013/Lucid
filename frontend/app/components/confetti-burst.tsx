"use client";

import { useEffect, useRef } from "react";

const COLORS = [
  "#ff7d3c", "#ffa169", "#ffc83c", "#ffedd5",
  "#f4ede2", "#e8d5b7", "#cc5522", "#ffb347",
];

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  rot: number; rotV: number;
  color: string;
  w: number; h: number;
  life: number; maxLife: number;
}

export function ConfettiBurst({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const s = useRef<{ particles: Particle[]; raf: number; fired: boolean }>({
    particles: [],
    raf: 0,
    fired: false,
  });

  useEffect(() => {
    if (!active) {
      s.current.fired = false;
      cancelAnimationFrame(s.current.raf);
      s.current.particles = [];
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    if (s.current.fired) return;
    s.current.fired = true;

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const cx = window.innerWidth * 0.5;
    const cy = window.innerHeight * 0.28;

    s.current.particles = Array.from({ length: 110 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 11;
      return {
        x: cx + (Math.random() - 0.5) * 100,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 9,
        rot: Math.random() * 360,
        rotV: (Math.random() - 0.5) * 11,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        w: 6 + Math.random() * 8,
        h: 3 + Math.random() * 5,
        life: 0,
        maxLife: 85 + Math.random() * 65,
      };
    });

    const ctx = canvas.getContext("2d")!;

    function draw() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      s.current.particles = s.current.particles.filter((p) => p.life < p.maxLife);

      for (const p of s.current.particles) {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.27;
        p.vx *= 0.985;
        p.rot += p.rotV;

        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (s.current.particles.length > 0) {
        s.current.raf = requestAnimationFrame(draw);
      }
    }

    s.current.raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(s.current.raf);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 9997 }}
    />
  );
}
