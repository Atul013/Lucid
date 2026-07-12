"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function HoverTooltip({
  children,
  label,
}: {
  children: React.ReactNode;
  label: React.ReactNode;
}) {
  const [show, setShow] = useState(false);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 24, mass: 0.5 }}
            className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 -translate-x-1/2 whitespace-nowrap rounded-xl border border-line bg-surface-2 px-3.5 py-2 shadow-xl"
          >
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted">
              {label}
            </span>
            {/* Arrow */}
            <span className="absolute -bottom-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-line bg-surface-2" />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
