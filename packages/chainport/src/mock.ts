import { codes } from "@corporator/protocol"
import type { AssetPort, ChainPort, CoolingResult, IssuedResult, MerkleRootsPort, RootResult, SnapshotResult, StakeRegistryPort, UsedResult, VaultPort } from "./port.js"
import type { CorpTokenPort } from "./port.js"
import { createPrizeTreasuryPort } from "./prize.js"
import {
  amountOk,
  err,
  mapGet,
  ok,
  type MockSeed,
  type PortAmount,
  type PortConfig,
  type PortResult,
  type StakeRow,
  type Voucher,
} from "./values.js"

function rootKey(cityId: string, cityDay: bigint): string {
  return cityId + "/" + cityDay.toString()
}

export function createMockPort(cfg: PortConfig, seed?: MockSeed): AssetPort {
  const corp = new Map<string, bigint>()
  const capital = new Map<string, bigint>()
  const pending = new Map<string, bigint>()
  const backing = new Map<string, bigint>()
  const reserved = new Map<string, bigint>()
  const uncovered = new Map<string, bigint>()
  const issued = new Map<string, Voucher>()
  const used = new Set<string>()
  const outcome = new Map<string, bigint>()
  const stakes = new Map<string, Map<string, bigint>>()
  const roots = new Map<string, string>()
  let vaultHeld = 0n
  let totalBacking = 0n
  let totalPending = 0n
  let totalReserved = 0n
  let totalUncovered = 0n
  const house = seed?.house ?? ""
  const initial = seed === undefined ? undefined : seed.corp
  if (initial !== undefined) {
    for (const account of Object.keys(initial)) {
      const v = initial[account]
      if (v !== undefined) corp.set(account, v)
    }
  }

  const corpToken: CorpTokenPort = {
    async balanceOf(account: string, token?: string): Promise<PortAmount> {
      if (token !== undefined && token.length > 0) return amountOk(0n)
      return amountOk(mapGet(corp, account))
    },
    async allowance(): Promise<PortAmount> {
      return amountOk(0n)
    },
    async transfer(from: string, to: string, amount: bigint): Promise<PortResult> {
      if (amount <= 0n || from.length === 0 || to.length === 0) return err(codes.API_MALFORMED)
      const have = mapGet(corp, from)
      if (have < amount) return err(codes.NOT_ENOUGH_CORP)
      corp.set(from, have - amount)
      corp.set(to, mapGet(corp, to) + amount)
      return ok()
    },
  }

  const vault: VaultPort & {
    refund(account: string, amount: bigint): Promise<PortResult>
  } = {
    async vaultCorp(): Promise<PortAmount> {
      return amountOk(vaultHeld)
    },
    async capitalOf(account: string): Promise<PortAmount> {
      return amountOk(mapGet(capital, account))
    },
    async deposit(account: string, corpAmount: bigint): Promise<PortResult> {
      if (corpAmount <= 0n || account.length === 0) return err(codes.API_MALFORMED)
      const have = mapGet(corp, account)
      if (have < corpAmount) return err(codes.NOT_ENOUGH_CORP)
      corp.set(account, have - corpAmount)
      vaultHeld += corpAmount
      pending.set(account, mapGet(pending, account) + corpAmount)
      totalPending += corpAmount
      return ok()
    },
    async mintCapital(account: string, corpAmount: bigint, capitalAmount: bigint): Promise<PortResult> {
      return applyMint(account, corpAmount, capitalAmount)
    },
    async signMintCapital(account: string, corpAmount: bigint, capitalAmount: bigint): Promise<PortResult> {
      return applyMint(account, corpAmount, capitalAmount)
    },
    async pending(account: string): Promise<PortAmount> {
      return amountOk(mapGet(pending, account))
    },
    async backingOf(account: string): Promise<PortAmount> {
      return amountOk(mapGet(backing, account))
    },
    async reservedOf(account: string): Promise<PortAmount> {
      return amountOk(mapGet(reserved, account))
    },
    async issued(nonce: string): Promise<IssuedResult> {
      const known = issued.get(nonce)
      if (known === undefined) return err(codes.API_MALFORMED)
      return { ok: true, account: known.account, corpAmount: known.corpAmount, issuedAtS: known.issuedAtS }
    },
    async used(nonce: string): Promise<UsedResult> {
      return { ok: true, used: used.has(nonce) }
    },
    async issueVoucher(voucher: Voucher): Promise<PortResult> {
      if (voucher.nonce.length === 0 || voucher.account.length === 0 || voucher.corpAmount <= 0n) {
        return err(codes.API_MALFORMED)
      }
      if (issued.has(voucher.nonce) || used.has(voucher.nonce)) return err(codes.API_INTENT_REPLAY)
      if (voucher.corpAmount > voucherRoom(voucher.account)) return err(codes.NOT_ENOUGH_CORP)
      reserved.set(voucher.account, mapGet(reserved, voucher.account) + voucher.corpAmount)
      totalReserved += voucher.corpAmount
      syncUncovered(voucher.account)
      issued.set(voucher.nonce, voucher)
      return ok()
    },
    async presentVoucher(voucher: Voucher, nowS: bigint): Promise<PortResult> {
      if (voucher.nonce.length === 0 || voucher.account.length === 0 || voucher.corpAmount <= 0n) {
        return err(codes.API_MALFORMED)
      }
      if (nowS > voucher.issuedAtS + cfg.voucherTtlS) return err(codes.API_MALFORMED)
      const known = issued.get(voucher.nonce)
      if (known === undefined) return err(codes.API_MALFORMED)
      if (
        known.account !== voucher.account ||
        known.corpAmount !== voucher.corpAmount ||
        known.issuedAtS !== voucher.issuedAtS
      ) {
        return err(codes.API_MALFORMED)
      }
      if (used.has(voucher.nonce)) return err(codes.API_INTENT_REPLAY)
      const hold = mapGet(reserved, voucher.account)
      if (hold < voucher.corpAmount) return err(codes.NOT_ENOUGH_CORP)
      const own = mapGet(backing, voucher.account)
      const fromOwn = own < voucher.corpAmount ? own : voucher.corpAmount
      let left = voucher.corpAmount - fromOwn
      let fromHouse = 0n
      if (house.length > 0 && voucher.account !== house && left > 0n) {
        const houseHave = mapGet(backing, house)
        fromHouse = houseHave < left ? houseHave : left
        left -= fromHouse
      }
      const assigned = totalBacking + totalPending
      const free = vaultHeld > assigned ? vaultHeld - assigned : 0n
      if (vaultHeld < voucher.corpAmount || left > free) return err(codes.NOT_ENOUGH_CORP)
      used.add(voucher.nonce)
      reserved.set(voucher.account, hold - voucher.corpAmount)
      totalReserved -= voucher.corpAmount
      if (fromOwn > 0n) {
        backing.set(voucher.account, own - fromOwn)
        totalBacking -= fromOwn
      }
      if (fromHouse > 0n) {
        backing.set(house, mapGet(backing, house) - fromHouse)
        totalBacking -= fromHouse
      }
      vaultHeld -= voucher.corpAmount
      corp.set(voucher.account, mapGet(corp, voucher.account) + voucher.corpAmount)
      outcome.set(voucher.nonce, 1n)
      syncUncovered(voucher.account)
      if (fromHouse > 0n) syncUncovered(house)
      return ok()
    },
    async outcomeOf(nonce: string): Promise<PortAmount> {
      return amountOk(outcome.get(nonce) ?? 0n)
    },
    async releaseExpiredVoucher(nonce: string): Promise<PortResult> {
      const known = issued.get(nonce)
      if (known === undefined || used.has(nonce)) return err(codes.API_MALFORMED)
      used.add(nonce)
      outcome.set(nonce, 2n)
      issued.delete(nonce)
      const hold = mapGet(reserved, known.account)
      const cut = hold < known.corpAmount ? hold : known.corpAmount
      reserved.set(known.account, hold - cut)
      totalReserved -= cut
      syncUncovered(known.account)
      return ok()
    },
    async refund(account: string, amount: bigint): Promise<PortResult> {
      if (account.length === 0 || amount <= 0n) return err(codes.API_MALFORMED)
      const have = mapGet(backing, account)
      const held = mapGet(reserved, account)
      const avail = held >= have ? 0n : have - held
      if (amount > avail || vaultHeld < amount) return err(codes.NOT_ENOUGH_CORP)
      backing.set(account, have - amount)
      totalBacking -= amount
      vaultHeld -= amount
      corp.set(account, mapGet(corp, account) + amount)
      syncUncovered(account)
      return ok()
    },
  }

  function syncUncovered(account: string): void {
    const reservedAmt = mapGet(reserved, account)
    const have = mapGet(backing, account)
    const next = reservedAmt > have ? reservedAmt - have : 0n
    const prev = mapGet(uncovered, account)
    if (next === prev) return
    if (next > prev) totalUncovered += next - prev
    else totalUncovered -= prev - next
    uncovered.set(account, next)
  }

  function applyMint(account: string, corpAmount: bigint, capitalAmount: bigint): PortResult {
    if (corpAmount <= 0n || capitalAmount <= 0n || account.length === 0) return err(codes.API_MALFORMED)
    const queued = mapGet(pending, account)
    if (queued < corpAmount) return err(codes.API_MALFORMED)
    pending.set(account, queued - corpAmount)
    totalPending -= corpAmount
    backing.set(account, mapGet(backing, account) + corpAmount)
    totalBacking += corpAmount
    capital.set(account, mapGet(capital, account) + capitalAmount)
    syncUncovered(account)
    return ok()
  }

  function voucherRoom(account: string): bigint {
    const own = mapGet(backing, account)
    const houseBal = house.length === 0 ? 0n : mapGet(backing, house)
    let others = totalBacking - own
    if (account !== house) {
      if (houseBal > others) return 0n
      if (mapGet(pending, account) === 0n) others -= houseBal
    }
    const ownUncovered = mapGet(uncovered, account)
    const othersUncovered = totalUncovered - ownUncovered
    const locked = others + totalPending + mapGet(reserved, account) + othersUncovered
    if (vaultHeld > locked) return vaultHeld - locked
    return 0n
  }

  const stakeRegistry: StakeRegistryPort = {
    async stake(account: string, ticker: string, amount: bigint): Promise<PortResult> {
      if (account.length === 0 || ticker.length === 0 || amount <= 0n) return err(codes.API_MALFORMED)
      let inner = stakes.get(account)
      if (inner === undefined) {
        inner = new Map<string, bigint>()
        stakes.set(account, inner)
      }
      inner.set(ticker, mapGet(inner, ticker) + amount)
      return ok()
    },
    async requestUnstake(account: string, ticker: string, amount: bigint): Promise<PortResult> {
      if (account.length === 0 || ticker.length === 0 || amount <= 0n) return err(codes.API_MALFORMED)
      const inner = stakes.get(account)
      if (inner === undefined) return err(codes.API_MALFORMED)
      const have = mapGet(inner, ticker)
      if (have < amount) return err(codes.API_MALFORMED)
      inner.set(ticker, have - amount)
      return ok()
    },
    async claimUnstaked(account: string, ticker: string): Promise<PortResult> {
      if (account.length === 0 || ticker.length === 0) return err(codes.API_MALFORMED)
      return err(codes.API_MALFORMED)
    },
    async snapshot(account: string): Promise<SnapshotResult> {
      const inner = stakes.get(account)
      const rows: StakeRow[] = []
      if (inner !== undefined) {
        const tickers = [...inner.keys()].sort()
        for (const ticker of tickers) {
          rows.push({ ticker, amount: mapGet(inner, ticker) })
        }
      }
      return { ok: true, rows }
    },
    async coolingSnapshot(): Promise<CoolingResult> {
      return { ok: true, rows: [] }
    },
  }

  const merkleRoots: MerkleRootsPort = {
    async putRoot(cityId: string, cityDay: bigint, root: string): Promise<PortResult> {
      if (cityId.length === 0 || root.length === 0) return err(codes.API_MALFORMED)
      roots.set(rootKey(cityId, cityDay), root)
      return ok()
    },
    async getRoot(cityId: string, cityDay: bigint): Promise<RootResult> {
      const root = roots.get(rootKey(cityId, cityDay))
      if (root === undefined) return err(codes.API_MALFORMED)
      return { ok: true, root }
    },
  }

  const prizeDepositor = seed?.prizeDepositor ?? cfg.buybackExecutorService
  const prizeSigner = seed?.prizeSigner ?? cfg.voucherSignerService
  const prizeStocks = seed?.prizeStocks ?? []
  const prizeBalances = seed?.prizeBalances
  const prizeTreasury = createPrizeTreasuryPort(
    prizeBalances === undefined
      ? { depositor: prizeDepositor, signer: prizeSigner, stocks: prizeStocks }
      : { depositor: prizeDepositor, signer: prizeSigner, stocks: prizeStocks, balances: prizeBalances },
  )

  const chain: ChainPort = {
    async transactionReceipt() {
      return err(codes.SERVICE_DEGRADED)
    },
    async transactionByHash() {
      return err(codes.SERVICE_DEGRADED)
    },
    async pendingNonce() {
      return err(codes.SERVICE_DEGRADED)
    },
    async estimateGas() {
      return err(codes.SERVICE_DEGRADED)
    },
    async gasPrice() {
      return err(codes.SERVICE_DEGRADED)
    },
    async latestBlockTime() {
      return err(codes.SERVICE_DEGRADED)
    },
    async sendRaw() {
      return err(codes.SERVICE_DEGRADED)
    },
  }

  return {
    kind: "mock",
    voucherSignerService: cfg.voucherSignerService,
    buybackExecutorService: cfg.buybackExecutorService,
    corpToken,
    vault,
    stakeRegistry,
    merkleRoots,
    prizeTreasury,
    chain,
  }
}
