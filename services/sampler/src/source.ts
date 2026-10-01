const ADDR_RE = /^0x[0-9a-fA-F]{40}$/

export type SamplerEnv = { readonly [key: string]: string | undefined }

export type SamplerSource = "chain" | "pack" | "refuse"

export function isAddr(raw: string | undefined): boolean {
  return raw !== undefined && ADDR_RE.test(raw)
}

/** Chain when RPC and the ETH/USD feed are set. Pack seed is refused once deposits are open. */
export function samplerSource(env: SamplerEnv): SamplerSource {
  const rpc = env["CORPORATOR_RPC_URL"]
  const feed = env["CORPORATOR_FEED_ETH_USD"]
  const chain = rpc !== undefined && rpc.length > 0 && isAddr(feed)
  if (chain) return "chain"
  if (env["CORPORATOR_DEPOSITS_OPEN"] === "1") return "refuse"
  return "pack"
}
