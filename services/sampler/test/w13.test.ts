import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { loadPack } from "@corporator/contentpack"
import { quoteAt } from "@corporator/engine"
import { describe, expect, it } from "vitest"
import { loadSamplerPack } from "../src/pack.ts"
import { samplerSource } from "../src/source.ts"
import { startMain } from "../src/main.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

describe("W13 live price feed", () => {
  it("silence past the staleness window is not a live feed, and open deposits refuse the pack seed", async () => {
    const pack = loadSamplerPack(packBytes())
    const stale = quoteAt(
      pack.stalenessMaxCityHours + 1n,
      0n,
      pack.stalenessMaxCityHours,
      pack.seedEthUsd8dec,
      pack.seedCorpWei,
      pack.seedEthUsd8dec,
      pack.seedCorpWei,
    )
    expect(stale.feedLive).toBe(0n)
    expect(stale.ethUsd8dec).toBe(pack.seedEthUsd8dec)
    expect(stale.corpEthWeiPerWhole).toBe(pack.seedCorpWei)
    const zero = quoteAt(1n, 1n, pack.stalenessMaxCityHours, 0n, pack.seedCorpWei, pack.seedEthUsd8dec, pack.seedCorpWei)
    expect(zero.feedLive).toBe(0n)
    expect(zero.ethUsd8dec).toBe(pack.seedEthUsd8dec)

    const prevOpen = process.env.CORPORATOR_DEPOSITS_OPEN
    const prevRpc = process.env.CORPORATOR_RPC_URL
    const prevFeed = process.env.CORPORATOR_FEED_ETH_USD
    const prevHash = process.env.PACK_HASH
    const prevCode = process.exitCode
    process.env.CORPORATOR_DEPOSITS_OPEN = "1"
    delete process.env.CORPORATOR_RPC_URL
    delete process.env.CORPORATOR_FEED_ETH_USD
    process.env.PACK_HASH = loadPack(packBytes()).hash
    expect(samplerSource(process.env)).toBe("refuse")
    try {
      await startMain()
      expect(process.exitCode).toBe(1)
    } finally {
      if (prevOpen === undefined) delete process.env.CORPORATOR_DEPOSITS_OPEN
      else process.env.CORPORATOR_DEPOSITS_OPEN = prevOpen
      if (prevRpc === undefined) delete process.env.CORPORATOR_RPC_URL
      else process.env.CORPORATOR_RPC_URL = prevRpc
      if (prevFeed === undefined) delete process.env.CORPORATOR_FEED_ETH_USD
      else process.env.CORPORATOR_FEED_ETH_USD = prevFeed
      if (prevHash === undefined) delete process.env.PACK_HASH
      else process.env.PACK_HASH = prevHash
      process.exitCode = prevCode
    }
  })
})
