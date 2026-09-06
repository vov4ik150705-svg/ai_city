import { codes } from "@corporator/protocol"

export type ActionRow = {
  readonly id: string
  readonly screen: string
  readonly label: string
  readonly effect: string
  readonly spend: string
  readonly demoBlocked: boolean
  readonly v1: string
  readonly requires: readonly string[]
}

export type CapabilityRow = {
  readonly id: string
  readonly code: string
  readonly tier: bigint
  readonly kind: string
}

export function attemptAction(args: {
  readonly demo: boolean
  readonly isolated: boolean
  readonly action: ActionRow
  readonly capabilities: { readonly [id: string]: CapabilityRow }
}): string | undefined {
  if (args.demo && args.isolated && args.action.demoBlocked) {
    for (const req of args.action.requires) {
      if (!req.startsWith("not_demo_")) continue
      const cap = args.capabilities[req]
      if (cap !== undefined) return cap.code
    }
    return codes.DEMO_NO_WITHDRAW
  }
  if (args.action.v1 === "stub") return codes.FEATURE_NOT_IN_V1
  return undefined
}
