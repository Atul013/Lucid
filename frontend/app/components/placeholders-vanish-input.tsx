"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Particle = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  alpha: number;
};

export function PlaceholdersVanishInput({
  placeholders,
  value,
  onChange,
  onSubmit,
}: {
  placeholders: string[];
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
}) {
  const [phIdx, setPhIdx] = useState(0);
  const [animating, setAnimating] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const particles = useRef<Particle[]>([]);
  const rafId = useRef<number | null>(null);
  const intervalId = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cycle placeholders when the field is empty
  useEffect(() => {
    if (value) {
      if (intervalId.current) clearInterval(intervalId.current);
      return;
    }
    intervalId.current = setInterval(() => {
      setPhIdx((i) => (i + 1) % placeholders.length);
    }, 3200);
    return () => { if (intervalId.current) clearInterval(intervalId.current); };
  }, [value, placeholders.length]);

  const startVanish = useCallback(() => {
    const canvas = canvasRef.current;
    const input = inputRef.current;
    if (!canvas || !input || !value.trim() || animating) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = input.offsetWidth;
    const h = input.offsetHeight;
    canvas.width = w;
    canvas.height = h;

    // Render input text to canvas at matching position
    ctx.clearRect(0, 0, w, h);
    const computed = getComputedStyle(input);
    ctx.font = `${computed.fontSize} ${computed.fontFamily}`;
    ctx.fillStyle = "#f5e6d3"; // --color-ink approx
    ctx.textBaseline = "middle";
    ctx.fillText(value, 16, h / 2);

    const { data } = ctx.getImageData(0, 0, w, h);
    particles.current = [];
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        if (data[(y * w + x) * 4 + 3] > 80) {
          particles.current.push({
            x, y,
            r: Math.random() * 1.5 + 0.4,
            vx: (Math.random() - 0.5) * 3.5,
            vy: -(Math.random() * 2.5 + 0.5),
            alpha: 1,
          });
        }
      }
    }

    setAnimating(true);
    onSubmit();

    function frame() {
      if (!canvas) return;
      const c = canvas.getContext("2d");
      if (!c) return;
      c.clearRect(0, 0, canvas.width, canvas.height);
      particles.current = particles.current.filter((p) => p.alpha > 0.02);

      for (const p of particles.current) {
        p.alpha *= 0.88;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fillStyle = `rgba(255,125,60,${p.alpha})`;
        c.fill();
      }

      if (particles.current.length > 0) {
        rafId.current = requestAnimationFrame(frame);
      } else {
        setAnimating(false);
      }
    }

    rafId.current = requestAnimationFrame(frame);
  }, [value, animating, onSubmit]);

  useEffect(() => () => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
  }, []);

  return (
    <div className="relative h-11 w-full overflow-hidden rounded-[calc(0.5rem-1px)] bg-surface-2">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />

      {/* Cycling placeholder */}
      {!value && (
        <div className="pointer-events-none absolute inset-0 flex items-center px-4 pr-12">
          <AnimatePresence mode="wait">
            <motion.span
              key={phIdx}
              initial={{ y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -6, opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="block truncate text-[0.9rem] text-faint"
            >
              {placeholders[phIdx]}
            </motion.span>
          </AnimatePresence>
        </div>
      )}

      <input
        ref={inputRef}
        value={value}
        onChange={onChange}
        onKeyDown={(e) => { if (e.key === "Enter") startVanish(); }}
        className={`absolute inset-0 h-full w-full bg-transparent px-4 pr-12 text-[0.9rem] focus:outline-none ${
          animating ? "text-transparent caret-transparent" : "text-ink"
        }`}
      />

      {/* Submit arrow */}
      <button
        type="button"
        onClick={startVanish}
        disabled={!value.trim() || animating}
        className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-md bg-accent/90 text-paper transition-colors hover:bg-accent disabled:opacity-30"
        aria-label="Add todo"
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 10h12M11 5l5 5-5 5" />
        </svg>
      </button>
    </div>
  );
}
