import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { buildHud, emptySnapshot, loadClientPack, loadStringTable, type ClientSnapshot } from "../src/index.ts"
import { IndustriesWorkspace } from "../src/hud/workspace/IndustriesWorkspace.tsx"
import { DistrictCardScreen, showTierBuy } from "../src/hud/screens/district_card.tsx"
import { stakeCommand, unstakeCommand } from "../src/hud/parts/IndustryCard.js"
import type { ScreenProps } from "../src/hud/parts/ScreenFrame.tsx"
import type { SnapshotDistrictLive } from "../src/hud/snapshot.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

function sliceAt(html: string, marker: string): string {
  const start = html.indexOf(marker)
  if (start < 0) return ""
  const rest = html.slice(start + marker.length)
  const next = rest.indexOf("data-district=\"")
  return next < 0 ? html.slice(start) : html.slice(start, start + marker.length + next)
}

describe("W20", () => {
  const pack = loadClientPack(loadPack(new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))).pack)
  const strings = loadStringTable(readJson("content/strings/en.json"))
  const district = pack.districts[0]
  if (district === undefined) throw new Error("district")

  function live(over: Partial<SnapshotDistrictLive>): SnapshotDistrictLive {
    return {
      id: district.id,
      ticker: district.ticker,
      stake: 0n,
      stakeMin: 10n,
      tier: 0n,
      frozen: false,
      grace: false,
      stakeThresholdMet: false,
      stakeMultMet: true,
      tierUnlocked: false,
      nodeSideOpen: true,
      mergeFree: true,
      ...over,
    }
  }

  function viewOf(snap: ClientSnapshot) {
    return buildHud({ pack, strings, snapshot: snap, nowMs: 0n, firstLoginMs: 0n, demo: false })
  }

  function screen(onIntent: ScreenProps["onIntent"] = async () => {}): ScreenProps {
    return {
      view: viewOf(emptySnapshot()),
      pack,
      strings,
      demo: false,
      failed: new Set(),
      loading: false,
      onClose: () => {},
      onNavigate: () => {},
      pendingCell: "",
      pendingTileX: 0n,
      pendingTileY: 0n,
      onIntent,
      onCommit: async () => {},
      moneyTxn: undefined,
      onMoneyTxn: () => {},
      onLocal: () => {},
    }
  }

  it("shows an amount field on a closed district and sends stake with amount and source", () => {
    const view = viewOf({
      ...emptySnapshot(),
      gate: { openedDistricts: [], districts: [live({})], chainWrong: false, stakeThresholdMet: false, tierUnlocked: false, stakeMultMet: true, nodeSideOpen: true, mergeFree: true },
    })
    const html = renderToStaticMarkup(
      createElement(IndustriesWorkspace, { view, pack, strings, onLook: () => {}, screen: { ...screen(), view } }),
    )
    const card = sliceAt(html, `data-district="${district.id}"`)
    expect(card.includes(`data-stake-amount="${district.id}"`)).toBe(true)
    expect(card.includes('data-action="district_stake_more"')).toBe(true)
    expect(card.includes('data-action="districts_open"')).toBe(false)
    const sent = stakeCommand(district.id, "5")
    expect(sent).toEqual({ district_id: district.id, amount: "5", source: "wallet" })
    expect(stakeCommand(district.id, "0")).toBeUndefined()
    expect(stakeCommand(district.id, "5a")).toBeUndefined()
  })

  it("shows unstake on an open district and keeps tier 1 from a zero buy", () => {
    const view = viewOf({
      ...emptySnapshot(),
      gate: {
        openedDistricts: [district.id],
        districts: [live({ stake: 10n, stakeMin: 10n, tier: 1n, stakeThresholdMet: true, tierUnlocked: true })],
        chainWrong: false,
        stakeThresholdMet: true,
        tierUnlocked: true,
        stakeMultMet: true,
        nodeSideOpen: true,
        mergeFree: true,
      },
    })
    const html = renderToStaticMarkup(
      createElement(DistrictCardScreen, { ...screen(), view, lookId: district.id }),
    )
    expect(html.includes('data-action="district_unstake"')).toBe(true)
    expect(html.includes('data-key="UI_UNSTAKE_HINT"')).toBe(true)
    expect(showTierBuy(0n)).toBe(false)
    expect(showTierBuy(undefined)).toBe(false)
  })

  it("does not offer a second unstake while grace is pending", () => {
    const view = viewOf({
      ...emptySnapshot(),
      gate: {
        openedDistricts: [district.id],
        districts: [live({ stake: 10n, stakeMin: 10n, tier: 1n, grace: true, stakeThresholdMet: true })],
        chainWrong: false,
        stakeThresholdMet: true,
        tierUnlocked: true,
        stakeMultMet: true,
        nodeSideOpen: true,
        mergeFree: true,
      },
    })
    const html = renderToStaticMarkup(
      createElement(DistrictCardScreen, { ...screen(), view, lookId: district.id }),
    )
    const button = html.match(/<button[^>]*data-action="district_unstake"[^>]*>/)
    expect(button !== null && button[0]?.includes("disabled")).toBe(true)
    expect(unstakeCommand(district.id, "5", true)).toBeUndefined()
    let calls = 0
    const payload = unstakeCommand(district.id, "5", true)
    if (payload !== undefined) calls += 1
    expect(calls).toBe(0)
  })
})
