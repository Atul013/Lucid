"use client";

import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

export type ParallaxCard = {
  title: string;
  kicker: string;
  visual: React.ReactNode;
  accent?: string;
};

export const HeroParallax = ({
  cards,
  header,
}: {
  cards: ParallaxCard[];
  header: React.ReactNode;
}) => {
  const mid = Math.ceil(cards.length / 2);
  const firstRow  = cards.slice(0, mid);
  const secondRow = cards.slice(mid);

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef   = useRef<HTMLDivElement>(null);
  const row1Ref      = useRef<HTMLDivElement>(null);
  const row2Ref      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const seg = (p: number, a: number, b: number, va: number, vb: number) => {
      const t = Math.min(1, Math.max(0, (p - a) / (b - a || 1)));
      return va + (vb - va) * t;
    };

    const update = () => {
      const el = containerRef.current;
      if (!el) return;
      const { top, height } = el.getBoundingClientRect();
      // progress 0 = top of container at viewport top, 1 = bottom at viewport top
      const p = Math.min(1, Math.max(0, -top / height));

      const ry  = seg(p, 0, 0.25, -80, 0);
      const rx  = seg(p, 0, 0.25, 12, 0);
      const rz  = seg(p, 0, 0.25, 10, 0);
      const op  = seg(p, 0, 0.25, 0.3, 1);
      const tx  = seg(p, 0, 1, 0, 600);
      const txr = seg(p, 0, 1, 0, -600);

      if (wrapperRef.current) {
        wrapperRef.current.style.opacity = String(op);
        wrapperRef.current.style.transform =
          `perspective(1000px) rotateX(${rx}deg) rotateZ(${rz}deg) translateY(${ry}px)`;
      }
      if (row1Ref.current)
        row1Ref.current.style.transform = `translateX(${tx}px)`;
      if (row2Ref.current)
        row2Ref.current.style.transform = `translateX(${txr}px)`;
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex h-[160vh] flex-col self-auto overflow-hidden antialiased"
      style={{ perspective: "1000px", transformStyle: "preserve-3d" }}
    >
      {header}

      <div ref={wrapperRef} style={{ opacity: 0.3, transform: "perspective(1000px) rotateX(12deg) rotateZ(10deg) translateY(-80px)" }}>
        {/* Row 1 — slides right on scroll */}
        <div ref={row1Ref} className="mb-20 flex flex-row-reverse space-x-20 space-x-reverse" style={{ willChange: "transform" }}>
          {firstRow.map(c => <Card key={c.title} card={c} />)}
        </div>

        {/* Row 2 — slides left */}
        <div ref={row2Ref} className="flex flex-row space-x-20" style={{ willChange: "transform" }}>
          {secondRow.map(c => <Card key={c.title} card={c} />)}
        </div>
      </div>
    </div>
  );
};

function Card({ card }: { card: ParallaxCard }) {
  return (
    <motion.div
      whileHover={{ y: -10, scale: 1.018 }}
      transition={{ type: "spring", stiffness: 160, damping: 26, mass: 0.9 }}
      className="group/card relative h-96 w-[30rem] shrink-0"
    >
      {/* Outer bezel */}
      <div className="absolute inset-0 rounded-2xl p-px"
        style={{
          background: `linear-gradient(135deg, ${card.accent ?? "rgba(255,125,60,0.3)"}, rgba(255,255,255,0.04))`,
          boxShadow: `0 0 40px -12px ${card.accent ?? "rgba(255,125,60,0.2)"}, 0 30px 60px -20px rgba(0,0,0,0.7)`,
        }}
      >
        {/* Inner core */}
        <div className="relative h-full w-full overflow-hidden rounded-[calc(1rem-1px)]"
          style={{
            background: "linear-gradient(160deg, rgba(20,14,10,0.95) 0%, rgba(10,7,5,0.98) 100%)",
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        >
          {/* Ambient glow */}
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/card:opacity-100"
            style={{ background: `radial-gradient(circle at 50% 0%, ${card.accent ?? "rgba(255,125,60,0.12)"}, transparent 70%)` }}
          />

          {/* Content */}
          <div className="relative z-10 flex h-full flex-col p-7">
            <span className="font-mono text-[0.58rem] uppercase tracking-[0.22em]"
              style={{ color: card.accent ? card.accent.replace("0.3)", "0.7)").replace("0.2)", "0.7)") : "rgba(255,125,60,0.7)" }}
            >{card.kicker}</span>
            <div className="flex flex-1 items-center justify-center py-4">
              {card.visual}
            </div>
            <h3 className="font-display text-[1.1rem] font-medium tracking-tight text-ink">
              {card.title}
            </h3>
          </div>

          {/* Hover overlay */}
          <div className="pointer-events-none absolute inset-0 rounded-[calc(1rem-1px)] opacity-0 transition-opacity duration-400 group-hover/card:opacity-100"
            style={{ background: "rgba(0,0,0,0.2)" }}
          />
        </div>
      </div>
    </motion.div>
  );
}
