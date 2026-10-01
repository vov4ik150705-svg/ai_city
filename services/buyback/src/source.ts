import { codes } from "@corporator/protocol"
import type { ConveyorBatch, ConveyorState } from "./conveyor.js"

export type ConveyorPull =
  | { readonly ok: true; readonly batch: ConveyorBatch }
  | { readonly ok: false; readonly code: string }

export type ConveyorSource = {
  pull(body?: Uint8Array, state?: ConveyorState): Promise<ConveyorPull>
}

// Mock remains the source until selectConveyorSource sees a full RPC env and CORPORATOR_HOP_URL.
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
