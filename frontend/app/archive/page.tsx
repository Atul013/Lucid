"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Shell, StateNote, CountUp, Arrow } from "../ui";
import { API } from "../api";
import { RippleBackground } from "../components/ripple-background";
import { VanishInput, VanishInputHandle } from "../components/vanish-input";
import { HoverTooltip } from "../components/hover-tooltip";
import { TextGenerateEffect } from "../components/text-generate-effect";


type Result = { text: string; subject: string; from: string; date: string };

function decode(s: string): string {
  if (typeof document === "undefined") return s;
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value;
}
function senderName(from: string): string {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*</);
  return decode((m ? m[1] : from).trim());
}
function shortDate(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

type Conn = "checking" | "connected" | "disconnected";
type Mode = "ask" | "search";
type Sync =
  | { kind: "idle" }
  | { kind: "syncing" }
  | { kind: "done"; n: number }
  | { kind: "error" };
type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "done"; query: string; results: Result[] };
type AskState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "done"; question: string; answer: string; sources: Result[] };

const ASK_SUGGESTIONS = [
  "What did I commit to this week?",
  "Who have I been talking to most?",
  "Any unresolved threads from last month?",
  "What feedback have I received recently?",
  "Emails still waiting for my reply",
  "What projects am I currently involved in?",
];
const SEARCH_SUGGESTIONS = [
  "project deadline", "follow up", "invoice",
  "meeting notes", "feedback", "urgent",
];
const DEMO_SOURCES: Result[] = [
  {
    subject: "Re: Q3 roadmap — final decisions needed",
    from: "Sarah Chen <sarah.chen@example.com>",
    date: "2024-10-14T09:22:00Z",
    text: "Following up on our call — the deadline is firm at end of month. We need sign-off on the three features we discussed before Thursday.",
  },
  {
    subject: "Invoice #2041 — overdue notice",
    from: "Billing <billing@contractor.io>",
    date: "2024-10-10T14:05:00Z",
    text: "Your invoice from October is 14 days past due. Please settle within 48 hours to avoid service interruption.",
  },
  {
    subject: "Your feedback on the proposal",
    from: "Marcus Webb <m.webb@agency.co>",
    date: "2024-10-08T18:30:00Z",
    text: "Keen to hear your thoughts on the revised scope before we move to contracts.",
  },
  {
    subject: "Missed call — project handover",
    from: "Aisha Patel <aisha@studio.dev>",
    date: "2024-10-07T11:10:00Z",
    text: "Tried you twice this morning. The handover needs to happen before end of week or we lose the slot.",
  },
];

export default function Archive() {
  const [conn, setConn] = useState<Conn>("checking");
  const [mode, setMode] = useState<Mode>("ask");
  const [sync, setSync] = useState<Sync>({ kind: "idle" });
  const [search, setSearch] = useState<SearchState>({ kind: "idle" });
  const [ask, setAsk] = useState<AskState>({ kind: "idle" });
  const [listening, setListening] = useState(false);
  const vanishInputRef = useRef<VanishInputHandle>(null);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [timeAgo, setTimeAgo] = useState("just now");

  useEffect(() => {
    if (!syncedAt) return;
    const tick = () => {
      const mins = Math.floor((Date.now() - syncedAt) / 60000);
      setTimeAgo(mins < 1 ? "just now" : mins === 1 ? "1 min ago" : `${mins} min ago`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [syncedAt]);

  const voiceSupported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  function startVoice() {
    const SR =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
    setListening(true);
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript.trim();
      vanishInputRef.current?.setValue(t);
      run(t);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("connected"))
      window.history.replaceState({}, "", window.location.pathname);
    fetch(`${API}/gmail/status`)
      .then((r) => r.json())
      .then((d) => setConn(d.connected ? "connected" : "disconnected"))
      .catch(() => setConn("disconnected"));
  }, []);

  async function runSync() {
    setSync({ kind: "syncing" });
    try {
      const r = await fetch(`${API}/gmail/sync?max_results=50`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setSync({ kind: "done", n: d.ingested ?? 0 });
      setSyncedAt(Date.now());
    } catch {
      setSync({ kind: "error" });
    }
  }

  async function run(q: string | undefined) {
    if (!q) return;
    if (mode === "search") {
      setSearch({ kind: "loading" });
      try {
        const r = await fetch(`${API}/gmail/search?q=${encodeURIComponent(q)}&n=10`);
        if (!r.ok) throw new Error();
        const d = await r.json();
        setSearch({ kind: "done", query: q, results: d.results ?? [] });
      } catch { setSearch({ kind: "error" }); }
    } else {
      setAsk({ kind: "loading" });
      try {
        const r = await fetch(`${API}/archive/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q }),
        });
        if (!r.ok) throw new Error();
        const d = await r.json();
        setAsk({ kind: "done", question: q, answer: d.answer ?? "", sources: d.sources ?? [] });
      } catch { setAsk({ kind: "error" }); }
    }
  }

  const select = (q: string) => { vanishInputRef.current?.setValue(q); run(q); };
  const activeState = mode === "ask" ? ask : search;

  return (
    <>
      <RippleBackground />
      <Shell width="wide">
        <div className="relative" style={{ zIndex: 1 }}>

          {/* ── Page title ── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mb-7"
          >
            <p className="mb-1.5 font-mono text-[0.6rem] uppercase tracking-[0.24em] text-accent">
              The Archive
            </p>
            <h1 className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
              Ask your memory
            </h1>
          </motion.div>

          {/* ── States ── */}
          {conn === "checking" && (
            <div className="flex items-center gap-3 py-8">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-faint" />
              <span className="font-mono text-[0.64rem] uppercase tracking-[0.2em] text-faint">
                Reaching your archive…
              </span>
            </div>
          )}

          {conn === "disconnected" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-xl rounded-2xl border border-line bg-surface p-8 sm:p-10"
            >
              <h2 className="font-display text-2xl text-ink">Connect your Gmail</h2>
              <p className="mt-3 text-[0.98rem] leading-relaxed text-muted">
                Lucid reads your mail{" "}
                <span className="text-ink">(read-only)</span> and indexes it
                locally — nothing leaves your machine.
              </p>
              <a
                href={`${API}/auth/google`}
                className="btn-accent mt-8 inline-flex h-12 items-center gap-2.5 rounded-full px-7 font-mono text-[0.72rem] font-medium uppercase tracking-[0.18em]"
              >
                Connect Gmail <Arrow />
              </a>
            </motion.div>
          )}

          {conn === "connected" && (
            <div className="flex flex-col gap-3">

              {/* ── Row 1: Search + Status (2fr / 1fr on desktop, stack on mobile) ── */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
                {/* Search card */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col rounded-2xl border border-line bg-surface p-6"
                  style={{ minHeight: 168 }}
                >
                  {/* Mode tabs */}
                  <div
                    className="mb-5 inline-flex self-start gap-1 rounded-full border border-line p-1"
                    role="tablist"
                  >
                    {(["ask", "search"] as Mode[]).map((m) => (
                      <button
                        key={m}
                        role="tab"
                        aria-selected={mode === m}
                        onClick={() => setMode(m)}
                        className={`cursor-pointer rounded-full px-5 py-1.5 font-mono text-[0.64rem] uppercase tracking-[0.2em] transition-all duration-200 ${
                          mode === m
                            ? "bg-surface-2 text-ink shadow-[0_0_18px_-6px_rgba(255,125,60,0.45)]"
                            : "text-faint hover:text-muted"
                        }`}
                      >
                        {m === "ask" ? "Ask" : "Search"}
                      </button>
                    ))}
                  </div>

                  {/* Input + voice */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <VanishInput
                        ref={vanishInputRef}
                        placeholders={
                          mode === "ask"
                            ? [
                                "what did I say about…",
                                "who emailed me about the project?",
                                "what commitments did I make?",
                                "find emails from my manager",
                              ]
                            : [
                                "a conversation, a feeling, a person…",
                                "project deadline",
                                "invoice",
                                "follow up",
                              ]
                        }
                        onSubmit={run}
                      />
                    </div>
                    {voiceSupported && (
                      <button
                        type="button"
                        onClick={startVoice}
                        aria-label="Speak your query"
                        aria-pressed={listening}
                        className={`shrink-0 cursor-pointer rounded-full border p-3 transition-colors ${
                          listening
                            ? "border-accent/40 bg-accent/10 text-accent"
                            : "border-line text-faint hover:border-accent/30 hover:text-accent"
                        }`}
                      >
                        <MicGlyph className="h-5 w-5" listening={listening} />
                      </button>
                    )}
                  </div>
                </motion.div>

                {/* Status card */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.38, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-6"
                  style={{ minHeight: 168 }}
                >
                  <HoverTooltip
                    label={syncedAt ? `Last synced ${timeAgo}` : "Not yet synced this session"}
                  >
                    <span className="flex cursor-default items-center gap-2.5 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted">
                      <span className="h-2 w-2 rounded-full bg-accent pulse-dot" aria-hidden />
                      Gmail connected
                    </span>
                  </HoverTooltip>

                  {sync.kind === "done" && (
                    <p className="font-display text-4xl font-medium text-ink">
                      <CountUp to={sync.n} />
                      <span className="ml-2 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-faint">
                        indexed
                      </span>
                    </p>
                  )}
                  {sync.kind !== "done" && (
                    <p className="font-display text-4xl font-medium text-line-2">—</p>
                  )}

                  <button
                    onClick={runSync}
                    disabled={sync.kind === "syncing"}
                    className="cursor-pointer self-start font-mono text-[0.62rem] uppercase tracking-[0.18em] text-faint transition-colors hover:text-accent disabled:cursor-default disabled:text-line-2"
                  >
                    {sync.kind === "syncing" ? "Syncing…" : "↻ Sync now"}
                  </button>
                </motion.div>
              </div>

              {/* ── Row 2: Suggestion chips (no card border — flat inline) ── */}
              <AnimatePresence>
                {activeState.kind === "idle" && (
                  <motion.div
                    key={`chips-${mode}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-wrap items-center gap-2 px-1 py-1"
                  >
                    <span className="mr-1 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-line-2">
                      {mode === "ask" ? "Try asking" : "Try searching"}
                    </span>
                    {(mode === "ask" ? ASK_SUGGESTIONS : SEARCH_SUGGESTIONS).map((q) => (
                      <button
                        key={q}
                        onClick={() => select(q)}
                        className="rounded-full border border-line-2 px-3.5 py-1.5 font-mono text-[0.62rem] tracking-wide text-faint transition-colors hover:border-accent/35 hover:text-muted"
                      >
                        {q}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Row 3+: Content area ── */}
              <AnimatePresence mode="wait">

                {/* IDLE — demo source cards */}
                {activeState.kind === "idle" && (
                  <motion.div
                    key={`idle-${mode}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="mb-3 flex items-center gap-2 px-1 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-line-2">
                      <span className="h-px w-5 bg-line-2" />
                      Results look like this
                    </p>
                    <SourceBento sources={DEMO_SOURCES} />
                  </motion.div>
                )}

                {/* LOADING */}
                {activeState.kind === "loading" && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <LoadingSkeleton mode={mode} />
                  </motion.div>
                )}

                {/* ASK DONE */}
                {mode === "ask" && ask.kind === "done" && (
                  <motion.div
                    key="ask-done"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <AskResults state={ask} />
                  </motion.div>
                )}

                {/* SEARCH DONE */}
                {mode === "search" && search.kind === "done" && (
                  <motion.div
                    key="search-done"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <SearchResults state={search} />
                  </motion.div>
                )}

                {/* ERROR */}
                {activeState.kind === "error" && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="rounded-2xl border border-line bg-surface px-6 py-5">
                      <p className="text-[0.95rem] text-muted">
                        Couldn&rsquo;t reach the archive. Is the backend running on{" "}
                        <span className="font-mono text-faint">localhost:8000</span>?
                      </p>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          )}
        </div>
      </Shell>
    </>
  );
}

/* ─────────────────────────── Source Bento ─────────────────────────── */

// Bento slot positions for ≤4 cards: hero(2×2) + right column + full-width bottom
const BENTO_SLOTS = [
  { col: "1 / 3", row: "1 / 3" }, // hero — 2 cols × 2 rows
  { col: "3 / 4", row: "1 / 2" }, // top-right square
  { col: "3 / 4", row: "2 / 3" }, // mid-right square
  { col: "1 / 4", row: "3 / 4" }, // full-width bottom
];

// Diagonal wave stagger delays for bento layout (top-left to bottom-right)
const BENTO_DIAG = [0, 1, 2, 1];

function flowSlot(i: number) {
  const spans = [2, 1, 1, 2, 1, 1, 2, 1, 1, 2];
  return { col: `span ${spans[i % spans.length]}`, row: "auto" };
}

function SourceBento({ sources }: { sources: Result[] }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const useBento = sources.length <= 4;

  // Single grid-level mousemove: writes --mx/--my to each card (spotlight),
  // and --rx/--ry to the hovered card only (3D tilt)
  function onGridMove(e: React.MouseEvent<HTMLDivElement>) {
    const grid = gridRef.current;
    if (!grid) return;
    for (const card of Array.from(grid.querySelectorAll<HTMLElement>("[data-card]"))) {
      const r = card.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width;
      const ny = (e.clientY - r.top) / r.height;
      // Always update spotlight position
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
      // 3D tilt only for the card under the cursor
      if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
        card.style.setProperty("--rx", `${(ny - 0.5) * -10}deg`);
        card.style.setProperty("--ry", `${(nx - 0.5) * 10}deg`);
      }
    }
  }

  function onGridLeave() {
    const grid = gridRef.current;
    if (!grid) return;
    for (const card of Array.from(grid.querySelectorAll<HTMLElement>("[data-card]"))) {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    }
  }

  return (
    <div
      ref={gridRef}
      onMouseMove={onGridMove}
      onMouseLeave={onGridLeave}
      className="archive-bento-grid grid gap-3"
      style={
        useBento
          ? {
              gridTemplateColumns: "repeat(3, 1fr)",
              gridTemplateRows: "repeat(3, minmax(108px, auto))",
            }
          : {
              gridTemplateColumns: "repeat(3, 1fr)",
              gridAutoRows: "minmax(108px, auto)",
              gridAutoFlow: "dense",
            }
      }
    >
      {sources.map((r, i) => {
        const slot = useBento ? (BENTO_SLOTS[i] ?? { col: "auto", row: "auto" }) : flowSlot(i);
        const isHero = i === 0 && useBento;
        const isFullWidth = i === 3 && useBento;
        const diag = useBento ? (BENTO_DIAG[i] ?? i) : i;
        const delay = diag * 0.1;

        return (
          <motion.div
            key={i}
            className="bento-cell"
            style={{ gridColumn: slot.col, gridRow: slot.row }}
            variants={{
              hidden: { clipPath: "polygon(0 0, 0 0, 0 100%, 0 100%)", opacity: 0 },
              visible: {
                clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
                opacity: 1,
                transition: { duration: 0.55, delay, ease: [0.25, 0.46, 0.45, 0.94] },
              },
            }}
            initial="hidden"
            animate="visible"
          >
            <BentoCard
              result={r}
              isHero={isHero}
              isFullWidth={isFullWidth}
              contentDelay={delay}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

function BentoCard({
  result,
  isHero,
  isFullWidth,
  contentDelay,
}: {
  result: Result;
  isHero: boolean;
  isFullWidth: boolean;
  contentDelay: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glintRef = useRef<HTMLDivElement>(null);

  function onEnter() {
    const el = cardRef.current;
    if (el) {
      el.style.transition = "transform 0.08s linear, box-shadow 0.25s ease";
      el.style.boxShadow = isHero
        ? "0 24px 50px -10px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,125,60,0.18)"
        : "0 18px 36px -8px rgba(0,0,0,0.38), 0 0 0 1px rgba(255,125,60,0.1)";
    }
    // Glint sweep across the card
    const glint = glintRef.current;
    if (glint) {
      glint.style.transition = "none";
      glint.style.left = "-55%";
      void glint.offsetWidth; // force reflow
      glint.style.transition = "left 0.58s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
      glint.style.opacity = "0.8";
      glint.style.left = "135%";
      const t = setTimeout(() => { if (glintRef.current) glintRef.current.style.opacity = "0"; }, 290);
      cardRef.current?.addEventListener("mouseleave", () => clearTimeout(t), { once: true });
    }
  }

  function onLeave() {
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = "transform 0.55s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.4s ease";
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.boxShadow = "";
  }

  const subject = decode(result.subject) || "(no subject)";
  const sender = senderName(result.from);
  const date = shortDate(result.date);
  const preview = decode(result.text);
  const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

  return (
    <div
      ref={cardRef}
      data-card
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="group relative h-full overflow-hidden rounded-2xl border border-line"
      style={
        {
          "--rx": "0deg",
          "--ry": "0deg",
          "--mx": "50%",
          "--my": "50%",
          transform: "perspective(900px) rotateX(var(--rx)) rotateY(var(--ry))",
          transformStyle: "preserve-3d",
          willChange: "transform",
          background: isHero
            ? "radial-gradient(ellipse 80% 70% at 25% 25%, rgba(255,125,60,0.08) 0%, transparent 60%), var(--color-surface)"
            : "var(--color-surface)",
        } as React.CSSProperties
      }
    >
      {/* Cursor-tracking spotlight — position set via CSS vars from grid listener */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(circle 180px at var(--mx) var(--my), rgba(255,125,60,0.11), transparent 70%)",
        }}
      />

      {/* Diagonal glint streak on hover entry */}
      <div
        ref={glintRef}
        aria-hidden
        className="pointer-events-none absolute inset-y-0 z-10 -skew-x-12"
        style={{
          width: "45%",
          left: "-55%",
          opacity: 0,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%)",
        }}
      />

      {/* Content */}
      <div
        className={`relative z-[1] flex h-full flex-col ${
          isHero ? "p-6 sm:p-8" : "p-5"
        }`}
      >
        {isHero ? (
          <>
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: contentDelay + 0.3, duration: 0.35, ease }}
              className="font-mono text-[0.58rem] uppercase tracking-[0.24em] text-accent/55"
            >
              Most recent
            </motion.span>

            <motion.h3
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: contentDelay + 0.36, duration: 0.5, ease }}
              className="mt-auto font-display text-2xl leading-snug text-ink sm:text-[1.65rem]"
            >
              {subject}
            </motion.h3>

            {preview && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: contentDelay + 0.48, duration: 0.4, ease }}
                className="mt-3 line-clamp-3 text-[0.87rem] leading-relaxed text-muted"
              >
                {preview}
              </motion.p>
            )}

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: contentDelay + 0.42, duration: 0.35, ease }}
              className="mt-5 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-faint"
            >
              {sender}
              {date && <span className="ml-2 text-line-2">· {date}</span>}
            </motion.p>
          </>
        ) : isFullWidth ? (
          <div className="flex h-full items-center gap-6">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: contentDelay + 0.3, duration: 0.4, ease }}
              className="w-2/5 shrink-0"
            >
              <p className="font-display text-[1.02rem] leading-snug text-ink">{subject}</p>
              <p className="mt-2 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-faint">
                {sender}
                {date && <span className="ml-1.5 text-line-2">· {date}</span>}
              </p>
            </motion.div>
            {preview && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: contentDelay + 0.42, duration: 0.38, ease }}
                className="line-clamp-2 border-l border-line-2 pl-6 text-[0.86rem] leading-relaxed text-muted"
              >
                {preview}
              </motion.p>
            )}
          </div>
        ) : (
          <>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: contentDelay + 0.28, duration: 0.38, ease }}
              className="font-display text-[0.95rem] leading-snug text-ink"
            >
              {subject}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: contentDelay + 0.38, duration: 0.35, ease }}
              className="mt-auto pt-3 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-faint"
            >
              {sender}
              {date && <span className="ml-1.5 text-line-2">· {date}</span>}
            </motion.p>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Ask Results ─────────────────────────── */

function AskResults({ state }: { state: AskState & { kind: "done" } }) {
  return (
    <div className="flex flex-col gap-3">
      {/* Answer card */}
      <div
        className="relative overflow-hidden rounded-2xl border border-accent/20 p-7 sm:p-9"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 70% 0%, rgba(255,125,60,0.07) 0%, transparent 70%), var(--color-surface)",
        }}
      >
        <p className="mb-4 font-mono text-[0.58rem] uppercase tracking-[0.22em] text-accent/70">
          {state.question}
        </p>
        <TextGenerateEffect
          words={state.answer}
          className="font-display text-xl leading-relaxed sm:text-2xl"
          duration={0.3}
        />
      </div>

      {/* Sources */}
      {state.sources.length > 0 && (
        <>
          <p className="flex items-center gap-2 px-1 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-faint">
            <span className="h-px w-5 bg-line-2" />
            Drawn from {state.sources.length} source{state.sources.length === 1 ? "" : "s"}
          </p>
          <SourceBento sources={state.sources} />
        </>
      )}
    </div>
  );
}

/* ─────────────────────────── Search Results ─────────────────────────── */

function SearchResults({ state }: { state: SearchState & { kind: "done" } }) {
  if (state.results.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-5">
        <p className="text-[0.95rem] text-muted">
          Nothing matches{" "}
          <span className="text-ink">&ldquo;{state.query}&rdquo;</span> — try a
          sync, or different words.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-faint">
        {state.results.length} result{state.results.length === 1 ? "" : "s"}
      </p>
      <SourceBento sources={state.results} />
    </div>
  );
}

/* ─────────────────────────── Skeleton ─────────────────────────── */

function LoadingSkeleton({ mode }: { mode: Mode }) {
  return (
    <div className="flex flex-col gap-3">
      {mode === "ask" && (
        <div className="rounded-2xl border border-line bg-surface p-7 sm:p-9">
          <div className="mb-4 h-3 w-24 rounded shimmer" />
          <div className="space-y-3">
            <div className="h-6 w-full rounded-lg shimmer" />
            <div className="h-6 w-[88%] rounded-lg shimmer" />
            <div className="h-6 w-3/4 rounded-lg shimmer" />
          </div>
        </div>
      )}
      <p className="flex items-center gap-2 px-1 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-line-2">
        <span className="h-px w-5 bg-line-2" />
        {mode === "ask" ? "Searching sources…" : "Finding matches…"}
      </p>
      {/* Skeleton bento */}
      <div className="archive-bento-grid grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {[0, 1, 2, 3].map((i) => {
          const span = i % 4 === 0 ? "2" : i % 4 === 1 ? "1" : i % 4 === 2 ? "1" : "2";
          return (
            <div
              key={i}
              className="rounded-2xl border border-line bg-surface p-5"
              style={{ gridColumn: `span ${span}`, minHeight: span === "2" ? 120 : 100 }}
            >
              <div className="h-4 w-3/4 rounded shimmer" />
              <div className="mt-2.5 h-3 w-1/3 rounded shimmer" />
              {span === "2" && <div className="mt-4 h-3 w-full rounded shimmer" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── MicGlyph ─────────────────────────── */

function MicGlyph({ className, listening }: { className?: string; listening?: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      {listening && <circle cx="12" cy="8" r="1.2" fill="currentColor" stroke="none" />}
    </svg>
  );
}
