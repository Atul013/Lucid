"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

export function LampContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-paper ${className}`}
    >
      {/* ── Lamp assembly ── */}
      <div className="pointer-events-none absolute inset-x-0 top-[12vh] flex items-start justify-center">

        {/* Left conic beam */}
        <motion.div
          initial={{ opacity: 0.5, width: "6rem" }}
          whileInView={{ opacity: 1, width: "34rem" }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 1.0, ease: "easeOut" }}
          className="absolute right-1/2 top-0 origin-top-right"
          style={{
            height: "72vh",
            background:
              "conic-gradient(from 70deg at 100% 0%, rgba(255,125,60,0.9) 0%, rgba(255,125,60,0.15) 18%, transparent 32%)",
            maskImage:
              "linear-gradient(to bottom, white 0%, white 30%, rgba(255,255,255,0.5) 60%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, white 0%, white 30%, rgba(255,255,255,0.5) 60%, transparent 100%)",
          }}
        />

        {/* Right conic beam */}
        <motion.div
          initial={{ opacity: 0.5, width: "6rem" }}
          whileInView={{ opacity: 1, width: "34rem" }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 1.0, ease: "easeOut" }}
          className="absolute left-1/2 top-0 origin-top-left"
          style={{
            height: "72vh",
            background:
              "conic-gradient(from 250deg at 0% 0%, transparent 68%, rgba(255,125,60,0.15) 82%, rgba(255,125,60,0.9) 100%)",
            maskImage:
              "linear-gradient(to bottom, white 0%, white 30%, rgba(255,255,255,0.5) 60%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, white 0%, white 30%, rgba(255,255,255,0.5) 60%, transparent 100%)",
          }}
        />

        {/* Wide soft fill between beams */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25, duration: 1.4, ease: "easeOut" }}
          className="absolute top-0 w-[72rem]"
          style={{
            height: "70vh",
            background:
              "radial-gradient(ellipse 55% 60% at 50% 0%, rgba(255,125,60,0.14) 0%, transparent 75%)",
          }}
        />

        {/* Bright glowing orb at the source */}
        <motion.div
          initial={{ width: "4rem", opacity: 0 }}
          whileInView={{ width: "28rem", opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15, duration: 1.0, ease: "easeOut" }}
          className="absolute top-0 z-10 h-12 -translate-y-1/2 rounded-full"
          style={{
            background: "rgba(255,125,60,0.55)",
            filter: "blur(28px)",
          }}
        />

        {/* Crisp horizontal bar at the source */}
        <motion.div
          initial={{ width: "4rem", opacity: 0 }}
          whileInView={{ width: "44rem", opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15, duration: 1.0, ease: "easeOut" }}
          className="absolute top-0 z-20 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,125,60,0.5) 25%, #ff9a6c 50%, rgba(255,125,60,0.5) 75%, transparent 100%)",
          }}
        />

        {/* Bright centre hotspot on the bar */}
        <div
          className="absolute top-0 z-30 h-[3px] w-20 -translate-y-[1px] rounded-full"
          style={{
            background: "#ffb38a",
            filter: "blur(4px)",
          }}
        />
      </div>

      {/* ── Content ── */}
      <div className="relative z-30 flex flex-col items-center px-5 pt-24">
        {children}
      </div>
    </div>
  );
}
