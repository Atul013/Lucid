"use client";

import { useState, useEffect } from "react";
import { Shell, PageHeader, Reveal, GhostButton } from "../ui";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const LUCID_WA = "919995265115";

const WA_GREETINGS = [
  "Hey Lucid, connect me!",
  "Hi Lucid!",
  "Hello Lucid, I'm in.",
  "Hey — connect my archive.",
  "Lucid, let's go.",
];
const waLink = () =>
  `https://wa.me/${LUCID_WA}?text=${encodeURIComponent(
    WA_GREETINGS[Math.floor(Math.random() * WA_GREETINGS.length)],
  )}`;

type Status = "checking" | "connected" | "disconnected" | "error";

// ── Individual connector states ──────────────────────────────────────────────

function useGmail() {
  const [status, setStatus] = useState<Status>("checking");
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API}/gmail/status`)
      .then((r) => r.json())
      .then((d) => setStatus(d.connected ? "connected" : "disconnected"))
      .catch(() => setStatus("error"));
  }, []);

  async function sync() {
    setSyncing(true);
    try {
      const r = await fetch(`${API}/gmail/sync?max_results=50`);
      const d = await r.json();
      setSynced(d.ingested ?? 0);
    } catch {
      /* ignore */
    } finally {
      setSyncing(false);
    }
  }

  return { status, syncing, synced, sync };
}

function useWhatsApp() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    fetch(`${API}/whatsapp/status`)
      .then((r) => r.json())
      .then((d) => setStatus(d.ready ? "connected" : "disconnected"))
      .catch(() => setStatus("disconnected"));
  }, []);

  return { status };
}

// ── Connector card ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: Status }) {
  const cls =
    status === "connected"
      ? "bg-accent pulse-dot"
      : status === "checking"
        ? "bg-faint animate-pulse"
        : "bg-line-2";
  return <span className={`h-2 w-2 rounded-full shrink-0 ${cls}`} />;
}

function ConnectorCard({
  icon,
  name,
  description,
  status,
  actions,
  badge,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
  status: Status;
  actions: React.ReactNode;
  badge?: string;
}) {
  const statusLabel =
    status === "connected"
      ? "Connected"
      : status === "checking"
        ? "Checking…"
        : status === "error"
          ? "Error"
          : "Not connected";

  return (
    <div className="card flex flex-col gap-6 p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line-2 bg-surface-2 text-xl">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-[1.05rem] font-medium text-ink">
                {name}
              </h3>
              {badge && (
                <span className="rounded-full border border-line-2 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.2em] text-faint">
                  {badge}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[0.82rem] leading-relaxed text-muted">
              {description}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <StatusDot status={status} />
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-faint">
            {statusLabel}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {actions}
      </div>
    </div>
  );
}

function ComingSoonActions() {
  return (
    <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-faint">
      Coming soon
    </span>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ConnectorsPage() {
  const gmail = useGmail();
  const wa = useWhatsApp();

  return (
    <Shell>
      <PageHeader
        kicker="Data Sources"
        title="Connectors"
        lead="Everything Lucid knows comes from here. Connect your sources and your archive grows richer."
      />

      <Reveal stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Gmail */}
        <ConnectorCard
          icon={<GmailIcon />}
          name="Gmail"
          description="Read-only access to your inbox. Emails are embedded locally — nothing leaves your machine."
          status={gmail.status}
          actions={
            gmail.status === "connected" ? (
              <>
                <GhostButton onClick={gmail.sync} disabled={gmail.syncing}>
                  {gmail.syncing
                    ? "Syncing…"
                    : gmail.synced !== null
                      ? `✓ ${gmail.synced} indexed`
                      : "Sync now"}
                </GhostButton>
                <GhostButton
                  onClick={() =>
                    fetch(`${API}/gmail/status`)
                      .then((r) => r.json())
                      .then((d) => alert(d.connected ? "Gmail is connected." : "Not connected."))
                  }
                >
                  Test
                </GhostButton>
                <a href={`${API}/auth/google`} className="ml-auto">
                  <GhostButton>Reconnect</GhostButton>
                </a>
              </>
            ) : gmail.status === "checking" ? (
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-faint">
                Checking…
              </span>
            ) : (
              <a href={`${API}/auth/google`}>
                <GhostButton>Connect Gmail →</GhostButton>
              </a>
            )
          }
        />

        {/* WhatsApp */}
        <ConnectorCard
          icon={<WhatsAppIcon />}
          name="WhatsApp"
          description="Messages from Lucid's business number land in your archive and trigger AI-generated replies."
          status={wa.status}
          actions={
            wa.status === "connected" ? (
              <>
                <GhostButton
                  onClick={() =>
                    fetch(`${API}/whatsapp/status`)
                      .then((r) => r.json())
                      .then((d) => alert(d.ready ? "WhatsApp bridge is live." : "Bridge offline."))
                  }
                >
                  Test
                </GhostButton>
                <span className="ml-auto font-mono text-[0.6rem] uppercase tracking-[0.18em] text-faint">
                  +91 99952 65115
                </span>
              </>
            ) : wa.status === "checking" ? (
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-faint">
                Checking…
              </span>
            ) : (
              <a
                href={waLink()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  (e.currentTarget as HTMLAnchorElement).href = waLink();
                }}
              >
                <GhostButton>Message Lucid on WhatsApp →</GhostButton>
              </a>
            )
          }
        />

        {/* Telegram */}
        <ConnectorCard
          icon={<TelegramIcon />}
          name="Telegram"
          description="Dual role — data source and delivery channel for your morning briefing."
          status="disconnected"
          badge="soon"
          actions={<ComingSoonActions />}
        />

        {/* Google Calendar */}
        <ConnectorCard
          icon={<CalendarIcon />}
          name="Google Calendar"
          description="Events and scheduling patterns feed into your daily briefing and drift analysis."
          status="disconnected"
          badge="soon"
          actions={<ComingSoonActions />}
        />

        {/* Notion */}
        <ConnectorCard
          icon={<NotionIcon />}
          name="Notion"
          description="Pages and databases become searchable, queryable parts of your archive."
          status="disconnected"
          badge="soon"
          actions={<ComingSoonActions />}
        />

        {/* Google Keep */}
        <ConnectorCard
          icon={<KeepIcon />}
          name="Google Keep"
          description="Quick notes and reminders archived and surfaced in context."
          status="disconnected"
          badge="soon"
          actions={<ComingSoonActions />}
        />

        {/* Discord */}
        <ConnectorCard
          icon={<DiscordIcon />}
          name="Discord"
          description="Server messages and DMs indexed so nothing important gets buried."
          status="disconnected"
          badge="soon"
          actions={<ComingSoonActions />}
        />

        {/* Local Notes */}
        <ConnectorCard
          icon={<ObsidianIcon />}
          name="Local Notes"
          description="Watch a folder of .md files — Obsidian, Logseq, or any markdown vault."
          status="disconnected"
          badge="soon"
          actions={<ComingSoonActions />}
        />

      </Reveal>
    </Shell>
  );
}

// ── Icons (inline SVG, no external deps) ────────────────────────────────────

function GmailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M2 6.5A2.5 2.5 0 0 1 4.5 4h15A2.5 2.5 0 0 1 22 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 17.5v-11Z" stroke="var(--color-faint)" strokeWidth="1.4"/>
      <path d="M2 7l10 7 10-7" stroke="var(--color-accent)" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" stroke="var(--color-faint)" strokeWidth="1.4"/>
      <path d="M8 11.5c.5 3 5.5 5.5 7 3.5-.5-1-1.5-1-2-1s-.5.5-1 .5c-1 0-3-2-3-3 0-.5.5-.5.5-1s0-1.5-1.5-1.5c-1 0-1 1.5 0 3Z" stroke="var(--color-accent)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" stroke="var(--color-faint)" strokeWidth="1.4"/>
      <path d="M7 12l3 3 7-7" stroke="var(--color-faint)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="var(--color-faint)" strokeWidth="1.4"/>
      <path d="M3 10h18M8 3v4M16 3v4" stroke="var(--color-faint)" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function NotionIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" stroke="var(--color-faint)" strokeWidth="1.4"/>
      <path d="M8 8h8M8 12h6M8 16h4" stroke="var(--color-faint)" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function KeepIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M12 3C8.5 3 6 5.5 6 9c0 2.5 1.5 4.5 3 5.5V19a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-4.5c1.5-1 3-3 3-5.5 0-3.5-2.5-6-6-6Z" stroke="var(--color-faint)" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M9 19h6" stroke="var(--color-faint)" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M9 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0ZM13 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z" fill="var(--color-faint)"/>
      <path d="M8.5 5.5S6 6 4 9c0 0-2 3.5-2 7 0 0 1.5 2.5 5 2.5l1-1.5s-2-.5-3-2c0 0 3 2 7 2s7-2 7-2c-1 1.5-3 2-3 2L17 18.5c3.5 0 5-2.5 5-2.5 0-3.5-2-7-2-7-2-2.5-4.5-3-4.5-3L15 7.5" stroke="var(--color-faint)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ObsidianIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M4 6h16M4 10h10M4 14h13M4 18h7" stroke="var(--color-faint)" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
