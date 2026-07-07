"use client";

import { ReactNode } from "react";

export function MovingBorder({
  children,
  className = "",
  duration = 2400,
  borderRadius = "0.5rem",
}: {
  children: ReactNode;
  className?: string;
  duration?: number;
  borderRadius?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden p-px ${className}`}
      style={{ borderRadius }}
    >
      {/* CSS spin — pure compositor, no JS. The conic beam sweeps around the 1px gap. */}
      <div
        className="absolute -inset-8 pointer-events-none animate-spin"
        style={{
          animationDuration: `${duration}ms`,
          background:
            "conic-gradient(from 0deg, transparent 0%, transparent 35%, rgba(255,125,60,0.9) 45%, rgba(255,200,100,0.6) 50%, rgba(255,125,60,0.9) 55%, transparent 65%)",
        }}
      />
      <div className="relative" style={{ borderRadius: `calc(${borderRadius} - 1px)` }}>
        {children}
      </div>
    </div>
  );
}
