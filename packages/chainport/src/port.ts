import type { PortAmount, PortErr, PortKind, PortOk, PortResult, StakeRow, Voucher } from "./values.js"

export type SnapshotOk = PortOk & { readonly rows: readonly StakeRow[] }
export type SnapshotResult = SnapshotOk | PortErr

export type RootOk = PortOk & { readonly root: string }
export type RootResult = RootOk | PortErr

export type CorpTokenPort = {
  balanceOf(account: string): Promise<PortAmount>
  transfer(from: string, to: string, amount: bigint): Promise<PortResult>
}

export type VaultPort = {
  vaultCorp(): Promise<PortAmount>
  capitalOf(account: string): Promise<PortAmount>
  deposit(account: string, corpAmount: bigint): Promise<PortResult>
  mintCapital(account: string, capitalAmount: bigint): Promise<PortResult>
  issueVoucher(voucher: Voucher): Promise<PortResult>
  presentVoucher(voucher: Voucher, nowS: bigint): Promise<PortResult>
}

export type StakeRegistryPort = {
  stake(account: string, ticker: string, amount: bigint): Promise<PortResult>
  unstake(account: string, ticker: string, amount: bigint): Promise<PortResult>
  snapshot(account: string): Promise<SnapshotResult>
}

export type MerkleRootsPort = {
  putRoot(cityId: string, cityDay: bigint, root: string): Promise<PortResult>
  getRoot(cityId: string, cityDay: bigint): Promise<RootResult>
}

export type PrizeTreasuryPort = {
  deposit(caller: string, token: string, kettle: bigint, amount: bigint): Promise<PortResult>
  slice(
    caller: string,
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
}
