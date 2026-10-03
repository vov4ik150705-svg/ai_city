import { createServer } from "node:http"
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { fromUtf8, parseJson } from "@corporator/contentpack"
import { listenBind, listenPorts, readyTemplate } from "@corporator/protocol"
import { afterEach, describe, expect, it } from "vitest"
import { listenApi } from "../src/listen.ts"
import { putJson } from "../src/store.ts"
import { asObj, bootHost } from "./harness.ts"
import { listenReady as listenSampler } from "../../sampler/src/ready.ts"
import { listenReady as listenBuyback } from "../../buyback/src/ready.ts"
import { listenReady as listenAttestor } from "../../attestor/src/ready.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const closers: { close(): Promise<void> }[] = []

afterEach(async () => {
  while (closers.length > 0) {
    const row = closers.pop()
    if (row === undefined) continue
    await row.close()
  }
})

function prodYaml(): string {
  return readFileSync(join(repo, "deploy/compose.prod.yaml"), "utf8")
}

describe("PL13 deploy surface", () => {
  it("ready with a foreign hash is not HTTP 200", async () => {
    const host = await bootHost()
    await putJson(
      host.store,
      "schema_migrations",
      "head",
      { version: host.migrationVersion, pack_hash: "foreign" },
      undefined,
    )
    const api = await listenApi(host, 0n)
    closers.push(api)
    const res = await fetch("http://127.0.0.1:" + api.port.toString() + readyTemplate)
    const body = asObj(parseJson(fromUtf8(new Uint8Array(await res.arrayBuffer()))))
    expect(res.status).not.toBe(200)
    expect(body["ready"]).toBe(false)
    await host.store.close()
  })

  it("https://evil.example is not reflected", async () => {
    const prior = process.env.CORPORATOR_CORS_ORIGINS
    const host = await bootHost()
    const api = await listenApi(host, 0n)
    closers.push(api)
    const url = "http://127.0.0.1:" + api.port.toString() + readyTemplate
    process.env.CORPORATOR_CORS_ORIGINS = "https://corporator.example"
    try {
      const evil = await fetch(url, { headers: { origin: "https://evil.example" } })
      expect(evil.headers.get("access-control-allow-origin")).toBeNull()
      expect(evil.headers.get("access-control-allow-credentials")).toBeNull()
      const own = await fetch(url, { headers: { origin: "https://corporator.example" } })
      expect(own.headers.get("access-control-allow-origin")).toBe("https://corporator.example")
      expect(own.headers.get("access-control-allow-credentials")).toBeNull()
      delete process.env.CORPORATOR_CORS_ORIGINS
      const open = await fetch(url, { headers: { origin: "https://evil.example" } })
      expect(open.headers.get("access-control-allow-origin")).toBeNull()
      const clientOrigin = "http://" + listenBind + ":" + listenPorts.client.toString()
      const client = await fetch(url, { headers: { origin: clientOrigin } })
      expect(client.headers.get("access-control-allow-origin")).toBe(clientOrigin)
    } finally {
      if (prior === undefined) delete process.env.CORPORATOR_CORS_ORIGINS
      else process.env.CORPORATOR_CORS_ORIGINS = prior
      await host.store.close()
    }
  })

  it("prod compose does not publish 5432 on every interface", () => {
    const prod = prodYaml()
    expect(prod.includes('"5432:5432"')).toBe(false)
    expect(prod.includes('"7461:7461"')).toBe(false)
    expect(prod.includes('"7462:7462"')).toBe(false)
    expect(prod.includes('"7463:7463"')).toBe(false)
    expect(prod.includes("127.0.0.1:7460:7460")).toBe(true)
    expect(prod.includes("corporator_pg:")).toBe(true)
    const dev = readFileSync(join(repo, "deploy/compose.yaml"), "utf8")
    expect(dev.includes("127.0.0.1:5432:5432")).toBe(true)
    expect(dev.includes('"5432:5432"')).toBe(false)
  })

  it("healthcheck is not green on ready false", async () => {
    const prod = prodYaml()
    const match = prod.match(/fetch\('http:\/\/127\.0\.0\.1:\d+\/ready'\)\.then\([^"]+\)/)
    expect(match).not.toBeNull()
    const server = createServer((_req, res) => {
      res.statusCode = 200
      res.setHeader("content-type", "application/json")
      res.end('{"ready":false}')
    })
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve())
    })
    const addr = server.address()
    const port = typeof addr === "object" && addr !== null ? addr.port : 0
    const script = (match?.[0] ?? "").replace(
      /http:\/\/127\.0\.0\.1:\d+\/ready/,
      "http://127.0.0.1:" + port.toString() + "/ready",
    )
    try {
      const ran = await new Promise<{ status: number | null }>((resolve) => {
        const child = spawn(process.execPath, ["-e", script])
        const timer = setTimeout(() => {
          child.kill()
          resolve({ status: null })
        }, 5000)
        child.on("exit", (status) => {
          clearTimeout(timer)
          resolve({ status })
        })
      })
      expect(ran.status).toBe(1)
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    }
  })

  it("sampler without a database does not answer ready 1", async () => {
    const prior = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      const ready = await listenSampler("abc", listenPorts.sampler)
      closers.push(ready)
      const res = await fetch("http://" + listenBind + ":" + listenPorts.sampler.toString() + readyTemplate)
      const body = asObj(parseJson(fromUtf8(new Uint8Array(await res.arrayBuffer()))))
      expect(body["ready"]).toBe(0n)
    } finally {
      if (prior === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = prior
    }
  })

  it("buyback without a hop url answers mock", async () => {
    const prior = process.env.CORPORATOR_HOP_URL
    delete process.env.CORPORATOR_HOP_URL
    try {
      const ready = await listenBuyback("abc", listenPorts.buyback)
      closers.push(ready)
      const res = await fetch("http://" + listenBind + ":" + listenPorts.buyback.toString() + readyTemplate)
      const body = asObj(parseJson(fromUtf8(new Uint8Array(await res.arrayBuffer()))))
      expect(body["ready"]).toBe(0n)
      expect(body["source"]).toBe("mock")
    } finally {
      if (prior === undefined) delete process.env.CORPORATOR_HOP_URL
      else process.env.CORPORATOR_HOP_URL = prior
    }
  })

  it("attestor without a pin url answers mock", async () => {
    const prior = process.env.CORPORATOR_IPFS_PIN_URL
    delete process.env.CORPORATOR_IPFS_PIN_URL
    try {
      const ready = await listenAttestor("abc", listenPorts.attestor)
      closers.push(ready)
      const res = await fetch("http://" + listenBind + ":" + listenPorts.attestor.toString() + readyTemplate)
      const body = asObj(parseJson(fromUtf8(new Uint8Array(await res.arrayBuffer()))))
      expect(body["ready"]).toBe(0n)
      expect(body["source"]).toBe("mock")
    } finally {
      if (prior === undefined) delete process.env.CORPORATOR_IPFS_PIN_URL
      else process.env.CORPORATOR_IPFS_PIN_URL = prior
    }
  })

  it("dump script calls pg_dump", () => {
    const text = readFileSync(join(repo, "deploy/dump.sh"), "utf8")
    expect(text.includes("pg_dump")).toBe(true)
    expect(text.includes("DATABASE_URL")).toBe(true)
    const restore = readFileSync(join(repo, "deploy/restore.sh"), "utf8")
    expect(restore.includes("restore_replay_matches_origin")).toBe(true)
    expect(restore.includes("pg_dump")).toBe(false)
  })
})
