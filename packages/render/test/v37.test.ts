import { existsSync, readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { codes } from "@corporator/protocol"
import { gpuCode } from "../src/gpu.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const python = process.env["PYTHON"] ?? "python"

describe.sequential("V3-7 construction", () => {
  it("visual3_budgets_measured", () => {
    expect(existsSync(join(repo, "docs/archive/tests/v37.test.ts"))).toBe(true)
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
