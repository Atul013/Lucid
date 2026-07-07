"use client";

import { useRef, useState, ReactNode } from "react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";

export interface StickyContent {
  title: string;
  description: string;
  bullets?: string[];
}

export function StickyScrollReveal({
  heading,
  subheading,
  content,
}: {
  heading: ReactNode;
  subheading?: ReactNode;
  content: StickyContent[];
}) {
  const [activeCard, setActiveCard] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 20%", "end 80%"],
  });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const idx = Math.min(
      content.length - 1,
      Math.floor(v * content.length)
    );
    setActiveCard(idx);
  });

  return (
    <div ref={containerRef} className="relative grid grid-cols-1 gap-0 lg:grid-cols-2">
      {/* ── LEFT: sticky heading ── */}
      <div className="hidden lg:flex lg:flex-col lg:justify-start">
        <div className="sticky top-[28vh] pb-16">
          {heading}
          {subheading && (
            <div className="mt-4">{subheading}</div>
          )}

          {/* Dot nav */}
          <div className="mt-12 flex flex-col gap-3">
            {content.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <motion.div
                  animate={{
                    width: activeCard === i ? "2rem" : "0.5rem",
                    backgroundColor:
                      activeCard === i ? "var(--color-accent)" : "var(--color-line-2)",
                  }}
                  transition={{ duration: 0.3 }}
                  className="h-0.5 rounded-full"
                />
                <motion.span
                  animate={{ color: activeCard === i ? "var(--color-ink)" : "var(--color-faint)" }}
                  className="font-mono text-[0.6rem] uppercase tracking-[0.2em]"
                >
                  {item.title}
                </motion.span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT: scrolling content blocks ── */}
      <div className="flex flex-col">
        {content.map((item, i) => (
          <div key={i} className="min-h-[40vh] flex items-center py-10 lg:py-14">
            <motion.div
              animate={{
                opacity: activeCard === i ? 1 : 0.25,
                y: activeCard === i ? 0 : 12,
              }}
              transition={{ duration: 0.4 }}
              className="w-full"
            >
              {/* Mobile: show title inline */}
              <p className="mb-3 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-accent lg:hidden">
                {item.title}
              </p>
              <h3 className="font-display text-3xl font-medium leading-tight text-ink sm:text-4xl">
                {item.title}
              </h3>
              <p className="mt-5 text-[1rem] leading-relaxed text-muted">
                {item.description}
              </p>
              {item.bullets && (
                <ul className="mt-6 space-y-2">
                  {item.bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-3 text-[0.9rem] text-muted">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent/60" />
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}
