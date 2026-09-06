import { bytesToHex } from "@corporator/engine"
import { submitMinuteRoot as putHex, type AssetPort, type PortResult } from "@corporator/chainport"

export async function submitMinuteRoot(
  port: AssetPort,
  cityId: string,
  cityDay: bigint,
  root: Uint8Array,
): Promise<PortResult> {
  return putHex(port, cityId, cityDay, bytesToHex(root))
}
