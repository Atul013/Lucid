"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Shell,
  AccentButton,
  Thinking,
  StateNote,
  Arrow,
  CountUp,
} from "../ui";
import { API } from "../api";
import { WorldMap } from "../components/world-map";
import { Marquee } from "../components/marquee";
import { AnimatedList } from "../components/animated-list";

// ─── Types ────────────────────────────────────────────────────────────────────

type Rel = { name: string; kind: string; note: string; count: number };
type Node = { id: string; label: string; type: "person" | "topic"; weight?: number };
type Edge = { source: string; target: string };
type Graph = { nodes: Node[]; edges: Edge[] };
type Sim = Node & { x: number; y: number; vx: number; vy: number; r: number };

// ─── Constants ────────────────────────────────────────────────────────────────

const GC = {
  bg: "#0c0c10",
  bgMid: "#12100e",
  person: "#f0e4d0",
  personGlow: "rgba(240,228,208,0.18)",
  topic: "#ff7d3c",
  topicGlow: "rgba(255,125,60,0.22)",
  edgeFaint: "rgba(200,180,150,0.08)",
  edgeActive: "#ff7d3c",
  grid: "rgba(255,255,255,0.025)",
};

const MAP_DOTS = [
  { start: { lat: 37.7749, lng: -122.4194 }, end: { lat: 51.5074, lng: -0.1278  } },
  { start: { lat: 40.7128, lng: -74.006   }, end: { lat: 1.3521,  lng: 103.8198 } },
  { start: { lat: 35.6762, lng: 139.6503  }, end: { lat: 48.8566, lng: 2.3522   } },
  { start: { lat: 25.2048, lng: 55.2708   }, end: { lat: 28.6139, lng: 77.209   } },
  { start: { lat: -33.8688, lng: 151.2093 }, end: { lat: 19.4326, lng: -99.1332 } },
  { start: { lat: 55.7558, lng: 37.6173   }, end: { lat: 31.2304, lng: 121.4737 } },
];

const KIND_LABELS = [
  "Colleague","Mentor","Friend","Collaborator","Manager",
  "Advisor","Client","Investor","Partner","Recruiter",
  "Community","Founder","Researcher","Classmate","Peer",
  "Lead","Sponsor","Connector","Ally","Champion",
];

const NOTIFICATIONS = [
  {
    name: "Email from Sarah Chen",
    description: "Re: Q4 planning session",
    time: "just now",
    color: "#ff7d3c",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <rect x="2" y="4" width="20" height="16" rx="2"/>
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
      </svg>
    ),
  },
  {
    name: "Meeting scheduled",
    description: "Alex Kumar · 30 min sync",
    time: "2m ago",
    color: "#00C9A7",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    ),
  },
  {
    name: "New connection",
    description: "Jordan Lee · via email",
    time: "5m ago",
    color: "#FFB800",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
  {
    name: "Follow-up due",
    description: "Maria Santos · 3 days overdue",
    time: "1h ago",
    color: "#FF3D71",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
    ),
  },
  {
    name: "Reply received",
    description: "David Kim · Project update",
    time: "2h ago",
    color: "#1E86FF",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    name: "Introduction sent",
    description: "Chen Wei → Taylor Brooks",
    time: "4h ago",
    color: "#7C3AED",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    ),
  },
];

const NOTIFICATION_ITEMS = Array(8).fill(NOTIFICATIONS).flat();

const TWEETS = [
  {
    name: "Lenny Rachitsky",
    handle: "@lennysan",
    initials: "LR",
    color: "#1DA1F2",
    text: "The people who reach out consistently — not just when they need something — are the ones everyone wants to help. Relationship debt compounds just like financial debt.",
    likes: "3.1K",
    reposts: "841",
    time: "4h",
  },
  {
    name: "Sahil Bloom",
    handle: "@SahilBloom",
    initials: "SB",
    color: "#ff7d3c",
    text: "Most people treat their network like a fire extinguisher — only reach for it in emergencies. The best connectors water the plant daily. Small touches, high frequency.",
    likes: "8.4K",
    reposts: "2.1K",
    time: "6h",
  },
  {
    name: "Wes Kao",
    handle: "@wes_kao",
    initials: "WK",
    color: "#7C3AED",
    text: "A warm intro converts 5× better than a cold one. The ROI on spending 10 mins to reconnect before asking a favour is absurdly high. Do the math.",
    likes: "2.7K",
    reposts: "612",
    time: "1d",
  },
  {
    name: "David Perell",
    handle: "@david_perell",
    initials: "DP",
    color: "#00C9A7",
    text: "The best relationship CRM is a simple habit: every week, reach out to one person you haven't spoken to in 90 days. One message. No agenda. Watch what happens.",
    likes: "5.9K",
    reposts: "1.3K",
    time: "2d",
  },
  {
    name: "Packy McCormick",
    handle: "@packym",
    initials: "PM",
    color: "#FFB800",
    text: "People remember how often you showed up, not how impressive you were when you did. Consistent > remarkable.",
    likes: "4.4K",
    reposts: "987",
    time: "3d",
  },
  {
    name: "Shreyas Doshi",
    handle: "@shreyas",
    initials: "SD",
    color: "#FF3D71",
    text: "Most professional relationships deteriorate not from conflict but from neglect. Silence is the default relationship-ender. Intentionality is the only antidote.",
    likes: "6.2K",
    reposts: "1.8K",
    time: "4d",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function NotificationCard({
  name, description, time, color, icon,
}: (typeof NOTIFICATIONS)[number]) {
  return (
    <div className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.04] p-3 backdrop-blur-sm">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: color + "22", color }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.75rem] font-medium text-white/90">{name}</p>
        <p className="truncate text-[0.67rem] text-white/40">{description}</p>
      </div>
      <span className="shrink-0 font-mono text-[0.55rem] text-white/30">{time}</span>
    </div>
  );
}

function AndroidFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto" style={{ width: 260, height: 530 }}>
      {/* Volume buttons left */}
      <div className="absolute left-[-2px] top-24 h-8 w-[2px] rounded-l-sm bg-white/10" />
      <div className="absolute left-[-2px] top-36 h-12 w-[2px] rounded-l-sm bg-white/10" />
      {/* Power button right */}
      <div className="absolute right-[-2px] top-28 h-10 w-[2px] rounded-r-sm bg-white/10" />
      {/* Body */}
      <div
        className="absolute inset-0 rounded-[2.8rem] border border-white/10 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]"
        style={{ background: "linear-gradient(145deg, #1c1b22 0%, #131218 100%)" }}
      >
        {/* Camera punch-hole */}
        <div className="absolute left-1/2 top-3.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-black ring-1 ring-white/10" />
        {/* Screen */}
        <div className="absolute inset-[8px] overflow-hidden rounded-[2.3rem] bg-[#0c0c10]">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pb-1 pt-4">
            <span className="font-mono text-[9px] font-medium text-white/50">9:41</span>
            <div className="flex items-center gap-1">
              {/* Signal dots */}
              {[0.3, 0.55, 0.8, 1].map((o, i) => (
                <div key={i} className="h-[5px] w-[2px] rounded-sm bg-white" style={{ opacity: o }} />
              ))}
              <div className="ml-1 h-[7px] w-[11px] rounded-sm border border-white/40 relative overflow-hidden">
                <div className="absolute inset-0 bg-white/70" style={{ width: "70%" }} />
              </div>
            </div>
          </div>
          {/* App label */}
          <div className="px-4 pb-2 pt-1">
            <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/30">Lucid · Activity</p>
          </div>
          {/* Scrollable list area — fixed height, no scroll visible */}
          <div className="px-2 pb-2" style={{ height: 410, overflow: "hidden" }}>
            {children}
          </div>
        </div>
        {/* Home indicator */}
        <div className="absolute bottom-2.5 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full bg-white/20" />
      </div>
    </div>
  );
}

function TweetCarousel() {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);

  useEffect(() => {
    const t = setInterval(() => {
      setDir(1);
      setIdx((p) => (p + 1) % TWEETS.length);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const tweet = TWEETS[idx];

  return (
    <div className="flex flex-col gap-4">
      {/* Main tweet card */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface" style={{ minHeight: 240 }}>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={idx}
            custom={dir}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="p-6"
          >
            {/* Header */}
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-[0.7rem] font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${tweet.color}cc, ${tweet.color}44)`, boxShadow: `0 0 20px ${tweet.color}33` }}
              >
                {tweet.initials}
              </div>
              <div>
                <p className="text-[0.88rem] font-semibold text-ink">{tweet.name}</p>
                <p className="font-mono text-[0.7rem] text-faint">{tweet.handle}</p>
              </div>
              <div className="ml-auto">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-faint">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </div>
            </div>
            {/* Tweet text */}
            <p className="text-[0.9rem] leading-relaxed text-muted">{tweet.text}</p>
            {/* Footer */}
            <div className="mt-4 flex items-center gap-4 border-t border-line pt-3">
              <span className="flex items-center gap-1.5 font-mono text-[0.65rem] text-faint">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                {tweet.likes}
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[0.65rem] text-faint">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                  <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
                {tweet.reposts}
              </span>
              <span className="ml-auto font-mono text-[0.6rem] text-faint">{tweet.time}</span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1.5">
        {TWEETS.map((_, i) => (
          <button
            key={i}
            onClick={() => { setDir(i > idx ? 1 : -1); setIdx(i); }}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: i === idx ? 20 : 6,
              background: i === idx ? "var(--color-accent)" : "var(--color-line-2)",
            }}
          />
        ))}
      </div>

      {/* Mini preview cards */}
      <div className="grid grid-cols-2 gap-2">
        {TWEETS.slice(0, 4).map((t, i) => (
          <button
            key={i}
            onClick={() => { setDir(i > idx ? 1 : -1); setIdx(i); }}
            className="rounded-xl border p-3 text-left transition-all duration-200"
            style={{
              borderColor: i === idx ? "var(--color-accent)" + "55" : "var(--color-line)",
              background: i === idx ? "var(--color-accent)" + "08" : "var(--color-surface)",
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className="h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-white font-mono"
                style={{ fontSize: 7, background: t.color + "99" }}
              >
                {t.initials}
              </div>
              <span className="font-mono text-[0.6rem] text-faint truncate">{t.handle}</span>
            </div>
            <p className="text-[0.68rem] text-muted line-clamp-2 leading-snug">{t.text}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.15em] text-faint">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
      {label}
    </span>
  );
}

function Constellation({ graph }: { graph: Graph }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0;
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas!.width = W * dpr; canvas!.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    const nodes: Sim[] = graph.nodes.map((n, i) => {
      const a = (i / graph.nodes.length) * Math.PI * 2 + Math.random();
      const rad = 20 + Math.random() * 90;
      return { ...n, x: W / 2 + Math.cos(a) * rad, y: H / 2 + Math.sin(a) * rad, vx: 0, vy: 0, r: 5 + Math.min(10, n.weight ?? 3) * 1.1 };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const edges = graph.edges.map((e) => ({ a: byId.get(e.source), b: byId.get(e.target) })).filter((e): e is { a: Sim; b: Sim } => !!e.a && !!e.b);
    const neighbours = new Map<string, Set<string>>();
    edges.forEach(({ a, b }) => {
      (neighbours.get(a.id) ?? neighbours.set(a.id, new Set()).get(a.id)!).add(b.id);
      (neighbours.get(b.id) ?? neighbours.set(b.id, new Set()).get(b.id)!).add(a.id);
    });

    const scaleNow = () => Math.max(0.55, Math.min(1, W / 720));
    const baseR = (n: Sim) => 5 + Math.min(10, n.weight ?? 3) * 1.1;

    function step() {
      const cx = W / 2, cy = H / 2, scale = scaleNow();
      const R = Math.min(W, H) / 2 - (44 * scale + 22), MAX = 6;
      const focus = selectedRef.current, fNbrs = focus ? neighbours.get(focus) : null;
      const repel = (focus ? 1500 : 700) * scale;
      for (const n of nodes) {
        n.r = baseR(n) * scale;
        let fx = 0, fy = 0;
        for (const m of nodes) {
          if (m === n) continue;
          const dx = n.x - m.x, dy = n.y - m.y, d2 = dx * dx + dy * dy + 0.01;
          const f = Math.min(focus ? 60 : 30, repel / d2);
          fx += f * dx; fy += f * dy;
        }
        if (focus) {
          if (n.id === focus) { fx += (cx - n.x) * 0.16; fy += (cy - n.y) * 0.16; }
          else if (fNbrs?.has(n.id)) { fx += (cx - n.x) * 0.015; fy += (cy - n.y) * 0.015; }
          else { const dx = n.x - cx, dy = n.y - cy, d = Math.hypot(dx, dy) || 0.01; fx += (dx / d) * 1.6 + (cx - n.x) * 0.004; fy += (dy / d) * 1.6 + (cy - n.y) * 0.004; }
        } else {
          fx += (cx - n.x) * 0.045 + (Math.random() - 0.5) * 0.2 * scale;
          fy += (cy - n.y) * 0.045 + (Math.random() - 0.5) * 0.2 * scale;
        }
        n.vx = (n.vx + fx) * 0.86; n.vy = (n.vy + fy) * 0.86;
      }
      for (const { a, b } of edges) {
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
        const touchesFocus = focus && (a.id === focus || b.id === focus);
        const rest = (touchesFocus ? 120 : 64) * scale, diff = (d - rest) * 0.04;
        const ux = dx / d, uy = dy / d;
        a.vx += ux * diff; a.vy += uy * diff; b.vx -= ux * diff; b.vy -= uy * diff;
      }
      for (const n of nodes) {
        const sp = Math.hypot(n.vx, n.vy);
        if (sp > MAX) { n.vx = (n.vx / sp) * MAX; n.vy = (n.vy / sp) * MAX; }
        n.x += n.vx; n.y += n.vy;
        const dx = n.x - cx, dy = n.y - cy, dist = Math.hypot(dx, dy) || 0.01, limit = R - n.r;
        if (dist > limit) { n.x = cx + (dx / dist) * limit; n.y = cy + (dy / dist) * limit; n.vx *= -0.3; n.vy *= -0.3; }
      }
    }

    function drawBackground(t: number) {
      // Deep dark base
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
      bg.addColorStop(0, "#14120f");
      bg.addColorStop(1, "#0c0c10");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Subtle dot grid
      const gs = 40;
      ctx.fillStyle = GC.grid;
      for (let x = gs / 2; x < W; x += gs) {
        for (let y = gs / 2; y < H; y += gs) {
          ctx.beginPath();
          ctx.arc(x, y, 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Faint radial ring
      const pulse = 0.03 + Math.sin(t * 0.0008) * 0.015;
      ctx.strokeStyle = `rgba(255,125,60,${pulse})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.38, 0, Math.PI * 2);
      ctx.stroke();
    }

    function drawEdge(a: Sim, b: Sim, active: boolean, hovered: string | null) {
      const alpha = active ? 0.85 : hovered ? 0.1 : 0.45;
      if (active) {
        // Glow pass
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = GC.edgeActive;
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        // Sharp line
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = GC.edgeActive;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      } else {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = GC.edgeFaint;
        ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }

    function drawNode(n: Sim, focused: boolean, isHovered: boolean, t: number) {
      const isPerson = n.type === "person";
      const color = isPerson ? GC.person : GC.topic;
      const glowColor = isPerson ? GC.personGlow : GC.topicGlow;
      const scale = scaleNow();

      ctx.globalAlpha = focused ? 1 : 0.22;

      // Outer atmospheric glow
      const aura = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4);
      aura.addColorStop(0, glowColor);
      aura.addColorStop(1, "transparent");
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2); ctx.fill();

      // Hover / selected pulse ring
      if (isHovered || selectedRef.current === n.id) {
        const pulse = 0.5 + Math.sin(t * 0.004) * 0.5;
        ctx.globalAlpha = focused ? pulse * 0.5 : 0;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 6 + pulse * 4, 0, Math.PI * 2); ctx.stroke();
      }

      ctx.globalAlpha = focused ? 1 : 0.25;

      // Inner ring
      ctx.strokeStyle = color;
      ctx.globalAlpha = focused ? 0.2 : 0.06;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 3 * scale, 0, Math.PI * 2); ctx.stroke();

      // Core node
      ctx.globalAlpha = focused ? 1 : 0.3;
      ctx.shadowColor = color;
      ctx.shadowBlur = isHovered ? 28 * scale : focused ? (isPerson ? 12 : 20) * scale : 0;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Inner bright dot
      ctx.globalAlpha = focused ? 0.9 : 0.2;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(n.x - n.r * 0.28, n.y - n.r * 0.28, n.r * 0.22, 0, Math.PI * 2); ctx.fill();

      ctx.globalAlpha = 1;
    }

    function drawLabel(n: Sim, focused: boolean, scale: number) {
      const fontPx = Math.max(9, Math.round(11 * scale));
      const maxLabel = scale < 0.72 ? 11 : 16;
      const trim = (s: string) => s.length > maxLabel ? s.slice(0, maxLabel - 1).trimEnd() + "…" : s;
      const isPerson = n.type === "person";

      ctx.globalAlpha = focused ? 1 : 0.15;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${isPerson ? 600 : 500} ${fontPx}px "Hanken Grotesk", sans-serif`;
      ctx.fillStyle = isPerson ? GC.person : "#ffa169";
      ctx.fillText(trim(n.label), n.x, n.y + n.r + fontPx);
      ctx.globalAlpha = 1;
    }

    let raf = 0, ticks = 0;
    function loop(t: number) {
      step();
      drawBackground(t);

      const hovered = selectedRef.current ?? hoverRef.current;
      const scale = scaleNow();

      for (const { a, b } of edges) {
        const active = !!(hovered && (a.id === hovered || b.id === hovered));
        drawEdge(a, b, active, hovered);
      }
      ctx.globalAlpha = 1;

      for (const n of nodes) {
        const focused = !hovered || n.id === hovered || !!(hovered && neighbours.get(hovered)?.has(n.id));
        const isHovered = hoverRef.current === n.id || selectedRef.current === n.id;
        drawNode(n, focused, isHovered, t);
      }

      for (const n of nodes) {
        const focused = !hovered || n.id === hovered || !!(hovered && neighbours.get(hovered)?.has(n.id));
        drawLabel(n, focused, scale);
      }

      ticks++;
      if (!(reduced && ticks > 120)) raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    function nodeAt(clientX: number, clientY: number): string | null {
      const rect = canvas!.getBoundingClientRect(), mx = clientX - rect.left, my = clientY - rect.top;
      for (const n of nodes) { if ((mx - n.x) ** 2 + (my - n.y) ** 2 < (n.r + 10) ** 2) return n.id; }
      return null;
    }
    function onMove(e: MouseEvent) { hoverRef.current = nodeAt(e.clientX, e.clientY); canvas!.style.cursor = hoverRef.current ? "pointer" : "default"; }
    function onTap(e: PointerEvent) { const found = nodeAt(e.clientX, e.clientY); selectedRef.current = selectedRef.current === found ? null : found; }
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("pointerdown", onTap);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); canvas.removeEventListener("mousemove", onMove); canvas.removeEventListener("pointerdown", onTap); window.removeEventListener("resize", resize); };
  }, [graph]);

  return (
    <canvas
      ref={canvasRef}
      className="h-[68vh] min-h-[460px] w-full touch-none rounded-[0.85rem]"
      role="img"
      aria-label="Force-directed graph of people and themes in your archive"
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Relationships() {
  const [relState, setRelState] = useState<"loading" | "empty" | "building" | "ready" | "error">("loading");
  const [rels, setRels] = useState<Rel[]>([]);
  const [graphState, setGraphState] = useState<"loading" | "empty" | "building" | "ready" | "error">("loading");
  const [graph, setGraph] = useState<Graph | null>(null);

  useEffect(() => {
    fetch(`${API}/relationships`)
      .then((r) => r.json())
      .then((d) => { if (d.relationships?.length) { setRels(d.relationships); setRelState("ready"); } else setRelState("empty"); })
      .catch(() => setRelState("error"));

    fetch(`${API}/graph`)
      .then((r) => r.json())
      .then((g: Graph) => { if (g.nodes?.length) { setGraph(g); setGraphState("ready"); } else setGraphState("empty"); })
      .catch(() => setGraphState("error"));
  }, []);

  async function buildRels() {
    setRelState("building");
    try {
      const r = await fetch(`${API}/relationships/build`, { method: "POST" });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setRels(d.relationships ?? []);
      setRelState("ready");
    } catch { setRelState("error"); }
  }

  async function buildGraph() {
    setGraphState("building");
    try {
      const r = await fetch(`${API}/graph/build`, { method: "POST" });
      if (!r.ok) throw new Error();
      const g = await r.json();
      setGraph(g);
      setGraphState("ready");
    } catch { setGraphState("error"); }
  }

  const max = Math.max(1, ...rels.map((r) => r.count));
  const marqueeLabels = rels.length > 0
    ? [...new Set(rels.map((r) => r.kind)), ...KIND_LABELS].slice(0, 20)
    : KIND_LABELS;

  return (
    <>
      {/* Full-screen world map background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-40">
        <WorldMap dots={MAP_DOTS} className="h-full" />
      </div>

      <Shell width="wide">
        {/* Header */}
        <div className="pb-6 pt-4">
          <p className="kicker mb-4 text-faint">Relationship Intelligence</p>
          <h1 className="font-display text-5xl leading-tight tracking-tight text-ink md:text-7xl">People</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
            Who fills your inbox, what they mean to you, and how often they reach out.
          </p>
        </div>

        {/* Marquee */}
        <div className="mb-12 overflow-hidden">
          <Marquee pauseOnHover repeat={3} className="[--duration:25s]">
            {marqueeLabels.map((label, i) => (
              <span key={i} className="inline-flex items-center rounded-full border border-line-2 bg-surface/70 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-faint backdrop-blur-sm">
                {label}
              </span>
            ))}
          </Marquee>
        </div>

        {/* Activity + Tweet carousel — side by side */}
        <div className="mb-16 grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* Left: Android phone with fixed-height animated list */}
          <div>
            <p className="kicker mb-5 text-faint">Live activity</p>
            <AndroidFrame>
              <AnimatedList delay={1200}>
                {NOTIFICATION_ITEMS.map((n, i) => (
                  <NotificationCard key={i} {...n} />
                ))}
              </AnimatedList>
            </AndroidFrame>
          </div>

          {/* Right: Tweet carousel */}
          <div>
            <p className="kicker mb-5 text-faint">Network wisdom</p>
            <TweetCarousel />
          </div>
        </div>

        {/* Your network */}
        <div className="mb-16">
          <p className="kicker mb-5 text-faint">Your network</p>

          {relState === "loading" && <Thinking label="Reading your relationships…" />}
          {relState === "error" && <StateNote>Couldn&rsquo;t reach the backend on <span className="font-mono text-faint">localhost:8000</span>.</StateNote>}
          {relState === "building" && <Thinking label="Grouping your archive by person…" />}

          {relState === "empty" && (
            <div className="card rise max-w-xl p-8 sm:p-10">
              <p className="text-[1rem] leading-relaxed text-muted">
                Lucid groups your archive by person and characterises each relationship — the people behind the noise.
              </p>
              <AccentButton onClick={buildRels} className="mt-8">
                Map my relationships <Arrow />
              </AccentButton>
            </div>
          )}

          {relState === "ready" && (
            <div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rels.map((r, i) => (
                  <div key={i} className="card flex gap-4 p-5 transition-colors hover:border-line-2">
                    <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line-2 font-mono text-[0.75rem] text-accent" aria-hidden="true">
                      <span className="absolute inset-0 rounded-full bg-accent/10 blur-[6px]" />
                      <span className="relative">{r.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <h2 className="font-display text-lg text-ink">{r.name}</h2>
                        <span className="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-faint">{r.kind}</span>
                      </div>
                      <p className="mt-1 text-[0.85rem] leading-relaxed text-muted">{r.note}</p>
                      <div className="mt-3 flex items-center gap-2.5">
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-line">
                          <span className="block h-full rounded-full bg-accent/70" style={{ width: `${(r.count / max) * 100}%` }} />
                        </span>
                        <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-faint">
                          <CountUp to={r.count} /> email{r.count === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={buildRels} className="mt-6 cursor-pointer font-mono text-[0.66rem] uppercase tracking-[0.18em] text-faint transition-colors hover:text-accent">
                ↻ Rebuild
              </button>
            </div>
          )}
        </div>

        {/* Constellation graph */}
        <div className="mb-10">
          <p className="kicker mb-5 text-faint">Constellation — people &amp; themes</p>

          {graphState === "loading" && <Thinking label="Loading your constellation…" />}
          {graphState === "error" && <StateNote>Couldn&rsquo;t reach the backend.</StateNote>}
          {graphState === "building" && <Thinking label="Mapping your archive… this takes a moment." />}

          {graphState === "empty" && (
            <div className="card rise max-w-xl p-8 sm:p-10">
              <p className="text-[1rem] leading-relaxed text-muted">
                Build a living map of who and what fills your archive — a constellation that settles into shape as it loads.
              </p>
              <AccentButton onClick={buildGraph} className="mt-8">
                Build constellation <Arrow />
              </AccentButton>
            </div>
          )}

          {graphState === "ready" && graph && (
            <div className="rise">
              <div className="overflow-hidden rounded-2xl border border-white/[0.06] p-1.5" style={{ background: "linear-gradient(145deg,#1c1a18,#0c0c10)" }}>
                <div className="overflow-hidden rounded-[0.75rem]">
                  <Constellation graph={graph} />
                </div>
              </div>
              <div className="mt-5 flex items-center gap-6">
                <Legend color={GC.person} label="People" />
                <Legend color={GC.topic} label="Themes" />
                <button onClick={buildGraph} className="ml-auto cursor-pointer font-mono text-[0.66rem] uppercase tracking-[0.18em] text-faint transition-colors hover:text-accent">
                  ↻ Rebuild
                </button>
              </div>
            </div>
          )}
        </div>
      </Shell>
    </>
  );
}
