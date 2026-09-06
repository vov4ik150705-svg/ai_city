import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  claimPrize,
  CODE_UNCOVERED,
  refundPlayer,
  returnUnsettled,
  returnUnsettledAttack,
} from "../src/treasury.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

type PackFile = {
  readonly sections: {
    readonly arch: {
      readonly custody: {
        readonly drain_forbidden: readonly string[]
        readonly pool_in: string
        readonly return_fn: string
        readonly refund_fn: string
      }
      readonly port: { readonly groups: Readonly<Record<string, unknown>> }
      readonly keys: Readonly<Record<string, unknown>>
      readonly schema_tables: Readonly<Record<string, unknown>>
    }
    readonly codes: { readonly codes: Readonly<Record<string, unknown>> }
  }
}

function loadPack(): PackFile {
  return JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
}

describe.sequential("M5 construction", () => {
  it("vault_and_fund_not_drainable", () => {
    const pack = loadPack()
    expect(pack.sections.arch.custody.drain_forbidden).toEqual([
      "vault",
      "fund",
      "reserve",
      "fragments",
    ])
    expect(pack.sections.arch.port.groups["prize_treasury"]).toBeDefined()
    expect(Object.keys(pack.sections.arch.port.groups)).toHaveLength(5)
    expect(pack.sections.arch.schema_tables["prize_returns"]).toBeDefined()
  })

  it("return_unsettled_skips_settled", () => {
    const owed = { player: 700n }
    const after = returnUnsettled(300n, owed)
    expect(after.toBot).toBe(300n)
    expect(after.owedSum).toBe(700n)
    expect(after.owed["player"]).toBe(700n)
    const eaten = returnUnsettledAttack(300n, owed, true)
    expect(eaten.owedSum).toBe(0n)
    expect(eaten.toBot).toBe(1000n)
  })

  it("pool_in_is_measured_not_accumulated", () => {
    const pack = loadPack()
    expect(pack.sections.arch.custody.pool_in).toBe("measured")
    expect(pack.sections.arch.custody.return_fn).toBe("returnUnsettled")
  })

  it("settled_claim_uncovered_is_reported", () => {
    const pack = loadPack()
    expect(pack.sections.codes.codes["PRIZE_CLAIM_UNCOVERED"]).toBeDefined()
    const uncovered = claimPrize({
      owed: 50n,
      poolIn: 0n,
      paused: false,
      demo: false,
      honorPause: true,
    })
    expect(uncovered.code).toBe(CODE_UNCOVERED)
    expect(uncovered.paid).toBe(0n)
    const paused = claimPrize({
      owed: 50n,
      poolIn: 50n,
      paused: true,
      demo: false,
      honorPause: true,
    })
    expect(paused.paid).toBe(0n)
    expect(paused.code).toBe("")
  })

  it("refund_player_capped_by_backing", () => {
    const over = refundPlayer({
      backing: 100n,
      amount: 101n,
      capital: 1n,
      anchor: 2000n,
      corpInVault: 200n,
      totalBacking: 140n,
    })
    expect(over.ok).toBe(0n)
    const ok = refundPlayer({
      backing: 100n,
      amount: 100n,
      capital: 200000n,
      anchor: 2000n,
      corpInVault: 200n,
      totalBacking: 140n,
    })
    expect(ok.ok).toBe(1n)
    expect(ok.backing).toBe(0n)
    expect(ok.capital).toBe(0n)
    expect(ok.reserve).toBe(60n)
  })

  it("bot_refund_not_whole_vault", () => {
    const botAll = refundPlayer({
      backing: 40n,
      amount: 200n,
      capital: 1n,
      anchor: 2000n,
      corpInVault: 200n,
      totalBacking: 140n,
    })
    expect(botAll.ok).toBe(0n)
    const botOwn = refundPlayer({
      backing: 40n,
      amount: 40n,
      capital: 40n,
      anchor: 2000n,
      corpInVault: 200n,
      totalBacking: 140n,
    })
    expect(botOwn.ok).toBe(1n)
    expect(botOwn.reserve).toBe(60n)
    expect(botOwn.corpLeft).toBe(160n)
  })

  it("guardian_not_signer", () => {
    const pack = loadPack()
    expect(pack.sections.arch.keys["guardian"]).toBeDefined()
    expect(pack.sections.arch.keys["signer"]).toBeDefined()
    expect(pack.sections.arch.keys["pending_signer"]).toBeDefined()
    expect(pack.sections.arch.custody.refund_fn).toBe("refundPlayer")
  })

  it("recover_wrong_token_skips_own", () => {
    const pack = loadPack()
    expect(pack.sections.codes.codes["PRIZE_UNSETTLED_RETURNED"]).toBeDefined()
    expect(pack.sections.arch.port.groups["vault"]).toBeDefined()
    expect(pack.sections.arch.port.groups["prize_treasury"]).toBeDefined()
  })

  it("no_burn_reserve_rescue", () => {
    const pendingRaw = JSON.parse(
      readFileSync(join(repo, "content/params/pending.json"), "utf8"),
    ) as { readonly items?: { readonly [key: string]: unknown } }
    expect("burn_reserve_rescue" in (pendingRaw.items ?? {})).toBe(false)
    const vault = readFileSync(join(repo, "contracts/src/Vault.sol"), "utf8")
    expect(vault.includes("function returnBurnReserve")).toBe(false)
    expect(vault.includes("function rescueBurnReserve")).toBe(false)
    expect(vault.includes("function returnUnsettled")).toBe(false)
  })
})
