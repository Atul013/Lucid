"use client";
import { useRef } from "react";

export function GlareCard({
  children,
  className = "",
  containerClassName = "",
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}) {
  const isPointerInside = useRef(false);
  const refElement = useRef<HTMLDivElement>(null);
  const state = useRef({
    glare: { x: 50, y: 50 },
    background: { x: 50, y: 50 },
    rotate: { x: 0, y: 0 },
  });

  const containerStyle = {
    "--m-x": "50%",
    "--m-y": "50%",
    "--r-x": "0deg",
    "--r-y": "0deg",
    "--bg-x": "50%",
    "--bg-y": "50%",
    "--duration": "300ms",
    "--foil-size": "100%",
    "--opacity": "0",
    "--radius": "16px",
    "--easing": "ease",
    "--transition": "var(--duration) var(--easing)",
  } as React.CSSProperties;

  const backgroundStyle = {
    "--step": "5%",
    "--foil-svg": `url("data:image/svg+xml,%3Csvg width='26' height='26' viewBox='0 0 26 26' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2.99994 3.419C2.99994 3.419 21.6142 7.43646 22.7921 12.153C23.97 16.8695 3.41838 23.0306 3.41838 23.0306' stroke='white' stroke-width='5' stroke-miterlimit='3.86874' stroke-linecap='round' style='mix-blend-mode:darken'/%3E%3C/svg%3E")`,
    "--pattern": "var(--foil-svg) center/100% no-repeat",
    "--rainbow":
      "repeating-linear-gradient(0deg,rgb(255,119,115) calc(var(--step)*1),rgba(255,237,95,1) calc(var(--step)*2),rgba(168,255,95,1) calc(var(--step)*3),rgba(131,255,247,1) calc(var(--step)*4),rgba(120,148,255,1) calc(var(--step)*5),rgb(216,117,255) calc(var(--step)*6),rgb(255,119,115) calc(var(--step)*7)) 0% var(--bg-y)/200% 700% no-repeat",
    "--diagonal":
      "repeating-linear-gradient(128deg,#0e152e 0%,hsl(180,10%,60%) 3.8%,hsl(180,10%,60%) 4.5%,hsl(180,10%,60%) 5.2%,#0e152e 10%,#0e152e 12%) var(--bg-x) var(--bg-y)/300% no-repeat",
    "--shade":
      "radial-gradient(farthest-corner circle at var(--m-x) var(--m-y),rgba(255,255,255,0.1) 12%,rgba(255,255,255,0.15) 20%,rgba(255,255,255,0.25) 120%) var(--bg-x) var(--bg-y)/300% no-repeat",
    backgroundBlendMode: "hue, hue, hue, overlay",
  } as React.CSSProperties;

  const updateStyles = () => {
    if (!refElement.current) return;
    const { background, rotate, glare } = state.current;
    refElement.current.style.setProperty("--m-x", `${glare.x}%`);
    refElement.current.style.setProperty("--m-y", `${glare.y}%`);
    refElement.current.style.setProperty("--r-x", `${rotate.x}deg`);
    refElement.current.style.setProperty("--r-y", `${rotate.y}deg`);
    refElement.current.style.setProperty("--bg-x", `${background.x}%`);
    refElement.current.style.setProperty("--bg-y", `${background.y}%`);
  };

  return (
    <div
      style={containerStyle}
      className={
        "relative isolate w-full transition-transform delay-[var(--delay)] duration-[var(--duration)] ease-[var(--easing)] will-change-transform [contain:layout_style] [perspective:600px]" +
        (containerClassName ? " " + containerClassName : "")
      }
      ref={refElement}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const pct = { x: (100 / rect.width) * pos.x, y: (100 / rect.height) * pos.y };
        const delta = { x: pct.x - 50, y: pct.y - 50 };
        const rotateFactor = 0.4;
        const { background, rotate, glare } = state.current;
        background.x = 50 + pct.x / 4 - 12.5;
        background.y = 50 + pct.y / 3 - 16.67;
        rotate.x = -(delta.x / 3.5) * rotateFactor;
        rotate.y = (delta.y / 2) * rotateFactor;
        glare.x = pct.x;
        glare.y = pct.y;
        updateStyles();
      }}
      onPointerEnter={() => {
        isPointerInside.current = true;
        setTimeout(() => {
          if (isPointerInside.current) {
            refElement.current?.style.setProperty("--duration", "0s");
          }
        }, 300);
      }}
      onPointerLeave={() => {
        isPointerInside.current = false;
        refElement.current?.style.removeProperty("--duration");
        refElement.current?.style.setProperty("--r-x", "0deg");
        refElement.current?.style.setProperty("--r-y", "0deg");
      }}
    >
      <div className="grid overflow-hidden rounded-[var(--radius)] border border-[color:var(--color-line)] transition-transform delay-[var(--delay)] duration-[var(--duration)] ease-[var(--easing)] will-change-transform [transform:rotateY(var(--r-x))_rotateX(var(--r-y))] hover:filter-none hover:[--duration:200ms] hover:[--easing:linear] hover:[--opacity:0.6]">
        {/* Content layer */}
        <div className="w-full mix-blend-soft-light [clip-path:inset(0_0_0_0_round_var(--radius))] [grid-area:1/1]">
          <div className={"w-full bg-[var(--color-surface)] " + className}>
            {children}
          </div>
        </div>
        {/* Glare overlay */}
        <div className="pointer-events-none w-full opacity-[var(--opacity)] mix-blend-soft-light transition-opacity delay-[var(--delay)] duration-[var(--duration)] ease-[var(--easing)] [background:radial-gradient(farthest-corner_circle_at_var(--m-x)_var(--m-y),_rgba(255,255,255,0.8)_10%,_rgba(255,255,255,0.65)_20%,_rgba(255,255,255,0)_90%)] [clip-path:inset(0_0_1px_0_round_var(--radius))] [grid-area:1/1]" />
        {/* Foil / rainbow overlay */}
        <div
          className="pointer-events-none relative w-full opacity-[var(--opacity)] mix-blend-color-dodge transition-opacity [background:var(--pattern),_var(--rainbow),_var(--diagonal),_var(--shade)] [background-blend-mode:hue_hue_hue_overlay] [clip-path:inset(0_0_1px_0_round_var(--radius))] [grid-area:1/1] after:bg-[inherit] after:[background-size:var(--foil-size),_200%_400%,_800%,_200%] after:[background-position:center,_0%_var(--bg-y),_calc(var(--bg-x)*_-1)_calc(var(--bg-y)*_-1),_var(--bg-x)_var(--bg-y)] after:[background-blend-mode:soft-light,_hue,_hard-light] after:mix-blend-exclusion after:content-['']"
          style={backgroundStyle}
        />
      </div>
    </div>
  );
}
