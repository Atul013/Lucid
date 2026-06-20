"use client";

import { useState, useEffect } from "react";
import {
  Shell,
  PageHeader,
  Kicker,
  AccentButton,
  Thinking,
  StateNote,
  Arrow,
} from "../ui";

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
    <Shell>
      <PageHeader
        kicker="Morning Briefing"
        title="Today"
        lead="What matters today — drawn quietly from across everything you've written and received."
      />

      {state === "loading" && <Thinking label="Opening your day…" />}
      {state === "error" && (
        <StateNote>
          Couldn&rsquo;t reach the backend on{" "}
          <span className="font-mono text-faint">localhost:8000</span>.
        </StateNote>
      )}
      {state === "building" && <Thinking label="Composing your briefing…" />}

      {state === "empty" && (
        <div className="card rise max-w-xl p-8 sm:p-10">
          <p className="text-[1rem] leading-relaxed text-muted">
            Lucid weaves your recent mail, themes, and goals into one short
            morning read — the three things worth your attention before anything
            else.
          </p>
          <AccentButton onClick={build} className="mt-8">
            Compose today&rsquo;s briefing
            <Arrow />
          </AccentButton>
        </div>
      )}

      {state === "ready" && (
        <article className="rise">
          {data.date && (
            <Kicker className="mb-6 text-accent">{longDate(data.date)}</Kicker>
          )}
          <div className="card relative overflow-hidden p-8 sm:p-12">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -left-10 -top-10 font-display text-[12rem] leading-none text-accent/10 select-none"
            >
              &ldquo;
            </span>
            <p className="relative whitespace-pre-wrap font-display text-[1.65rem] leading-relaxed text-ink sm:text-[1.9rem]">
              {data.briefing}
            </p>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <button
              onClick={build}
              className="cursor-pointer font-mono text-[0.66rem] uppercase tracking-[0.18em] text-faint transition-colors hover:text-accent"
            >
              ↻ Refresh briefing
            </button>
            <span className="flex items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.18em] text-faint">
              <span className="h-1.5 w-1.5 rounded-full bg-faint" />
              Telegram delivery — soon
            </span>
          </div>
        </article>
      )}
    </Shell>
  );
}
