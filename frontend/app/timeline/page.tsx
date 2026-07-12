"use client";

import { useState, useEffect } from "react";
import { Shell, PageHeader, AccentButton, Thinking, StateNote, Arrow } from "../ui";
import { API } from "../api";
import { DotPattern } from "../components/dot-pattern";
import { TracingBeam } from "../components/tracing-beam";
import { AceternityTimeline } from "../components/aceternity-timeline";
import { SentimentChart } from "../components/sentiment-chart";

type Day = { date: string; score: number; mood: string; count: number };

function shortDate(d: string): string {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function weekday(d: string): string {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString(undefined, { weekday: "long" });
}

function intensity(score: number): string {
  const abs = Math.abs(score);
  if (abs < 0.25) return "subtle";
  if (abs < 0.55) return "moderate";
  return "strong";
}

function sentenceFor(score: number, mood: string): string {
  const isPos = score >= 0;
  const abs = Math.abs(score);
  if (abs < 0.15) return "Inbox sat close to neutral — no strong emotional pull either way.";
  if (isPos) {
    if (abs > 0.65) return `A noticeably lighter day — "${mood}" comes through clearly in the messages.`;
    return `The inbox leaned lighter. "${mood}" is the thread running through it.`;
  } else {
    if (abs > 0.65) return `This day carried real weight — "${mood}" shows up consistently across messages.`;
    return `The inbox felt a little heavier. "${mood}" threads through what came in.`;
  }
}

function DayCard({ day, index, total, avgScore }: { day: Day; index: number; total: number; avgScore: number }) {
  const isPos = day.score >= 0;
  const clamped = Math.max(-1, Math.min(1, day.score));
  const absPct = Math.round(Math.abs(clamped) * 100);
  const vsAvg = day.score - avgScore;
  const int = intensity(day.score);

  return (
    <div className="card w-full p-6 sm:p-8">
      {/* Top row: mood + badge */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[1.5rem] font-medium leading-tight text-ink sm:text-2xl">
            {day.mood}
          </p>
          <p className="mt-1 text-[0.9rem] leading-relaxed text-muted">
            {sentenceFor(day.score, day.mood)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className="rounded-full px-3 py-1 font-mono text-[0.58rem] uppercase tracking-[0.18em]"
            style={{
              backgroundColor: isPos ? "rgba(255,125,60,0.09)" : "rgba(255,255,255,0.04)",
              color: isPos ? "var(--color-accent)" : "var(--color-faint)",
              border: `1px solid ${isPos ? "rgba(255,125,60,0.22)" : "var(--color-line)"}`,
            }}
          >
            {isPos ? "lighter" : "heavier"}
          </span>
          <span className="font-mono text-[0.58rem] uppercase tracking-[0.15em] text-faint">
            {int} · {weekday(day.date)}
          </span>
        </div>
      </div>

      {/* Score display + bar */}
      <div className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-faint">sentiment score</span>
          <span
            className="font-mono text-xl font-semibold tabular-nums"
            style={{ color: isPos ? "var(--color-accent)" : "var(--color-muted)" }}
          >
            {isPos ? "+" : ""}{(day.score * 100).toFixed(0)}
          </span>
        </div>
        {/* Bar: centered at 0 */}
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-line-2">
          <div className="absolute left-1/2 top-0 h-full w-px bg-line" />
          <div
            className="absolute top-0 h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${absPct / 2}%`,
              left: isPos ? "50%" : undefined,
              right: isPos ? undefined : "50%",
              backgroundColor: isPos ? "var(--color-accent)" : "var(--color-muted)",
            }}
          />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[0.5rem] text-faint">
          <span>−100 heavy</span>
          <span>neutral</span>
          <span>light +100</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mt-6 grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-surface/50">
        <div className="px-4 py-3">
          <p className="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-faint">Messages</p>
          <p className="mt-1 font-mono text-lg font-medium tabular-nums text-ink">{day.count}</p>
        </div>
        <div className="px-4 py-3">
          <p className="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-faint">vs Avg</p>
          <p
            className="mt-1 font-mono text-lg font-medium tabular-nums"
            style={{ color: vsAvg >= 0 ? "var(--color-accent)" : "var(--color-muted)" }}
          >
            {vsAvg >= 0 ? "+" : ""}{(vsAvg * 100).toFixed(0)}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-faint">Day</p>
          <p className="mt-1 font-mono text-lg font-medium tabular-nums text-ink">
            {index + 1}
            <span className="text-sm text-faint">/{total}</span>
          </p>
        </div>
      </div>
    </div>
  );
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

  const avgScore = days.length
    ? days.reduce((s, d) => s + d.score, 0) / days.length
    : 0;

  const timelineData = days.map((day, i) => ({
    title: shortDate(day.date),
    content: (
      <DayCard
        key={day.date}
        day={day}
        index={i}
        total={days.length}
        avgScore={avgScore}
      />
    ),
  }));

  return (
    <>
      {/* Dot pattern — fixed so it stays behind all scrolling content */}
      <div className="pointer-events-none fixed inset-0 z-0 text-accent/[0.18]">
        <DotPattern width={20} height={20} cx={2} cy={2} cr={1.1} className="fill-current" />
      </div>
    <Shell width="wide">
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
          {/* Summary strip */}
          <div className="mb-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Days charted", value: days.length, color: "text-ink" },
              { label: "Lighter days", value: days.filter((d) => d.score >= 0).length, color: "text-accent" },
              { label: "Heavier days", value: days.filter((d) => d.score < 0).length, color: "text-muted" },
              { label: "Avg sentiment", value: `${avgScore >= 0 ? "+" : ""}${(avgScore * 100).toFixed(0)}`, color: avgScore >= 0 ? "text-accent" : "text-muted" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-line bg-surface/60 px-4 py-3">
                <p className="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-faint">{s.label}</p>
                <p className={`mt-1 font-mono text-xl font-semibold tabular-nums ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Animated overview chart */}
          <SentimentChart days={days} />

          {/* TracingBeam (zig-zag SVG on far left) + AceternityTimeline (growing line inside) */}
          <TracingBeam>
            <AceternityTimeline data={timelineData} />
          </TracingBeam>

          <button
            onClick={build}
            className="mt-4 cursor-pointer font-mono text-[0.66rem] uppercase tracking-[0.18em] text-faint transition-colors hover:text-accent"
          >
            ↻ Rebuild
          </button>
        </div>
      )}
    </Shell>
    </>
  );
}
