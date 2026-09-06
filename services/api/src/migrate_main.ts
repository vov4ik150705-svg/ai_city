import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { loadPack } from "@corporator/contentpack"
import { applyMigration } from "./migrate.js"
import { defaultPackPath, migrationSql, repoRootFrom } from "./boot.js"
import { openPg } from "./store.js"

export async function startMigrate(): Promise<void> {
  const expect = process.env.PACK_HASH
  if (expect === undefined || expect.length === 0) {
    process.exitCode = 1
    return
  }
  const dsn = process.env.DATABASE_URL
  if (dsn === undefined || dsn.length === 0) {
    process.exitCode = 1
    return
  }
  const root = repoRootFrom(import.meta.url)
  const envPath = process.env.PACK_PATH
  const path = envPath !== undefined && envPath.length > 0 ? envPath : defaultPackPath(root)
  const bytes = new Uint8Array(readFileSync(path))
  const loaded = loadPack(bytes)
  if (loaded.hash !== expect) {
    process.exitCode = 1
    return
  }
  const store = await openPg(dsn)
  const mig = migrationSql(root)
  await applyMigration(store, mig.sql, mig.name, loaded.hash)
  await store.close()
}

const argv1 = process.argv[1]
if (argv1 !== undefined && pathToFileURL(resolve(argv1)).href === import.meta.url) {
  void startMigrate()
}
