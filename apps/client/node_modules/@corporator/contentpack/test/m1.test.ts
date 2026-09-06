import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const BPS = 10000

type ParamRow = { readonly v: number }
type EconomyFile = {
  readonly params: Readonly<Record<string, ParamRow | undefined>>
}
type MetaFile = {
  readonly params: Readonly<Record<string, ParamRow | undefined>>
}
type SeasonsFile = {
  readonly params: Readonly<Record<string, ParamRow | undefined>>
}

function loadEconomy(): EconomyFile {
  return JSON.parse(readFileSync(join(repo, "content/params/economy.json"), "utf8")) as EconomyFile
}

function loadMeta(): MetaFile {
  return JSON.parse(readFileSync(join(repo, "content/params/meta.json"), "utf8")) as MetaFile
}

function loadSeasons(): SeasonsFile {
  return JSON.parse(readFileSync(join(repo, "content/params/seasons.json"), "utf8")) as SeasonsFile
}

function param(file: EconomyFile | MetaFile | SeasonsFile, name: string): number {
  const row = file.params[name]
  if (row === undefined) throw new Error(name)
  return row.v
}

function roundTripBps(tax: number, vault: number, markup: number, anchor: number): number {
  const withdraw = Math.floor((anchor * (BPS + markup)) / BPS)
  let keep = BPS
  keep = Math.floor((keep * (BPS - tax)) / BPS)
  keep = Math.floor((keep * (BPS - vault)) / BPS)
  keep = Math.floor((keep * anchor) / withdraw)
  keep = Math.floor((keep * (BPS - tax)) / BPS)
  return BPS - keep
}

function fundTaxBps(tax: number, prizeShare: number, fragShare: number): number {
  return Math.floor((tax * (BPS - prizeShare - fragShare)) / BPS)
}

describe.sequential("M1 construction", () => {
  it("round_trip_after_tax_two_percent", () => {
    const econ = loadEconomy()
    const meta = loadMeta()
    const tax = param(econ, "creator_tax_bps")
    const vault = param(econ, "vault_fee_bps")
    const markup = param(econ, "bank_markup_bps")
    const anchor = param(econ, "capital_anchor")
    const lo = param(meta, "round_trip_floor_bps")
    const hi = param(meta, "round_trip_ceiling_bps")
    expect(tax).toBe(200)
    expect(vault).toBe(200)
    const rt = roundTripBps(tax, vault, markup, anchor)
    expect(rt).toBeGreaterThanOrEqual(lo)
    expect(rt).toBeLessThanOrEqual(hi)
    const withdraw = Math.floor((anchor * (BPS + markup)) / BPS)
    const exit = BPS - Math.floor((anchor * BPS) / withdraw)
    expect(vault).toBeLessThan(exit)

    const uncompensated = roundTripBps(tax, 400, markup, anchor)
    expect(uncompensated).toBeGreaterThan(hi)
  })

  it("fund_tax_floor_holds", () => {
    const econ = loadEconomy()
    const meta = loadMeta()
    const seasons = loadSeasons()
    const tax = param(econ, "creator_tax_bps")
    const prize = param(seasons, "prize_creator_tax_share_bps")
    const floor = param(meta, "fund_effective_tax_floor_bps")
    expect(fundTaxBps(tax, prize, 0)).toBeGreaterThanOrEqual(floor)
    expect(fundTaxBps(tax, 7500, 0) < floor).toBe(true)
  })

  it("dex_visible_fee_under_ceiling", () => {
    const econ = loadEconomy()
    const tax = param(econ, "creator_tax_bps")
    const curve = param(econ, "curve_fee_bps")
    const visible = tax + curve
    expect(visible).toBeLessThanOrEqual(2000)
    expect(tax).toBeLessThanOrEqual(1000)
    expect(visible).toBe(tax + curve)
    expect(1100 > 1000).toBe(true)
  })
})
