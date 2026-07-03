import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let devices on the local network (phone testing) load dev-mode assets —
  // Next 16 blocks cross-origin dev resources by default, which freezes the
  // app at its server-rendered state (no hydration, dead buttons).
  allowedDevOrigins: ["192.168.1.48", "192.168.65.60"],
};

export default nextConfig;
