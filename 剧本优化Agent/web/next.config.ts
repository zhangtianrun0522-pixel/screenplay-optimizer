import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.SCRIPT_AGENT_NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
