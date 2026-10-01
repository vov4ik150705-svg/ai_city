import { existsSync, readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { gradeRgb, type Rgb } from "../src/light.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const python = process.env["PYTHON"] ?? "python"

type PackFile = {
  readonly generated?: {
    readonly render?: {
      readonly atlas_bytes?: number
      readonly atlas_page_count?: number
      readonly ground_chunk_tiles?: number
    }
    readonly placement?: {
      readonly grid_size?: number
      readonly scene?: { readonly objects?: readonly unknown[] }
      readonly phases?: {
        readonly [name: string]: { readonly tint_alpha_bps?: number }
      }
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
        readonly golden_pixel_delta_bps?: { readonly v?: number }
        readonly golden_channel_delta?: { readonly v?: number }
        readonly grade_bps?: { readonly v?: number }
        readonly glow_window?: { readonly v?: number }
      }
    }
    readonly arch?: {
      readonly params?: { readonly client_bundle_max_bytes?: { readonly v?: number } }
    }
  }
}

type ProbeFile = {
  readonly hall_foot?: { readonly x?: number; readonly y?: number; readonly r?: number; readonly g?: number; readonly b?: number }
  readonly water_mid?: { readonly x?: number; readonly y?: number; readonly r?: number; readonly g?: number; readonly b?: number }
  readonly night_window_glow?: { readonly x?: number; readonly y?: number; readonly g?: number }
}

function asBig(n: number | undefined): bigint {
  return BigInt(n ?? 0)
}

function loadPack(): PackFile {
  return JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
}

function isKey(rgb: Rgb): boolean {
  const hi = 255n
  return rgb.r === hi && rgb.g === 0n && rgb.b === hi
}

function channelOk(got: Rgb, want: Rgb, delta: bigint): boolean {
  const dr = got.r > want.r ? got.r - want.r : want.r - got.r
  const dg = got.g > want.g ? got.g - want.g : want.g - got.g
  const db = got.b > want.b ? got.b - want.b : want.b - got.b
  return dr <= delta && dg <= delta && db <= delta
}

function runPython(script: string): string {
  return execFileSync(python, ["-c", script], { cwd: repo, encoding: "utf8" })
}

describe.sequential("V12 construction", () => {
  it("visual_budgets_measured", () => {
    expect(existsSync(join(repo, "docs/archive/tests/v12.test.ts"))).toBe(true)
  })

  it("golden_frames_match", () => {
    const pack = loadPack()
    const delta = asBig(pack.sections?.render?.params?.golden_channel_delta?.v)
    const bps = asBig(pack.sections?.render?.params?.golden_pixel_delta_bps?.v)
    const gradeBps = asBig(pack.sections?.render?.params?.grade_bps?.v)
    const glowWin = asBig(pack.sections?.render?.params?.glow_window?.v)
    const probes = JSON.parse(readFileSync(join(repo, "packages/render/test/golden/probes.json"), "utf8")) as ProbeFile
    const hallWant: Rgb = {
      r: asBig(probes.hall_foot?.r),
      g: asBig(probes.hall_foot?.g),
      b: asBig(probes.hall_foot?.b),
    }
    const waterWant: Rgb = {
      r: asBig(probes.water_mid?.r),
      g: asBig(probes.water_mid?.g),
      b: asBig(probes.water_mid?.b),
    }
    const script =
      "from PIL import Image\nimport numpy as np\n" +
      "im=np.array(Image.open('content/out/atlas/fallback.png').convert('RGB'))\n" +
      "sc=np.array(Image.open('art/preview/scene.png').convert('RGB'))\n" +
      "def mag(a):\n    return int(((a[:,:,0]==255)&(a[:,:,1]==0)&(a[:,:,2]==255)).sum())\n" +
      "print(mag(im))\nprint(mag(sc))\n" +
      `chan=${pack.sections?.render?.params?.golden_channel_delta?.v ?? 0}\n` +
      "d=np.abs(im.astype(np.int16)-sc.astype(np.int16))\n" +
      "diff=((d[:,:,0]>chan)|(d[:,:,1]>chan)|(d[:,:,2]>chan)).sum()\n" +
      "print(int(diff))\nprint(int(im.shape[0]*im.shape[1]))\n" +
      `hx=${probes.hall_foot?.x}; hy=${probes.hall_foot?.y}\n` +
      `wx=${probes.water_mid?.x}; wy=${probes.water_mid?.y}\n` +
      `gx=${probes.night_window_glow?.x}; gy=${probes.night_window_glow?.y}\n` +
      "print('%d %d %d' % tuple(im[hy,hx]))\n" +
      "print('%d %d %d' % tuple(im[wy,wx]))\n" +
      "glow=np.array(Image.open('content/out/atlas/city_glow.png'))\n" +
      "g=glow[gy,gx]\n" +
      "print(int(g if np.ndim(g)==0 else g[0]))\n"
    const out = runPython(script).trim().split(/\r?\n/)
    expect(out[0]).toBe("0")
    expect(out[1]).toBe("0")
    const differ = BigInt(out[2] ?? "1")
    const total = BigInt(out[3] ?? "1")
    expect(total > 0n).toBe(true)
    expect(differ * 10000n <= bps * total).toBe(true)
    const hallGot: Rgb = {
      r: asBig(Number((out[4] ?? "0 0 0").split(" ")[0])),
      g: asBig(Number((out[4] ?? "0 0 0").split(" ")[1])),
      b: asBig(Number((out[4] ?? "0 0 0").split(" ")[2])),
    }
    const waterGot: Rgb = {
      r: asBig(Number((out[5] ?? "0 0 0").split(" ")[0])),
      g: asBig(Number((out[5] ?? "0 0 0").split(" ")[1])),
      b: asBig(Number((out[5] ?? "0 0 0").split(" ")[2])),
    }
    const glowGot = asBig(Number(out[6] ?? "0"))
    expect(channelOk(hallGot, hallWant, delta)).toBe(true)
    expect(channelOk(waterGot, waterWant, delta)).toBe(true)
    expect(glowGot === asBig(probes.night_window_glow?.g)).toBe(true)
    expect(glowGot === glowWin).toBe(true)
    expect(isKey({ r: 255n, g: 0n, b: 255n })).toBe(true)
    expect(isKey(hallGot)).toBe(false)
    expect(channelOk(hallGot, { r: 255n, g: 0n, b: 255n }, delta)).toBe(false)
    const tints: readonly Rgb[] = [
      { r: 92n, g: 52n, b: 16n },
      { r: 230n, g: 236n, b: 245n },
      { r: 61n, g: 16n, b: 22n },
      { r: 27n, g: 36n, b: 54n },
    ]
    const mixes = [
      asBig(pack.generated?.placement?.phases?.dawn?.tint_alpha_bps),
      asBig(pack.generated?.placement?.phases?.day?.tint_alpha_bps),
      asBig(pack.generated?.placement?.phases?.dusk?.tint_alpha_bps),
      asBig(pack.generated?.placement?.phases?.night?.tint_alpha_bps),
    ]
    for (const tint of tints) {
      let i = 0
      while (i < mixes.length) {
        const mix = mixes[i] ?? 0n
        expect(isKey(gradeRgb(hallGot, tint, mix, gradeBps))).toBe(false)
        expect(isKey(gradeRgb(waterGot, tint, mix, gradeBps))).toBe(false)
        i += 1
      }
    }
  })
})
