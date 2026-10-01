export type PortKind = "mock" | "rpc"

export type PortOk = {
  readonly ok: true
  readonly txHash?: string
  readonly txNonce?: string
  readonly txRaw?: string
  readonly txConfirmed?: boolean
}
export type PortErr = { readonly ok: false; readonly code: string }
export type PortResult = PortOk | PortErr
export type PortAmount = (PortOk & { readonly amount: bigint }) | PortErr

export type PortConfig = {
  readonly voucherTtlS: bigint
  readonly voucherSignerService: string
  readonly buybackExecutorService: string
  readonly bps?: bigint
  readonly gasHeadroomBps?: bigint
}

export type Voucher = {
  readonly nonce: string
  readonly account: string
  readonly corpAmount: bigint
  readonly issuedAtS: bigint
}

export type StakeRow = {
  readonly ticker: string
  readonly amount: bigint
}

export type CoolingRow = {
  readonly ticker: string
  readonly amount: bigint
  readonly readyAtS: bigint
}

export type TxLog = {
  readonly address: string
  readonly topics: readonly string[]
  readonly data: string
}

export const PRIZE_KETTLE_FARM = 0n
export const PRIZE_KETTLE_MONTH = 1n
/** Vault.OUTCOME_PRESENTED */
export const OUTCOME_PRESENTED = 1n
/** Vault.OUTCOME_RELEASED */
export const OUTCOME_RELEASED = 2n

export function kettleOk(kettle: bigint): boolean {
  return kettle === PRIZE_KETTLE_FARM || kettle === PRIZE_KETTLE_MONTH
}

export type MockSeed = {
  readonly corp?: { readonly [account: string]: bigint }
  readonly house?: string
  readonly prizeStocks?: readonly string[]
  readonly prizeBalances?: { readonly [account: string]: { readonly [token: string]: bigint } }
  readonly prizeDepositor?: string
  readonly prizeSigner?: string
}

export type RpcOutcome =
  | { readonly status: "ok"; readonly body: string }
  | { readonly status: "silence" }
  | { readonly status: "lie"; readonly body: string }

export type RpcTransport = {
  call(method: string, args: readonly string[]): Promise<RpcOutcome>
}

export function silentTransport(): RpcTransport {
  return {
    async call(): Promise<RpcOutcome> {
      return { status: "silence" }
    },
  }
}

export type WalletPrice = {
  readonly chain: string
  readonly corp: bigint
}

export function isPortKind(kind: string): kind is PortKind {
  return kind === "mock" || kind === "rpc"
}

export function ok(): PortOk {
  return { ok: true }
}

export function err(code: string): PortErr {
  return { ok: false, code }
}

export function amountOk(amount: bigint): PortAmount {
  return { ok: true, amount }
}

export function mapGet(map: ReadonlyMap<string, bigint>, id: string): bigint {
  const v = map.get(id)
  if (v === undefined) return 0n
  return v
}
