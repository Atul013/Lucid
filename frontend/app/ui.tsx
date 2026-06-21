"use client";

import {
  ReactNode,
  useEffect,
  useRef,
  ElementType,
  useCallback,
} from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

/* ============================================================
   Shared motion + layout primitives — Awwwards-grade.
   Lenis smooth scroll · GSAP ScrollTrigger reveals · split-word
   headlines · magnetic button-in-button CTAs.
   ============================================================ */

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Mount once in the root layout. Drives Lenis from GSAP's ticker and
   keeps ScrollTrigger in sync with the smoothed scroll position. */
export function SmoothScroll() {
  useEffect(() => {
    if (prefersReduced()) return;
    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);
  return null;
}

/* A soft amber light follows the cursor (lerped), and pools a spotlight
   under whatever .card is hovered. Fine-pointer only. Mount once. */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (prefersReduced()) return;

    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let x = tx;
    let y = ty;
    let raf = 0;

    const move = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      const card = (e.target as HTMLElement)?.closest?.(".card") as
        | HTMLElement
        | null;
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      }
    };
    const loop = () => {
      x += (tx - x) * 0.14;
      y += (ty - y) * 0.14;
      if (ref.current)
        ref.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", move, { passive: true });
    loop();
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-30 hidden h-[26rem] w-[26rem] rounded-full blur-2xl md:block"
      style={{
        marginLeft: "-13rem",
        marginTop: "-13rem",
        background:
          "radial-gradient(circle, rgba(255,125,60,0.10), transparent 62%)",
        mixBlendMode: "screen",
      }}
    />
  );
}

/* Number that animates up from zero when scrolled into view. */
export function CountUp({
  to,
  className = "",
  duration = 1.5,
}: {
  to: number;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReduced()) {
      el.textContent = String(to);
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    const o = { v: 0 };
    const tw = gsap.to(o, {
      v: to,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = String(Math.round(o.v));
      },
      scrollTrigger: { trigger: el, start: "top 94%", once: true },
    });
    return () => {
      tw.scrollTrigger?.kill();
      tw.kill();
    };
  }, [to, duration]);
  return (
    <span ref={ref} className={className}>
      0
    </span>
  );
}

/* Heavy fade-up + blur as the element enters the viewport. Optionally
   staggers its direct children. Falls back to fully visible (no hide)
   under reduced-motion. */
export function Reveal({
  children,
  className = "",
  y = 28,
  delay = 0,
  stagger,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  delay?: number;
  stagger?: boolean;
  as?: ElementType;
}) {
  const ref = useRef<HTMLElement>(null);
  const Tag = as as ElementType;

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReduced()) return;
    gsap.registerPlugin(ScrollTrigger);

    const targets = stagger ? Array.from(el.children) : el;
    const ctx = gsap.context(() => {
      gsap.from(targets, {
        opacity: 0,
        y,
        filter: "blur(10px)",
        duration: 0.9,
        delay,
        ease: "power3.out",
        stagger: stagger ? 0.09 : 0,
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
    }, el);
    return () => ctx.revert();
  }, [y, delay, stagger]);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

/* Word-by-word mask reveal for big headlines. Each word rises out of an
   overflow-hidden box, staggered. */
export function SplitReveal({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReduced()) return;
    const words = el.querySelectorAll("[data-word]");
    const ctx = gsap.context(() => {
      gsap.from(words, {
        yPercent: 115,
        duration: 1,
        ease: "power4.out",
        stagger: 0.08,
        delay: 0.05,
      });
    }, el);
    return () => ctx.revert();
  }, [text]);

  return (
    <h1 ref={ref} className={className}>
      {text.split(" ").map((w, i) => (
        <span
          key={i}
          className="inline-block overflow-hidden pb-[0.12em] align-bottom"
        >
          <span data-word className="inline-block">
            {w}
          </span>
          {i < text.split(" ").length - 1 && " "}
        </span>
      ))}
    </h1>
  );
}

export function Shell({
  children,
  width = "narrow",
}: {
  children: ReactNode;
  width?: "narrow" | "wide";
}) {
  const max = width === "wide" ? "max-w-5xl" : "max-w-3xl";
  return (
    <main
      className={`mx-auto flex min-h-[calc(100dvh-5rem)] w-full ${max} flex-col px-6 py-20 sm:py-28`}
    >
      {children}
    </main>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-surface/60 px-3.5 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.24em] text-accent backdrop-blur-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-accent pulse-dot" />
      {children}
    </span>
  );
}

export function PageHeader({
  kicker,
  title,
  lead,
  children,
}: {
  kicker: string;
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-16 sm:mb-24">
      <div className="mb-6">
        <Eyebrow>{kicker}</Eyebrow>
      </div>
      <SplitReveal
        text={title}
        className="font-display text-[3.4rem] font-medium leading-[0.92] tracking-tight text-ink sm:text-7xl"
      />
      {lead && (
        <Reveal delay={0.25}>
          <p className="mt-7 max-w-xl text-[1.05rem] leading-relaxed text-muted">
            {lead}
          </p>
        </Reveal>
      )}
      {children}
    </header>
  );
}

export function Kicker({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={`kicker text-faint ${className}`}>{children}</p>;
}

/* Magnetic hover: the element drifts toward the cursor, springs back on
   leave. Returns handlers to spread on a wrapper. */
function useMagnetic(strength = 0.35) {
  const ref = useRef<HTMLSpanElement>(null);
  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el || prefersReduced()) return;
      const r = el.getBoundingClientRect();
      gsap.to(el, {
        x: (e.clientX - (r.left + r.width / 2)) * strength,
        y: (e.clientY - (r.top + r.height / 2)) * strength,
        duration: 0.5,
        ease: "power3.out",
      });
    },
    [strength],
  );
  const onLeave = useCallback(() => {
    if (ref.current)
      gsap.to(ref.current, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1,0.4)" });
  }, []);
  return { ref, onMouseMove: onMove, onMouseLeave: onLeave };
}

export function AccentButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const mag = useMagnetic(0.3);
  return (
    <span
      ref={mag.ref}
      onMouseMove={mag.onMouseMove}
      onMouseLeave={mag.onMouseLeave}
      className="inline-block"
    >
      <button
        {...props}
        className={`btn-accent group inline-flex h-12 cursor-pointer items-center gap-3 rounded-full pl-7 pr-2 font-mono text-[0.72rem] font-medium uppercase tracking-[0.16em] disabled:cursor-default disabled:opacity-60 ${className}`}
      >
        <span>{children}</span>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[#1a0f08]/15 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:scale-105">
          <Arrow />
        </span>
      </button>
    </span>
  );
}

export function GhostButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`btn-ghost inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-5 font-mono text-[0.66rem] uppercase tracking-[0.18em] disabled:cursor-default disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function StateNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-[0.98rem] leading-relaxed text-muted">{children}</p>
  );
}

export function Thinking({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-[0.95rem] text-muted">
      <span className="relative grid h-5 w-5 place-items-center">
        <span className="absolute h-2.5 w-2.5 rounded-full bg-accent pulse-dot" />
      </span>
      {label}
    </div>
  );
}

export function Arrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
