"use client";

import { useState, useEffect } from "react";
import {
  Shell,
  PageHeader,
  AccentButton,
  Thinking,
  StateNote,
  Arrow,
} from "../ui";
import { API } from "../api";


type Align = { goal: string; status: string; note: string };

// on-track = bright ink, drifting = accent, stalled = faint. No banned hues.
const STATUS_META: Record<string, { text: string; dot: string }> = {
  "on-track": { text: "text-ink", dot: "bg-ink" },
  drifting: { text: "text-accent", dot: "bg-accent" },
  stalled: { text: "text-faint", dot: "bg-faint" },
};

export default function Drift() {
  const [goals, setGoals] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [alignment, setAlignment] = useState<Align[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API}/drift/goals`)
      .then((r) => r.json())
      .then((d) => setGoals(d.goals ?? []))
      .catch(() => setError(true));
  }, []);

  async function persist(next: string[]) {
    setGoals(next);
    setSaved(false);
    await fetch(`${API}/drift/goals`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goals: next }),
    });
    setSaved(true);
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const g = draft.trim();
    if (!g) return;
    setDraft("");
    persist([...goals, g]);
  }

  function remove(i: number) {
    persist(goals.filter((_, idx) => idx !== i));
  }

  async function check() {
    setChecking(true);
    setAlignment(null);
    try {
      const r = await fetch(`${API}/drift/check`, { method: "POST" });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setAlignment(d.alignment ?? []);
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  }

  return (
    <Shell>
      <PageHeader
        kicker="Accountability"
        title="Drift"
        lead="State what matters once. Lucid checks whether your days are actually moving toward it — or quietly drifting away."
      />

      <section className="rise">
        <p className="kicker mb-5 flex items-center gap-2.5 text-faint">
          <span className="h-px w-6 bg-line-2" />
          Your goals
        </p>

        {goals.length > 0 && (
          <ul className="mb-5 grid gap-2.5">
            {goals.map((g, i) => (
              <li
                key={i}
                className="card flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <span className="flex items-center gap-3 text-[0.96rem] text-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent/60" />
                  {g}
                </span>
                <button
                  onClick={() => remove(i)}
                  aria-label={`Remove goal: ${g}`}
                  className="cursor-pointer font-mono text-[0.62rem] uppercase tracking-[0.15em] text-faint transition-colors hover:text-accent"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={add}>
          <div className="card flex items-center gap-3 px-5 py-3.5 transition-colors focus-within:border-accent">
            <span className="font-mono text-lg text-faint">+</span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. land an AI internship by August"
              className="w-full bg-transparent font-display text-xl leading-tight text-ink outline-none placeholder:text-faint sm:text-2xl"
            />
            <button
              type="submit"
              className="shrink-0 cursor-pointer font-mono text-[0.66rem] uppercase tracking-[0.15em] text-faint transition-colors hover:text-accent"
            >
              Add
            </button>
          </div>
        </form>
        {saved && (
          <p className="mt-3 font-mono text-[0.62rem] uppercase tracking-[0.15em] text-accent/80">
            ✓ Saved
          </p>
        )}
      </section>

      {goals.length > 0 && (
        <section className="mt-12">
          <AccentButton onClick={check} disabled={checking}>
            {checking ? "Checking your drift…" : "Check my drift"}
            {!checking && <Arrow />}
          </AccentButton>

          {alignment && (
            <div className="rise mt-10 grid gap-3" aria-live="polite">
              {alignment.map((a, i) => {
                const meta = STATUS_META[a.status] ?? {
                  text: "text-muted",
                  dot: "bg-muted",
                };
                return (
                  <div key={i} className="card p-6">
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="text-[1rem] text-ink">{a.goal}</h3>
                      <span
                        className={`flex shrink-0 items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] ${meta.text}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
                        />
                        {a.status}
                      </span>
                    </div>
                    <p className="mt-2.5 text-[0.94rem] leading-relaxed text-muted">
                      {a.note}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {error && (
        <p className="mt-8 text-[0.95rem] text-muted">
          Couldn&rsquo;t reach the backend on{" "}
          <span className="font-mono text-faint">localhost:8000</span>.
        </p>
      )}
    </Shell>
  );
}
