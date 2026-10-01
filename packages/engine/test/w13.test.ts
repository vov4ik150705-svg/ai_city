import { describe, expect, it } from "vitest"
import { applyDexTurnover, loadConfig, newState, tick, updateMintRate } from "../src/index.ts"
import { asBig, asDict } from "../src/values.ts"
import type { Dict } from "../src/values.ts"
import { loadPack, makeInputs } from "./harness.ts"

function emptyTreasury(): Dict {
  return {
    treasury_eth: 0n,
    treasury_fund_eth: 0n,
    treasury_basket_eth: 0n,
    treasury_leaderboard_eth: 0n,
    treasury_farm_eth: 0n,
    treasury_studio_eth: 0n,
    treasury_spec_eth: 0n,
    treasury_city_eth: 0n,
    acc: {},
    day_mon: {},
  }
}

describe("W13 turnover uses the input price", () => {
  it("taxes the tick from inputs eth_usd and a zero sample does not zero the mint rate", () => {
    const cfg = loadConfig(loadPack())
    const packEth = asBig(cfg["eth_usd_8dec"])
    const inputEth = packEth * 2n
    expect(inputEth !== packEth).toBe(true)
    const turnover = asBig(cfg["share_bps"])
    const share = asBig(cfg["share_bps"])
    const taxUsd = (turnover * asBig(cfg["creator_tax_bps"])) / share
    const fromInput = (taxUsd * asBig(cfg["wei"])) / inputEth
    const fromPack = (taxUsd * asBig(cfg["wei"])) / packEth
    expect(fromInput !== fromPack).toBe(true)
    const state = emptyTreasury()
    applyDexTurnover(cfg, state, turnover, inputEth)
    expect(asBig(asDict(state["day_mon"])["tax_eth"])).toBe(fromInput)
    expect(asBig(state["treasury_fund_eth"])).not.toBe(fromPack)

    const live = newState(cfg, {}, {})
    const first = tick(live, makeInputs(cfg, 3n, { dex_turnover_usd_8dec: 0n }))
    const rate = asBig(first[0]["mint_rate"])
    expect(rate > 0n).toBe(true)
    const held: Dict = {
      tick_index: 3n,
      mint_rate: rate,
      last_live_tick: 3n,
      stale_hours: 0n,
      rate_raw_last: rate,
      rate_ref: rate,
      ema_buf: [rate],
      codes: [],
    }
    updateMintRate(
      cfg,
      held,
      {
        feed_live: 1n,
        eth_usd_8dec: 0n,
        corp_eth_wei_per_whole: asBig(cfg["seed_corp_wei"]),
      },
      3n,
    )
    expect(asBig(held["mint_rate"])).toBe(rate)
    expect(asBig(held["mint_rate"])).not.toBe(0n)
  })
})
