"use client";

import { AnimatePresence, motion, useInView } from "framer-motion";
import { useRef } from "react";

interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
  delay?: number;
  offset?: number;
  direction?: "up" | "down" | "left" | "right";
  blur?: string;
}

export function BlurFade({
  children,
  className,
  duration = 0.4,
  delay = 0,
  offset = 8,
  direction = "up",
  blur = "8px",
}: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  const axis = direction === "up" || direction === "down" ? "y" : "x";
  const sign = direction === "down" || direction === "right" ? -1 : 1;

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        className={className}
        initial={{ opacity: 0, filter: `blur(${blur})`, [axis]: sign * offset }}
        animate={isInView ? { opacity: 1, filter: "blur(0px)", [axis]: 0 } : {}}
        exit={{ opacity: 0, filter: `blur(${blur})` }}
        transition={{ duration, delay: 0.04 + delay, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
