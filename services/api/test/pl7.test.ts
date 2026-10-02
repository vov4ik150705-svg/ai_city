import { afterEach, describe, expect, it } from "vitest"
import { canonical } from "@corporator/contentpack"
import { listenBind, listenPorts, readyTemplate } from "@corporator/protocol"
import { remoteAttestor } from "../src/attest_client.ts"
import { publishBuybackFrame, useBuybackPoster } from "../src/buyback_frame.ts"
import { putBytes } from "../src/store.ts"
import { asBigint, bootHost } from "./harness.ts"

const BUYBACK_URL = "http://buyback.example/ready"
const ATTESTOR_URL = "http://attestor.example/ready"

afterEach(() => {
  useBuybackPoster(undefined)
})

function remember(name: string): string | undefined {
  return process.env[name]
}

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

async function withEnv(
  pairs: Readonly<Record<string, string | undefined>>,
  run: () => Promise<void>,
): Promise<void> {
  const prev = new Map<string, string | undefined>()
  for (const name of Object.keys(pairs)) prev.set(name, remember(name))
  for (const name of Object.keys(pairs)) setEnv(name, pairs[name])
  try {
    await run()
  } finally {
    for (const [name, value] of prev) setEnv(name, value)
  }
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function stubFetch(seen: string[], body: string): void {
  globalThis.fetch = async (input) => {
    seen.push(urlOf(input))
    return new Response(body, { status: 200 })
  }
}

async function liveSample(host: Awaited<ReturnType<typeof bootHost>>): Promise<void> {
  const now = asBigint(host.state["city_time"])
  const cfg = host.ctx.cfg
  await putBytes(
    host.store,
    "price_samples",
    "pl7:" + now.toString(),
    canonical({
      city_time: now,
      eth_usd_8dec: asBigint(cfg["eth_usd_8dec"]),
      corp_eth_wei_per_whole: asBigint(cfg["seed_corp_wei"]),
      dex_turnover_usd_8dec: asBigint(cfg["eth_usd_8dec"]) + 1n,
    }),
    undefined,
  )
}

describe("PL7 outbound service url", () => {
  it("bind 0.0.0.0 does not replace CORPORATOR_BUYBACK_URL", async () => {
    const seen: string[] = []
    const prev = globalThis.fetch
    stubFetch(seen, '{"ok":1,"degraded":0}')
    try {
      await withEnv(
        { CORPORATOR_LISTEN_BIND: "0.0.0.0", CORPORATOR_BUYBACK_URL: BUYBACK_URL },
        async () => {
          const host = await bootHost()
          await liveSample(host)
          expect(await publishBuybackFrame(host)).toBe(1n)
          expect(seen).toEqual([BUYBACK_URL])
          expect(seen.some((url) => url.includes("0.0.0.0"))).toBe(false)
        },
      )
    } finally {
      globalThis.fetch = prev
    }
  })

  it("bind 0.0.0.0 without a buyback url does not call 0.0.0.0", async () => {
    const seen: string[] = []
    const prev = globalThis.fetch
    stubFetch(seen, '{"ok":1,"degraded":0}')
    try {
      await withEnv(
        { CORPORATOR_LISTEN_BIND: "0.0.0.0", CORPORATOR_BUYBACK_URL: undefined },
        async () => {
          const host = await bootHost()
          await liveSample(host)
          expect(await publishBuybackFrame(host)).toBe(0n)
          expect(seen.some((url) => url.includes("0.0.0.0"))).toBe(false)
        },
      )
    } finally {
      globalThis.fetch = prev
    }
  })

  it("bind 0.0.0.0 does not replace CORPORATOR_ATTESTOR_URL", async () => {
    const seen: string[] = []
    const prev = globalThis.fetch
    stubFetch(seen, '{"rootHex":"aa","cidHex":"bb","badge":"cc"}')
    try {
      await withEnv(
        { CORPORATOR_LISTEN_BIND: "0.0.0.0", CORPORATOR_ATTESTOR_URL: ATTESTOR_URL },
        async () => {
          const got = await remoteAttestor().submit(new Uint8Array([1]))
          expect(got).toEqual({ rootHex: "aa", cidHex: "bb", badge: "cc" })
          expect(seen).toEqual([ATTESTOR_URL])
          expect(seen.some((url) => url.includes("0.0.0.0"))).toBe(false)
        },
      )
    } finally {
      globalThis.fetch = prev
    }
  })

  it("empty urls on loopback use listenPorts and the pack ready path", async () => {
    const seen: string[] = []
    const prev = globalThis.fetch
    stubFetch(seen, '{"ok":1,"degraded":0}')
    try {
      await withEnv(
        {
          CORPORATOR_LISTEN_BIND: listenBind,
          CORPORATOR_BUYBACK_URL: undefined,
          CORPORATOR_ATTESTOR_URL: undefined,
        },
        async () => {
          const host = await bootHost()
          await liveSample(host)
          expect(await publishBuybackFrame(host)).toBe(1n)
          expect(seen).toEqual([
            "http://" + listenBind + ":" + listenPorts.buyback.toString() + readyTemplate,
          ])
        },
      )
    } finally {
      globalThis.fetch = prev
    }
  })
})
