"use client";

import { useState, useEffect, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const COLORS = {
  paper: "#faf8f4",
  ink: "#1b1714",
  accent: "#b4470f",
  faint: "#9b938a",
  line: "#e7e1d8",
};

type Node = {
  id: string;
  label: string;
  type: "person" | "topic";
  weight?: number;
};
type Edge = { source: string; target: string };
type Graph = { generated?: boolean; nodes: Node[]; edges: Edge[] };

type Sim = Node & { x: number; y: number; vx: number; vy: number; r: number };

export default function GraphPage() {
  const [state, setState] = useState<
    "loading" | "empty" | "building" | "ready" | "error"
  >("loading");
  const [graph, setGraph] = useState<Graph | null>(null);

  useEffect(() => {
    fetch(`${API}/graph`)
      .then((r) => r.json())
      .then((g: Graph) => {
        if (g.nodes?.length) {
          setGraph(g);
          setState("ready");
        } else setState("empty");
      })
      .catch(() => setState("error"));
  }, []);

  async function build() {
    setState("building");
    try {
      const r = await fetch(`${API}/graph/build`, { method: "POST" });
      if (!r.ok) throw new Error();
      const g = await r.json();
      setGraph(g);
      setState("ready");
    } catch {
      setState("error");
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-4xl flex-col px-6 py-12 sm:py-16">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-medium leading-none tracking-tight text-ink sm:text-5xl">
          Constellation
        </h1>
        <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-muted">
          The people and themes in your archive, and how they connect.
        </p>
      </header>

      {state === "loading" && (
        <p className="text-[0.95rem] text-faint">Loading&hellip;</p>
      )}
      {state === "error" && (
        <p className="text-[0.95rem] text-muted">
          Couldn&rsquo;t reach the backend on{" "}
          <span className="tabular-nums">localhost:8000</span>.
        </p>
      )}
      {state === "building" && (
        <p className="text-[0.95rem] text-faint">
          Mapping your archive&hellip; this takes a moment.
        </p>
      )}
      {state === "empty" && (
        <div className="border-t border-line pt-10">
          <p className="max-w-md text-[0.95rem] leading-relaxed text-muted">
            Build a living map of who and what fills your archive.
          </p>
          <button
            onClick={build}
            className="mt-7 inline-flex h-11 cursor-pointer items-center gap-2 bg-ink px-6 text-[0.8rem] font-medium uppercase tracking-[0.15em] text-paper transition-colors hover:bg-accent"
          >
            Build constellation
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      )}

      {state === "ready" && graph && (
        <>
          <Constellation graph={graph} />
          <div className="mt-6 flex items-center gap-6">
            <Legend color={COLORS.ink} label="People" />
            <Legend color={COLORS.accent} label="Themes" />
            <button
              onClick={build}
              className="ml-auto cursor-pointer text-[0.7rem] font-medium uppercase tracking-[0.15em] text-faint transition-colors hover:text-accent"
            >
              Rebuild
            </button>
          </div>
        </>
      )}
    </main>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-[0.15em] text-faint">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function Constellation({ graph }: { graph: Graph }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let W = 0;
    let H = 0;
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    // Initialise nodes in a ring around the centre.
    const nodes: Sim[] = graph.nodes.map((n, i) => {
      const a = (i / graph.nodes.length) * Math.PI * 2;
      return {
        ...n,
        x: W / 2 + Math.cos(a) * 120,
        y: H / 2 + Math.sin(a) * 120,
        vx: 0,
        vy: 0,
        r: 4 + Math.min(10, (n.weight ?? 3)) * 0.9,
      };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const edges = graph.edges
      .map((e) => ({ a: byId.get(e.source), b: byId.get(e.target) }))
      .filter((e): e is { a: Sim; b: Sim } => !!e.a && !!e.b);

    const neighbours = new Map<string, Set<string>>();
    edges.forEach(({ a, b }) => {
      (neighbours.get(a.id) ?? neighbours.set(a.id, new Set()).get(a.id)!).add(b.id);
      (neighbours.get(b.id) ?? neighbours.set(b.id, new Set()).get(b.id)!).add(a.id);
    });

    function step() {
      const cx = W / 2;
      const cy = H / 2;
      for (const n of nodes) {
        let fx = 0;
        let fy = 0;
        for (const m of nodes) {
          if (m === n) continue;
          const dx = n.x - m.x;
          const dy = n.y - m.y;
          const d2 = dx * dx + dy * dy + 0.01;
          const f = 2200 / d2;
          fx += f * dx;
          fy += f * dy;
        }
        fx += (cx - n.x) * 0.012;
        fy += (cy - n.y) * 0.012;
        n.vx = (n.vx + fx) * 0.82;
        n.vy = (n.vy + fy) * 0.82;
      }
      for (const { a, b } of edges) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const diff = (d - 110) * 0.02;
        const ux = dx / d;
        const uy = dy / d;
        a.vx += ux * diff;
        a.vy += uy * diff;
        b.vx -= ux * diff;
        b.vy -= uy * diff;
      }
      for (const n of nodes) {
        n.x = Math.max(n.r + 4, Math.min(W - n.r - 4, n.x + n.vx));
        n.y = Math.max(n.r + 4, Math.min(H - n.r - 4, n.y + n.vy));
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const hovered = hoverRef.current;
      const near = hovered ? neighbours.get(hovered) : null;

      // edges
      for (const { a, b } of edges) {
        const active = hovered && (a.id === hovered || b.id === hovered);
        ctx.strokeStyle = active ? COLORS.accent : COLORS.line;
        ctx.lineWidth = active ? 1.4 : 0.8;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // nodes + labels
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const n of nodes) {
        const dim =
          hovered && n.id !== hovered && !near?.has(n.id) ? 0.35 : 1;
        ctx.globalAlpha = dim;
        const isPerson = n.type === "person";
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = isPerson ? COLORS.ink : COLORS.accent;
        ctx.fill();

        ctx.font = `${isPerson ? 12 : 11}px "Hanken Grotesk", sans-serif`;
        ctx.fillStyle = isPerson ? COLORS.ink : COLORS.accent;
        ctx.fillText(n.label, n.x, n.y + n.r + 9, 140);
        ctx.globalAlpha = 1;
      }
    }

    let raf = 0;
    let ticks = 0;
    function loop() {
      step();
      draw();
      ticks++;
      // Reduced motion: settle quickly then hold.
      if (!(reduced && ticks > 120)) raf = requestAnimationFrame(loop);
    }
    loop();

    function onMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let found: string | null = null;
      for (const n of nodes) {
        if ((mx - n.x) ** 2 + (my - n.y) ** 2 < (n.r + 8) ** 2) {
          found = n.id;
          break;
        }
      }
      hoverRef.current = found;
      canvas!.style.cursor = found ? "pointer" : "default";
      if (reduced) draw();
    }
    canvas.addEventListener("mousemove", onMove);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", resize);
    };
  }, [graph]);

  return (
    <canvas
      ref={canvasRef}
      className="h-[60vh] min-h-[420px] w-full rounded-sm border border-line"
      role="img"
      aria-label="Force-directed graph of people and themes in your archive"
    />
  );
}
