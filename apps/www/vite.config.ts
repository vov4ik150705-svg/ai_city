import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

const root = dirname(fileURLToPath(import.meta.url))
const repo = join(root, "..", "..")
const clientNm = join(repo, "apps", "client", "node_modules")
const threePkg = join(repo, "node_modules", ".pnpm", "three@0.185.1", "node_modules", "three")

export default defineConfig({
  root,
  publicDir: "public",
  appType: "spa",
  resolve: {
    alias: [
      { find: "react", replacement: join(clientNm, "react") },
      { find: "react-dom", replacement: join(clientNm, "react-dom") },
      { find: "lucide-react", replacement: join(repo, "node_modules", "lucide-react") },
      {
        find: /^three\/addons\/(.*)/,
        replacement: `${threePkg.replaceAll("\\", "/")}/examples/jsm/$1`,
      },
      { find: /^three$/, replacement: threePkg },
    ],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "lucide-react", "three", "motion/react"],
  },
  server: {
    host: "127.0.0.1",
    port: 5180,
    strictPort: true,
    fs: { allow: [repo] },
  },
  preview: {
    host: "127.0.0.1",
    port: 5180,
    strictPort: true,
  },
  build: {
    outDir: "dist-web",
    emptyOutDir: true,
    target: "es2022",
  },
})
