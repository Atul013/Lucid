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
import { API } from "../api";

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

const SHOW_DAYS = 120; // charts show the recent window; older history is noise

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

  return (
    <Shell width="wide">
      <PageHeader
        kicker="SNN Tripwire"
        title="Sense"
        lead="A spiking net keeps watch over the rhythm of your life — email bursts, meeting overload, late nights, spending, stress, silence. One leaky neuron per stream: a single odd day decays away, a sustained anomaly accumulates until the wire trips. No LLM until then — the trip is what wakes it."
      >
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <AccentButton onClick={() => scan(false)} disabled={scanning}>
            {scanning ? "Scanning…" : report ? "Scan again" : "Scan the archive"}
          </AccentButton>
          <GhostButton onClick={() => scan(true)} disabled={scanning}>
            Scan + wake agent on fresh trip
          </GhostButton>
        </div>
      </PageHeader>

      {error && <StateNote>⚠ {error}</StateNote>}
      {scanning && <Thinking label="Replaying the spiking layer over your history…" />}
      {!scanning && loaded && !report && !error && (
        <StateNote>No scans yet — hit Scan to replay the net over everything ingested.</StateNote>
      )}

      {!scanning && report && (
        <div className="flex flex-col gap-12">
          {/* Scan header */}
          <Reveal>
            <p className="font-mono text-[0.64rem] uppercase tracking-[0.2em] text-faint">
              {report.days} days ({report.from} → {report.to}) · {report.trips.length} trips ·
              leak {report.params.decay} · threshold {report.params.threshold}
              {report.woke_agent && " · agent woken — see the Agent page"}
            </p>
          </Reveal>

          {/* Fresh trips banner */}
          {report.fresh_trips.length > 0 && (
            <Reveal className="card rounded-2xl border border-accent/40 bg-surface p-6">
              <p className="kicker mb-3 text-accent">Tripped — right now</p>
              {report.fresh_trips.map((t, i) => (
                <p key={i} className="text-[0.98rem] leading-relaxed text-ink">
                  {t.date} — <span className="text-accent">{t.label}</span>:{" "}
                  <span className="text-muted">{t.note}</span>
                </p>
              ))}
            </Reveal>
          )}

          {/* Neuron small multiples */}
          <div>
            <p className="kicker mb-5 text-faint">The layer — one neuron per stream</p>
            <Reveal stagger className="grid gap-4 sm:grid-cols-2">
              {report.neurons.map((n) => (
                <NeuronCard key={n.id} neuron={n} dates={report.dates} threshold={report.params.threshold} />
              ))}
            </Reveal>
          </div>

          {/* Trip log */}
          {report.trips.length > 0 && (
            <div>
              <p className="kicker mb-5 text-faint">Trip log</p>
              <Reveal className="card overflow-hidden rounded-2xl border border-line bg-surface">
                {[...report.trips].reverse().map((t, i) => (
                  <div key={i} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line px-6 py-3.5 last:border-b-0">
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
    </Shell>
  );
}

/* One neuron: membrane potential over the recent window, dashed threshold,
   spike markers where it fired. Crosshair tooltip on hover. */
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
    <div className="card rounded-2xl border border-line bg-surface p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-ink">{neuron.label}</p>
        <p className={`font-mono text-[0.6rem] tracking-[0.1em] ${neuron.trips ? "text-accent" : "text-faint"}`}>
          {neuron.trips ? `${neuron.trips} trip${neuron.trips === 1 ? "" : "s"}` : "quiet"}
        </p>
      </div>
      <p className="mb-3 text-[0.78rem] leading-snug text-faint">{neuron.note}</p>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={`${neuron.label}: membrane potential over the last ${ds.length} days, ${neuron.trips} trips`}
        onPointerMove={(e) => locate(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        {/* threshold */}
        <line
          x1={PAD.l} x2={W - PAD.r} y1={y(threshold)} y2={y(threshold)}
          stroke="var(--color-line-2)" strokeWidth="1" strokeDasharray="3 4"
        />
        {/* membrane potential */}
        <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
        {/* spikes */}
        {spikes.map((s, i) =>
          s ? (
            <circle key={i} cx={x(i)} cy={y(threshold)} r="3.5"
              fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="1.5" />
          ) : null,
        )}
        {/* crosshair tooltip */}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-line-2)" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(pots[hover])} r="3" fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="1.5" />
            <text
              x={x(hover) > W / 2 ? x(hover) - 8 : x(hover) + 8}
              y={PAD.t + 8}
              textAnchor={x(hover) > W / 2 ? "end" : "start"}
              fill="var(--color-muted)" fontSize="9" fontFamily="var(--font-mono, monospace)"
            >
              {ds[hover]} · V={pots[hover].toFixed(1)}{spikes[hover] ? " · fired" : ""}
            </text>
          </g>
        )}
        {/* x labels: first + last date */}
        <text x={PAD.l} y={H - 4} fill="var(--color-faint)" fontSize="8.5" fontFamily="var(--font-mono, monospace)">
          {ds[0]}
        </text>
        <text x={W - PAD.r} y={H - 4} textAnchor="end" fill="var(--color-faint)" fontSize="8.5" fontFamily="var(--font-mono, monospace)">
          {ds[ds.length - 1]}
        </text>
      </svg>
    </div>
  );
}
