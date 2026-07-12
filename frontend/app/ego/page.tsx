"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shell, Thinking, StateNote, AccentButton, Arrow, CountUp } from "../ui";
import { GlassRain } from "../components/glass-rain";
import SideRays from "../components/side-rays";
import { API } from "../api";


type Theme = { title: string; detail: string };
type Insights = {
  generated: boolean;
  generated_at?: string;
  sample_size?: number;
  summary?: string;
  themes?: Theme[];
};

type State =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "generating" }
  | { kind: "error" }
  | { kind: "done"; data: Insights };

export default function Ego() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    fetch(`${API}/ego/insights`)
      .then((r) => r.json())
      .then((d: Insights) =>
        setState(d.generated ? { kind: "done", data: d } : { kind: "empty" })
      )
      .catch(() => setState({ kind: "error" }));
  }, []);

  async function analyze() {
    setState({ kind: "generating" });
    try {
      const r = await fetch(`${API}/ego/analyze`, { method: "POST" });
      if (!r.ok) throw new Error();
      setState({ kind: "done", data: await r.json() });
    } catch {
      setState({ kind: "error" });
    }
  }

  return (
    <Shell>
      {/* SideRays — WebGL atmospheric light behind all page content */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <SideRays
          rayColor1="#ff7d3c"
          rayColor2="#3a1a08"
          origin="top-right"
          intensity={3.2}
          spread={4.5}
          opacity={0.72}
          saturation={1.2}
          blend={0.48}
          falloff={1.1}
          speed={1.8}
        />
      </div>

      {/* Page header — glass panel with frosted backdrop */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 mb-10 overflow-hidden rounded-2xl px-8 py-7"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(18px) saturate(1.6)",
          WebkitBackdropFilter: "blur(18px) saturate(1.6)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -1px 0 rgba(255,255,255,0.02), 0 16px 40px -16px rgba(0,0,0,0.6)",
        }}
      >
        <GlassEdge />
        <GlassLeftEdge />
        <p className="kicker text-faint">Behavioral Mirror</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">Ego</h1>
        <p className="mt-3 max-w-[55ch] text-[0.97rem] leading-relaxed text-muted">
          The patterns a single message can&rsquo;t show you — what holds your
          attention, and the texture of your days.
        </p>
      </motion.div>

      {/* Content sits above SideRays */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {state.kind === "loading" && <Thinking label="Loading your patterns…" />}
        {state.kind === "error" && (
          <StateNote>
            Couldn&rsquo;t reach the archive. Is the backend running on{" "}
            <span className="font-mono text-faint">localhost:8000</span>?
          </StateNote>
        )}
        {state.kind === "generating" && (
          <Thinking label="Reading across your archive… this takes a moment." />
        )}
        {state.kind === "empty" && <EmptyState onAnalyze={analyze} />}
        {state.kind === "done" && (
          <Report data={state.data} onRerun={analyze} />
        )}
      </div>
    </Shell>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */

function EmptyState({ onAnalyze }: { onAnalyze: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl p-8 sm:p-10"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.09)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.06) inset, 0 0 0 1px rgba(255,255,255,0.015) inset, 0 30px 60px -32px rgba(0,0,0,0.8)",
      }}
    >
      <GlassEdge />
      <p className="text-[1rem] leading-relaxed text-muted">
        Ego reads across your whole archive at once and surfaces the patterns
        you can&rsquo;t see from inside a single conversation.
      </p>
      <AccentButton onClick={onAnalyze} className="mt-8">
        Analyze my archive
        <Arrow />
      </AccentButton>
    </motion.div>
  );
}

/* ── Report ──────────────────────────────────────────────────────────────── */

function Report({ data, onRerun }: { data: Insights; onRerun: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-10"
    >
      <ConfidentialCard summary={data.summary ?? ""} />

      {(data.themes ?? []).length > 0 && (
        <DepthCarousel themes={data.themes ?? []} />
      )}

      <div className="flex items-center gap-5 pt-2">
        <button
          onClick={onRerun}
          className="cursor-pointer font-mono text-[0.66rem] uppercase tracking-[0.18em] text-faint transition-colors hover:text-accent"
        >
          ↻ Re-analyze
        </button>
        {data.sample_size && (
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-faint">
            <CountUp to={data.sample_size} className="text-ink" /> emails read
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* ── Confidential folder card ────────────────────────────────────────────── */

function ConfidentialCard({ summary }: { summary: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative pt-7">
      {/* Folder tab */}
      <div
        className="absolute left-8 top-0 z-10 flex h-7 items-center gap-2 rounded-t-lg px-4"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderBottom: "none",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "rgba(255,125,60,0.65)" }}
        />
        <span className="font-mono text-[0.57rem] uppercase tracking-[0.22em] text-accent/60">
          Behavioral Profile
        </span>
      </div>

      {/* Main glass card */}
      <motion.div
        layout
        className="relative overflow-hidden rounded-2xl rounded-tl-none"
        style={{
          background: "rgba(255,255,255,0.035)",
          border: "1px solid rgba(255,255,255,0.09)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.07) inset, 0 0 0 1px rgba(255,255,255,0.02) inset, 0 40px 80px -32px rgba(0,0,0,0.9)",
        }}
      >
        <GlassEdge />
        <GlassLeftEdge />

        {/* Locked state */}
        <AnimatePresence mode="wait">
          {!open ? (
            <motion.div
              key="locked"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.97, filter: "blur(6px)" }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-8 px-8 py-12 sm:px-12"
            >
              {/* Redacted lines */}
              <div className="w-full space-y-3">
                {[1, 0.72, 0.88, 0.6, 0.92, 0.68].map((w, i) => (
                  <motion.div
                    key={i}
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      width: `${w * 100}%`,
                      transformOrigin: "left",
                      height: 10,
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.06)",
                    }}
                  />
                ))}
              </div>

              {/* Stamp */}
              <div className="flex flex-col items-center gap-3">
                <motion.div
                  initial={{ rotate: -8, opacity: 0, scale: 0.8 }}
                  animate={{ rotate: -4, opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35, duration: 0.5, type: "spring", stiffness: 200, damping: 18 }}
                  className="rounded px-6 py-2"
                  style={{
                    border: "2px solid rgba(255,125,60,0.5)",
                    boxShadow: "0 0 28px rgba(255,125,60,0.14), inset 0 0 12px rgba(255,125,60,0.04)",
                  }}
                >
                  <span
                    className="font-mono text-sm font-bold uppercase tracking-[0.3em]"
                    style={{ color: "rgba(255,125,60,0.75)" }}
                  >
                    Confidential
                  </span>
                </motion.div>
                <span className="font-mono text-[0.58rem] uppercase tracking-[0.2em] text-faint">
                  Level 1 access required
                </span>
              </div>

              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setOpen(true)}
                className="btn-accent rounded-xl px-6 py-2.5 font-mono text-[0.68rem] uppercase tracking-[0.18em]"
              >
                Unlock profile
              </motion.button>
            </motion.div>
          ) : (
            /* Revealed state */
            <motion.div
              key="revealed"
              initial={{ opacity: 0, filter: "blur(14px)", y: 10 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="relative p-8 sm:p-10"
            >
              {/* Decorative glyph */}
              <span
                aria-hidden
                className="pointer-events-none absolute -right-4 -top-8 select-none font-display text-[8rem] leading-none"
                style={{ color: "rgba(255,125,60,0.07)" }}
              >
                ✦
              </span>

              {/* Classification bar */}
              <div className="mb-6 flex items-center gap-3">
                <div className="h-px flex-1" style={{ background: "rgba(255,125,60,0.18)" }} />
                <span className="font-mono text-[0.57rem] uppercase tracking-[0.24em]" style={{ color: "rgba(255,125,60,0.45)" }}>
                  Profile unlocked
                </span>
                <div className="h-px flex-1" style={{ background: "rgba(255,125,60,0.18)" }} />
              </div>

              <p className="relative font-display text-2xl leading-relaxed text-ink sm:text-[1.7rem]">
                {summary}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* ── Depth blur carousel — 3D perspective arc (matches Framer reference) ──── */

const CARD_W = 340;
const CARD_H = 220;

function getArcProps(offset: number) {
  const abs = Math.abs(offset);
  const sign = Math.sign(offset) || 1;
  return {
    translateX: offset * 230,
    rotateY: offset === 0 ? 0 : sign * (abs === 1 ? 32 : abs === 2 ? 52 : 64),
    scale: abs === 0 ? 1 : abs === 1 ? 0.78 : abs === 2 ? 0.6 : 0.46,
    blur: abs === 0 ? 0 : abs === 1 ? 1.5 : abs === 2 ? 4 : 8,
    opacity: abs === 0 ? 1 : abs === 1 ? 0.82 : abs === 2 ? 0.58 : 0.32,
    zIndex: Math.max(1, 12 - abs * 3),
  };
}

function DepthCarousel({ themes }: { themes: Theme[] }) {
  const [active, setActive] = useState(0);
  const n = themes.length;

  // Circular offset: wraps so active card is always center with cards on both sides
  function circularOffset(i: number) {
    const raw = ((i - active) % n + n) % n;
    return raw > n / 2 ? raw - n : raw;
  }

  function prev() { setActive((a) => (a - 1 + n) % n); }
  function next() { setActive((a) => (a + 1) % n); }

  return (
    <div>
      <p className="kicker mb-6 flex items-center gap-2.5 text-faint">
        <span className="h-px w-6 bg-line-2" />
        {themes.length} patterns found
      </p>

      {/* Perspective viewport */}
      <div
        className="relative overflow-hidden"
        style={{
          height: CARD_H + 60,
          perspective: "1100px",
          perspectiveOrigin: "50% 50%",
        }}
      >
        {/* Left/right edge fade */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-30 w-28"
          style={{ background: "linear-gradient(90deg, var(--color-paper) 10%, transparent)" }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-30 w-28"
          style={{ background: "linear-gradient(270deg, var(--color-paper) 10%, transparent)" }}
        />

        {/* Swipe capture layer */}
        <motion.div
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          onPanEnd={(_, info) => {
            if (info.offset.x < -60) next();
            else if (info.offset.x > 60) prev();
          }}
        >
          {themes.map((t, i) => {
            const offset = circularOffset(i);
            const { translateX, rotateY, scale, blur, opacity, zIndex } = getArcProps(offset);
            const isActive = offset === 0;

            return (
              <motion.div
                key={i}
                onClick={() => !isActive && setActive(i)}
                animate={{
                  x: -(CARD_W / 2) + translateX,
                  rotateY,
                  scale,
                  filter: `blur(${blur}px)`,
                  opacity,
                  zIndex,
                }}
                transition={{ type: "spring", stiffness: 260, damping: 28, mass: 1 }}
                style={{
                  position: "absolute",
                  top: 20,
                  left: "50%",
                  width: CARD_W,
                  height: CARD_H,
                  transformStyle: "preserve-3d",
                  cursor: isActive ? "default" : "pointer",
                }}
              >
                {/* Glass panel */}
                <div
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: isActive
                      ? "rgba(255,255,255,0.07)"
                      : "rgba(255,255,255,0.045)",
                    border: `1px solid ${isActive ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.09)"}`,
                    backdropFilter: "blur(22px)",
                    WebkitBackdropFilter: "blur(22px)",
                    boxShadow: isActive
                      ? "0 1px 0 rgba(255,255,255,0.09) inset, 0 0 0 1px rgba(255,255,255,0.025) inset, 0 28px 60px -20px rgba(0,0,0,0.85)"
                      : "0 1px 0 rgba(255,255,255,0.06) inset",
                  }}
                />
                <GlassEdge />
                <GlassLeftEdge />

                {/* Rain on glass */}
                <GlassRain active={isActive} />

                {/* Content */}
                <div className="relative z-10 flex h-full flex-col p-6">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="font-mono text-[0.64rem]"
                      style={{ color: "rgba(255,125,60,0.55)" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h2 className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-accent">
                      {t.title}
                    </h2>
                  </div>
                  <p
                    className="mt-3 flex-1 overflow-hidden text-[0.88rem] leading-relaxed text-ink/90"
                    style={{
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 5,
                    }}
                  >
                    {t.detail}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Nav dots + arrows */}
      <div className="mt-4 flex items-center justify-center gap-4">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={prev}
          disabled={active === 0}
          className="flex h-8 w-8 items-center justify-center rounded-full font-mono text-sm text-muted transition-colors hover:text-accent disabled:opacity-20"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
        >
          ←
        </motion.button>

        <div className="flex items-center gap-1.5">
          {themes.map((_, i) => (
            <motion.button
              key={i}
              onClick={() => setActive(i)}
              animate={{
                width: i === active ? 22 : 6,
                background: i === active ? "#ff7d3c" : "rgba(255,255,255,0.18)",
              }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="h-1.5 rounded-full"
            />
          ))}
        </div>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={next}
          disabled={active === themes.length - 1}
          className="flex h-8 w-8 items-center justify-center rounded-full font-mono text-sm text-muted transition-colors hover:text-accent disabled:opacity-20"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
        >
          →
        </motion.button>
      </div>
    </div>
  );
}

/* ── Glass highlight primitives ──────────────────────────────────────────── */

function GlassEdge() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-2xl"
      style={{
        background:
          "linear-gradient(90deg, transparent, rgba(255,255,255,0.10) 40%, rgba(255,255,255,0.10) 60%, transparent)",
      }}
    />
  );
}

function GlassLeftEdge() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 w-px rounded-l-2xl"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03) 60%, transparent)",
      }}
    />
  );
}
