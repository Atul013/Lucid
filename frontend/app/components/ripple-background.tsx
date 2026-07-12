"use client";

import React, { useEffect, useRef } from "react";

const CELL = 52;
const GLOW_RADIUS = 5;
const GLOW_PEAK = 0.13;
const BORDER_ALPHA = 0.07;

export const RippleBackground = React.memo(function RippleBackground({
  className = "",
}: {
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    type Wave = { cx: number; cy: number; t: number; maxT: number };

    const s = {
      cursor: null as { x: number; y: number } | null,
      lastCursor: null as { x: number; y: number } | null,
      glow: 0,
      rafId: 0,
      waves: [] as Wave[],
    };

    function resize() {
      canvas!.width = canvas!.offsetWidth;
      canvas!.height = canvas!.offsetHeight;
    }

    function drawGrid(ctx: CanvasRenderingContext2D) {
      const w = canvas!.width;
      const h = canvas!.height;
      const cols = Math.ceil(w / CELL) + 1;
      const rows = Math.ceil(h / CELL) + 1;
      const cur = s.cursor ?? s.lastCursor;

      ctx.clearRect(0, 0, w, h);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * CELL;
          const y = r * CELL;
          const cx = x + CELL / 2;
          const cy = y + CELL / 2;

          // Grid border
          ctx.strokeStyle = `rgba(255,125,60,${BORDER_ALPHA})`;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);

          // Hover glow
          if (cur && s.glow > 0.005) {
            const dist =
              Math.sqrt((cx - cur.x) ** 2 + (cy - cur.y) ** 2) / CELL;
            if (dist < GLOW_RADIUS) {
              const alpha =
                s.glow *
                Math.max(0, GLOW_PEAK - dist * (GLOW_PEAK / GLOW_RADIUS));
              ctx.fillStyle = `rgba(255,125,60,${alpha.toFixed(3)})`;
              ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
            }
          }

          // Click wave ripple — expands to fill the full viewport
          let waveAlpha = 0;
          for (const wave of s.waves) {
            const dist =
              Math.sqrt((cx - wave.cx) ** 2 + (cy - wave.cy) ** 2) / CELL;
            const progress = wave.t / wave.maxT;
            const front = progress * 32; // expands to ~32 cells (covers full diagonal)
            const diff = Math.abs(dist - front);
            if (diff < 2) {
              const fadeIn = Math.min(1, progress * 8);
              const fadeOut = Math.pow(1 - progress, 0.6);
              waveAlpha += 0.35 * (1 - diff / 2) * fadeIn * fadeOut;
            }
          }
          if (waveAlpha > 0.005) {
            ctx.fillStyle = `rgba(255,125,60,${Math.min(0.38, waveAlpha).toFixed(3)})`;
            ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
          }
        }
      }
    }

    function frame() {
      const ctx = canvas!.getContext("2d");
      if (!ctx) return;

      if (s.cursor) s.glow = Math.min(1, s.glow + 0.1);
      else s.glow = Math.max(0, s.glow - 0.05);

      s.waves.forEach((w) => w.t++);
      s.waves = s.waves.filter((w) => w.t < w.maxT);

      drawGrid(ctx);

      const active = s.glow > 0.005 || s.cursor || s.waves.length > 0;
      if (active) {
        s.rafId = requestAnimationFrame(frame);
      } else {
        s.rafId = 0;
        drawGrid(ctx);
      }
    }

    function startRaf() {
      if (!s.rafId) s.rafId = requestAnimationFrame(frame);
    }

    function onMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      s.cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      s.lastCursor = s.cursor;
      startRaf();
    }

    function onLeave() {
      s.cursor = null;
      startRaf();
    }

    function onClick(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      s.waves.push({
        cx: e.clientX - rect.left,
        cy: e.clientY - rect.top,
        t: 0,
        maxT: 90,
      });
      startRaf();
    }

    const ro = new ResizeObserver(() => {
      resize();
      const ctx = canvas!.getContext("2d");
      if (ctx) drawGrid(ctx);
    });
    ro.observe(canvas);
    resize();

    const ctx0 = canvas.getContext("2d");
    if (ctx0) drawGrid(ctx0);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    window.addEventListener("click", onClick);

    return () => {
      ro.disconnect();
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("click", onClick);
      if (s.rafId) cancelAnimationFrame(s.rafId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none fixed inset-0 h-full w-full ${className}`}
      style={{ zIndex: 2 }}
    />
  );
});
