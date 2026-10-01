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
const PREVIEW_STATUS_READY = "UI_RUNNING"
const PREVIEW_BUILDING_LEVEL = 2n
const PREVIEW_PAID = 16n + 8n

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

function roleForContour(contour: string): string {
  if (contour === "work_production") return "engineer"
  if (contour === "work_logistics") return "logistician"
  if (contour === "work_finance") return "trader"
  if (contour === "work_retail") return "trader"
  if (contour === "work_research") return "scientist"
  if (contour === "work_admin") return "manager"
  return ""
}

function defaultObjective(pack: ClientPack, role: string): string {
  for (const row of pack.agentObjectives) {
    if (row.role === role && row.isDefault) return row.id
  }
  return ""
}

function functionRows(
  pack: ClientPack,
  strings: StringTable,
): readonly {
  readonly id: string
  readonly nameKey: string
  readonly statusKey: string
  readonly level: bigint | undefined
  readonly worker: string
  readonly task: string
  readonly paid: bigint
}[] {
  const out: {
    id: string
    nameKey: string
    statusKey: string
    level: bigint | undefined
    worker: string
    task: string
    paid: bigint
  }[] = []
  const seen = new Set<string>()
  const candidates = [...pack.islandOccupied.map((row) => row.packId), ...pack.buildingIds]
  for (const id of candidates) {
    if (id.length === 0 || seen.has(id)) continue
    const nameKey = buildingLabelKey(id)
    if (strings[nameKey] === undefined) continue
    if (strings[PREVIEW_STATUS_IDLE] === undefined || strings[PREVIEW_STATUS_READY] === undefined) continue
    seen.add(id)
    const meta = pack.buildingMeta[id]
    const role = roleForContour(meta === undefined ? "" : meta.contour)
    out.push({
      id,
      nameKey,
      statusKey: out.length === 0 ? PREVIEW_STATUS_IDLE : PREVIEW_STATUS_READY,
      level: PREVIEW_BUILDING_LEVEL,
      worker: role,
      task: defaultObjective(pack, role),
      paid: PREVIEW_PAID,
    })
    if (out.length >= ACTIVE_FUNCTIONS_DEFAULT_ROWS) break
  }
  return out
}

function workshopPreviewId(
  functions: readonly { readonly id: string }[],
): string {
  for (const row of functions) {
    if (row.id === "workshop") return row.id
  }
  const first = functions[0]
  return first === undefined ? "" : first.id
}

function previewFunction(
  pack: ClientPack,
  id: string,
  statusKey: string,
): {
  readonly id: string
  readonly nameKey: string
  readonly statusKey: string
  readonly level: bigint | undefined
  readonly worker: string
  readonly task: string
  readonly paid: bigint
} {
  const meta = pack.buildingMeta[id]
  const role = roleForContour(meta === undefined ? "" : meta.contour)
  return {
    id,
    nameKey: buildingLabelKey(id),
    statusKey,
    level: PREVIEW_BUILDING_LEVEL,
    worker: role,
    task: defaultObjective(pack, role),
    paid: PREVIEW_PAID,
  }
}

function previewRankWallet(head: string, tail: string): string {
  return `${head}${"0".repeat(32)}${tail}`
}

/** Design-frame ranking. The live board still comes from the server snapshot. */
const PREVIEW_RANK: readonly {
  readonly head: string
  readonly tail: string
  readonly influence: bigint
  readonly gdp: bigint
  readonly self: boolean
}[] = [
  { head: "0x8f21", tail: "c04a", influence: 4821n, gdp: 18400n, self: false },
  { head: "0x5a39", tail: "7f16", influence: 4672n, gdp: 17860n, self: false },
  { head: "0x9c4e", tail: "2b71", influence: 4388n, gdp: 16230n, self: false },
  { head: "0x2d7a", tail: "9e33", influence: 4107n, gdp: 14980n, self: false },
  { head: "0x7e18", tail: "6c90", influence: 3962n, gdp: 13420n, self: false },
  { head: "0x1f3b", tail: "a7d2", influence: 3741n, gdp: 11960n, self: false },
  { head: "0xa64d", tail: "5c81", influence: 3568n, gdp: 10540n, self: false },
  { head: "0x4c91", tail: "a2e7", influence: 3320n, gdp: 9860n, self: true },
  { head: "0x6b7d", tail: "3f12", influence: 3102n, gdp: 8740n, self: false },
  { head: "0x9e2c", tail: "7a55", influence: 2894n, gdp: 7620n, self: false },
  { head: "0x3f56", tail: "d8a0", influence: 2731n, gdp: 6980n, self: false },
  { head: "0x8a11", tail: "4e23", influence: 2567n, gdp: 6240n, self: false },
  { head: "0x0d9e", tail: "c773", influence: 2401n, gdp: 5780n, self: false },
  { head: "0x70f5", tail: "1b92", influence: 2238n, gdp: 5120n, self: false },
]

export function previewSnapshot(pack: ClientPack, strings: StringTable): ClientSnapshot {
  const functions = [...functionRows(pack, strings)]
  if (!functions.some((row) => row.id === "workshop") && strings[buildingLabelKey("workshop")] !== undefined) {
    functions.push(previewFunction(pack, "workshop", PREVIEW_STATUS_IDLE))
  }
  for (let i = 0; i < functions.length; i += 1) {
    const row = functions[i]
    if (row === undefined) continue
    if (row.id === "workshop") {
      functions[i] = { ...row, statusKey: PREVIEW_STATUS_IDLE, paid: 0n }
      continue
    }
    if (row.id === "power_node" || row.statusKey === PREVIEW_STATUS_IDLE) {
      functions[i] = { ...row, statusKey: PREVIEW_STATUS_READY }
    }
  }
  const workshopAt = functions.findIndex((row) => row.id === "workshop")
  if (workshopAt > 0) {
    const row = functions[workshopAt]
    if (row !== undefined) {
      functions.splice(workshopAt, 1)
      functions.unshift(row)
    }
  }
  if (!functions.some((row) => row.id === "logistics_hub") && strings[buildingLabelKey("logistics_hub")] !== undefined) {
    functions.push(previewFunction(pack, "logistics_hub", PREVIEW_STATUS_READY))
  }
  if (!functions.some((row) => row.id === "flagship_store") && strings[buildingLabelKey("flagship_store")] !== undefined) {
    functions.push(previewFunction(pack, "flagship_store", PREVIEW_STATUS_READY))
  }
  const idleA = "IDLE_NO_ENERGY"
  const idleB = "IDLE_NO_COMPUTE"
  const idleC = "IDLE_NO_MATERIALS"
  const logKey = "BANK_CLOSED"
  const agents =
    strings[idleA] === undefined || strings[idleB] === undefined || strings[idleC] === undefined
      ? []
      : [
          { id: "h1", idleKey: idleA, role: "engineer", buildingId: workshopPreviewId(functions), objective: "produce", level: 2n },
          { id: "h2", idleKey: idleB, role: "logistician", buildingId: "logistics_hub", objective: "route", level: 1n },
          { id: "h3", idleKey: idleC, role: "trader", buildingId: "flagship_store", objective: "desk", level: 1n },
        ]
  const hourA = PREVIEW_CITY_NOON - 1n
  const hourB = PREVIEW_CITY_NOON
  const hourC = PREVIEW_CITY_NOON + 1n + 1n
  const log =
    strings[logKey] === undefined || strings[idleA] === undefined || strings[idleB] === undefined
      ? []
      : [
          { id: `preview:${hourA.toString()}`, key: idleB, badge: "logged", root: "", cid: "" },
          { id: `preview:${hourB.toString()}`, key: idleA, badge: "logged", root: "", cid: "" },
          { id: `preview:${hourC.toString()}`, key: logKey, badge: "logged", root: "", cid: "" },
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
    // Work preview matches the design frames (level 3) so Exchange is on screen.
    // exchangeLevelGate is unchanged: a live city at level 1 stays locked.
    cityLevel: 3n,
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
    influenceRank: {
      qualified: false,
      positiveDays: 0n,
      rank: 8n,
      influence: 3320n,
      board: PREVIEW_RANK.map((row, index) => ({
        rank: BigInt(index + 1),
        wallet: previewRankWallet(row.head, row.tail),
        influence: row.influence,
        gdp: row.gdp,
        positiveDays: 0n,
        qualified: false,
        self: row.self,
      })),
    },
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
