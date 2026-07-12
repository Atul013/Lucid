"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { Shell } from "../ui";
import { API } from "../api";
import SideRays from "../components/side-rays";
import { BorderBeam } from "../components/border-beam";
import { VanishInput } from "../components/vanish-input";

type Align = { goal: string; status: "on-track" | "drifting" | "stalled" | string; note: string };

const STATUS = {
  "on-track": { color: "#e8d9c4", glow: "rgba(232,217,196,0.14)", label: "On track", border: "rgba(232,217,196,0.2)" },
  drifting:   { color: "#ff7d3c", glow: "rgba(255,125,60,0.18)",  label: "Drifting",  border: "rgba(255,125,60,0.32)" },
  stalled:    { color: "#756a5d", glow: "rgba(117,106,93,0.10)",  label: "Stalled",   border: "rgba(117,106,93,0.18)" },
} as const;

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&";

/* ─────────────────────────────────────────────────────────────────────────── */
/* Matrix-scramble title                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */
function ScrambleText({ text, delay = 0 }: { text: string; delay?: number }) {
  // Use actual text on first render (SSR-safe), scramble starts in useEffect
  const [displayed, setDisplayed] = useState(text);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let frame = 0;
    const totalFrames = 28;
    let raf: number;
    const start = performance.now() + delay * 1000;

    function tick(now: number) {
      if (now < start) { raf = requestAnimationFrame(tick); return; }
      frame++;
      const progress = Math.min(frame / totalFrames, 1);
      const lockedCount = Math.floor(progress * text.length);
      setDisplayed(
        text.split("").map((ch, i) =>
          i < lockedCount ? ch : CHARS[Math.floor(Math.random() * CHARS.length)]
        ).join("")
      );
      if (frame < totalFrames) raf = requestAnimationFrame(tick);
      else setDone(true);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, delay]);

  return (
    <span style={{ display: "inline-block", fontVariantNumeric: "tabular-nums" }}>
      {displayed.split("").map((ch, i) => (
        <span key={i} style={{ display: "inline-block" }}>{ch}</span>
      ))}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Floating ambient orbs                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */
function FloatingOrbs() {
  const orbs = [
    { size: 440, x: "10%",  y: "5%",  color: "rgba(255,125,60,0.07)", dur: 18, dx: 65, dy: 42 },
    { size: 340, x: "70%",  y: "20%", color: "rgba(255,80,15,0.055)", dur: 24, dx: -52, dy: 58 },
    { size: 280, x: "35%",  y: "55%", color: "rgba(255,160,80,0.06)", dur: 20, dx: 42, dy: -38 },
    { size: 210, x: "80%",  y: "65%", color: "rgba(255,50,5,0.042)",  dur: 30, dx: -32, dy: 52 },
  ];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 1 }}>
      {orbs.map((o, i) => (
        <motion.div key={i}
          style={{
            position: "absolute", width: o.size, height: o.size, left: o.x, top: o.y,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${o.color}, transparent 70%)`,
            filter: "blur(44px)",
          }}
          animate={{ x: [0, o.dx, 0, -o.dx * 0.5, 0], y: [0, o.dy, -o.dy * 0.6, o.dy * 0.3, 0] }}
          transition={{ repeat: Infinity, duration: o.dur, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Film grain overlay                                                           */
/* ─────────────────────────────────────────────────────────────────────────── */
function Grain() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0" style={{
      zIndex: 2,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      backgroundRepeat: "repeat", backgroundSize: "200px 200px",
      opacity: 0.026, mixBlendMode: "overlay",
    }} />
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Streaming text — types itself out like Claude                               */
/* ─────────────────────────────────────────────────────────────────────────── */
function StreamText({ text, speed = 14, delay = 0, onDone }: {
  text: string; speed?: number; delay?: number; onDone?: () => void;
}) {
  const [displayed, setDisplayed] = useState("");
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    setDisplayed(""); setFinished(false);
    let i = 0;
    const outer = setTimeout(() => {
      const ticker = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) { clearInterval(ticker); setFinished(true); onDone?.(); }
      }, speed);
      return () => clearInterval(ticker);
    }, delay * 1000);
    return () => clearTimeout(outer);
  }, [text, speed, delay]);

  return (
    <>
      {displayed}
      {!finished && (
        <motion.span aria-hidden
          animate={{ opacity: [1, 0] }}
          transition={{ repeat: Infinity, duration: 0.5, ease: "linear" }}
          style={{ display: "inline-block", width: 1.5, height: "1em", background: "currentColor", marginLeft: 2, verticalAlign: "text-bottom" }}
        />
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Thinking dots                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */
function ThinkingDots({ label }: { label: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="flex items-center gap-4"
    >
      <div className="flex items-center gap-[5px]">
        {[0, 1, 2].map(i => (
          <motion.span key={i} className="block h-[7px] w-[7px] rounded-full" style={{ background: "#ff7d3c" }}
            animate={{ y: [0, -10, 0], scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.16, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </div>
      <span className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted">{label}</span>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Score ring                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */
function ScoreRing({ alignment }: { alignment: Align[] }) {
  const onTrack = alignment.filter(a => a.status === "on-track").length;
  const pct = alignment.length > 0 ? onTrack / alignment.length : 0;
  const R = 52, CIRC = 2 * Math.PI * R;
  const color = pct > 0.6 ? "#e8d9c4" : pct > 0.3 ? "#ff7d3c" : "#756a5d";

  return (
    <motion.div initial={{ opacity: 0, scale: 0.88, filter: "blur(12px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-8"
    >
      <div className="relative flex-shrink-0">
        <svg width={120} height={120} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={60} cy={60} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
          <motion.circle cx={60} cy={60} r={R} fill="none" stroke={color} strokeWidth={6}
            strokeLinecap="round" strokeDasharray={CIRC}
            initial={{ strokeDashoffset: CIRC }}
            animate={{ strokeDashoffset: CIRC * (1 - pct) }}
            transition={{ delay: 0.55, duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <motion.span className="font-mono text-xl font-medium tabular-nums text-ink"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
          >{Math.round(pct * 100)}%</motion.span>
          <motion.span className="font-mono text-[0.5rem] uppercase tracking-[0.14em] text-faint"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}
          >aligned</motion.span>
        </div>
      </div>

      <div className="space-y-3">
        <p className="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-faint">Alignment score</p>
        {[
          { label: "On track", count: alignment.filter(a => a.status === "on-track").length, color: "#e8d9c4" },
          { label: "Drifting",  count: alignment.filter(a => a.status === "drifting").length,  color: "#ff7d3c" },
          { label: "Stalled",   count: alignment.filter(a => a.status === "stalled").length,   color: "#756a5d" },
        ].map((row, i) => (
          <motion.div key={row.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.5 + i * 0.1 }} className="flex items-center gap-2.5"
          >
            <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: row.color }} />
            <span className="font-mono text-[0.72rem] text-muted w-16">{row.label}</span>
            <span className="font-mono text-[0.72rem] text-ink tabular-nums">{row.count}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Particle burst                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */
type Particle = { id: number; x: number; y: number; vx: number; vy: number; size: number };

function ParticleBurst({ origin }: { origin: { x: number; y: number } | null }) {
  if (!origin) return null;
  const particles: Particle[] = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2 + Math.random() * 0.5;
    const speed = 45 + Math.random() * 95;
    return { id: i, x: origin.x, y: origin.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: 3 + Math.random() * 4 };
  });

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: 50 }}>
      {particles.map(p => (
        <motion.div key={p.id}
          style={{ position: "absolute", left: p.x, top: p.y, width: p.size, height: p.size,
            borderRadius: "50%", background: Math.random() > 0.45 ? "#ff7d3c" : "#e8d9c4" }}
          initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          animate={{ opacity: 0, x: p.vx, y: p.vy, scale: 0.1 }}
          transition={{ duration: 0.7 + Math.random() * 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Magnetic CTA button                                                          */
/* ─────────────────────────────────────────────────────────────────────────── */
function MagneticButton({ children, onClick, disabled }: {
  children: React.ReactNode; onClick?: (e: React.MouseEvent) => void; disabled?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0), y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 160, damping: 16 });
  const sy = useSpring(y, { stiffness: 160, damping: 16 });

  return (
    <motion.button ref={ref} style={{ x: sx, y: sy }}
      onMouseMove={e => {
        if (!ref.current || disabled) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * 0.24);
        y.set((e.clientY - r.top - r.height / 2) * 0.24);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className="group relative inline-flex cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-surface-2 px-7 py-4 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <motion.div aria-hidden className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }} whileHover={{ opacity: 1 }} transition={{ duration: 0.35 }}
        style={{ background: "radial-gradient(circle at 50% 110%, rgba(255,125,60,0.28), transparent 65%)" }}
      />
      <motion.div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(105deg, transparent 30%, rgba(255,125,60,0.22) 50%, transparent 70%)", backgroundSize: "200% 100%" }}
        animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
        transition={{ repeat: Infinity, duration: 3.2, ease: "linear", repeatDelay: 1 }}
      />
      <span className="relative z-10 font-mono text-[0.72rem] uppercase tracking-[0.22em] text-ink transition-colors duration-300 group-hover:text-accent">
        {children}
      </span>
      <motion.span aria-hidden
        className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/5 font-mono text-sm text-faint transition-colors duration-300 group-hover:bg-accent/20 group-hover:text-accent"
        whileHover={{ scale: 1.14, x: 2, y: -1 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >↗</motion.span>
    </motion.button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* 3D-tilt goal row                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */
function GoalRow({ goal, onRemove, index }: { goal: string; onRemove: () => void; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const rotX = useMotionValue(0), rotY = useMotionValue(0);
  const sRotX = useSpring(rotX, { stiffness: 300, damping: 30 });
  const sRotY = useSpring(rotY, { stiffness: 300, damping: 30 });

  return (
    <motion.li layout
      initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: -14, filter: "blur(6px)" }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      style={{ perspective: 600 }}
    >
      <motion.div ref={ref} style={{ rotateX: sRotX, rotateY: sRotY, transformStyle: "preserve-3d" }}
        onMouseMove={e => {
          if (!ref.current) return;
          const r = ref.current.getBoundingClientRect();
          rotX.set(-((e.clientY - r.top) / r.height - 0.5) * 7);
          rotY.set(((e.clientX - r.left) / r.width - 0.5) * 7);
        }}
        onMouseLeave={() => { rotX.set(0); rotY.set(0); }}
      >
        <div className="rounded-2xl p-px transition-all duration-500"
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.02) 100%)" }}
        >
          <div className="group flex items-center justify-between gap-4 rounded-[calc(1rem-1px)] px-5 py-3.5 transition-all duration-300 hover:[box-shadow:inset_0_0_30px_rgba(255,125,60,0.07)]"
            style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}
          >
            <span className="flex items-center gap-3 text-[0.95rem] text-ink">
              <motion.span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "rgba(255,125,60,0.65)" }}
                animate={{ scale: [1, 1.5, 1], opacity: [0.65, 1, 0.65] }}
                transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
              />
              {goal}
            </span>
            <motion.button onClick={onRemove} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }}
              className="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-faint transition-colors duration-200 hover:text-accent"
            >Remove</motion.button>
          </div>
        </div>
      </motion.div>
    </motion.li>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Result card — 3D tilt + scan line + streaming text + delayed badge         */
/* ─────────────────────────────────────────────────────────────────────────── */
function ResultCard({ item, index, onStreamDone }: { item: Align; index: number; onStreamDone: () => void }) {
  const [textDone, setTextDone] = useState(false);
  const cfg = STATUS[item.status as keyof typeof STATUS] ?? STATUS.stalled;
  const ref = useRef<HTMLDivElement>(null);
  const rotX = useMotionValue(0), rotY = useMotionValue(0);
  const sRotX = useSpring(rotX, { stiffness: 260, damping: 28 });
  const sRotY = useSpring(rotY, { stiffness: 260, damping: 28 });

  function handleDone() {
    setTextDone(true);
    onStreamDone();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 22, rotate: -1, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, rotate: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.7, delay: index * 0.15, ease: [0.22, 1, 0.36, 1] }}
      style={{ perspective: 900 }}
    >
      <motion.div ref={ref} style={{ rotateX: sRotX, rotateY: sRotY, transformStyle: "preserve-3d" }}
        onMouseMove={e => {
          if (!ref.current) return;
          const r = ref.current.getBoundingClientRect();
          rotX.set(-((e.clientY - r.top) / r.height - 0.5) * 5);
          rotY.set(((e.clientX - r.left) / r.width - 0.5) * 5);
        }}
        onMouseLeave={() => { rotX.set(0); rotY.set(0); }}
      >
        {/* Outer bezel */}
        <div className="rounded-[1.4rem] p-px"
          style={{
            background: `linear-gradient(135deg, ${cfg.border}, rgba(255,255,255,0.03))`,
            boxShadow: `0 0 50px -12px ${cfg.glow}, 0 24px 60px -20px rgba(0,0,0,0.65)`,
          }}
        >
          {/* Inner core */}
          <div className="relative overflow-hidden rounded-[calc(1.4rem-1px)] p-6"
            style={{
              background: "linear-gradient(160deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.008) 100%)",
              backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -1px 0 rgba(0,0,0,0.12)",
            }}
          >
            {/* Scan line while streaming */}
            <AnimatePresence>
              {!textDone && (
                <motion.div aria-hidden exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
                  className="pointer-events-none absolute left-0 right-0 h-[1px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}55, transparent)` }}
                  animate={{ top: ["0%", "100%"] }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }}
                />
              )}
            </AnimatePresence>

            {/* BorderBeam while streaming */}
            <AnimatePresence>
              {!textDone && (
                <motion.div exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
                  <BorderBeam colorFrom={cfg.color} duration={2.2} size={75} borderRadius={21} opacity={0.48} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Left accent bar */}
            <motion.div className="absolute left-0 top-5 bottom-5 w-[2px] rounded-full"
              style={{ background: `linear-gradient(180deg, ${cfg.color}, ${cfg.color}40)`, opacity: 0.8 }}
              initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
              transition={{ delay: index * 0.15 + 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />

            <div className="pl-5">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-[0.98rem] font-medium leading-snug text-ink">{item.goal}</h3>
                <AnimatePresence>
                  {textDone && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.6, filter: "blur(8px)" }}
                      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                      transition={{ type: "spring", stiffness: 280, damping: 18 }}
                      className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[0.58rem] uppercase tracking-[0.18em]"
                      style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}28`, color: cfg.color }}
                    >
                      <motion.span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }}
                        animate={item.status !== "on-track" ? { scale: [1, 1.7, 1], opacity: [1, 0.35, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 1.6 }}
                      />
                      {cfg.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              <p className="mt-3 text-[0.93rem] leading-relaxed text-muted">
                <StreamText text={item.note} speed={14} delay={index * 0.15 + 0.35} onDone={handleDone} />
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Page                                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */
export default function Drift() {
  const [goals, setGoals] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [alignment, setAlignment] = useState<Align[] | null>(null);
  const [scoreVisible, setScoreVisible] = useState(false);
  const [streamDoneCount, setStreamDoneCount] = useState(0);
  const [error, setError] = useState(false);
  const [burst, setBurst] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    fetch(`${API}/drift/goals`)
      .then(r => r.json()).then(d => setGoals(d.goals ?? [])).catch(() => setError(true));
  }, []);

  // Show score ring after all cards finish streaming
  useEffect(() => {
    if (alignment && streamDoneCount >= alignment.length && alignment.length > 0) {
      const t = setTimeout(() => setScoreVisible(true), 500);
      return () => clearTimeout(t);
    }
  }, [streamDoneCount, alignment]);

  const persist = useCallback(async (next: string[]) => {
    setGoals(next); setSaved(false);
    await fetch(`${API}/drift/goals`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goals: next }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }, []);

  function add(value: string) {
    const g = value.trim(); if (!g) return;
    persist([...goals, g]);
  }

  async function check(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setBurst({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    setTimeout(() => setBurst(null), 900);

    setChecking(true); setAlignment(null); setScoreVisible(false); setStreamDoneCount(0);
    try {
      const r = await fetch(`${API}/drift/check`, { method: "POST" });
      if (!r.ok) throw new Error();
      setAlignment((await r.json()).alignment ?? []);
    } catch { setError(true); } finally { setChecking(false); }
  }

  return (
    <Shell>
      {/* ── Fixed atmosphere layers ── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <SideRays rayColor1="#ff7d3c" rayColor2="#4a0e00" origin="top-right"
          intensity={2.9} spread={4.2} opacity={0.52} saturation={1.1} blend={0.44} falloff={1.1} speed={1.4} />
      </div>
      <FloatingOrbs />
      <Grain />
      <ParticleBurst origin={burst} />

      <div className="relative" style={{ zIndex: 3 }}>

        {/* ══ HEADER ════════════════════════════════════════════════════════ */}
        <motion.header initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }} className="mb-16"
        >
          {/* Eyebrow pill */}
          <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.1 }} className="mb-6 inline-flex"
          >
            <span className="flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.22em]"
              style={{ background: "rgba(255,125,60,0.07)", border: "1px solid rgba(255,125,60,0.2)", color: "rgba(255,125,60,0.8)" }}
            >
              <motion.span className="h-1.5 w-1.5 rounded-full bg-accent"
                animate={{ scale: [1, 1.8, 1], opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.7, ease: "easeInOut" }}
              />
              Accountability Engine
            </span>
          </motion.div>

          {/* Scramble title */}
          <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="text-[3.8rem] font-medium leading-[0.88] tracking-tight text-ink sm:text-7xl"
          >
            <ScrambleText text="Drift" delay={0.25} />
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="mt-5 max-w-[48ch] text-[1rem] leading-relaxed text-muted"
          >
            State what matters once. Lucid reads your archive and tells you
            whether your days are moving toward your goals — or quietly drifting away.
          </motion.p>
        </motion.header>

        {/* ══ GOALS ═════════════════════════════════════════════════════════ */}
        <section className="mb-10">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="mb-5 flex items-center gap-2.5 font-mono text-[0.6rem] uppercase tracking-[0.24em] text-faint"
          >
            <span className="h-px w-5 bg-line-2" />
            <AnimatePresence mode="wait">
              <motion.span key={goals.length}
                initial={{ opacity: 0, y: -8, scale: 1.3 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
              >
                {goals.length === 0 ? "No goals yet" : `${goals.length} ${goals.length === 1 ? "goal" : "goals"}`}
              </motion.span>
            </AnimatePresence>
          </motion.p>

          <ul className="grid gap-2">
            <AnimatePresence mode="popLayout">
              {goals.map((g, i) => (
                <GoalRow key={g + i} goal={g} index={i} onRemove={() => persist(goals.filter((_, idx) => idx !== i))} />
              ))}
            </AnimatePresence>
          </ul>

          {/* Add input — VanishInput with cycling placeholders */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="mt-2.5"
          >
            {/* Gradient bezel wrapper */}
            <div className="rounded-2xl p-px"
              style={{ background: "linear-gradient(135deg, rgba(255,125,60,0.28) 0%, rgba(255,255,255,0.05) 100%)" }}
            >
              <VanishInput
                placeholders={[
                  "e.g. land an AI internship by August",
                  "e.g. ship a product people actually use",
                  "e.g. build a consistent workout habit",
                  "e.g. read 2 books per month",
                  "e.g. reach out to 3 new people a week",
                ]}
                onSubmit={add}
              />
            </div>

            <AnimatePresence>
              {saved && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="mt-2.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-accent/70"
                >✓ Saved</motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </section>

        {/* ══ CTA ═══════════════════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {goals.length > 0 && (
            <motion.section key="cta" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="mb-16"
            >
              {checking
                ? <ThinkingDots label="Reading your archive against your goals…" />
                : <MagneticButton onClick={check}>Check my drift</MagneticButton>
              }
            </motion.section>
          )}
        </AnimatePresence>

        {/* ══ RESULTS ═══════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {alignment && (
            <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }} aria-live="polite">

              {/* Score ring — appears after all cards stream in */}
              <AnimatePresence>
                {scoreVisible && alignment.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className="mb-10 rounded-[1.4rem] p-px"
                    style={{
                      background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
                      boxShadow: "0 20px 50px -20px rgba(0,0,0,0.5)",
                    }}
                  >
                    <div className="rounded-[calc(1.4rem-1px)] p-6"
                      style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}
                    >
                      <ScoreRing alignment={alignment} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="mb-6 flex items-center gap-2.5 font-mono text-[0.6rem] uppercase tracking-[0.24em] text-faint">
                <span className="h-px w-5 bg-line-2" />
                {alignment.length} goal{alignment.length !== 1 ? "s" : ""} assessed
              </p>

              <div className="grid gap-4">
                {alignment.map((a, i) => (
                  <ResultCard key={i} item={a} index={i} onStreamDone={() => setStreamDoneCount(c => c + 1)} />
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mt-8 text-[0.94rem] text-muted"
            >
              Couldn&rsquo;t reach the backend on <span className="font-mono text-faint">localhost:8000</span>.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </Shell>
  );
}
