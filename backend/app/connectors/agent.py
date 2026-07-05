"""Autonomous agent loop (Phase 2) — the twin starts acting on itself.

A plain tool-use loop over llm.chat(): the LLM sees the tool catalog, replies
with one JSON tool call per turn, gets the observation back, and iterates
until it calls finish. No LangChain — the loop is ~40 lines and the existing
llm.py mock keeps it working offline.

The agent only ever *proposes*: message drafts and calendar changes are
recorded for the user to act on. Its only real side effects are additive and
low-risk — adding a todo, and sending the wrap-up to the user's own Telegram.
"""
import json
import os
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from app.connectors import chroma, llm, twin
from app.connectors import calendar as calendar_connector
from app.connectors import health as health_connector
from app.connectors import telegram as telegram_connector
from app.connectors import todos

REPORT_FILE = Path("agent_report.json")
MAX_STEPS = 14
RUN_BUDGET_SECONDS = 720  # live reasoning models can take minutes per step
_lock = threading.Lock()

DEFAULT_GOAL = (
    "Review my upcoming week. If my stress risk is high, find what is driving "
    "it, check who or what I've been neglecting, and take helpful low-risk "
    "actions: draft replies, propose calendar changes, add todos, and send me "
    "a short wrap-up on Telegram."
)


# ---------------------------------------------------------------- tools

def _tool_stress_forecast(args: dict) -> dict:
    model = twin.train()
    now = twin.simulate_workload(0, 0)
    return {
        "current_daily_stress_risk": now["current_risk"],
        "level": now["current_level"],
        "baseline": model["baseline"],
        "trained_on_days": model["days"],
    }


def _tool_simulate(args: dict) -> dict:
    r = twin.simulate_workload(
        float(args.get("extra_meeting_hours", 0)),
        float(args.get("sleep_delta_hours", 0)),
    )
    return {k: r[k] for k in ("current_risk", "simulated_risk", "change", "summary")}


def _tool_calendar_summary(args: dict) -> dict:
    s = calendar_connector.summarize(chroma.all_events())
    if s.get("events"):
        return {
            k: s[k]
            for k in (
                "median_weekly_hours", "overload_weeks", "busiest_day",
                "after_hours_meetings", "top_recurring",
            )
        } | {"recent_weeks": s["weekly_workload"][-4:]}
    return s


def _tool_health_summary(args: dict) -> dict:
    s = health_connector.summarize(chroma.all_health())
    if s.get("days"):
        return {
            k: s[k]
            for k in ("last_7_days", "baseline", "sleep_debt_hours_last_7_days", "rough_patches")
        }
    return s


def _tool_search_archive(args: dict) -> list[str]:
    hits = chroma.search_emails(str(args.get("query", "")), 4)
    return [h.get("text", "")[:400] for h in hits]


def _tool_draft_message(args: dict, actions: list) -> str:
    draft = {
        "type": "draft_message",
        "to": str(args.get("to", "")),
        "subject": str(args.get("subject", "")),
        "body": str(args.get("body", "")),
    }
    actions.append(draft)
    return f"Draft to {draft['to']} saved for your review (not sent)."


def _tool_propose_calendar_change(args: dict, actions: list) -> str:
    prop = {
        "type": "calendar_change",
        "action": str(args.get("action", "")),
        "event": str(args.get("event_title", "")),
        "reason": str(args.get("reason", "")),
    }
    actions.append(prop)
    return f"Proposal recorded: {prop['action']} ‘{prop['event']}’ (needs your approval)."


def _tool_add_todo(args: dict, actions: list) -> str:
    item = todos.add(str(args.get("text", ""))[:300])
    actions.append({"type": "todo", "text": item["text"], "id": item["id"]})
    return f"Todo #{item['id']} added: {item['text']}"


def _tool_send_telegram(args: dict, actions: list) -> str:
    text = str(args.get("text", ""))[:3500]
    if not telegram_connector.is_connected():
        return "Telegram is not connected — wrap-up kept in the report instead."
    try:
        telegram_connector.send_message("🤖 Lucid agent\n\n" + text)
        actions.append({"type": "telegram", "text": text})
        return "Wrap-up delivered to your Telegram."
    except Exception as e:
        return f"Telegram send failed: {e}"


TOOLS = {
    "stress_forecast": {
        "spec": "stress_forecast() — the twin's current daily high-stress probability and baseline",
        "run": lambda a, actions: _tool_stress_forecast(a),
    },
    "simulate": {
        "spec": "simulate(extra_meeting_hours: float, sleep_delta_hours: float) — what-if on next week's stress risk",
        "run": lambda a, actions: _tool_simulate(a),
    },
    "calendar_summary": {
        "spec": "calendar_summary() — recent weekly meeting load, overload weeks, after-hours creep, recurring meetings",
        "run": lambda a, actions: _tool_calendar_summary(a),
    },
    "health_summary": {
        "spec": "health_summary() — last-7-days sleep/HRV/stress vs baseline, sleep debt, rough patches",
        "run": lambda a, actions: _tool_health_summary(a),
    },
    "search_archive": {
        "spec": "search_archive(query: str) — search the user's message archive",
        "run": lambda a, actions: _tool_search_archive(a),
    },
    "draft_message": {
        "spec": "draft_message(to: str, subject: str, body: str) — save a reply draft for the user to review (never sends)",
        "run": _tool_draft_message,
    },
    "propose_calendar_change": {
        "spec": "propose_calendar_change(action: str, event_title: str, reason: str) — e.g. decline/shorten/move a meeting; recorded, not applied",
        "run": _tool_propose_calendar_change,
    },
    "add_todo": {
        "spec": "add_todo(text: str) — add an item to the user's todo list",
        "run": _tool_add_todo,
    },
    "send_telegram": {
        "spec": "send_telegram(text: str) — send the final wrap-up to the user's own Telegram",
        "run": _tool_send_telegram,
    },
    "finish": {"spec": "finish(summary: str) — end the run with a one-paragraph summary", "run": None},
}

SYSTEM_PROMPT = (
    "You are Lucid's autonomous agent, acting for the user based on their "
    "digital twin. You work in steps: each turn, reply with EXACTLY ONE JSON "
    'object — {"tool": "<name>", "args": {...}} — and nothing else. You will '
    "get an Observation back, then choose the next tool. Investigate before "
    "acting (forecast/summaries/search first, actions after). Prefer few, "
    "high-value actions. Always end with finish(summary).\n\nTools:\n"
    + "\n".join(f"- {t['spec']}" for t in TOOLS.values())
)


def _parse_call(text: str) -> dict | None:
    """Pull the tool-call JSON out of the reply. Reasoning models wrap the
    JSON in prose (which may itself contain braces), so try every '{' and
    keep the first candidate that parses to a dict with a "tool" key."""
    decoder = json.JSONDecoder()
    for m in re.finditer(r"\{", text):
        try:
            obj, _ = decoder.raw_decode(text[m.start():])
        except json.JSONDecodeError:
            continue
        if isinstance(obj, dict) and "tool" in obj:
            return obj
    return None


_worker: threading.Thread | None = None


def running() -> bool:
    return _worker is not None and _worker.is_alive()


def run_async(goal: str | None = None) -> bool:
    """Kick off a run in the background (live LLM runs take minutes).
    Returns False if one is already in flight."""
    global _worker
    if running():
        return False
    _worker = threading.Thread(target=run, args=(goal,), daemon=True)
    _worker.start()
    return True


def run(goal: str | None = None) -> dict:
    """Execute one agent run, persisting the report after every step so the
    UI can watch progress while a slow live LLM thinks."""
    with _lock:
        goal = (goal or DEFAULT_GOAL).strip()
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Goal: {goal}"},
        ]
        steps: list[dict] = []
        actions: list[dict] = []
        summary = ""
        started = time.monotonic()

        report = {
            "ran_at": datetime.now(timezone.utc).isoformat(),
            "goal": goal,
            "mode": "live" if os.getenv("NVIDIA_API_KEY") else "mock",
            "steps": steps,
            "actions": actions,
            "summary": "",
            "finished": False,
        }

        def _flush():
            REPORT_FILE.write_text(json.dumps(report, indent=2), encoding="utf-8")

        _flush()
        warned_wrap_up = False
        for step_idx in range(MAX_STEPS):
            if time.monotonic() - started > RUN_BUDGET_SECONDS:
                summary = (
                    f"Stopped at the {RUN_BUDGET_SECONDS // 60}-minute time budget after "
                    f"{len(steps)} steps and {len(actions)} actions. "
                    "Partial findings are in the step trace."
                )
                break
            # Live models tend to keep taking small actions (another todo,
            # another draft) instead of wrapping up. With few steps left,
            # force the issue once so a run ends with a summary/wrap-up
            # rather than just running out of steps mid-action.
            remaining = MAX_STEPS - step_idx
            if remaining <= 3 and not warned_wrap_up:
                warned_wrap_up = True
                messages.append({
                    "role": "user",
                    "content": (
                        f"Only {remaining} steps remain before this run auto-stops. "
                        "Stop investigating or adding more actions. If you haven't "
                        "sent the Telegram wrap-up yet, call send_telegram now with "
                        "a summary of findings and actions taken, then call "
                        "finish(summary) as your very next tool call."
                    ),
                })
            # A reasoning model can blow past the HTTP read timeout, and the
            # free-tier NIM endpoint 429s under load; retry with a backoff
            # (longer for 429, since retrying instantly just re-hits the
            # same rate window), and if the LLM stays unreachable end the
            # run with a report instead of dying silently in the worker
            # thread.
            reply, llm_error = None, None
            for attempt in range(3):
                try:
                    reply = llm.chat(messages, max_tokens=700, temperature=0.2)
                    break
                except Exception as e:
                    llm_error = e
                    if attempt < 2:
                        time.sleep(30 if "429" in str(e) else 3)
            if reply is None:
                summary = (
                    f"Run stopped early — the LLM did not respond ({llm_error}). "
                    f"Completed {len(steps)} steps and {len(actions)} actions before stopping."
                )
                break
            call = _parse_call(reply)
            if call is None:
                summary = reply.strip()[:1500]
                break

            name = str(call.get("tool", ""))
            args = call.get("args") or {}
            if name == "finish":
                summary = str(args.get("summary", ""))[:1500]
                steps.append({"tool": "finish", "args": args, "observation": "run complete"})
                break

            tool = TOOLS.get(name)
            if tool is None:
                obs = f"Unknown tool '{name}'. Valid: {', '.join(TOOLS)}"
            else:
                try:
                    obs = tool["run"](args, actions)
                except Exception as e:
                    obs = f"Tool error: {e}"

            obs_text = obs if isinstance(obs, str) else json.dumps(obs, default=str)
            steps.append({"tool": name, "args": args, "observation": obs_text[:800]})
            messages.append({"role": "assistant", "content": json.dumps(call)})
            messages.append({"role": "user", "content": f"Observation: {obs_text[:2000]}"})
            _flush()

        report["summary"] = summary or "Run ended without a summary."
        report["finished"] = True
        _flush()
        return report


def last_report() -> dict | None:
    if REPORT_FILE.exists():
        try:
            return json.loads(REPORT_FILE.read_text(encoding="utf-8"))
        except Exception:
            return None
    return None
