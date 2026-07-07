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
