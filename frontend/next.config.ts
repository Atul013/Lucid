import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let devices on the local network (phone testing) load dev-mode assets —
  // Next 16 blocks cross-origin dev resources by default, which freezes the
  // app at its server-rendered state (no hydration, dead buttons).
  // Wildcards match per dot-segment, so these cover any private LAN IP the
  // wifi network hands out — no more editing this file on every network hop.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
};

export default nextConfig;
