import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    testTimeout: 60_000,
    fileParallelism: false,
    exclude: ["**/node_modules/**", "**/dist/**", "docs/archive/**"],
    // The handbook test reads its @font-face ranges; every other stylesheet stays stubbed.
    css: { include: [/apps\/www\/src\/docs\/handbook\/fonts\.css/] },
  },
})
