import {
  readWalletPrice,
  type AssetPort,
  type RpcTransport,
  type WalletPrice,
} from "@corporator/chainport"

export async function stepWalletPrice(
  port: AssetPort,
  account: string,
  transport: RpcTransport | undefined,
  last: WalletPrice | undefined,
): Promise<WalletPrice> {
  return readWalletPrice(port, account, transport, last)
}
