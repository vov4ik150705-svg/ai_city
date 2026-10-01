import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { quoteStockAmount } from "../src/project.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

describe("X13 live stock projection", () => {
  it("uses the wallet balance on a live read and the ledger only when that read did not happen", () => {
    expect(quoteStockAmount(3n, undefined, "NVDA")).toBe(3n)
    expect(quoteStockAmount(0n, { NVDA: 9n }, "NVDA")).toBe(9n)
    expect(quoteStockAmount(0n, { NVDA: 0n }, "NVDA")).toBe(0n)
    expect(quoteStockAmount(4n, {}, "NVDA")).toBeUndefined()
    const src = readFileSync(join(root, "services/api/src/project.ts"), "utf8")
    expect(src.includes("quoteStockAmount(tokensHeld(city, ticker), walletStocks, ticker)")).toBe(true)
  })
})
