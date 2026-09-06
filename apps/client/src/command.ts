import { canonical, type Json } from "@corporator/contentpack"
import { sessionHeader, sessionScheme } from "@corporator/protocol"

export type PostFn = (
  url: string,
  body: Uint8Array,
  headers: { readonly [name: string]: string },
) => Promise<{ readonly status: number; readonly body: Uint8Array }>

export function applyPath(template: string, param: string, value: string): string {
  const token = "{" + param + "}"
  return template.split(token).join(value)
}

export async function postCommand(args: {
  readonly origin: string
  readonly effect: string
  readonly commandTemplate: string
  readonly cityId: string
  readonly intentId: string
  readonly expectedCityTime: bigint
  readonly sessionId: string
  readonly extra?: { readonly [key: string]: Json }
  readonly post: PostFn
}): Promise<{ readonly status: number; readonly body: Uint8Array }> {
  void args.cityId
  const path = applyPath(args.commandTemplate, "effect", args.effect)
  const payload: { [key: string]: Json } = {
    intent_id: args.intentId,
    expected_city_time: args.expectedCityTime,
  }
  if (args.extra !== undefined) {
    for (const key of Object.keys(args.extra)) {
      const val = args.extra[key]
      if (val !== undefined) payload[key] = val
    }
  }
  const headers: { [name: string]: string } = {}
  headers[sessionHeader] = sessionScheme + " " + args.sessionId
  return args.post(args.origin + path, canonical(payload), headers)
}

export function nextIntentId(cityId: string, cityTime: bigint, seq: bigint): string {
  return cityId + ":" + cityTime.toString() + ":" + seq.toString()
}
