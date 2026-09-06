import { fromUtf8, parseJson } from "@corporator/contentpack"
import { getBytes, putJson, type Store } from "./store.js"
import { asBigint, asObj } from "./values.js"

function rateKey(cityId: string, tickIndex: bigint): string {
  return cityId + ":" + tickIndex.toString()
}

function payloadBytes(payload: unknown): Uint8Array | undefined {
  if (payload instanceof Uint8Array) return Uint8Array.from(payload)
  if (payload instanceof ArrayBuffer) return new Uint8Array(payload)
  return undefined
}

export async function incrementCommandRate(
  store: Store,
  cityId: string,
  tickIndex: bigint,
  limit: bigint,
): Promise<"ok" | "limited"> {
  const id = rateKey(cityId, tickIndex)
  await store.exec("BEGIN")
  try {
    const rows = await store.query("SELECT payload FROM command_rates WHERE id = $1 FOR UPDATE", [id])
    let n = 0n
    const row = rows[0]
    if (row !== undefined) {
      const payload = payloadBytes(row["payload"])
      if (payload !== undefined) {
        const parsed = parseJson(fromUtf8(payload))
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
          n = asBigint(asObj(parsed)["n"])
        }
      }
    }
    if (n >= limit) {
      await store.exec("ROLLBACK")
      return "limited"
    }
    const next = n + 1n
    await putJson(store, "command_rates", id, { n: next.toString() }, undefined)
    await store.exec("COMMIT")
    return "ok"
  } catch (err) {
    await store.exec("ROLLBACK")
    throw err
  }
}

export async function readCommandRate(store: Store, cityId: string, tickIndex: bigint): Promise<bigint> {
  const got = await getBytes(store, "command_rates", rateKey(cityId, tickIndex))
  if (got === undefined) return 0n
  const parsed = parseJson(fromUtf8(got))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return 0n
  return asBigint(asObj(parsed)["n"])
}
