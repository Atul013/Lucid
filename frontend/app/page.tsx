"use client";

import Link from "next/link";
import { LampContainer } from "./components/lamp";
import { StickyScrollReveal } from "./components/sticky-scroll";
import { ThreeDMarquee } from "./components/marquee-3d";
import { CometCard } from "./components/meteors";
import { Reveal, Eyebrow, Arrow } from "./ui";

/* ─── Sticky scroll content ─── */
const LAYERS = [
  {
    title: "Archive",
    description:
      "Query your own memory in plain English. Every message, email and note you've ever written — indexed by meaning, not just keywords.",
    bullets: [
      "Semantic search across all your messages and notes",
      "Answers with full context from your past",
      "Works like ChatGPT — but trained entirely on you",
    ],
  },
  {
    title: "Ego",
    description:
      "The patterns you'd never notice yourself. A background mind that reads across everything at once and surfaces the uncomfortable truth.",
    bullets: [
      "What actually holds your attention each day",
      "Where your words and actions quietly diverge",
      "Personality drift tracked across weeks and months",
    ],
  },
  {
    title: "Drift",
    description:
      "Accountability without the effort. State what matters once — Lucid watches your actual days and tells you the moment you start slipping.",
    bullets: [
      "Goal vs. reality comparison, updated daily",
      "Gentle alerts before drift becomes a habit",
      "No check-ins, no journaling — fully automatic",
    ],
  },
];

/* ─── 3D Marquee items ─── */
const MARQUEE_CARDS = [
  { type: "insight", label: "Focus window", value: "9 – 11 am", sub: "Your peak 3 days running" },
  { type: "stat", label: "Memories indexed", value: "4,821", sub: "Across 6 sources" },
  { type: "quote", label: "From your Notion, 3 days ago", value: '"ship the landing page by Friday"' },
  { type: "drift", label: "Drift alert", value: "Deep work ↓ 40%", sub: "vs. your stated goal" },
  { type: "pattern", label: "Top topic this week", value: "Product strategy", sub: "Detected in 14 threads" },
  { type: "insight", label: "Last active source", value: "WhatsApp", sub: "62 messages today" },
  { type: "stat", label: "Days tracked", value: "47", sub: "Since first sync" },
  { type: "quote", label: "Recurring theme", value: '"I need to focus more"', sub: "Said 9× this month" },
  { type: "pattern", label: "Sleep mention", value: "11:40 pm avg", sub: "From Calendar + messages" },
  { type: "drift", label: "On track", value: "Exercise goal ✓", sub: "5 of 5 days this week" },
  { type: "insight", label: "Most used app", value: "Notion", sub: "3.2 h yesterday" },
  { type: "stat", label: "Insights generated", value: "138", sub: "This month" },
];

function MarqueeFeatureCard({ card }: { card: typeof MARQUEE_CARDS[number] }) {
  const colors: Record<string, string> = {
    insight: "from-accent/15 to-transparent",
    stat: "from-accent-deep/20 to-transparent",
    quote: "from-surface-2 to-surface",
    drift: "from-accent/10 to-transparent",
    pattern: "from-surface to-surface-2",
  };
  return (
    <div
      className={`relative flex h-36 w-56 shrink-0 flex-col justify-between overflow-hidden rounded-2xl border border-line bg-gradient-to-br p-4 ${colors[card.type]}`}
    >
      <p className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-faint">{card.label}</p>
      <div>
        <p className="font-display text-xl leading-tight text-ink">{card.value}</p>
        {card.sub && (
          <p className="mt-1 font-mono text-[0.58rem] text-muted">{card.sub}</p>
        )}
      </div>
      <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-accent/50" />
    </div>
  );
}

export default function Landing() {
  const marqueeItems = [...MARQUEE_CARDS, ...MARQUEE_CARDS].map((c, i) => (
    <MarqueeFeatureCard key={i} card={c} />
  ));

  return (
    <div>
      {/* ─── Hero — Lamp ─── */}
      <LampContainer>
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-8 flex justify-center">
            <Eyebrow>AI Personal Intelligence</Eyebrow>
          </div>
          <h1 className="font-display text-[clamp(2.7rem,8vw,6.5rem)] font-medium leading-[0.95] tracking-tight text-ink">
            You already know yourself.
          </h1>
          <p className="mt-1 font-display text-[clamp(1.6rem,5vw,3.5rem)] italic leading-tight text-accent glow-text">
            You just can&rsquo;t see it&nbsp;— yet.
          </p>
          <Reveal delay={0.5}>
            <p className="mx-auto mt-8 max-w-xl text-[1.05rem] leading-relaxed text-muted">
              Lucid quietly connects to your digital life and builds a living
              portrait of who you actually are. No journaling. No input. Connect
              once — it watches, learns, and reflects you back.
            </p>
          </Reveal>
          <Reveal delay={0.7}>
            <div className="mt-11 flex flex-wrap items-center justify-center gap-4">
              <CtaLink href="/today" primary>Enter Lucid</CtaLink>
              <CtaLink href="/archive">Explore the Archive</CtaLink>
            </div>
          </Reveal>
        </div>
      </LampContainer>

      {/* ─── Three layers — Sticky scroll ─── */}
      <section className="mx-auto max-w-5xl px-6 py-28 sm:py-40">
        <StickyScrollReveal
          heading={
            <div>
              <Eyebrow>Three layers, one mind</Eyebrow>
              <h2 className="mt-6 font-display text-4xl font-medium leading-tight tracking-tight text-ink sm:text-5xl">
                It stacks — memory, insight, accountability.
              </h2>
            </div>
          }
          subheading={
            <p className="mt-4 max-w-xs text-[0.95rem] leading-relaxed text-muted">
              Three systems running quietly in parallel — each one meaningless alone, powerful together.
            </p>
          }
          content={LAYERS}
        />
      </section>

      {/* ─── Feature cards — Comet Cards ─── */}
      <section className="mx-auto max-w-5xl px-6 pb-28">
        <Reveal as="div" stagger className="grid gap-4 md:grid-cols-3">
            {/* Archive card */}
          <Link href="/archive" className="group block transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1.5">
            <CometCard className="h-full">
              <div className="flex items-baseline justify-between px-7 pt-7">
                <span className="font-mono text-[0.7rem] text-accent/70">01</span>
                <span className="text-faint transition-colors group-hover:text-accent"><Arrow /></span>
              </div>
              <div className="px-7 pb-2 pt-4">
                <h3 className="font-display text-3xl text-ink">Archive</h3>
                <p className="mt-1 font-display text-base italic leading-snug text-accent">Query your own memory.</p>
              </div>
              {/* Mini search UI */}
              <div className="mx-7 mb-7 mt-4 space-y-2 rounded-xl border border-line bg-paper/60 p-4">
                <div className="flex items-center gap-2 rounded-lg border border-line-2 bg-surface px-3 py-2">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <span className="font-mono text-[0.65rem] text-faint">when did I last discuss the roadmap?</span>
                </div>
                <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2.5">
                  <p className="font-mono text-[0.6rem] text-accent/70">Telegram · 3 days ago</p>
                  <p className="mt-0.5 text-[0.78rem] leading-relaxed text-muted">
                    <span className="text-accent/60">&ldquo;</span>the roadmap needs a hard deadline, let&apos;s ship by Friday<span className="text-accent/60">&rdquo;</span>
                  </p>
                </div>
              </div>
            </CometCard>
          </Link>

          {/* Ego card */}
          <Link href="/ego" className="group block transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1.5">
            <CometCard className="h-full">
              <div className="flex items-baseline justify-between px-7 pt-7">
                <span className="font-mono text-[0.7rem] text-accent/70">02</span>
                <span className="text-faint transition-colors group-hover:text-accent"><Arrow /></span>
              </div>
              <div className="px-7 pb-2 pt-4">
                <h3 className="font-display text-3xl text-ink">Ego</h3>
                <p className="mt-1 font-display text-base italic leading-snug text-accent">Patterns you&apos;d never notice.</p>
              </div>
              {/* Mini attention chart */}
              <div className="mx-7 mb-7 mt-4 rounded-xl border border-line bg-paper/60 p-4 space-y-2.5">
                <p className="font-mono text-[0.58rem] uppercase tracking-[0.2em] text-faint">Attention this week</p>
                {[
                  { label: "Deep work", pct: 68, warn: false },
                  { label: "Messaging", pct: 52, warn: false },
                  { label: "Exercise", pct: 18, warn: true },
                  { label: "Reading", pct: 8, warn: true },
                ].map((r) => (
                  <div key={r.label} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 font-mono text-[0.6rem] text-faint">{r.label}</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-surface-2 h-1">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${r.pct}%`,
                          background: r.warn ? "rgba(255,125,60,0.4)" : "rgba(255,125,60,0.75)",
                        }}
                      />
                    </div>
                    <span className={`w-8 text-right font-mono text-[0.6rem] ${r.warn ? "text-accent" : "text-muted"}`}>{r.pct}%</span>
                  </div>
                ))}
              </div>
            </CometCard>
          </Link>

          {/* Drift card */}
          <Link href="/drift" className="group block transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1.5">
            <CometCard className="h-full">
              <div className="flex items-baseline justify-between px-7 pt-7">
                <span className="font-mono text-[0.7rem] text-accent/70">03</span>
                <span className="text-faint transition-colors group-hover:text-accent"><Arrow /></span>
              </div>
              <div className="px-7 pb-2 pt-4">
                <h3 className="font-display text-3xl text-ink">Drift</h3>
                <p className="mt-1 font-display text-base italic leading-snug text-accent">Accountability, automatic.</p>
              </div>
              {/* Mini goal tracker */}
              <div className="mx-7 mb-7 mt-4 rounded-xl border border-line bg-paper/60 p-4 space-y-2">
                <p className="font-mono text-[0.58rem] uppercase tracking-[0.2em] text-faint">Goals vs reality</p>
                {[
                  { goal: "Deep work", target: "4h", actual: "2.1h", ok: false },
                  { goal: "Exercise", target: "5×", actual: "5×", ok: true },
                  { goal: "No social 9–11am", target: "daily", actual: "3/5", ok: false },
                ].map((g) => (
                  <div key={g.goal} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                    <div>
                      <p className="font-mono text-[0.65rem] text-muted">{g.goal}</p>
                      <p className="font-mono text-[0.58rem] text-faint">Goal: {g.target}</p>
                    </div>
                    <span className={`font-mono text-[0.65rem] font-medium ${g.ok ? "text-ink" : "text-accent"}`}>
                      {g.ok ? "✓ " : "⚠ "}{g.actual}
                    </span>
                  </div>
                ))}
              </div>
            </CometCard>
          </Link>
        </Reveal>
      </section>

      {/* ─── Connect everything — 3D Marquee ─── */}
      <section className="border-y border-line py-20">
        <div className="mx-auto mb-10 max-w-5xl px-6">
          <p className="kicker text-faint">What Lucid reads across</p>
        </div>
        <ThreeDMarquee images={marqueeItems} className="h-[32rem]" />
      </section>

      {/* ─── Closing CTA — plain ─── */}
      <section className="mx-auto max-w-3xl px-6 py-28 text-center sm:py-44">
        <Reveal>
          <h2 className="font-display text-4xl font-medium leading-[1.05] tracking-tight text-ink sm:text-6xl">
            Clarity about yourself is the most useful thing AI can give you.
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="mt-12 flex justify-center">
            <CtaLink href="/today" primary>Begin with today</CtaLink>
          </div>
        </Reveal>
        <p className="mt-16 font-mono text-[0.6rem] uppercase tracking-[0.25em] text-faint">
          Lucid · Build-A-Project 14 · IEEE CS SBC ASIET
        </p>
      </section>
    </div>
  );
}

function CtaLink({ href, children, primary }: {
  href: string; children: React.ReactNode; primary?: boolean;
}) {
  if (primary)
    return (
      <Link href={href}
        className="btn-accent group inline-flex h-12 items-center gap-3 rounded-full pl-7 pr-2 font-mono text-[0.72rem] font-medium uppercase tracking-[0.16em]"
      >
        <span>{children}</span>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[#1a0f08]/15 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:scale-105">
          <Arrow />
        </span>
      </Link>
    );
  return (
    <Link href={href}
      className="btn-ghost inline-flex h-12 items-center gap-2 rounded-full px-7 font-mono text-[0.66rem] uppercase tracking-[0.18em]"
    >
      {children}
    </Link>
  );
}
