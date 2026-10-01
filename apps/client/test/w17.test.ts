import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { buildHud, emptySnapshot, loadClientPack, loadStringTable } from "../src/index.ts"
import { BankScreen } from "../src/hud/screens/bank.tsx"
import { formatCorp, sendDisplayAmount } from "../src/hud/parts/si.ts"
import type { ScreenProps } from "../src/hud/parts/ScreenFrame.tsx"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

describe("W17", () => {
  const pack = loadClientPack(loadPack(new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))).pack)
  const strings = loadStringTable(readJson("content/strings/en.json"))
  const scale = 10n ** pack.weiDecimals

  it("formats five whole CORP from atoms and groups the rest", () => {
    expect(formatCorp(5n * scale, pack.weiDecimals)).toBe("5")
    expect(formatCorp(scale + scale / 2n, pack.weiDecimals)).toBe("1.5")
    expect(formatCorp(1234n * scale, pack.weiDecimals)).toBe("1,234")
    const frac = (scale * 123456n) / 1000000n
    expect(formatCorp(scale + frac, pack.weiDecimals)).toBe("1.1234")
  })

  it("sends a deposit of 5 as atoms and ignores zero and letters", () => {
    let calls = 0
    let sent = ""
    const send = (atoms: string): void => {
      calls += 1
      sent = atoms
    }
    expect(sendDisplayAmount({ text: "0", decimals: pack.weiDecimals, unit: "corp", send })).toBe(false)
    expect(sendDisplayAmount({ text: "5a", decimals: pack.weiDecimals, unit: "corp", send })).toBe(false)
    expect(sendDisplayAmount({ text: "", decimals: pack.weiDecimals, unit: "corp", send })).toBe(false)
    expect(calls).toBe(0)
    expect(sent).toBe("")
    expect(sendDisplayAmount({ text: "5", decimals: pack.weiDecimals, unit: "corp", send })).toBe(true)
    expect(calls).toBe(1)
    expect(sent).toBe((5n * scale).toString())
    expect(sent).toBe("5000000000000000000")
  })

  it("reads quick amounts from the pack", () => {
    const bankSrc = readFileSync(join(repo, "apps/client/src/hud/screens/bank.tsx"), "utf8")
    expect(bankSrc.includes('["5", "10", "50"]')).toBe(false)
    expect(bankSrc.includes("corpQuickSmall")).toBe(true)
    expect(bankSrc.includes("capitalQuickSmall")).toBe(true)
    const view = buildHud({
      pack,
      strings,
      snapshot: emptySnapshot(),
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: true,
    })
    const props: ScreenProps = {
      view,
      pack,
      strings,
      demo: true,
      failed: new Set(),
      loading: false,
      onClose: () => {},
      onNavigate: () => {},
      pendingCell: "",
      pendingTileX: 0n,
      pendingTileY: 0n,
      onIntent: async () => {},
      onCommit: async () => {},
      moneyTxn: undefined,
      onMoneyTxn: () => {},
      onLocal: () => {},
    }
    const deposit = renderToStaticMarkup(createElement(BankScreen, props))
    expect(deposit.includes(`data-preset="${pack.corpQuickSmall.toString()}"`)).toBe(true)
    expect(deposit.includes(`data-preset="${pack.corpQuickMid.toString()}"`)).toBe(true)
    expect(deposit.includes(`data-preset="${pack.corpQuickLarge.toString()}"`)).toBe(true)
    const withdraw = renderToStaticMarkup(createElement(BankScreen, { ...props, startTab: "withdraw" }))
    expect(withdraw.includes(`data-preset="${pack.capitalQuickSmall.toString()}"`)).toBe(true)
    expect(withdraw.includes(`data-preset="${pack.capitalQuickMid.toString()}"`)).toBe(true)
    expect(withdraw.includes(`data-preset="${pack.capitalQuickLarge.toString()}"`)).toBe(true)
    expect(withdraw.includes('data-preset="5"')).toBe(false)
  })
})
