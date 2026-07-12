"use client";

import { useState, useEffect } from "react";
import { Shell, Kicker, AccentButton, Thinking, StateNote, Arrow } from "../ui";
import { CardContainer, CardBody, CardItem } from "../components/card-3d";
import { EncryptedText } from "../components/encrypted-text";
import { API } from "../api";


type TwinSnapshot = { current_risk: number; current_level: string; days_trained: number };
type AgentSnapshot = { ran_at?: string; summary: string; action_count: number };
type Briefing = {
  generated?: boolean;
  date?: string;
  briefing?: string;
  twin?: TwinSnapshot | null;
  agent?: AgentSnapshot | null;
};

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
        if (d.generated) { setData(d); setState("ready"); }
        else setState("empty");
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
    <main className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-3xl flex-col px-6 py-20 sm:py-28">
      {/* ── Header ── */}
      <header className="mb-16 sm:mb-24">
        <div className="mb-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-surface/60 px-3.5 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.24em] text-accent backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-accent pulse-dot" />
            <EncryptedText
              text="Morning Briefing"
              revealDelayMs={75}
              flipDelayMs={40}
              initialDelayMs={800}
              trigger="always"
              encryptedClassName="text-accent/40"
              revealedClassName="text-accent"
            />
          </span>
        </div>

        <h1 className="font-display text-[3.4rem] font-medium leading-[0.92] tracking-tight text-ink sm:text-7xl">
          <EncryptedText
            text="Today"
            revealDelayMs={75}
            flipDelayMs={40}
            initialDelayMs={800}
            trigger="always"
            encryptedClassName="text-faint"
            revealedClassName="text-ink"
          />
        </h1>

        <p className="mt-7 max-w-xl text-[1.05rem] leading-relaxed text-muted">
          What matters today — drawn quietly from across everything you&apos;ve written and received.
        </p>
      </header>

      {/* ── States ── */}
      {state === "loading" && <Thinking label="Opening your day…" />}
      {state === "building" && <Thinking label="Composing your briefing…" />}
      {state === "error" && (
        <StateNote>
          Couldn&rsquo;t reach the backend on{" "}
          <span className="font-mono text-faint">localhost:8000</span>.
        </StateNote>
      )}

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

          {/* 3D card wrapping the briefing */}
          <CardContainer containerClassName="w-full items-start justify-start">
            <CardBody className="w-full">
              <CardItem translateZ={20} className="w-full">
                <div className="card relative overflow-hidden p-8 sm:p-12">
                  {/* Decorative large quote mark floats deeper */}
                  <CardItem
                    as="span"
                    translateZ={60}
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-4 -top-6 select-none font-display text-[9rem] leading-none text-accent/10"
                  >
                    &ldquo;
                  </CardItem>

                  {/* Briefing text floats slightly above the card */}
                  <CardItem translateZ={40} className="relative">
                    <p className="whitespace-pre-wrap font-display text-[1.65rem] leading-relaxed text-ink sm:text-[1.9rem]">
                      {data.briefing}
                    </p>
                  </CardItem>
                </div>
              </CardItem>
            </CardBody>
          </CardContainer>

          {(data.twin || data.agent) && (
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {data.twin && (
                <div className="card rise p-6">
                  <Kicker className="mb-3 text-accent">Stress forecast</Kicker>
                  <p className="font-display text-2xl capitalize text-ink">
                    {data.twin.current_level} risk
                    <span className="ml-2 font-mono text-sm text-faint">
                      {(data.twin.current_risk * 100).toFixed(0)}%
                    </span>
                  </p>
                  <p className="mt-2 font-mono text-[0.66rem] uppercase tracking-[0.18em] text-faint">
                    Trained on {data.twin.days_trained} days
                  </p>
                </div>
              )}
              {data.agent && (
                <div className="card rise p-6">
                  <Kicker className="mb-3 text-accent">Latest agent run</Kicker>
                  <p className="text-[0.95rem] leading-relaxed text-muted">
                    {data.agent.summary || "No summary yet."}
                  </p>
                  <p className="mt-2 font-mono text-[0.66rem] uppercase tracking-[0.18em] text-faint">
                    {data.agent.action_count} action
                    {data.agent.action_count === 1 ? "" : "s"}
                  </p>
                </div>
              )}
            </div>
          )}

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
    </main>
  );
}
