import type { NextConfig } from "next";
import { existsSync } from "node:fs";

if (existsSync("../../.env")) process.loadEnvFile("../../.env");

const config: NextConfig = {
  transpilePackages: ["@lonceng/core", "@lonceng/db"],
  serverExternalPackages: ["@node-rs/argon2", "pg", "exceljs"],
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // The scanner needs the camera; everything else stays locked down.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default config;
