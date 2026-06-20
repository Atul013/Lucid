"use client";

import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Briefing = { generated?: boolean; date?: string; briefing?: string };

function longDate(d?: string): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function Today() {
  const [state, setState] = useState<
    "loading" | "empty" | "building" | "ready" | "error"
  >("loading");
  const [data, setData] = useState<Briefing>({});

  useEffect(() => {
    fetch(`${API}/briefing`)
      .then((r) => r.json())
      .then((d: Briefing) => {
        if (d.generated) {
          setData(d);
          setState("ready");
        } else setState("empty");
      })
      .catch(() => setState("error"));
  }, []);

  async function build() {
    setState("building");
    try {
      const r = await fetch(`${API}/briefing/build`, { method: "POST" });
      if (!r.ok) throw new Error();
      setData(await r.json());
      setState("ready");
    } catch {
      setState("error");
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-2xl flex-col px-6 py-12 sm:py-16">
      <header className="mb-12 sm:mb-16">
        <h1 className="font-display text-4xl font-medium leading-none tracking-tight text-ink sm:text-5xl">
          Today
        </h1>
        <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-muted">
          Your morning briefing — what matters today, drawn from across your
          archive.
        </p>
      </header>

      {state === "loading" && (
        <p className="text-[0.95rem] text-faint">Loading&hellip;</p>
      )}
      {state === "error" && (
        <p className="text-[0.95rem] text-muted">
          Couldn&rsquo;t reach the backend on{" "}
          <span className="tabular-nums">localhost:8000</span>.
        </p>
      )}
      {state === "building" && (
        <p className="text-[0.95rem] text-faint">
          Composing your briefing&hellip;
        </p>
      )}

      {state === "empty" && (
        <div className="border-t border-line pt-10">
          <p className="max-w-md text-[0.95rem] leading-relaxed text-muted">
            Lucid weaves your recent mail, themes, and goals into one short
            morning read.
          </p>
          <button
            onClick={build}
            className="mt-7 inline-flex h-11 cursor-pointer items-center gap-2 bg-ink px-6 text-[0.8rem] font-medium uppercase tracking-[0.15em] text-paper transition-colors hover:bg-accent"
          >
            Compose today&rsquo;s briefing
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      )}

      {state === "ready" && (
        <article>
          {data.date && (
            <p className="mb-6 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-faint">
              {longDate(data.date)}
            </p>
          )}
          <p className="whitespace-pre-wrap font-display text-2xl leading-relaxed text-ink">
            {data.briefing}
          </p>
          <div className="mt-10 flex items-center gap-4 border-t border-line pt-6">
            <button
              onClick={build}
              className="cursor-pointer text-[0.7rem] font-medium uppercase tracking-[0.15em] text-faint transition-colors hover:text-accent"
            >
              Refresh
            </button>
            <span className="text-[0.7rem] uppercase tracking-[0.15em] text-faint">
              Telegram delivery — coming soon
            </span>
          </div>
        </article>
      )}
    </main>
  );
}
