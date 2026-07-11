/* One place for the backend base URL.
 *
 * Priority:
 * 1. NEXT_PUBLIC_API_URL — explicit override (e.g. a deployed backend on Azure).
 * 2. In the browser: the hostname the page was loaded from, port 8000 — so
 *    phone testing over LAN keeps working no matter which wifi network
 *    assigned which IP. Open http://<laptop-ip>:3000 and the app talks to
 *    http://<laptop-ip>:8000 automatically.
 * 3. localhost — the server-render pass only; every fetch runs client-side.
 */
export const API =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== "undefined"
    ? `http://${window.location.hostname}:8000`
    : "http://localhost:8000");

/* Backend API key (optional).
 *
 * When the backend runs with LUCID_API_KEY set, every request must carry a
 * matching X-API-Key header. Rather than editing the fetch call in every
 * page, patch window.fetch once here — this module is already imported by
 * every page that talks to the backend. Requests to other origins are
 * untouched. When NEXT_PUBLIC_LUCID_API_KEY is unset (local dev default)
 * nothing changes.
 */
const API_KEY = process.env.NEXT_PUBLIC_LUCID_API_KEY ?? "";

declare global {
  interface Window {
    __lucidFetchPatched?: boolean;
  }
}

if (typeof window !== "undefined" && API_KEY && !window.__lucidFetchPatched) {
  window.__lucidFetchPatched = true; // survive HMR re-evaluation
  const origFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    if (url.startsWith(API)) {
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      headers.set("X-API-Key", API_KEY);
      init = { ...init, headers };
    }
    return origFetch(input, init);
  };
}
