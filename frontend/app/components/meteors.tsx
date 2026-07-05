"use client";

import { useEffect, useState, ReactNode } from "react";

interface Meteor {
  id: number;
  top: string;
  left: string;
  delay: string;
  duration: string;
  size: number;
}

export function Meteors({ number = 12 }: { number?: number }) {
  const [meteors, setMeteors] = useState<Meteor[]>([]);

  useEffect(() => {
    setMeteors(
      Array.from({ length: number }, (_, i) => ({
        id: i,
        top: `${-10 + Math.random() * 40}%`,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 4}s`,
        duration: `${5 + Math.random() * 8}s`,
        size: 80 + Math.random() * 120,
      }))
    );
  }, [number]);

  return (
    <>
      {meteors.map((m) => (
        <span
          key={m.id}
          className="pointer-events-none absolute animate-comet"
          style={{
            top: m.top,
            left: m.left,
            animationDelay: m.delay,
            animationDuration: m.duration,
            transform: "rotate(35deg)",
          }}
        >
          {/* Head — bright dot */}
          <span
            className="absolute h-[3px] rounded-full bg-accent"
            style={{ width: "3px", boxShadow: "0 0 6px 2px rgba(255,125,60,0.7)" }}
          />
          {/* Tail — fading gradient trail */}
          <span
            className="absolute top-[1px] left-[3px] h-[1.5px] rounded-full"
            style={{
              width: `${m.size}px`,
              background:
                "linear-gradient(to right, rgba(255,125,60,0.6), rgba(255,125,60,0.15), transparent)",
            }}
          />
        </span>
      ))}
    </>
  );
}

export function CometCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-line bg-surface ${className}`}
    >
      <Meteors number={10} />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
