"use client";

import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-2xl flex-col px-6 py-12 sm:py-16">
      <header className="mb-12 sm:mb-16">
        <h1 className="font-display text-4xl font-medium leading-none tracking-tight text-ink sm:text-5xl">
          Timeline
        </h1>
        <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-muted">
          The emotional weather of your inbox, day by day.
        </p>
      </header>

      {state === "loading" && (
        <p className="text-[0.95rem] text-faint">Loading&hellip;</p>
      )}
      {state === "error" && (
        <p className="text-[0.95rem] text-muted">
          Couldn&rsquo;t reach the backend on{" "}
          <span className="tabular-nums">localhost:8000</span>.
        </p>
      )}
      {state === "building" && (
        <p className="text-[0.95rem] text-faint">Reading the weather&hellip;</p>
      )}

      {state === "empty" && (
        <div className="border-t border-line pt-10">
          <p className="max-w-md text-[0.95rem] leading-relaxed text-muted">
            Chart the emotional tone of your archive over time.
          </p>
          <button
            onClick={build}
            className="mt-7 inline-flex h-11 cursor-pointer items-center gap-2 bg-ink px-6 text-[0.8rem] font-medium uppercase tracking-[0.15em] text-paper transition-colors hover:bg-accent"
          >
            Chart my timeline
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      )}

      {state === "ready" && (
        <>
          <Chart days={days} />
          <button
            onClick={build}
            className="mt-8 cursor-pointer text-[0.7rem] font-medium uppercase tracking-[0.15em] text-faint transition-colors hover:text-accent"
          >
            Rebuild
          </button>
        </>
      )}
    </main>
  );
}

function Chart({ days }: { days: Day[] }) {
  const W = 720;
  const H = 320;
  const padX = 48;
  const padY = 56;
  const mid = H / 2;
  const amp = (H - padY * 2) / 2;

  const n = days.length;
  const x = (i: number) =>
    n === 1 ? W / 2 : padX + (i * (W - padX * 2)) / (n - 1);
  const y = (s: number) => mid - Math.max(-1, Math.min(1, s)) * amp;

  const line = days.map((d, i) => `${x(i)},${y(d.score)}`).join(" ");

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Sentiment of your inbox over time"
      >
        {/* zero baseline */}
        <line
          x1={padX}
          y1={mid}
          x2={W - padX}
          y2={mid}
          stroke="var(--color-line)"
          strokeDasharray="3 4"
        />
        {n > 1 && (
          <polyline
            points={line}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )}
        {days.map((d, i) => (
          <g key={i}>
            <circle
              cx={x(i)}
              cy={y(d.score)}
              r="4.5"
              fill={d.score >= 0 ? "var(--color-accent)" : "var(--color-ink)"}
            />
            <text
              x={x(i)}
              y={y(d.score) + (d.score >= 0 ? -14 : 22)}
              textAnchor="middle"
              className="fill-muted"
              style={{ font: '500 11px "Hanken Grotesk", sans-serif' }}
            >
              {d.mood}
            </text>
            <text
              x={x(i)}
              y={H - 18}
              textAnchor="middle"
              className="fill-faint"
              style={{
                font: '500 10px "Hanken Grotesk", sans-serif',
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {shortDate(d.date)}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-4 flex gap-6 text-[0.7rem] font-medium uppercase tracking-[0.15em] text-faint">
        <span>Above the line — lighter days</span>
        <span>Below — heavier</span>
      </figcaption>
    </figure>
  );
}
