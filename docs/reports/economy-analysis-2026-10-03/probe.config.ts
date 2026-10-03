import { defineConfig } from "vitest/config"
export default defineConfig({ test: {
  include: ["docs/reports/economy-analysis-2026-10-03/probes.ts"],
  testTimeout: 60_000, fileParallelism: false,
} })
