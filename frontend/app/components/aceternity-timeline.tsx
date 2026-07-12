"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

export interface TimelineEntry {
  title: string;
  content: React.ReactNode;
}

export const AceternityTimeline = ({ data }: { data: TimelineEntry[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const measure = () => { if (ref.current) setHeight(ref.current.getBoundingClientRect().height); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 10%", "end 95%"],
  });

  const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.05], [0, 1]);

  return (
    <div ref={containerRef} className="w-full">
      <div ref={ref} className="relative pb-20">
        {data.map((item, index) => (
          <div
            key={index}
            className="flex justify-start pt-10 md:pt-32 md:gap-10"
          >
            {/* Sticky left: dot + label */}
            <div className="sticky top-40 z-40 flex w-40 shrink-0 flex-col items-center self-start md:flex-row">
              <div className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full bg-paper">
                <div className="h-4 w-4 rounded-full border border-line bg-surface p-2" />
              </div>
              <h3 className="hidden pl-20 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-faint md:block">
                {item.title}
              </h3>
            </div>

            {/* Content */}
            <div className="relative min-w-0 flex-1 pl-20 md:pl-0">
              <h3 className="mb-3 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-faint md:hidden">
                {item.title}
              </h3>
              {item.content}
            </div>
          </div>
        ))}

        {/* Scroll-progress line */}
        <div
          style={{ height: `${height}px` }}
          className="absolute left-8 top-0 w-[2px] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent_0%,black_8%,black_92%,transparent_100%)]"
        >
          {/* Static track */}
          <div className="absolute inset-0 w-full bg-gradient-to-b from-transparent via-line to-transparent" />
          {/* Animated fill */}
          <motion.div
            style={{ height: heightTransform, opacity: opacityTransform }}
            className="absolute inset-x-0 top-0 w-[2px] rounded-full bg-gradient-to-b from-accent via-accent-soft to-accent"
          />
        </div>
      </div>
    </div>
  );
};
