"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";

interface MouseEnterCtx {
  isMouseEntered: boolean;
}

const MouseEnterContext = createContext<MouseEnterCtx>({ isMouseEntered: false });

/* Touch devices synthesize erratic mouse events from taps/scrolls, which makes
   the 3D tilt flip out. Only enable the effect on true fine-pointer devices. */
function useFinePointer() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setFine(mq.matches);
    const onChange = () => setFine(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return fine;
}

export function CardContainer({
  children,
  className = "",
  containerClassName = "",
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMouseEntered, setIsMouseEntered] = useState(false);
  const finePointer = useFinePointer();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const { left, top, width, height } = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - left - width / 2) / 22;
    const y = (e.clientY - top - height / 2) / 22;
    containerRef.current.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
  };

  const handleMouseLeave = () => {
    setIsMouseEntered(false);
    if (containerRef.current)
      containerRef.current.style.transform = `rotateY(0deg) rotateX(0deg)`;
  };

  // Touch/coarse-pointer: render a stable, non-tilting card. A soft accent
  // glow keeps it feeling alive without the flip-out.
  if (!finePointer) {
    return (
      <MouseEnterContext.Provider value={{ isMouseEntered: false }}>
        <div className={`flex items-center justify-center ${containerClassName}`}>
          <div className={`relative ${className}`}>{children}</div>
        </div>
      </MouseEnterContext.Provider>
    );
  }

  return (
    <MouseEnterContext.Provider value={{ isMouseEntered }}>
      <div
        className={`flex items-center justify-center ${containerClassName}`}
        style={{ perspective: "1000px" }}
      >
        <div
          ref={containerRef}
          onMouseEnter={() => setIsMouseEntered(true)}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className={`relative transition-all duration-200 ease-linear ${className}`}
          style={{ transformStyle: "preserve-3d" }}
        >
          {children}
        </div>
      </div>
    </MouseEnterContext.Provider>
  );
}

export function CardBody({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{ transformStyle: "preserve-3d", ...style }}
    >
      {children}
    </div>
  );
}

export function CardItem({
  as: Tag = "div",
  children,
  className = "",
  translateZ = 0,
  ...rest
}: {
  as?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  translateZ?: number;
  [key: string]: unknown;
}) {
  const ref = useRef<HTMLElement>(null);
  const { isMouseEntered } = useContext(MouseEnterContext);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.transform = isMouseEntered
      ? `translateZ(${translateZ}px)`
      : `translateZ(0px)`;
    ref.current.style.transition = "transform 0.2s ease-out";
  }, [isMouseEntered, translateZ]);

  return (
    <Tag ref={ref} className={className} {...rest}>
      {children}
    </Tag>
  );
}
