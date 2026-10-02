import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { bankOpen, cityClock } from "@corporator/engine"
import { commandTemplate, codes, listenBind, stateTemplate } from "@corporator/protocol"
import {
  applyPath,
  createLiveAdapter,
  emptySnapshot,
  loadClientPack,
  loadStringTable,
  snapshotFromEnvelope,
  type LiveAdapterResult,
} from "../src/index.ts"
import { fromUtf8, loadPack, parseJson, type Json } from "@corporator/contentpack"
import { BankScreen } from "../src/hud/screens/bank.tsx"
import { buildHud } from "../src/hud/model.ts"
import type { ScreenProps } from "../src/hud/parts/ScreenFrame.tsx"
import { asBigint, asEngineDict, asText, bootHostOn, makeInputs, openPglite } from "../../../services/api/test/harness.ts"
import { putJson } from "../../../services/api/src/store.ts"
import { listenApi } from "../../../services/api/src/listen.ts"
import { walk } from "../../../services/api/src/values.ts"

const closers: { close(): Promise<void> }[] = []
const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

afterEach(async () => {
  while (closers.length > 0) {
    const row = closers.pop()
    if (row === undefined) continue
    await row.close()
  }
})

function origin(port: bigint): string {
  return "http://" + listenBind + ":" + port.toString()
}

function cityOf(host: Awaited<ReturnType<typeof bootHostOn>>) {
  return asEngineDict(asEngineDict(host.state["cities"])["a"])
}

function constructionOf(host: Awaited<ReturnType<typeof bootHostOn>>, buildingId: string): bigint {
  const rows = cityOf(host)["functions"]
  if (!Array.isArray(rows)) return 0n
  for (const item of rows) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as { readonly [key: string]: unknown }
    if (asText(row["id"]) !== buildingId) continue
    return asBigint(row["construction"])
  }
  return 0n
}

/** A control with no live wire must not render as an armed button. */
function buttonVerdict(tag: string): "live" | "blocked" | "dead" {
  const disabled = tag.includes("disabled")
  const code = /data-blocked-code="([^"]*)"/.exec(tag)?.[1] ?? ""
  const intent = /data-intent="([^"]+)"/.exec(tag)?.[1] ?? ""
  const action = /data-action="([^"]+)"/.exec(tag)?.[1] ?? ""
  if (disabled) return code.length > 0 ? "blocked" : "dead"
  if (intent.length > 0 || action.length > 0) return "live"
  return "dead"
}

describe("W25 HUD sees the walk", () => {
  it("hud walk matches the city capital after each command", async () => {
    const host = await bootHostOn(await openPglite())
    const city = cityOf(host)
    city["account_kind"] = "wallet"
    city["demo"] = 0n
    const sessionId = "w25-hud"
    const expires = asBigint(host.state["city_time"]) + 10_000n
    await putJson(
      host.store,
      "sessions",
      sessionId,
      { kind: "session", city_id: "a", account_kind: "wallet", expires_city_time: expires.toString() },
      "wallet",
    )
    const api = await listenApi(host, 0n)
    closers.push(api)
    const base = origin(api.port)
    let seq = 0n
    const adapter = createLiveAdapter({
      origin: base,
      cityId: "a",
      sessionId,
      commandTemplate,
      post: async (url, body, headers) => {
        const res = await fetch(url, { method: "POST", body, headers: { ...headers } })
        return { status: res.status, body: new Uint8Array(await res.arrayBuffer()) }
      },
      cityTime: () => asBigint(host.state["city_time"]),
      nextSeq: () => {
        seq += 1n
        return seq
      },
      fetchSnapshot: async () => {
        const headers: { [name: string]: string } = { authorization: "Bearer " + sessionId }
        const res = await fetch(base + applyPath(stateTemplate, "city_id", "a"), { headers })
        if (!res.ok) throw new Error(codes.API_PACK_STALE)
        return snapshotFromEnvelope(parseJson(fromUtf8(new Uint8Array(await res.arrayBuffer()))))
      },
    })

    function same(step: string, result: LiveAdapterResult): void {
      expect(result.kind, step).toBe("applied")
      if (result.kind !== "applied") return
      expect(result.snapshot.capital, step).toBe(asBigint(cityOf(host)["capital"]))
    }

    const wei = asBigint(host.ctx.cfg["wei"])
    cityOf(host)["corp_held"] = wei * 20_000_000n
    same(
      "deposit",
      await adapter.dispatch({ kind: "deposit", amount: (wei * 20_000_000n).toString() }),
    )
    same("hire", await adapter.dispatch({ kind: "hire", role: "engineer" }))
    same("workshop", await adapter.dispatch({ kind: "build", buildingId: "workshop" }))
    const locked = await adapter.dispatch({ kind: "build", buildingId: "energy_plant" })
    expect(locked.kind).toBe("failed")
    if (locked.kind === "failed") expect(locked.code).toBe(codes.DISTRICT_LOCKED)
    const need = asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "s_min", "TSLA", "v"]))
    const held = asEngineDict(cityOf(host)["tokens_held"])
    held["TSLA"] = need
    cityOf(host)["tokens_held"] = held
    same(
      "stake",
      await adapter.dispatch(
        { kind: "stake", districtId: "energy", amount: need.toString() },
        { source: "ledger" },
      ),
    )
    same("open", await adapter.dispatch({ kind: "open_district", districtId: "energy" }))
    same("energy", await adapter.dispatch({ kind: "build", buildingId: "energy_plant" }))

    let cursor = asBigint(host.state["tick_index"])
    let stepped = false
    async function step(): Promise<void> {
      const index = stepped ? cursor + 1n : cursor
      await host.stepTick(makeInputs(host.ctx.cfg, index))
      cursor = asBigint(host.state["tick_index"])
      stepped = true
    }
    let guard = 0
    while (constructionOf(host, "workshop") > 0n && guard < 64) {
      await step()
      guard += 1
    }
    same(
      "assign",
      await adapter.dispatch({ kind: "assign", agentId: "h1", buildingId: "workshop" }),
    )
    guard = 0
    while (guard < 400) {
      const clock = cityClock(host.ctx.cfg, asBigint(host.state["tick_index"]))
      const sunday = clock[2] === asBigint(host.ctx.cfg["bank_closed_weekday"])
      if (!sunday && bankOpen(host.ctx.cfg, clock[1], clock[2]) !== 0n) break
      await step()
      guard += 1
    }
    const withdrawn = await adapter.dispatch({ kind: "withdraw", amount: "1" })
    same("withdraw", withdrawn)
    if (withdrawn.kind !== "applied") return
    const presented = await adapter.dispatch(
      { kind: "present_voucher" },
      { voucher_id: withdrawn.intentId },
    )
    same("present", presented)
    const again = await adapter.dispatch({ kind: "present_voucher" }, { voucher_id: withdrawn.intentId })
    same("present-again", again)
    if (presented.kind === "applied" && again.kind === "applied") {
      expect(again.snapshot.capital).toBe(presented.snapshot.capital)
      expect(again.snapshot.corp).toBe(presented.snapshot.corp)
    }
  })

  it("an unwired present control stays disabled", () => {
    const pack = loadClientPack(loadPack(new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))).pack)
    const strings = loadStringTable(parseJson(readFileSync(join(repo, "content/strings/en.json"), "utf8")) as Json)
    const snap = {
      ...emptySnapshot(),
      accountKind: "wallet" as const,
      capital: 100000n,
      corp: 5n,
      cityLevel: 4n,
    }
    const props: ScreenProps = {
      view: buildHud({ pack, strings, snapshot: snap, nowMs: 0n, firstLoginMs: 0n, demo: false }),
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
    }
    const html = renderToStaticMarkup(createElement(BankScreen, { ...props, startTab: "withdraw" }))
    const tag = /<button\b[^>]*data-intent="present_voucher"[^>]*>/.exec(html)?.[0] ?? ""
    expect(tag.length > 0).toBe(true)
    expect(buttonVerdict(tag)).toBe("blocked")
    const armed = tag.replace(/\sdisabled(?:=(?:"[^"]*"|'[^']*'))?/g, "")
    expect(buttonVerdict(armed)).toBe("live")
    expect(buttonVerdict(tag)).toBe("blocked")
  })
})
