import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

type PackFile = {
  readonly generated?: {
    readonly render?: {
      readonly atlas_sha256?: string
      readonly atlas_bytes?: number
      readonly atlas_opaque_magenta_px?: number
      readonly atlas_glow_building_count?: number
      readonly atlas_frame_count?: number
    }
  }
  readonly sections?: {
    readonly render?: {
      readonly params?: Readonly<Record<string, { readonly v?: number } | undefined>>
    }
  }
}

type Manifest = {
  readonly sha256?: string
  readonly frames?: Readonly<Record<string, { readonly foot_anchor?: readonly number[]; readonly footprint?: readonly number[]; readonly kind?: string } | undefined>>
}

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(repo, rel), "utf8")) as T
}

describe.sequential("V1 construction", () => {
  it("atlas_pack_is_deterministic", () => {
    const disk = readFileSync(join(repo, "content/out/atlas/atlas.sha256"), "utf8").trim()
    const manifest = loadJson<Manifest>("content/out/atlas/city.json")
    const pack = loadJson<PackFile>("content/out/pack.json")
    expect(disk.length).toBe(64)
    expect(manifest.sha256).toBe(disk)
    expect(pack.generated?.render?.atlas_sha256).toBe(disk)
    const ids = Object.keys(manifest.frames ?? {})
    expect(ids.length).toBeGreaterThan(0)
    expect(ids).toEqual([...ids].sort())
    const shuffled = [...ids].reverse()
    expect(shuffled).not.toEqual(ids)
  })

  it("atlas_key_fully_removed", () => {
    const pack = loadJson<PackFile>("content/out/pack.json")
    const manifest = loadJson<Manifest>("content/out/atlas/city.json")
    expect(pack.generated?.render?.atlas_opaque_magenta_px).toBe(0)
    const frames = manifest.frames ?? {}
    for (const id of Object.keys(frames)) {
      const fr = frames[id]
      expect(fr?.foot_anchor, id).toHaveLength(2)
      expect(fr?.footprint, id).toHaveLength(2)
    }
    expect(existsSync(join(repo, "content/out/atlas/city.png"))).toBe(true)
    expect(existsSync(join(repo, "content/out/atlas/city_glow.png"))).toBe(true)
  })

  it("atlas_bytes_under_cap", () => {
    const pack = loadJson<PackFile>("content/out/pack.json")
    const cap = pack.sections?.render?.params?.atlas_max_bytes?.v ?? 0
    const bytes = pack.generated?.render?.atlas_bytes ?? 0
    expect(cap).toBeGreaterThan(0)
    expect(bytes).toBeGreaterThan(0)
    expect(bytes).toBeLessThanOrEqual(cap)
    expect(pack.generated?.render?.atlas_glow_building_count ?? 0).toBeGreaterThan(0)
  })
})
