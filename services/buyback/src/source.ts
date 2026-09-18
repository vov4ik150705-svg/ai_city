import { codes } from "@corporator/protocol"
import type { ConveyorBatch } from "./conveyor.js"

export type ConveyorPull =
  | { readonly ok: true; readonly batch: ConveyorBatch }
  | { readonly ok: false; readonly code: string }

export type ConveyorSource = {
  pull(): Promise<ConveyorPull>
}

// TODO: production HTTP/DB transport. Until a host adapter exists the runner
// stays mock-backed and fail-open with SERVICE_DEGRADED.
export function createMockConveyorSource(): ConveyorSource {
  return {
    async pull(): Promise<ConveyorPull> {
      return { ok: false, code: codes.SERVICE_DEGRADED }
    },
  }
}

export function createCannedConveyorSource(batch: ConveyorBatch): ConveyorSource {
  return {
    async pull(): Promise<ConveyorPull> {
      return { ok: true, batch }
    },
  }
}
