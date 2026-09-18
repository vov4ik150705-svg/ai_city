import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { loadHeroCatalog, plantHeroes, pickHeroLod } from "../src/heroes.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

type PackFile = {
  readonly generated?: {
    readonly render?: {
      readonly hero_catalog?: unknown
      readonly hero_sha256?: string
    }
    readonly placement?: { readonly reference_layout?: unknown }
  }
  readonly sections?: {
    readonly buildings?: { readonly buildings?: { readonly [id: string]: unknown } }
    readonly render?: {
      readonly params?: {
        readonly hero_lod_high_quads?: { readonly v?: number }
        readonly hero_lod_low_quads?: { readonly v?: number }
        readonly hero_texture_px?: { readonly v?: number }
        readonly hero_lod_near_tiles?: { readonly v?: number }
      }
    }
    readonly screens?: {
      readonly actions?: { readonly build_place?: { readonly effect?: string } }
    }
  }
}

function loadPack(): PackFile {
  return JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
}

describe.sequential("V3-2 construction", () => {
  it("visual3_heroes_by_building_id", () => {
    const pack = loadPack()
    const ids = Object.keys(pack.sections?.buildings?.buildings ?? {})
    expect(ids.length).toBe(18)
    const catalog = loadHeroCatalog(pack.generated?.render?.hero_catalog)
    expect(Object.keys(catalog).sort()).toEqual(ids.sort())
    const shas = new Set<string>()
    const mats = new Set<string>()
    for (const id of ids) {
      const row = catalog[id]
      expect(row).toBeDefined()
      if (row === undefined) continue
      expect(existsSync(join(repo, "content/out/heroes", row.lodHigh))).toBe(true)
      expect(existsSync(join(repo, "content/out/heroes", row.lodLow))).toBe(true)
      expect(shas.has(row.shaHigh)).toBe(false)
      shas.add(row.shaHigh)
      expect(mats.has(row.material)).toBe(false)
      mats.add(row.material)
      if (id === "ai_research_center") expect(row.material).toBe("compute_brick")
      else expect(row.material).not.toBe("compute_brick")
    }
    expect(pack.sections?.render?.params?.hero_lod_high_quads?.v).toBe(30000)
    expect(pack.sections?.render?.params?.hero_lod_low_quads?.v).toBe(5000)
    expect(pack.sections?.render?.params?.hero_texture_px?.v).toBe(2048)
    const threeSrc = readFileSync(join(repo, "packages/render/src/three.ts"), "utf8")
    expect(threeSrc.includes("GLTFLoader")).toBe(true)
    expect(threeSrc.includes("plantHeroes")).toBe(false)
  })

  it("visual3_lod_lighter_than_high", () => {
    const pack = loadPack()
    const catalog = loadHeroCatalog(pack.generated?.render?.hero_catalog)
    const near = BigInt(pack.sections?.render?.params?.hero_lod_near_tiles?.v ?? 0)
    expect(near > 0n).toBe(true)
    for (const id of Object.keys(catalog)) {
      const row = catalog[id]
      expect(row).toBeDefined()
      if (row === undefined) continue
      expect(row.quadsLow > 0n).toBe(true)
      expect(row.quadsHigh > row.quadsLow).toBe(true)
    }
    expect(pickHeroLod(near, near)).toBe("high")
    expect(pickHeroLod(near + 1n, near)).toBe("low")
    const high = pack.sections?.render?.params?.hero_lod_high_quads?.v ?? 0
    const low = pack.sections?.render?.params?.hero_lod_low_quads?.v ?? 0
    expect(low < high).toBe(true)
  })

  it("visual3_plant_on_lot", () => {
    const pack = loadPack()
    const catalog = loadHeroCatalog(pack.generated?.render?.hero_catalog)
    const lots = plantHeroes(pack.generated?.placement?.reference_layout, catalog)
    expect(lots.length).toBe(Object.keys(catalog).length)
    for (const lot of lots) {
      expect(lot.spanX > 1n || lot.spanZ > 1n).toBe(true)
    }
    expect(plantHeroes([], catalog).length).toBe(0)
    expect(pack.sections?.screens?.actions?.build_place?.effect).toBe("commit:build")
    const threeSrc = readFileSync(join(repo, "packages/render/src/three.ts"), "utf8")
    expect(threeSrc.includes("commit:build")).toBe(false)
    expect(threeSrc.includes("plantHeroes")).toBe(false)
    const heroSrc = readFileSync(join(repo, "packages/render/src/heroes.ts"), "utf8")
    expect(heroSrc.includes("spanX")).toBe(true)
    expect(heroSrc.includes("spanZ")).toBe(true)
  })
})
