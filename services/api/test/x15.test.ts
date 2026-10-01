import { canonical, fromUtf8, parseJson, type Json } from "@corporator/contentpack"
import {
  assertI1,
  bankOpen,
  cityClock,
  settleCities,
  tickerFrozen,
  windowSettleDue,
  type Dict,
} from "@corporator/engine"
import {
  PRIZE_KETTLE_FARM,
  amountOk,
  createMockPort,
  createRpcPort,
  err,
  transportFromPort,
  type AssetPort,
  type TxLog,
} from "@corporator/chainport"
import { codes } from "@corporator/protocol"
import { describe, expect, it } from "vitest"
import { handleCommand } from "../src/commands.ts"
import { portCfgFromPack } from "../src/custody.ts"
import { syncStakeSnapshot } from "../src/project.ts"
import { reconcileVouchers } from "../src/commit_bank.ts"
import { sliceFarm } from "../src/slicer.ts"
import { tickOnce, voucherReconcileDone } from "../src/scheduler.ts"
import { putJson } from "../src/store.ts"
import { cityLedgerDirty, liveStartRefusal } from "../src/tick_host.ts"
import { asBigint, asEngineDict, asObj, asText, walk } from "../src/values.ts"
import { bootHost, demoAuth, seedPlayerCapital } from "./harness.ts"

type Host = Awaited<ReturnType<typeof bootHost>>
type Mined = {
  readonly status: bigint
  readonly from: string
  readonly to: string
  readonly input: string
  readonly logs: readonly TxLog[]
}

const WALLET = "0x" + "7".repeat(40)
const CORP = "0x" + "1".repeat(40)
const VAULT = "0x" + "2".repeat(40)
const STOCK_NVDA = "0x" + "5".repeat(40)
const STOCK_TSLA = "0x" + "6".repeat(40)
const STOCK_AMZN = "0x" + "a".repeat(40)
const STOCK_AAPL = "0x" + "c".repeat(40)
const STOCK_MSFT = "0x" + "d".repeat(40)
const STOCK_COIN = "0x" + "e".repeat(40)
const STOCKS = [STOCK_NVDA, STOCK_TSLA, STOCK_AMZN, STOCK_AAPL, STOCK_MSFT, STOCK_COIN]
const REGISTRY = "0x" + "9".repeat(40)
const TREASURY = "0x" + "4".repeat(40)
const HOP = "0x" + "b".repeat(40)
const HOP_DATA = "0x" + "ab".repeat(4)
const TRANSFER = "0xddf252ad" + "1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

function bodyOf(bytes: Uint8Array): { readonly [key: string]: Json } {
  const parsed = parseJson(fromUtf8(bytes))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body")
  return parsed
}

function cityOf(host: Host): Dict {
  return asEngineDict(asEngineDict(host.state["cities"])["a"])
}

function padWord(addr: string): string {
  return "0x" + addr.slice(2).toLowerCase().padStart(64, "0")
}

function transferLog(value: bigint): TxLog {
  return {
    address: STOCK_NVDA,
    topics: [TRANSFER, padWord(HOP), padWord(WALLET)],
    data: "0x" + value.toString(16).padStart(64, "0"),
  }
}

function openBankTick(host: Host): bigint {
  const closed = asBigint(host.ctx.cfg["bank_closed_weekday"])
  let i = 0n
  while (i < 2000n) {
    const clock = cityClock(host.ctx.cfg, i)
    if (clock[2] !== closed && bankOpen(host.ctx.cfg, clock[1], clock[2]) !== 0n) return i
    i += 1n
  }
  return 0n
}

function alignCityTime(host: Host, tick: bigint): void {
  const length = asBigint(host.ctx.cfg["tick_length_city_hours"])
  const anchor = asBigint(host.ctx.cfg["anchor_hour"])
  host.state["tick_index"] = tick
  host.state["city_time"] = anchor + tick * length
}

async function walletHeaders(host: Host, sessionId: string) {
  const expires = asBigint(host.state["city_time"]) + host.ctx.sessionTtlCity
  await putJson(
    host.store,
    "sessions",
    sessionId,
    { kind: "session", city_id: "a", account_kind: "wallet", expires_city_time: expires.toString() },
    "wallet",
  )
  return { authorization: "Bearer " + sessionId }
}

function corpForHire(host: Host): bigint {
  const hire = asBigint(asObj(walk(host.ctx.pack, ["generated", "balance", "hire_cost", "1"]))["cost"])
  const rate = asBigint(host.state["mint_rate"])
  const bps = asBigint(host.ctx.cfg["bps"])
  const fee = asBigint(host.ctx.cfg["vault_fee_bps"])
  const wei = asBigint(host.ctx.cfg["wei"])
  const per = bps === 0n ? 0n : (rate * (bps - fee)) / bps
  if (per <= 0n) throw new Error("mint")
  return (hire / per + 2n) * wei
}

function stakeMinOf(host: Host): bigint {
  return asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "s_min", "NVDA", "v"]))
}

function heldOf(city: Dict, ticker: string): bigint {
  return asBigint(asEngineDict(city["tokens_held"])[ticker], 0n)
}

function settledOf(city: Dict, ticker: string): bigint {
  return asBigint(asEngineDict(city["stake_settled"])[ticker], 0n)
}

function chainStakeOf(city: Dict, ticker: string): bigint {
  return asBigint(asEngineDict(city["stake_chain"])[ticker], 0n)
}

function owedOf(city: Dict, ticker: string): bigint {
  return asBigint(asEngineDict(city["fragment_owed"])[ticker], 0n)
}

function claimedOf(city: Dict, ticker: string): bigint {
  return asBigint(asEngineDict(city["fragment_claimed"])[ticker], 0n)
}

type Book = Map<string, Mined>
type Clock = { now: bigint }

function fixturePort(host: Host, clock: Clock, bag: bigint, corp: bigint): {
  readonly port: AssetPort
  readonly book: Book
  readonly gate: { allowance: bigint }
  readonly stocks: Map<string, bigint>
} {
  const cfg = portCfgFromPack(host.ctx.pack)
  const chain = asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "snapshot", "chain_id"])).toString()
  const cooldown = asBigint(walk(host.ctx.pack, ["generated", "api", "unstake_cooldown_s"]))
  const depositor = cfg.buybackExecutorService
  const inner = createMockPort(cfg, {
    corp: { [WALLET]: corp },
    prizeStocks: STOCKS,
    prizeBalances: { [depositor]: { [STOCK_NVDA]: bag } },
  })
  const book: Book = new Map()
  const stocks = new Map<string, bigint>()
  const cooling = new Map<string, { amount: bigint; readyAtS: bigint }>()
  const gate = { allowance: 0n }
  const stockKey = (account: string, token: string) => account.toLowerCase() + "/" + token.toLowerCase()
  const credit = (account: string, token: string, amount: bigint) => {
    const key = stockKey(account, token)
    stocks.set(key, (stocks.get(key) ?? 0n) + amount)
  }
  const wrapped: AssetPort = {
    ...inner,
    corpToken: {
      ...inner.corpToken,
      async balanceOf(account: string, token?: string) {
        if (token !== undefined && token.length > 0) return amountOk(stocks.get(stockKey(account, token)) ?? 0n)
        return inner.corpToken.balanceOf(account)
      },
      async allowance() {
        return amountOk(gate.allowance)
      },
    },
    stakeRegistry: {
      ...inner.stakeRegistry,
      async requestUnstake(account: string, ticker: string, amount: bigint) {
        const key = account.toLowerCase() + "/" + ticker
        const prior = cooling.get(key)
        if (prior !== undefined && prior.amount > 0n && clock.now >= prior.readyAtS) {
          credit(account, STOCK_NVDA, prior.amount)
          cooling.delete(key)
        }
        const posted = await inner.stakeRegistry.requestUnstake(account, ticker, amount)
        if (!posted.ok) return posted
        const current = cooling.get(key)
        const base = current !== undefined && clock.now < current.readyAtS ? current.amount : 0n
        cooling.set(key, { amount: base + amount, readyAtS: clock.now + cooldown })
        return posted
      },
      async claimUnstaked(account: string, ticker: string) {
        const key = account.toLowerCase() + "/" + ticker
        const bucket = cooling.get(key)
        if (bucket === undefined || bucket.amount <= 0n) return err(codes.API_MALFORMED)
        if (clock.now < bucket.readyAtS) return err(codes.API_MALFORMED)
        credit(account, STOCK_NVDA, bucket.amount)
        cooling.delete(key)
        return { ok: true }
      },
      async coolingSnapshot(account: string) {
        const rows: { ticker: string; amount: bigint; readyAtS: bigint }[] = []
        const prefix = account.toLowerCase() + "/"
        for (const [key, bucket] of cooling) {
          if (!key.startsWith(prefix) || bucket.amount <= 0n) continue
          rows.push({ ticker: key.slice(prefix.length), amount: bucket.amount, readyAtS: bucket.readyAtS })
        }
        rows.sort((a, b) => (a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0))
        return { ok: true, rows }
      },
    },
    chain: {
      ...inner.chain,
      async latestBlockTime() {
        return amountOk(clock.now)
      },
      async transactionReceipt(hash: string) {
        const tx = book.get(hash.toLowerCase())
        if (tx === undefined) return err(codes.SERVICE_DEGRADED)
        return { ok: true, ...tx }
      },
      async transactionByHash(hash: string) {
        const tx = book.get(hash.toLowerCase())
        if (tx === undefined) return err(codes.SERVICE_DEGRADED)
        return { ok: true, ...tx }
      },
    },
  }
  const port = createRpcPort(cfg, transportFromPort(wrapped, chain))
  return { port, book, gate, stocks }
}

function rememberEnv(names: readonly string[]): Map<string, string | undefined> {
  const prior = new Map<string, string | undefined>()
  for (const name of names) prior.set(name, process.env[name])
  return prior
}

function restoreEnv(prior: ReadonlyMap<string, string | undefined>): void {
  for (const [name, value] of prior) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
}

function armHop(stockOut: string): () => void {
  const prevFetch = globalThis.fetch
  process.env["CORPORATOR_HOP_URL"] = "http://hop.test/quote"
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ to: HOP, data: HOP_DATA, value: "0", stock_out: stockOut }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  return () => {
    globalThis.fetch = prevFetch
  }
}

let hashN = 0
function nextHash(): string {
  hashN += 1
  return "0x" + hashN.toString(16).padStart(64, "0")
}

function mine(book: Book, from: string, to: string, data: string, logs: readonly TxLog[] = []): string {
  const hash = nextHash()
  book.set(hash, { status: 1n, from, to, input: data, logs })
  return hash
}

function txRows(body: { readonly [key: string]: Json }): { readonly to: string; readonly data: string; readonly label: string }[] {
  const raw = body["txs"]
  if (!Array.isArray(raw)) throw new Error("txs")
  const out: { readonly to: string; readonly data: string; readonly label: string }[] = []
  for (const item of raw) {
    const row = asObj(item)
    out.push({ to: asText(row["to"]), data: asText(row["data"]), label: asText(row["label"]) })
  }
  return out
}

async function command(
  host: Host,
  port: AssetPort | undefined,
  effect: string,
  intentId: string,
  extra: { readonly [key: string]: Json },
  kind: "wallet" | "demo",
): Promise<{ readonly [key: string]: Json }> {
  const headers =
    kind === "demo"
      ? (await demoAuth(host)).headers
      : await walletHeaders(host, intentId)
  const res = await handleCommand(
    host.ctx,
    host.store,
    host.state,
    effect,
    canonical({ intent_id: intentId, expected_city_time: asBigint(host.state["city_time"]), ...extra }),
    headers,
    undefined,
    port,
  )
  return bodyOf(res.body)
}

async function step(host: Host, port: AssetPort, times: number): Promise<void> {
  let n = 0
  while (n < times) {
    await tickOnce(host, undefined, port)
    await voucherReconcileDone()
    assertI1(host.ctx.cfg, host.state, "a")
    expect(cityLedgerDirty(cityOf(host))).toBe(false)
    n += 1
  }
}

describe("X15 withdraw acceptance", () => {
  it("a fixture without an inner clock stays silent instead of zero", async () => {
    const host = await bootHost()
    const cfg = portCfgFromPack(host.ctx.pack)
    const chain = asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "snapshot", "chain_id"])).toString()
    const port = createRpcPort(cfg, transportFromPort(createMockPort(cfg), chain))
    const clock = await port.chain.latestBlockTime()
    expect(clock.ok).toBe(false)
    if (!clock.ok) expect(clock.code).toBe(codes.SERVICE_DEGRADED)
  })

  it("walks a fresh wallet from deposit to the wallet on the fixture port", async () => {
    const host = await bootHost()
    alignCityTime(host, openBankTick(host))
    const city = cityOf(host)
    city["account_kind"] = "wallet"
    city["wallet"] = WALLET
    city["corp_held"] = 0n
    city["tokens_held"] = {}
    const need = stakeMinOf(host)
    const depositCorp = corpForHire(host)
    const clock: Clock = { now: 1_000_000n }
    const built = fixturePort(host, clock, need, depositCorp + asBigint(host.ctx.cfg["wei"]))
    const port = built.port
    const prior = rememberEnv([
      "CORPORATOR_CORP_TOKEN",
      "CORPORATOR_VAULT",
      "CORPORATOR_STOCK_NVDA",
      "CORPORATOR_STOCK_TSLA",
      "CORPORATOR_STOCK_AMZN",
      "CORPORATOR_STOCK_AAPL",
      "CORPORATOR_STOCK_MSFT",
      "CORPORATOR_STOCK_COIN",
      "CORPORATOR_STAKE_REGISTRY",
      "CORPORATOR_PRIZE_TREASURY",
      "CORPORATOR_HOP_URL",
    ])
    process.env["CORPORATOR_CORP_TOKEN"] = CORP
    process.env["CORPORATOR_VAULT"] = VAULT
    process.env["CORPORATOR_STOCK_NVDA"] = STOCK_NVDA
    process.env["CORPORATOR_STOCK_TSLA"] = STOCK_TSLA
    process.env["CORPORATOR_STOCK_AMZN"] = STOCK_AMZN
    process.env["CORPORATOR_STOCK_AAPL"] = STOCK_AAPL
    process.env["CORPORATOR_STOCK_MSFT"] = STOCK_MSFT
    process.env["CORPORATOR_STOCK_COIN"] = STOCK_COIN
    process.env["CORPORATOR_STAKE_REGISTRY"] = REGISTRY
    process.env["CORPORATOR_PRIZE_TREASURY"] = TREASURY
    const restoreHop = armHop(need.toString())
    try {
      const wei = depositCorp
      const preparedDeposit = await command(host, port, "deposit", "x15-dep", { phase: "prepare", amount: wei }, "wallet")
      expect(asText(preparedDeposit["code"])).toBe("")
      const depositHashes: string[] = []
      for (const tx of txRows(preparedDeposit)) {
        if (tx.label === "approve") built.gate.allowance = wei
        if (tx.label === "deposit") expect((await port.vault.deposit(WALLET, wei)).ok).toBe(true)
        depositHashes.push(mine(built.book, WALLET, tx.to, tx.data))
      }
      const deposited = await command(
        host,
        port,
        "deposit",
        "x15-dep-ok",
        { phase: "confirm", ticket: "x15-dep", tx_hashes: depositHashes },
        "wallet",
      )
      expect(asText(deposited["code"])).toBe("")
      expect(asBigint(cityOf(host)["capital"]) > 0n).toBe(true)
      expect(asBigint(cityOf(host)["corp_held"], 0n)).toBe(0n)
      const hired = await command(host, port, "hire", "x15-hire", { role: "engineer" }, "wallet")
      expect(asText(hired["code"])).toBe("")
      await step(host, port, 3)
      assertI1(host.ctx.cfg, host.state, "a")

      const outstandingBefore = asBigint(host.state["capital_outstanding"], 0n)
      const vaultBefore = asBigint(host.state["vault_corp"], 0n)
      const corpBefore = await port.corpToken.balanceOf(WALLET)
      expect(corpBefore.ok).toBe(true)
      const withdrawn = await command(host, port, "withdraw", "x15-out", { amount: 1n }, "wallet")
      expect(asText(withdrawn["phase"])).toBe("voucher")
      expect(asText(asObj(withdrawn["voucher"])["status"])).toBe("open")
      expect(asBigint(cityOf(host)["corp_held"], 0n)).toBe(0n)
      const presentedPrep = await command(
        host,
        port,
        "present_voucher",
        "x15-present",
        { phase: "prepare", voucher_id: "x15-out" },
        "wallet",
      )
      expect(asText(presentedPrep["code"])).toBe("")
      const presentTx = txRows(presentedPrep)[0]
      if (presentTx === undefined) throw new Error("present")
      const voucherList = cityOf(host)["vouchers"]
      if (!Array.isArray(voucherList) || voucherList[0] === undefined) throw new Error("voucher")
      const voucherRow = asEngineDict(voucherList[0])
      expect((await port.vault.presentVoucher(
        {
          nonce: asText(voucherRow["nonce"]),
          account: WALLET,
          corpAmount: asBigint(voucherRow["corp"]),
          issuedAtS: asBigint(voucherRow["issued_at_s"]),
        },
        clock.now,
      )).ok).toBe(true)
      const presentHash = mine(built.book, WALLET, presentTx.to, presentTx.data)
      const presented = await command(
        host,
        port,
        "present_voucher",
        "x15-present-ok",
        { phase: "confirm", ticket: "x15-present", tx_hashes: [presentHash] },
        "wallet",
      )
      expect(asText(presented["code"])).toBe("")
      const corpAfter = await port.corpToken.balanceOf(WALLET)
      expect(corpAfter.ok && corpBefore.ok && corpAfter.amount > corpBefore.amount).toBe(true)
      expect(asBigint(host.state["capital_outstanding"], 0n) < outstandingBefore).toBe(true)
      expect(asBigint(host.state["vault_corp"], 0n) < vaultBefore).toBe(true)
      expect(asBigint(cityOf(host)["corp_held"], 0n)).toBe(0n)
      await command(
        host,
        port,
        "present_voucher",
        "x15-present-2",
        { phase: "confirm", ticket: "x15-present", tx_hashes: [presentHash] },
        "wallet",
      )
      const corpTwice = await port.corpToken.balanceOf(WALLET)
      expect(corpTwice.ok && corpAfter.ok && corpTwice.amount === corpAfter.amount).toBe(true)

      const capitalOpen = asBigint(cityOf(host)["capital"])
      const second = await command(host, port, "withdraw", "x15-out-2", { amount: 1n }, "wallet")
      expect(asText(asObj(second["voucher"])["status"])).toBe("open")
      expect(asBigint(cityOf(host)["capital"])).toBe(capitalOpen - 1n)
      const ttl = asBigint(walk(host.ctx.pack, ["generated", "api", "voucher_ttl_s"]))
      clock.now = clock.now + ttl + 1n
      await reconcileVouchers(host, port)
      expect(asBigint(cityOf(host)["capital"])).toBe(capitalOpen)
      await reconcileVouchers(host, port)
      expect(asBigint(cityOf(host)["capital"])).toBe(capitalOpen)
      expect(asBigint(cityOf(host)["corp_held"], 0n)).toBe(0n)

      cityOf(host)["city_level"] = asBigint(walk(host.ctx.pack, ["sections", "buildings", "buildings", "exchange", "city_level_req"]))
      const buyAmount = asBigint(host.ctx.cfg["wei"])
      built.gate.allowance = 0n
      const buyPrep = await command(host, port, "buy_stock", "x15-buy", { phase: "prepare", ticker: "NVDA", amount: buyAmount }, "wallet")
      expect(asText(buyPrep["code"])).toBe("")
      const buyHashes: string[] = []
      for (const tx of txRows(buyPrep)) {
        if (tx.label === "approve") built.gate.allowance = buyAmount
        const logs = tx.label === "buy" ? [transferLog(need)] : []
        if (tx.label === "buy") {
          const key = WALLET.toLowerCase() + "/" + STOCK_NVDA.toLowerCase()
          built.stocks.set(key, (built.stocks.get(key) ?? 0n) + need)
        }
        buyHashes.push(mine(built.book, WALLET, tx.to, tx.data, logs))
      }
      const bought = await command(
        host,
        port,
        "buy_stock",
        "x15-buy-ok",
        { phase: "confirm", ticket: "x15-buy", tx_hashes: buyHashes },
        "wallet",
      )
      expect(asText(bought["code"])).toBe("")
      expect(heldOf(cityOf(host), "NVDA")).toBe(0n)
      const stockBal = await port.corpToken.balanceOf(WALLET, STOCK_NVDA)
      expect(stockBal.ok && stockBal.amount).toBe(need)

      const stakePrep = await command(
        host,
        port,
        "stake",
        "x15-stake",
        { phase: "prepare", source: "wallet", ticker: "NVDA", amount: need },
        "wallet",
      )
      expect(asText(stakePrep["code"])).toBe("")
      const stakeHashes: string[] = []
      for (const tx of txRows(stakePrep)) {
        if (tx.label === "stake") {
          expect((await port.stakeRegistry.stake(WALLET, "NVDA", need)).ok).toBe(true)
          const key = WALLET.toLowerCase() + "/" + STOCK_NVDA.toLowerCase()
          built.stocks.set(key, (built.stocks.get(key) ?? 0n) - need)
        }
        stakeHashes.push(mine(built.book, WALLET, tx.to, tx.data))
      }
      const staked = await command(
        host,
        port,
        "stake",
        "x15-stake-ok",
        { phase: "confirm", source: "wallet", ticket: "x15-stake", tx_hashes: stakeHashes },
        "wallet",
      )
      expect(asText(staked["code"])).toBe("")
      expect(settledOf(cityOf(host), "NVDA")).toBe(need)
      expect(chainStakeOf(cityOf(host), "NVDA")).toBe(need)
      expect((cityOf(host)["districts"] as unknown[]).includes("compute")).toBe(true)
      await syncStakeSnapshot(host.ctx, host.store, host.state, "a", port)
      await syncStakeSnapshot(host.ctx, host.store, host.state, "a", port)
      expect(settledOf(cityOf(host), "NVDA")).toBe(need)
      expect(heldOf(cityOf(host), "NVDA")).toBe(0n)

      const unstakePrep = await command(
        host,
        port,
        "unstake",
        "x15-unstake",
        { phase: "prepare", ticker: "NVDA", amount: need },
        "wallet",
      )
      expect(asText(unstakePrep["code"])).toBe("")
      const unstakeTx = txRows(unstakePrep)[0]
      if (unstakeTx === undefined) throw new Error("unstake")
      expect((await port.stakeRegistry.requestUnstake(WALLET, "NVDA", need)).ok).toBe(true)
      const unstakeHash = mine(built.book, WALLET, unstakeTx.to, unstakeTx.data)
      const unstaked = await command(
        host,
        port,
        "unstake",
        "x15-unstake-ok",
        { phase: "confirm", ticket: "x15-unstake", tx_hashes: [unstakeHash] },
        "wallet",
      )
      expect(asText(unstaked["code"])).toBe("")
      expect(settledOf(cityOf(host), "NVDA")).toBe(0n)
      expect(chainStakeOf(cityOf(host), "NVDA")).toBe(0n)
      expect(cityLedgerDirty(cityOf(host))).toBe(false)
      const grace = asBigint(host.ctx.cfg["unstake_grace_city_hours"])
      await step(host, port, Number(grace))
      expect(tickerFrozen(cityOf(host), "NVDA", asBigint(host.state["city_time"]))).toBe(true)
      const early = await command(host, port, "claim_unstaked", "x15-early", { phase: "prepare", ticker: "NVDA" }, "wallet")
      expect(asText(early["code"])).toBe(codes.UNSTAKE_COOLING)
      expect(early["txs"]).toBeUndefined()
      const cooldown = asBigint(walk(host.ctx.pack, ["generated", "api", "unstake_cooldown_s"]))
      clock.now = clock.now + cooldown
      const claimPrep = await command(host, port, "claim_unstaked", "x15-claim", { phase: "prepare", ticker: "NVDA" }, "wallet")
      expect(asText(claimPrep["code"])).toBe("")
      const claimTx = txRows(claimPrep)[0]
      if (claimTx === undefined) throw new Error("claim")
      expect((await port.stakeRegistry.claimUnstaked(WALLET, "NVDA")).ok).toBe(true)
      const claimHash = mine(built.book, WALLET, claimTx.to, claimTx.data)
      const claimed = await command(
        host,
        port,
        "claim_unstaked",
        "x15-claim-ok",
        { phase: "confirm", ticket: "x15-claim", tx_hashes: [claimHash] },
        "wallet",
      )
      expect(asText(claimed["code"])).toBe("")
      expect(heldOf(cityOf(host), "NVDA")).toBe(0n)
      const back = await port.corpToken.balanceOf(WALLET, STOCK_NVDA)
      expect(back.ok && back.amount).toBe(need)

      const data = asEngineDict(host.ctx.cfg["data"])
      let due = asBigint(host.state["tick_index"])
      while (due < asBigint(host.state["tick_index"]) + 2000n) {
        const clockRow = cityClock(host.ctx.cfg, due)
        if (windowSettleDue(data, clockRow[0], clockRow[1])) break
        due += 1n
      }
      alignCityTime(host, due)
      const live = cityOf(host)
      live["fragment_ledger"] = { NVDA: need }
      live["fragment_pool"] = need
      settleCities(data, { a: live }, need)
      expect(owedOf(cityOf(host), "NVDA") > 0n).toBe(true)
      const payout = owedOf(cityOf(host), "NVDA")
      expect((await port.prizeTreasury.deposit(port.buybackExecutorService, STOCK_NVDA, PRIZE_KETTLE_FARM, payout)).ok).toBe(true)
      await sliceFarm(host, port)
      expect(owedOf(cityOf(host), "NVDA")).toBe(0n)
      const fragPrep = await command(host, port, "claim_fragment", "x15-farm", { phase: "prepare" }, "wallet")
      expect(asText(fragPrep["code"])).toBe("")
      const fragTx = txRows(fragPrep)[0]
      if (fragTx === undefined) throw new Error("farm")
      expect((await port.prizeTreasury.claimPrize(WALLET, STOCK_NVDA, PRIZE_KETTLE_FARM)).ok).toBe(true)
      const fragKey = WALLET.toLowerCase() + "/" + STOCK_NVDA.toLowerCase()
      built.stocks.set(fragKey, (built.stocks.get(fragKey) ?? 0n) + payout)
      const fragHash = mine(built.book, WALLET, fragTx.to, fragTx.data)
      const farmed = await command(
        host,
        port,
        "claim_fragment",
        "x15-farm-ok",
        { phase: "confirm", ticket: "x15-farm", tx_hashes: [fragHash] },
        "wallet",
      )
      expect(asText(farmed["code"])).toBe("")
      expect(heldOf(cityOf(host), "NVDA")).toBe(0n)
      expect(claimedOf(cityOf(host), "NVDA")).toBe(payout)
      const farmBal = await port.corpToken.balanceOf(WALLET, STOCK_NVDA)
      expect(farmBal.ok && farmBal.amount).toBe(need + payout)
      expect(cityLedgerDirty(cityOf(host))).toBe(false)
      assertI1(host.ctx.cfg, host.state, "a")
    } finally {
      restoreHop()
      restoreEnv(prior)
    }
  })

  it("keeps the mock one-step and refuses a demo city", async () => {
    const demo = await bootHost()
    alignCityTime(demo, openBankTick(demo))
    seedPlayerCapital(demo, "a", 5n)
    const withdraw = await command(demo, undefined, "withdraw", "x15-demo-out", { amount: 1n }, "demo")
    expect(asText(withdraw["code"])).toBe(codes.DEMO_NO_WITHDRAW)
    const fragment = await command(demo, undefined, "claim_fragment", "x15-demo-farm", {}, "demo")
    expect(asText(fragment["code"])).toBe(codes.DEMO_NO_CLAIM)
    const cooling = await command(demo, undefined, "claim_unstaked", "x15-demo-cool", {}, "demo")
    expect(asText(cooling["code"])).toBe(codes.DEMO_NO_CLAIM)
    const prize = await command(demo, undefined, "claim_prize", "x15-demo-prize", {}, "demo")
    expect(asText(prize["code"])).toBe(codes.DEMO_NO_PRIZE)

    const host = await bootHost()
    alignCityTime(host, openBankTick(host))
    const city = cityOf(host)
    city["account_kind"] = "wallet"
    city["wallet"] = WALLET
    const wei = corpForHire(host)
    city["corp_held"] = wei
    const deposited = await command(host, undefined, "deposit", "x15-mock-dep", { amount: wei }, "wallet")
    expect(asText(deposited["phase"])).toBe("applied")
    expect(asBigint(cityOf(host)["capital"]) > 0n).toBe(true)
    expect(asBigint(cityOf(host)["corp_held"], 0n) < wei).toBe(true)
    const hired = await command(host, undefined, "hire", "x15-mock-hire", { role: "engineer" }, "wallet")
    expect(asText(hired["code"])).toBe("")
    let n = 0
    while (n < 3) {
      await tickOnce(host)
      assertI1(host.ctx.cfg, host.state, "a")
      n += 1
    }
    const before = asBigint(cityOf(host)["corp_held"], 0n)
    const taken = await command(host, undefined, "withdraw", "x15-mock-out", { amount: 1n }, "wallet")
    expect(asText(taken["code"])).toBe("")
    expect(asText(taken["effect"])).toBe("withdraw")
    expect(asText(taken["phase"])).toBe("")
    expect(asBigint(cityOf(host)["corp_held"], 0n) > before).toBe(true)
    expect(liveStartRefusal(host.state, true)).toBe(codes.LEDGER_NOT_EMPTY_LIVE)
    expect(liveStartRefusal(host.state, false)).toBe("")
  })
})
