import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import {
  buildHud,
  emptySnapshot,
  evaluateActionGate,
  loadClientPack,
  loadStringTable,
  type ClientSnapshot,
} from "../src/index.ts"
import { BuildingCardScreen, sendDeactivate } from "../src/hud/screens/building_card.tsx"
import { resolveBuildingSelection } from "../src/hud/selection.ts"
import type { ScreenProps } from "../src/hud/parts/ScreenFrame.tsx"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

describe("W19", () => {
  const pack = loadClientPack(loadPack(new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))).pack)
  const strings = loadStringTable(readJson("content/strings/en.json"))

  function viewOf(snap: ClientSnapshot) {
    return buildHud({ pack, strings, snapshot: snap, nowMs: 0n, firstLoginMs: 0n, demo: false })
  }

  function screen(snap: ClientSnapshot, objectId: string, onIntent: ScreenProps["onIntent"] = async () => {}) {
    const props: ScreenProps = {
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
      onIntent,
      onCommit: async () => {},
      moneyTxn: undefined,
      onMoneyTxn: () => {},
      onLocal: () => {},
      selectedObjectId: objectId,
    }
    return renderToStaticMarkup(createElement(BuildingCardScreen, props))
  }

  function snap(over: Partial<ClientSnapshot> = {}): ClientSnapshot {
    return {
      ...emptySnapshot(),
      accountKind: "wallet",
      capital: 100000n,
      cityLevel: 4n,
      functions: [],
      gate: { openedDistricts: ["compute", "energy", "logistics", "consumer", "automation", "finance"] },
      ...over,
    }
  }

  it("shows build on an unbuilt functional building and not upgrade", () => {
    const html = screen(snap(), "workshop")
    expect(html.includes('data-action="building_build"')).toBe(true)
    expect(html.includes('data-action="building_upgrade"')).toBe(false)
  })

  it("shows activate when the building is switched off", () => {
    const html = screen(
      snap({
        functions: [{ id: "workshop", nameKey: "UI_BLD_WORKSHOP", statusKey: "UI_DEACTIVATED" }],
      }),
      "workshop",
    )
    expect(html.includes('data-action="building_activate"')).toBe(true)
  })

  it("does not send deactivate before confirmation", () => {
    let calls = 0
    const html = screen(
      snap({
        functions: [{ id: "workshop", nameKey: "UI_BLD_WORKSHOP", statusKey: "UI_AVAILABLE" }],
      }),
      "workshop",
      () => {
        calls += 1
      },
    )
    expect(html.includes('data-intent="deactivate"')).toBe(true)
    expect(html.includes('data-dialog="review"')).toBe(false)
    expect(calls).toBe(0)
    expect(sendDeactivate(false, () => { calls += 1 })).toBe(false)
    expect(calls).toBe(0)
  })

  it("blocks build on a closed district instead of hiding it", () => {
    const html = screen(
      snap({ gate: { openedDistricts: ["compute"] } }),
      "energy_plant",
    )
    expect(html.includes('data-action="building_build"')).toBe(true)
    expect(html.includes('data-blocked-code="DISTRICT_LOCKED"')).toBe(true)
    expect(html.includes('data-action="building_upgrade"')).toBe(false)
  })

  it("sends manage of an unbuilt bank to the building card", () => {
    expect(resolveBuildingSelection("bank", pack, []).manage?.route).toBe("building_card")
    expect(resolveBuildingSelection("exchange", pack, []).manage?.route).toBe("building_card")
    expect(resolveBuildingSelection("agent_hub", pack, []).manage?.route).toBe("building_card")
    expect(resolveBuildingSelection("bank", pack, [{ id: "bank" }]).manage?.route).toBe("bank")
  })

  it("does not count a prebuilt building toward the build slot", () => {
    const cap = pack.buildSlotsByLevel["1"]
    expect(cap !== undefined && cap > 0n).toBe(true)
    if (cap === undefined) return
    const functions = [
      { id: "city_hall", nameKey: "UI_BLD_CITY_HALL", statusKey: "UI_AVAILABLE" },
      ...Array.from({ length: Number(cap) - 1 }, (_, i) => ({
        id: `b${i}`,
        nameKey: "UI_BLD_WORKSHOP",
        statusKey: "UI_AVAILABLE",
      })),
    ]
    const view = viewOf(snap({ cityLevel: 1n, functions }))
    const action = pack.actions["building_build"]
    expect(action).toBeDefined()
    if (action === undefined) return
    const hit = evaluateActionGate({ pack, action, view, demo: false })
    expect(hit.kind).toBe("ok")
    expect(codes.NO_FREE_BUILD_SLOT.length > 0).toBe(true)
  })
})
