import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { bytesEq, loadPack, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import {
  encodeHeader,
  encodeRecord,
  loadConfig,
  newState,
  tick,
  tickHeader,
  type Dict,
} from "@corporator/engine"
import { completeLlm, emptyLlmState, enqueue, loadLlmPack, queueCapacityOk } from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function packDict(pack: Json): Dict {
  if (pack === null || typeof pack !== "object" || Array.isArray(pack)) {
    throw new Error(codes.API_MALFORMED)
  }
  return pack
}

function makeInputs(cfg: Dict, tickIndex: bigint, extra: Dict = {}): Dict {
  const length = cfg["tick_length_city_hours"]
  const hours = typeof length === "bigint" ? length : 0n
  const anchor = cfg["anchor_hour"]
  const start = typeof anchor === "bigint" ? anchor : 0n
  return {
    tick_index: tickIndex,
    city_time: start + tickIndex * hours,
    eth_usd_8dec: cfg["eth_usd_8dec"],
    corp_eth_wei_per_whole: cfg["seed_corp_wei"],
    feed_live: 1n,
    pack_hash: cfg["pack_hash"],
    dex_turnover_usd_8dec: 0n,
    ...extra,
  }
}

function recSpec(cfg: Dict): Dict {
  const spec = cfg["record_spec"]
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) {
    throw new Error(codes.API_MALFORMED)
  }
  return spec
}

function hdrSpec(cfg: Dict): Dict {
  const spec = cfg["header_spec"]
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) {
    throw new Error(codes.API_MALFORMED)
  }
  return spec
}

describe.sequential("C9 construction", () => {
  it("llm_refusal_falls_back_to_template", () => {
    const bytes = packBytes()
    const pack = loadLlmPack(bytes)
    expect(pack.blocksTick).toBe(0n)
    expect(pack.failMode).toBe("open")
    expect(pack.onProviderFail).toBe("template")
    expect(queueCapacityOk(pack)).toBe(true)
    const refused = completeLlm(pack, { ok: false, text: "" })
    expect(refused.template).toBe(true)
    expect(refused.code).toBe(codes.COMPANION_LLM_TEMPLATE)
    expect(refused.text).toBe(pack.templateText)
    const ok = completeLlm(pack, { ok: true, text: "live" })
    expect(ok.template).toBe(false)
    expect(ok.text).toBe("live")
    let state = emptyLlmState()
    let filled = 0n
    while (filled < pack.queueCapacity) {
      const step = enqueue(pack, state)
      expect(step.code).toBe("")
      state = step.next
      filled = filled + 1n
    }
    const full = enqueue(pack, state)
    expect(full.code).toBe(codes.COMPANION_QUEUE_FULL)
    expect(full.next.inFlight).toBe(state.inFlight)
    const loaded = loadPack(bytes)
    const cfg = loadConfig(packDict(loaded.pack))
    const inputs = makeInputs(cfg, 0n)
    const genesis = newState(cfg, {}, {})
    const before = tick(structuredClone(genesis), inputs)
    completeLlm(pack, { ok: false, text: "" })
    const after = tick(structuredClone(genesis), inputs)
    expect(before[1].length).toBe(after[1].length)
    const recs = recSpec(cfg)
    const hdr = hdrSpec(cfg)
    for (let i = 0; i < before[1].length; i += 1) {
      const a = before[1][i]
      const b = after[1][i]
      if (a === undefined || b === undefined) {
        expect.fail("missing record")
        return
      }
      expect(bytesEq(encodeRecord(a, recs), encodeRecord(b, recs))).toBe(true)
    }
    const hA = tickHeader(before[0], inputs)
    const hB = tickHeader(after[0], inputs)
    expect(bytesEq(encodeHeader(hA, hdr), encodeHeader(hB, hdr))).toBe(true)
  })
})
