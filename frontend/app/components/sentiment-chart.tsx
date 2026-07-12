"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { gsap } from "gsap";

type Day = { date: string; score: number; mood: string; count: number };

function shortDate(d: string): string {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// Catmull-Rom → cubic bezier smooth path
function smoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0][0]},${pts[0][1]}`;
  const n = pts.length;
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

export function SentimentChart({ days }: { days: Day[] }) {
  const W = 1000;
  const H = 340;
  const padL = 52;
  const padR = 72;
  const padT = 48;
  const padB = 44;
  const mid = padT + (H - padT - padB) / 2;
  const amp = (H - padT - padB) / 2;

  const svgRef = useRef<SVGSVGElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const [hovered, setHovered] = useState<{ xi: number; day: Day } | null>(null);

  const n = days.length;
  const xv = (i: number) =>
    n <= 1 ? (padL + W - padR) / 2 : padL + (i * (W - padL - padR)) / (n - 1);
  const yv = (s: number) => mid - Math.max(-1, Math.min(1, s)) * amp;

  const pts: [number, number][] = days.map((d, i) => [xv(i), yv(d.score)]);
  const linePath = n > 1 ? smoothPath(pts) : "";
  const areaPath =
    n > 1
      ? `${linePath} L ${pts[n - 1][0]},${mid} L ${pts[0][0]},${mid} Z`
      : "";

  const avgScore =
    n > 0 ? days.reduce((s, d) => s + d.score, 0) / n : 0;
  const maxIdx = days.reduce(
    (best, d, i) => (d.score > days[best].score ? i : best),
    0
  );
  const minIdx = days.reduce(
    (worst, d, i) => (d.score < days[worst].score ? i : worst),
    0
  );

  // GSAP entry animation
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const path = lineRef.current;
      if (path) {
        const len = path.getTotalLength();
        gsap.fromTo(
          path,
          { strokeDasharray: len, strokeDashoffset: len },
          { strokeDashoffset: 0, duration: 1.8, ease: "power2.inOut" }
        );
      }
      gsap.from(svg.querySelectorAll("[data-area]"), {
        opacity: 0,
        duration: 1.2,
        delay: 0.5,
      });
      gsap.from(svg.querySelectorAll("[data-dot]"), {
        scale: 0,
        transformOrigin: "center",
        duration: 0.4,
        ease: "back.out(2)",
        stagger: 0.06,
        delay: 0.9,
      });
      gsap.from(svg.querySelectorAll("[data-label]"), {
        opacity: 0,
        y: 5,
        duration: 0.4,
        stagger: 0.04,
        delay: 1.2,
      });
    }, svg);
    return () => ctx.revert();
  }, [n]);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg || n === 0) return;
      const rect = svg.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * W;
      let nearest = 0;
      let minDist = Infinity;
      pts.forEach(([px], i) => {
        const d = Math.abs(px - mx);
        if (d < minDist) { minDist = d; nearest = i; }
      });
      setHovered({ xi: nearest, day: days[nearest] });
    },
    [pts, days, n]
  );

  const hx = hovered != null ? pts[hovered.xi][0] : 0;
  const hy = hovered != null ? pts[hovered.xi][1] : 0;
  const stride = Math.max(1, Math.ceil(n / 10));

  // Determine if a callout should flip left
  const maxFlip = pts[maxIdx]?.[0] > W * 0.7;
  const minFlip = pts[minIdx]?.[0] > W * 0.7;

  return (
    <div className="card mb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div>
          <p className="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-faint">
            Sentiment Overview
          </p>
          <p className="mt-0.5 text-sm text-muted">
            Emotional arc across {n} {n === 1 ? "day" : "days"} · avg{" "}
            <span
              style={{
                color:
                  avgScore >= 0
                    ? "var(--color-accent)"
                    : "var(--color-muted)",
              }}
            >
              {avgScore >= 0 ? "+" : ""}
              {(avgScore * 100).toFixed(0)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-5 font-mono text-[0.56rem] uppercase tracking-[0.18em]">
          <span className="flex items-center gap-2 text-accent">
            <span className="h-px w-6 rounded-full bg-accent" />
            lighter
          </span>
          <span className="flex items-center gap-2 text-faint">
            <span className="h-px w-6 rounded-full bg-muted opacity-50" />
            heavier
          </span>
          <span className="flex items-center gap-2 text-faint">
            <span
              className="h-px w-4 rounded-full bg-faint opacity-60"
              style={{ borderTop: "1px dashed" }}
            />
            avg
          </span>
        </div>
      </div>

      {/* SVG + tooltip wrapper — relative so tooltip % aligns to SVG bounds */}
      <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ display: "block" }}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHovered(null)}
        role="img"
        aria-label="Sentiment over time"
      >
        <defs>
          <linearGradient id="sc-pos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff7d3c" stopOpacity="0.38" />
            <stop offset="80%" stopColor="#ff7d3c" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ff7d3c" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="sc-neg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#756a5d" stopOpacity="0" />
            <stop offset="20%" stopColor="#756a5d" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#4a3f35" stopOpacity="0.36" />
          </linearGradient>
          <linearGradient id="sc-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffa169" />
            <stop offset="40%" stopColor="#ff7d3c" />
            <stop offset="100%" stopColor="#ffa169" />
          </linearGradient>
          <filter id="sc-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="sc-glow-sm" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="sc-pos-clip">
            <rect x={0} y={0} width={W} height={mid} />
          </clipPath>
          <clipPath id="sc-neg-clip">
            <rect x={0} y={mid} width={W} height={H - mid} />
          </clipPath>
        </defs>

        {/* Zone backgrounds */}
        <rect x={padL} y={padT} width={W - padL - padR} height={mid - padT}
          fill="rgba(255,125,60,0.03)" />
        <rect x={padL} y={mid} width={W - padL - padR} height={H - padB - mid}
          fill="rgba(117,106,93,0.04)" />

        {/* Subtle vertical grid at each data point */}
        {pts.map(([px], i) =>
          i % stride === 0 ? (
            <line key={`vg-${i}`}
              x1={px} y1={padT} x2={px} y2={H - padB}
              stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
          ) : null
        )}

        {/* Horizontal grid lines */}
        {[-1, -0.5, 0, 0.5, 1].map((v) => (
          <line key={v}
            x1={padL} y1={yv(v)} x2={W - padR} y2={yv(v)}
            stroke={v === 0 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.035)"}
            strokeWidth={1}
            strokeDasharray={v === 0 ? "4 8" : "2 10"}
          />
        ))}

        {/* Y axis labels */}
        {[
          { v: 1, label: "+100" },
          { v: 0.5, label: "+50" },
          { v: 0, label: "0" },
          { v: -0.5, label: "−50" },
          { v: -1, label: "−100" },
        ].map(({ v, label }) => (
          <text key={v}
            x={padL - 8} y={yv(v) + 4}
            textAnchor="end" fill="var(--color-faint)"
            style={{ font: "500 9px var(--font-mono), monospace", letterSpacing: "0.08em" }}>
            {label}
          </text>
        ))}

        {/* Zone labels (right side) */}
        <text x={W - padR + 10} y={padT + 14}
          fill="var(--color-accent)" fillOpacity="0.8"
          style={{ font: "600 8px var(--font-mono), monospace", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          lighter
        </text>
        <text x={W - padR + 10} y={H - padB - 6}
          fill="var(--color-faint)" fillOpacity="0.7"
          style={{ font: "600 8px var(--font-mono), monospace", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          heavier
        </text>

        {/* Average line */}
        {n > 1 && (
          <>
            <line
              x1={padL} y1={yv(avgScore)} x2={W - padR} y2={yv(avgScore)}
              stroke="rgba(176,165,150,0.35)" strokeWidth="1" strokeDasharray="5 7"
            />
            <text x={W - padR + 8} y={yv(avgScore) + 4}
              fill="var(--color-faint)" fillOpacity="0.6"
              style={{ font: "500 8px var(--font-mono), monospace", letterSpacing: "0.08em" }}>
              avg
            </text>
          </>
        )}

        {/* Area fills */}
        {n > 1 && (
          <>
            <path data-area d={areaPath} fill="url(#sc-pos)" clipPath="url(#sc-pos-clip)" />
            <path data-area d={areaPath} fill="url(#sc-neg)" clipPath="url(#sc-neg-clip)" />
          </>
        )}

        {/* Main line */}
        {n > 1 && (
          <path ref={lineRef} d={linePath}
            fill="none" stroke="url(#sc-line)"
            strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
            filter="url(#sc-glow)"
          />
        )}

        {/* Data dots */}
        {pts.map(([px, py], i) => (
          <g key={i} data-dot style={{ transformBox: "fill-box" } as React.CSSProperties}>
            <circle cx={px} cy={py} r="7"
              fill={days[i].score >= 0 ? "rgba(255,125,60,0.15)" : "rgba(117,106,93,0.12)"} />
            <circle cx={px} cy={py} r="3.5"
              fill={days[i].score >= 0 ? "#ff7d3c" : "#756a5d"}
              stroke="var(--color-paper)" strokeWidth="1.5"
              filter={days[i].score >= 0 ? "url(#sc-glow-sm)" : undefined}
            />
          </g>
        ))}

        {/* Peak callout (best day) */}
        {n > 1 && (
          <g data-label>
            <line
              x1={pts[maxIdx][0]} y1={pts[maxIdx][1] - 10}
              x2={pts[maxIdx][0]} y2={pts[maxIdx][1] - 28}
              stroke="rgba(255,125,60,0.5)" strokeWidth="1"
            />
            <rect
              x={maxFlip ? pts[maxIdx][0] - 90 : pts[maxIdx][0] - 42}
              y={pts[maxIdx][1] - 50}
              width={86} height={20}
              rx="4" fill="rgba(255,125,60,0.12)"
              stroke="rgba(255,125,60,0.22)" strokeWidth="1"
            />
            <text
              x={maxFlip ? pts[maxIdx][0] - 47 : pts[maxIdx][0] + 1}
              y={pts[maxIdx][1] - 36}
              textAnchor="middle" fill="var(--color-accent)"
              style={{ font: "600 9px var(--font-mono), monospace", letterSpacing: "0.08em" }}>
              ↑ {days[maxIdx].mood} +{(days[maxIdx].score * 100).toFixed(0)}
            </text>
          </g>
        )}

        {/* Valley callout (worst day) */}
        {n > 1 && maxIdx !== minIdx && (
          <g data-label>
            <line
              x1={pts[minIdx][0]} y1={pts[minIdx][1] + 10}
              x2={pts[minIdx][0]} y2={pts[minIdx][1] + 28}
              stroke="rgba(117,106,93,0.5)" strokeWidth="1"
            />
            <rect
              x={minFlip ? pts[minIdx][0] - 90 : pts[minIdx][0] - 42}
              y={pts[minIdx][1] + 30}
              width={86} height={20}
              rx="4" fill="rgba(117,106,93,0.1)"
              stroke="rgba(117,106,93,0.2)" strokeWidth="1"
            />
            <text
              x={minFlip ? pts[minIdx][0] - 47 : pts[minIdx][0] + 1}
              y={pts[minIdx][1] + 44}
              textAnchor="middle" fill="var(--color-faint)"
              style={{ font: "600 9px var(--font-mono), monospace", letterSpacing: "0.08em" }}>
              ↓ {days[minIdx].mood} {(days[minIdx].score * 100).toFixed(0)}
            </text>
          </g>
        )}

        {/* X axis labels */}
        {days.map((d, i) =>
          i % stride === 0 || i === n - 1 ? (
            <text key={i} data-label
              x={xv(i)} y={H - 10}
              textAnchor={i === n - 1 && n > 2 ? "end" : i === 0 ? "start" : "middle"}
              fill="var(--color-faint)"
              style={{ font: "500 9px var(--font-mono), monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {shortDate(d.date)}
            </text>
          ) : null
        )}

        {/* Hover crosshair */}
        {hovered != null && (
          <>
            <line
              x1={hx} y1={padT} x2={hx} y2={H - padB}
              stroke="rgba(255,125,60,0.3)" strokeWidth="1" strokeDasharray="3 5"
            />
            {/* Dot on the average line */}
            <circle cx={hx} cy={yv(avgScore)} r="3"
              fill="rgba(176,165,150,0.6)" />
            {/* Main hover dot */}
            <circle cx={hx} cy={hy} r="6"
              fill={hovered.day.score >= 0 ? "#ff7d3c" : "#756a5d"}
              stroke="var(--color-ink)" strokeWidth="2"
              filter="url(#sc-glow-sm)"
            />
          </>
        )}
      </svg>

      {/* Floating tooltip — inside SVG wrapper so % maps to SVG bounds */}
      {hovered != null && (
        <div
          className="pointer-events-none absolute z-20"
          style={{
            left: `${(hx / W) * 100}%`,
            top: `${(hy / H) * 100}%`,
            transform:
              (hovered.xi > n * 0.65 ? "translateX(-115%)" : "translateX(14px)") +
              " translateY(-50%)",
          }}
        >
          <div className="rounded-xl border border-line bg-surface px-4 py-3 shadow-2xl">
            <p className="font-mono text-[0.5rem] uppercase tracking-[0.2em] text-faint">
              {shortDate(hovered.day.date)}
            </p>
            <p className="mt-1 text-sm font-medium text-ink">
              {hovered.day.mood}
            </p>
            <p
              className="mt-0.5 font-mono text-lg font-semibold tabular-nums"
              style={{
                color:
                  hovered.day.score >= 0
                    ? "var(--color-accent)"
                    : "var(--color-muted)",
              }}
            >
              {hovered.day.score >= 0 ? "+" : ""}
              {(hovered.day.score * 100).toFixed(0)}
            </p>
            <div className="mt-2 flex items-center gap-2 font-mono text-[0.5rem] text-faint">
              <span>{hovered.day.count} msg</span>
              <span>·</span>
              <span
                style={{
                  color:
                    hovered.day.score - avgScore >= 0
                      ? "var(--color-accent)"
                      : "var(--color-faint)",
                }}
              >
                {hovered.day.score - avgScore >= 0 ? "↑" : "↓"} vs avg
              </span>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
