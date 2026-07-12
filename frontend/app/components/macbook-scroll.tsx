"use client";
import React, { useEffect, useRef, useState } from "react";

const cn = (...classes: (string | undefined | false | null)[]) =>
  classes.filter(Boolean).join(" ");

/* ── Inline icon replacements ── */
const IS = ({ d, className }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className ?? "h-[6px] w-[6px]"}><path d={d} /></svg>
);
const I = ({ d, className }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className ?? "h-[6px] w-[6px]"}><path d={d} /></svg>
);

const IconBrightnessDown  = ({ className }: { className?: string }) => <IS d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0-7v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" className={className} />;
const IconBrightnessUp    = ({ className }: { className?: string }) => <IS d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" className={className} />;
const IconSearch          = ({ className }: { className?: string }) => <IS d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" className={className} />;
const IconTable           = ({ className }: { className?: string }) => <IS d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18" className={className} />;
const IconMicrophone      = ({ className }: { className?: string }) => <IS d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" className={className} />;
const IconMoon            = ({ className }: { className?: string }) => <IS d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" className={className} />;
const IconPlayerTrackPrev = ({ className }: { className?: string }) => <I  d="M6 6h2v12H6zm3.5 6 8.5 6V6z" className={className} />;
const IconPlayerSkipForward=({ className }: { className?: string }) => <I  d="M5 18l8.5-6L5 6v12zM19 6h-2v12h2z" className={className} />;
const IconPlayerTrackNext = ({ className }: { className?: string }) => <I  d="M6 18V6l8.5 6L6 18zm10.5 0V6h2v12z" className={className} />;
const IconVolume3         = ({ className }: { className?: string }) => <IS d="M11 5 6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" className={className} />;
const IconVolume2         = ({ className }: { className?: string }) => <IS d="M11 5 6 9H2v6h4l5 4V5zm7.07-2.07a10 10 0 0 1 0 14.14" className={className} />;
const IconVolume          = ({ className }: { className?: string }) => <IS d="M11 5 6 9H2v6h4l5 4V5zm4.54 3.46a5 5 0 0 1 0 7.07" className={className} />;
const IconChevronUp       = ({ className }: { className?: string }) => <IS d="M18 15l-6-6-6 6" className={className} />;
const IconCaretUpFilled   = ({ className }: { className?: string }) => <I d="M12 8l-6 8h12z" className={className} />;
const IconCaretDownFilled = ({ className }: { className?: string }) => <I d="M12 16l-6-8h12z" className={className} />;
const IconCaretLeftFilled = ({ className }: { className?: string }) => <I d="M8 12l8-6v12z" className={className} />;
const IconCaretRightFilled= ({ className }: { className?: string }) => <I d="M16 12l-8-6v12z" className={className} />;
const IconWorld           = ({ className }: { className?: string }) => <IS d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" className={className} />;
const IconCommand         = ({ className }: { className?: string }) => <IS d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" className={className} />;

const LucidLogo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
    <circle cx="12" cy="12" r="3.5" fill="currentColor" opacity="0.9" />
    <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
  </svg>
);

/* ── Types for real data ── */
type NeuronSeries = { potentials: number[]; spikes: boolean[] };
export type LiveNeuron = { id: string; label: string; note: string; trips: number; series: NeuronSeries };

/* ── Public API ── */
export const MacbookScroll = ({
  src,
  showGradient,
  badge,
  neurons,
  dates,
  threshold,
}: {
  src?: string;
  showGradient?: boolean;
  badge?: React.ReactNode;
  neurons?: LiveNeuron[];
  dates?: string[];
  threshold?: number;
}) => {
  const trackRef  = useRef<HTMLDivElement>(null);
  const frameRef  = useRef<HTMLDivElement>(null);   // sticky backdrop — fades at hand-off
  const screenRef = useRef<HTMLDivElement>(null);   // the open screen — scales + rotates
  const lidRef    = useRef<HTMLDivElement>(null);    // closed-lid bezel — fades
  const baseRef   = useRef<HTMLDivElement>(null);    // keyboard/base — fades

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (window.innerWidth < 768) setIsMobile(true);
  }, []);

  // ── Scroll-driven animation, applied DIRECTLY to the DOM via refs. ──
  // We do NOT use framer's useScroll/MotionValue here: under the OS
  // `prefers-reduced-motion` setting framer never propagated the values to the
  // DOM, so the whole thing sat frozen at its initial frame. A plain rAF scroll
  // handler that writes `style.transform`/`style.opacity` is immune to that.
  //
  //  progress 0.00–0.16  lid rotates open
  //           0.16–0.40  screen zooms up to fill the viewport; chrome fades away
  //           0.40–0.52  enlarged screen holds, fully on-screen (still pinned)
  //           0.52–0.62  screen crossfades out as the real dashboard scrolls in
  useEffect(() => {
    const seg = (p: number, a: number, b: number, va: number, vb: number) => {
      const t = Math.min(1, Math.max(0, (p - a) / (b - a || 1)));
      return va + (vb - va) * t;
    };
    const sMax = isMobile ? 1.7 : 2.4;
    // Update synchronously on scroll — the transforms are written directly to the
    // DOM, so this is immune to reduced-motion and does not rely on rAF (which
    // browsers pause in background tabs). Cheap enough to run per scroll event.
    const update = () => {
      const track = trackRef.current;
      if (!track) return;
      const p = Math.min(1, Math.max(0, -track.getBoundingClientRect().top / track.offsetHeight));
      const rot = seg(p, 0.02, 0.16, -28, 0);
      const sx  = p <= 0.16 ? seg(p, 0, 0.16, 1.2, 1.5) : seg(p, 0.16, 0.4, 1.5, sMax);
      const sy  = p <= 0.16 ? seg(p, 0, 0.16, 0.6, 1.5) : seg(p, 0.16, 0.4, 1.5, sMax);
      if (screenRef.current)
        screenRef.current.style.transform = `scaleX(${sx}) scaleY(${sy}) rotateX(${rot}deg) translateY(0px)`;

      const chrome = 1 - seg(p, 0.2, 0.34, 0, 1);      // 1 → 0
      if (lidRef.current)  lidRef.current.style.opacity  = String(chrome);
      if (baseRef.current) baseRef.current.style.opacity = String(chrome);

      const frameO = 1 - seg(p, 0.52, 0.62, 0, 1);      // 1 → 0
      if (frameRef.current) frameRef.current.style.opacity = String(frameO);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [isMobile]);

  return (
    <div ref={trackRef} className="relative min-h-[220vh]">
      {/* Pinned frame with an opaque page-coloured backdrop so nothing shows
          behind the MacBook until the hand-off. */}
      <div
        ref={frameRef}
        className="sticky top-0 flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-paper,#faf9f7)] [perspective:800px] dark:bg-[#080808]"
      >
        <div className="flex scale-[0.3] flex-col items-center sm:scale-50 md:scale-[0.85] lg:scale-100">
          <div className="relative [perspective:800px]">
            {/* Closed-lid bezel — fades out as the screen zooms. */}
            <div
              ref={lidRef}
              style={{ transform: "perspective(800px) rotateX(-25deg) translateZ(0px)", transformOrigin: "bottom" }}
              className="relative h-[12rem] w-[32rem] rounded-2xl bg-[#010101] p-2"
            >
              <div style={{ boxShadow: "0px 2px 0px 2px #171717 inset" }}
                className="absolute inset-0 flex items-center justify-center rounded-lg bg-[#010101]">
                <LucidLogo />
              </div>
            </div>
            {/* Open lid / screen — scaled & rotated by the scroll handler. */}
            <div
              ref={screenRef}
              style={{ transformOrigin: "top", transform: "scaleX(1.2) scaleY(0.6) rotateX(-28deg)" }}
              className="absolute inset-0 h-96 w-[32rem] rounded-2xl bg-[#010101] p-2"
            >
              <div className="absolute inset-0 rounded-lg bg-[#0f0f0f]" />
              {src
                ? <img src={src} alt="screen" className="absolute inset-0 h-full w-full rounded-lg object-cover object-left-top" />
                : <TripwireScreen neurons={neurons} dates={dates} threshold={threshold} />
              }
            </div>
          </div>

          {/* Base — fades out as the screen zooms up. */}
          <div ref={baseRef} className="relative -z-10 h-[22rem] w-[32rem] overflow-hidden rounded-2xl bg-[#1c1c1e]">
            <div className="relative h-10 w-full">
              <div className="absolute inset-x-0 mx-auto h-4 w-[80%] bg-[#050505]" />
            </div>
            <div className="relative flex">
              <div className="mx-auto h-full w-[10%] overflow-hidden"><SpeakerGrid /></div>
              <div className="mx-auto h-full w-[80%]"><Keypad /></div>
              <div className="mx-auto h-full w-[10%] overflow-hidden"><SpeakerGrid /></div>
            </div>
            <Trackpad />
            <div className="absolute inset-x-0 bottom-0 mx-auto h-2 w-20 rounded-tl-3xl rounded-tr-3xl bg-gradient-to-t from-[#1c1c1e] to-[#050505]" />
            {badge && <div className="absolute bottom-4 left-4">{badge}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Screen: renders your actual neuron data (or static fallback) ── */
const SHOW_DAYS = 120;

const TripwireScreen = ({
  neurons,
  dates,
  threshold = 4,
}: {
  neurons?: LiveNeuron[];
  dates?: string[];
  threshold?: number;
}) => {
  /* Build chart data — same math as NeuronCard in page.tsx */
  const cards = React.useMemo(() => {
    if (neurons && dates && neurons.length > 0) {
      const start = Math.max(0, dates.length - SHOW_DAYS);
      const ds = dates.slice(start);
      const W = 100;
      const H = 30;
      const PAD_T = 3;
      const PAD_B = 5;

      return neurons.map((n) => {
        const pots   = n.series.potentials.slice(start);
        const spikes = n.series.spikes.slice(start);
        const yMax   = Math.max(threshold * 1.25, ...pots) || 1;
        const xFn = (i: number) => (i / Math.max(1, pots.length - 1)) * W;
        const yFn = (v: number) => PAD_T + (1 - v / yMax) * (H - PAD_T - PAD_B);
        const thY  = yFn(threshold);
        const path = pots.map((p, i) => `${i ? "L" : "M"}${xFn(i).toFixed(1)},${yFn(p).toFixed(1)}`).join("");
        const spikePts = spikes.map((s, i) => s ? xFn(i) : null).filter((x): x is number => x !== null);
        return { label: n.label, note: n.note, trips: n.trips, path, spikePts, thY,
          dateFrom: ds[0] ?? "", dateTo: ds[ds.length - 1] ?? "" };
      });
    }
    /* Fallback static data */
    return NEURONS.map((n) => ({ ...n, spikePts: n.spikes, thY: 12,
      note: n.desc, dateFrom: "2026-04-01", dateTo: "2026-07-06" }));
  }, [neurons, dates, threshold]);

  return (
    <div className="absolute inset-0 rounded-lg bg-[#0c0c0c] overflow-hidden flex flex-col" style={{ fontSize: 0 }}>
      {/* Nav — 26px tall */}
      <div className="flex items-center justify-between bg-[#080808] border-b border-[#1a1a1a] px-3 shrink-0" style={{ height: 26 }}>
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-[#ff7d3c]/60" style={{ width: 7, height: 7 }} />
          <span style={{ fontSize: 8, fontFamily: "monospace", color: "#555", letterSpacing: "0.12em" }}>Lucid</span>
        </div>
        <div className="flex" style={{ gap: 10 }}>
          {["TODAY","TODOS","ARCHIVE","EGO","DRIFT","TWIN","AGENT","TRIPWIRE","GRAPH"].map((l, i) => (
            <span key={l} style={{ fontSize: 7, fontFamily: "monospace", letterSpacing: "0.08em",
              color: i === 7 ? "#ff7d3c" : "#2e2e2e" }}>{l}</span>
          ))}
        </div>
      </div>

      {/* Subheader — 18px tall */}
      <div className="shrink-0 flex items-center px-3" style={{ height: 18 }}>
        <span style={{ fontSize: 7, fontFamily: "monospace", color: "#383838", letterSpacing: "0.18em", textTransform: "uppercase" }}>
          The layer — one neuron per stream
        </span>
      </div>

      {/* 2-col grid — fills remaining height */}
      <div className="grid grid-cols-2 flex-1 min-h-0 overflow-hidden" style={{ gap: 5, padding: "0 8px 8px" }}>
        {cards.map((n) => (
          <div key={n.label} className="flex flex-col rounded-lg bg-[#111] border border-[#1c1c1c]" style={{ padding: "6px 8px 5px" }}>
            <div className="flex items-baseline justify-between" style={{ marginBottom: 2 }}>
              <span style={{ fontSize: 8, fontFamily: "monospace", color: "#777", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {n.label}
              </span>
              <span style={{ fontSize: 7.5, fontFamily: "monospace", color: n.trips ? "#ff7d3c" : "#2a2a2a" }}>
                {n.trips ? `${n.trips}t` : "quiet"}
              </span>
            </div>
            <p style={{ fontSize: 7, fontFamily: "monospace", color: "#333", marginBottom: 3,
              overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{n.note}</p>
            <svg viewBox="0 0 100 30" className="w-full flex-1" preserveAspectRatio="none">
              <line x1="0" x2="100" y1={n.thY} y2={n.thY} stroke="#1e1e1e" strokeWidth="0.8" strokeDasharray="2.5 2.5" />
              <path d={n.path} fill="none" stroke="#ff7d3c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                opacity={n.trips ? 0.9 : 0.4} />
              {n.spikePts.map((sx, si) => (
                <circle key={si} cx={sx} cy={n.thY} r="2" fill="#ff7d3c" stroke="#111" strokeWidth="0.7" />
              ))}
              <text x="1" y="28.5" fill="#252525" fontSize="4.5" fontFamily="monospace">{n.dateFrom}</text>
              <text x="99" y="28.5" fill="#252525" fontSize="4.5" fontFamily="monospace" textAnchor="end">{n.dateTo}</text>
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
};

/* Neuron data matching the real chart shapes from the screenshot */
const NEURONS = [
  {
    label: "Communication Burst",
    desc: "email + message volume well above your trailing norm",
    trips: 1,
    path: "M1,26 L10,26 L18,25 L26,25 L34,26 L42,26 L50,26 L58,26 L65,25 L72,20 L78,14 L82,8 L86,4 L88,3 L90,5 L92,12 L94,20 L96,24 L99,26",
    spikes: [88],
  },
  {
    label: "Meeting Overload",
    desc: "sustained meeting hours far past baseline",
    trips: 0,
    path: "M1,24 C5,22 8,20 12,18 C15,16 17,15 20,16 C23,17 25,20 28,18 C31,16 33,14 36,15 C39,16 41,18 44,16 C47,14 49,13 52,14 C55,15 57,17 60,15 C63,13 65,12 68,14 C71,16 74,18 77,17 C80,16 83,18 87,20 C91,22 95,23 99,24",
    spikes: [],
  },
  {
    label: "Late-Night Activity",
    desc: "work bleeding into 22:00–06:00",
    trips: 1,
    path: "M1,27 L15,27 L25,27 L35,27 L45,27 L55,26 L65,25 L72,20 L78,14 L82,7 L85,4 L87,3 L89,5 L91,12 L93,20 L96,25 L99,27",
    spikes: [87],
  },
  {
    label: "Spending Spike",
    desc: "outflows well above the trailing norm",
    trips: 0,
    path: "M1,27 L20,27 L40,27 L60,27 L80,27 L99,27",
    spikes: [],
  },
  {
    label: "Physiological Stress",
    desc: "smartwatch stress scores climbing above baseline",
    trips: 3,
    path: "M1,24 C5,22 8,20 11,18 C14,15 16,13 19,14 C22,15 24,17 27,15 C30,13 32,11 35,12 C38,13 40,15 43,13 C46,10 48,8 51,9 C54,11 56,14 59,12 C62,9 64,7 67,8 C70,10 72,13 75,11 C77,9 79,11 82,14 C85,17 88,21 92,23 C95,24 97,25 99,25",
    spikes: [35, 51, 67],
  },
  {
    label: "Gone Quiet",
    desc: "communication drying up — the neglect signal",
    trips: 0,
    path: "M1,27 L20,27 L40,27 L60,27 L80,27 L99,27",
    spikes: [],
  },
];

/* ── Keyboard & hardware pieces ── */
export const Trackpad = () => (
  <div className="mx-auto my-1 h-32 w-[40%] rounded-xl"
    style={{ boxShadow: "0px 0px 1px 1px #00000020 inset" }} />
);

export const Keypad = () => (
  <div className="mx-1 h-full [transform:translateZ(0)] rounded-md bg-[#050505] p-1 [will-change:transform]">
    <div className="mb-[2px] flex w-full shrink-0 gap-[2px]">
      <KBtn className="w-10 items-end justify-start pb-[2px] pl-[4px]" childrenClassName="items-start">esc</KBtn>
      {([["F1",<IconBrightnessDown/>],["F2",<IconBrightnessUp/>],["F3",<IconTable/>],["F4",<IconSearch/>],
        ["F5",<IconMicrophone/>],["F6",<IconMoon/>],["F7",<IconPlayerTrackPrev/>],["F8",<IconPlayerSkipForward/>],
        ["F9",<IconPlayerTrackNext/>],["F10",<IconVolume3/>],["F11",<IconVolume2/>],["F12",<IconVolume/>]
      ] as [string, React.ReactNode][]).map(([label, icon]) => (
        <KBtn key={label}>{icon}<span className="mt-1 inline-block">{label}</span></KBtn>
      ))}
      <KBtn>
        <div className="h-4 w-4 rounded-full bg-gradient-to-b from-neutral-900 from-20% via-black via-50% to-neutral-900 to-95% p-px">
          <div className="h-full w-full rounded-full bg-black" />
        </div>
      </KBtn>
    </div>
    <div className="mb-[2px] flex w-full shrink-0 gap-[2px]">
      <KBtn><span className="block">~</span><span className="mt-1 block">`</span></KBtn>
      {(["!1","@2","#3","$4","%5","^6","&7","*8","(9",")0","_-","+="] as string[]).map((s) => (
        <KBtn key={s}><span className="block">{s[0]}</span><span className="block">{s[1]}</span></KBtn>
      ))}
      <KBtn className="w-10 items-end justify-end pr-[4px] pb-[2px]" childrenClassName="items-end">delete</KBtn>
    </div>
    <div className="mb-[2px] flex w-full shrink-0 gap-[2px]">
      <KBtn className="w-10 items-end justify-start pb-[2px] pl-[4px]" childrenClassName="items-start">tab</KBtn>
      {"QWERTYUIOP".split("").map(k => <KBtn key={k}><span>{k}</span></KBtn>)}
      <KBtn><span>{"{"}</span><span>{"["}</span></KBtn>
      <KBtn><span>{"}"}</span><span>{"]"}</span></KBtn>
      <KBtn><span>{"|"}</span><span>{"\\"}</span></KBtn>
    </div>
    <div className="mb-[2px] flex w-full shrink-0 gap-[2px]">
      <KBtn className="w-[2.8rem] items-end justify-start pb-[2px] pl-[4px]" childrenClassName="items-start">caps lock</KBtn>
      {"ASDFGHJKL".split("").map(k => <KBtn key={k}><span>{k}</span></KBtn>)}
      <KBtn><span>:</span><span>;</span></KBtn>
      <KBtn><span>"</span><span>'</span></KBtn>
      <KBtn className="w-[2.85rem] items-end justify-end pr-[4px] pb-[2px]" childrenClassName="items-end">return</KBtn>
    </div>
    <div className="mb-[2px] flex w-full shrink-0 gap-[2px]">
      <KBtn className="w-[3.65rem] items-end justify-start pb-[2px] pl-[4px]" childrenClassName="items-start">shift</KBtn>
      {"ZXCVBNM".split("").map(k => <KBtn key={k}><span>{k}</span></KBtn>)}
      <KBtn><span>{"<"}</span><span>{","}</span></KBtn>
      <KBtn><span>{">"}</span><span>{"."}</span></KBtn>
      <KBtn><span>{"?"}</span><span>{"/"}</span></KBtn>
      <KBtn className="w-[3.65rem] items-end justify-end pr-[4px] pb-[2px]" childrenClassName="items-end">shift</KBtn>
    </div>
    <div className="mb-[2px] flex w-full shrink-0 gap-[2px]">
      <KBtn childrenClassName="h-full justify-between py-[4px]">
        <div className="flex w-full justify-end pr-1"><span>fn</span></div>
        <div className="flex w-full justify-start pl-1"><IconWorld /></div>
      </KBtn>
      <KBtn childrenClassName="h-full justify-between py-[4px]">
        <div className="flex w-full justify-end pr-1"><IconChevronUp /></div>
        <div className="flex w-full justify-start pl-1"><span>control</span></div>
      </KBtn>
      <KBtn childrenClassName="h-full justify-between py-[4px]">
        <div className="flex w-full justify-end pr-1"><OptionKey className="h-[6px] w-[6px]" /></div>
        <div className="flex w-full justify-start pl-1"><span>option</span></div>
      </KBtn>
      <KBtn className="w-8" childrenClassName="h-full justify-between py-[4px]">
        <div className="flex w-full justify-end pr-1"><IconCommand /></div>
        <div className="flex w-full justify-start pl-1"><span>command</span></div>
      </KBtn>
      <KBtn className="w-[8.2rem]" />
      <KBtn className="w-8" childrenClassName="h-full justify-between py-[4px]">
        <div className="flex w-full justify-start pl-1"><IconCommand /></div>
        <div className="flex w-full justify-start pl-1"><span>command</span></div>
      </KBtn>
      <KBtn childrenClassName="h-full justify-between py-[4px]">
        <div className="flex w-full justify-start pl-1"><OptionKey className="h-[6px] w-[6px]" /></div>
        <div className="flex w-full justify-start pl-1"><span>option</span></div>
      </KBtn>
      <div className="mt-[2px] flex h-6 w-[4.9rem] flex-col items-center justify-end rounded-[4px] p-[0.5px]">
        <KBtn className="h-3 w-6"><IconCaretUpFilled /></KBtn>
        <div className="flex">
          <KBtn className="h-3 w-6"><IconCaretLeftFilled /></KBtn>
          <KBtn className="h-3 w-6"><IconCaretDownFilled /></KBtn>
          <KBtn className="h-3 w-6"><IconCaretRightFilled /></KBtn>
        </div>
      </div>
    </div>
  </div>
);

export const KBtn = ({
  className, children, childrenClassName, backlit = true,
}: {
  className?: string; children?: React.ReactNode; childrenClassName?: string; backlit?: boolean;
}) => (
  <div className={cn("[transform:translateZ(0)] rounded-[4px] p-[0.5px] [will-change:transform]",
    backlit && "bg-white/[0.2] shadow-xl shadow-white")}>
    <div className={cn("flex h-6 w-6 items-center justify-center rounded-[3.5px] bg-[#0A090D]", className)}
      style={{ boxShadow: "0px -0.5px 2px 0 #0D0D0F inset, -0.5px 0px 2px 0 #0D0D0F inset" }}>
      <div className={cn("flex w-full flex-col items-center justify-center text-[5px] text-neutral-200",
        childrenClassName, backlit && "text-white")}>
        {children}
      </div>
    </div>
  </div>
);

export const SpeakerGrid = () => (
  <div className="mt-2 flex h-40 gap-[2px] px-[0.5px]"
    style={{ backgroundImage: "radial-gradient(circle, #08080A 0.5px, transparent 0.5px)", backgroundSize: "3px 3px" }} />
);

export const OptionKey = ({ className }: { className: string }) => (
  <svg fill="none" viewBox="0 0 32 32" className={className}>
    <rect stroke="currentColor" strokeWidth={2} x="18" y="5" width="10" height="2" />
    <polygon stroke="currentColor" strokeWidth={2} points="10.6,5 4,5 4,7 9.4,7 18.4,27 28,27 28,25 19.6,25" />
    <rect width="32" height="32" stroke="none" />
  </svg>
);
