import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { atPath, loadPack, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import {
  createMockPort,
  createPort,
  createPortFromPack,
  createRpcPort,
  isPortKind,
  type PortConfig,
  type Voucher,
} from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

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

function asBig(value: Json | undefined): bigint {
  if (typeof value !== "bigint") throw new Error(codes.API_MALFORMED)
  return value
}

function asFlag(value: Json | undefined): bigint {
  if (typeof value === "bigint") return value
  if (typeof value === "boolean") return value ? 1n : 0n
  throw new Error(codes.API_MALFORMED)
}

function cfgFromPack(pack: Json): PortConfig {
  const keys = asObj(atPath(pack, ["sections", "arch", "keys"]))
  const voucher = asObj(keys["voucher_signer"] ?? null)
  const buy = asObj(keys["buyback_executor"] ?? null)
  return {
    voucherTtlS: asBig(atPath(pack, ["generated", "api", "voucher_ttl_s"])),
    voucherSignerService: asText(voucher["service"]),
    buybackExecutorService: asText(buy["service"]),
  }
}

function run(
  file: string,
  args: string[],
  cwd: string,
): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(file, args, { cwd, encoding: "utf8", env: process.env })
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

function runEslint(rel: string): { status: number } {
  const eslintJs = join(repo, "node_modules/eslint/bin/eslint.js")
  return run(process.execPath, [eslintJs, rel], repo)
}

describe.sequential("C4 construction", () => {
  it("port_two_implementations", () => {
    const loaded = loadPack(packBytes())
    const impl = atPath(loaded.pack, ["sections", "arch", "port", "implementations"])
    expect(Array.isArray(impl)).toBe(true)
    if (!Array.isArray(impl)) return
    expect([...impl].map((x) => asText(x)).sort().join(",")).toBe("mock,rpc")
    const groups = asObj(atPath(loaded.pack, ["sections", "arch", "port", "groups"]))
    expect(Object.keys(groups).sort().join(",")).toBe("corp_token,merkle_roots,prize_treasury,stake_registry,vault")
    expect(isPortKind("ws")).toBe(false)
    expect(createPortFromPack("ws", cfgFromPack(loaded.pack))).toBeUndefined()
    const cfg = cfgFromPack(loaded.pack)
    expect(cfg.voucherSignerService).toBe("api")
    expect(cfg.buybackExecutorService).toBe("buyback")
    expect(cfg.voucherSignerService === cfg.buybackExecutorService).toBe(false)
    const keys = asObj(atPath(loaded.pack, ["sections", "arch", "keys"]))
    expect(asFlag(asObj(keys["voucher_signer"] ?? null)["client"])).toBe(0n)
    expect(asFlag(asObj(keys["buyback_executor"] ?? null)["client"])).toBe(0n)
    const mock = createPort("mock", cfg)
    const rpc = createPort("rpc", cfg)
    expect(mock.kind).toBe("mock")
    expect(rpc.kind).toBe("rpc")
    expect(mock.corpToken).toBeDefined()
    expect(mock.vault).toBeDefined()
    expect(mock.stakeRegistry).toBeDefined()
    expect(mock.merkleRoots).toBeDefined()
    expect(rpc.corpToken).toBeDefined()
    const clientSrc = readFileSync(join(repo, "apps/client/src/index.ts"), "utf8")
    expect(clientSrc.includes("@corporator/chainport")).toBe(false)
    expect(clientSrc.includes("voucher_signer")).toBe(false)
    expect(clientSrc.includes("buyback_executor")).toBe(false)
    const clientPkg = readFileSync(join(repo, "apps/client/package.json"), "utf8")
    expect(clientPkg.includes("@corporator/chainport")).toBe(false)
    const target = join(repo, "packages/chainport/src/mock.ts")
    const original = readFileSync(target, "utf8")
    try {
      writeFileSync(target, `import "viem"\n${original}`)
      const eslintHit = runEslint("packages/chainport/src/mock.ts")
      expect(eslintHit.status).not.toBe(0)
    } finally {
      writeFileSync(target, original)
    }
  })

  it("voucher_single_use", async () => {
    const loaded = loadPack(packBytes())
    const cfg = cfgFromPack(loaded.pack)
    const params = asObj(atPath(loaded.pack, ["sections", "api", "params"]))
    expect("voucher_ttl_s" in params).toBe(false)
    expect(cfg.voucherTtlS).toBe(asBig(atPath(loaded.pack, ["generated", "arch", "tick_length_real_seconds"])))
    const account = "a"
    const mock = createMockPort(cfg, { corp: { [account]: 100n } })
    const mintFirst = await mock.vault.mintCapital(account, 1n)
    expect(mintFirst.ok).toBe(false)
    if (!mintFirst.ok) expect(mintFirst.code).toBe(codes.API_MALFORMED)
    const deposited = await mock.vault.deposit(account, 50n)
    expect(deposited.ok).toBe(true)
    const minted = await mock.vault.mintCapital(account, 1n)
    expect(minted.ok).toBe(true)
    const voucher: Voucher = { nonce: "n1", account, corpAmount: 20n, issuedAtS: 0n }
    expect((await mock.vault.issueVoucher(voucher)).ok).toBe(true)
    const first = await mock.vault.presentVoucher(voucher, 0n)
    expect(first.ok).toBe(true)
    const second = await mock.vault.presentVoucher(voucher, 0n)
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.code).toBe(codes.API_INTENT_REPLAY)
    const v2: Voucher = { nonce: "n2", account, corpAmount: 10n, issuedAtS: 0n }
    expect((await mock.vault.issueVoucher(v2)).ok).toBe(true)
    const [p1, p2] = await Promise.all([
      mock.vault.presentVoucher(v2, 0n),
      mock.vault.presentVoucher(v2, 0n),
    ])
    const wins = (p1.ok ? 1 : 0) + (p2.ok ? 1 : 0)
    expect(wins).toBe(1)
    const v3: Voucher = { nonce: "n3", account, corpAmount: 1n, issuedAtS: 0n }
    expect((await mock.vault.issueVoucher(v3)).ok).toBe(true)
    const expired = await mock.vault.presentVoucher(v3, cfg.voucherTtlS + 1n)
    expect(expired.ok).toBe(false)
    if (!expired.ok) expect(expired.code).toBe(codes.API_MALFORMED)
    const rpc = createRpcPort(cfg)
    const before = await mock.corpToken.balanceOf(account)
    const rpcPresent = await rpc.vault.presentVoucher(voucher, 0n)
    expect(rpcPresent.ok).toBe(false)
    if (!rpcPresent.ok) expect(rpcPresent.code).toBe(codes.SERVICE_DEGRADED)
    const after = await mock.corpToken.balanceOf(account)
    expect(before.ok && after.ok).toBe(true)
    if (before.ok && after.ok) expect(after.amount).toBe(before.amount)
    expect((await mock.stakeRegistry.stake(account, "NVDA", 1n)).ok).toBe(true)
    const snap = await mock.stakeRegistry.snapshot(account)
    expect(snap.ok).toBe(true)
    if (snap.ok) expect(snap.rows.length).toBe(1)
    expect((await mock.merkleRoots.putRoot("c", 0n, "ab")).ok).toBe(true)
    const root = await mock.merkleRoots.getRoot("c", 0n)
    expect(root.ok).toBe(true)
    if (root.ok) expect(root.root).toBe("ab")
  })
})
