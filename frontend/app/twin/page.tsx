"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Shell,
  PageHeader,
  AccentButton,
  GhostButton,
  Thinking,
  StateNote,
  Reveal,
} from "../ui";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Status = {
  health_days: number;
  calendar_events: number;
  trained: boolean;
  detail?: string;
  train_accuracy?: number;
  days?: number;
  stressed_days?: number;
  window?: { from: string; to: string };
  baseline?: Record<string, number | string>;
};

type Simulation = {
  current_risk: number;
  current_level: string;
  simulated_risk: number;
  simulated_level: string;
  change: number;
  drivers: Record<string, number>;
  summary: string;
};

type CurvePoint = { extra_meeting_hours: number; risk: number };
type Scenarios = { curves: { current_sleep: CurvePoint[]; plus_1h_sleep: CurvePoint[] } };

const LEVEL_TEXT: Record<string, string> = {
  low: "text-ink",
  moderate: "text-accent-soft",
  high: "text-accent",
};

async function jsonOrThrow(r: Response) {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail ?? `HTTP ${r.status}`);
  return d;
}

export default function Twin() {
  const [status, setStatus] = useState<Status | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");
  const [meetings, setMeetings] = useState(0);
  const [sleep, setSleep] = useState(0);
  const [sim, setSim] = useState<Simulation | null>(null);
  const [scenarios, setScenarios] = useState<Scenarios | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const d = await jsonOrThrow(await fetch(`${API}/twin/status`));
      setStatus(d);
      if (d.trained) {
        setScenarios(await jsonOrThrow(await fetch(`${API}/twin/scenarios`)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backend unreachable");
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const simulate = useCallback(async (m: number, s: number) => {
    try {
      const d = await jsonOrThrow(
        await fetch(`${API}/twin/simulate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extra_meeting_hours: m, sleep_delta_hours: s }),
        }),
      );
      setSim(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    }
  }, []);

  // Debounced what-if: slider drags fire one request, not dozens.
  useEffect(() => {
    if (!status?.trained) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => simulate(meetings, sleep), 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [meetings, sleep, status?.trained, simulate]);

  async function seedAndTrain() {
    setSeeding(true);
    setError("");
    try {
      await jsonOrThrow(await fetch(`${API}/calendar/seed`, { method: "POST" }));
      await jsonOrThrow(await fetch(`${API}/health-data/seed`, { method: "POST" }));
      await jsonOrThrow(await fetch(`${API}/twin/train`, { method: "POST" }));
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seeding failed");
    } finally {
      setSeeding(false);
    }
  }

  const baseline = status?.baseline as
    | { meeting_hours: number; sleep_hours: number; hrv_ms: number }
    | undefined;

  return (
    <Shell width="wide">
      <PageHeader
        kicker="Digital Twin"
        title="Simulate"
        lead="A small model of you, fit on your calendar load and your body's response to it. Move the levers and watch what next week does to your stress risk — before you live it."
      />

      {error && <StateNote>⚠ {error}</StateNote>}

      {!status && !error && <Thinking label="Waking the twin…" />}

      {status && !status.trained && (
        <Reveal className="flex flex-col items-start gap-6">
          <StateNote>
            The twin needs calendar and health history to learn from.
            {status.detail ? ` ${status.detail}` : ""} Currently:{" "}
            {status.calendar_events} events, {status.health_days} days of health data.
          </StateNote>
          <AccentButton onClick={seedAndTrain} disabled={seeding}>
            {seeding ? "Training…" : "Load demo data & train"}
          </AccentButton>
        </Reveal>
      )}

      {status?.trained && (
        <div className="flex flex-col gap-14">
          {/* Model provenance */}
          <Reveal>
            <p className="font-mono text-[0.64rem] uppercase tracking-[0.2em] text-faint">
              Trained on {status.days} days ({status.window?.from} →{" "}
              {status.window?.to}) · {status.stressed_days} high-stress days ·{" "}
              {Math.round((status.train_accuracy ?? 0) * 100)}% fit
            </p>
          </Reveal>

          {/* Baseline KPI row */}
          {baseline && sim && (
            <Reveal stagger className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Current risk" value={`${Math.round(sim.current_risk * 100)}%`} tone={LEVEL_TEXT[sim.current_level]} sub={`${sim.current_level} · per day`} />
              <Stat label="Meetings" value={`${baseline.meeting_hours}h`} sub="per day, last 2 wks" />
              <Stat label="Sleep" value={`${baseline.sleep_hours}h`} sub="per night, last 2 wks" />
              <Stat label="HRV" value={`${Math.round(baseline.hrv_ms)}ms`} sub="last 2 wks avg" />
            </Reveal>
          )}

          {/* What-if levers */}
          <Reveal className="card rounded-2xl border border-line bg-surface p-7 sm:p-9">
            <p className="kicker mb-8 text-faint">What if next week…</p>
            <div className="flex flex-col gap-8 sm:flex-row sm:gap-14">
              <Lever
                label="Meeting load"
                value={meetings}
                display={`${meetings > 0 ? "+" : ""}${meetings}h / week`}
                min={-10}
                max={15}
                step={1}
                onChange={setMeetings}
              />
              <Lever
                label="Sleep"
                value={sleep}
                display={`${sleep > 0 ? "+" : ""}${sleep}h / night`}
                min={-2}
                max={2}
                step={0.5}
                onChange={setSleep}
              />
            </div>

            {sim && (
              <div className="mt-10 flex flex-col gap-5 border-t border-line pt-8 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="kicker mb-2 text-faint">Simulated risk</p>
                  <p className={`font-display text-6xl font-medium leading-none tracking-tight ${LEVEL_TEXT[sim.simulated_level]}`}>
                    {Math.round(sim.simulated_risk * 100)}%
                  </p>
                </div>
                <p className="max-w-md text-[0.98rem] leading-relaxed text-muted">
                  {sim.summary}
                  {Object.keys(sim.drivers).length > 0 && (
                    <span className="mt-2 block font-mono text-[0.62rem] uppercase tracking-[0.18em] text-faint">
                      {Object.entries(sim.drivers)
                        .map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${Math.round(v * 100)}pt`)
                        .join(" · ")}
                    </span>
                  )}
                </p>
              </div>
            )}
          </Reveal>

          {/* Risk curves */}
          {scenarios && (
            <Reveal className="card rounded-2xl border border-line bg-surface p-7 sm:p-9">
              <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
                <p className="kicker text-faint">Risk vs meeting load</p>
                <div className="flex items-center gap-5 font-mono text-[0.62rem] uppercase tracking-[0.16em]">
                  <span className="flex items-center gap-2 text-muted">
                    <span className="h-0.5 w-4 rounded-full bg-accent" /> current sleep
                  </span>
                  <span className="flex items-center gap-2 text-muted">
                    <span className="h-0.5 w-4 rounded-full bg-faint" /> +1h sleep
                  </span>
                </div>
              </div>
              <RiskChart curves={scenarios.curves} atMeetings={meetings} />
              <p className="mt-5 text-[0.9rem] leading-relaxed text-faint">
                The gap between the lines is what an extra hour of sleep buys you
                at every meeting load.
              </p>
            </Reveal>
          )}

          <div>
            <GhostButton onClick={seedAndTrain} disabled={seeding}>
              {seeding ? "Retraining…" : "Retrain on latest data"}
            </GhostButton>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "text-ink",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-5">
      <p className="kicker mb-3 text-faint">{label}</p>
      <p className={`font-display text-3xl font-medium tracking-tight ${tone}`}>{value}</p>
      <p className="mt-1.5 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-faint">
        {sub}
      </p>
    </div>
  );
}

function Lever({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-1 flex-col gap-3">
      <span className="flex items-baseline justify-between">
        <span className="kicker text-faint">{label}</span>
        <span className="font-mono text-[0.72rem] tracking-[0.08em] text-ink">
          {display}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-line-2 accent-[var(--color-accent)]"
      />
      <span className="flex justify-between font-mono text-[0.56rem] tracking-[0.12em] text-faint">
        <span>{min > 0 ? `+${min}` : min}h</span>
        <span>{max > 0 ? `+${max}` : max}h</span>
      </span>
    </label>
  );
}

/* Two-series emphasis line chart: your current trajectory in accent, the
   +1h-sleep alternative in gray. Crosshair tooltip on hover/touch. */
function RiskChart({
  curves,
  atMeetings,
}: {
  curves: Scenarios["curves"];
  atMeetings: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 640;
  const H = 260;
  const PAD = { l: 44, r: 96, t: 12, b: 34 };
  const pts = curves.current_sleep;
  const xs = pts.map((p) => p.extra_meeting_hours);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const x = (h: number) => PAD.l + ((h - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r);
  const y = (r: number) => PAD.t + (1 - r) * (H - PAD.t - PAD.b);

  const path = (c: CurvePoint[]) =>
    c.map((p, i) => `${i ? "L" : "M"}${x(p.extra_meeting_hours)},${y(p.risk)}`).join("");

  function locate(clientX: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let dist = Infinity;
    xs.forEach((h, i) => {
      const d = Math.abs(x(h) - px);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setHover(best);
  }

  const hi = hover;
  const marker = xs.includes(atMeetings) ? xs.indexOf(atMeetings) : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full touch-none select-none"
      role="img"
      aria-label="Daily high-stress probability across weekly meeting-hour changes, at current sleep and with one extra hour of sleep"
      onPointerMove={(e) => locate(e.clientX)}
      onPointerLeave={() => setHover(null)}
    >
      {/* Recessive grid: risk quartiles */}
      {[0, 0.25, 0.5, 0.75, 1].map((r) => (
        <g key={r}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(r)}
            y2={y(r)}
            stroke="var(--color-line)"
            strokeWidth="1"
          />
          <text
            x={PAD.l - 8}
            y={y(r) + 3}
            textAnchor="end"
            fill="var(--color-faint)"
            fontSize="9"
            fontFamily="var(--font-mono, monospace)"
          >
            {Math.round(r * 100)}%
          </text>
        </g>
      ))}
      {/* X labels */}
      {xs.map((h) => (
        <text
          key={h}
          x={x(h)}
          y={H - 12}
          textAnchor="middle"
          fill="var(--color-faint)"
          fontSize="9"
          fontFamily="var(--font-mono, monospace)"
        >
          {h > 0 ? `+${h}` : h}h
        </text>
      ))}

      {/* Context series first (under), subject on top */}
      <path d={path(curves.plus_1h_sleep)} fill="none" stroke="var(--color-faint)" strokeWidth="2" strokeLinecap="round" />
      <path d={path(curves.current_sleep)} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />

      {/* Direct labels at line ends */}
      <text x={W - PAD.r + 10} y={y(curves.current_sleep[pts.length - 1].risk) + 3} fill="var(--color-muted)" fontSize="9.5" fontFamily="var(--font-mono, monospace)">
        current sleep
      </text>
      <text x={W - PAD.r + 10} y={y(curves.plus_1h_sleep[pts.length - 1].risk) + 3} fill="var(--color-faint)" fontSize="9.5" fontFamily="var(--font-mono, monospace)">
        +1h sleep
      </text>

      {/* Where your meeting slider currently sits */}
      {marker !== null && hi === null && (
        <circle
          cx={x(xs[marker])}
          cy={y(curves.current_sleep[marker].risk)}
          r="4.5"
          fill="var(--color-accent)"
          stroke="var(--color-surface)"
          strokeWidth="2"
        />
      )}

      {/* Crosshair + tooltip */}
      {hi !== null && (
        <g>
          <line
            x1={x(xs[hi])}
            x2={x(xs[hi])}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke="var(--color-line-2)"
            strokeWidth="1"
          />
          <circle cx={x(xs[hi])} cy={y(curves.current_sleep[hi].risk)} r="4.5" fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="2" />
          <circle cx={x(xs[hi])} cy={y(curves.plus_1h_sleep[hi].risk)} r="4.5" fill="var(--color-faint)" stroke="var(--color-surface)" strokeWidth="2" />
          {(() => {
            const tx = Math.min(x(xs[hi]) + 10, W - PAD.r - 120);
            return (
              <g transform={`translate(${tx}, ${PAD.t + 6})`}>
                <rect width="118" height="52" rx="8" fill="var(--color-surface-2)" stroke="var(--color-line-2)" />
                <text x="10" y="16" fill="var(--color-faint)" fontSize="8.5" fontFamily="var(--font-mono, monospace)">
                  {xs[hi] > 0 ? `+${xs[hi]}` : xs[hi]}h meetings/wk
                </text>
                <text x="10" y="31" fill="var(--color-ink)" fontSize="9.5" fontFamily="var(--font-mono, monospace)">
                  now: {Math.round(curves.current_sleep[hi].risk * 100)}%
                </text>
                <text x="10" y="45" fill="var(--color-muted)" fontSize="9.5" fontFamily="var(--font-mono, monospace)">
                  +1h sleep: {Math.round(curves.plus_1h_sleep[hi].risk * 100)}%
                </text>
              </g>
            );
          })()}
        </g>
      )}
    </svg>
  );
}
