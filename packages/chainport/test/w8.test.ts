import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { atPath, loadPack, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { describe, expect, it } from "vitest"
import { createMockPort, type AssetPort, type PortConfig, type PortResult, type Voucher } from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const PLAYER = "a"
const OTHER = "b"
const HOUSE = "house"
const OWN = 10n
const HOUSE_BAL = 50n
const OTHER_BAL = 100n
const COVERED = OWN + HOUSE_BAL
const EATS_OTHER = COVERED + 1n

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function asObj(value: Json): { readonly [key: string]: Json } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("pack")
  return value
}

function asText(value: Json | undefined): string {
  if (typeof value !== "string") throw new Error("pack")
  return value
}

function asBig(value: Json | undefined): bigint {
  if (typeof value !== "bigint") throw new Error("pack")
  return value
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

type Refunding = AssetPort["vault"] & {
  refund(account: string, amount: bigint): Promise<PortResult>
}

function refundOf(port: AssetPort): Refunding["refund"] {
  return (port.vault as Refunding).refund.bind(port.vault)
}

async function backing(port: AssetPort, account: string): Promise<bigint> {
  const got = await port.vault.backingOf(account)
  if (!got.ok) throw new Error(got.code)
  return got.amount
}

async function fund(port: AssetPort, account: string, amount: bigint): Promise<void> {
  expect((await port.vault.deposit(account, amount)).ok).toBe(true)
  expect((await port.vault.mintCapital(account, amount, 1n)).ok).toBe(true)
}

function voucher(account: string, nonce: string, corpAmount: bigint): Voucher {
  return { nonce, account, corpAmount, issuedAtS: 0n }
}

describe("W8 voucher room", () => {
  it("pays from the player and the house, and refuses a voucher that would take another backing", async () => {
    const cfg = cfgFromPack(loadPack(packBytes()).pack)
    const port = createMockPort(cfg, {
      corp: { [PLAYER]: OWN, [OTHER]: OTHER_BAL, [HOUSE]: HOUSE_BAL },
      house: HOUSE,
    })
    await fund(port, PLAYER, OWN)
    await fund(port, OTHER, OTHER_BAL)
    await fund(port, HOUSE, HOUSE_BAL)
    const eat = await port.vault.issueVoucher(voucher(PLAYER, "eat", EATS_OTHER))
    expect(eat.ok).toBe(false)
    if (!eat.ok) expect(eat.code).toBe(codes.NOT_ENOUGH_CORP)
    expect(await backing(port, OTHER)).toBe(OTHER_BAL)
    expect(await backing(port, PLAYER)).toBe(OWN)
    expect(await backing(port, HOUSE)).toBe(HOUSE_BAL)
    expect((await port.vault.issueVoucher(voucher(PLAYER, "ok", COVERED))).ok).toBe(true)
    expect((await refundOf(port)(PLAYER, OWN)).ok).toBe(false)
    expect(await backing(port, PLAYER)).toBe(OWN)
    expect(await backing(port, OTHER)).toBe(OTHER_BAL)
    expect((await port.vault.presentVoucher(voucher(PLAYER, "ok", COVERED), 0n)).ok).toBe(true)
    expect(await backing(port, PLAYER)).toBe(0n)
    expect(await backing(port, HOUSE)).toBe(0n)
    expect(await backing(port, OTHER)).toBe(OTHER_BAL)

    const bare = createMockPort(cfg, { corp: { [PLAYER]: OWN, [OTHER]: OTHER_BAL } })
    await fund(bare, PLAYER, OWN)
    await fund(bare, OTHER, OTHER_BAL)
    const uncovered = await bare.vault.issueVoucher(voucher(PLAYER, "bare", COVERED))
    expect(uncovered.ok).toBe(false)
    if (!uncovered.ok) expect(uncovered.code).toBe(codes.NOT_ENOUGH_CORP)
    expect(await backing(bare, PLAYER)).toBe(OWN)
    expect(await backing(bare, OTHER)).toBe(OTHER_BAL)

    const solo = createMockPort(cfg, { corp: { [PLAYER]: OWN } })
    await fund(solo, PLAYER, OWN)
    const over = await refundOf(solo)(PLAYER, OWN + 1n)
    expect(over.ok).toBe(false)
    if (!over.ok) expect(over.code).toBe(codes.NOT_ENOUGH_CORP)
    expect(await backing(solo, PLAYER)).toBe(OWN)

    const asHouse = createMockPort(cfg, {
      corp: { [PLAYER]: OWN, [OTHER]: OTHER_BAL, [HOUSE]: HOUSE_BAL },
      house: HOUSE,
    })
    await fund(asHouse, PLAYER, OWN)
    await fund(asHouse, OTHER, OTHER_BAL)
    await fund(asHouse, HOUSE, HOUSE_BAL)
    const houseEats = await asHouse.vault.issueVoucher(voucher(HOUSE, "house-eat", HOUSE_BAL + 1n))
    expect(houseEats.ok).toBe(false)
    if (!houseEats.ok) expect(houseEats.code).toBe(codes.NOT_ENOUGH_CORP)
    expect(await backing(asHouse, OTHER)).toBe(OTHER_BAL)
    expect(await backing(asHouse, HOUSE)).toBe(HOUSE_BAL)

    const half = createMockPort(cfg, { corp: { [PLAYER]: 100n } })
    expect((await half.vault.deposit(PLAYER, 40n)).ok).toBe(true)
    expect((await half.vault.deposit(PLAYER, 60n)).ok).toBe(true)
    expect((await half.vault.mintCapital(PLAYER, 40n, 1n)).ok).toBe(true)
    const left = await half.vault.pending(PLAYER)
    expect(left.ok && left.amount).toBe(60n)
    expect((await half.vault.mintCapital(PLAYER, 60n, 1n)).ok).toBe(true)
    const gone = await half.vault.pending(PLAYER)
    expect(gone.ok && gone.amount).toBe(0n)

    const room = createMockPort(cfg, { corp: { a: 100n, b: 50n } })
    expect((await room.vault.deposit("a", 100n)).ok).toBe(true)
    expect((await room.vault.mintCapital("a", 100n, 1n)).ok).toBe(true)
    expect((await room.vault.deposit("b", 50n)).ok).toBe(true)
    expect((await room.vault.mintCapital("b", 50n, 1n)).ok).toBe(true)
    expect((await room.vault.issueVoucher(voucher("a", "a100", 100n))).ok).toBe(true)
    expect((await room.vault.issueVoucher(voucher("b", "b50", 50n))).ok).toBe(true)
    const again = await room.vault.issueVoucher(voucher("b", "b51", 50n))
    expect(again.ok).toBe(false)

    const held = createMockPort(cfg, { corp: { p: 10n, h: 50n }, house: "h" })
    expect((await held.vault.deposit("h", 50n)).ok).toBe(true)
    expect((await held.vault.mintCapital("h", 50n, 1n)).ok).toBe(true)
    expect((await held.vault.deposit("p", 10n)).ok).toBe(true)
    const spendHouse = await held.vault.issueVoucher(voucher("p", "pend", 1n))
    expect(spendHouse.ok).toBe(false)
    expect(await backing(held, "h")).toBe(50n)
  })
})
