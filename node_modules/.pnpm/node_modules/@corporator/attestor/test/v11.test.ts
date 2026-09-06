import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { atPath, loadPack, utf8, type Json } from "@corporator/contentpack"
import { createMockIpfs, createMockPort, type PortConfig } from "@corporator/chainport"
import {
  attestBadge,
  emptyAttestorState,
  loadAttestorPack,
  memoryRootStore,
  publishSealed,
} from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function asObj(value: Json): { readonly [key: string]: Json } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("json")
  }
  return value
}

function asText(value: Json | undefined): string {
  if (typeof value !== "string") throw new Error("text")
  return value
}

function asBig(value: Json | undefined): bigint {
  if (typeof value === "bigint") return value
  throw new Error("big")
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

describe.sequential("V11 attest live", () => {
  it("verified_badge_needs_root_and_cid", async () => {
    expect(attestBadge("", "cid", false)).toBe("logged")
    expect(attestBadge("root", "", false)).toBe("logged")
    expect(attestBadge("root", "cid", false)).toBe("verified")
    expect(attestBadge("root", "cid", true)).toBe("degraded")
    const bytes = packBytes()
    const pack = loadAttestorPack(bytes)
    const loaded = loadPack(bytes)
    const cfg = cfgFromPack(loaded.pack)
    const ticks = [{ cityId: "a", cityTime: 0n, leaves: [utf8("one-leaf")] }]
    const up = await publishSealed(
      pack,
      createMockPort(cfg),
      createMockIpfs(false),
      memoryRootStore(),
      emptyAttestorState(),
      ticks,
      pack.rootPeriodS,
    )
    expect(up.badge).toBe("verified")
    expect(up.rootHex.length > 0).toBe(true)
    expect(up.cidHex.length > 0).toBe(true)
    const mock = createMockPort(cfg)
    const drained = await publishSealed(
      pack,
      mock,
      createMockIpfs(false),
      memoryRootStore(),
      emptyAttestorState(),
      ticks,
      pack.rootPeriodS,
    )
    const got = await mock.merkleRoots.getRoot("a", 0n)
    expect(got.ok).toBe(true)
    if (got.ok) expect(got.root).toBe(drained.rootHex)
    const down = await publishSealed(
      pack,
      createMockPort(cfg),
      createMockIpfs(true),
      memoryRootStore(),
      emptyAttestorState(),
      ticks,
      pack.rootPeriodS,
    )
    expect(down.badge).toBe("logged")
    expect(down.cidHex.length === 0).toBe(true)
  })
})
