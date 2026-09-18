import { createReadStream, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { IncomingMessage, ServerResponse } from "node:http"
import { defineConfig, type Plugin, type ViteDevServer } from "vite"

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, "../..")
const threeRoot = resolve(repo, "packages/render/node_modules/three")
const sessionFile = resolve(here, "maps/studio-session.json")
const SESSION_MAX_BYTES = 8_000_000

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    req.on("data", (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      total += buf.length
      if (total > SESSION_MAX_BYTES) {
        reject(new Error("session too large"))
        return
      }
      chunks.push(buf)
    })
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
}

function sendFile(res: ServerResponse, file: string): void {
  const type = file.toLowerCase().endsWith(".png")
    ? "image/png"
    : file.toLowerCase().endsWith(".jpg") || file.toLowerCase().endsWith(".jpeg")
      ? "image/jpeg"
      : file.toLowerCase().endsWith(".json")
        ? "application/json"
        : "model/gltf-binary"
  res.setHeader("Content-Type", type)
  res.setHeader("Cache-Control", "no-store")
  createReadStream(file).pipe(res)
}

function artAssetsPlugin(): Plugin {
  const handle = async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    const raw = req.url?.split("?")[0] ?? ""
    if (raw === "/api/studio-session") {
      if (req.method === "GET" || req.method === "HEAD") {
        if (!existsSync(sessionFile) || !statSync(sessionFile).isFile()) {
          res.statusCode = 404
          res.end()
          return
        }
        sendFile(res, sessionFile)
        return
      }
      if (req.method === "POST" || req.method === "PUT") {
        try {
          const text = await readBody(req)
          const parsed: unknown = JSON.parse(text)
          if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            throw new Error("session must be object")
          }
          const incoming = parsed as { rev?: unknown }
          const inRev = typeof incoming.rev === "number" && Number.isFinite(incoming.rev) ? incoming.rev : 0
          if (existsSync(sessionFile) && statSync(sessionFile).isFile()) {
            try {
              const diskParsed: unknown = JSON.parse(readFileSync(sessionFile, "utf8"))
              if (typeof diskParsed === "object" && diskParsed !== null && !Array.isArray(diskParsed)) {
                const diskRevRaw = (diskParsed as { rev?: unknown }).rev
                const diskRev = typeof diskRevRaw === "number" && Number.isFinite(diskRevRaw) ? diskRevRaw : 0
                if (inRev < diskRev) {
                  res.statusCode = 409
                  res.setHeader("Content-Type", "application/json; charset=utf-8")
                  res.end('{"ok":false,"reason":"stale"}')
                  return
                }
              }
            } catch {
              /* disk unreadable — take incoming */
            }
          }
          writeFileSync(sessionFile, text)
          res.statusCode = 200
          res.setHeader("Content-Type", "application/json; charset=utf-8")
          res.setHeader("Cache-Control", "no-store")
          res.end('{"ok":true}')
        } catch {
          res.statusCode = 400
          res.setHeader("Content-Type", "application/json; charset=utf-8")
          res.end('{"ok":false}')
        }
        return
      }
      res.statusCode = 405
      res.end()
      return
    }
    if (raw === "/api/decoration") {
      const dir = resolve(repo, "decoration")
      let files: string[] = []
      try {
        files = readdirSync(dir)
          .filter((name) => name.toLowerCase().endsWith(".glb"))
          .sort((a, b) => a.localeCompare(b))
      } catch {
        files = []
      }
      const body = JSON.stringify({ files })
      res.statusCode = 200
      res.setHeader("Content-Type", "application/json; charset=utf-8")
      res.setHeader("Cache-Control", "no-store")
      res.end(body)
      return
    }
    if (
      !raw.startsWith("/models/") &&
      !raw.startsWith("/decoration/") &&
      !raw.startsWith("/art/island_v3/")
    ) {
      next()
      return
    }
    const rel = decodeURIComponent(raw.replace(/^\//, ""))
    const file = resolve(repo, rel)
    const outside = isAbsolute(relative(repo, file)) || relative(repo, file).startsWith("..")
    if (outside || !existsSync(file) || !statSync(file).isFile()) {
      next()
      return
    }
    sendFile(res, file)
  }
  return {
    name: "corporator-art-assets",
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        void handle(req, res, next)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handle(req, res, next)
      })
    },
  }
}

export default defineConfig({
  root: here,
  publicDir: false,
  cacheDir: resolve(repo, "node_modules/.vite-island-preview"),
  assetsInclude: ["**/*.glb", "**/*.png"],
  plugins: [artAssetsPlugin()],
  server: {
    port: 5175,
    strictPort: true,
    fs: { allow: [repo] },
    headers: { "Cache-Control": "no-store" },
  },
  optimizeDeps: {
    exclude: ["three", "@corporator/render", "@corporator/render/three", "@corporator/protocol"],
  },
  resolve: {
    alias: [
      { find: "three/addons", replacement: resolve(threeRoot, "examples/jsm") },
      { find: "three", replacement: threeRoot },
      {
        find: "@corporator/render/three",
        replacement: resolve(repo, "packages/render/src/three.ts"),
      },
      {
        find: "@corporator/render",
        replacement: resolve(repo, "packages/render/src/index.ts"),
      },
      {
        find: "@corporator/protocol",
        replacement: resolve(repo, "packages/protocol/src/index.ts"),
      },
      {
        find: "./islandOrbitInput.js",
        replacement: resolve(repo, "packages/render/src/islandOrbitInput.ts"),
      },
    ],
  },
})
