"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Shell,
  AccentButton,
  GhostButton,
  Thinking,
  StateNote,
  Reveal,
} from "../ui";
import { API } from "../api";
import { HeroParallax, type ParallaxCard } from "../components/hero-parallax";

/* ── Precomputed static data (module-level, outside component) ── */
const HRV_VALS = [42,48,44,52,38,45,50,47,43,55,41,49,46,53,40,48,44,50,47,43,51,45,49,46];
const HRV_BARS = HRV_VALS.map((v, i) => ({ i, v, fill: `rgba(200,100,50,${(0.2 + (v/80)*0.6).toFixed(2)})` }));

const CAL_FILLS = [0.55,0.22,0.68,0.11,0.45,0.72,0.33,0.61,0.28,0.49,0.74,0.19,0.57,0.38,0.65,0.42,0.29,0.71,0.53,0.36,0.63,0.47,0.25,0.58,0.41,0.67,0.34,0.59,0.23,0.76,0.48,0.31,0.62,0.44,0.27];
const CAL_CELLS = CAL_FILLS.map((f, idx) => ({
  k: idx,
  x: (idx % 7) * 27 + 5,
  y: Math.floor(idx / 7) * 26 + 5,
  fill: f > 0.45 ? `rgba(255,125,60,${(0.2 + f * 0.5).toFixed(2)})` : "rgba(255,255,255,0.04)",
}));

const HEAT_VALS = [0.55,0.22,0.71,0.38,0.65,0.19,0.82,0.44,0.61,0.29,0.75,0.52,0.33,0.68,0.47,0.24,0.77,0.41,0.58,0.36,0.69,0.53,0.28,0.62,0.48,0.31,0.74,0.57,0.23,0.66,0.43,0.79,0.35,0.51,0.27,0.64,0.49,0.72,0.38,0.55,0.21,0.67,0.45,0.81,0.34,0.59,0.26,0.73,0.42,0.56,0.30,0.68,0.47,0.76,0.22,0.61,0.39,0.54,0.28,0.70,0.46,0.83,0.37,0.52,0.25,0.65,0.43,0.78,0.33,0.60,0.41,0.74,0.29,0.57,0.36,0.69,0.48,0.84,0.23,0.63,0.40,0.55,0.32,0.71,0.50,0.26,0.66,0.44,0.77,0.38,0.53,0.27,0.62,0.45,0.80,0.35,0.58,0.24,0.67,0.42,0.75,0.31,0.59,0.46,0.22,0.64,0.51,0.79,0.28,0.60,0.37,0.72,0.49,0.25,0.68,0.39,0.56,0.30,0.73,0.43,0.81,0.34,0.57,0.26,0.65,0.44,0.76,0.32,0.61,0.48,0.21,0.66,0.41,0.78,0.36,0.53,0.27,0.70,0.47,0.82,0.33,0.55,0.24,0.63,0.50,0.29,0.74,0.40,0.58,0.23,0.67,0.45,0.80,0.37,0.54,0.28,0.69,0.46,0.72,0.35,0.62,0.43,0.77,0.31,0.56,0.25];
const HEALTH_HIST = [62,58,65,70,68,72,69,75,71,74,78,76];
const FOCUS_WIN = [[20,80,40],[100,140,60],[180,220,55]] as [number,number,number][];
const HEATMAP_CELLS = Array.from({length: 168}, (_, idx) => ({
  k: idx,
  x: (idx % 24) * 8,
  y: Math.floor(idx / 24) * 18,
  fill: `rgba(255,125,60,${((HEAT_VALS[idx % HEAT_VALS.length] ?? 0.4) * 0.75).toFixed(2)})`,
}));

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

  const parallaxCards: ParallaxCard[] = [
    {
      title: "Sleep Analysis", kicker: "Biometrics", accent: "rgba(255,125,60,0.3)",
      visual: (
        <svg viewBox="0 0 240 80" className="w-full">
          <path d="M0,40 C30,10 60,70 90,40 C120,10 150,70 180,40 C210,10 230,50 240,40"
            fill="none" stroke="rgba(255,125,60,0.8)" strokeWidth="2" strokeLinecap="round"/>
          <path d="M0,40 C30,10 60,70 90,40 C120,10 150,70 180,40 C210,10 230,50 240,40"
            fill="none" stroke="rgba(255,125,60,0.15)" strokeWidth="12" strokeLinecap="round"/>
          <text x="120" y="65" textAnchor="middle" fill="rgba(255,125,60,0.5)" fontSize="10" fontFamily="monospace">7.4 h avg</text>
        </svg>
      ),
    },
    {
      title: "Meeting Load", kicker: "Calendar", accent: "rgba(255,100,40,0.3)",
      visual: (
        <svg viewBox="0 0 240 100" className="w-full">
          {[30,55,40,70,50,35,60].map((h, i) => (
            <rect key={i} x={10 + i * 32} y={100 - h} width={22} height={h} rx="4"
              fill={i === 3 ? "rgba(255,125,60,0.85)" : "rgba(255,125,60,0.25)"}/>
          ))}
          <text x="120" y="16" textAnchor="middle" fill="rgba(255,125,60,0.5)" fontSize="9" fontFamily="monospace">MON–SUN</text>
        </svg>
      ),
    },
    {
      title: "Stress Risk Index", kicker: "Prediction", accent: "rgba(255,70,30,0.35)",
      visual: (
        <svg viewBox="0 0 200 120" className="w-full">
          <path d="M20,100 A80,80 0 0,1 180,100" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" strokeLinecap="round"/>
          <path d="M20,100 A80,80 0 0,1 180,100" fill="none" stroke="rgba(255,80,30,0.8)" strokeWidth="12"
            strokeLinecap="round" strokeDasharray="251" strokeDashoffset="100"/>
          <text x="100" y="88" textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="26" fontFamily="monospace" fontWeight="600">62%</text>
          <text x="100" y="108" textAnchor="middle" fill="rgba(255,80,30,0.6)" fontSize="9" fontFamily="monospace">MODERATE</text>
        </svg>
      ),
    },
    {
      title: "HRV Baseline", kicker: "Heart Rate Variability", accent: "rgba(200,100,50,0.3)",
      visual: (
        <svg viewBox="0 0 240 80" className="w-full">
          {HRV_BARS.map((b) => (
            <rect key={b.i} x={b.i * 10} y={80 - b.v} width={7} height={b.v} rx="2" fill={b.fill}/>
          ))}
          <text x="120" y="14" textAnchor="middle" fill="rgba(200,100,50,0.6)" fontSize="9" fontFamily="monospace">47 ms avg</text>
        </svg>
      ),
    },
    {
      title: "Recovery Score", kicker: "Readiness", accent: "rgba(232,217,196,0.25)",
      visual: (
        <svg viewBox="0 0 160 160" className="w-48 mx-auto">
          <circle cx="80" cy="80" r="60" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8"/>
          <circle cx="80" cy="80" r="60" fill="none" stroke="rgba(232,217,196,0.8)" strokeWidth="8"
            strokeLinecap="round" strokeDasharray="377" strokeDashoffset="94"
            style={{transform: "rotate(-90deg)", transformOrigin: "80px 80px"}}/>
          <text x="80" y="75" textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="28" fontFamily="monospace" fontWeight="600">75</text>
          <text x="80" y="96" textAnchor="middle" fill="rgba(232,217,196,0.5)" fontSize="9" fontFamily="monospace">/ 100</text>
        </svg>
      ),
    },
    {
      title: "What-If Simulation", kicker: "Scenario Modeling", accent: "rgba(255,125,60,0.3)",
      visual: (
        <svg viewBox="0 0 240 100" className="w-full">
          <path d="M10,80 C50,80 70,40 120,35 C170,30 200,20 230,15"
            fill="none" stroke="rgba(255,125,60,0.8)" strokeWidth="2" strokeLinecap="round"/>
          <path d="M10,80 C50,80 70,55 120,52 C170,49 200,42 230,38"
            fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3"/>
          <circle cx="120" cy="35" r="5" fill="rgba(255,125,60,0.9)" stroke="rgba(0,0,0,0.5)" strokeWidth="2"/>
          <text x="120" y="20" textAnchor="middle" fill="rgba(255,125,60,0.7)" fontSize="9" fontFamily="monospace">simulated</text>
        </svg>
      ),
    },
    {
      title: "Calendar Integration", kicker: "Data Source", accent: "rgba(180,90,40,0.3)",
      visual: (
        <svg viewBox="0 0 200 140" className="w-full">
          {CAL_CELLS.map((c) => (
            <rect key={c.k} x={c.x} y={c.y} width={22} height={20} rx="4"
              fill={c.fill} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
          ))}
        </svg>
      ),
    },
    {
      title: "Burnout Forecast", kicker: "30-Day Outlook", accent: "rgba(255,60,20,0.35)",
      visual: (
        <svg viewBox="0 0 240 100" className="w-full">
          <defs>
            <linearGradient id="burnGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(232,217,196,0.8)"/>
              <stop offset="60%" stopColor="rgba(255,125,60,0.8)"/>
              <stop offset="100%" stopColor="rgba(255,60,20,0.9)"/>
            </linearGradient>
          </defs>
          <path d="M10,70 C40,68 70,60 100,50 C130,40 160,28 230,15"
            fill="none" stroke="url(#burnGrad)" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M10,70 C40,68 70,60 100,50 C130,40 160,28 230,15 L230,100 L10,100 Z"
            fill="url(#burnGrad)" opacity="0.07"/>
          <text x="230" y="12" textAnchor="end" fill="rgba(255,60,20,0.7)" fontSize="9" fontFamily="monospace">high risk</text>
        </svg>
      ),
    },
    {
      title: "Energy Timeline", kicker: "Daily Rhythm", accent: "rgba(255,140,60,0.3)",
      visual: (
        <svg viewBox="0 0 240 80" className="w-full">
          {[45,60,75,80,70,55,40,30,50,70,75,65,45,35,25,20,30,45,55,60,50,40,30,20].map((v, i) => (
            <rect key={i} x={i * 10} y={80 - v} width={8} height={v} rx="1"
              fill={`rgba(255,140,60,${0.15 + (v/80)*0.65})`}/>
          ))}
          <text x="120" y="14" textAnchor="middle" fill="rgba(255,140,60,0.4)" fontSize="9" fontFamily="monospace">00:00 → 23:59</text>
        </svg>
      ),
    },
    {
      title: "Sleep Debt", kicker: "Cumulative Deficit", accent: "rgba(150,80,40,0.3)",
      visual: (
        <svg viewBox="0 0 240 100" className="w-full">
          <path d="M10,20 L10,85 L230,85" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
          <path d="M10,60 C40,55 70,50 100,42 C130,34 160,28 200,20 C215,16 225,14 230,12"
            fill="none" stroke="rgba(150,80,40,0.8)" strokeWidth="2" strokeLinecap="round"/>
          <path d="M10,60 C40,55 70,50 100,42 C130,34 160,28 200,20 C215,16 225,14 230,12 L230,85 L10,85 Z"
            fill="rgba(150,80,40,0.12)"/>
          <text x="120" y="96" textAnchor="middle" fill="rgba(150,80,40,0.5)" fontSize="9" fontFamily="monospace">-3.2 h this week</text>
        </svg>
      ),
    },
    {
      title: "Focus Windows", kicker: "Cognitive Peak", accent: "rgba(232,217,196,0.22)",
      visual: (
        <svg viewBox="0 0 240 80" className="w-full">
          {FOCUS_WIN.map((win, i) => (
            <rect key={i} x={win[0]} y={80 - win[2]} width={win[1] - win[0]} height={win[2]} rx="6"
              fill={`rgba(232,217,196,${(0.15 + i*0.08).toFixed(2)})`}
              stroke="rgba(232,217,196,0.2)" strokeWidth="1"/>
          ))}
          <text x="30" y="72" fill="rgba(232,217,196,0.4)" fontSize="8" fontFamily="monospace">9am</text>
          <text x="112" y="72" fill="rgba(232,217,196,0.4)" fontSize="8" fontFamily="monospace">1pm</text>
          <text x="192" y="72" fill="rgba(232,217,196,0.4)" fontSize="8" fontFamily="monospace">5pm</text>
        </svg>
      ),
    },
    {
      title: "Cortisol Rhythm", kicker: "Hormonal Pattern", accent: "rgba(255,100,50,0.28)",
      visual: (
        <svg viewBox="0 0 240 80" className="w-full">
          <path d="M0,60 C20,55 35,20 50,18 C65,16 80,25 100,35 C130,50 160,55 180,52 C200,49 220,45 240,42"
            fill="none" stroke="rgba(255,100,50,0.75)" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="50" cy="18" r="4" fill="rgba(255,100,50,0.9)"/>
          <text x="50" y="10" textAnchor="middle" fill="rgba(255,100,50,0.6)" fontSize="8" fontFamily="monospace">peak</text>
        </svg>
      ),
    },
    {
      title: "Rest Optimization", kicker: "Sleep Staging", accent: "rgba(180,110,60,0.28)",
      visual: (
        <svg viewBox="0 0 240 80" className="w-full">
          {[
            {y:10,h:15,label:"Deep"},
            {y:30,h:20,label:"REM"},
            {y:55,h:20,label:"Light"},
          ].map((band, i) => (
            <g key={i}>
              <rect x="20" y={band.y} width={160 + i * 20} height={band.h} rx="3"
                fill={`rgba(180,110,60,${0.15 + i * 0.12})`}/>
              <text x="12" y={band.y + band.h / 2 + 3} textAnchor="end" fill="rgba(180,110,60,0.5)"
                fontSize="8" fontFamily="monospace">{band.label}</text>
            </g>
          ))}
        </svg>
      ),
    },
    {
      title: "Daily Patterns", kicker: "Behavioural Map", accent: "rgba(255,125,60,0.25)",
      visual: (
        <svg viewBox="0 0 200 120" className="w-full">
          {HEATMAP_CELLS.map((c) => (
            <rect key={c.k} x={c.x} y={c.y} width={7} height={14} rx="2" fill={c.fill}/>
          ))}
        </svg>
      ),
    },
    {
      title: "Health History", kicker: "Longitudinal Data", accent: "rgba(220,140,80,0.25)",
      visual: (
        <svg viewBox="0 0 240 80" className="w-full">
          {HEALTH_HIST.map((v, i) => (
            <g key={i}>
              <circle cx={10 + i * 20} cy={80 - v} r="3" fill="rgba(220,140,80,0.8)"/>
              {i > 0 && <line x1={10 + (i-1) * 20} y1={80 - (HEALTH_HIST[i-1] ?? v)}
                x2={10 + i * 20} y2={80 - v} stroke="rgba(220,140,80,0.4)" strokeWidth="1.5"/>}
            </g>
          ))}
        </svg>
      ),
    },
  ];

  const parallaxHeader = (
    <div className="relative left-0 top-0 mx-auto w-full max-w-7xl px-8 pt-16 pb-6 md:pt-24 md:pb-8">
      <motion.p
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-4 flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.24em]"
        style={{ color: "rgba(255,125,60,0.7)" }}
      >
        <motion.span className="h-1.5 w-1.5 rounded-full bg-accent"
          animate={{ scale: [1, 1.7, 1], opacity: [1, 0.3, 1] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
        />
        Digital Twin
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 20, filter: "blur(12px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="font-display text-[3.6rem] font-medium leading-[0.9] tracking-tight text-ink md:text-7xl"
      >
        Simulate<br />your future self
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.28 }}
        className="mt-6 max-w-[46ch] text-[1rem] leading-relaxed text-muted"
      >
        A small model of you, fit on your calendar load and your body&rsquo;s response to it.
        Move the levers and watch what next week does to your stress — before you live it.
      </motion.p>
    </div>
  );

  return (
    <>
      <HeroParallax cards={parallaxCards} header={parallaxHeader} />
      <Shell width="wide">

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
    </>
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
