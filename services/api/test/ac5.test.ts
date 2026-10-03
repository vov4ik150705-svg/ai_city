import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

const LIVE_NAMES = [
  "CORPORATOR_DEPOSITS_OPEN",
  "CORPORATOR_RPC_URL",
  "CORPORATOR_CHAIN_ID",
  "CORPORATOR_RPC_TIMEOUT_MS",
  "CORPORATOR_CORP_TOKEN",
  "CORPORATOR_VAULT",
  "CORPORATOR_STAKE_REGISTRY",
  "CORPORATOR_MERKLE_ROOTS",
  "CORPORATOR_PRIZE_TREASURY",
  "CORPORATOR_HOP_URL",
  "CORPORATOR_FEED_ETH_USD",
  "CORPORATOR_IPFS_PIN_URL",
  "CORPORATOR_IPFS_PIN_TOKEN",
  "CORPORATOR_VAULT_HOUSE",
  "CORPORATOR_POOL_ADDRESS",
  "CORPORATOR_POOL_KIND",
  "CORPORATOR_POOL_ID",
  "CORPORATOR_ATTESTOR_KEY",
  "CORPORATOR_STOCK_NVDA",
  "CORPORATOR_STOCK_TSLA",
  "CORPORATOR_STOCK_AMZN",
  "CORPORATOR_STOCK_AAPL",
  "CORPORATOR_STOCK_MSFT",
  "CORPORATOR_STOCK_COIN",
] as const

function assignment(text: string, name: string): string | undefined {
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith(`${name}=`)) return line.slice(name.length + 1)
  }
  return undefined
}

describe("ac5_env_example", () => {
  it("env example lists the live port names", () => {
    const text = readFileSync(join(repo, "deploy/.env.example"), "utf8")
    for (const name of LIVE_NAMES) {
      expect(assignment(text, name), name).toBe("")
    }
    const pack = JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as {
      generated?: { api?: { unstake_cooldown_s?: number } }
    }
    const cooldown = pack.generated?.api?.unstake_cooldown_s
    expect(assignment(text, "CORPORATOR_UNSTAKE_COOLDOWN_S")).toBe(String(cooldown))
    for (const line of text.split(/\r?\n/)) {
      if (!line.includes("=") || line.startsWith("#")) continue
      const eq = line.indexOf("=")
      const name = line.slice(0, eq)
      const value = line.slice(eq + 1)
      if (name.endsWith("_KEY") || name === "CORPORATOR_IPFS_PIN_TOKEN") expect(value, name).toBe("")
    }
    const dropped = spawnSync(
      "python",
      [
        "-c",
        [
          "import sys",
          "sys.path.insert(0, 'content')",
          "import build, codegen",
          "pack, _ = build.build_pack()",
          "arch = pack['sections']['arch']['env']['vars']",
          "del arch['CORPORATOR_RPC_URL']",
          "text = codegen.emit_env_example(pack)",
          "print('MISS' if 'CORPORATOR_RPC_URL=' not in text else 'HAS')",
        ].join("\n"),
      ],
      { cwd: repo, encoding: "utf8" },
    )
    expect(dropped.status).toBe(0)
    expect(dropped.stdout.trim()).toBe("MISS")
  })
})
