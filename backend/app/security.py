"""Security layer for the Lucid API.

Architecture adapted from the secure_os_layer project review: a permission
middleware sits in front of every route and validates a header-based key
(their X-App-ID pattern), extended with the hardening its audit called for —
per-client rate limiting, security response headers, a payload size cap and
an audit log.

Everything degrades gracefully for local dev:

- ``LUCID_API_KEY`` unset  -> auth disabled, API behaves exactly as before.
- ``LUCID_API_KEY`` set    -> every route except PUBLIC_PATHS requires a
  matching ``X-API-Key`` header (constant-time compare).

Tunables (all env vars):

- ``LUCID_API_KEY``          shared secret for X-API-Key auth (off if empty)
- ``RATE_LIMIT_PER_MINUTE``  requests per client IP per minute (default 300)
- ``MAX_BODY_BYTES``         request payload cap in bytes (default 5 MB)
- ``LUCID_AUDIT_LOG``        "0" silences the per-request audit log line
"""

import hmac
import logging
import os
import time
from collections import deque

from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

# Reachable without a key: health probe for deploy checks, and the API
# reference pages (they contain no data; every call they describe still
# needs the key).
PUBLIC_PATHS = {"/health", "/docs", "/openapi.json"}

audit_log = logging.getLogger("lucid.audit")


def _client_ip(request: Request) -> str:
    # Behind Azure/Vercel proxies the socket peer is the proxy; prefer the
    # forwarded client. Locally there is no such header and .client is right.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class APIKeyMiddleware(BaseHTTPMiddleware):
    """Reject requests without a valid X-API-Key when LUCID_API_KEY is set."""

    async def dispatch(self, request: Request, call_next):
        expected = os.getenv("LUCID_API_KEY", "").strip()
        if not expected or request.url.path in PUBLIC_PATHS or request.method == "OPTIONS":
            return await call_next(request)

        provided = request.headers.get("x-api-key", "")
        if not provided:
            return JSONResponse({"detail": "Missing X-API-Key header"}, status_code=401)
        if not hmac.compare_digest(provided, expected):
            audit_log.warning("auth rejected: bad key from %s for %s", _client_ip(request), request.url.path)
            return JSONResponse({"detail": "Invalid API key"}, status_code=401)
        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding one-minute window per client IP, kept in process memory.

    Good enough for a single-instance deployment (the Azure B1s plan);
    a shared store is only needed if the backend ever scales out.
    """

    WINDOW_SECONDS = 60.0

    def __init__(self, app):
        super().__init__(app)
        self.limit = int(os.getenv("RATE_LIMIT_PER_MINUTE", "300"))
        self.hits: dict[str, deque] = {}

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/health" or request.method == "OPTIONS":
            return await call_next(request)

        now = time.monotonic()
        ip = _client_ip(request)
        window = self.hits.setdefault(ip, deque())
        while window and now - window[0] > self.WINDOW_SECONDS:
            window.popleft()

        if len(window) >= self.limit:
            retry_after = max(1, int(self.WINDOW_SECONDS - (now - window[0])))
            return JSONResponse(
                {"detail": "Rate limit exceeded, slow down"},
                status_code=429,
                headers={"Retry-After": str(retry_after)},
            )
        window.append(now)

        # Don't let one-off clients accumulate forever.
        if len(self.hits) > 1024:
            self.hits = {k: v for k, v in self.hits.items() if v and now - v[-1] <= self.WINDOW_SECONDS}
        return await call_next(request)


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Refuse oversized payloads up front via Content-Length."""

    async def dispatch(self, request: Request, call_next):
        max_bytes = int(os.getenv("MAX_BODY_BYTES", str(5 * 1024 * 1024)))
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > max_bytes:
            return JSONResponse({"detail": "Request body too large"}, status_code=413)
        return await call_next(request)


class AuditLogMiddleware(BaseHTTPMiddleware):
    """One structured line per request: who called what, result, duration."""

    async def dispatch(self, request: Request, call_next):
        start = time.monotonic()
        response = await call_next(request)
        if os.getenv("LUCID_AUDIT_LOG", "1") != "0" and request.url.path != "/health":
            audit_log.info(
                "%s %s -> %d (%.0f ms) from %s",
                request.method,
                request.url.path,
                response.status_code,
                (time.monotonic() - start) * 1000,
                _client_ip(request),
            )
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Standard hardening headers on every response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        return response


def install(app: FastAPI) -> None:
    """Wire the whole security stack onto the app.

    Call this BEFORE app.add_middleware(CORSMiddleware, ...) in main.py:
    Starlette runs the last-added middleware outermost, and CORS must stay
    outermost so 401/429 responses still carry CORS headers the browser
    will accept.

    Request path (outer -> inner): CORS -> headers -> audit -> body cap ->
    rate limit -> API key -> routes.
    """
    app.add_middleware(APIKeyMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(BodySizeLimitMiddleware)
    app.add_middleware(AuditLogMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)

    if not os.getenv("LUCID_API_KEY", "").strip():
        audit_log.warning("LUCID_API_KEY not set — API key auth is DISABLED (dev mode)")
