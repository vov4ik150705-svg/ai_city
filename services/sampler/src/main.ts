import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { loadPack } from "@corporator/contentpack"
import { listenPorts } from "@corporator/protocol"
import { loadSamplerPack } from "./pack.js"
import { listenReady } from "./ready.js"
import { samplerSource } from "./source.js"
import { memoryPriceStore, startPriceLoop } from "./loop.js"
import { fetchPoster } from "@corporator/chainport"

function packPath(): string {
  const env = process.env.PACK_PATH
  if (env !== undefined && env.length > 0) return env
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "content", "out", "pack.json")
}

export async function startMain(): Promise<void> {
  const expect = process.env.PACK_HASH
  if (expect === undefined || expect.length === 0) {
    process.exitCode = 1
    return
  }
  const bytes = new Uint8Array(readFileSync(packPath()))
  const loaded = loadPack(bytes)
  if (loaded.hash !== expect) {
    process.exitCode = 1
    return
  }
  const source = samplerSource(process.env)
  if (source === "refuse") {
    process.exitCode = 1
    return
  }
  const pack = loadSamplerPack(bytes)
  const post =
    source === "chain" && process.env.CORPORATOR_RPC_URL !== undefined
      ? fetchPoster(process.env.CORPORATOR_RPC_URL, pack.periodMs)
      : undefined
  const loop = startPriceLoop(pack, source, memoryPriceStore(), post, process.env)
  const ready = await listenReady(loaded.hash, listenPorts.sampler)
  const stop = (): void => {
    loop.stop()
    void ready.close()
  }
  process.on("SIGTERM", stop)
  process.on("SIGINT", stop)
}

const argv1 = process.argv[1]
if (argv1 !== undefined && pathToFileURL(resolve(argv1)).href === import.meta.url) {
  void startMain()
}
