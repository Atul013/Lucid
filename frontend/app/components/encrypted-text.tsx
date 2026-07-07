"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&";

function rand(chars: string) {
  return chars[Math.floor(Math.random() * chars.length)];
}

export function EncryptedText({
  text,
  revealDelayMs = 60,
  flipDelayMs = 35,
  initialDelayMs = 800,
  scrambleDurationMs = 600,
  charset = DEFAULT_CHARSET,
  className = "",
  encryptedClassName = "text-accent/50",
  revealedClassName = "",
  trigger = "always",
}: {
  text: string;
  revealDelayMs?: number;
  flipDelayMs?: number;
  initialDelayMs?: number;
  scrambleDurationMs?: number;
  charset?: string;
  className?: string;
  encryptedClassName?: string;
  revealedClassName?: string;
  trigger?: "always" | "inview" | "hover";
}) {
  const [chars, setChars] = useState<string[]>(text.split(""));
  const [isScrambled, setIsScrambled] = useState<boolean[]>(Array(text.length).fill(false));

  const containerRef = useRef<HTMLSpanElement>(null);
  const revealedSet = useRef<Set<number>>(new Set());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearAll() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function run() {
    clearAll();
    revealedSet.current = new Set();

    // Step 1 — wait, then scramble everything
    const t1 = setTimeout(() => {
      setIsScrambled(Array(text.length).fill(true));
      setChars(text.split("").map(() => rand(charset)));

      // Flip unresolved chars while scrambled
      const flipId = setInterval(() => {
        setChars(prev =>
          prev.map((_, i) =>
            revealedSet.current.has(i) ? text[i] : rand(charset)
          )
        );
      }, flipDelayMs);
      timers.current.push(flipId as unknown as ReturnType<typeof setTimeout>);

      // Step 2 — after scramble hold, reveal left to right
      const t2 = setTimeout(() => {
        let idx = 0;
        const revealId = setInterval(() => {
          if (idx >= text.length) {
            clearInterval(revealId);
            clearInterval(flipId);
            setChars(text.split(""));
            setIsScrambled(Array(text.length).fill(false));
            return;
          }
          const i = idx++;
          revealedSet.current.add(i);
          setIsScrambled(prev => { const n = [...prev]; n[i] = false; return n; });
          setChars(prev => { const n = [...prev]; n[i] = text[i]; return n; });
        }, revealDelayMs);
        timers.current.push(revealId as unknown as ReturnType<typeof setTimeout>);
      }, scrambleDurationMs);

      timers.current.push(t2);
    }, initialDelayMs);

    timers.current.push(t1);
  }

  useEffect(() => {
    // Reset to readable on text change
    setChars(text.split(""));
    setIsScrambled(Array(text.length).fill(false));
    revealedSet.current = new Set();

    if (trigger === "always") {
      run();
      return () => clearAll();
    }

    if (trigger === "inview") {
      const el = containerRef.current;
      if (!el) return;
      const obs = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) { run(); obs.disconnect(); }
      }, { threshold: 0.3 });
      obs.observe(el);
      return () => { obs.disconnect(); clearAll(); };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, trigger]);

  return (
    <span
      ref={containerRef}
      className={`inline-block font-mono ${className}`}
      onMouseEnter={trigger === "hover" ? run : undefined}
    >
      {chars.map((ch, i) => (
        <span key={i} className={isScrambled[i] ? encryptedClassName : revealedClassName}>
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}
