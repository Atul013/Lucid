"use client";

import { useState, useEffect, useRef } from "react";
import { gsap } from "gsap";
import {
  Shell,
  PageHeader,
  AccentButton,
  Thinking,
  StateNote,
  Arrow,
} from "../ui";
import { API } from "../api";


type Day = { date: string; score: number; mood: string; count: number };

function shortDate(d: string): string {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function Timeline() {
  const [state, setState] = useState<
    "loading" | "empty" | "building" | "ready" | "error"
  >("loading");
  const [days, setDays] = useState<Day[]>([]);

  useEffect(() => {
    fetch(`${API}/ego/timeline`)
      .then((r) => r.json())
      .then((d) => {
        if (d.days?.length) {
          setDays(d.days);
          setState("ready");
        } else setState("empty");
      })
      .catch(() => setState("error"));
  }, []);

  async function build() {
    setState("building");
    try {
      const r = await fetch(`${API}/ego/timeline/build`, { method: "POST" });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setDays(d.days ?? []);
      setState("ready");
    } catch {
      setState("error");
    }
  }

  return (
    <Shell>
      <PageHeader
        kicker="Emotion Timeline"
        title="Weather"
        lead="The emotional weather of your inbox, charted day by day — where the light days were, and where it got heavy."
      />

      {state === "loading" && <Thinking label="Reading the weather…" />}
      {state === "error" && (
        <StateNote>
          Couldn&rsquo;t reach the backend on{" "}
          <span className="font-mono text-faint">localhost:8000</span>.
        </StateNote>
      )}
      {state === "building" && <Thinking label="Charting your timeline…" />}

      {state === "empty" && (
        <div className="card rise max-w-xl p-8 sm:p-10">
          <p className="text-[1rem] leading-relaxed text-muted">
            Chart the emotional tone of your archive over time — a single line
            that shows how the days actually felt.
          </p>
          <AccentButton onClick={build} className="mt-8">
            Chart my timeline
            <Arrow />
          </AccentButton>
        </div>
      )}

      {state === "ready" && (
        <div className="rise">
          <div className="card p-6 sm:p-8">
            <Chart days={days} />
          </div>
          <button
            onClick={build}
            className="mt-8 cursor-pointer font-mono text-[0.66rem] uppercase tracking-[0.18em] text-faint transition-colors hover:text-accent"
          >
            ↻ Rebuild
          </button>
        </div>
      )}
    </Shell>
  );
}

function Chart({ days }: { days: Day[] }) {
  const W = 760;
  const H = 340;
  const padX = 44;
  const padY = 60;
  const mid = H / 2;
  const amp = (H - padY * 2) / 2;

  const n = days.length;
  const x = (i: number) =>
    n === 1 ? W / 2 : padX + (i * (W - padX * 2)) / (n - 1);
  const y = (s: number) => mid - Math.max(-1, Math.min(1, s)) * amp;

  const pts = days.map((d, i) => [x(i), y(d.score)] as const);
  const line = pts.map(([px, py]) => `${px},${py}`).join(" ");
  const area =
    n > 1
      ? `M ${pts[0][0]},${mid} ` +
        pts.map(([px, py]) => `L ${px},${py}`).join(" ") +
        ` L ${pts[n - 1][0]},${mid} Z`
      : "";

  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const path = svg.querySelector<SVGPolylineElement>("polyline");
      if (path) {
        const len = path.getTotalLength();
        gsap.fromTo(
          path,
          { strokeDasharray: len, strokeDashoffset: len },
          { strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut" },
        );
      }
      gsap.from(svg.querySelectorAll("[data-area]"), {
        opacity: 0,
        duration: 1.2,
        delay: 0.4,
      });
      gsap.from(svg.querySelectorAll("[data-node]"), {
        scale: 0,
        transformOrigin: "center",
        duration: 0.5,
        ease: "back.out(2)",
        stagger: 0.08,
        delay: 0.9,
      });
      gsap.from(svg.querySelectorAll("[data-label]"), {
        opacity: 0,
        y: 6,
        duration: 0.5,
        stagger: 0.06,
        delay: 1.1,
      });
    }, svg);
    return () => ctx.revert();
  }, []);

  return (
    <figure>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Sentiment of your inbox over time"
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff7d3c" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ff7d3c" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lineStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffa169" />
            <stop offset="1" stopColor="#ff7d3c" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* zero baseline */}
        <line
          x1={padX}
          y1={mid}
          x2={W - padX}
          y2={mid}
          stroke="var(--color-line-2)"
          strokeDasharray="2 6"
        />

        {n > 1 && <path data-area d={area} fill="url(#areaFill)" />}
        {n > 1 && (
          <polyline
            points={line}
            fill="none"
            stroke="url(#lineStroke)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#glow)"
          />
        )}

        {days.map((d, i) => (
          <g key={i}>
            <g data-node style={{ transformBox: "fill-box" } as React.CSSProperties}>
              <circle
                cx={x(i)}
                cy={y(d.score)}
                r="5"
                fill={d.score >= 0 ? "#ff7d3c" : "#f4ede2"}
                filter="url(#glow)"
              />
              <circle cx={x(i)} cy={y(d.score)} r="2" fill="#1a0f08" />
            </g>
            <text
              data-label
              x={x(i)}
              y={y(d.score) + (d.score >= 0 ? -16 : 26)}
              textAnchor="middle"
              fill="var(--color-ink)"
              style={{ font: '500 12px var(--font-sans), sans-serif' }}
            >
              {d.mood}
            </text>
            <text
              data-label
              x={x(i)}
              y={H - 20}
              textAnchor="middle"
              fill="var(--color-faint)"
              style={{
                font: '500 10px var(--font-mono), monospace',
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {shortDate(d.date)}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[0.62rem] uppercase tracking-[0.15em] text-faint">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent" /> Above the line —
          lighter days
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-ink" /> Below — heavier
        </span>
      </figcaption>
    </figure>
  );
}
