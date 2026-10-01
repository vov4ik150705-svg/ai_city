import type { AssetPort } from "./port.js"
import { createMockPort } from "./mock.js"
import { createRpcPort } from "./rpc/index.js"
import { isPortKind, type PortConfig, type PortKind, type RpcTransport } from "./values.js"

export type {
  AssetPort,
  CorpTokenPort,
  MerkleRootsPort,
  PrizeTreasuryPort,
  RootOk,
  RootResult,
  SnapshotOk,
  SnapshotResult,
  StakeRegistryPort,
  VaultPort,
} from "./port.js"
export type {
  MockSeed,
  PortAmount,
  PortConfig,
  PortErr,
  PortKind,
  PortOk,
  PortResult,
  RpcOutcome,
  RpcTransport,
  StakeRow,
  Voucher,
  WalletPrice,
} from "./values.js"
export {
  amountOk,
  err,
  isPortKind,
  kettleOk,
  ok,
  OUTCOME_PRESENTED,
  OUTCOME_RELEASED,
  PRIZE_KETTLE_FARM,
  PRIZE_KETTLE_MONTH,
  silentTransport,
} from "./values.js"
export { createMockPort } from "./mock.js"
export { dataApprove, dataClaimUnstaked, dataDeposit, dataPresentVoucher, dataPrizeClaim, dataRequestUnstake, dataStake } from "./rpc/abi.js"
export { createLiveTransport, createRpcPort } from "./rpc/index.js"
export type { LiveContracts, LiveRpcConfig } from "./rpc/index.js"
export { fetchPoster, postEth } from "./rpc/jsonrpc.js"
export { addressOfPrivateKey, gasLimitOf, signLegacyTx } from "./rpc/sign.js"
export type { JsonRpcPost } from "./rpc/jsonrpc.js"
export { launchIntent, postSignedRaw, readCreatorTaxBps, readPlayerReady } from "./rpc/index.js"
export type { EnvMap, LaunchIntent, PlayerReady } from "./rpc/index.js"
export { lyingTransport, transportFromPort, transportFromPost } from "./rpc/fixture.js"
export { readWalletPrice, recordedStakeSnapshot } from "./wallet.js"
export { submitMinuteRoot } from "./submit.js"
export { createHttpIpfs, createMockIpfs } from "./ipfs.js"
export type { IpfsKind, IpfsPort, PinOk, PinResult } from "./ipfs.js"

export function createPort(kind: PortKind, cfg: PortConfig, transport?: RpcTransport): AssetPort {
  switch (kind) {
    case "mock":
      return createMockPort(cfg)
    case "rpc":
      return createRpcPort(cfg, transport)
    default: {
      const _never: never = kind
      return _never
    }
  }
}

export function createPortFromPack(kind: string, cfg: PortConfig, transport?: RpcTransport): AssetPort | undefined {
  if (!isPortKind(kind)) return undefined
  return createPort(kind, cfg, transport)
}
