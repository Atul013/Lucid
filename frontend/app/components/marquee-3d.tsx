"use client";

import { ReactNode, useMemo } from "react";
import { motion } from "framer-motion";

export function ThreeDMarquee({
  images,
  className = "",
}: {
  images: ReactNode[];
  className?: string;
}) {
  const chunkSize = Math.ceil(images.length / 4);
  const rows = useMemo(() => {
    const r: ReactNode[][] = [];
    for (let i = 0; i < 4; i++) {
      r.push(images.slice(i * chunkSize, (i + 1) * chunkSize));
    }
    return r;
  }, [images, chunkSize]);

  return (
    <div
      className={`relative mx-auto flex w-full max-w-7xl flex-col items-center justify-center overflow-hidden ${className}`}
    >
      <div
        className="flex flex-col gap-4 py-10"
        style={{
          transform: "rotateX(30deg) rotateZ(-20deg) skewX(20deg)",
          transformStyle: "preserve-3d",
          perspective: "1000px",
        }}
      >
        {rows.map((row, rowIdx) => (
          <MarqueeRow key={rowIdx} reverse={rowIdx % 2 === 1} duration={rowIdx % 2 === 0 ? 30 : 40}>
            {row.map((item, i) => (
              <div
                key={i}
                className="shrink-0"
              >
                {item}
              </div>
            ))}
          </MarqueeRow>
        ))}
      </div>

      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1/3 bg-gradient-to-b from-paper to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/3 bg-gradient-to-t from-paper to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3 bg-gradient-to-r from-paper to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-1/3 bg-gradient-to-l from-paper to-transparent" />
    </div>
  );
}

function MarqueeRow({
  children,
  reverse = false,
  duration = 30,
}: {
  children: ReactNode;
  reverse?: boolean;
  duration?: number;
}) {
  return (
    <div className="flex w-max overflow-hidden">
      <motion.div
        className="flex shrink-0 gap-4"
        initial={{ x: reverse ? "-50%" : "0%" }}
        animate={{ x: reverse ? "0%" : "-50%" }}
        transition={{ duration, repeat: Infinity, ease: "linear" }}
      >
        {children}
        {children}
      </motion.div>
    </div>
  );
}
