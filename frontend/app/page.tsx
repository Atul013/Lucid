"use client";

import { useState, useRef, useEffect } from "react";

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
type Sync =
  | { kind: "idle" }
  | { kind: "syncing" }
  | { kind: "done"; n: number }
  | { kind: "error" };
type Search =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "done"; query: string; results: Result[] };

export default function Archive() {
  const [conn, setConn] = useState<Conn>("checking");
  const [sync, setSync] = useState<Sync>({ kind: "idle" });
  const [search, setSearch] = useState<Search>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // If we just returned from the OAuth callback, drop the ?connected flag.
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

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = inputRef.current?.value.trim();
    if (!q) return;
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
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-6 py-16 sm:py-24">
      <header className="mb-12 sm:mb-16">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-5xl font-medium leading-none tracking-tight">
            Lucid
          </h1>
          <span className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-faint">
            Archive
          </span>
        </div>
        <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-muted">
          Search everything you&rsquo;ve written and received — by meaning, not
          keywords.
        </p>
      </header>

      {conn === "checking" && (
        <p className="text-[0.95rem] text-faint">Checking your archive&hellip;</p>
      )}

      {conn === "disconnected" && (
        <div className="border-t border-line pt-10">
          <h2 className="font-display text-2xl text-ink">Connect your Gmail</h2>
          <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-muted">
            Lucid reads your mail (read-only) and indexes it locally so you can
            search it by meaning. Nothing is shared.
          </p>
          <a
            href={`${API}/auth/google`}
            className="mt-7 inline-flex h-11 items-center gap-2 bg-ink px-6 text-[0.8rem] font-medium uppercase tracking-[0.15em] text-paper transition-colors hover:bg-accent"
          >
            Connect Gmail
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      )}

      {conn === "connected" && (
        <>
          <div className="mb-10 flex items-center justify-between border-y border-line py-3">
            <span className="flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-[0.15em] text-muted">
              <span
                className="h-1.5 w-1.5 rounded-full bg-accent"
                aria-hidden="true"
              />
              Gmail connected
              {sync.kind === "done" && (
                <span className="normal-case tracking-normal text-faint">
                  · <span className="tabular-nums">{sync.n}</span> indexed
                </span>
              )}
            </span>
            <button
              onClick={runSync}
              disabled={sync.kind === "syncing"}
              className="cursor-pointer text-[0.7rem] font-medium uppercase tracking-[0.15em] text-faint transition-colors hover:text-accent disabled:cursor-default disabled:text-line"
            >
              {sync.kind === "syncing" ? "Syncing…" : "Sync now"}
            </button>
          </div>

          <form onSubmit={runSearch} className="group relative">
            <label htmlFor="q" className="sr-only">
              Search your archive
            </label>
            <div className="flex items-center gap-3 border-b border-ink pb-3 transition-colors focus-within:border-accent">
              <SearchGlyph className="h-5 w-5 shrink-0 text-faint transition-colors group-focus-within:text-accent" />
              <input
                id="q"
                ref={inputRef}
                type="search"
                autoComplete="off"
                autoFocus
                placeholder="a conversation, a feeling, a person&hellip;"
                className="w-full bg-transparent font-display text-2xl leading-tight text-ink outline-none placeholder:text-faint sm:text-3xl"
              />
              <button
                type="submit"
                aria-label="Search"
                className="shrink-0 cursor-pointer self-stretch px-2 text-[0.7rem] font-medium uppercase tracking-[0.15em] text-faint transition-colors hover:text-accent"
              >
                Enter
              </button>
            </div>
          </form>

          <section aria-live="polite" className="mt-12 flex-1">
            {sync.kind === "error" && (
              <Notice>Sync failed. Try again in a moment.</Notice>
            )}
            {search.kind === "loading" && <Skeleton />}
            {search.kind === "error" && (
              <Notice>
                Couldn&rsquo;t reach the archive. Is the backend running on{" "}
                <span className="tabular-nums">localhost:8000</span>?
              </Notice>
            )}
            {search.kind === "done" && search.results.length === 0 && (
              <Notice>
                Nothing matches{" "}
                <span className="text-ink">&ldquo;{search.query}&rdquo;</span>{" "}
                yet. Try a sync, or different words.
              </Notice>
            )}
            {search.kind === "done" && search.results.length > 0 && (
              <>
                <p className="mb-8 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-faint">
                  <span className="tabular-nums">{search.results.length}</span>{" "}
                  result{search.results.length === 1 ? "" : "s"}
                </p>
                <ul className="divide-y divide-line">
                  {search.results.map((r, i) => (
                    <li key={i} className="py-6 first:pt-0">
                      <h2 className="font-display text-xl leading-snug text-ink">
                        {decode(r.subject) || "(no subject)"}
                      </h2>
                      <p className="mt-1.5 text-[0.7rem] font-medium uppercase tracking-[0.15em] text-faint">
                        {senderName(r.from)}
                        {shortDate(r.date) && (
                          <>
                            <span className="mx-2 text-line">/</span>
                            <span className="tabular-nums normal-case tracking-normal">
                              {shortDate(r.date)}
                            </span>
                          </>
                        )}
                      </p>
                      <p className="mt-3 line-clamp-2 text-[0.95rem] leading-relaxed text-muted">
                        {decode(r.text)}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.95rem] leading-relaxed text-muted">{children}</p>;
}

function Skeleton() {
  return (
    <ul className="divide-y divide-line">
      {[0, 1, 2].map((i) => (
        <li key={i} className="py-6 first:pt-0">
          <div className="h-5 w-3/4 rounded-sm bg-line" />
          <div className="mt-3 h-3 w-1/3 rounded-sm bg-line/70" />
          <div className="mt-4 h-3.5 w-full rounded-sm bg-line/60" />
        </li>
      ))}
    </ul>
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
