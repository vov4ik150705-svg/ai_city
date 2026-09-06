import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseJsonBigint } from "./jsonBigint.ts"
import {
  canonical,
  encodeHeader,
  encodeRecord,
  hexToBytes,
  leafPrefixes,
  merkleRoot,
  spawnCity,
  tick,
  tickHeader,
} from "../src/index.ts"
import { asBig, asDict, asStr } from "../src/values.ts"
import type { Dict } from "../src/values.ts"

export const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

export function loadPack(): Dict {
  const raw = readFileSync(join(repo, "content/out/pack.json"), "utf8")
  return asDict(parseJsonBigint(raw))
}

export function propertyRuns(pack: Dict): number {
  const arch = asDict(asDict(pack["sections"])["arch"])
  const params = asDict(arch["params"])
  const row = asDict(params["property_runs"])
  return Number(asBig(row["v"]))
}

export function loadVector(id: string): Dict {
  return JSON.parse(readFileSync(join(repo, "content/out/vectors", `${id}.json`), "utf8")) as Dict
}

export function fromHex(hex: string): Uint8Array {
  return hexToBytes(hex)
}

export function cloneDict(value: Dict): Dict {
  return structuredClone(value)
}

export function makeInputs(cfg: Dict, tickIndex: bigint, extra: Dict = {}): Dict {
  const length = asBig(cfg["tick_length_city_hours"])
  return {
    tick_index: tickIndex,
    city_time: asBig(cfg["anchor_hour"]) + tickIndex * length,
    eth_usd_8dec: asBig(cfg["eth_usd_8dec"]),
    corp_eth_wei_per_whole: asBig(cfg["seed_corp_wei"]),
    feed_live: 1n,
    pack_hash: asStr(cfg["pack_hash"]),
    dex_turnover_usd_8dec: 0n,
    ...extra,
  }
}

export function armFund(state: Dict, cfg: Dict, units: bigint = 2000n): void {
  const ticks = asBig(cfg["ticks_day"])
  const div = asBig(cfg["payroll_daily_divisor"])
  state["fund"] = units * div * ticks
  state["day_budget"] = div === 0n ? 0n : asBig(state["fund"]) / div
  state["tick_budget"] = ticks === 0n ? 0n : asBig(state["day_budget"]) / ticks
  state["day_budget_day"] = asBig(cfg["anchor_day"])
}

export function liveCity(cfg: Dict, pack: Dict, cityId: string = "a"): Dict {
  const spec = asDict(asDict(asDict(asDict(pack["sections"])["sim"])["archetypes"])["minimalist"])
  const city = spawnCity(cfg, "minimalist", spec, cityId, 1n, 0n)
  city["login_period"] = 1n
  city["output_base"] = 100n
  return city
}

export function sampleRecord(cfg: Dict): Dict {
  const bps = asBig(cfg["bps"])
  return {
    layout_version: asBig(cfg["layout_version"]),
    city_id: "c1",
    tick_index: 0n,
    city_time: 12n,
    agent_id: "shift",
    building_id: "",
    objective: "",
    inputs: { compute: 0n, energy: 0n, materials: 0n },
    district_efficiency_bps: bps,
    seed: "00",
    output: 1n,
    payroll_ratio_bps: bps,
    status: "paid",
    reason: "",
    fragments_delta: 0n,
    stage_bps: { base: bps, post: bps },
  }
}

export function sampleHeader(cfg: Dict): Dict {
  return {
    layout_version: asBig(cfg["layout_version"]),
    city_id: "c1",
    tick_index: 0n,
    city_time: 12n,
    pack_hash: "ab",
    corp_eth_wei_per_whole: 0n,
    eth_usd_8dec: 0n,
    feed_live: 1n,
    dex_turnover_usd_8dec: 0n,
    price_sample_city_time: 12n,
    companion_commands_hash: "cd",
    prev_state_hash: "",
    stake_snapshot: 0n,
  }
}

export function stateSlice(state: Dict): Dict {
  return {
    tick_index: asBig(state["tick_index"]),
    city_time: asBig(state["city_time"]),
    payroll_ratio_bps: asBig(state["payroll_ratio_bps"]),
    mint_rate: asBig(state["mint_rate"]),
    codes: asListStr(state["codes"]),
    hour: asBig(state["hour"]),
  }
}

function asListStr(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((x) => String(x))
}

export function runTickVector(
  cfg: Dict,
  state: Dict,
  inputs: Dict,
): { header: Uint8Array; records: Uint8Array[]; leaves: Uint8Array[]; root: Uint8Array; slice: Uint8Array } {
  const stepped = tick(state, inputs)
  const hdr = tickHeader(stepped[0], inputs)
  const recSpec = asDict(cfg["record_spec"])
  const hdrSpec = asDict(cfg["header_spec"])
  const headerBlob = encodeHeader(hdr, hdrSpec)
  const recBlobs = stepped[1].map((r) => encodeRecord(r, recSpec))
  const ordered = [...stepped[1]].sort((a, b) => {
    const aa = asStr(a["agent_id"])
    const bb = asStr(b["agent_id"])
    if (aa < bb) return 0 - 1
    if (aa > bb) return 1
    return 0
  })
  const prefixes = leafPrefixes(cfg)
  const leaves = [headerBlob, ...ordered.map((r) => encodeRecord(r, recSpec))]
  const root = merkleRoot(leaves, prefixes[0], prefixes[1])
  return {
    header: headerBlob,
    records: recBlobs,
    leaves,
    root,
    slice: canonical(stateSlice(stepped[0])),
  }
}

export { asDict, asBig, asStr, canonical }
