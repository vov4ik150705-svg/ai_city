import { codes } from "@corporator/protocol"
import type { LlmPack } from "./pack.js"

export type ProviderResult = {
  readonly ok: boolean
  readonly text: string
}

export type LlmOut = {
  readonly text: string
  readonly template: boolean
  readonly code: string
}

export type LlmState = {
  readonly inFlight: bigint
}

export function emptyLlmState(): LlmState {
  return { inFlight: 0n }
}

export function completeLlm(pack: LlmPack, provider: ProviderResult): LlmOut {
  if (provider.ok) {
    return { text: provider.text, template: false, code: "" }
  }
  // DESIGN.md §5.4: provider refusal substitutes the template; the tick does not wait.
  if (pack.onProviderFail === "template") {
    return { text: pack.templateText, template: true, code: pack.templateCode }
  }
  return { text: pack.templateText, template: true, code: pack.templateCode }
}

export function enqueue(pack: LlmPack, state: LlmState): { readonly next: LlmState; readonly code: string } {
  if (state.inFlight >= pack.queueCapacity) {
    return { next: state, code: codes.COMPANION_QUEUE_FULL }
  }
  return { next: { inFlight: state.inFlight + 1n }, code: "" }
}
