import { parseJson, fromUtf8 } from "@corporator/contentpack"
import { type PackCtx } from "./pack_ctx.js"
import { getBytes } from "./store.js"
import type { Store } from "./store.js"
import { asBigint, asObj, asText } from "./values.js"

export type Readiness = {
  readonly ready: boolean
  readonly pack_hash: string
  readonly migration_version: bigint
}

export async function readMigrationHead(store: Store): Promise<{ hash: string; version: bigint } | undefined> {
  const bytes = await getBytes(store, "schema_migrations", "head")
  if (bytes === undefined) return undefined
  const row = asObj(parseJson(fromUtf8(bytes)))
  return {
    hash: asText(row["pack_hash"]),
    version: asBigint(row["version"]),
  }
}

export async function evaluateReadiness(
  ctx: PackCtx,
  store: Store,
  expectVersion: bigint,
): Promise<Readiness> {
  const head = await readMigrationHead(store)
  if (head === undefined) {
    return { ready: false, pack_hash: "", migration_version: 0n }
  }
  const packOk = head.hash === ctx.hash
  const migOk = head.version === expectVersion
  return {
    ready: packOk && migOk,
    pack_hash: head.hash,
    migration_version: head.version,
  }
}

export function readinessRequiresPack(ctx: PackCtx): boolean {
  let hasHash = false
  let hasMig = false
  for (const item of ctx.readinessRequires) {
    if (item === "pack_hash") hasHash = true
    if (item === "migration_version") hasMig = true
  }
  return hasHash && hasMig
}
