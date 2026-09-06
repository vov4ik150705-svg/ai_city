import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const BPS = 10000

type ParamRow = { readonly v: number }
type SectionFile = {
  readonly params: Readonly<Record<string, ParamRow | undefined>>
  readonly derived?: Readonly<Record<string, string | undefined>>
}

type WitnessRow = {
  readonly days: number
  readonly i_day: number
  readonly i_season: number
}

type PackFile = {
  readonly generated: {
    readonly seasons: {
      readonly prize_period_city_days: number
      readonly prize_period_real_hours: number
      readonly qualify_days: number
      readonly influence_witnesses: {
        readonly optimizer_ref: WitnessRow
        readonly lazy_whale: WitnessRow
      }
    }
  }
}

function loadSeasons(): SectionFile {
  return JSON.parse(readFileSync(join(repo, "content/params/seasons.json"), "utf8")) as SectionFile
}

function loadBalance(): SectionFile {
  return JSON.parse(readFileSync(join(repo, "content/params/balance.json"), "utf8")) as SectionFile
}

function loadTime(): SectionFile {
  return JSON.parse(readFileSync(join(repo, "content/params/time.json"), "utf8")) as SectionFile
}

function loadPack(): PackFile {
  return JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
}

function param(file: SectionFile, name: string): number {
  const row = file.params[name]
  if (row === undefined) throw new Error(name)
  return row.v
}

describe.sequential("M2 construction", () => {
  it("prize_period_divides_season", () => {
    const seasons = loadSeasons()
    const balance = loadBalance()
    const season = param(balance, "season_city_days")
    const periods = param(seasons, "prize_periods_per_season")
    expect(periods).toBe(3)
    expect(season % periods).toBe(0)
    expect(seasons.params["prize_period_city_days"]).toBeUndefined()
    expect(seasons.params["prize_period_real_hours"]).toBeUndefined()
    expect(seasons.params["prize_period_index"]).toBeUndefined()
    expect(season % 4 === 0).toBe(false)

    const pack = loadPack()
    const period = season / periods
    expect(pack.generated.seasons.prize_period_city_days).toBe(period)
    const time = loadTime()
    expect(pack.generated.seasons.prize_period_real_hours).toBe(period * param(time, "city_day_real_hours"))
  })

  it("influence_integral_per_period", () => {
    const seasons = loadSeasons()
    const balance = loadBalance()
    const period = param(balance, "season_city_days") / param(seasons, "prize_periods_per_season")
    const pack = loadPack()
    const opt = pack.generated.seasons.influence_witnesses.optimizer_ref
    const lazy = pack.generated.seasons.influence_witnesses.lazy_whale
    expect(opt.days).toBe(period)
    expect(opt.i_season).toBe(opt.i_day * opt.days)
    expect(opt.i_season > lazy.i_season).toBe(true)
    expect(lazy.days).toBe(period)
  })

  it("qualify_days_from_period", () => {
    const seasons = loadSeasons()
    const balance = loadBalance()
    const period = param(balance, "season_city_days") / param(seasons, "prize_periods_per_season")
    const need = Math.floor((period * param(seasons, "season_qualify_bps")) / BPS)
    expect(seasons.params["qualify_days"]).toBeUndefined()
    const pack = loadPack()
    expect(pack.generated.seasons.qualify_days).toBe(need)
    const haveDays = 2
    expect(haveDays < need).toBe(true)
    const fromSeason = Math.floor(
      (param(balance, "season_city_days") * param(seasons, "season_qualify_bps")) / BPS,
    )
    expect(need === fromSeason).toBe(false)
  })
})
