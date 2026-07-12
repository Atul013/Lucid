"""Encryption at rest for Lucid's local JSON stores.

Everything Lucid keeps on disk in mock/dev mode — the archive, finance,
health, calendar and message stores, the Gmail OAuth token, the Telegram
bot token/session, the agent's report and audit log, the todo list — is
personal data or a live credential. Without this, any of it is plain text
readable by anything with filesystem access (a stolen laptop, a backup
leak, another process on a shared machine).

Degrades gracefully for local dev, same pattern as security.py:

- ``LUCID_ENCRYPTION_KEY`` unset  -> files are read/written as plain JSON,
  exactly as before (a one-time startup warning is logged).
- ``LUCID_ENCRYPTION_KEY`` set    -> every read/write through this module
  is Fernet-encrypted (AES-128-CBC + HMAC). Generate a key with:
      python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

Existing plaintext files are picked up transparently: a read that fails to
decrypt is retried as plain JSON, and the next write re-encrypts it — no
separate migration step needed.

Not covered: the real (non-mock) ChromaDB backend manages its own SQLite
file internally and has no pluggable encryption-at-rest hook. Protecting
that path means OS-level disk encryption (BitLocker/FileVault/LUKS) on
whatever host runs the backend — that's a deployment concern, not
something this module can wrap.
"""

import json
import logging
import os
import threading
from pathlib import Path
from typing import Any

logger = logging.getLogger("lucid.crypto_store")

_warned = False
_fernet = None
_fernet_lock = threading.Lock()


def _load_fernet():
    global _fernet, _warned
    if _fernet is not None:
        return _fernet
    with _fernet_lock:
        if _fernet is not None:
            return _fernet
        key = os.getenv("LUCID_ENCRYPTION_KEY", "").strip()
        if not key:
            if not _warned:
                logger.warning(
                    "LUCID_ENCRYPTION_KEY not set — local JSON stores are UNENCRYPTED on disk (dev mode)"
                )
                _warned = True
            _fernet = False  # sentinel: "checked, disabled" (distinct from "not yet checked")
            return _fernet
        from cryptography.fernet import Fernet

        try:
            _fernet = Fernet(key.encode())
        except (ValueError, TypeError) as e:
            raise ValueError(
                "LUCID_ENCRYPTION_KEY is set but not a valid Fernet key. Generate one with: "
                'python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
            ) from e
        return _fernet


def enabled() -> bool:
    return bool(_load_fernet())


def read_json(path: Path, default: Any) -> Any:
    """Read one JSON document, transparently decrypting if a key is set.
    Falls back to plain JSON if the file predates encryption being turned on."""
    if not path.exists():
        return default
    raw = path.read_bytes()
    if not raw:
        return default
    fernet = _load_fernet()
    if fernet:
        try:
            return json.loads(fernet.decrypt(raw).decode("utf-8"))
        except Exception:
            pass  # not a valid token yet — legacy plaintext, fall through
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception:
        return default


def write_json(path: Path, data: Any) -> None:
    """Write one JSON document, encrypting it if a key is set."""
    text = json.dumps(data, indent=2, ensure_ascii=False, default=str)
    fernet = _load_fernet()
    if fernet:
        path.write_bytes(fernet.encrypt(text.encode("utf-8")))
    else:
        path.write_text(text, encoding="utf-8")


def append_line(path: Path, data: Any) -> None:
    """Append one JSON record to an append-only log. Each line is encrypted
    independently (Fernet tokens are urlsafe-base64, so they're newline-safe
    and joinable) so existing lines never need rewriting."""
    text = json.dumps(data, default=str)
    fernet = _load_fernet()
    line = fernet.encrypt(text.encode("utf-8")).decode("ascii") if fernet else text
    with path.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def read_lines(path: Path) -> list[Any]:
    """Read an append-only log written by append_line. Lines that fail to
    parse (encrypted with a different/rotated key, or corrupt) are skipped
    rather than failing the whole read."""
    if not path.exists():
        return []
    fernet = _load_fernet()
    out = []
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        parsed = None
        if fernet:
            try:
                parsed = json.loads(fernet.decrypt(raw_line.encode("ascii")).decode("utf-8"))
            except Exception:
                parsed = None
        if parsed is None:
            try:
                parsed = json.loads(raw_line)
            except Exception:
                continue
        out.append(parsed)
    return out
