import { readdirSync } from "node:fs"
import { join } from "node:path"
import * as fc from "fast-check"
import { describe, expect, it } from "vitest"
import {
  bytesToHex,
  canonical,
  catchUp,
  encodeHeader,
  encodeRecord,
  keccak256Hex,
  leafHash,
  leafPrefixes,
  loadConfig,
  merkleRoot,
  newState,
  spawnCity,
  tick,
  agentLevelMultBps,
} from "../src/index.ts"
import { asBig, asDict, asStr, bytesEq } from "../src/values.ts"
import type { Dict } from "../src/values.ts"
import {
  armFund,
  cloneDict,
  fromHex,
  liveCity,
  loadPack,
  loadVector,
  makeInputs,
  propertyRuns,
  repo,
  runTickVector,
  sampleHeader,
  sampleRecord,
} from "./harness.ts"

function expectHex(got: Uint8Array, hex: string, label: string): void {
  expect(bytesToHex(got), label).toBe(hex)
}

describe.sequential("C1 construction", () => {
  it("layout_v1_bytes", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const recSpec = asDict(cfg["record_spec"])
    const hdrSpec = asDict(cfg["header_spec"])
    const files = readdirSync(join(repo, "content/out/vectors")).filter((n) => n.endsWith(".json"))
    expect(files.length).toBeGreaterThan(0)

    const emptyState = newState(cfg, {}, {})
    const emptyGot = runTickVector(cfg, emptyState, makeInputs(cfg, 0n))
    const emptyWant = loadVector("empty_tick")
    expectHex(emptyGot.header, asStr(emptyWant["header_hex"]), "empty_tick header")
    expect(emptyGot.records.length).toBe(0)
    expectHex(emptyGot.root, asStr(emptyWant["root_hex"]), "empty_tick root")
    expectHex(emptyGot.slice, asStr(emptyWant["state_slice_hex"]), "empty_tick slice")

    const spec = asDict(asDict(asDict(asDict(pack["sections"])["sim"])["archetypes"])["minimalist"])
    const a = spawnCity(cfg, "minimalist", spec, "a", 1n, 0n)
    const b = spawnCity(cfg, "minimalist", spec, "b", 1n, 0n)
    a["login_period"] = 1n
    b["login_period"] = 1n
    a["output_base"] = 300n
    b["output_base"] = 100n
    const payState = newState(cfg, { a, b }, {})
    armFund(payState, cfg, 200n)
    payState["day_budget_day"] = null
    const payGot = runTickVector(cfg, payState, makeInputs(cfg, 0n))
    const payWant = loadVector("payroll_trim")
    expectHex(payGot.header, asStr(payWant["header_hex"]), "payroll_trim header")
    const payRecs = payWant["records_hex"]
    expect(Array.isArray(payRecs)).toBe(true)
    const payRecList = payRecs as string[]
    expect(payGot.records.length).toBe(payRecList.length)
    for (let i = 0; i < payGot.records.length; i++) {
      const blob = payGot.records[i]
      const want = payRecList[i]
      if (blob === undefined || want === undefined) continue
      expectHex(blob, want, `payroll_trim rec ${String(i)}`)
    }
    expectHex(payGot.root, asStr(payWant["root_hex"]), "payroll_trim root")

    const dayCity = liveCity(cfg, pack)
    const dayState = newState(cfg, { a: dayCity }, {})
    armFund(dayState, cfg)
    dayState["day_budget_day"] = null
    let idx0 = asBig(cfg["ticks_day"]) - asBig(cfg["anchor_hour"])
    if (idx0 <= 0n) idx0 = asBig(cfg["ticks_day"])
    const dayGot = runTickVector(cfg, dayState, makeInputs(cfg, idx0))
    const dayWant = loadVector("day_boundary")
    expectHex(dayGot.header, asStr(dayWant["header_hex"]), "day_boundary header")
    expectHex(dayGot.root, asStr(dayWant["root_hex"]), "day_boundary root")

    const deadCity = liveCity(cfg, pack)
    const deadState = newState(cfg, { a: deadCity }, {})
    armFund(deadState, cfg)
    const deadGot = runTickVector(
      cfg,
      deadState,
      makeInputs(cfg, 0n, { feed_live: 0n, corp_eth_wei_per_whole: 0n }),
    )
    const deadWant = loadVector("feed_dead")
    expectHex(deadGot.header, asStr(deadWant["header_hex"]), "feed_dead header")
    expectHex(deadGot.root, asStr(deadWant["root_hex"]), "feed_dead root")

    const stackCity = liveCity(cfg, pack)
    stackCity["nodes"] = [{ key: "output_bps", magnitude: 250n, id: "c0_stack" }]
    const stackState = newState(cfg, { a: stackCity }, {})
    armFund(stackState, cfg)
    const stackGot = runTickVector(cfg, stackState, makeInputs(cfg, 0n))
    const stackWant = loadVector("stack_nonempty")
    expectHex(stackGot.header, asStr(stackWant["header_hex"]), "stack_nonempty header")
    expectHex(stackGot.root, asStr(stackWant["root_hex"]), "stack_nonempty root")
    const stackRecs = stackWant["records_hex"] as string[]
    const stack0 = stackGot.records[0]
    const stackWant0 = stackRecs[0]
    if (stack0 !== undefined && stackWant0 !== undefined) {
      expectHex(stack0, stackWant0, "stack_nonempty rec0")
    }

    const cyrCity = liveCity(cfg, pack, "город-1")
    cyrCity["objective"] = "смена"
    cyrCity["building_id"] = ""
    const cyrState = newState(cfg, { "город-1": cyrCity }, {})
    armFund(cyrState, cfg)
    const cyrGot = runTickVector(cfg, cyrState, makeInputs(cfg, 0n, { city_id: "город-1" }))
    const cyrWant = loadVector("cyrillic")
    expectHex(cyrGot.header, asStr(cyrWant["header_hex"]), "cyrillic header")
    expectHex(cyrGot.root, asStr(cyrWant["root_hex"]), "cyrillic root")

    const over = 2n ** 53n + 3n
    const bigRec = sampleRecord(cfg)
    bigRec["reason"] = ""
    bigRec["status"] = "paid"
    bigRec["output"] = over
    bigRec["agent_id"] = "big"
    const bigHdr = sampleHeader(cfg)
    bigHdr["corp_eth_wei_per_whole"] = over
    bigHdr["stake_snapshot"] = over
    bigHdr["pack_hash"] = asStr(cfg["pack_hash"])
    const overWant = loadVector("over_2_53")
    expectHex(encodeHeader(bigHdr, hdrSpec), asStr(overWant["header_hex"]), "over_2_53 header")
    const overRecs = overWant["records_hex"] as string[]
    const overRec0 = overRecs[0]
    if (overRec0 !== undefined) {
      expectHex(encodeRecord(bigRec, recSpec), overRec0, "over_2_53 rec")
    }

    const edgeRec = sampleRecord(cfg)
    edgeRec["reason"] = ""
    edgeRec["status"] = "paid"
    edgeRec["output"] = 0n
    edgeRec["building_id"] = ""
    edgeRec["fragments_delta"] = 0n
    const edgeHdr = sampleHeader(cfg)
    edgeHdr["pack_hash"] = asStr(cfg["pack_hash"])
    const edgeWant = loadVector("layout_v1_edge")
    expectHex(encodeHeader(edgeHdr, hdrSpec), asStr(edgeWant["header_hex"]), "layout_v1_edge header")
    const edgeRecs = edgeWant["records_hex"] as string[]
    const edgeRec0 = edgeRecs[0]
    if (edgeRec0 !== undefined) {
      expectHex(encodeRecord(edgeRec, recSpec), edgeRec0, "layout_v1_edge rec")
    }

    const keccakWant = loadVector("keccak_l202")
    const keccakRows = JSON.parse(
      new TextDecoder().decode(fromHex(asStr(keccakWant["vectors_hex"]))),
    ) as { input_hex: string; digest_hex: string }[]
    for (const row of keccakRows) {
      const digest = keccak256Hex(fromHex(row.input_hex))
      expect(digest, `keccak ${row.input_hex.slice(0, 8)}`).toBe(row.digest_hex)
    }

    const prefixes = leafPrefixes(cfg)
    const one = [new TextEncoder().encode("one-leaf")]
    const odd = [
      new TextEncoder().encode("odd-0"),
      new TextEncoder().encode("odd-1"),
      new TextEncoder().encode("odd-2"),
    ]
    const recA = sampleRecord(cfg)
    recA["reason"] = ""
    recA["status"] = "paid"
    recA["agent_id"] = "b"
    const recB = sampleRecord(cfg)
    recB["reason"] = ""
    recB["status"] = "paid"
    recB["agent_id"] = "a"
    const sortedRecs = [recA, recB].sort((x, y) => {
      const ax = new TextEncoder().encode(asStr(x["agent_id"]))
      const ay = new TextEncoder().encode(asStr(y["agent_id"]))
      const n = ax.length < ay.length ? ax.length : ay.length
      for (let i = 0; i < n; i++) {
        const va = ax[i] ?? 0
        const vb = ay[i] ?? 0
        if (va !== vb) return va < vb ? 0 - 1 : 1
      }
      return ax.length - ay.length
    })
    const merkleBody = {
      one_leaf_root_hex: bytesToHex(merkleRoot(one, prefixes[0], prefixes[1])),
      one_leaf_hash_hex: bytesToHex(leafHash(one[0] ?? new Uint8Array(), prefixes[0])),
      odd_root_hex: bytesToHex(merkleRoot(odd, prefixes[0], prefixes[1])),
      agent_order: sortedRecs.map((r) => asStr(r["agent_id"])),
      order_is_utf8: sortedRecs.map((r) => asStr(r["agent_id"])).join(",") === "a,b" ? 1n : 0n,
    }
    const merkleWant = loadVector("merkle_shapes")
    expectHex(canonical(merkleBody), asStr(merkleWant["body_hex"]), "merkle_shapes")

    const idleLive: { [k: string]: (city: Dict) => void } = {
      IDLE_NO_ENERGY: (city) => {
        city["energy_ok"] = 0n
      },
      IDLE_NO_COMPUTE: (city) => {
        city["compute_stock"] = 0n
        city["compute_draw"] = 1n
      },
      IDLE_OUT_OF_HOURS: (city) => {
        city["schedule"] = "market"
      },
      IDLE_NO_AGENT: (city) => {
        city["output_base"] = 0n
      },
      IDLE_OFFLINE_CAP_REACHED: (city) => {
        city["login_period"] = 20n
      },
      IDLE_BANK_CLOSED: (city) => {
        city["schedule"] = "always"
        city["bank_usage"] = 1n
        city["withdraw_intent"] = 1n
      },
    }
    const idleIdx: { [k: string]: bigint } = {
      IDLE_OUT_OF_HOURS: 16n,
      IDLE_OFFLINE_CAP_REACHED: 13n,
      IDLE_BANK_CLOSED: 16n,
    }
    const craftedIdle: { [k: string]: string } = {
      IDLE_NO_MATERIALS: "idle",
      IDLE_WRONG_ROLE: "idle",
      IDLE_DISTRICT_FROZEN: "idle",
      IDLE_UNDER_CONSTRUCTION: "construction",
    }
    const codes = asDict(asDict(asDict(pack["sections"])["codes"])["codes"])
    for (const cid of Object.keys(codes)) {
      const specCode = asDict(codes[cid])
      if (asStr(specCode["category"]) !== "idle") continue
      const vid = "idle_" + cid.toLowerCase()
      const want = loadVector(vid)
      const mutate = idleLive[cid]
      if (mutate) {
        const city = liveCity(cfg, pack)
        mutate(city)
        const st = newState(cfg, { a: city }, {})
        armFund(st, cfg)
        const tidx = idleIdx[cid] ?? 0n
        const got = runTickVector(cfg, st, makeInputs(cfg, tidx))
        expectHex(got.header, asStr(want["header_hex"]), `${vid} header`)
        expectHex(got.root, asStr(want["root_hex"]), `${vid} root`)
        continue
      }
      const status = craftedIdle[cid] ?? "idle"
      const rec = sampleRecord(cfg)
      rec["reason"] = cid
      rec["status"] = status
      rec["output"] = 0n
      const hdr = sampleHeader(cfg)
      hdr["pack_hash"] = asStr(cfg["pack_hash"])
      expectHex(encodeHeader(hdr, hdrSpec), asStr(want["header_hex"]), `${vid} header`)
      const recs = want["records_hex"] as string[]
      const rec0 = recs[0]
      if (rec0 !== undefined) expectHex(encodeRecord(rec, recSpec), rec0, `${vid} rec`)
    }
  })

  it("catchup_eq_replay", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const length = asBig(cfg["tick_length_city_hours"])
    const cityA = liveCity(cfg, pack)
    const cityB = liveCity(cfg, pack)
    const stateCatch = newState(cfg, { a: cityA }, {})
    const stateReplay = newState(cfg, { a: cityB }, {})
    armFund(stateCatch, cfg)
    armFund(stateReplay, cfg)
    const last = asBig(cfg["anchor_hour"])
    const n = 3n
    const now = last + n * length
    const inputsNow = makeInputs(cfg, n, { city_time: now, tick_index: n })
    const caught = catchUp(stateCatch, inputsNow, last)
    let replay = stateReplay
    const replayRecs: Dict[] = []
    let i = 1n
    while (i <= n) {
      const inp = makeInputs(cfg, i)
      const stepped = tick(replay, inp)
      replay = stepped[0]
      for (const r of stepped[1]) replayRecs.push(r)
      i += 1n
    }
    const recSpec = asDict(cfg["record_spec"])
    const aBytes = caught[1].map((r) => encodeRecord(r, recSpec))
    const bBytes = replayRecs.map((r) => encodeRecord(r, recSpec))
    expect(aBytes.length).toBe(bBytes.length)
    for (let k = 0; k < aBytes.length; k++) {
      const left = aBytes[k]
      const right = bBytes[k]
      if (left === undefined || right === undefined) continue
      expect(bytesEq(left, right), `catchup rec ${String(k)}`).toBe(true)
    }
    expect(asBig(caught[0]["tick_index"])).toBe(asBig(replay["tick_index"]))
    expect(asBig(caught[0]["mint_rate"])).toBe(asBig(replay["mint_rate"]))
  })

  it("tick_deterministic", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const runs = propertyRuns(pack)
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 5n }), (idx) => {
        const c1 = liveCity(cfg, pack)
        const c2 = liveCity(cfg, pack)
        const s1 = newState(cfg, { a: c1 }, {})
        const s2 = newState(cfg, { a: c2 }, {})
        armFund(s1, cfg)
        armFund(s2, cfg)
        const g1 = runTickVector(cfg, s1, makeInputs(cfg, idx))
        const g2 = runTickVector(cfg, s2, makeInputs(cfg, idx))
        expect(bytesEq(g1.header, g2.header)).toBe(true)
        expect(bytesEq(g1.root, g2.root)).toBe(true)
      }),
      { numRuns: runs },
    )
    const slotCity = liveCity(cfg, pack)
    const bps = asBig(cfg["bps"])
    const gain = asBig(cfg["agent_level_gain_bps"])
    const mult = agentLevelMultBps(1n, gain, bps)
    slotCity["functions"] = [
      { id: "workshop", level: 1n },
      { id: "bank", level: 1n },
      { id: "logistics_hub", level: 1n },
      { id: "ai_research_center", level: 1n },
      { id: "city_hall", level: 1n },
    ]
    slotCity["agents"] = [
      { id: "e1", role: "engineer", building_id: "workshop", objective: "produce", level: 1n, xp: 0n, level_mult_bps: mult, traits: [] },
      { id: "t1", role: "trader", building_id: "bank", objective: "desk", level: 1n, xp: 0n, level_mult_bps: mult, traits: [] },
      { id: "l1", role: "logistician", building_id: "logistics_hub", objective: "route", level: 1n, xp: 0n, level_mult_bps: mult, traits: [] },
      { id: "s1", role: "scientist", building_id: "ai_research_center", objective: "train", level: 1n, xp: 0n, level_mult_bps: mult, traits: [] },
      { id: "m1", role: "manager", building_id: "city_hall", objective: "focus", level: 1n, xp: 0n, level_mult_bps: mult, traits: [] },
    ]
    const slotState = newState(cfg, { a: slotCity }, {})
    const replayState = newState(cfg, { a: cloneDict(slotCity) }, {})
    armFund(slotState, cfg)
    armFund(replayState, cfg)
    const slottedTick = tick(slotState, makeInputs(cfg, 0n))
    const replayTick = tick(replayState, makeInputs(cfg, 0n))
    const ids = slottedTick[1].map((rec) => asStr(rec["agent_id"]))
    expect(ids.includes("shift")).toBe(false)
    expect(new Set(ids)).toEqual(new Set(["e1", "t1", "l1", "s1", "m1"]))
    const engRec = slottedTick[1].find((rec) => asStr(rec["agent_id"]) === "e1")
    expect(engRec !== undefined).toBe(true)
    if (engRec !== undefined) {
      expect(asBig(engRec["output"]) > 0n).toBe(true)
      expect(asStr(engRec["reason"])).toBe("")
      expect(asStr(engRec["building_id"])).toBe("workshop")
      expect(bytesToHex(canonical(engRec))).toBe(
        "7b226167656e745f6964223a226531222c226275696c64696e675f6964223a22776f726b73686f70222c22636974795f6964223a2261222c22636974795f74696d65223a31322c2264697374726963745f656666696369656e63795f627073223a31303030302c22667261676d656e74735f64656c7461223a3335363433362c22696e70757473223a7b22636f6d70757465223a302c22656e65726779223a39302c226d6174657269616c73223a307d2c226c61796f75745f76657273696f6e223a312c226f626a656374697665223a2270726f64756365222c226f7574707574223a323030302c22706179726f6c6c5f726174696f5f627073223a3131312c22726561736f6e223a22222c2273656564223a2266613332323534393830336636316236222c2273746167655f627073223a7b2262617365223a31303030302c22706f7374223a31333230307d2c22737461747573223a2270616964222c227469636b5f696e646578223a307d",
      )
    }
    expect(slottedTick[1].length).toBe(replayTick[1].length)
    for (let i = 0; i < slottedTick[1].length; i += 1) {
      const left = slottedTick[1][i]
      const right = replayTick[1][i]
      if (left === undefined || right === undefined) continue
      expect(bytesEq(canonical(left), canonical(right))).toBe(true)
    }
  })

  it("catchup_equals_replay", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const runs = propertyRuns(pack)
    const length = asBig(cfg["tick_length_city_hours"])
    fc.assert(
      fc.property(fc.bigInt({ min: 1n, max: 4n }), (n) => {
        const cityA = liveCity(cfg, pack)
        const cityB = liveCity(cfg, pack)
        const stateCatch = newState(cfg, { a: cityA }, {})
        const stateReplay = newState(cfg, { a: cityB }, {})
        armFund(stateCatch, cfg)
        armFund(stateReplay, cfg)
        const last = asBig(cfg["anchor_hour"])
        const now = last + n * length
        const inputsNow = makeInputs(cfg, n, { city_time: now, tick_index: n })
        const caught = catchUp(cloneDict(stateCatch), inputsNow, last)
        let replay = cloneDict(stateReplay)
        const replayRecs: Dict[] = []
        let i = 1n
        while (i <= n) {
          const stepped = tick(replay, makeInputs(cfg, i))
          replay = stepped[0]
          for (const r of stepped[1]) replayRecs.push(r)
          i += 1n
        }
        const recSpec = asDict(cfg["record_spec"])
        const aBytes = caught[1].map((r) => encodeRecord(r, recSpec))
        const bBytes = replayRecs.map((r) => encodeRecord(r, recSpec))
        expect(aBytes.length).toBe(bBytes.length)
        for (let k = 0; k < aBytes.length; k++) {
          const left = aBytes[k]
          const right = bBytes[k]
          if (left === undefined || right === undefined) continue
          expect(bytesEq(left, right)).toBe(true)
        }
      }),
      { numRuns: runs },
    )
  })

  it("payroll_trim_proportional", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const spec = asDict(asDict(asDict(asDict(pack["sections"])["sim"])["archetypes"])["minimalist"])
    const a = spawnCity(cfg, "minimalist", spec, "a", 1n, 0n)
    const b = spawnCity(cfg, "minimalist", spec, "b", 1n, 0n)
    a["login_period"] = 1n
    b["login_period"] = 1n
    a["output_base"] = 300n
    b["output_base"] = 100n
    const state = newState(cfg, { a, b }, {})
    armFund(state, cfg, 200n)
    state["day_budget_day"] = null
    const stepped = tick(state, makeInputs(cfg, 0n))
    const cities = asDict(stepped[0]["cities"])
    const ca = asDict(cities["a"])
    const cb = asDict(cities["b"])
    const reqA = asBig(ca["request"])
    const reqB = asBig(cb["request"])
    const payA = asBig(ca["payout"])
    const payB = asBig(cb["payout"])
    const total = reqA + reqB
    const budget = asBig(stepped[0]["tick_budget"])
    expect(total > 0n).toBe(true)
    expect(payA).toBe((reqA * budget) / total)
    expect(payB).toBe((reqB * budget) / total)
    expect(payA + payB <= budget).toBe(true)
    expect(payA > 0n && payB > 0n).toBe(true)
  })

  it("no_float_in_bytes", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const state = newState(cfg, { a: liveCity(cfg, pack) }, {})
    armFund(state, cfg)
    const got = runTickVector(cfg, state, makeInputs(cfg, 0n))
    const blobs = [got.header, ...got.records, got.slice]
    for (const blob of blobs) {
      const text = new TextDecoder().decode(blob)
      let inStr = false
      let escape = false
      for (let i = 0; i < text.length; i++) {
        const ch = text[i] ?? ""
        if (inStr) {
          if (escape) escape = false
          else if (ch === "\\") escape = true
          else if (ch === "\"") inStr = false
          continue
        }
        if (ch === "\"") {
          inStr = true
          continue
        }
        expect(ch).not.toBe(".")
      }
    }
  })

  it("record_key_order_irrelevant", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const recSpec = asDict(cfg["record_spec"])
    const rec = sampleRecord(cfg)
    const perm: Dict = {
      stage_bps: rec["stage_bps"] as Dict,
      fragments_delta: rec["fragments_delta"] as bigint,
      reason: rec["reason"] as string,
      status: rec["status"] as string,
      payroll_ratio_bps: rec["payroll_ratio_bps"] as bigint,
      output: rec["output"] as bigint,
      seed: rec["seed"] as string,
      district_efficiency_bps: rec["district_efficiency_bps"] as bigint,
      inputs: rec["inputs"] as Dict,
      objective: rec["objective"] as string,
      building_id: rec["building_id"] as string,
      agent_id: rec["agent_id"] as string,
      city_time: rec["city_time"] as bigint,
      tick_index: rec["tick_index"] as bigint,
      city_id: rec["city_id"] as string,
      layout_version: rec["layout_version"] as bigint,
    }
    expect(bytesEq(encodeRecord(rec, recSpec), encodeRecord(perm, recSpec))).toBe(true)
  })

  it("merkle_odd_level_not_duplicated", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const prefixes = leafPrefixes(cfg)
    const three = [
      new TextEncoder().encode("a"),
      new TextEncoder().encode("b"),
      new TextEncoder().encode("c"),
    ]
    const four = [
      new TextEncoder().encode("a"),
      new TextEncoder().encode("b"),
      new TextEncoder().encode("c"),
      new TextEncoder().encode("c"),
    ]
    const r3 = merkleRoot(three, prefixes[0], prefixes[1])
    const r4 = merkleRoot(four, prefixes[0], prefixes[1])
    expect(bytesEq(r3, r4)).toBe(false)
    expect(bytesEq(r3, leafHash(three[0] ?? new Uint8Array(), prefixes[0]))).toBe(false)
    const one = [new TextEncoder().encode("one-leaf")]
    expect(bytesEq(merkleRoot(one, prefixes[0], prefixes[1]), leafHash(one[0] ?? new Uint8Array(), prefixes[0]))).toBe(
      true,
    )
  })
})
