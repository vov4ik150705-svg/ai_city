import { readFileSync, writeFileSync } from "node:fs"
import { describe, expect, it, afterAll } from "vitest"
import { loadConfig, newState, mintFromBacking, tick } from "../../../packages/engine/src/index.ts"
import { collectRequests, applySpend } from "../../../packages/engine/src/economy.ts"
import { applyRatchet } from "../../../packages/engine/src/arith.ts"
import { loadPack, liveCity } from "../../../packages/engine/test/harness.ts"
import { asBig, asDict } from "../../../packages/engine/src/values.ts"
import { makeCtx } from "../../../services/api/src/pack_ctx.ts"
import { loadPack as loadPackBytes, fromUtf8, parseJson, canonical } from "../../../packages/contentpack/src/index.ts"
import { applyWithdraw } from "../../../services/api/src/commit_bank.ts"
import { createCollectorSource } from "../../../services/buyback/src/collect.ts"
import { loadBuybackPack } from "../../../services/buyback/src/pack.ts"
import { emptyConveyorState, runStockConveyor } from "../../../services/buyback/src/conveyor.ts"
import { createMockPort } from "../../../packages/chainport/src/index.ts"
import { portCfgFromPack } from "../../../services/api/src/custody.ts"
import { readChainQuote } from "../../../services/sampler/src/chain.ts"
import { keccak256 } from "../../../packages/engine/src/index.ts"
import { catchUpOnce, voucherReconcileDone } from "../../../services/api/src/scheduler.ts"
import { applyLive } from "../../../services/api/src/commit.ts"

const path = "docs/reports/economy-review-2026-10-03/probe-results.json"
const results: Record<string, unknown> = {}
const bytes = new Uint8Array(readFileSync("content/out/pack.json"))
const loaded = loadPackBytes(bytes)
const cfg = loadConfig(loadPack())
afterAll(() => writeFileSync(path, JSON.stringify(results, (_k, v) => typeof v === "bigint" ? v.toString() : v, 2)))

describe("characterization probes; passing means current behavior was reproduced", () => {
  it("hiring needs no Agent Hub and synergy construction needs no open district", async () => {
    const ctx = makeCtx(loaded)
    const city = liveCity(cfg, loadPack(), "a")
    city.account_kind = "wallet"; city.wallet = "0x" + "12".repeat(20)
    city.functions = [{ id: "city_hall", level: 1n }]; city.agents = []
    city.districts = []; city.stake_settled = {}; city.district_freeze_until = {}
    const state = newState(cfg, { a: city }, {})
    city.capital = mintFromBacking(cfg, state, 10_000_000n * 10n ** 18n, 0n, 1n, "a")
    const hired = await applyLive(ctx, state, "hire", { role: "engineer" }, "a")
    const built = await applyLive(ctx, state, "build", { building_id: "robotics_lab" }, "a")
    city.energy_stock = 1_000_000n; city.compute_stock = 1_000_000n
    let requests = 0n
    for (let i = 0; i < 5; i++) requests = collectRequests(cfg, state, 12n, 1n).reduce((s, r) => s + asBig(r.request), 0n)
    results.gates = { hireStatus: hired?.status, synergyBuildStatus: built?.status, noHub: true,
      openedDistricts: city.districts, stakes: city.stake_settled, autonomousRequestAfterConstruction: requests,
      note: "Resource stocks are supplied to isolate the access check; this is not a complete paid progression route." }
    expect(hired?.status).toBe(200n); expect(built?.status).toBe(200n); expect(requests > 0n).toBe(true)
  })
  it("a rate below 50 cannot rise at the configured 2% ratchet", () => {
    let rate = 43n
    for (let i = 0; i < 365; i++) rate = applyRatchet(rate, 510n, 200n, 24n, 24n, 10000n)
    results.ratchet = { start: 43n, target: 510n, after365Days: rate, at49: applyRatchet(49n, 510n, 200n, 24n, 24n, 10000n) }
    expect(rate).toBe(43n)
  })

  it("the withdrawal command succeeds with no Bank and ignores the Trader override", () => {
    const ctx = makeCtx(loaded)
    function run(override?: bigint) {
      const city = liveCity(cfg, loadPack(), "a")
      city.account_kind = "wallet"; city.wallet = "0x" + "12".repeat(20)
      city.functions = [{ id: "city_hall", level: 1n }]
      if (override !== undefined) city.bank_markup_override = override
      const state = newState(cfg, { a: city }, {})
      city.capital = mintFromBacking(cfg, state, 1_000_000n * 10n ** 18n, 0n, 1n, "a")
      const out = applyWithdraw(ctx, state, city, { amount: 1_000_000n, intent_id: "probe" }, "a")
      return { httpStatus: out.status, reply: parseJson(fromUtf8(out.body)), corp: city.corp_held }
    }
    const normal = run(), trader = run(650n)
    results.withdraw = { normal, trader, bankBuilt: false }
    expect(normal.httpStatus).toBe(200n)
    expect(trader.corp).toBe(normal.corp)
  })

  it("the normal collector never buys CORP, and a supplied CORP fill is deposited without mint", async () => {
    const pack = loadBuybackPack(bytes)
    const hopTickers: string[] = []
    const source = createCollectorSource(pack, { hop: async (ticker) => {
      hopTickers.push(ticker); return { hopOk: 1n, stockOut: 100n }
    } })
    const depths = Object.fromEntries(pack.tickers.map(t => [t, 1000n * 10n ** 18n]))
    const demand = Object.fromEntries(pack.tickers.map(t => [t, 1n]))
    const frame = canonical({ city_time: 12n, turnover_wei: 10n ** 18n,
      fund_wei: 10n ** 17n, leaderboard_wei: 10n ** 16n, farm_wei: 10n ** 16n,
      studio_wei: 0n, depths_wei: depths, fragment_demand: demand })
    const got = await source.pull(frame, emptyConveyorState(pack.tickers))
    expect(got.ok).toBe(true)
    expect(hopTickers.includes("CORP")).toBe(false)
    const port = createMockPort(portCfgFromPack(loaded.pack))
    const house = "0x" + "34".repeat(20)
    const old = process.env.CORPORATOR_VAULT_HOUSE
    process.env.CORPORATOR_VAULT_HOUSE = house
    let deposited = 0, minted = 0
    const tapped = { ...port, vault: { ...port.vault,
      deposit: async () => { deposited++; return { ok: true as const } },
      mintCapital: async () => { minted++; return { ok: true as const } },
    } }
    try {
      if (!got.ok) return
      await runStockConveyor(pack, tapped, emptyConveyorState(pack.tickers), {
        ...got.batch, fundCorpOut: 100n, callerService: pack.executorService,
        farmFills: {}, monthFills: {},
      })
    } finally {
      if (old === undefined) delete process.env.CORPORATOR_VAULT_HOUSE
      else process.env.CORPORATOR_VAULT_HOUSE = old
    }
    results.buyback = { hopTickers, corpDepositCalls: deposited, corpMintCalls: minted }
    expect(deposited).toBe(1); expect(minted).toBe(0)
  })

  it("v4 sampling requests v2 events and treats an old Chainlink round as fresh", async () => {
    const word = (v: bigint) => v.toString(16).padStart(64, "0")
    const selector = (s: string) => Array.from(keccak256(new TextEncoder().encode(s))).map(b => b.toString(16).padStart(2,"0")).join("").slice(0,8)
    const calls: unknown[] = []
    const post = async (body: string) => {
      const q = JSON.parse(body); calls.push(q)
      let result: unknown = undefined
      if (q.method === "eth_call") {
        const data = q.params[0].data
        if (data === "0x" + selector("latestRoundData()")) result = "0x" + [1n, 250087000000n, 1n, 1n, 1n].map(word).join("")
        else result = "0x" + word(2n ** 96n * 2n)
      } else if (q.method === "eth_blockNumber") result = "0x10"
      else if (q.method === "eth_getBlockByNumber") result = { timestamp: "0x100" }
      else if (q.method === "eth_getLogs") result = []
      return JSON.stringify({ jsonrpc: "2.0", id: q.id, result })
    }
    const quote = await readChainQuote(post, {
      CORPORATOR_FEED_ETH_USD: "0x" + "11".repeat(20),
      CORPORATOR_POOL_ADDRESS: "0x" + "22".repeat(20),
      CORPORATOR_CORP_TOKEN: "0x" + "33".repeat(20),
      CORPORATOR_POOL_KIND: "v4", CORPORATOR_POOL_ID: "0x" + "44".repeat(32),
    }, 10n ** 18n, 60n)
    const logRequest = calls.find((c: any) => c.method === "eth_getLogs") as any
    results.sampler = { quote, logRequest, chainlinkUpdatedAt: 1, note: "pool address order is not read; corpIsToken0 hardcoded true" }
    expect(quote?.ethUsd8dec).toBe(250087000000n)
    expect(quote?.turnoverUsd8dec).toBe(0n)
    const v2 = "0x" + Array.from(keccak256(new TextEncoder().encode("Swap(address,uint256,uint256,uint256,uint256,address)"))).map(b => b.toString(16).padStart(2,"0")).join("")
    expect(logRequest.params[0].topics).toEqual([v2])
  })

  it("the live building path bypasses the per-city offline window", () => {
    const city = liveCity(cfg, loadPack(), "a")
    city.last_login = 0n; city.login_period = 24n
    city.functions = [{ id: "workshop", level: 1n }]
    city.agents = [{ id: "e", role: "engineer", building_id: "workshop", objective: "produce", level_mult_bps: 10000n, traits: [] }]
    city.energy_stock = 100000n
    const state = newState(cfg, { a: city }, {})
    state.tick_index = 108n; state.city_time = 120n
    const slotted = collectRequests(cfg, state, 16n, 5n).reduce((s, r) => s + asBig(r.request), 0n)
    const syntheticCity = liveCity(cfg, loadPack(), "b")
    syntheticCity.last_login = 0n; syntheticCity.login_period = 24n
    const syntheticState = newState(cfg, { b: syntheticCity }, {})
    syntheticState.tick_index = 108n; syntheticState.city_time = 120n
    const synthetic = collectRequests(cfg, syntheticState, 16n, 5n).reduce((s, r) => s + asBig(r.request), 0n)
    results.offline = { ticksSinceLastLogin: 108n, configuredCap: cfg.offline_cap, slottedRequest: slotted, syntheticRequest: synthetic }
    expect(slotted > 0n).toBe(true); expect(synthetic).toBe(0n)
  })

  it("another player's spent deposit does not become withdrawable backing", async () => {
    const a = "0x" + "12".repeat(20), b = "0x" + "23".repeat(20), house = "0x" + "34".repeat(20)
    const unit = 10n ** 18n
    const port = createMockPort(portCfgFromPack(loaded.pack), { corp: { [a]: 100n * unit, [b]: 10000n * unit }, house })
    const ca = liveCity(cfg, loadPack(), "a"), cb = liveCity(cfg, loadPack(), "b")
    const state = newState(cfg, { a: ca, b: cb }, {})
    ca.capital = mintFromBacking(cfg, state, 100n * unit, 0n, 1n, "a")
    cb.capital = mintFromBacking(cfg, state, 10000n * unit, 0n, 1n, "b")
    await port.vault.deposit(a, 100n * unit); await port.vault.mintCapital(a, 100n * unit, asBig(ca.capital))
    await port.vault.deposit(b, 10000n * unit); await port.vault.mintCapital(b, 10000n * unit, asBig(cb.capital))
    applySpend(cfg, state, cb, asBig(cb.capital), 0n)
    const beyond = await port.vault.issueVoucher({ nonce: "beyond-own", account: a, corpAmount: 101n * unit, issuedAtS: 1n })
    const own = await port.vault.issueVoucher({ nonce: "own", account: a, corpAmount: 100n * unit, issuedAtS: 1n })
    results.backing = { vault: await port.vault.vaultCorp(), spenderCapitalAfterSpend: cb.capital, sharedFundAfterSpend: state.fund, spenderBackingUnchanged: await port.vault.backingOf(b), beyond, own, explanation: "Spending only changes the game ledger; no Vault selector reassigns backingOf." }
    expect(beyond.ok).toBe(false); expect(own.ok).toBe(true)
  })

  it("a new API host credits already-seen house backing again", async () => {
    const old = process.env.CORPORATOR_VAULT_HOUSE
    const house = "0x" + "34".repeat(20)
    process.env.CORPORATOR_VAULT_HOUSE = house
    const port = createMockPort(portCfgFromPack(loaded.pack))
    const live = { ...port, kind: "rpc", vault: { ...port.vault, backingOf: async () => ({ ok: true, amount: 1000000n * 10n ** 18n }) } } as any
    const city = liveCity(cfg, loadPack(), "a")
    city.account_kind = "demo"; city.functions = [{ id: "city_hall", level: 1n }]; city.agents = []
    function hostOf(state: any) {
      const host: any = { ctx: makeCtx(loaded), state, store: { query: async () => [], exec: async () => {} }, stepTick: async (inputs: any) => {
        host.state = tick(host.state, inputs)[0]
        return { state: host.state, records: [] }
      } }
      return host
    }
    try {
      const first = hostOf(newState(cfg, { a: city }, {}))
      await catchUpOnce(first, undefined, 1n, live); await voucherReconcileDone()
      const before = asBig(first.state.fund)
      const restored = hostOf(structuredClone(first.state))
      await catchUpOnce(restored, undefined, 1n, live); await voucherReconcileDone()
      results.houseReplay = { afterFirst: before, afterHostRecreated: restored.state.fund, physicalHouseBackingUnchanged: true }
      expect(asBig(restored.state.fund)).toBe(before * 2n)
    } finally {
      if (old === undefined) delete process.env.CORPORATOR_VAULT_HOUSE
      else process.env.CORPORATOR_VAULT_HOUSE = old
    }
  })
})

