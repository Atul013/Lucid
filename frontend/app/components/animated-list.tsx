"use client";

import React, { useEffect, useMemo, useState, type ComponentPropsWithoutRef } from "react";
import { AnimatePresence, motion, type MotionProps } from "framer-motion";

export function AnimatedListItem({ children }: { children: React.ReactNode }) {
  const animations: MotionProps = {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1, originY: 0 },
    exit: { scale: 0, opacity: 0 },
    transition: { type: "spring", stiffness: 350, damping: 40 },
  };
  return (
    <motion.div {...animations} layout className="mx-auto w-full">
      {children}
    </motion.div>
  );
}

export interface AnimatedListProps extends ComponentPropsWithoutRef<"div"> {
  children: React.ReactNode;
  delay?: number;
}

export const AnimatedList = React.memo(
  ({ children, className = "", delay = 1000, ...props }: AnimatedListProps) => {
    const [index, setIndex] = useState(0);
    const childrenArray = useMemo(() => React.Children.toArray(children), [children]);

    // Loop indefinitely — cycles back to 0 after reaching the end
    useEffect(() => {
      const t = setTimeout(
        () => setIndex((p) => (p + 1) % childrenArray.length),
        delay,
      );
      return () => clearTimeout(t);
    }, [index, delay, childrenArray.length]);

    // Show up to 6 items (newest at top)
    const itemsToShow = useMemo(() => {
      const result: React.ReactNode[] = [];
      for (let i = index; i >= Math.max(0, index - 5); i--) {
        result.push(
          <AnimatedListItem key={`item-${i}-${(i % childrenArray.length)}`}>
            {childrenArray[i % childrenArray.length]}
          </AnimatedListItem>,
        );
      }
      return result;
    }, [index, childrenArray]);

    return (
      <div className={"flex flex-col gap-3 " + className} {...props}>
        <AnimatePresence>{itemsToShow}</AnimatePresence>
      </div>
    );
  },
);

AnimatedList.displayName = "AnimatedList";
