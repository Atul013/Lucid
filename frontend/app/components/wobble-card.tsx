"use client";

import React, { useState } from "react";

export function WobbleCard({
  children,
  className = "",
  containerClassName = "",
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const { clientX, clientY } = e;
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = (clientX - (left + width / 2)) / 20;
    const y = (clientY - (top + height / 2)) / 20;
    setMouse({ x, y });
  };

  return (
    <section
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); setMouse({ x: 0, y: 0 }); }}
      style={{
        transform: hovering
          ? `translate3d(${mouse.x}px, ${mouse.y}px, 0) scale3d(1, 1, 1)`
          : "translate3d(0px, 0px, 0) scale3d(1, 1, 1)",
        transition: "transform 0.12s ease-out, box-shadow 0.3s ease, border-color 0.3s ease",
        boxShadow: hovering ? "0 0 28px -8px rgba(255,125,60,0.18)" : "none",
      }}
      className={`relative overflow-hidden rounded-2xl border ${
        hovering ? "border-accent/30" : "border-line"
      } bg-surface ${containerClassName}`}
    >
      {/* Spotlight that follows cursor */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300"
        style={{
          opacity: hovering ? 1 : 0,
          background: `radial-gradient(260px at ${(mouse.x + 1) * 10 + 130}px ${(mouse.y + 1) * 10 + 90}px, rgba(255,125,60,0.07), transparent 70%)`,
        }}
      />

      {/* Inner content counter-translates for wobble effect */}
      <div
        style={{
          transform: hovering
            ? `translate3d(${-mouse.x}px, ${-mouse.y}px, 0) scale3d(1.02, 1.02, 1)`
            : "translate3d(0px, 0px, 0) scale3d(1, 1, 1)",
          transition: "transform 0.12s ease-out",
        }}
        className={`relative h-full ${className}`}
      >
        {children}
      </div>
    </section>
  );
}
