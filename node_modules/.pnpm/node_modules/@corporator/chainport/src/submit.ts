import { codes } from "@corporator/protocol"
import type { AssetPort } from "./port.js"
import { err, type PortResult } from "./values.js"

// Fail-open: a down RPC must not throw into the attestor or the tick. docs/TICK.md §9.
export async function submitMinuteRoot(
  port: AssetPort,
  cityId: string,
  cityDay: bigint,
  rootHex: string,
): Promise<PortResult> {
  try {
    return await port.merkleRoots.putRoot(cityId, cityDay, rootHex)
  } catch {
    return err(codes.SERVICE_DEGRADED)
  }
}
