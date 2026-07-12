"use client";

import { motion } from "framer-motion";

interface BorderBeamProps {
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  borderRadius?: number;
  reverse?: boolean;
  opacity?: number;
}

export function BorderBeam({
  size = 100,
  duration = 5,
  delay = 0,
  colorFrom = "#ff7d3c",
  colorTo = "transparent",
  borderRadius = 16,
  reverse = false,
  opacity = 0.75,
}: BorderBeamProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ borderRadius }}
    >
      <motion.div
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: "50%",
          offsetPath: `rect(0 auto auto 0 round ${borderRadius}px)`,
          background: `radial-gradient(circle, ${colorFrom} 0%, ${colorTo} 65%)`,
          opacity,
          willChange: "offset-distance",
        }}
        initial={{ offsetDistance: reverse ? "100%" : "0%" }}
        animate={{ offsetDistance: reverse ? ["100%", "0%"] : ["0%", "100%"] }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration,
          delay: -delay,
        }}
      />
    </div>
  );
}
