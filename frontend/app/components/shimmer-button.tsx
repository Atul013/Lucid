"use client";

import { motion } from "framer-motion";
import { forwardRef } from "react";

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string;
  background?: string;
  borderRadius?: string;
  children: React.ReactNode;
}

export const ShimmerButton = forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = "#ff7d3c",
      background = "#15110e",
      borderRadius = "14px",
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        style={{ borderRadius, background, position: "relative", overflow: "hidden" }}
        className={`group inline-flex cursor-pointer items-center justify-center gap-2.5 border border-white/10 px-7 py-3.5 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-ink transition-transform duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      >
        {/* Sweeping shimmer streak */}
        <motion.div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "45%",
            height: "100%",
            background: `linear-gradient(90deg, transparent, ${shimmerColor}28, ${shimmerColor}55, ${shimmerColor}28, transparent)`,
            pointerEvents: "none",
            zIndex: 0,
          }}
          animate={{ x: ["-100%", "320%"] }}
          transition={{
            repeat: Infinity,
            duration: 2.2,
            ease: "easeInOut",
            repeatDelay: 0.8,
          }}
        />

        {/* Outer amber ring glow */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius,
            boxShadow: `0 0 0 1px ${shimmerColor}30, inset 0 -6px 14px ${shimmerColor}18`,
            transition: "box-shadow 0.3s ease",
            pointerEvents: "none",
            zIndex: 0,
          }}
          className="group-hover:[box-shadow:0_0_0_1px_rgba(255,125,60,0.55),inset_0_-6px_14px_rgba(255,125,60,0.28)]"
        />

        <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
      </button>
    );
  }
);
ShimmerButton.displayName = "ShimmerButton";
