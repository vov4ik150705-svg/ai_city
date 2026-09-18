import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = dirname(fileURLToPath(import.meta.url))
const repo = join(root, "..", "..")

export default defineConfig({
  server: {
    fs: { allow: [repo] },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 60_000,
  },
})
