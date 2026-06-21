"use client";

import Link from "next/link";
import ShaderBackground from "./shader";
import { SplitReveal, Reveal, Eyebrow, Arrow } from "./ui";

const LAYERS = [
  {
    n: "01",
    name: "Archive",
    href: "/archive",
    line: "Query your own memory in plain English.",
    body: "Every message, email and note you've ever written — indexed by meaning. Ask it anything and it answers in context, like ChatGPT trained on you.",
  },
  {
    n: "02",
    name: "Ego",
    href: "/ego",
    line: "The patterns you'd never notice yourself.",
    body: "A background mind that reads across everything at once and surfaces the truth — what holds your attention, how you really behave, where your words and actions diverge.",
  },
  {
    n: "03",
    name: "Drift",
    href: "/drift",
    line: "Accountability without the effort.",
    body: "State what matters once. Lucid compares your stated goals against what your days actually contain, and tells you the moment you start drifting away.",
  },
];

const SOURCES = [
  "WhatsApp",
  "Gmail",
  "Telegram",
  "Notion",
  "Discord",
  "Google Keep",
  "Calendar",
  "Obsidian",
];

export default function Landing() {
  return (
    <div>
      {/* ───────────── Hero ───────────── */}
      <section className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 text-center">
        <ShaderBackground className="absolute inset-0 -z-20 h-full w-full" />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(12,10,9,0.55)_75%,rgba(12,10,9,0.9))]"
        />

        <div className="mx-auto max-w-4xl pt-24">
          <div className="mb-8 flex justify-center">
            <Eyebrow>AI Personal Intelligence</Eyebrow>
          </div>

          <SplitReveal
            text="You already know yourself."
            className="font-display font-medium leading-[0.95] tracking-tight text-ink text-[clamp(2.7rem,8vw,6.5rem)]"
          />
          <Reveal delay={0.5}>
            <p className="mt-1 font-display text-[clamp(1.6rem,5vw,3.5rem)] italic leading-tight text-accent glow-text">
              You just can&rsquo;t see it&nbsp;— yet.
            </p>
          </Reveal>

          <Reveal delay={0.75}>
            <p className="mx-auto mt-8 max-w-xl text-[1.05rem] leading-relaxed text-muted">
              Lucid quietly connects to your digital life and builds a living
              portrait of who you actually are. No journaling. No input. Connect
              once — it watches, learns, and reflects you back.
            </p>
          </Reveal>

          <Reveal delay={0.95}>
            <div className="mt-11 flex flex-wrap items-center justify-center gap-4">
              <CtaLink href="/today" primary>
                Enter Lucid
              </CtaLink>
              <CtaLink href="/archive">Explore the Archive</CtaLink>
            </div>
          </Reveal>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="bob flex flex-col items-center gap-2 text-faint">
            <span className="font-mono text-[0.58rem] uppercase tracking-[0.3em]">
              Scroll
            </span>
            <span className="h-8 w-px bg-gradient-to-b from-accent/70 to-transparent" />
          </div>
        </div>
      </section>

      {/* ───────────── Three layers ───────────── */}
      <section className="mx-auto max-w-5xl px-6 py-28 sm:py-40">
        <div className="mb-16 max-w-2xl">
          <Eyebrow>Three layers, one mind</Eyebrow>
          <Reveal>
            <h2 className="mt-6 font-display text-4xl font-medium leading-tight tracking-tight text-ink sm:text-6xl">
              It stacks — memory, insight, accountability.
            </h2>
          </Reveal>
        </div>

        <Reveal as="div" stagger className="grid gap-4 md:grid-cols-3">
          {LAYERS.map((l) => (
            <Link
              key={l.n}
              href={l.href}
              className="bezel group block transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1.5"
            >
              <div className="card flex h-full flex-col p-7">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[0.7rem] text-accent/70">
                    {l.n}
                  </span>
                  <span className="text-faint transition-colors group-hover:text-accent">
                    <Arrow />
                  </span>
                </div>
                <h3 className="mt-6 font-display text-3xl text-ink">{l.name}</h3>
                <p className="mt-2 font-display text-lg italic leading-snug text-accent">
                  {l.line}
                </p>
                <p className="mt-4 text-[0.95rem] leading-relaxed text-muted">
                  {l.body}
                </p>
              </div>
            </Link>
          ))}
        </Reveal>
      </section>

      {/* ───────────── Connect everything ───────────── */}
      <section className="border-y border-line py-20">
        <div className="mx-auto mb-10 max-w-5xl px-6">
          <p className="kicker text-faint">Connects to your whole life</p>
        </div>
        <div className="marquee-mask overflow-hidden">
          <div className="marquee gap-4 pr-4">
            {[...SOURCES, ...SOURCES].map((s, i) => (
              <span
                key={i}
                className="card flex items-center gap-3 whitespace-nowrap px-6 py-3.5 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent/60" />
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── Closing CTA ───────────── */}
      <section className="mx-auto max-w-3xl px-6 py-28 text-center sm:py-44">
        <Reveal>
          <h2 className="font-display text-4xl font-medium leading-[1.05] tracking-tight text-ink sm:text-6xl">
            Clarity about yourself is the most useful thing AI can give you.
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="mt-12 flex justify-center">
            <CtaLink href="/today" primary>
              Begin with today
            </CtaLink>
          </div>
        </Reveal>
        <p className="mt-16 font-mono text-[0.6rem] uppercase tracking-[0.25em] text-faint">
          Lucid · Build-A-Project 14 · IEEE CS SBC ASIET
        </p>
      </section>
    </div>
  );
}

function CtaLink({
  href,
  children,
  primary,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  if (primary)
    return (
      <Link
        href={href}
        className="btn-accent group inline-flex h-12 items-center gap-3 rounded-full pl-7 pr-2 font-mono text-[0.72rem] font-medium uppercase tracking-[0.16em]"
      >
        <span>{children}</span>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[#1a0f08]/15 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:scale-105">
          <Arrow />
        </span>
      </Link>
    );
  return (
    <Link
      href={href}
      className="btn-ghost inline-flex h-12 items-center gap-2 rounded-full px-7 font-mono text-[0.66rem] uppercase tracking-[0.18em]"
    >
      {children}
    </Link>
  );
}
