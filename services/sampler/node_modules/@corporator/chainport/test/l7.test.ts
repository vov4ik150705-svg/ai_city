import { execFileSync } from "node:child_process"
import { homedir } from "node:os"
import { delimiter } from "node:path"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { atPath, loadPack, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const contractsSrc = join(repo, "contracts", "src")
const BANK_HOUR = /\b(?:weekday|week_day|sunday|saturday|bank_open|bankOpen|bank_hour|bankHour|office_hours|market_hours|city_hour|isSunday|dayOfWeek)\b/i

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function asObj(value: Json): { readonly [key: string]: Json } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(codes.API_MALFORMED)
  }
  return value
}

function asText(value: Json | undefined): string {
  if (typeof value !== "string") throw new Error(codes.API_MALFORMED)
  return value
}

function runForge(args: string[]): { status: number; stdout: string; stderr: string } {
  const binDir = join(homedir(), ".foundry", "bin")
  const pathEnv = binDir + delimiter + (process.env.PATH ?? "")
  const exe = process.platform === "win32" ? join(binDir, "forge.exe") : join(binDir, "forge")
  const cmd = existsSync(exe) ? exe : "forge"
  try {
    const stdout = execFileSync(cmd, args, {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, PATH: pathEnv },
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

describe.sequential("L7 construction", () => {
  it("vault_deposit_then_mint", () => {
    const loaded = loadPack(packBytes())
    const groups = asObj(atPath(loaded.pack, ["sections", "arch", "port", "groups"]))
    expect(Object.keys(groups).sort().join(",")).toBe("corp_token,merkle_roots,prize_treasury,stake_registry,vault")
    const vaultSrc = readFileSync(join(contractsSrc, "Vault.sol"), "utf8")
    expect(vaultSrc.includes("function mintCapital")).toBe(true)
    expect(vaultSrc.includes("pending")).toBe(true)
    const got = runForge(["test", "--root", join(repo, "contracts")])
    expect(got.status).toBe(0)
  })

  it("bank_not_onchain", () => {
    const names = readdirSync(contractsSrc).filter((n) => n.endsWith(".sol")).sort()
    expect(names.join(",")).toBe("CorpToken.sol,MerkleRoots.sol,PrizeTreasury.sol,StakeRegistry.sol,Vault.sol")
    expect(names.map((n) => n.toLowerCase()).includes("bank.sol")).toBe(false)
    for (const name of names) {
      const body = readFileSync(join(contractsSrc, name), "utf8")
      expect(BANK_HOUR.test(body)).toBe(false)
      expect(/function\s+set\w*Tax/i.test(body)).toBe(false)
    }
    const token = readFileSync(join(contractsSrc, "CorpToken.sol"), "utf8")
    expect(token.includes("immutable creatorTaxBps")).toBe(true)
    const transferBody = token.split("function transfer")[1] ?? ""
    const firstFn = transferBody.split("function ")[0] ?? ""
    expect(firstFn.includes("creatorTaxBps")).toBe(false)
    const loaded = loadPack(packBytes())
    const solc = asText(atPath(loaded.pack, ["sections", "arch", "toolchain", "solc", "version"]))
    const toml = readFileSync(join(repo, "contracts", "foundry.toml"), "utf8")
    expect(toml.includes(`solc_version = "${solc}"`)).toBe(true)
    const engineSrc = join(repo, "packages", "engine", "src")
    expect(existsSync(join(engineSrc, "Vault.sol"))).toBe(false)
  })
})
