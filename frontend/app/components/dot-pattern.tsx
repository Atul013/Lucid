"use client";

import { useId } from "react";

interface DotPatternProps {
  width?: number;
  height?: number;
  cx?: number;
  cy?: number;
  cr?: number;
  className?: string;
}

export function DotPattern({
  width = 16,
  height = 16,
  cx = 2,
  cy = 2,
  cr = 1,
  className,
}: DotPatternProps) {
  const id = useId();

  return (
    <svg
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className ?? ""}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          patternTransform="translate(0 0)"
        >
          <circle cx={cx} cy={cy} r={cr} fill="currentColor" />
        </pattern>
        {/* Radial mask so the pattern fades toward edges */}
        <radialGradient id={`${id}-mask`} cx="50%" cy="50%" r="55%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="70%" stopColor="white" stopOpacity="0.6" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}-fade`}>
          <rect width="100%" height="100%" fill={`url(#${id}-mask)`} />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill={`url(#${id})`}
        mask={`url(#${id}-fade)`}
      />
    </svg>
  );
}
