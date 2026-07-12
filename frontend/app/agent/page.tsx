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
    // If a run was already in flight (page reload mid-run), show it.
    fetch(`${API}/agent/status`)
      .then((r) => r.json())
      .then((s) => {
        if (s.running) setRunning(true);
      })
      .catch(() => {});
  }, []);

  // While a run is in flight (started here or before a reload), poll
  // status every 3s, surface step progress, and pull the report when
  // the worker finishes.
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

  // Runs are async on the backend (live LLM runs take minutes): kick off
  // here, then the polling effect below watches until the worker finishes.
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
      {!running && loaded && !report && !error && (
        <StateNote>
          No runs yet. The agent needs the twin trained (visit the Twin page
          first if this is a fresh setup), then hit Run.
        </StateNote>
      )}

      {!running && report && (
        <div className="flex flex-col gap-12">
          {/* Summary */}
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

          {/* Actions taken */}
          {report.actions.length > 0 && (
            <div>
              <p className="kicker mb-5 text-faint">
                Actions — {report.actions.length}
              </p>
              <Reveal stagger className="grid gap-4 sm:grid-cols-2">
                {report.actions.map((a, i) => (
                  <div key={i} className="card rounded-2xl border border-line bg-surface p-6">
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
                        <p className="mt-2 text-[0.92rem] leading-relaxed text-muted">{a.reason}</p>
                        <p className="mt-3 font-mono text-[0.56rem] uppercase tracking-[0.16em] text-faint">
                          Needs your approval
                        </p>
                      </>
                    )}
                    {a.type === "todo" && <p className="text-[0.95rem] text-muted">{a.text}</p>}
                    {a.type === "telegram" && (
                      <>
                        {a.headline && (
                          <p className="text-[0.92rem] leading-relaxed text-ink">{a.headline}</p>
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
                    <p className="mt-1 truncate text-[0.85rem] text-muted" title={s.observation}>
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
