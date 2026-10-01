import type {
  AssetPort,
  ChainPort,
  CorpTokenPort,
  IssuedResult,
  MerkleRootsPort,
  PrizeTreasuryPort,
  RootResult,
  SnapshotResult,
  StakeRegistryPort,
  TxViewResult,
  UsedResult,
  VaultPort,
  CoolingResult,
} from "../port.js"
import { silentTransport, type PortAmount, type PortConfig, type PortResult, type RpcOutcome, type RpcTransport, type Voucher } from "../values.js"
import {
  dec,
  decodeAmount,
  decodeIssued,
  decodeCoolingSnapshot,
  decodeResult,
  decodeRoot,
  decodeSnapshot,
  decodeTxView,
  decodeUsed,
  encodeDecList,
  encodeStringList,
  rpcMethod,
} from "./codec.js"

export { createLiveTransport } from "./live.js"
export type { LiveContracts, LiveRpcConfig } from "./live.js"
export type { JsonRpcPost } from "./jsonrpc.js"
export { launchIntent, postSignedRaw, readCreatorTaxBps } from "./launch.js"
export type { LaunchIntent } from "./launch.js"
export { readPlayerReady } from "./playerReady.js"
export type { EnvMap, PlayerReady } from "./playerReady.js"

async function invoke(transport: RpcTransport, method: string, args: readonly string[]): Promise<RpcOutcome> {
  try {
    return await transport.call(method, args)
  } catch {
    return { status: "silence" }
  }
}

function voucherArgs(voucher: Voucher, nowS?: bigint): readonly string[] {
  if (nowS === undefined) {
    return [voucher.nonce, voucher.account, dec(voucher.corpAmount), dec(voucher.issuedAtS)]
  }
  return [voucher.nonce, voucher.account, dec(voucher.corpAmount), dec(voucher.issuedAtS), dec(nowS)]
}

function bind(transport: RpcTransport): {
  readonly corpToken: CorpTokenPort
  readonly vault: VaultPort
  readonly stakeRegistry: StakeRegistryPort
  readonly merkleRoots: MerkleRootsPort
  readonly prizeTreasury: PrizeTreasuryPort
  readonly chain: ChainPort
} {
  const corpToken: CorpTokenPort = {
    async balanceOf(account: string, token?: string): Promise<PortAmount> {
      const args = token !== undefined && token.length > 0 ? [account, token] : [account]
      return decodeAmount(await invoke(transport, rpcMethod.balanceOf, args))
    },
    async allowance(owner: string, spender: string, token?: string): Promise<PortAmount> {
      const args = token !== undefined && token.length > 0 ? [owner, spender, token] : [owner, spender]
      return decodeAmount(await invoke(transport, rpcMethod.allowance, args))
    },
    async transfer(from: string, to: string, amount: bigint): Promise<PortResult> {
      return decodeResult(await invoke(transport, rpcMethod.transfer, [from, to, dec(amount)]))
    },
  }
  const vault: VaultPort = {
    async vaultCorp(): Promise<PortAmount> {
      return decodeAmount(await invoke(transport, rpcMethod.vaultCorp, []))
    },
    async capitalOf(account: string): Promise<PortAmount> {
      return decodeAmount(await invoke(transport, rpcMethod.capitalOf, [account]))
    },
    async deposit(account: string, corpAmount: bigint): Promise<PortResult> {
      return decodeResult(await invoke(transport, rpcMethod.deposit, [account, dec(corpAmount)]))
    },
    async mintCapital(account: string, corpAmount: bigint, capitalAmount: bigint): Promise<PortResult> {
      return decodeResult(
        await invoke(transport, rpcMethod.mintCapital, [account, dec(corpAmount), dec(capitalAmount)]),
      )
    },
    async signMintCapital(account: string, corpAmount: bigint, capitalAmount: bigint): Promise<PortResult> {
      return decodeResult(
        await invoke(transport, rpcMethod.signMintCapital, [account, dec(corpAmount), dec(capitalAmount)]),
      )
    },
    async pending(account: string): Promise<PortAmount> {
      return decodeAmount(await invoke(transport, rpcMethod.vaultPending, [account]))
    },
    async backingOf(account: string): Promise<PortAmount> {
      return decodeAmount(await invoke(transport, rpcMethod.vaultBacking, [account]))
    },
    async reservedOf(account: string): Promise<PortAmount> {
      return decodeAmount(await invoke(transport, rpcMethod.vaultReserved, [account]))
    },
    async issued(nonce: string): Promise<IssuedResult> {
      return decodeIssued(await invoke(transport, rpcMethod.vaultIssued, [nonce]))
    },
    async used(nonce: string): Promise<UsedResult> {
      return decodeUsed(await invoke(transport, rpcMethod.vaultUsed, [nonce]))
    },
    async issueVoucher(voucher: Voucher): Promise<PortResult> {
      return decodeResult(await invoke(transport, rpcMethod.issueVoucher, voucherArgs(voucher)))
    },
    async presentVoucher(voucher: Voucher, nowS: bigint): Promise<PortResult> {
      return decodeResult(await invoke(transport, rpcMethod.presentVoucher, voucherArgs(voucher, nowS)))
    },
    async outcomeOf(nonce: string): Promise<PortAmount> {
      return decodeAmount(await invoke(transport, rpcMethod.vaultOutcome, [nonce]))
    },
    async releaseExpiredVoucher(nonce: string): Promise<PortResult> {
      return decodeResult(await invoke(transport, rpcMethod.releaseExpiredVoucher, [nonce]))
    },
  }
  const stakeRegistry: StakeRegistryPort = {
    async stake(account: string, ticker: string, amount: bigint): Promise<PortResult> {
      return decodeResult(await invoke(transport, rpcMethod.stake, [account, ticker, dec(amount)]))
    },
    async requestUnstake(account: string, ticker: string, amount: bigint): Promise<PortResult> {
      return decodeResult(await invoke(transport, rpcMethod.requestUnstake, [account, ticker, dec(amount)]))
    },
    async claimUnstaked(account: string, ticker: string): Promise<PortResult> {
      return decodeResult(await invoke(transport, rpcMethod.claimUnstaked, [account, ticker]))
    },
    async snapshot(account: string): Promise<SnapshotResult> {
      return decodeSnapshot(await invoke(transport, rpcMethod.snapshot, [account]))
    },
    async coolingSnapshot(account: string): Promise<CoolingResult> {
      return decodeCoolingSnapshot(await invoke(transport, rpcMethod.coolingSnapshot, [account]))
    },
  }
  const merkleRoots: MerkleRootsPort = {
    async putRoot(cityId: string, cityDay: bigint, root: string): Promise<PortResult> {
      return decodeResult(await invoke(transport, rpcMethod.putRoot, [cityId, dec(cityDay), root]))
    },
    async getRoot(cityId: string, cityDay: bigint): Promise<RootResult> {
      return decodeRoot(await invoke(transport, rpcMethod.getRoot, [cityId, dec(cityDay)]))
    },
  }
  const prizeTreasury: PrizeTreasuryPort = {
    async deposit(caller: string, token: string, kettle: bigint, amount: bigint): Promise<PortResult> {
      return decodeResult(await invoke(transport, rpcMethod.prizeDeposit, [caller, token, dec(kettle), dec(amount)]))
    },
    async owed(kettle: bigint, token: string, account: string): Promise<PortAmount> {
      return decodeAmount(await invoke(transport, rpcMethod.owed, [dec(kettle), token, account]))
    },
    async unsliced(kettle: bigint, token: string): Promise<PortAmount> {
      return decodeAmount(await invoke(transport, rpcMethod.unsliced, [dec(kettle), token]))
    },
    async batchUsed(batchId: string): Promise<PortAmount> {
      return decodeAmount(await invoke(transport, rpcMethod.batchUsed, [batchId]))
    },
    async slice(
      caller: string,
      batchId: string,
      token: string,
      kettle: bigint,
      players: readonly string[],
      amounts: readonly bigint[],
    ): Promise<PortResult> {
      return decodeResult(
        await invoke(transport, rpcMethod.prizeSlice, [
          caller,
          batchId,
          token,
          dec(kettle),
          encodeStringList(players),
          encodeDecList(amounts),
        ]),
      )
    },
    async returnUnsettled(caller: string, token: string, kettle: bigint): Promise<PortResult> {
      return decodeResult(await invoke(transport, rpcMethod.prizeReturnUnsettled, [caller, token, dec(kettle)]))
    },
    async claimPrize(caller: string, token: string, kettle: bigint): Promise<PortResult> {
      return decodeResult(await invoke(transport, rpcMethod.prizeClaimPrize, [caller, token, dec(kettle)]))
    },
  }
  const chain: ChainPort = {
    async transactionReceipt(hash: string): Promise<TxViewResult> {
      return decodeTxView(await invoke(transport, rpcMethod.txReceipt, [hash]))
    },
    async transactionByHash(hash: string): Promise<TxViewResult> {
      return decodeTxView(await invoke(transport, rpcMethod.txByHash, [hash]))
    },
    async pendingNonce(account: string): Promise<PortAmount> {
      return decodeAmount(await invoke(transport, rpcMethod.pendingNonce, [account]))
    },
    async estimateGas(from: string, to: string, data: string): Promise<PortAmount> {
      return decodeAmount(await invoke(transport, rpcMethod.estimateGas, [from, to, data]))
    },
    async gasPrice(): Promise<PortAmount> {
      return decodeAmount(await invoke(transport, rpcMethod.gasPrice, []))
    },
    async latestBlockTime(): Promise<PortAmount> {
      return decodeAmount(await invoke(transport, rpcMethod.latestBlockTime, []))
    },
    async sendRaw(raw: string): Promise<PortResult> {
      return decodeResult(await invoke(transport, rpcMethod.sendRaw, [raw]))
    },
  }
  return { corpToken, vault, stakeRegistry, merkleRoots, prizeTreasury, chain }
}

export function createRpcPort(cfg: PortConfig, transport?: RpcTransport): AssetPort {
  const bound = bind(transport === undefined ? silentTransport() : transport)
  return {
    kind: "rpc",
    voucherSignerService: cfg.voucherSignerService,
    buybackExecutorService: cfg.buybackExecutorService,
    corpToken: bound.corpToken,
    vault: bound.vault,
    stakeRegistry: bound.stakeRegistry,
    merkleRoots: bound.merkleRoots,
    prizeTreasury: bound.prizeTreasury,
    chain: bound.chain,
  }
}
