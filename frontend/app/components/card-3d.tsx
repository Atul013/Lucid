"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  ReactNode,
  MouseEvent,
} from "react";

/* ── Context ── */
interface CardCtx {
  rotateX: number;
  rotateY: number;
}
const Ctx = createContext<CardCtx>({ rotateX: 0, rotateY: 0 });

/* ── CardContainer ── */
export function CardContainer({
  children,
  className = "",
  containerClassName = "",
}: {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ rotateX: 0, rotateY: 0 });

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (e.clientX - left - width / 2) / (width / 2);
    const y = (e.clientY - top - height / 2) / (height / 2);
    setRotate({ rotateX: -y * 12, rotateY: x * 12 });
  }

  function handleLeave() {
    setRotate({ rotateX: 0, rotateY: 0 });
  }

  return (
    <Ctx.Provider value={rotate}>
      <div
        className={`flex items-center justify-center ${containerClassName}`}
        style={{ perspective: "1000px" }}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        <div
          ref={ref}
          className={`relative transition-transform duration-200 ease-out ${className}`}
          style={{
            transform: `rotateX(${rotate.rotateX}deg) rotateY(${rotate.rotateY}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          {children}
        </div>
      </div>
    </Ctx.Provider>
  );
}

/* ── CardBody ── */
export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{ transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}

/* ── CardItem — each child floats at its own Z depth ── */
export function CardItem({
  children,
  className = "",
  as: Tag = "div",
  translateZ = 0,
  translateX = 0,
  translateY = 0,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: React.ElementType;
  translateZ?: number;
  translateX?: number;
  translateY?: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  [key: string]: unknown;
}) {
  const { rotateX: rx, rotateY: ry } = useContext(Ctx);
  const active = rx !== 0 || ry !== 0;

  return (
    <Tag
      className={`transition-transform duration-200 ease-out ${className}`}
      style={{
        transform: active
          ? `translateX(${translateX}px) translateY(${translateY}px) translateZ(${translateZ}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`
          : "none",
        transformStyle: "preserve-3d",
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
