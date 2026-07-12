"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Shell,
  AccentButton,
  GhostButton,
  Thinking,
  StateNote,
  Reveal,
} from "../ui";
import { API } from "../api";
import { CardContainer, CardBody, CardItem } from "../components/card-3d";
import { OrbitingCircles } from "../components/orbiting-circles";

type Series = { values: number[]; potentials: number[]; spikes: boolean[] };
type Neuron = { id: string; label: string; note: string; trips: number; series: Series };
type Trip = { date: string; neuron: string; label: string; current: number; note: string };
type Report = {
  ran_at: string;
  days: number;
  from: string | null;
  to: string | null;
  dates: string[];
  params: { decay: number; threshold: number; baseline_window: number };
  neurons: Neuron[];
  trips: Trip[];
  fresh_trips: Trip[];
  woke_agent: boolean;
};

const SHOW_DAYS = 120; // days of history in chart

async function jsonOrThrow(r: Response) {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail ?? `HTTP ${r.status}`);
  return d;
}

export default function Tripwire() {
  const [report, setReport] = useState<Report | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${API}/snn/report`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setReport(d))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const scan = useCallback(async (wake: boolean) => {
    setScanning(true);
    setError("");
    try {
      const d = await jsonOrThrow(
        await fetch(`${API}/snn/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wake }),
        }),
      );
      setReport(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }, []);

  const meta = report
    ? `${report.days} days (${report.from} → ${report.to}) · ${report.trips.length} trips · leak ${report.params.decay} · threshold ${report.params.threshold}${report.woke_agent ? " · agent woken — see the Agent page" : ""}`
    : null;

  return (
    <>
      {/* Full-span orbiting circles — fixed behind the whole page */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
      >
        <div className="relative flex h-full w-full items-center justify-center">
          {/* Outer orbit — 6 icons, large radius to span the viewport */}
          <OrbitingCircles radius={580} duration={60} iconSize={44} path className="text-accent/30">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="44" height="44">
              <path d="M2 12h3l2-7 3 14 3-10 2 3h7" />
            </svg>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="44" height="44">
              <path d="M2 12C4.5 6.5 19.5 6.5 22 12C19.5 17.5 4.5 17.5 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="44" height="44">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="44" height="44">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M2 12h4M18 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="44" height="44">
              <ellipse cx="12" cy="6" rx="8" ry="3" />
              <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
              <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
            </svg>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="44" height="44">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
            </svg>
          </OrbitingCircles>
          {/* Inner orbit — 4 icons, reverse */}
          <OrbitingCircles radius={320} duration={35} iconSize={34} reverse path className="text-muted/25">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="34" height="34">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M12 2v4M8 11V7a4 4 0 018 0v4" />
              <circle cx="9" cy="16" r="1" fill="currentColor" stroke="none" />
              <circle cx="15" cy="16" r="1" fill="currentColor" stroke="none" />
            </svg>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="34" height="34">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="34" height="34">
              <path d="M13 2L4.09 12.96A1 1 0 005 14.5h6.5l-1 7.5L20 9.04A1 1 0 0019 7.5h-6.5z" />
            </svg>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="34" height="34">
              <rect x="2" y="3" width="20" height="5" rx="1" />
              <path d="M4 8v11a2 2 0 002 2h12a2 2 0 002-2V8M10 12h4" />
            </svg>
          </OrbitingCircles>
        </div>
      </div>

    <Shell width="wide">
      {/* Hero heading */}
      <div className="pb-10 pt-4">
        <p className="kicker mb-4 text-faint">SNN Tripwire</p>
        <h1 className="font-display text-5xl leading-tight tracking-tight text-ink md:text-7xl">
          A spiking net that watches
        </h1>
        <p className="font-display text-5xl italic leading-tight tracking-tight text-accent md:text-7xl">
          so you don{"'"}t have to.
        </p>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted">
          One leaky neuron per stream. A single odd day decays away; a sustained
          anomaly accumulates until the wire trips. No LLM until then.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <AccentButton onClick={() => scan(false)} disabled={scanning}>
            {scanning ? "Scanning…" : report ? "Scan again" : "Scan the archive"}
          </AccentButton>
          <GhostButton onClick={() => scan(true)} disabled={scanning}>
            Scan + wake agent on fresh trip
          </GhostButton>
        </div>
      </div>

      <div className="py-10">
        {error && <StateNote>{"⚠ " + error}</StateNote>}
        {scanning && <Thinking label="Replaying the spiking layer over your history…" />}
        {!scanning && loaded && !report && !error && (
          <StateNote>No scans yet — hit Scan to replay the net over everything ingested.</StateNote>
        )}
        {!scanning && report && (
          <div className="flex flex-col gap-12">
            <Reveal>
              <p className="font-mono text-[0.64rem] uppercase tracking-[0.2em] text-faint">{meta}</p>
            </Reveal>

            {report.fresh_trips.length > 0 && (
              <Reveal className="card rounded-2xl border border-accent/40 bg-surface p-6">
                <p className="kicker mb-3 text-accent">Tripped — right now</p>
                {report.fresh_trips.map((t, i) => (
                  <p key={i} className="text-[0.98rem] leading-relaxed text-ink">
                    {t.date}{" — "}
                    <span className="text-accent">{t.label}</span>{": "}
                    <span className="text-muted">{t.note}</span>
                  </p>
                ))}
              </Reveal>
            )}

            <div>
              <p className="kicker mb-5 text-faint">The layer — one neuron per stream</p>
              <Reveal stagger className="grid gap-6 sm:grid-cols-2">
                {report.neurons.map((n) => (
                  <NeuronCard
                    key={n.id}
                    neuron={n}
                    dates={report.dates}
                    threshold={report.params.threshold}
                  />
                ))}
              </Reveal>
            </div>

            {report.trips.length > 0 && (
              <div>
                <p className="kicker mb-5 text-faint">Trip log</p>
                <Reveal className="card overflow-hidden rounded-2xl border border-line bg-surface">
                  {[...report.trips].reverse().map((t, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line px-6 py-3.5 last:border-b-0"
                    >
                      <span className="font-mono text-[0.68rem] tracking-[0.08em] text-faint">{t.date}</span>
                      <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink">{t.label}</span>
                      <span className="text-[0.85rem] text-muted">{t.note}</span>
                    </div>
                  ))}
                </Reveal>
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
    </>
  );
}

function NeuronCard({
  neuron,
  dates,
  threshold,
}: {
  neuron: Neuron;
  dates: string[];
  threshold: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const n = dates.length;
  const start = Math.max(0, n - SHOW_DAYS);
  const ds = dates.slice(start);
  const pots = neuron.series.potentials.slice(start);
  const spikes = neuron.series.spikes.slice(start);

  const W = 320;
  const H = 96;
  const PAD = { l: 6, r: 6, t: 10, b: 16 };
  const yMax = Math.max(threshold * 1.25, ...pots);
  const x = (i: number) => PAD.l + (i / Math.max(1, ds.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / yMax) * (H - PAD.t - PAD.b);
  const path = pots.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join("");

  function locate(clientX: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (ds.length - 1));
    setHover(Math.min(ds.length - 1, Math.max(0, i)));
  }

  return (
    <CardContainer containerClassName="w-full" className="w-full">
      {/* CardBody is the physical card surface */}
      <CardBody
        className="w-full rounded-2xl border border-line bg-surface p-5"
        style={{
          boxShadow: "0 0 0 1px rgba(255,255,255,0.03) inset, 0 24px 48px -16px rgba(0,0,0,0.7)",
        }}
      >
        {/* Header row — pops out most */}
        <CardItem
          translateZ={80}
          className="mb-1 flex w-full items-baseline justify-between gap-3"
        >
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-ink">
            {neuron.label}
          </p>
          <p className={`font-mono text-[0.6rem] tracking-[0.1em] ${neuron.trips ? "text-accent" : "text-faint"}`}>
            {neuron.trips ? `${neuron.trips} trip${neuron.trips === 1 ? "" : "s"}` : "quiet"}
          </p>
        </CardItem>

        {/* Note — mid depth */}
        <CardItem translateZ={40} className="w-full">
          <p className="mb-3 text-[0.78rem] leading-snug text-faint">{neuron.note}</p>
        </CardItem>

        {/* Chart — furthest forward */}
        <CardItem translateZ={100} className="w-full">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full touch-none select-none"
              role="img"
              aria-label={`${neuron.label}: membrane potential over the last ${ds.length} days, ${neuron.trips} trips`}
              onPointerMove={(e) => locate(e.clientX)}
              onPointerLeave={() => setHover(null)}
            >
              <line
                x1={PAD.l} x2={W - PAD.r}
                y1={y(threshold)} y2={y(threshold)}
                stroke="var(--color-line-2)" strokeWidth="1" strokeDasharray="3 4"
              />
              <path
                d={path} fill="none"
                stroke="var(--color-accent)" strokeWidth="1.6"
                strokeLinecap="round" opacity="0.85"
              />
              {spikes.map((s, i) =>
                s ? (
                  <circle
                    key={i} cx={x(i)} cy={y(threshold)} r="3.5"
                    fill="var(--color-accent)"
                    stroke="var(--color-surface)" strokeWidth="1.5"
                  />
                ) : null,
              )}
              {hover !== null && (
                <g>
                  <line
                    x1={x(hover)} x2={x(hover)}
                    y1={PAD.t} y2={H - PAD.b}
                    stroke="var(--color-line-2)" strokeWidth="1"
                  />
                  <circle
                    cx={x(hover)} cy={y(pots[hover])} r="3"
                    fill="var(--color-accent)"
                    stroke="var(--color-surface)" strokeWidth="1.5"
                  />
                  <text
                    x={x(hover) > W / 2 ? x(hover) - 8 : x(hover) + 8}
                    y={PAD.t + 8}
                    textAnchor={x(hover) > W / 2 ? "end" : "start"}
                    fill="var(--color-muted)" fontSize="9"
                    fontFamily="var(--font-mono, monospace)"
                  >
                    {ds[hover]} · V={pots[hover].toFixed(1)}{spikes[hover] ? " · fired" : ""}
                  </text>
                </g>
              )}
              <text x={PAD.l} y={H - 4} fill="var(--color-faint)" fontSize="8.5" fontFamily="var(--font-mono, monospace)">
                {ds[0]}
              </text>
              <text x={W - PAD.r} y={H - 4} textAnchor="end" fill="var(--color-faint)" fontSize="8.5" fontFamily="var(--font-mono, monospace)">
                {ds[ds.length - 1]}
              </text>
            </svg>
          </CardItem>
      </CardBody>
    </CardContainer>
  );
}
