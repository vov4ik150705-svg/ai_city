import { createReadStream, existsSync, realpathSync, statSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, isAbsolute, join, normalize, sep } from "node:path"
import { platform } from "node:os"

const TYPE_HTML = "text/html; charset=utf-8"
const TYPE_JS = "text/javascript; charset=utf-8"
const TYPE_CSS = "text/css; charset=utf-8"
const TYPE_JSON = "application/json"
const TYPE_PNG = "image/png"
const TYPE_WOFF = "font/woff2"
const TYPE_GLB = "model/gltf-binary"
const TYPE_TEXT = "text/plain; charset=utf-8"
const TYPE_BYTES = "application/octet-stream"

const TYPES: Readonly<Record<string, string>> = {
  ".html": TYPE_HTML,
  ".js": TYPE_JS,
  ".css": TYPE_CSS,
  ".json": TYPE_JSON,
  ".png": TYPE_PNG,
  ".woff2": TYPE_WOFF,
  ".glb": TYPE_GLB,
  ".hex": TYPE_TEXT,
}

const STATUS_OK = 200
const STATUS_FORBIDDEN = 403
const STATUS_MISSING = 404

function dotDotSegment(decoded: string): boolean {
  const parts = decoded.split(/[/\\]/)
  for (const part of parts) {
    if (part === "..") return true
  }
  return false
}

function sameOrInside(base: string, full: string): boolean {
  const fold = platform() === "win32"
  const rootPath = fold ? base.toLowerCase() : base
  const filePath = fold ? full.toLowerCase() : full
  const prefix = rootPath.endsWith(sep) ? rootPath : rootPath + sep
  return filePath === rootPath || filePath.startsWith(prefix)
}

export function resolveStatic(root: string, urlPath: string): string | undefined {
  const query = urlPath.split("?")[0] ?? "/"
  let decoded = ""
  try {
    decoded = decodeURIComponent(query)
  } catch {
    return undefined
  }
  if (decoded.includes("\0") || decoded.includes(":") || dotDotSegment(decoded)) return undefined
  const rel = decoded.replace(/^\/+/, "")
  if (rel.length === 0) return realInside(root, underRoot(root, "index.html"))
  if (isAbsolute(rel)) return undefined
  return realInside(root, underRoot(root, rel))
}

function underRoot(root: string, rel: string): string | undefined {
  const base = normalize(root)
  const full = normalize(join(base, rel))
  if (!sameOrInside(base, full)) return undefined
  return full
}

function realInside(root: string, lexical: string | undefined): string | undefined {
  if (lexical === undefined) return undefined
  let rootReal = ""
  try {
    rootReal = normalize(realpathSync(root))
  } catch {
    return undefined
  }
  try {
    const fileReal = normalize(realpathSync(lexical))
    if (!sameOrInside(rootReal, fileReal)) return undefined
    return fileReal
  } catch {
    return lexical
  }
}

export function startStatic(args: {
  readonly root: string
  readonly port: number
  readonly bind: string
}): Promise<{ readonly port: number; readonly close: () => Promise<void> }> {
  const server: Server = createServer((req, res) => {
    const file = resolveStatic(args.root, req.url ?? "/")
    if (file === undefined || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(file === undefined ? STATUS_FORBIDDEN : STATUS_MISSING)
      res.end()
      return
    }
    const type = TYPES[extname(file)] ?? TYPE_BYTES
    res.writeHead(STATUS_OK, { "content-type": type })
    createReadStream(file).pipe(res)
  })
  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(args.port, args.bind, () => {
      const addr = server.address()
      const port = addr !== null && typeof addr === "object" ? addr.port : args.port
      resolve({
        port,
        close: () =>
          new Promise((done, fail) => {
            server.close((err) => (err ? fail(err) : done()))
          }),
      })
    })
  })
}
