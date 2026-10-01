import { describe, expect, it } from "vitest"
import { parseJson, fromUtf8 } from "@corporator/contentpack"
import { readyTemplate } from "@corporator/protocol"
import {
  ageAlertFiresBeforeDecay,
  exportLive,
  observeFromState,
} from "../src/metrics.ts"
import { asBigint, asObj, asText, walk } from "../src/values.ts"
import { bootHost } from "./harness.ts"

describe.sequential("P6 construction", () => {
  it("metric_observed_is_measured", async () => {
    const host = await bootHost()
    const observed = observeFromState(host.ctx, host.state)
    const live = exportLive(host.ctx, observed)
    expect(live.length === 0).toBe(false)
    for (const row of live) {
      expect(row.observeSrc === row.thresholdSrc).toBe(false)
      expect(row.observed === row.threshold).toBe(false)
      expect(row.alertChannel).toBe("ops_log")
    }
    const res = await host.handle("GET", readyTemplate, new Uint8Array())
    expect(Number(res.status)).toBe(200)
    const body = asObj(parseJson(fromUtf8(res.body)))
    const exported = body["metrics"]
    expect(Array.isArray(exported)).toBe(true)
    if (!Array.isArray(exported)) return
    expect(exported.length).toBe(live.length)
  })

  it("alert_fires_before_decay_cuts_rate", async () => {
    const host = await bootHost()
    const stale = asBigint(walk(host.ctx.pack, ["sections", "economy", "params", "price_staleness_max_city_hours", "v"]))
    const alert = asBigint(walk(host.ctx.pack, ["generated", "arch", "sampler_age_alert_city_hours"]))
    expect(alert < stale).toBe(true)
    expect(ageAlertFiresBeforeDecay(alert, alert, stale)).toBe(true)
    expect(ageAlertFiresBeforeDecay(stale, alert, stale)).toBe(false)
  })

  it("incident_has_runbook_and_code", async () => {
    const host = await bootHost()
    const incidents = asObj(walk(host.ctx.pack, ["sections", "arch", "incidents"]))
    const codes = asObj(walk(host.ctx.pack, ["sections", "codes", "codes"]))
    const want = [
      "rpc_silence",
      "stale_sample",
      "attest_lag",
      "ipfs_pin_fail",
      "uncovered_claim",
      "signer_compromise",
    ]
    for (const id of want) {
      const row = asObj(incidents[id] ?? null)
      const code = asText(row["code"])
      expect(code.length === 0).toBe(false)
      expect(codes[code] === undefined).toBe(false)
      expect(asText(row["runbook"])).toBe(id)
      expect(asText(row["sign"]).length === 0).toBe(false)
    }
  })
})
