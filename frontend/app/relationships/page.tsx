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

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Rel = { name: string; kind: string; note: string; count: number };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function Relationships() {
  const [state, setState] = useState<
    "loading" | "empty" | "building" | "ready" | "error"
  >("loading");
  const [rels, setRels] = useState<Rel[]>([]);

  useEffect(() => {
    fetch(`${API}/relationships`)
      .then((r) => r.json())
      .then((d) => {
        if (d.relationships?.length) {
          setRels(d.relationships);
          setState("ready");
        } else setState("empty");
      })
      .catch(() => setState("error"));
  }, []);

  async function build() {
    setState("building");
    try {
      const r = await fetch(`${API}/relationships/build`, { method: "POST" });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setRels(d.relationships ?? []);
      setState("ready");
    } catch {
      setState("error");
    }
  }

  const max = Math.max(1, ...rels.map((r) => r.count));

  return (
    <Shell>
      <PageHeader
        kicker="Relationship Intelligence"
        title="People"
        lead="Who fills your inbox, what they mean to you, and how often they reach out."
      />

      {state === "loading" && <Thinking label="Reading your relationships…" />}
      {state === "error" && (
        <StateNote>
          Couldn&rsquo;t reach the backend on{" "}
          <span className="font-mono text-faint">localhost:8000</span>.
        </StateNote>
      )}
      {state === "building" && (
        <Thinking label="Grouping your archive by person…" />
      )}

      {state === "empty" && (
        <div className="card rise max-w-xl p-8 sm:p-10">
          <p className="text-[1rem] leading-relaxed text-muted">
            Lucid groups your archive by person and characterises each
            relationship — the people behind the noise.
          </p>
          <AccentButton onClick={build} className="mt-8">
            Map my relationships
            <Arrow />
          </AccentButton>
        </div>
      )}

      {state === "ready" && (
        <div>
          <Reveal as="ul" stagger className="grid gap-3">
            {rels.map((r, i) => (
              <li
                key={i}
                className="card flex gap-4 p-6 transition-colors hover:border-line-2"
              >
                <span
                  className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full border border-line-2 font-mono text-[0.8rem] text-accent"
                  aria-hidden="true"
                >
                  <span className="absolute inset-0 rounded-full bg-accent/10 blur-[6px]" />
                  <span className="relative">{initials(r.name)}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-display text-xl text-ink">{r.name}</h2>
                    <span className="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.15em] text-faint">
                      {r.kind}
                    </span>
                  </div>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">
                    {r.note}
                  </p>
                  <div className="mt-3 flex items-center gap-2.5">
                    <span className="h-1.5 w-28 overflow-hidden rounded-full bg-line">
                      <span
                        className="block h-full rounded-full bg-accent/70"
                        style={{ width: `${(r.count / max) * 100}%` }}
                      />
                    </span>
                    <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-faint">
                      <CountUp to={r.count} /> email{r.count === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </Reveal>
          <button
            onClick={build}
            className="mt-8 cursor-pointer font-mono text-[0.66rem] uppercase tracking-[0.18em] text-faint transition-colors hover:text-accent"
          >
            ↻ Rebuild
          </button>
        </div>
      )}
    </Shell>
  );
}
