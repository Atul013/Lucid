"use client";

import React, { useEffect, useRef } from "react";

const ROWS = 14;
const COLS = 26;

export const RippleBackground = React.memo(function RippleBackground({
  className = "",
}: {
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const grid = container.querySelector<HTMLDivElement>(".ripple-grid");
      if (!grid) return;

      const cells = grid.children;
      const rect = container.getBoundingClientRect();
      const cellW = rect.width / COLS;
      const cellH = rect.height / ROWS;
      const clickedCol = Math.floor((e.clientX - rect.left) / cellW);
      const clickedRow = Math.floor((e.clientY - rect.top) / cellH);

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const dist = Math.sqrt((r - clickedRow) ** 2 + (c - clickedCol) ** 2);

          const cell = cells[r * COLS + c] as HTMLDivElement | undefined;
          if (!cell) continue;

          const delay = dist * 0.055;
          cell.style.animation = "none";
          void cell.offsetHeight;
          cell.style.animation = `cell-ripple 1.4s ease-out ${delay}s both`;
        }
      }
    };

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={`pointer-events-none fixed inset-0 overflow-hidden ${className}`}
      style={{ zIndex: 0 }}
    >
      <div
        className="ripple-grid absolute inset-0"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        }}
      >
        {Array.from({ length: ROWS * COLS }, (_, i) => (
          <div key={i} style={{ border: "1px solid rgba(255,125,60,0.1)" }} />
        ))}
      </div>
    </div>
  );
});
