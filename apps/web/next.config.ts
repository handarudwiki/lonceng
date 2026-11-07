import type { NextConfig } from "next";
import { existsSync } from "node:fs";

if (existsSync("../../.env")) process.loadEnvFile("../../.env");

const config: NextConfig = {
  transpilePackages: ["@lonceng/core", "@lonceng/db"],
  serverExternalPackages: ["@node-rs/argon2", "pg", "exceljs"],
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default config;
