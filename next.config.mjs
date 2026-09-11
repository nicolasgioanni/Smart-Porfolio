import { fileURLToPath } from "node:url";

/** @type {import("next").NextConfig} */
const nextConfig = {
  adapterPath: fileURLToPath(new URL("./scripts/nextBuildAdapter.mjs", import.meta.url)),
  output: "export",
  images: {
    unoptimized: true
  }
};

export default nextConfig;
