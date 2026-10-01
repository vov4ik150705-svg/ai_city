import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { codes } from "@corporator/protocol"
import { atPath, loadPack, parseJson, type Json } from "@corporator/contentpack"
import {
  actionsReachable,
  attemptAction,
  bankPlaqueCode,
  buildHud,
  cityClockParts,
  cityTimeFromWall,
  demoBlockedCodes,
  emptySnapshot,
  islandFits,
  isoBBox,
  loadClientPack,
  loadHudFixture,
  loadStringTable,
  preview,
  safeRect,
} from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const client = join(repo, "apps/client")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

function run(
  file: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(file, args, { cwd, encoding: "utf8", env, maxBuffer: 32 * 1024 * 1024 })
    return { status: 0, stdout, stderr: "" }
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string }
    const message = err instanceof Error ? err.message : ""
    return {
      status: typeof e.status === "number" ? e.status : 1,
      stdout: e.stdout ?? "",
      stderr: `${e.stderr ?? ""}\n${message}`,
    }
  }
}

function bin(rel: string): string {
  const local = join(client, "node_modules", rel)
  if (existsSync(local)) return local
  return join(repo, "node_modules", rel)
}

function walkSrc(dir: string, acc: string[]): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name)
    if (name.isDirectory()) {
      walkSrc(p, acc)
      continue
    }
    if (name.name.endsWith(".ts") || name.name.endsWith(".tsx")) acc.push(p)
  }
  return acc
}

describe("C5 construction", () => {
  it("demo_barrier_holds", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    expect(pack.demoIsolated).toBe(true)
    const withdraw = pack.actions["bank_withdraw"]
    expect(withdraw).toBeDefined()
    if (withdraw === undefined) return
    expect(withdraw.demoBlocked).toBe(true)
    expect(
      attemptAction({
        demo: true,
        isolated: pack.demoIsolated,
        action: withdraw,
        capabilities: pack.capabilities,
      }),
    ).toBe(codes.DEMO_NO_WITHDRAW)
    expect(
      attemptAction({
        demo: false,
        isolated: pack.demoIsolated,
        action: withdraw,
        capabilities: pack.capabilities,
      }),
    ).toBeUndefined()
    const claim = pack.actions["leaderboard_claim"]
    expect(claim).toBeDefined()
    if (claim !== undefined) {
      expect(claim.v1).toBe("live")
      expect(claim.demoBlocked).toBe(true)
      expect(
        attemptAction({
          demo: true,
          isolated: pack.demoIsolated,
          action: claim,
          capabilities: pack.capabilities,
        }),
      ).toBe(codes.DEMO_NO_PRIZE)
      expect(
        attemptAction({
          demo: false,
          isolated: pack.demoIsolated,
          action: claim,
          capabilities: pack.capabilities,
        }),
      ).toBeUndefined()
    }
    const blocked = demoBlockedCodes(pack)
    expect(blocked.includes(codes.DEMO_NO_WITHDRAW)).toBe(true)
    expect(blocked.includes(codes.DEMO_NO_CLAIM)).toBe(true)
    expect(blocked.includes(codes.DEMO_NO_PRIZE)).toBe(true)
    const srcFiles = walkSrc(join(client, "src"), [])
    for (const path of srcFiles) {
      const text = readFileSync(path, "utf8")
      expect(text.includes("demo_wallet_transfers")).toBe(false)
      expect(text.includes("@corporator/chainport")).toBe(false)
    }
    const clock = cityClockParts({
      cityTime: pack.anchorCityTime,
      ticksDay: pack.ticksDay,
      anchorDay: pack.anchorDay,
      anchorWeekday: pack.anchorWeekday,
      weekDays: pack.weekDays,
    })
    expect(
      bankPlaqueCode({
        weekday: pack.bankClosedWeekday,
        hour: clock.hour,
        closedWeekday: pack.bankClosedWeekday,
        openHour: pack.bankOpenHour,
        closeHour: pack.bankCloseHour,
      }),
    ).toBe("BANK_SUNDAY")
    expect(
      cityTimeFromWall({
        anchorCityTime: pack.anchorCityTime,
        anchorMs: 0n,
        nowMs: 0n,
        rateBps: pack.rateBps,
        bps: pack.bps,
      }),
    ).toBe(pack.anchorCityTime)
  })

  it("client_strings_from_pack", () => {
    const loaded = loadPack(packBytes())
    const pack = loadClientPack(loaded.pack)
    const strings = loadStringTable(readJson("content/strings/ru.json"))
    expect(strings["UI_BANK"]).toBeDefined()
    expect(strings["UI_BUILD"]).toBeDefined()
    expect(strings["BANK_SUNDAY"]).toBeDefined()
    const view = buildHud({
      pack,
      strings,
      snapshot: {
        ...emptySnapshot(),
        payrollRatioBps: pack.bps,
        agents: [{ id: "a1", idleKey: "IDLE_NO_ENERGY" }],
        log: [{ id: "l1", key: "IDLE_NO_COMPUTE", badge: "", root: "", cid: "" }],
      },
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: true,
    })
    for (const key of view.usedKeys) {
      expect(strings[key]).toBeDefined()
    }
    expect(actionsReachable(pack)).toBe(true)
    expect(view.stocks.length).toBe(pack.districts.length)
    expect(view.districts.length).toBe(pack.districts.length)
    expect(view.overview.length > 0).toBe(true)
    const indexPath = join(client, "src/index.ts")
    const original = readFileSync(indexPath, "utf8")
    try {
      const cyr = String.fromCharCode(0x043a, 0x0438)
      writeFileSync(indexPath, `${original}\nexport const planted = "${cyr}"\n`)
      const eslintJs = bin("eslint/bin/eslint.js")
      const hit = run(process.execPath, [eslintJs, "apps/client/src/index.ts"], repo)
      expect(hit.status).not.toBe(0)
    } finally {
      writeFileSync(indexPath, original)
    }
  })

  it("client_preview_is_readonly", () => {
    const p = preview({ fund: 1n })
    expect(Object.isFrozen(p)).toBe(true)
    const tscJs = bin("typescript/bin/tsc")
    const hit = run(process.execPath, [tscJs, "--noEmit", "-p", "test/tsconfig.preview_write.json"], client)
    expect(hit.status).not.toBe(0)
    const out = `${hit.stdout}\n${hit.stderr}`
    expect(out.includes("read-only") || out.includes("readonly") || out.includes("Cannot assign") || out.includes("permits reading")).toBe(true)
  })

  it("client_sees_no_chainport", () => {
    const pkg = JSON.parse(readFileSync(join(client, "package.json"), "utf8")) as {
      dependencies?: { [k: string]: string }
      devDependencies?: { [k: string]: string }
    }
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
    expect(deps["@corporator/chainport"]).toBeUndefined()
    expect(deps["@electric-sql/pglite"]).toBeUndefined()
    expect(deps["pg"]).toBeUndefined()
    const srcFiles = walkSrc(join(client, "src"), [])
    const banned = /(?:from|import)\s+['"](?:@corporator\/chainport|@electric-sql\/pglite|pg)['"]/
    for (const path of srcFiles) {
      expect(banned.test(readFileSync(path, "utf8"))).toBe(false)
    }
    const viteJs = bin("vite/bin/vite.js")
    const built = run(process.execPath, [viteJs, "build"], client, {
      ...process.env,
      NODE_ENV: "production",
    })
    expect(built.status).toBe(0)
    const dist = join(client, "dist-web")
    const blobs: string[] = []
    let bundleBytes = 0n
    function walkDist(dir: string): void {
      if (!existsSync(dir)) return
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, name.name)
        if (name.isDirectory()) {
          walkDist(p)
          continue
        }
        if (name.name.endsWith(".js") || name.name.endsWith(".mjs")) {
          blobs.push(readFileSync(p, "utf8"))
          bundleBytes += BigInt(statSync(p).size)
        }
      }
    }
    walkDist(dist)
    expect(blobs.length > 0).toBe(true)
    for (const text of blobs) {
      expect(text.includes("@corporator/chainport")).toBe(false)
      expect(text.includes("@electric-sql/pglite")).toBe(false)
    }
    const max = asBig(atPath(loadPack(packBytes()).pack, ["sections", "arch", "params", "client_bundle_max_bytes", "v"]))
    expect(bundleBytes <= max).toBe(true)
  })

  it("hud_safe_rect_positive", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const hud = loadHudFixture(readJson("content/fixtures/hud_layout.json"))
    const tileW = pack.tileW
    const geom = safeRect(hud, tileW)
    expect(geom.safe_rect_w_px > 0n).toBe(true)
    expect(geom.safe_rect_h_px > 0n).toBe(true)
    expect(geom.safe_rect_w_px).toBe(pack.packSafeW)
    expect(geom.safe_rect_h_px).toBe(pack.packSafeH)
    const box = isoBBox(pack.gridSize, tileW, geom.tile_h_px)
    expect(box.iso_w_px).toBe(pack.packIsoW)
    expect(box.iso_h_px).toBe(pack.packIsoH)
    expect(
      islandFits(box.iso_w_px, box.iso_h_px, geom.safe_rect_w_px, geom.safe_rect_h_px, pack.zoomMinNum, pack.zoomMinDen),
    ).toBe(true)
    expect(asBig(atPath(loadPack(packBytes()).pack, ["generated", "placement", "safe_rect_h_px"])) > 0n).toBe(true)
  })
})

function asBig(value: Json): bigint {
  if (typeof value !== "bigint") throw new Error(codes.API_MALFORMED)
  return value
}
