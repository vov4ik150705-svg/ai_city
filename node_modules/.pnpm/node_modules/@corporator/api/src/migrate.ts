import { type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { putJson, type Store } from "./store.js"
import { LoadError } from "./values.js"

export function versionFromFilename(name: string): bigint {
  let digits = ""
  for (const ch of name) {
    if (ch < "0" || ch > "9") break
    digits += ch
  }
  if (digits.length === 0) throw new LoadError(codes.API_MALFORMED)
  return BigInt(digits)
}

export async function applyMigration(
  store: Store,
  sql: string,
  filename: string,
  packHash: string,
): Promise<bigint> {
  await store.exec(sql)
  const version = versionFromFilename(filename)
  const payload: Json = { version, pack_hash: packHash }
  await putJson(store, "schema_migrations", "head", payload, undefined)
  return version
}
