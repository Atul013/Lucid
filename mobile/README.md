# Lucid Mobile (React Native / Expo)

## What's here

A minimal Expo/TypeScript client: enter the backend URL (and `LUCID_API_KEY`
if the server requires one) once, stored in the platform keychain via
`expo-secure-store` — never bundled into the app binary, matching the fix
already applied to the Electron client in the `secure_os_layer` review.
From there it's a single Archive chat screen against `POST /archive/ask`.

```
lib/config.ts   SecureStore-backed backend URL + API key
lib/api.ts      fetch wrapper — same X-API-Key contract as the web frontend
App.tsx         settings + Archive chat UI
```

Verified so far: `tsc --noEmit` is clean, and the request/response shape in
`lib/api.ts` was checked against a live run of the actual FastAPI backend
(`/health`, `/archive/ask` in mock LLM mode). Not yet verified: an actual
device or emulator launch — this dev box has Node/npm but no Android SDK or
Xcode, so `expo start --android` / `--ios` are unverified. Run those on a
machine with the native tooling before shipping.

## Local-LLM follow-up (not built yet)

The longer-range idea from the roadmap discussion: run a small quantized
model on-device for fast/offline answers, falling back to this backend for
anything heavier. Scoped, not started:

- **Binding**: `llama.rn` (React Native bindings for llama.cpp) — needs a
  native build, so Expo Go won't work; requires `expo prebuild` or a dev
  client.
- **Model**: start with Phi-3-mini or TinyLlama, quantized (Q4), bundled or
  downloaded on first launch (~2-4 GB) rather than shipped in the app store
  binary.
- **Routing**: local model handles quick recall (todos, calendar), routes
  to `/archive/ask` and `/agent/run` for anything needing the full archive
  or the autonomous agent loop.
- **Offline**: local model + a periodically-synced subset of ChromaDB data
  is the plan for full offline use; not designed yet.

This needs a real device/emulator to build and test — not something to
scaffold blind.
