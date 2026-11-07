import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/lonceng_test",
      QR_SECRET: "test-secret",
      AUTH_SECRET: "test-secret",
    },
  },
});
