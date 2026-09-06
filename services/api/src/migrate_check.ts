import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const sqlPath = join(here, "..", "migrations", "001_from_pack.sql")

async function main(): Promise<void> {
  const sql = readFileSync(sqlPath, "utf8")
  if (!sql.includes("CONSTRAINT demo_wallet_barrier CHECK (from_kind = to_kind)")) {
    throw new Error("migrate:check: DDL missing demo_wallet_barrier")
  }
  const db = new PGlite()
  const ready = (db as { readonly waitReady?: Promise<void> }).waitReady
  if (ready !== undefined) await ready
  await db.exec(sql)
  let crossed = false
  try {
    await db.query("INSERT INTO demo_wallet_transfers (id, from_kind, to_kind) VALUES ($1, $2, $3)", [
      "x",
      "demo",
      "wallet",
    ])
    crossed = true
  } catch {
    crossed = false
  }
  if (crossed) {
    throw new Error("migrate:check: demo→wallet INSERT succeeded")
  }
  await db.query("INSERT INTO demo_wallet_transfers (id, from_kind, to_kind) VALUES ($1, $2, $3)", [
    "y",
    "demo",
    "demo",
  ])
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : "migrate:check failed"
  process.stderr.write(msg + "\n")
  process.exitCode = 1
})
