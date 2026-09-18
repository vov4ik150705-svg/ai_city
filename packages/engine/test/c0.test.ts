import { execFileSync } from "node:child_process"
import { readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const python = process.env["PYTHON"] ?? "python"

function replaceFileSync(file: string, data: string | Uint8Array): void {
  const tmp = `${file}.${String(process.pid)}.tmp`
  writeFileSync(tmp, data)
  try {
    renameSync(tmp, file)
  } catch (err) {
    try {
      unlinkSync(tmp)
    } catch {
      /* keep rename error */
    }
    throw err
  }
}

function run(
  file: string,
  args: string[],
  cwd: string,
): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(file, args, {
      cwd,
      encoding: "utf8",
      env: process.env,
    })
    return { status: 0, stdout, stderr: "" }
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string }
    return {
      status: typeof e.status === "number" ? e.status : 1,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
    }
  }
}

function runEslint(rel: string): { status: number; stdout: string; stderr: string } {
  const eslintJs = join(repo, "node_modules/eslint/bin/eslint.js")
  return run(process.execPath, [eslintJs, rel], repo)
}

describe.sequential("C0 construction", () => {
  it("toolchain_matches_manifests", () => {
    const arch = JSON.parse(readFileSync(join(repo, "content/params/arch.json"), "utf8")) as {
      readonly toolchain: Record<string, { readonly engines?: string; readonly version?: string; readonly npm?: string }>
      readonly packages: Record<string, { readonly path: string }>
    }
    const engines = arch.toolchain["node"]?.engines
    const pnpm = arch.toolchain["pnpm"]?.version
    const wantPm = `pnpm@${pnpm ?? ""}`
    const npm: Record<string, string> = {}
    for (const spec of Object.values(arch.toolchain)) {
      if (spec.npm && spec.version) npm[spec.npm] = spec.version
    }
    const rels = ["package.json", ...Object.values(arch.packages).map((p) => `${p.path}/package.json`)]
    for (const rel of rels) {
      const man = JSON.parse(readFileSync(join(repo, rel), "utf8")) as {
        readonly engines?: { readonly node?: string }
        readonly packageManager?: string
        readonly dependencies?: Record<string, string>
        readonly devDependencies?: Record<string, string>
      }
      expect(man.engines?.node, rel).toBe(engines)
      expect(man.packageManager, rel).toBe(wantPm)
      for (const [dep, ver] of Object.entries({
        ...(man.dependencies ?? {}),
        ...(man.devDependencies ?? {}),
      })) {
        expect(npm[dep], `${rel} ${dep}`).toBe(ver)
      }
    }
  })

  it("vectors_bytes_stable", () => {
    const a = run(python, ["content/vectors.py"], repo)
    expect(a.status).toBe(0)
    const sha1 = readFileSync(join(repo, "content/out/vectors.sha256"), "utf8")
    const b = run(python, ["content/vectors.py"], repo)
    expect(b.status).toBe(0)
    const sha2 = readFileSync(join(repo, "content/out/vectors.sha256"), "utf8")
    expect(sha2).toBe(sha1)
  })

  it("codegen_check_catches_hand_edit", () => {
    const target = join(repo, "packages/protocol/src/codes.ts")
    const original = readFileSync(target)
    try {
      replaceFileSync(target, Buffer.concat([original, Buffer.from("\n")]))
      const result = run(python, ["content/codegen.py", "--check"], repo)
      expect(result.status).not.toBe(0)
    } finally {
      replaceFileSync(target, original)
    }
    expect(Buffer.compare(readFileSync(target), original)).toBe(0)
  })

  it("engine_eslint_rejects_date_now", () => {
    const src = join(repo, "packages/engine/src/index.ts")
    const original = readFileSync(src)
    try {
      replaceFileSync(src, Buffer.concat([original, Buffer.from("\nexport const leakedNow = Date.now()\n")]))
      const result = runEslint("packages/engine/src/index.ts")
      expect(result.status).not.toBe(0)
    } finally {
      replaceFileSync(src, original)
    }
    expect(Buffer.compare(readFileSync(src), original)).toBe(0)
  })

  it("engine_eslint_rejects_magic_number", () => {
    const src = join(repo, "packages/engine/src/index.ts")
    const original = readFileSync(src)
    try {
      replaceFileSync(src, Buffer.concat([original, Buffer.from("\nexport const leakedTwo = 2\n")]))
      const result = runEslint("packages/engine/src/index.ts")
      expect(result.status).not.toBe(0)
    } finally {
      replaceFileSync(src, original)
    }
    expect(Buffer.compare(readFileSync(src), original)).toBe(0)
  })
})
