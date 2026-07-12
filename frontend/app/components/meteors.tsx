"use client";

import { useEffect, useRef, ReactNode } from "react";

// Canvas-based meteors — immune to prefers-reduced-motion
// (CSS animations are killed by the globals.css reduced-motion block)

interface Meteor {
  x: number;
  y: number;
  speed: number;
  trail: number;
  opacity: number;
  life: number; // 0..1
  delay: number; // frames until active
}

function createMeteor(w: number, h: number): Meteor {
  // Start along the top edge or left edge so they travel into view
  const fromTop = Math.random() > 0.3;
  return {
    x: fromTop ? Math.random() * w * 1.5 - w * 0.3 : -10,
    y: fromTop ? -10 : Math.random() * h * 0.5,
    speed: 2.5 + Math.random() * 4,
    trail: 40 + Math.random() * 60,
    opacity: 0.6 + Math.random() * 0.4,
    life: 0,
    delay: Math.floor(Math.random() * 120),
  };
}

// Meteors travel at ~35° below horizontal (matching the CSS rotate(215deg) translateX(-500px) direction)
const ANGLE_RAD = (35 * Math.PI) / 180;
const DX = Math.cos(ANGLE_RAD);
const DY = Math.sin(ANGLE_RAD);

export function Meteors({ number = 20 }: { number?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId: number;
    let meteors: Meteor[] = [];
    let frame = 0;

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
      // Re-seed meteors on resize
      meteors = Array.from({ length: number }, () =>
        createMeteor(canvas.width, canvas.height),
      );
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const render = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < meteors.length; i++) {
        const m = meteors[i];

        if (m.delay > 0) {
          m.delay--;
          continue;
        }

        // Advance position
        m.x += m.speed * DX;
        m.y += m.speed * DY;
        m.life += m.speed / 800;

        // Fade out over lifetime
        const fade =
          m.life < 0.15
            ? m.life / 0.15
            : m.life > 0.75
              ? 1 - (m.life - 0.75) / 0.25
              : 1;

        const alpha = m.opacity * fade;

        // Draw trail
        const tx = m.x - m.trail * DX;
        const ty = m.y - m.trail * DY;

        const grad = ctx.createLinearGradient(tx, ty, m.x, m.y);
        grad.addColorStop(0, `rgba(255,161,105,0)`);
        grad.addColorStop(0.5, `rgba(255,125,60,${alpha * 0.6})`);
        grad.addColorStop(1, `rgba(255,125,60,${alpha})`);

        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(m.x, m.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw head dot
        ctx.beginPath();
        ctx.arc(m.x, m.y, 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,200,150,${alpha})`;
        ctx.fill();

        // Respawn when off-screen or life expired
        if (
          m.life > 1 ||
          m.x > canvas.width + 50 ||
          m.y > canvas.height + 50
        ) {
          meteors[i] = createMeteor(canvas.width, canvas.height);
          // Stagger respawn so they don't all fire simultaneously
          meteors[i].delay = Math.floor(Math.random() * 80);
        }
      }

      frame++;
      rafId = requestAnimationFrame(render);
    };

    render();
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [number]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

export function CometCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-line bg-surface ${className}`}
    >
      <Meteors number={14} />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
