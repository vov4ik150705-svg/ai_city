import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import type { JsonRpcPost } from "../src/index.ts"
import { broadcastRoleTx, ROLE_ENV, roleKey } from "../src/rpc/sign.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const PRIV = "0x" + "11".repeat(32)
const ADDR = "0x" + "ab".repeat(20)

function remember(names: readonly string[]): Map<string, string | undefined> {
  const prior = new Map<string, string | undefined>()
  for (const name of names) prior.set(name, process.env[name])
  return prior
}

function restore(prior: ReadonlyMap<string, string | undefined>): void {
  for (const [name, value] of prior) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
}

describe("PL12 role keys", () => {
  it("roleKey minter reads CORPORATOR_VAULT_MINTER_KEY", () => {
    const prior = remember(["CORPORATOR_VAULT_MINTER", "CORPORATOR_VAULT_MINTER_KEY"])
    process.env["CORPORATOR_VAULT_MINTER"] = ADDR
    delete process.env["CORPORATOR_VAULT_MINTER_KEY"]
    try {
      expect(ROLE_ENV.minter).toBe("CORPORATOR_VAULT_MINTER_KEY")
      expect(ROLE_ENV.voucher).toBe("CORPORATOR_VOUCHER_SIGNER_KEY")
      expect(ROLE_ENV.signer).toBe("CORPORATOR_SIGNER_KEY")
      expect(ROLE_ENV.buyback_executor).toBe("CORPORATOR_BUYBACK_EXECUTOR_KEY")
      expect(roleKey("minter")).toBe("")
    } finally {
      restore(prior)
    }
  })

  it("an address in the old voucher name does not broadcast", async () => {
    const prior = remember(["CORPORATOR_VOUCHER_SIGNER", "CORPORATOR_VOUCHER_SIGNER_KEY"])
    process.env["CORPORATOR_VOUCHER_SIGNER"] = PRIV
    delete process.env["CORPORATOR_VOUCHER_SIGNER_KEY"]
    const methods: string[] = []
    const post: JsonRpcPost = async (body: string) => {
      const row = JSON.parse(body) as { readonly method?: unknown }
      if (typeof row.method === "string") methods.push(row.method)
      return JSON.stringify({ jsonrpc: "2.0", id: "0", result: "0x1" })
    }
    try {
      const sent = await broadcastRoleTx({
        post,
        chainId: 1n,
        bps: 10000n,
        gasHeadroomBps: 1000n,
        role: "voucher",
        to: ADDR,
        data: "0x",
        inflight: new Map(),
      })
      expect(sent.status).toBe("silence")
      expect(methods.includes("eth_sendRawTransaction")).toBe(false)
      expect(roleKey("voucher")).toBe("")
    } finally {
      restore(prior)
    }
  })

  it("PlayerReady still reads address env names", () => {
    const src = readFileSync(join(repo, "contracts/script/PlayerReady.s.sol"), "utf8")
    expect(src.includes('vm.envAddress("CORPORATOR_VAULT_MINTER")')).toBe(true)
    expect(src.includes('vm.envAddress("CORPORATOR_VOUCHER_SIGNER")')).toBe(true)
    expect(src.includes('vm.envAddress("CORPORATOR_SIGNER")')).toBe(true)
    expect(src.includes('vm.envAddress("CORPORATOR_BUYBACK_EXECUTOR")')).toBe(true)
  })

  it("deploy/.env is gitignored", () => {
    const line = execSync("git check-ignore -v deploy/.env", { cwd: repo, encoding: "utf8" })
    expect(line.includes("deploy/.env")).toBe(true)
  })
})
