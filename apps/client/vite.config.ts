import { defineConfig } from "vite"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(fileURLToPath(import.meta.url))
const repo = join(root, "..", "..")

export default defineConfig({
  root,
  publicDir: "public",
  assetsInclude: ["**/*.hex", "**/*.woff2", "**/*.glb"],
  server: {
    fs: { allow: [repo] },
  },
  build: {
    outDir: "dist-web",
    emptyOutDir: true,
    target: "es2022",
  },
})
