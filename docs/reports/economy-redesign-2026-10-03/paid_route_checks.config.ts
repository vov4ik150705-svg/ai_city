import { defineConfig } from "vitest/config"
export default defineConfig({test:{include:["docs/reports/economy-redesign-2026-10-03/paid_route_checks.ts"],testTimeout:60000,fileParallelism:false,sequence:{concurrent:false}}})

