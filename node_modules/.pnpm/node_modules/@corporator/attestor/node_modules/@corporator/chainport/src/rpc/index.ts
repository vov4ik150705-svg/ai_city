import type { AssetPort, CorpTokenPort, MerkleRootsPort, RootResult, SnapshotResult, StakeRegistryPort, VaultPort } from "../port.js"
import { silentTransport, type PortAmount, type PortConfig, type PortResult, type RpcOutcome, type RpcTransport, type Voucher } from "../values.js"
import { dec, decodeAmount, decodeResult, decodeRoot, decodeSnapshot, rpcMethod } from "./codec.js"

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
} {
  const corpToken: CorpTokenPort = {
    async balanceOf(account: string): Promise<PortAmount> {
      return decodeAmount(await invoke(transport, rpcMethod.balanceOf, [account]))
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
    async mintCapital(account: string, capitalAmount: bigint): Promise<PortResult> {
      return decodeResult(await invoke(transport, rpcMethod.mintCapital, [account, dec(capitalAmount)]))
    },
    async issueVoucher(voucher: Voucher): Promise<PortResult> {
      return decodeResult(await invoke(transport, rpcMethod.issueVoucher, voucherArgs(voucher)))
    },
    async presentVoucher(voucher: Voucher, nowS: bigint): Promise<PortResult> {
      return decodeResult(await invoke(transport, rpcMethod.presentVoucher, voucherArgs(voucher, nowS)))
    },
  }
  const stakeRegistry: StakeRegistryPort = {
    async stake(account: string, ticker: string, amount: bigint): Promise<PortResult> {
      return decodeResult(await invoke(transport, rpcMethod.stake, [account, ticker, dec(amount)]))
    },
    async snapshot(account: string): Promise<SnapshotResult> {
      return decodeSnapshot(await invoke(transport, rpcMethod.snapshot, [account]))
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
  return { corpToken, vault, stakeRegistry, merkleRoots }
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
  }
}
