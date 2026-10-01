import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { buildHud, emptySnapshot, loadClientPack, loadStringTable, type ClientSnapshot } from "../src/index.ts"
import { AgentsScreen } from "../src/hud/screens/agents.tsx"
import { BankScreen } from "../src/hud/screens/bank.tsx"
import { BuildingCardScreen } from "../src/hud/screens/building_card.tsx"
import { DistrictCardScreen } from "../src/hud/screens/district_card.tsx"
import { ExchangeScreen } from "../src/hud/screens/exchange.tsx"
import { ResearchScreen } from "../src/hud/screens/research.tsx"
import { IndustriesWorkspace } from "../src/hud/workspace/IndustriesWorkspace.tsx"
import type { ScreenProps } from "../src/hud/parts/ScreenFrame.tsx"
import type { SnapshotDistrictLive } from "../src/hud/snapshot.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

/** A promising control is live, or disabled with a reason. Anything else is dead. */
export function buttonVerdict(tag: string): "live" | "blocked" | "dead" {
  const disabled = /[\s"]disabled(?:=|>|\s|")/.test(tag) || tag.includes(" disabled")
  const code = /data-blocked-code="([^"]*)"/.exec(tag)?.[1] ?? ""
  const intent = /data-intent="([^"]+)"/.exec(tag)?.[1] ?? ""
  const action = /data-action="([^"]+)"/.exec(tag)?.[1] ?? ""
  if (disabled) return code.length > 0 ? "blocked" : "dead"
  if (intent.length > 0 || action.length > 0) return "live"
  return "dead"
}

function buttonsWith(html: string, marker: string): readonly string[] {
  const out: string[] = []
  const re = /<button\b[^>]*>/g
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const tag = match[0] ?? ""
    if (tag.includes(marker)) out.push(tag)
  }
  return out
}

describe("W23 every promising button works or states why it does not", () => {
  const pack = loadClientPack(loadPack(new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))).pack)
  const strings = loadStringTable(readJson("content/strings/en.json"))
  const district = pack.districts[0]
  if (district === undefined) throw new Error("district")

  function viewOf(snap: ClientSnapshot) {
    return buildHud({ pack, strings, snapshot: snap, nowMs: 0n, firstLoginMs: 0n, demo: false })
  }

  function props(snap: ClientSnapshot, extra: Partial<ScreenProps> = {}): ScreenProps {
    return {
      view: viewOf(snap),
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
      onIntent: async () => {},
      onCommit: async () => {},
      moneyTxn: undefined,
      onMoneyTxn: () => {},
      onLocal: () => {},
      ...extra,
    }
  }

  function liveDistrict(over: Partial<SnapshotDistrictLive>): SnapshotDistrictLive {
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

  function html(node: ReactElement): string {
    return renderToStaticMarkup(node)
  }

  const wallet = {
    ...emptySnapshot(),
    accountKind: "wallet" as const,
    capital: 100000n,
    corp: 5n * 10n ** 18n,
    cityLevel: 4n,
    gate: { openedDistricts: ["compute", "energy", "logistics", "consumer", "automation", "finance"] },
  }

  const built = html(
    createElement(BuildingCardScreen, {
      ...props({
        ...wallet,
        functions: [{ id: "workshop", nameKey: "UI_BLD_WORKSHOP", statusKey: "UI_AVAILABLE" }],
      }),
      selectedObjectId: "workshop",
    }),
  )
  const off = html(
    createElement(BuildingCardScreen, {
      ...props({
        ...wallet,
        functions: [{ id: "workshop", nameKey: "UI_BLD_WORKSHOP", statusKey: "UI_DEACTIVATED" }],
      }),
      selectedObjectId: "workshop",
    }),
  )
  const unbuilt = html(createElement(BuildingCardScreen, { ...props(wallet), selectedObjectId: "workshop" }))
  const agents = html(
    createElement(AgentsScreen, {
      ...props({
        ...wallet,
        agents: [{ id: "a1", idleKey: "UI_AVAILABLE", role: "engineer" }],
        functions: [{ id: "workshop", nameKey: "UI_BLD_WORKSHOP", statusKey: "UI_AVAILABLE" }],
      }),
    }),
  )
  const deposit = html(createElement(BankScreen, props(wallet)))
  const withdraw = html(createElement(BankScreen, { ...props(wallet), startTab: "withdraw" }))
  const exchange = html(createElement(ExchangeScreen, props(wallet)))
  const closed = viewOf({
    ...wallet,
    gate: {
      openedDistricts: [],
      districts: [liveDistrict({})],
      chainWrong: false,
      stakeThresholdMet: false,
      tierUnlocked: false,
      stakeMultMet: true,
      nodeSideOpen: true,
      mergeFree: true,
    },
  })
  const readyOpen = viewOf({
    ...wallet,
    gate: {
      openedDistricts: [],
      districts: [liveDistrict({ stake: 10n, stakeThresholdMet: true })],
      chainWrong: false,
      stakeThresholdMet: true,
      tierUnlocked: false,
      stakeMultMet: true,
      nodeSideOpen: true,
      mergeFree: true,
    },
  })
  const stakeHtml = html(createElement(IndustriesWorkspace, { view: closed, pack, strings, onLook: () => {}, screen: { ...props(wallet), view: closed } }))
  const openHtml = html(createElement(IndustriesWorkspace, { view: readyOpen, pack, strings, onLook: () => {}, screen: { ...props(wallet), view: readyOpen } }))
  const card = html(
    createElement(DistrictCardScreen, {
      ...props({
        ...wallet,
        gate: {
          openedDistricts: [district.id],
          districts: [liveDistrict({ stake: 10n, stakeThresholdMet: true, tier: 1n })],
          chainWrong: false,
          stakeThresholdMet: true,
          tierUnlocked: false,
          stakeMultMet: true,
          nodeSideOpen: true,
          mergeFree: true,
        },
      }),
      lookId: district.id,
    }),
  )
  const research = html(createElement(ResearchScreen, props(wallet)))

  const controls: readonly { readonly id: string; readonly html: string; readonly marker: string }[] = [
    { id: "build", html: unbuilt, marker: 'data-action="building_build"' },
    { id: "upgrade", html: built, marker: 'data-action="building_upgrade"' },
    { id: "activate", html: off, marker: 'data-action="building_activate"' },
    { id: "deactivate", html: built, marker: 'data-intent="deactivate"' },
    { id: "hire", html: agents, marker: 'data-action="agents_hire"' },
    { id: "assign", html: agents, marker: 'data-action="agent_assign"' },
    { id: "task", html: agents, marker: 'data-action="agent_set_objective"' },
    { id: "deposit", html: deposit, marker: 'data-intent="deposit"' },
    { id: "withdraw", html: withdraw, marker: 'data-intent="withdraw"' },
    { id: "present_voucher", html: withdraw, marker: 'data-intent="present_voucher"' },
    { id: "buy", html: exchange, marker: 'data-intent="buy_stock"' },
    { id: "open_district", html: openHtml, marker: 'data-action="districts_open"' },
    { id: "stake", html: stakeHtml, marker: 'data-action="district_stake_more"' },
    { id: "unstake", html: card, marker: 'data-action="district_unstake"' },
    { id: "tier", html: card, marker: 'data-action="district_unlock_tier"' },
    { id: "node", html: card, marker: 'data-action="district_pick_node"' },
    { id: "merge", html: card, marker: 'data-action="district_merge"' },
    { id: "fragment", html: card, marker: 'data-action="district_claim_fragment"' },
    { id: "research", html: research, marker: 'data-intent="research_start"' },
  ]

  it("keeps each listed control live or blocked with a reason", () => {
    const dead: string[] = []
    for (const row of controls) {
      const tags = buttonsWith(row.html, row.marker)
      if (tags.length === 0) {
        dead.push(row.id + ":missing")
        continue
      }
      for (const tag of tags) {
        const verdict = buttonVerdict(tag)
        if (verdict === "dead") dead.push(row.id)
      }
    }
    expect(dead).toEqual([])
  })

  it("treats a button whose handler was removed as dead", () => {
    const stripped = '<button type="button" data-key="UI_DEACTIVATE">'
    expect(buttonVerdict(stripped)).toBe("dead")
    expect(buttonVerdict('<button type="button" disabled data-blocked-code="">')).toBe("dead")
    expect(buttonVerdict('<button type="button" data-intent="build">')).toBe("live")
    expect(buttonVerdict('<button type="button" disabled data-blocked-code="DISTRICT_LOCKED">')).toBe("blocked")
  })
})
