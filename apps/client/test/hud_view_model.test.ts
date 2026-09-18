import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { buildHud, emptySnapshot, loadClientPack, loadStringTable } from "../src/index.ts"
import {
  errorField,
  exactBigint,
  FIELD_KINDS,
  isReadyField,
  loadingField,
  readyExact,
  readyField,
  staleField,
  unavailableField,
  type EventRowView,
  type FieldView,
} from "../src/hud/fields.ts"
import { transportOf } from "../src/hud/liveAdapter.ts"
import { reviewTxn } from "../src/hud/uiState.ts"
import { FactRow } from "../src/hud/parts/Facts.tsx"
import { ProgressMeter } from "../src/hud/parts/ProgressMeter.tsx"
import { StatusChip } from "../src/hud/parts/StatusChip.tsx"
import { FieldValue, ValueRow } from "../src/hud/parts/ValueRow.tsx"
import { StatRow } from "../src/hud/parts/StatRow.tsx"
import { FunctionStrip } from "../src/hud/center/FunctionStrip.tsx"
import { RecentActivity } from "../src/hud/right/RightRail.tsx"
import { islandChromeVisible, RECENT_ACTIVITY_DEFAULT_ROWS } from "../src/hud/selection.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

function markup(node: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(node)
}

function stuffedZero(kind: Exclude<FieldView["kind"], "ready">, text: string): FieldView {
  return { kind, key: "UI_UNAVAILABLE", text, exact: "0" }
}

describe("HUD typed view-model boundary", () => {
  it("treats only ready FieldView as an exact numeric value", () => {
    const ready = readyField("UI_CAPITAL", "0", "0")
    const missing = unavailableField("UI_UNAVAILABLE", "Unavailable")
    const loading = loadingField("UI_EVENTS_LOADING", "Loading events")
    const stale = staleField("UI_QUOTE_STALE", "Quote is stale")
    const broken = errorField("UI_EVENTS_ERROR", "Events unavailable")
    const stuffed = stuffedZero("loading", "Unavailable")
    expect(isReadyField(ready)).toBe(true)
    expect(readyExact(ready)).toBe("0")
    expect(exactBigint(ready)).toBe(0n)
    expect(missing.key).toBe("UI_UNAVAILABLE")
    expect(exactBigint(missing)).toBeUndefined()
    expect(exactBigint(loading)).toBeUndefined()
    expect(exactBigint(stale)).toBeUndefined()
    expect(exactBigint(broken)).toBeUndefined()
    expect(exactBigint(stuffed)).toBeUndefined()
    expect(isReadyField(stuffed)).toBe(false)
    expect((FIELD_KINDS as readonly string[]).includes("pending")).toBe(false)
    expect((FIELD_KINDS as readonly string[]).includes("confirmed")).toBe(false)
    expect(reviewTxn().kind).toBe("review")
  })

  it("value renderers do not use exact zero for non-ready fields", () => {
    const readyZero = readyField("UI_CAPITAL", "0", "0")
    const cases: readonly FieldView[] = [
      stuffedZero("unavailable", "Unavailable"),
      stuffedZero("loading", "Loading events"),
      stuffedZero("stale", "Quote is stale"),
      stuffedZero("error", "Events unavailable"),
    ]
    const readyHtml = markup(createElement(FieldValue, { field: readyZero }))
    expect(readyHtml.includes('title="0"')).toBe(true)
    expect(readyHtml.includes(">0<")).toBe(true)
    for (const field of cases) {
      const value = markup(createElement(FieldValue, { field }))
      const row = markup(createElement(ValueRow, { label: "Capital", labelKey: "UI_CAPITAL", field }))
      const fact = markup(createElement(FactRow, { label: "Capital", labelKey: "UI_CAPITAL", field }))
      const meter = markup(
        createElement(ProgressMeter, {
          label: "Coverage",
          labelKey: "UI_PAYROLL_COVERAGE",
          valueBps: 0n,
          maxBps: 100n,
          field,
        }),
      )
      const stat = markup(
        createElement(StatRow, {
          row: { id: "population", key: "UI_POPULATION", label: "Population", field, tone: "ok" },
        }),
      )
      for (const html of [value, row, fact, meter, stat]) {
        expect(html.includes('title="0"')).toBe(false)
        expect(html.includes('aria-valuenow="0"')).toBe(false)
        expect(html.includes(`data-field-kind="${field.kind}"`)).toBe(true)
        expect(html.includes(field.text)).toBe(true)
      }
    }
  })

  it("keeps StatusChip loading/stale/error distinct from unavailable", () => {
    const stale = markup(
      createElement(StatusChip, { label: "Quote is stale", labelKey: "UI_QUOTE_STALE", kind: "stale" }),
    )
    expect(stale.includes("Quote is stale")).toBe(true)
    expect(stale.includes('data-kind="stale"')).toBe(true)
    expect(stale.includes('data-state="stale"')).toBe(true)
    expect(stale.includes("hud-chip--stale")).toBe(true)
    expect(stale.includes('data-kind="unavailable"')).toBe(false)
    expect(stale.includes("hud-chip--unavailable")).toBe(false)

    const loading = markup(
      createElement(StatusChip, { label: "Loading events", labelKey: "UI_EVENTS_LOADING", kind: "loading" }),
    )
    expect(loading.includes('data-kind="loading"')).toBe(true)
    expect(loading.includes("hud-chip--loading")).toBe(true)
    expect(loading.includes('data-kind="unavailable"')).toBe(false)

    const broken = markup(
      createElement(StatusChip, { label: "Events unavailable", labelKey: "UI_EVENTS_ERROR", kind: "error" }),
    )
    expect(broken.includes('data-kind="error"')).toBe(true)
    expect(broken.includes("hud-chip--error")).toBe(true)
    expect(broken.includes('data-kind="unavailable"')).toBe(false)

    const missing = markup(
      createElement(StatusChip, { label: "Unavailable", labelKey: "UI_UNAVAILABLE", kind: "unavailable" }),
    )
    expect(missing.includes('data-kind="unavailable"')).toBe(true)
    expect(missing.includes("hud-chip--unavailable")).toBe(true)
  })

  it("does not treat a missing payroll request as PAYROLL_TRIMMED", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const cut = pack.bps === 0n ? 0n : pack.bps - 1n
    const args = { pack, strings, nowMs: 0n, firstLoginMs: 0n, demo: true }
    const missingReq = buildHud({
      ...args,
      snapshot: { ...emptySnapshot(), payrollRatioBps: cut },
    })
    expect(missingReq.payroll).toBeUndefined()
    const zeroReq = buildHud({
      ...args,
      snapshot: { ...emptySnapshot(), payrollRequested: 0n, payrollRatioBps: cut },
    })
    expect(zeroReq.payroll).toBeUndefined()
    const trimmed = buildHud({
      ...args,
      snapshot: { ...emptySnapshot(), payrollRequested: 1n, payrollRatioBps: cut, payrollPaid: 0n },
    })
    expect(trimmed.payroll?.key).toBe("PAYROLL_TRIMMED")
  })

  it("keeps EventsView rows on the snapshot log shape", () => {
    const row: EventRowView = {
      id: "1",
      key: "PAYROLL_TRIMMED",
      text: "trimmed",
      badgeKey: "UI_ATTEST_LOGGED",
      badgeText: "",
      root: "root",
      cid: "cid",
    }
    expect(Object.keys(row).sort()).toEqual(["badgeKey", "badgeText", "cid", "id", "key", "root", "text"])
    expect("timestamp" in row).toBe(false)
    expect("entity" in row).toBe(false)
    expect("proof" in row).toBe(false)
    expect(emptySnapshot().log).toBeUndefined()
  })

  it("keeps live adapter intent contracts without new routes", () => {
    expect(transportOf("hire")).toBe("live")
    expect(transportOf("deposit")).toBe("refusal-only")
    expect(transportOf("research_start")).toBe("unsupported")
    expect(transportOf("navigate")).toBe("local")
  })

  it("function strip does not substitute zero for unavailable functions", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const view = buildHud({
      pack,
      strings,
      snapshot: emptySnapshot(),
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: true,
    })
    expect(view.shell.functions.kind).toBe("unavailable")
    const html = markup(
      createElement(FunctionStrip, {
        view,
        pack,
        onSelectBuilding: () => {},
      }),
    )
    expect(html.includes("hud-unavailable")).toBe(true)
    expect(html.includes("hud-functions__n")).toBe(false)
    expect(html.includes(`/${view.shell.catalogSize.toString()}`)).toBe(false)
    expect(html.includes(">0<")).toBe(false)
  })

  it("recent activity default presents at most three event rows", () => {
    expect(RECENT_ACTIVITY_DEFAULT_ROWS).toBe(3)
    expect(islandChromeVisible(true)).toBe(false)
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const view = buildHud({
      pack,
      strings,
      snapshot: {
        ...emptySnapshot(),
        log: [
          { id: "1", key: "IDLE_NO_ENERGY", badge: "logged", root: "", cid: "" },
          { id: "2", key: "IDLE_NO_COMPUTE", badge: "logged", root: "", cid: "" },
          { id: "3", key: "API_PACK_STALE", badge: "logged", root: "", cid: "" },
          { id: "4", key: "PAYROLL_TRIMMED", badge: "logged", root: "", cid: "" },
          { id: "5", key: "IDLE_NO_AGENT", badge: "logged", root: "", cid: "" },
        ],
      },
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: true,
    })
    expect(view.shell.events.kind).toBe("ready")
    expect(view.shell.events.rows.length > RECENT_ACTIVITY_DEFAULT_ROWS).toBe(true)
    const html = markup(
      createElement(RecentActivity, {
        view,
        strings,
        extra: [],
        openId: "",
        onBadge: () => {},
        onViewAll: () => {},
      }),
    )
    expect((html.match(/class="hud-event(?: |")/g) ?? []).length).toBe(RECENT_ACTIVITY_DEFAULT_ROWS)
    expect(html.includes("hud-activity")).toBe(true)
  })

  it("expands BANK_CLOSED journal copy instead of leaving {opens_in}", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const strings = loadStringTable(readJson("content/strings/en.json"))
    expect(strings["BANK_CLOSED"]?.includes("{opens_in}")).toBe(true)
    const view = buildHud({
      pack,
      strings,
      snapshot: {
        ...emptySnapshot(),
        log: [{ id: "bank-closed", key: "BANK_CLOSED", badge: "logged", root: "", cid: "" }],
      },
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: true,
    })
    const row = view.log[0]
    expect(row?.key).toBe("BANK_CLOSED")
    expect(row?.text.includes("{opens_in}")).toBe(false)
    expect(row?.text).not.toBe(strings["BANK_CLOSED"])
    expect(/opens in \d+h city time/.test(row?.text ?? "")).toBe(true)
    expect(view.plaque.text.includes("{opens_in}")).toBe(false)
    if (view.shell.events.kind === "ready") {
      const event = view.shell.events.rows.find((item) => item.key === "BANK_CLOSED")
      expect(event?.text.includes("{opens_in}")).toBe(false)
    }
  })
})
