"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Shell,
  PageHeader,
  AccentButton,
  Thinking,
  StateNote,
  Reveal,
} from "../ui";
import { API } from "../api";
import { ShootingStars } from "../components/shooting-stars";
import { StarsBackground } from "../components/stars-background";
import { GlowingEffect } from "../components/glowing-effect";
import { EvervaultCard } from "../components/evervault-card";

type Step = { tool: string; args: Record<string, unknown>; observation: string };
type Action = {
  type: "draft_message" | "calendar_change" | "todo" | "telegram";
  to?: string;
  subject?: string;
  body?: string;
  action?: string;
  event?: string;
  reason?: string;
  text?: string;
  headline?: string;
  bullets?: string[];
};
type Report = {
  ran_at: string;
  goal: string;
  mode: string;
  steps: Step[];
  actions: Action[];
  summary: string;
  bullets?: string[];
};

const ACTION_META: Record<Action["type"], { label: string; icon: string }> = {
  draft_message: { label: "Message draft", icon: "✉" },
  calendar_change: { label: "Calendar proposal", icon: "⧗" },
  todo: { label: "Todo added", icon: "☑" },
  telegram: { label: "Sent to Telegram", icon: "➤" },
};

const FEATURE_CARDS = [
  {
    icon: "◎",
    title: "Stress Forecast",
    desc: "Reads mood trends across your messages and ranks the week by emotional load.",
    tag: "Reads data",
  },
  {
    icon: "⊡",
    title: "Calendar Review",
    desc: "Detects overbooked days and proposes reschedules before burnout hits.",
    tag: "Takes action",
  },
  {
    icon: "⊙",
    title: "Telegram Wrap-up",
    desc: "Sends a concise daily brief — decisions, drifts, and one thing to prioritise.",
    tag: "Notifies you",
  },
];

async function jsonOrThrow(r: Response) {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail ?? `HTTP ${r.status}`);
  return d;
}

export default function Agent() {
  const [report, setReport] = useState<Report | null>(null);
  const [running, setRunning] = useState(false);
  const [stepsDone, setStepsDone] = useState(0);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${API}/agent/report`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setReport(d))
      .catch(() => {})
      .finally(() => setLoaded(true));
    fetch(`${API}/agent/status`)
      .then((r) => r.json())
      .then((s) => {
        if (s.running) setRunning(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      try {
        const s = await (await fetch(`${API}/agent/status`)).json();
        setStepsDone(s.steps_done ?? 0);
        if (!s.running) {
          setReport(await jsonOrThrow(await fetch(`${API}/agent/report`)));
          setRunning(false);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [running]);

  const run = useCallback(async () => {
    setError("");
    try {
      await jsonOrThrow(
        await fetch(`${API}/agent/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
      );
      setRunning(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Agent run failed");
    }
  }, []);

  return (
    <Shell width="wide">
      {/* ── Hero: Stars + shooting stars behind the header ── */}
      <div className="relative min-h-[22rem] overflow-hidden">
        <StarsBackground />
        <ShootingStars
          minSpeed={15}
          maxSpeed={35}
          minDelay={1000}
          maxDelay={3500}
          starWidth={12}
          starHeight={1}
        />
        <div className="relative z-10">
          <PageHeader
            kicker="Autonomous Agent"
            title="Act"
            lead="The twin, acting for you. It reads your stress forecast, calendar, health and archive, then takes low-risk actions — drafts to review, calendar changes to approve, todos, and a Telegram wrap-up."
          >
            <div className="mt-9">
              <AccentButton onClick={run} disabled={running}>
                {running ? "Agent working…" : report ? "Run again" : "Run the agent"}
              </AccentButton>
            </div>
          </PageHeader>
        </div>
      </div>

      {error && <StateNote>⚠ {error}</StateNote>}

      {running && (
        <Thinking
          label={
            stepsDone > 0
              ? `Working… ${stepsDone} step${stepsDone === 1 ? "" : "s"} so far (live runs can take a few minutes)`
              : "Investigating your week and deciding what to do…"
          }
        />
      )}

      {/* ── 3D Pin capability cards — desktop only (too heavy on mobile) ── */}
      {!running && loaded && (
        <div className="mb-4 hidden sm:block">
          <p className="kicker mb-8 text-faint">What the agent does</p>
          <div className="grid gap-6 sm:grid-cols-3">
            {FEATURE_CARDS.map((card) => (
              <div key={card.title} className="flex flex-col gap-3">
                <div className="rounded-3xl border border-line bg-surface overflow-hidden">
                  <EvervaultCard text={card.icon} />
                </div>
                <div className="px-1">
                  <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-ink">
                    {card.title}
                  </p>
                  <p className="text-[0.82rem] leading-relaxed text-muted mt-1">
                    {card.desc}
                  </p>
                  <p className="mt-2 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-accent">
                    {card.tag}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {!report && (
            <p className="mt-6 text-[0.84rem] text-faint">
              No runs yet — train the twin first (Twin page), then hit Run above.
            </p>
          )}
        </div>
      )}

      {/* ── Report ── */}
      {!running && report && (
        <div className="flex flex-col gap-12">
          {/* Summary with glowing border */}
          <div className="relative rounded-2xl">
            <GlowingEffect disabled={false} spread={28} borderWidth={1} />
            <Reveal className="card rounded-2xl border border-line bg-surface p-7 sm:p-9">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <p className="kicker text-faint">Wrap-up</p>
                <p className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-faint">
                  {new Date(report.ran_at).toLocaleString()} · {report.mode} llm ·{" "}
                  {report.steps.length} steps
                </p>
              </div>
              <p className="text-[1.02rem] leading-relaxed text-ink">{report.summary}</p>
              {report.bullets && report.bullets.length > 0 && (
                <ul className="mt-4 flex flex-col gap-2">
                  {report.bullets.map((b, i) => (
                    <li
                      key={i}
                      className="flex gap-3 text-[0.92rem] leading-relaxed text-muted"
                    >
                      <span aria-hidden="true" className="mt-1 shrink-0 text-accent">
                        ▸
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Reveal>
          </div>

          {/* Action cards with glowing borders */}
          {report.actions.length > 0 && (
            <div>
              <p className="kicker mb-5 text-faint">Actions — {report.actions.length}</p>
              <Reveal stagger className="grid gap-4 sm:grid-cols-2">
                {report.actions.map((a, i) => (
                  <div key={i} className="relative rounded-2xl">
                    <GlowingEffect disabled={false} spread={18} borderWidth={1} />
                    <div className="card h-full rounded-2xl border border-line bg-surface p-6">
                      <p className="mb-3 flex items-center gap-2.5 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-accent">
                        <span aria-hidden="true">{ACTION_META[a.type]?.icon}</span>
                        {ACTION_META[a.type]?.label ?? a.type}
                      </p>
                      {a.type === "draft_message" && (
                        <>
                          <p className="text-sm text-muted">
                            To <span className="text-ink">{a.to}</span> — {a.subject}
                          </p>
                          <p className="mt-3 border-l-2 border-line-2 pl-4 text-[0.92rem] leading-relaxed text-muted">
                            {a.body}
                          </p>
                          <p className="mt-3 font-mono text-[0.56rem] uppercase tracking-[0.16em] text-faint">
                            Draft only — nothing sent
                          </p>
                        </>
                      )}
                      {a.type === "calendar_change" && (
                        <>
                          <p className="text-sm text-ink">
                            {a.action} · {a.event}
                          </p>
                          <p className="mt-2 text-[0.92rem] leading-relaxed text-muted">
                            {a.reason}
                          </p>
                          <p className="mt-3 font-mono text-[0.56rem] uppercase tracking-[0.16em] text-faint">
                            Needs your approval
                          </p>
                        </>
                      )}
                      {a.type === "todo" && (
                        <p className="text-[0.95rem] text-muted">{a.text}</p>
                      )}
                      {a.type === "telegram" && (
                        <>
                          {a.headline && (
                            <p className="text-[0.92rem] leading-relaxed text-ink">
                              {a.headline}
                            </p>
                          )}
                          {a.bullets && a.bullets.length > 0 ? (
                            <ul className="mt-2 flex flex-col gap-1.5">
                              {a.bullets.map((b, i) => (
                                <li
                                  key={i}
                                  className="flex gap-2 text-[0.85rem] leading-relaxed text-muted"
                                >
                                  <span aria-hidden="true" className="shrink-0 text-accent">
                                    ▸
                                  </span>
                                  <span>{b}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            !a.headline && (
                              <p className="text-[0.92rem] leading-relaxed text-muted">{a.text}</p>
                            )
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </Reveal>
            </div>
          )}

          {/* Step trace */}
          <div>
            <p className="kicker mb-5 text-faint">How it got there</p>
            <Reveal className="card overflow-hidden rounded-2xl border border-line bg-surface">
              {report.steps.map((s, i) => (
                <div
                  key={i}
                  className="flex gap-4 border-b border-line px-6 py-4 last:border-b-0"
                >
                  <span className="w-6 shrink-0 pt-0.5 text-right font-mono text-[0.62rem] text-faint">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink">
                      {s.tool}
                      {Object.keys(s.args).length > 0 && (
                        <span className="ml-2 normal-case tracking-normal text-faint">
                          {JSON.stringify(s.args).slice(0, 90)}
                        </span>
                      )}
                    </p>
                    <p
                      className="mt-1 truncate text-[0.85rem] text-muted"
                      title={s.observation}
                    >
                      {s.observation}
                    </p>
                  </div>
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      )}
    </Shell>
  );
}
