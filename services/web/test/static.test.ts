import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs"
import { request } from "node:http"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { resolveStatic, startStatic } from "../src/static.ts"

function get(port: number, path: string): Promise<{ readonly status: number; readonly body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port, path, method: "GET" }, (res) => {
      const chunks: Buffer[] = []
      res.on("data", (chunk: Buffer) => chunks.push(chunk))
      res.on("end", () => {
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") })
      })
    })
    req.on("error", reject)
    req.end()
  })
}

describe("ac7_static", () => {
  it("static root does not serve a file outside", async () => {
    const dir = mkdtempSync(join(tmpdir(), "corporator-static-"))
    const root = join(dir, "root")
    mkdirSync(root)
    writeFileSync(join(root, "index.html"), "home")
    writeFileSync(join(root, "foo..bar.txt"), "dots")
    const outside = join(dir, "outside")
    mkdirSync(outside)
    writeFileSync(join(outside, "secret.txt"), "secret")
    symlinkSync(outside, join(root, "linkdir"), "junction")
    expect(resolveStatic(root, "/index.html")).toBe(realpathSync(join(root, "index.html")))
    expect(resolveStatic(root, "/foo..bar.txt")).toBe(realpathSync(join(root, "foo..bar.txt")))
    expect(resolveStatic(root, "/linkdir/secret.txt")).toBeUndefined()
    expect(resolveStatic(root, "/../secret.txt")).toBeUndefined()
    expect(resolveStatic(root, "/%2e%2e/secret.txt")).toBeUndefined()
    expect(resolveStatic(root, "/C:/Windows/win.ini")).toBeUndefined()
    const server = await startStatic({ root, port: 0, bind: "127.0.0.1" })
    const home = await get(server.port, "/index.html")
    expect(home.status).toBe(200)
    expect(home.body).toBe("home")
    const parent = await get(server.port, "/%2e%2e/secret.txt")
    expect(parent.status).toBe(403)
    expect(parent.body).not.toBe("secret")
    const link = await get(server.port, "/linkdir/secret.txt")
    expect(link.status).toBe(403)
    expect(link.body).not.toBe("secret")
    const dots = await get(server.port, "/foo..bar.txt")
    expect(dots.status).toBe(200)
    expect(dots.body).toBe("dots")
    const abs = await get(server.port, "/C:/Windows/win.ini")
    expect(abs.status).toBe(403)
    await server.close()
    const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
    const empty = join(dir, "empty")
    mkdirSync(empty)
    const missing = spawnSync(
      process.execPath,
      ["--experimental-strip-types", join(repo, "services/web/src/main.ts")],
      {
        env: {
          ...process.env,
          CORPORATOR_STATIC_ROOT: empty,
          CORPORATOR_LISTEN_PORT: "0",
          CORPORATOR_LISTEN_BIND: "127.0.0.1",
        },
        encoding: "utf8",
      },
    )
    expect(missing.status).toBe(1)
    const shifted = spawnSync(
      "python",
      [
        "-c",
        [
          "import sys",
          "sys.path.insert(0, 'content')",
          "import build, codegen",
          "pack, _ = build.build_pack()",
          "pack['sections']['arch']['listen']['ports']['client'] = 7465",
          "df = codegen.emit_dockerfile(pack)",
          "prod = codegen.emit_compose_prod(pack)",
          "dev = codegen.emit_compose(pack)",
          "ok = 'EXPOSE 7465' in df and '127.0.0.1:7465:7465' in prod and '127.0.0.1:7465:7465' in dev and 'EXPOSE 7464' not in df and '0.0.0.0:7465' not in prod and '\"7465:7465\"' not in dev",
          "print('BOTH' if ok else 'NO')",
        ].join("\n"),
      ],
      { cwd: repo, encoding: "utf8" },
    )
    expect(shifted.status).toBe(0)
    expect(shifted.stdout.trim()).toBe("BOTH")
  })
})
