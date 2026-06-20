import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin the workspace root so the dev/build tooling doesn't pick a parent lockfile.
  turbopack: { root: projectRoot },
  // Surface real type errors at build time rather than silently passing.
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
