import { codes } from "@corporator/protocol"
import { submitMinuteRoot, type AssetPort } from "@corporator/chainport"

export type RootJob = {
  readonly cityId: string
  readonly cityDay: bigint
  readonly rootHex: string
}

export type DrainOut = {
  readonly rest: readonly RootJob[]
  readonly degraded: string
}

export async function drainRootOutbox(port: AssetPort, jobs: readonly RootJob[]): Promise<DrainOut> {
  const rest: RootJob[] = []
  let degraded = ""
  for (const job of jobs) {
    const result = await submitMinuteRoot(port, job.cityId, job.cityDay, job.rootHex)
    if (result.ok) continue
    rest.push(job)
    degraded = codes.SERVICE_DEGRADED
  }
  return { rest, degraded }
}
