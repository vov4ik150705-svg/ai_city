import { loadPack, parseJson } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { emptySnapshot, type ClientSnapshot } from "./hud/model.js"
import { ACTIVE_FUNCTIONS_DEFAULT_ROWS, buildingLabelKey } from "./hud/selection.js"
import { loadClientPack, loadHudFixture, type ClientPack } from "./packview.js"
import { loadStringTable, type StringTable } from "./strings.js"
import { parsePalette, type Palette } from "./palette.js"
import type { HudFixture } from "./layout.js"

import packUrl from "../../../content/out/pack.json?url"
import stringsUrl from "../../../content/strings/en.json?url"
import hudUrl from "../../../content/fixtures/hud_layout.json?url"
import paletteUrl from "../../../art/palette/corporator.hex?url"

const PREVIEW_CITY_NOON = 12n
const PREVIEW_STATUS_IDLE = "IDLE_NO_ENERGY"
const PREVIEW_STATUS_READY = "UI_AVAILABLE"

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(codes.API_PACK_STALE)
  return new Uint8Array(await res.arrayBuffer())
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(codes.API_PACK_STALE)
  return await res.text()
}

function functionRows(
  pack: ClientPack,
  strings: StringTable,
): readonly { readonly id: string; readonly nameKey: string; readonly statusKey: string }[] {
  const out: { id: string; nameKey: string; statusKey: string }[] = []
  const seen = new Set<string>()
  const candidates = [...pack.islandOccupied.map((row) => row.packId), ...pack.buildingIds]
  for (const id of candidates) {
    if (id.length === 0 || seen.has(id)) continue
    const nameKey = buildingLabelKey(id)
    if (strings[nameKey] === undefined) continue
    if (strings[PREVIEW_STATUS_IDLE] === undefined || strings[PREVIEW_STATUS_READY] === undefined) continue
    seen.add(id)
    out.push({
      id,
      nameKey,
      statusKey: out.length === 0 ? PREVIEW_STATUS_IDLE : PREVIEW_STATUS_READY,
    })
    if (out.length >= ACTIVE_FUNCTIONS_DEFAULT_ROWS) break
  }
  return out
}

export function previewSnapshot(pack: ClientPack, strings: StringTable): ClientSnapshot {
  const functions = functionRows(pack, strings)
  const idleA = "IDLE_NO_ENERGY"
  const idleB = "IDLE_NO_COMPUTE"
  const logKey = "BANK_CLOSED"
  const agents =
    strings[idleA] === undefined || strings[idleB] === undefined
      ? []
      : [
          { id: "preview-agent-a", idleKey: idleA },
          { id: "preview-agent-b", idleKey: idleB },
        ]
  const log =
    strings[logKey] === undefined || strings[idleA] === undefined || strings[idleB] === undefined
      ? []
      : [
          { id: "preview-log-1", key: logKey, badge: "logged", root: "", cid: "" },
          { id: "preview-log-2", key: idleA, badge: "logged", root: "", cid: "" },
          { id: "preview-log-3", key: idleB, badge: "logged", root: "", cid: "" },
        ]
  return {
    ...emptySnapshot(),
    cityTime: PREVIEW_CITY_NOON,
    accountKind: "demo",
    capital: 124800n,
    corp: 50n,
    energy: 800n,
    compute: 400n,
    population: 12n,
    cityLevel: 1n,
    payrollRatioBps: (pack.bps * 86n) / 100n,
    payrollPaid: 1240n,
    payrollRequested: 1240n,
    energyDemand: 1000n,
    computeDemand: 600n,
    gdp: 5000n,
    happiness: pack.bps,
    stability: pack.bps,
    productivity: pack.bps,
    seasonLabel: "S1",
    periodLabel: "P1",
    unreadCount: 1n,
    quoteLive: undefined,
    quoteAgeMs: undefined,
    bankLimitLive: undefined,
    functions,
    stocks: pack.districts.map((row) => ({
      ticker: row.ticker,
      price: "1",
      dayPct: "+0",
      effect: row.provides,
    })),
    agents,
    log,
  }
}

export type HudPreviewAssets = {
  readonly pack: ClientPack
  readonly strings: StringTable
  readonly hud: HudFixture
  readonly palette: Palette
  readonly snapshot: ClientSnapshot
}

export async function loadHudPreviewAssets(): Promise<HudPreviewAssets> {
  const loaded = loadPack(await fetchBytes(packUrl))
  const pack = loadClientPack(loaded.pack)
  const strings = loadStringTable(parseJson(await fetchText(stringsUrl)))
  const hud = loadHudFixture(parseJson(await fetchText(hudUrl)))
  const palette = parsePalette(await fetchText(paletteUrl))
  return { pack, strings, hud, palette, snapshot: previewSnapshot(pack, strings) }
}
