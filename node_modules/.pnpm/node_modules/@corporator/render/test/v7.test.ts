import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { isBackgroundUnit, vehiclePose, walkerSpriteId, worldPrng } from "../src/motion.ts"
import { popupPose } from "../src/fx.ts"
import { isRoadCell } from "../src/ground.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const python = process.env["PYTHON"] ?? "python"

type PackFile = {
  readonly sections?: {
    readonly placement?: { readonly params?: { readonly demo_seed?: { readonly v?: number } } }
    readonly render?: {
      readonly params?: {
        readonly vehicle_tiles_per_city_minute?: { readonly v?: number }
        readonly vehicle_prng_stride?: { readonly v?: number }
        readonly world_prng_bytes?: { readonly v?: number }
        readonly city_minutes_per_hour?: { readonly v?: number }
      }
    }
  }
  readonly generated?: {
    readonly placement?: {
      readonly vehicles?: readonly { readonly x?: number; readonly y?: number; readonly background?: number }[]
      readonly drones?: readonly {
        readonly x?: number
        readonly y?: number
        readonly background?: number
        readonly modifier_key?: string
      }[]
      readonly lots?: readonly { readonly x?: number; readonly y?: number; readonly w?: number; readonly h?: number }[]
      readonly scene?: { readonly map?: readonly string[] }
    }
  }
}

function loadPack(): PackFile {
  return JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
}

function asBig(n: number | undefined): bigint {
  return BigInt(n ?? 0)
}

function runPython(script: string): string {
  return execFileSync(python, ["-c", script], { cwd: repo, encoding: "utf8" })
}

describe("v7", () => {
  it("motion_is_pure_of_city_time", () => {
    const pack = loadPack()
    const seed = String(pack.sections?.placement?.params?.demo_seed?.v ?? 1)
    const bytes = asBig(pack.sections?.render?.params?.world_prng_bytes?.v)
    const py = runPython(
      "import sys; sys.path.insert(0, 'content'); from world import world_prng; "
      + `print(world_prng(${JSON.stringify(seed)}, 'vehicle', 0))`,
    ).trim()
    expect(worldPrng(seed, "vehicle", 0n, bytes).toString()).toBe(py)
    const map = pack.generated?.placement?.scene?.map ?? []
    const row = pack.generated?.placement?.vehicles?.[0]
    const start = { x: asBig(row?.x), y: asBig(row?.y) }
    const speed = asBig(pack.sections?.render?.params?.vehicle_tiles_per_city_minute?.v)
    const stride = asBig(pack.sections?.render?.params?.vehicle_prng_stride?.v)
    const minutes = asBig(pack.sections?.render?.params?.city_minutes_per_hour?.v)
    const a = vehiclePose(map, start, 0n, 12n, minutes, speed, stride, bytes, seed)
    const b = vehiclePose(map, start, 0n, 12n, minutes, speed, stride, bytes, seed)
    expect(a.tileX).toBe(b.tileX)
    expect(a.tileY).toBe(b.tileY)
    expect(a.fracNum).toBe(b.fracNum)
    expect(a.onRoad).toBe(true)
    expect(isRoadCell(map, a.tileX, a.tileY)).toBe(true)
    const later = vehiclePose(map, start, 0n, 24n, minutes, speed, stride, bytes, seed)
    expect(isRoadCell(map, later.tileX, later.tileY)).toBe(true)
    const pose = popupPose(
      12n,
      { tileX: 0n, tileY: 0n, amount: 1n, eventTime: 12n },
      1n,
      1n,
      1n,
    )
    expect(pose?.amount).toBe(1n)
  })

  it("no_wall_clock_in_render", () => {
    const root = join(repo, "packages", "render", "src")
    const clock = /Date\.now|performance\.now|Math\.random|deltaTime|deltaMS/
    const walk = (dir: string): string[] => {
      const out: string[] = []
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, name.name)
        if (name.isDirectory()) out.push(...walk(path))
        else if (name.name.endsWith(".ts")) out.push(readFileSync(path, "utf8"))
      }
      return out
    }
    for (const text of walk(root)) {
      expect(clock.test(text)).toBe(false)
    }
    const ghost = "return Math.random()"
    expect(clock.test(ghost)).toBe(true)
  })

  it("background_units_hold_no_lot", () => {
    const pack = loadPack()
    const lots = pack.generated?.placement?.lots ?? []
    const tiles = new Set<string>()
    for (const lot of lots) {
      const x0 = lot.x ?? 0
      const y0 = lot.y ?? 0
      const w = lot.w ?? 0
      const h = lot.h ?? 0
      let y = y0
      while (y < y0 + h) {
        let x = x0
        while (x < x0 + w) {
          tiles.add(`${x},${y}`)
          x += 1
        }
        y += 1
      }
    }
    const units = [
      ...(pack.generated?.placement?.vehicles ?? []),
      ...(pack.generated?.placement?.drones ?? []),
      ...(pack.generated?.placement?.walkers ?? []),
    ]
    expect(units.length > 0).toBe(true)
    expect((pack.generated?.placement?.walkers ?? []).length > 0).toBe(true)
    for (const row of units) {
      expect(row.background).toBe(1)
      expect(row.modifier_key).toBeUndefined()
      expect(tiles.has(`${row.x},${row.y}`)).toBe(false)
    }
    expect(isBackgroundUnit("vehicle")).toBe(true)
    expect(isBackgroundUnit("drone")).toBe(true)
    expect(isBackgroundUnit("walker_civilian")).toBe(true)
    expect(walkerSpriteId("walker_civilian", "w")).toBe("walker_civilian_w")
    expect(walkerSpriteId("walker_civilian", "e")).toBe("walker_civilian")
    expect(isBackgroundUnit("bank")).toBe(false)
    const scene = pack.generated?.placement?.scene
    const objs = scene?.objects ?? []
    for (const obj of objs) {
      const row = obj as { readonly id?: string; readonly tile?: readonly number[] }
      if (!(row.id ?? "").startsWith("walker_")) continue
      const tile = row.tile ?? []
      expect(tiles.has(`${tile[0] ?? 0},${tile[1] ?? 0}`)).toBe(false)
    }
  })
})
