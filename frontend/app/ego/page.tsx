"use client";

import { useState, useEffect } from "react";
import {
  Shell,
  PageHeader,
  AccentButton,
  Thinking,
  StateNote,
  Arrow,
  Reveal,
  CountUp,
} from "../ui";
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
        setState(d.generated ? { kind: "done", data: d } : { kind: "empty" }),
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
      <PageHeader
        kicker="Behavioral Mirror"
        title="Ego"
        lead="The patterns a single message can't show you — what holds your attention, and the texture of your days."
      />

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

      {state.kind === "empty" && (
        <div className="card rise max-w-xl p-8 sm:p-10">
          <p className="text-[1rem] leading-relaxed text-muted">
            Ego reads across your whole archive at once and surfaces the
            patterns you can&rsquo;t see from inside a single conversation.
          </p>
          <AccentButton onClick={analyze} className="mt-8">
            Analyze my archive
            <Arrow />
          </AccentButton>
        </div>
      )}

      {state.kind === "done" && <Report data={state.data} onRerun={analyze} />}
    </Shell>
  );
}

function Report({ data, onRerun }: { data: Insights; onRerun: () => void }) {
  return (
    <div className="rise">
      <div className="card relative overflow-hidden p-8 sm:p-10">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-6 -top-10 font-display text-[10rem] leading-none text-accent/10 select-none"
        >
          ✦
        </span>
        <p className="relative font-display text-2xl leading-relaxed text-ink sm:text-[1.7rem]">
          {data.summary}
        </p>
      </div>

      <p className="kicker mb-5 mt-12 flex items-center gap-2.5 text-faint">
        <span className="h-px w-6 bg-line-2" />
        {(data.themes ?? []).length} patterns found
      </p>

      <Reveal as="div" stagger className="grid gap-3 sm:grid-cols-2">
        {(data.themes ?? []).map((t, i) => (
          <div
            key={i}
            className="card p-6 transition-colors hover:border-line-2"
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-[0.7rem] text-accent/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-accent">
                {t.title}
              </h2>
            </div>
            <p className="mt-3 text-[0.96rem] leading-relaxed text-ink">
              {t.detail}
            </p>
          </div>
        ))}
      </Reveal>

      <div className="mt-10 flex items-center gap-5">
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
    </div>
  );
}
