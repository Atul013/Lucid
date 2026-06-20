"use client";

import { useState, useRef, useEffect } from "react";
import {
  Shell,
  PageHeader,
  AccentButton,
  Thinking,
  StateNote,
  Arrow,
  CountUp,
} from "../ui";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Result = { text: string; subject: string; from: string; date: string };

// Gmail snippets arrive HTML-escaped (&amp;, &#39;). Decode for readability.
function decode(s: string): string {
  if (typeof document === "undefined") return s;
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value;
}

// "\"Amazon.in Reviews\" <x@y.com>" -> "Amazon.in Reviews"
function senderName(from: string): string {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*</);
  return decode((m ? m[1] : from).trim());
}

function shortDate(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Conn = "checking" | "connected" | "disconnected";
type Mode = "search" | "ask";
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

export default function Archive() {
  const [conn, setConn] = useState<Conn>("checking");
  const [mode, setMode] = useState<Mode>("ask");
  const [sync, setSync] = useState<Sync>({ kind: "idle" });
  const [search, setSearch] = useState<SearchState>({ kind: "idle" });
  const [ask, setAsk] = useState<AskState>({ kind: "idle" });
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Browser-native speech-to-text. No server, no key. Chrome/Edge/Safari.
  function startVoice() {
    const SR =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition);
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setListening(true);
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript.trim();
      if (inputRef.current) inputRef.current.value = transcript;
      run(transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  }

  const voiceSupported =
    typeof window !== "undefined" &&
    !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("connected")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
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
    } catch {
      setSync({ kind: "error" });
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    run(inputRef.current?.value.trim());
  }

  async function run(q: string | undefined) {
    if (!q) return;
    if (mode === "search") {
      setSearch({ kind: "loading" });
      try {
        const r = await fetch(
          `${API}/gmail/search?q=${encodeURIComponent(q)}&n=10`,
        );
        if (!r.ok) throw new Error();
        const d = await r.json();
        setSearch({ kind: "done", query: q, results: d.results ?? [] });
      } catch {
        setSearch({ kind: "error" });
      }
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
        setAsk({
          kind: "done",
          question: q,
          answer: d.answer ?? "",
          sources: d.sources ?? [],
        });
      } catch {
        setAsk({ kind: "error" });
      }
    }
  }

  return (
    <Shell>
      <PageHeader
        kicker="The Archive"
        title="Ask your memory"
        lead="Everything you've written and received, searchable by meaning. Ask it a question in plain words, or search the raw record."
      />

      {conn === "checking" && <Thinking label="Reaching your archive…" />}

      {conn === "disconnected" && (
        <div className="card rise max-w-xl p-8 sm:p-10">
          <h2 className="font-display text-2xl text-ink">Connect your Gmail</h2>
          <p className="mt-3 text-[0.98rem] leading-relaxed text-muted">
            Lucid reads your mail <span className="text-ink">(read-only)</span>{" "}
            and indexes it locally so you can search it by meaning. Nothing
            leaves your machine.
          </p>
          <a
            href={`${API}/auth/google`}
            className="btn-accent mt-8 inline-flex h-12 items-center gap-2.5 rounded-full px-7 font-mono text-[0.72rem] font-medium uppercase tracking-[0.18em]"
          >
            Connect Gmail
            <Arrow />
          </a>
        </div>
      )}

      {conn === "connected" && (
        <>
          {/* Status bar */}
          <div className="card rise mb-8 flex items-center justify-between gap-4 px-5 py-3.5">
            <span className="flex items-center gap-2.5 font-mono text-[0.66rem] uppercase tracking-[0.18em] text-muted">
              <span
                className="h-2 w-2 rounded-full bg-accent pulse-dot"
                aria-hidden="true"
              />
              Gmail connected
              {sync.kind === "done" && (
                <span className="text-faint">
                  · <CountUp to={sync.n} className="text-ink" /> indexed
                </span>
              )}
            </span>
            <button
              onClick={runSync}
              disabled={sync.kind === "syncing"}
              className="cursor-pointer font-mono text-[0.66rem] uppercase tracking-[0.18em] text-faint transition-colors hover:text-accent disabled:cursor-default disabled:text-line-2"
            >
              {sync.kind === "syncing" ? "Syncing…" : "↻ Sync now"}
            </button>
          </div>

          {/* Segmented mode control */}
          <div
            className="mb-6 inline-flex gap-1 rounded-full border border-line bg-surface p-1"
            role="tablist"
            aria-label="Mode"
          >
            {(["ask", "search"] as Mode[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`cursor-pointer rounded-full px-5 py-2 font-mono text-[0.66rem] uppercase tracking-[0.2em] transition-colors ${
                  mode === m
                    ? "bg-surface-2 text-ink shadow-[0_0_20px_-6px_rgba(255,125,60,0.5)]"
                    : "text-faint hover:text-muted"
                }`}
              >
                {m === "ask" ? "Ask" : "Search"}
              </button>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={onSubmit} className="group">
            <div className="card flex items-center gap-3 px-5 py-4 transition-colors focus-within:border-accent">
              <SearchGlyph className="h-5 w-5 shrink-0 text-faint transition-colors group-focus-within:text-accent" />
              <input
                id="q"
                ref={inputRef}
                type="search"
                autoComplete="off"
                autoFocus
                placeholder={
                  mode === "ask"
                    ? "what did I say about…"
                    : "a conversation, a feeling, a person…"
                }
                className="w-full bg-transparent font-display text-2xl leading-tight text-ink outline-none placeholder:text-faint sm:text-3xl"
              />
              {voiceSupported && (
                <button
                  type="button"
                  onClick={startVoice}
                  aria-label="Speak your query"
                  aria-pressed={listening}
                  className={`shrink-0 cursor-pointer rounded-full p-2 transition-colors ${
                    listening
                      ? "bg-accent/10 text-accent"
                      : "text-faint hover:text-accent"
                  }`}
                >
                  <MicGlyph className="h-5 w-5" listening={listening} />
                </button>
              )}
              <button
                type="submit"
                aria-label={mode === "ask" ? "Ask" : "Search"}
                className="btn-accent flex h-10 shrink-0 items-center gap-2 rounded-full px-4 font-mono text-[0.66rem] uppercase tracking-[0.16em]"
              >
                {mode === "ask" ? "Ask" : "Find"}
              </button>
            </div>
          </form>

          <section aria-live="polite" className="mt-12 flex-1">
            {sync.kind === "error" && (
              <StateNote>Sync failed. Try again in a moment.</StateNote>
            )}
            {mode === "ask" && <AskView state={ask} />}
            {mode === "search" && <SearchView state={search} />}
          </section>
        </>
      )}
    </Shell>
  );
}

function AskView({ state }: { state: AskState }) {
  if (state.kind === "loading")
    return <Thinking label="Reading across your archive…" />;
  if (state.kind === "error")
    return (
      <StateNote>
        Couldn&rsquo;t reach the archive. Is the backend running on{" "}
        <span className="font-mono text-faint">localhost:8000</span>?
      </StateNote>
    );
  if (state.kind !== "done") return null;

  return (
    <div className="rise">
      <div className="card p-7 sm:p-9">
        <p className="whitespace-pre-wrap font-display text-xl leading-relaxed text-ink sm:text-2xl">
          {state.answer}
        </p>
      </div>
      {state.sources.length > 0 && (
        <div className="mt-10">
          <p className="kicker mb-5 flex items-center gap-2.5 text-faint">
            <span className="h-px w-6 bg-line-2" />
            Drawn from {state.sources.length} source
            {state.sources.length === 1 ? "" : "s"}
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {state.sources.map((r, i) => (
              <li key={i} className="card p-4">
                <p className="text-[0.92rem] leading-snug text-ink">
                  {decode(r.subject) || "(no subject)"}
                </p>
                <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-faint">
                  {senderName(r.from)}
                  {shortDate(r.date) && (
                    <span className="text-line-2"> · {shortDate(r.date)}</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SearchView({ state }: { state: SearchState }) {
  if (state.kind === "loading") return <Skeleton />;
  if (state.kind === "error")
    return (
      <StateNote>
        Couldn&rsquo;t reach the archive. Is the backend running on{" "}
        <span className="font-mono text-faint">localhost:8000</span>?
      </StateNote>
    );
  if (state.kind !== "done") return null;
  if (state.results.length === 0)
    return (
      <StateNote>
        Nothing matches{" "}
        <span className="text-ink">&ldquo;{state.query}&rdquo;</span> yet. Try a
        sync, or different words.
      </StateNote>
    );

  return (
    <div className="rise">
      <p className="kicker mb-6 text-faint">
        {state.results.length} result{state.results.length === 1 ? "" : "s"}
      </p>
      <ul className="grid gap-3">
        {state.results.map((r, i) => (
          <li
            key={i}
            className="card group/item p-5 transition-colors hover:border-line-2"
          >
            <h2 className="font-display text-xl leading-snug text-ink">
              {decode(r.subject) || "(no subject)"}
            </h2>
            <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-faint">
              {senderName(r.from)}
              {shortDate(r.date) && (
                <span className="text-line-2"> · {shortDate(r.date)}</span>
              )}
            </p>
            <p className="mt-3 line-clamp-2 text-[0.95rem] leading-relaxed text-muted">
              {decode(r.text)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Skeleton() {
  return (
    <ul className="grid gap-3">
      {[0, 1, 2].map((i) => (
        <li key={i} className="card p-5">
          <div className="h-5 w-3/4 rounded-md shimmer" />
          <div className="mt-3 h-3 w-1/3 rounded-md shimmer" />
          <div className="mt-4 h-3.5 w-full rounded-md shimmer" />
        </li>
      ))}
    </ul>
  );
}

function MicGlyph({
  className,
  listening,
}: {
  className?: string;
  listening?: boolean;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      {listening && (
        <circle cx="12" cy="8" r="1.2" fill="currentColor" stroke="none" />
      )}
    </svg>
  );
}

function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
