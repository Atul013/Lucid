"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface BlurTextProps {
  text: string;
  delay?: number;
  className?: string;
  animateBy?: "words" | "chars";
  direction?: "top" | "bottom";
  stepDuration?: number;
}

export function BlurText({
  text,
  delay = 90,
  className = "",
  animateBy = "words",
  direction = "bottom",
  stepDuration = 0.38,
}: BlurTextProps) {
  const segments = animateBy === "words" ? text.split(" ") : text.split("");
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setInView(true); observer.disconnect(); }
      },
      { threshold: 0.1 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const fromY = direction === "top" ? -24 : 24;

  return (
    <span
      ref={ref}
      className={className}
      style={{ display: "inline-flex", flexWrap: "wrap", gap: "0.28em" }}
    >
      {segments.map((segment, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ filter: "blur(12px)", opacity: 0, y: fromY }}
          animate={
            inView
              ? { filter: "blur(0px)", opacity: 1, y: 0 }
              : { filter: "blur(12px)", opacity: 0, y: fromY }
          }
          transition={{
            duration: stepDuration,
            delay: (i * delay) / 1000,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {segment}
        </motion.span>
      ))}
    </span>
  );
}
