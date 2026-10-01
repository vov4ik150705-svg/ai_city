import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { codes } from "@corporator/protocol"
import {
  copiedFromCaps,
  observeIslandBudgets,
  underVisualCaps,
  type VisualCaps,
} from "../src/budget.ts"
import { gpuCode } from "../src/gpu.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const python = process.env["PYTHON"] ?? "python"

type PackFile = {
  readonly generated?: {
    readonly render?: {
      readonly atlas_bytes?: number
      readonly atlas_page_count?: number
      readonly hero_catalog?: unknown
      readonly island_mass_primitives?: number
      readonly island_building_primitives?: number
    }
    readonly placement?: {
      readonly scene?: unknown
      readonly grid_size?: number
      readonly reference_layout?: unknown
      readonly vehicles?: readonly unknown[]
      readonly drones?: readonly unknown[]
    }
  }
  readonly sections?: {
    readonly render?: {
      readonly params?: {
        readonly draw_calls_max?: { readonly v?: number }
        readonly sprite_instances_max?: { readonly v?: number }
        readonly atlas_max_bytes?: { readonly v?: number }
        readonly texture_bytes_max?: { readonly v?: number }
        readonly atlas_page_px?: { readonly v?: number }
        readonly visual3_frame_live?: { readonly v?: number }
      }
    }
    readonly arch?: {
      readonly params?: { readonly client_bundle_max_bytes?: { readonly v?: number } }
    }
    readonly screens?: { readonly params?: { readonly missions_live?: { readonly v?: number } } }
    readonly companion?: {
      readonly params?: { readonly companion_revenue_live?: { readonly v?: number } }
    }
    readonly seasons?: { readonly params?: { readonly prize_nft_share_bps?: { readonly v?: number } } }
    readonly fragments?: {
      readonly params?: { readonly fragment_nft_share_bps?: { readonly v?: number } }
    }
  }
}

function asBig(n: number | undefined): bigint {
  return BigInt(n ?? 0)
}

function loadPack(): PackFile {
  return JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
}

function bundleBytes(): bigint {
  const dist = join(repo, "apps/client/dist-web")
  let total = 0n
  function walk(dir: string): void {
    if (!existsSync(dir)) return
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, name.name)
      if (name.isDirectory()) {
        walk(p)
        continue
      }
      if (name.name.endsWith(".js") || name.name.endsWith(".mjs")) {
        total += BigInt(statSync(p).size)
      }
    }
  }
  walk(dist)
  return total
}

function capsOf(pack: PackFile): VisualCaps {
  const rp = pack.sections?.render?.params
  return {
    drawCallsMax: asBig(rp?.draw_calls_max?.v),
    spriteInstancesMax: asBig(rp?.sprite_instances_max?.v),
    atlasMaxBytes: asBig(rp?.atlas_max_bytes?.v),
    textureBytesMax: asBig(rp?.texture_bytes_max?.v),
    bundleMaxBytes: asBig(pack.sections?.arch?.params?.client_bundle_max_bytes?.v),
  }
}

describe.sequential("V3-7 construction", () => {
  it("visual3_budgets_measured", () => {
    const pack = loadPack()
    const pages = asBig(pack.generated?.render?.atlas_page_count)
    const glowPages = pages > 0n ? 1n : 0n
    const bundle = bundleBytes()
    expect(bundle > 0n).toBe(true)
    const obs = observeIslandBudgets({
      massPrimitives: asBig(pack.generated?.render?.island_mass_primitives),
      buildingPrimitives: asBig(pack.generated?.render?.island_building_primitives),
      sprites: 0n,
      atlasBytes: asBig(pack.generated?.render?.atlas_bytes),
      pagePx: asBig(pack.sections?.render?.params?.atlas_page_px?.v),
      colorPages: pages,
      glowPages,
      bundleBytes: bundle,
    })
    const caps = capsOf(pack)
    expect(underVisualCaps(obs, caps)).toBe(true)
    expect(copiedFromCaps(obs, caps)).toBe(false)
    const md = readFileSync(join(repo, "docs/reports/GATE_VISUAL.md"), "utf8")
    expect(/^# GATE_VISUAL —[^\n]*island/i.test(md)).toBe(true)
    expect(md.includes("observe.software")).toBe(true)
    expect(md.includes("observe.desktop")).toBe(true)
    expect(md.includes(`draw_calls=${obs.drawCalls.toString()}`)).toBe(true)
    expect(md.includes(`sprites=${obs.sprites.toString()}`)).toBe(true)
    expect(md.includes(`atlas_bytes=${obs.atlasBytes.toString()}`)).toBe(true)
    expect(md.includes(`texture_bytes=${obs.textureBytes.toString()}`)).toBe(true)
    expect(md.includes(`bundle_bytes=${obs.bundleBytes.toString()}`)).toBe(true)
    expect(md.includes("observedFromThresholds")).toBe(false)
    expect(pack.sections?.render?.params?.visual3_frame_live?.v).toBe(1)
    expect(pack.sections?.screens?.params?.missions_live?.v).toBe(0)
    expect(pack.sections?.companion).toBeUndefined()
    expect(pack.sections?.seasons?.params?.prize_nft_share_bps?.v).toBe(0)
    expect(pack.sections?.fragments?.params?.fragment_nft_share_bps?.v).toBe(0)
  })

  it("visual3_golden_frames_match", () => {
    const script =
      "from PIL import Image\nimport numpy as np\n" +
      "im=np.array(Image.open('content/out/atlas/fallback.png').convert('RGB'))\n" +
      "sc=np.array(Image.open('art/preview/scene.png').convert('RGB'))\n" +
      "def mag(a):\n    return int(((a[:,:,0]==255)&(a[:,:,1]==0)&(a[:,:,2]==255)).sum())\n" +
      "print(mag(im))\nprint(mag(sc))\n"
    const out = execFileSync(python, ["-c", script], { cwd: repo, encoding: "utf8" }).trim().split(/\r?\n/)
    expect(out[0]).toBe("0")
    expect(out[1]).toBe("0")
    expect(gpuCode({ webgl2: false, webgl: false })).toBe(codes.RENDER_NO_GPU)
    const md = readFileSync(join(repo, "docs/reports/GATE_VISUAL.md"), "utf8")
    expect(/^# GATE_VISUAL —[^\n]*island/im.test(md)).toBe(true)
    expect(md.includes("archive.v12.software")).toBe(true)
    expect(existsSync(join(repo, "art/preview/scene.png"))).toBe(true)
  })
})
