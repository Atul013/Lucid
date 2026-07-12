"use client";

import { useEffect, useRef } from "react";
import { motion, stagger, useAnimate, useInView } from "framer-motion";

export function TextGenerateEffect({
  words,
  className = "",
  duration = 0.4,
}: {
  words: string;
  className?: string;
  duration?: number;
}) {
  const [scope, animate] = useAnimate();
  const isInView = useInView(scope, { once: true });
  const wordsArray = words.split(" ");

  useEffect(() => {
    if (isInView) {
      animate(
        "span",
        { opacity: 1, filter: "blur(0px)" },
        { duration, delay: stagger(0.06) }
      );
    }
  }, [isInView]);

  return (
    <motion.div ref={scope} className={className}>
      {wordsArray.map((word, i) => (
        <motion.span
          key={word + i}
          className="text-ink"
          style={{ opacity: 0, filter: "blur(8px)" }}
        >
          {word}{" "}
        </motion.span>
      ))}
    </motion.div>
  );
}
