import type {
  CoolingRow,
  PortAmount,
  PortErr,
  PortKind,
  PortOk,
  PortResult,
  StakeRow,
  TxLog,
  Voucher,
} from "./values.js"

export type SnapshotOk = PortOk & { readonly rows: readonly StakeRow[] }
export type SnapshotResult = SnapshotOk | PortErr

export type RootOk = PortOk & { readonly root: string }
export type RootResult = RootOk | PortErr

export type IssuedOk = PortOk & {
  readonly account: string
  readonly corpAmount: bigint
  readonly issuedAtS: bigint
}
export type IssuedResult = IssuedOk | PortErr

export type UsedOk = PortOk & { readonly used: boolean }
export type UsedResult = UsedOk | PortErr

export type TxViewOk = PortOk & {
  readonly status: bigint
  readonly from: string
  readonly to: string
  readonly input: string
  readonly logs: readonly TxLog[]
}
export type TxViewResult = TxViewOk | PortErr

export type CoolingOk = PortOk & { readonly rows: readonly CoolingRow[] }
export type CoolingResult = CoolingOk | PortErr

export type ChainPort = {
  transactionReceipt(hash: string): Promise<TxViewResult>
  transactionByHash(hash: string): Promise<TxViewResult>
  pendingNonce(account: string): Promise<PortAmount>
  estimateGas(from: string, to: string, data: string): Promise<PortAmount>
  gasPrice(): Promise<PortAmount>
  latestBlockTime(): Promise<PortAmount>
  sendRaw?(raw: string): Promise<PortResult>
}

export type CorpTokenPort = {
  balanceOf(account: string, token?: string): Promise<PortAmount>
  allowance(owner: string, spender: string, token?: string): Promise<PortAmount>
  transfer(from: string, to: string, amount: bigint): Promise<PortResult>
}

export type VaultPort = {
  vaultCorp(): Promise<PortAmount>
  capitalOf(account: string): Promise<PortAmount>
  deposit(account: string, corpAmount: bigint): Promise<PortResult>
  mintCapital(account: string, corpAmount: bigint, capitalAmount: bigint): Promise<PortResult>
  signMintCapital(account: string, corpAmount: bigint, capitalAmount: bigint): Promise<PortResult>
  pending(account: string): Promise<PortAmount>
  backingOf(account: string): Promise<PortAmount>
  reservedOf(account: string): Promise<PortAmount>
  issued(nonce: string): Promise<IssuedResult>
  used(nonce: string): Promise<UsedResult>
  issueVoucher(voucher: Voucher): Promise<PortResult>
  presentVoucher(voucher: Voucher, nowS: bigint): Promise<PortResult>
  outcomeOf(nonce: string): Promise<PortAmount>
  releaseExpiredVoucher(nonce: string): Promise<PortResult>
}

export type StakeRegistryPort = {
  stake(account: string, ticker: string, amount: bigint): Promise<PortResult>
  requestUnstake(account: string, ticker: string, amount: bigint): Promise<PortResult>
  claimUnstaked(account: string, ticker: string): Promise<PortResult>
  snapshot(account: string): Promise<SnapshotResult>
  coolingSnapshot(account: string): Promise<CoolingResult>
}

export type MerkleRootsPort = {
  putRoot(cityId: string, cityDay: bigint, root: string): Promise<PortResult>
  getRoot(cityId: string, cityDay: bigint): Promise<RootResult>
}

export type PrizeTreasuryPort = {
  deposit(caller: string, token: string, kettle: bigint, amount: bigint): Promise<PortResult>
  owed(kettle: bigint, token: string, account: string): Promise<PortAmount>
  unsliced(kettle: bigint, token: string): Promise<PortAmount>
  batchUsed(batchId: string): Promise<PortAmount>
  slice(
    caller: string,
    batchId: string,
    token: string,
    kettle: bigint,
    players: readonly string[],
    amounts: readonly bigint[],
  ): Promise<PortResult>
  returnUnsettled(caller: string, token: string, kettle: bigint): Promise<PortResult>
  claimPrize(caller: string, token: string, kettle: bigint): Promise<PortResult>
}

export type AssetPort = {
  readonly kind: PortKind
  readonly voucherSignerService: string
  readonly buybackExecutorService: string
  readonly corpToken: CorpTokenPort
  readonly vault: VaultPort
  readonly stakeRegistry: StakeRegistryPort
  readonly merkleRoots: MerkleRootsPort
  readonly prizeTreasury: PrizeTreasuryPort
  readonly chain: ChainPort
}
