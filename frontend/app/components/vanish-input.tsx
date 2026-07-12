"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";

export interface VanishInputHandle {
  setValue: (v: string) => void;
}

export const VanishInput = forwardRef<
  VanishInputHandle,
  {
    placeholders: string[];
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSubmit: (value: string) => void;
  }
>(function VanishInput({ placeholders, onChange, onSubmit }, ref) {
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAnimation = () => {
    intervalRef.current = setInterval(() => {
      setCurrentPlaceholder((prev) => (prev + 1) % placeholders.length);
    }, 3000);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState !== "visible" && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    } else if (document.visibilityState === "visible") {
      startAnimation();
    }
  };

  useEffect(() => {
    startAnimation();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [placeholders]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const newDataRef = useRef<{ x: number; y: number; r: number; color: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [animating, setAnimating] = useState(false);

  useImperativeHandle(ref, () => ({
    setValue: (v: string) => setValue(v),
  }));

  const draw = useCallback(() => {
    if (!inputRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 800;
    ctx.clearRect(0, 0, 800, 800);

    const computedStyles = getComputedStyle(inputRef.current);
    const fontSize = parseFloat(computedStyles.getPropertyValue("font-size"));
    ctx.font = `${fontSize * 2}px ${computedStyles.fontFamily}`;
    ctx.fillStyle = "#f4ede2"; // --color-ink
    ctx.fillText(value, 16, 40);

    const imageData = ctx.getImageData(0, 0, 800, 800);
    const pixelData = imageData.data;
    const newData: { x: number; y: number; r: number; color: string }[] = [];

    for (let t = 0; t < 800; t++) {
      const i = 4 * t * 800;
      for (let n = 0; n < 800; n++) {
        const e = i + 4 * n;
        if (pixelData[e] !== 0 && pixelData[e + 1] !== 0 && pixelData[e + 2] !== 0) {
          newData.push({
            x: n,
            y: t,
            r: 1,
            color: `rgba(${pixelData[e]}, ${pixelData[e + 1]}, ${pixelData[e + 2]}, ${pixelData[e + 3]})`,
          });
        }
      }
    }

    newDataRef.current = newData;
  }, [value]);

  useEffect(() => {
    draw();
  }, [value, draw]);

  const animate = (start: number) => {
    const animateFrame = (pos: number = 0) => {
      requestAnimationFrame(() => {
        const newArr = [];
        for (let i = 0; i < newDataRef.current.length; i++) {
          const current = newDataRef.current[i];
          if (current.x < pos) {
            newArr.push(current);
          } else {
            if (current.r <= 0) { current.r = 0; continue; }
            current.x += Math.random() > 0.5 ? 1 : -1;
            current.y += Math.random() > 0.5 ? 1 : -1;
            current.r -= 0.05 * Math.random();
            newArr.push(current);
          }
        }
        newDataRef.current = newArr;
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) {
          ctx.clearRect(pos, 0, 800, 800);
          newDataRef.current.forEach(({ x: n, y: i, r: s, color }) => {
            if (n > pos) {
              ctx.beginPath();
              ctx.rect(n, i, s, s);
              ctx.fillStyle = color;
              ctx.strokeStyle = color;
              ctx.stroke();
            }
          });
        }
        if (newDataRef.current.length > 0) {
          animateFrame(pos - 8);
        } else {
          setValue("");
          setAnimating(false);
        }
      });
    };
    animateFrame(start);
  };

  const vanishAndSubmit = () => {
    if (!value.trim() || animating) return;
    setAnimating(true);
    draw();
    const maxX = newDataRef.current.reduce((prev, cur) => (cur.x > prev ? cur.x : prev), 0);
    animate(maxX);
    onSubmit(value.trim());
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    vanishAndSubmit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative h-14 w-full overflow-hidden rounded-2xl border border-line bg-surface transition-colors duration-200 focus-within:border-accent/60"
    >
      <canvas
        ref={canvasRef}
        className={`pointer-events-none absolute left-4 top-[30%] origin-top-left scale-50 ${
          animating ? "opacity-100" : "opacity-0"
        }`}
      />

      <input
        ref={inputRef}
        value={value}
        type="text"
        onChange={(e) => {
          if (!animating) {
            setValue(e.target.value);
            onChange?.(e);
          }
        }}
        onKeyDown={(e) => { if (e.key === "Enter" && !animating) vanishAndSubmit(); }}
        className={`absolute inset-0 z-50 h-full w-full rounded-2xl border-none bg-transparent pl-5 pr-14 text-base text-ink focus:outline-none focus:ring-0 ${
          animating ? "text-transparent caret-transparent" : ""
        }`}
      />

      {/* Cycling placeholder */}
      <div className="pointer-events-none absolute inset-0 flex items-center pl-5 pr-14">
        <AnimatePresence mode="wait">
          {!value && (
            <motion.p
              key={`placeholder-${currentPlaceholder}`}
              initial={{ y: 5, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -15, opacity: 0 }}
              transition={{ duration: 0.3, ease: "linear" }}
              className="w-full truncate text-base text-faint"
            >
              {placeholders[currentPlaceholder]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={!value.trim() || animating}
        className="absolute right-3 top-1/2 z-50 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-accent transition-all duration-200 hover:bg-accent-soft disabled:bg-line-2 disabled:opacity-50"
      >
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          width="24" height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 text-paper"
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <motion.path
            d="M5 12l14 0"
            initial={{ strokeDasharray: "50%", strokeDashoffset: "50%" }}
            animate={{ strokeDashoffset: value ? 0 : "50%" }}
            transition={{ duration: 0.3, ease: "linear" }}
          />
          <path d="M13 18l6 -6" />
          <path d="M13 6l6 6" />
        </motion.svg>
      </button>
    </form>
  );
});
