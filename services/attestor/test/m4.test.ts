import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { atPath, canonical, fromUtf8, loadPack, parseJson, utf8, type Json } from "@corporator/contentpack"
import { bytesToHex } from "@corporator/engine"
import { createMockIpfs, createMockPort, createRpcPort, type PortConfig } from "@corporator/chainport"
import {
  createSubmit,
  emptyAttestorState,
  loadAttestorPack,
  mapRootStore,
  publishSealed,
  selectAttestorPort,
} from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function asObj(value: Json): { readonly [key: string]: Json } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("json")
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

function padAddr(n: bigint): string {
  let hex = n.toString(16)
  while (hex.length < 40) hex = "0" + hex
  return "0x" + hex
}

function liveEnv(): { readonly [key: string]: string } {
  return {
    CORPORATOR_RPC_URL: "http://127.0.0.1:8545",
    CORPORATOR_CHAIN_ID: "1",
    CORPORATOR_RPC_TIMEOUT_MS: "1000",
    CORPORATOR_CORP_TOKEN: padAddr(1n),
    CORPORATOR_VAULT: padAddr(2n),
    CORPORATOR_STAKE_REGISTRY: padAddr(3n),
    CORPORATOR_MERKLE_ROOTS: padAddr(4n),
    CORPORATOR_PRIZE_TREASURY: padAddr(5n),
  }
}

describe("M4 attestor live path", () => {
  const bytes = packBytes()
  const loaded = loadPack(bytes)
  const cfg = cfgFromPack(loaded.pack)
  const pack = loadAttestorPack(bytes)

  it("mock_port_when_env_empty", () => {
    expect(selectAttestorPort(cfg, {}).kind).toBe("mock")
  })

  it("mock_port_when_merkle_only", () => {
    const env = {
      CORPORATOR_RPC_URL: "http://127.0.0.1:8545",
      CORPORATOR_CHAIN_ID: "1",
      CORPORATOR_RPC_TIMEOUT_MS: "1000",
      CORPORATOR_MERKLE_ROOTS: padAddr(4n),
    }
    expect(selectAttestorPort(cfg, env).kind).toBe("mock")
  })

  it("rpc_port_when_env_complete", () => {
    expect(selectAttestorPort(cfg, liveEnv()).kind).toBe("rpc")
  })

  it("roots_survive_store_reopen", () => {
    const bag = { minutes: new Map<string, Uint8Array>(), days: new Map<string, Uint8Array>() }
    const first = mapRootStore(bag)
    const root = utf8("minute-root")
    const cid = utf8("day-cid")
    first.putMinute(12n, root)
    first.putCityDay("a:1", cid)
    const second = mapRootStore(bag)
    expect(second.getMinute(12n)).toEqual(root)
    expect(second.getCityDay("a:1")).toEqual(cid)
  })

  it("rpc_silence_is_not_verified", async () => {
    const ticks = [{ cityId: "a", cityTime: 0n, leaves: [utf8("one-leaf")] }]
    const out = await publishSealed(
      pack,
      createRpcPort(cfg),
      createMockIpfs(false),
      mapRootStore({ minutes: new Map(), days: new Map() }),
      emptyAttestorState(),
      ticks,
      pack.rootPeriodS,
    )
    expect(out.badge).not.toBe("verified")
    expect(out.rootHex.length).toBe(0)
  })

  it("ipfs_down_logged_not_throw", async () => {
    const ticks = [{ cityId: "a", cityTime: 0n, leaves: [utf8("one-leaf")] }]
    const out = await publishSealed(
      pack,
      createMockPort(cfg),
      createMockIpfs(true),
      mapRootStore({ minutes: new Map(), days: new Map() }),
      emptyAttestorState(),
      ticks,
      pack.rootPeriodS,
    )
    expect(out.badge).toBe("logged")
    expect(out.cidHex.length).toBe(0)
  })

  it("create_submit_malformed_is_logged", async () => {
    const submit = createSubmit(bytes, {}, { store: mapRootStore({ minutes: new Map(), days: new Map() }) })
    const raw = parseJson(fromUtf8(await submit(utf8("nope"))))
    const row = asObj(raw)
    expect(row["badge"]).toBe("logged")
    expect(row["rootHex"]).toBe("")
    expect(row["cidHex"]).toBe("")
  })

  it("create_submit_mock_verifies_without_chain_env", async () => {
    const submit = createSubmit(bytes, {}, { store: mapRootStore({ minutes: new Map(), days: new Map() }) })
    const body = canonical({
      city_id: "a",
      city_time: "0",
      leaves: [bytesToHex(utf8("one-leaf"))],
    })
    const raw = parseJson(fromUtf8(await submit(body)))
    const row = asObj(raw)
    expect(row["badge"]).toBe("verified")
    expect(asText(row["rootHex"]).length > 0).toBe(true)
    expect(asText(row["cidHex"]).length > 0).toBe(true)
  })
})
