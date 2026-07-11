"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Shell, PageHeader, Reveal, GhostButton } from "../ui";
import { API } from "../api";

const DOCS = "https://github.com/Atul013/Lucid/blob/development/docs/connect";
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

async function jsonOrThrow(r: Response) {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail ?? `HTTP ${r.status}`);
  return d;
}

// Status probes must never hang a card on "Checking…" — a firewall that
// silently drops packets would otherwise leave the connect form unreachable.
const statusFetch = (path: string) =>
  fetch(`${API}${path}`, { signal: AbortSignal.timeout(5000) });

// ── Individual connector states ──────────────────────────────────────────────

function useGmail() {
  const [status, setStatus] = useState<Status>("checking");
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState<number | null>(null);

  useEffect(() => {
    statusFetch("/gmail/status")
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

// WhatsApp has two independent gates, and conflating them is confusing:
//
//   serviceReady — Lucid's own account is linked to WhatsApp. An *operator*
//                  step: someone holding the business SIM scans a QR, once,
//                  when the server is set up. Users never do this.
//   paired       — this user proved they own their number by messaging Lucid a
//                  one-time code. This is the *user's* connect flow.
//
// Both must be true before WhatsApp works.
function useWhatsApp() {
  const [serviceReady, setServiceReady] = useState<boolean | null>(null);
  const [paired, setPaired] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      statusFetch("/whatsapp/status")
        .then((r) => r.json())
        .then((d) => {
          setServiceReady(Boolean(d.ready));
          setPaired(Boolean(d.paired));
          return Boolean(d.paired);
        })
        .catch(() => {
          setServiceReady(false);
          return false;
        }),
    [],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Once a code is issued, poll until the user's message lands and the backend
  // binds their number.
  useEffect(() => {
    if (!claiming) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const r = await statusFetch("/whatsapp/pair/status");
        const d = await r.json();
        if (cancelled) return;
        if (d.paired) {
          setClaiming(false);
          setCode(null);
          setPaired(true);
          return;
        }
        if (d.expired) {
          setClaiming(false);
          setCode(null);
          setError("That code expired. Try again.");
        }
      } catch {
        /* transient — keep polling */
      }
    };

    const id = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [claiming]);

  async function connect() {
    setError(null);
    try {
      const r = await fetch(`${API}/whatsapp/pair/start`, { method: "POST" });
      const d = await r.json();
      setCode(d.code);
      setClaiming(true);
    } catch {
      setError("Couldn't reach the backend.");
    }
  }

  async function disconnect() {
    await fetch(`${API}/whatsapp/pair`, { method: "DELETE" }).catch(() => {});
    setPaired(false);
    setCode(null);
    setClaiming(false);
  }

  const status: Status =
    serviceReady === null ? "checking" : paired ? "connected" : "disconnected";

  return { status, serviceReady, paired, code, claiming, error, connect, disconnect };
}

function useTelegram() {
  const [status, setStatus] = useState<Status>("checking");
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  function refresh() {
    statusFetch("/telegram/status")
      .then((r) => r.json())
      .then((d) => {
        setStatus(d.connected ? "connected" : "disconnected");
        setBotUsername(d.bot_username ?? null);
        setChatId(d.chat_id ?? null);
      })
      .catch(() => setStatus("error"));
  }

  useEffect(refresh, []);

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setNote(null);
    try {
      setNote(await fn());
    } catch (e) {
      setNote(`✗ ${e instanceof Error ? e.message : "Something went wrong"}`);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  const connect = (token: string) =>
    run(async () => {
      const d = await jsonOrThrow(
        await fetch(`${API}/telegram/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bot_token: token }),
        }),
      );
      return `✓ Connected as @${d.bot_username}`;
    });

  const sync = () =>
    run(async () => {
      const d = await jsonOrThrow(
        await fetch(`${API}/telegram/sync`, { method: "POST" }),
      );
      if (d.live)
        return `✓ Live bot is on — archiving in real time (${d.total_archived} so far). Try /todo in the chat.`;
      return d.fetched === 0
        ? "✓ Synced — no new messages (message your bot first)"
        : `✓ ${d.ingested} messages archived`;
    });

  const sendTest = () =>
    run(async () => {
      await jsonOrThrow(
        await fetch(`${API}/telegram/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "Lucid is connected. 🌘" }),
        }),
      );
      return "✓ Test message sent — check Telegram";
    });

  const disconnect = () =>
    run(async () => {
      await fetch(`${API}/telegram/disconnect`, { method: "DELETE" });
      return "Disconnected.";
    });

  return { status, botUsername, chatId, busy, note, connect, sync, sendTest, disconnect };
}

function useSeedable(seedPath: string, syncPath?: string) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setNote(null);
    try {
      setNote(await fn());
    } catch (e) {
      setNote(`✗ ${e instanceof Error ? e.message : "Something went wrong"}`);
    } finally {
      setBusy(false);
    }
  }

  const seed = () =>
    run(async () => {
      const d = await jsonOrThrow(await fetch(`${API}${seedPath}`, { method: "POST" }));
      return `✓ ${d.ingested} records loaded (demo)`;
    });

  const sync = () =>
    run(async () => {
      if (!syncPath) return "";
      const d = await jsonOrThrow(await fetch(`${API}${syncPath}`));
      return `✓ ${d.ingested} synced from Google`;
    });

  return { busy, note, seed, sync, run };
}

// ── UI bits ──────────────────────────────────────────────────────────────────

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
  guide,
  children,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
  status: Status;
  actions: React.ReactNode;
  badge?: string;
  guide?: string;
  children?: React.ReactNode;
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
              {guide && (
                <a
                  href={`${DOCS}/${guide}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-faint underline decoration-line-2 underline-offset-4 hover:text-muted"
                >
                  guide ↗
                </a>
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
      {children}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {actions}
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <span className="w-full font-mono text-[0.62rem] tracking-wide text-muted">
      {children}
    </span>
  );
}

function CredentialInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="h-10 w-full rounded-lg border border-line-2 bg-surface-2 px-4 font-mono text-[0.72rem] text-ink placeholder:text-faint focus:border-faint focus:outline-none"
    />
  );
}

function ComingSoonActions() {
  return (
    <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-faint">
      Coming soon
    </span>
  );
}

// Hidden file input + button, for upload-style connectors.
function UploadButton({
  label,
  accept,
  disabled,
  onFile,
}: {
  label: string;
  accept: string;
  disabled?: boolean;
  onFile: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <GhostButton disabled={disabled} onClick={() => ref.current?.click()}>
        {label}
      </GhostButton>
    </>
  );
}

// ── Telegram card (token form) ───────────────────────────────────────────────

function TelegramCard() {
  const tg = useTelegram();
  const [token, setToken] = useState("");
  const [showSteps, setShowSteps] = useState(false);

  return (
    <ConnectorCard
      icon={<TelegramIcon />}
      name="Telegram"
      description="Dual role — messages sent to your bot join the archive, and Lucid replies with briefings and alerts."
      status={tg.status}
      guide="TELEGRAM_CONNECT.md"
      actions={
        tg.status === "connected" ? (
          <>
            <GhostButton onClick={tg.sync} disabled={tg.busy}>
              {tg.busy ? "Working…" : "Sync messages"}
            </GhostButton>
            <GhostButton onClick={tg.sendTest} disabled={tg.busy}>
              Send test
            </GhostButton>
            <GhostButton onClick={tg.disconnect} disabled={tg.busy} className="ml-auto">
              Disconnect
            </GhostButton>
            <Note>
              @{tg.botUsername}
              {tg.chatId ? ` · chat ${tg.chatId}` : " · no chat yet — message your bot, then Sync"}
              {tg.note ? ` — ${tg.note}` : ""}
            </Note>
          </>
        ) : tg.status === "checking" ? (
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-faint">
            Checking…
          </span>
        ) : (
          <div className="flex w-full flex-col gap-3">
            <div className="flex w-full gap-2">
              <CredentialInput
                type="password"
                placeholder="Bot token from @BotFather — 123456789:AAF…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && token.trim()) tg.connect(token);
                }}
              />
              <GhostButton
                disabled={tg.busy || !token.trim()}
                onClick={() => tg.connect(token)}
              >
                {tg.busy ? "…" : "Connect"}
              </GhostButton>
            </div>
            <button
              onClick={() => setShowSteps((s) => !s)}
              className="self-start font-mono text-[0.6rem] uppercase tracking-[0.18em] text-faint underline decoration-line-2 underline-offset-4 hover:text-muted"
            >
              {showSteps ? "Hide setup steps" : "No bot yet? 60-second setup ↓"}
            </button>
            {showSteps && (
              <ol className="flex flex-col gap-1.5 text-[0.78rem] leading-relaxed text-muted">
                <li>1 · Open Telegram, search <span className="text-ink">@BotFather</span>, press Start.</li>
                <li>2 · Send <span className="font-mono text-ink">/newbot</span> — pick a display name, then a username ending in <span className="font-mono">bot</span>.</li>
                <li>3 · Copy the token BotFather replies with and paste it above.</li>
                <li>4 · After connecting: message your new bot anything, hit Sync — Lucid learns your chat and can reply.</li>
              </ol>
            )}
            <Note>{tg.note}</Note>
          </div>
        )
      }
    />
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ConnectorsPage() {
  const gmail = useGmail();
  const wa = useWhatsApp();
  const cal = useSeedable("/calendar/seed", "/calendar/sync");
  const fin = useSeedable("/finance/seed");
  const health = useSeedable("/health-data/seed");

  const uploadFinance = (f: File) =>
    fin.run(async () => {
      const form = new FormData();
      form.append("file", f);
      const d = await jsonOrThrow(
        await fetch(`${API}/finance/upload`, { method: "POST", body: form }),
      );
      return `✓ ${d.ingested} transactions from ${f.name}`;
    });

  const uploadHealth = (f: File) =>
    health.run(async () => {
      const payload = JSON.parse(await f.text());
      const d = await jsonOrThrow(
        await fetch(`${API}/health-data/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      return `✓ ${d.ingested} days from ${f.name}`;
    });

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
          guide="GMAIL_CONNECT.md"
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

        {/* Telegram */}
        <TelegramCard />

        {/* WhatsApp */}
        <ConnectorCard
          icon={<WhatsAppIcon />}
          name="WhatsApp"
          description="Message Lucid on WhatsApp. Notes land in your archive, questions get answered from it, and commands run your todo list."
          status={wa.status}
          guide="WHATSAPP_CONNECT.md"
          actions={
            wa.status === "checking" ? (
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-faint">
                Checking…
              </span>
            ) : wa.paired ? (
              <>
                <a href={waLink()} target="_blank" rel="noopener noreferrer">
                  <GhostButton>Message Lucid →</GhostButton>
                </a>
                <GhostButton onClick={wa.disconnect}>Unlink</GhostButton>
                <span className="ml-auto font-mono text-[0.6rem] uppercase tracking-[0.18em] text-faint">
                  +91 99952 65115
                </span>
              </>
            ) : (
              <GhostButton onClick={wa.connect} disabled={wa.claiming || !wa.serviceReady}>
                {wa.claiming ? "Waiting for your message…" : "Connect my WhatsApp"}
              </GhostButton>
            )
          }
        >
          {wa.claiming && wa.code && (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-line-2 bg-surface-2 p-6">
              <p className="text-center text-[0.82rem] leading-relaxed text-muted">
                Send this code to Lucid on WhatsApp from the phone you want to
                connect. Receiving it is how Lucid knows the number is yours.
              </p>
              <div className="font-mono text-2xl tracking-[0.3em] text-ink">
                {wa.code}
              </div>
              <a
                href={`https://wa.me/${LUCID_WA}?text=${encodeURIComponent(wa.code)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <GhostButton>Open WhatsApp with the code →</GhostButton>
              </a>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-faint">
                Expires in 5 minutes · waiting…
              </p>
            </div>
          )}

          {wa.error && <Note>{wa.error}</Note>}

          {/* Operator concern, not the user's: the Lucid service itself has to be
              linked to WhatsApp before anyone can message it. */}
          {wa.serviceReady === false && (
            <Note>
              Lucid&apos;s WhatsApp service is offline, so it can&apos;t receive
              messages yet. That&apos;s a one-time server setup — whoever runs
              Lucid links the business number by scanning a QR in the
              whatsapp_service terminal. Nothing for you to scan.
            </Note>
          )}
        </ConnectorCard>

        {/* Google Calendar — reuses the Gmail OAuth connection */}
        <ConnectorCard
          icon={<CalendarIcon />}
          name="Google Calendar"
          description="Events and scheduling patterns feed the Digital Twin's workload history and your daily briefing."
          status={gmail.status}
          guide="CALENDAR_CONNECT.md"
          actions={
            <>
              {gmail.status === "connected" ? (
                <GhostButton onClick={cal.sync} disabled={cal.busy}>
                  {cal.busy ? "Working…" : "Sync Google Calendar"}
                </GhostButton>
              ) : (
                <a href={`${API}/auth/google`}>
                  <GhostButton>Connect Google →</GhostButton>
                </a>
              )}
              <GhostButton onClick={cal.seed} disabled={cal.busy}>
                Load demo events
              </GhostButton>
              <Note>{cal.note}</Note>
            </>
          }
        />

        {/* Financial data */}
        <ConnectorCard
          icon={<FinanceIcon />}
          name="Bank Statement"
          description="Upload a statement CSV — spending categories, subscriptions and cash-flow forecast, all parsed locally."
          status="connected"
          guide="FINANCE_CONNECT.md"
          actions={
            <>
              <UploadButton
                label="Upload CSV"
                accept=".csv,text/csv"
                disabled={fin.busy}
                onFile={uploadFinance}
              />
              <GhostButton onClick={fin.seed} disabled={fin.busy}>
                Load demo statement
              </GhostButton>
              <Note>{fin.note}</Note>
            </>
          }
        />

        {/* Health data */}
        <ConnectorCard
          icon={<HealthIcon />}
          name="Smartwatch Export"
          description="Sleep, HRV, steps and stress from a smartwatch JSON export — correlated with your mood timeline."
          status="connected"
          guide="HEALTH_CONNECT.md"
          actions={
            <>
              <UploadButton
                label="Upload JSON"
                accept=".json,application/json"
                disabled={health.busy}
                onFile={uploadHealth}
              />
              <GhostButton onClick={health.seed} disabled={health.busy}>
                Load demo export
              </GhostButton>
              <Note>{health.note}</Note>
            </>
          }
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
      <path d="M6.5 12l4 1.5L16 8l-4 5.5 3.5 2.5 2-9.5-11 4.5Z" stroke="var(--color-accent)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
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

function FinanceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <rect x="2" y="6" width="20" height="13" rx="2" stroke="var(--color-faint)" strokeWidth="1.4"/>
      <path d="M2 10h20" stroke="var(--color-accent)" strokeWidth="1.4"/>
      <path d="M6 15h5" stroke="var(--color-faint)" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function HealthIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M3 12h4l2-5 3 10 2.5-6.5L16 12h5" stroke="var(--color-accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
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
